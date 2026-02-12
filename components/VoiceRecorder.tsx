'use client';

import { useState, useRef, useEffect, useImperativeHandle, forwardRef } from 'react';

export interface VoiceRecorderRef {
  stopAndGetAudio: () => Promise<Blob | null>;
  isRecording: boolean;
}

interface VoiceRecorderProps {
  onRecordingComplete: (audioBlob: Blob) => void;
  onCancel: () => void;
  onStop: (audioBlob: Blob | null) => void; // Appelé quand on arrête (sans envoyer)
  maxDuration?: number; // en secondes, défaut 60 (1 minute)
  autoStart?: boolean; // Démarrer automatiquement au montage, défaut true
}

const VoiceRecorder = forwardRef<VoiceRecorderRef, VoiceRecorderProps>(({
  onRecordingComplete,
  onCancel,
  onStop,
  maxDuration = 60,
  autoStart = true,
}, ref) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isStopped, setIsStopped] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [recordedAudio, setRecordedAudio] = useState<Blob | null>(null);
  const [volumeLevel, setVolumeLevel] = useState(0); // Niveau de volume (0-100)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasStartedRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const audioBlobPromiseRef = useRef<Promise<Blob | null> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const volumeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isRecordingRef = useRef(false); // Ref pour vérifier l'état actuel dans les callbacks

  const stopRecording = async () => {
    // Si l'enregistrement est déjà arrêté/en pause, reprendre l'enregistrement
    if (isStopped && !isRecording) {
      // Reprendre l'enregistrement
      if (mediaRecorderRef.current && typeof mediaRecorderRef.current.resume === 'function') {
        // Si resume() est disponible, l'utiliser
        try {
          if (mediaRecorderRef.current.state === 'paused') {
            mediaRecorderRef.current.resume();
            setIsRecording(true);
            isRecordingRef.current = true;
            setIsStopped(false);
            
            // Redémarrer les intervalles
            intervalRef.current = setInterval(() => {
              setDuration((prev) => {
                if (prev >= maxDuration) {
                  return maxDuration;
                }
                const newDuration = prev + 1;
                if (newDuration >= maxDuration) {
                  const currentInterval = intervalRef.current;
                  const currentVolumeInterval = volumeIntervalRef.current;
                  if (currentInterval) {
                    clearInterval(currentInterval);
                    intervalRef.current = null;
                  }
                  if (currentVolumeInterval) {
                    clearInterval(currentVolumeInterval);
                    volumeIntervalRef.current = null;
                  }
                  setTimeout(() => {
                    stopRecording();
                  }, 0);
                  return maxDuration;
                }
                return newDuration;
              });
            }, 1000);
            
            // Redémarrer l'analyse du volume
            if (audioContextRef.current && streamRef.current) {
              try {
                const analyser = audioContextRef.current.createAnalyser();
                const microphone = audioContextRef.current.createMediaStreamSource(streamRef.current);
                
                analyser.fftSize = 256;
                analyser.smoothingTimeConstant = 0.8;
                microphone.connect(analyser);
                
                analyserRef.current = analyser;
                
                const dataArray = new Uint8Array(analyser.frequencyBinCount);
                const updateVolume = () => {
                  if (analyserRef.current && mediaRecorderRef.current?.state === 'recording') {
                    analyserRef.current.getByteFrequencyData(dataArray);
                    const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
                    const normalizedVolume = Math.min(100, (average / 255) * 100);
                    setVolumeLevel(normalizedVolume);
                  } else {
                    setVolumeLevel(0);
                  }
                };
                
                volumeIntervalRef.current = setInterval(updateVolume, 50);
              } catch (err) {
                console.warn('Impossible de redémarrer l\'analyseur audio:', err);
              }
            }
            return;
          }
        } catch (err) {
          console.error('Erreur lors de la reprise:', err);
        }
      }
      // Sinon, créer un nouveau MediaRecorder
      await startRecording(true);
      return;
    }
    
    // Sinon, mettre en pause l'enregistrement
    if (!mediaRecorderRef.current) {
      setIsRecording(false);
      isRecordingRef.current = false;
      setIsStopped(true);
      return;
    }
    
    // Vérifier l'état du MediaRecorder
    const state = mediaRecorderRef.current.state;
    if (state === 'inactive') {
      setIsRecording(false);
      isRecordingRef.current = false;
      setIsStopped(true);
      return;
    }
    
    // IMPORTANT: La plupart des navigateurs ne supportent pas pause()/resume() pour MediaRecorder
    // On doit donc utiliser stop() pour vraiment arrêter l'enregistrement
    // Mais on doit empêcher l'événement onstop de créer un blob quand on met en pause
    
    // IMPORTANT: Arrêter les intervalles EN PREMIER pour empêcher le timer de continuer
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (volumeIntervalRef.current) {
      clearInterval(volumeIntervalRef.current);
      volumeIntervalRef.current = null;
    }
    
    // Mettre à jour l'état AVANT d'arrêter pour empêcher la collecte de nouvelles données
    setIsRecording(false);
    isRecordingRef.current = false; // Mettre à jour la ref immédiatement
    setIsStopped(true);
    
    // Arrêter le MediaRecorder seulement s'il existe et est actif
    if (mediaRecorderRef.current) {
      try {
        // Sauvegarder le handler onstop actuel
        const originalOnStop = mediaRecorderRef.current.onstop;
        
        // Désactiver temporairement onstop pour éviter qu'il crée un blob
        mediaRecorderRef.current.onstop = null;
        
        // Arrêter le MediaRecorder - cela arrêtera vraiment l'enregistrement
        if (mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
        
        // IMPORTANT: Ne pas vider les chunks audio - on les garde pour pouvoir reprendre
        // audioChunksRef.current reste intact
        
        // Le MediaRecorder sera recréé quand on reprendra
        mediaRecorderRef.current = null;
      } catch (err) {
        console.error('Erreur lors de l\'arrêt du MediaRecorder:', err);
      }
    }
    
    // Mettre à jour les états
    analyserRef.current = null;
    setVolumeLevel(0);
  };

  const stopAndGetAudio = async (): Promise<Blob | null> => {
    if (!isRecording || !mediaRecorderRef.current) {
      return recordedAudio;
    }

    return new Promise((resolve) => {
      const originalOnStop = mediaRecorderRef.current!.onstop;
      
      mediaRecorderRef.current!.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setRecordedAudio(audioBlob);
        onStop(audioBlob);
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
        }
        if (originalOnStop) {
          // Appeler le handler original avec le contexte et un événement null
          originalOnStop.call(mediaRecorderRef.current!, new Event('stop'));
        }
        resolve(audioBlob);
      };

      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (volumeIntervalRef.current) {
        clearInterval(volumeIntervalRef.current);
        volumeIntervalRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      analyserRef.current = null;
      setVolumeLevel(0);
      setIsRecording(false);
      isRecordingRef.current = false;
      setIsStopped(true);
    });
  };

  useImperativeHandle(ref, () => ({
    stopAndGetAudio,
    isRecording,
  }));

  const startRecording = async (isResuming = false) => {
    try {
      setError(null);
      
      // Si on reprend l'enregistrement, réutiliser le stream existant
      let stream = streamRef.current;
      if (!stream) {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
      }
      
      // Si on reprend, ne pas réinitialiser les chunks audio
      if (!isResuming) {
        audioChunksRef.current = [];
      }
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      mediaRecorder.ondataavailable = (event) => {
        // Ne collecter des données que si l'enregistrement est actif
        if (event.data.size > 0 && isRecording) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setRecordedAudio(audioBlob);
        onStop(audioBlob);
        // Ne pas arrêter le stream pour pouvoir reprendre
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000); // Collecter des données toutes les secondes
      setIsRecording(true);
      isRecordingRef.current = true; // Mettre à jour la ref immédiatement
      setIsStopped(false);
      
      // Si on reprend, ne pas réinitialiser la durée
      if (!isResuming) {
        setDuration(0);
        setRecordedAudio(null);
      }

      // Créer l'audio context pour analyser le volume
      try {
        if (!audioContextRef.current) {
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          audioContextRef.current = audioContext;
        }
        
        const analyser = audioContextRef.current.createAnalyser();
        const microphone = audioContextRef.current.createMediaStreamSource(stream);
        
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;
        microphone.connect(analyser);
        
        analyserRef.current = analyser;

        // Analyser le volume en temps réel
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const updateVolume = () => {
          if (analyserRef.current && mediaRecorderRef.current?.state === 'recording') {
            analyserRef.current.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
            const normalizedVolume = Math.min(100, (average / 255) * 100);
            setVolumeLevel(normalizedVolume);
          } else {
            setVolumeLevel(0);
          }
        };

        volumeIntervalRef.current = setInterval(updateVolume, 50); // Mettre à jour toutes les 50ms
      } catch (err) {
        console.warn('Impossible d\'initialiser l\'analyseur audio:', err);
      }

      // Démarrer le compteur
      intervalRef.current = setInterval(() => {
        // Vérifier si l'enregistrement est toujours actif en utilisant la ref
        if (!isRecordingRef.current) {
          // Si l'enregistrement n'est plus actif, arrêter le timer
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          return;
        }
        
        setDuration((prev) => {
          // Vérifier à nouveau l'état avant d'incrémenter
          if (prev >= maxDuration) {
            return maxDuration; // Ne pas dépasser la durée maximale
          }
          
          const newDuration = prev + 1;
          
          // Arrêter l'enregistrement si on atteint la durée maximale
          if (newDuration >= maxDuration) {
            // Arrêter les intervalles immédiatement AVANT d'appeler stopRecording
            const currentInterval = intervalRef.current;
            const currentVolumeInterval = volumeIntervalRef.current;
            
            if (currentInterval) {
              clearInterval(currentInterval);
              intervalRef.current = null;
            }
            if (currentVolumeInterval) {
              clearInterval(currentVolumeInterval);
              volumeIntervalRef.current = null;
            }
            
            // Arrêter l'enregistrement de manière asynchrone pour éviter les problèmes de timing
            setTimeout(() => {
              stopRecording();
            }, 0);
            
            return maxDuration; // Ne pas dépasser la durée maximale
          }
          
          return newDuration;
        });
      }, 1000);
    } catch (err: any) {
      setError('Impossible d\'accéder au microphone. Vérifiez les permissions.');
      console.error('Erreur lors de l\'enregistrement:', err);
    }
  };

  useEffect(() => {
    // Démarrer l'enregistrement automatiquement au montage si autoStart est true
    // On vérifie hasStartedRef pour éviter de démarrer plusieurs fois
    if (autoStart && !hasStartedRef.current) {
      hasStartedRef.current = true;
      startRecording();
    }

    return () => {
      // Nettoyer lors du démontage
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (volumeIntervalRef.current) {
        clearInterval(volumeIntervalRef.current);
        volumeIntervalRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      // Réinitialiser hasStartedRef au démontage pour permettre un nouveau démarrage au prochain montage
      hasStartedRef.current = false;
    };
  }, [autoStart]);


  const cancelRecording = () => {
    // IMPORTANT: Marquer comme annulé EN PREMIER pour empêcher le redémarrage automatique
    hasStartedRef.current = false;
    
    // Vider les chunks audio AVANT d'arrêter l'enregistrement pour éviter que l'événement onstop ne crée un blob
    audioChunksRef.current = [];
    setRecordedAudio(null);
    
    // Arrêter l'enregistrement si en cours (peu importe l'état : recording, paused, ou stopped)
    // On peut annuler à tout moment, même si l'enregistrement est en pause ou arrêté
    if (mediaRecorderRef.current) {
      // Désactiver l'événement onstop pour éviter qu'il ne crée un blob audio
      mediaRecorderRef.current.onstop = null;
      
      // Arrêter l'enregistrement dans tous les cas (recording, paused, etc.)
      // Même si l'état est 'inactive' (après pause), on nettoie quand même
      try {
        const state = mediaRecorderRef.current.state;
        if (state === 'recording' || state === 'paused') {
          mediaRecorderRef.current.stop();
        }
        // Si l'état est déjà 'inactive' (après pause), on continue le nettoyage
      } catch (err) {
        console.warn('Erreur lors de l\'arrêt du MediaRecorder:', err);
      }
      mediaRecorderRef.current = null;
    }
    
    // Nettoyer les intervalles (peu importe l'état - même si déjà nettoyés après pause)
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (volumeIntervalRef.current) {
      clearInterval(volumeIntervalRef.current);
      volumeIntervalRef.current = null;
    }
    
    // Fermer l'audio context (même s'il est resté ouvert après la pause)
    if (audioContextRef.current) {
      try {
        if (audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close();
        }
      } catch (err) {
        console.warn('Erreur lors de la fermeture de l\'AudioContext:', err);
      }
      audioContextRef.current = null;
    }
    
    // Arrêter le stream audio pour libérer le microphone
    // IMPORTANT: Même si l'enregistrement est en pause, le stream est toujours actif
    // Il faut donc l'arrêter lors de l'annulation
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        // Arrêter toutes les tracks, même si elles sont 'live' ou 'ended'
        if (track.readyState === 'live') {
          track.stop();
        }
      });
      streamRef.current = null;
    }
    
    // Réinitialiser tous les états à zéro (comme si on n'avait jamais enregistré)
    analyserRef.current = null;
    setVolumeLevel(0);
    setIsRecording(false);
    isRecordingRef.current = false;
    setIsStopped(false);
    setDuration(0);
    
    // Appeler le callback d'annulation pour notifier le parent (cela démontera le composant)
    // On appelle onCancel() en dernier pour que le composant se démonte immédiatement
    onCancel();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="voice-recorder">
      {error && <div className="voice-recorder-error">{error}</div>}
      
      <div className="voice-recorder-controls">
        <div className="voice-recorder-timer">
          <span className="recording-indicator" style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', display: 'inline-block', flexShrink: 0 }} />
          <span>{formatTime(duration)} / {formatTime(maxDuration)}</span>
        </div>
        {isRecording && (
          <div className="voice-recorder-volume">
            <div className="volume-bars">
              {Array.from({ length: 20 }).map((_, index) => {
                const barHeight = volumeLevel > index * 5 ? Math.min(100, (volumeLevel - index * 5) * 5) : 0;
                return (
                  <div
                    key={index}
                    className="volume-bar"
                    style={{
                      height: `${Math.max(4, barHeight)}%`,
                      opacity: barHeight > 0 ? 0.6 + (barHeight / 100) * 0.4 : 0.2,
                    }}
                  />
                );
              })}
            </div>
          </div>
        )}
        <button
          type="button"
          className="voice-recorder-btn stop"
          onClick={stopRecording}
          disabled={false}
          title={isStopped && !isRecording ? "Reprendre l'enregistrement" : "Arrêter l'enregistrement"}
        >
          {isStopped && !isRecording ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" fill="currentColor"/>
              <path d="M10 8l6 4-6 4V8z" fill="white"/>
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/>
            </svg>
          )}
        </button>
        <button
          type="button"
          className="voice-recorder-btn cancel"
          onClick={cancelRecording}
          title="Annuler l'enregistrement"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14zM10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
});

VoiceRecorder.displayName = 'VoiceRecorder';

export default VoiceRecorder;


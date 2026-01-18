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

  const stopRecording = async () => {
    // Si l'enregistrement est déjà arrêté, reprendre l'enregistrement
    if (isStopped && !isRecording) {
      // Reprendre l'enregistrement
      await startRecording();
      return;
    }
    
    // Sinon, arrêter l'enregistrement
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
    // Ne pas fermer l'audio context pour pouvoir reprendre
    // On garde le stream actif aussi
    analyserRef.current = null;
    setVolumeLevel(0);
    setIsRecording(false);
    setIsStopped(true);
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
          originalOnStop.call(mediaRecorderRef.current!);
        }
        resolve(audioBlob);
      };

      if (mediaRecorderRef.current.state !== 'inactive') {
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
      setIsStopped(true);
    });
  };

  useImperativeHandle(ref, () => ({
    stopAndGetAudio,
    isRecording,
  }));

  const startRecording = async () => {
    try {
      setError(null);
      
      // Si on reprend l'enregistrement, réutiliser le stream existant
      let stream = streamRef.current;
      if (!stream) {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
      }
      
      // Si on reprend, ne pas réinitialiser les chunks audio
      const isResuming = isStopped && audioChunksRef.current.length > 0;
      if (!isResuming) {
        audioChunksRef.current = [];
      }
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
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
        setDuration((prev) => {
          const newDuration = prev + 1;
          if (newDuration >= maxDuration) {
            stopRecording();
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
    if (autoStart && !hasStartedRef.current) {
      hasStartedRef.current = true;
      startRecording();
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (volumeIntervalRef.current) {
        clearInterval(volumeIntervalRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, [autoStart]);


  const cancelRecording = () => {
    // Arrêter l'enregistrement si en cours
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    // Nettoyer les intervalles
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (volumeIntervalRef.current) {
      clearInterval(volumeIntervalRef.current);
      volumeIntervalRef.current = null;
    }
    // Fermer l'audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    // Arrêter le stream audio
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    // Réinitialiser tous les états
    analyserRef.current = null;
    setVolumeLevel(0);
    setIsRecording(false);
    setIsStopped(false);
    setDuration(0);
    audioChunksRef.current = [];
    setRecordedAudio(null);
    hasStartedRef.current = false; // Réinitialiser pour éviter le redémarrage automatique
    // Appeler le callback d'annulation pour notifier le parent
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
          <span className="recording-indicator">🔴</span>
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


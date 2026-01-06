'use client';

import { useState, useRef, useEffect } from 'react';

interface VoiceRecorderProps {
  onRecordingComplete: (audioBlob: Blob) => void;
  onCancel: () => void;
  maxDuration?: number; // en secondes, défaut 60 (1 minute)
}

export default function VoiceRecorder({
  onRecordingComplete,
  onCancel,
  maxDuration = 60,
}: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        onRecordingComplete(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000); // Collecter des données toutes les secondes
      setIsRecording(true);
      setDuration(0);

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

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsRecording(false);
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsRecording(false);
    setDuration(0);
    audioChunksRef.current = [];
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
        {!isRecording ? (
          <>
            <button
              type="button"
              className="voice-recorder-btn start"
              onClick={startRecording}
            >
              🎤 Enregistrer
            </button>
            <button
              type="button"
              className="voice-recorder-btn cancel"
              onClick={onCancel}
            >
              Annuler
            </button>
          </>
        ) : (
          <>
            <div className="voice-recorder-timer">
              <span className="recording-indicator">🔴</span>
              <span>{formatTime(duration)} / {formatTime(maxDuration)}</span>
            </div>
            <button
              type="button"
              className="voice-recorder-btn stop"
              onClick={stopRecording}
            >
              ⏹️ Arrêter
            </button>
            <button
              type="button"
              className="voice-recorder-btn cancel"
              onClick={cancelRecording}
            >
              Annuler
            </button>
          </>
        )}
      </div>
    </div>
  );
}


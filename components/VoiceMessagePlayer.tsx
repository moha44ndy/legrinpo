'use client';

import { useRef, useEffect, useState } from 'react';

interface VoiceMessagePlayerProps {
  url: string;
  type?: string;
  messageId: string;
}

function formatTime(seconds: number): string {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Note vocale style WhatsApp : bulle compacte avec play/pause et durée, pas le lecteur audio standard.
 */
export default function VoiceMessagePlayer({ url, type = 'audio/webm', messageId }: VoiceMessagePlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !url) return;
    el.src = url;
    el.load();
  }, [url]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onMeta = () => {
      const d = el.duration;
      setDuration(Number.isFinite(d) && d > 0 ? d : 0);
      setLoaded(true);
    };
    const onTime = () => {
      const t = el.currentTime;
      setCurrentTime(Number.isFinite(t) && t >= 0 ? t : 0);
    };
    const onEnd = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    el.addEventListener('loadedmetadata', onMeta);
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('ended', onEnd);
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    return () => {
      el.removeEventListener('loadedmetadata', onMeta);
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('ended', onEnd);
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
    };
  }, [url]);

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) el.play();
    else el.pause();
  };

  if (!url) return null;

  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const safeCurrent = Number.isFinite(currentTime) && currentTime >= 0 ? currentTime : 0;
  const progress = safeDuration > 0 ? Math.min(100, (safeCurrent / safeDuration) * 100) : 0;

  return (
    <div className="voice-note-bubble">
      <audio ref={audioRef} key={`voice-${messageId}`} preload="metadata" playsInline>
        <source src={url} type={type} />
      </audio>
      <button
        type="button"
        className="voice-note-play"
        onClick={togglePlay}
        aria-label={isPlaying ? 'Pause' : 'Écouter la note vocale'}
        title={isPlaying ? 'Pause' : 'Écouter'}
      >
        {isPlaying ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>
      <div className="voice-note-info">
        <div className="voice-note-progress-bar" role="presentation">
          <div className="voice-note-progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <span className="voice-note-duration">
          {loaded ? formatTime(safeCurrent) : '0:00'}
          {loaded && safeDuration > 0 && <span className="voice-note-duration-total"> / {formatTime(safeDuration)}</span>}
        </span>
      </div>
    </div>
  );
}

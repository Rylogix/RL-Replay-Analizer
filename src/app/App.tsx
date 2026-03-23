import { useEffect, useRef } from 'react';
import { HomePage } from '../pages/HomePage';
import { useReplayForgeStore } from './store';

export const App = () => {
  const {
    replay,
    isPlaying,
    playbackSpeed,
    currentTime,
    hydrateSessions,
    seek,
    togglePlayback,
    step,
    setPlaybackSpeed
  } = useReplayForgeStore();
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    hydrateSessions();
  }, [hydrateSessions]);

  useEffect(() => {
    if (!replay || !isPlaying) {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
      return;
    }

    let previous = performance.now();
    const tick = (now: number) => {
      const delta = ((now - previous) / 1000) * playbackSpeed;
      previous = now;
      const nextTime = currentTime + delta;
      if (nextTime >= replay.meta.durationSeconds) {
        seek(replay.meta.durationSeconds);
        togglePlayback();
        return;
      }
      seek(nextTime);
      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [currentTime, isPlaying, playbackSpeed, replay, seek, togglePlayback]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) {
        return;
      }

      if (event.code === 'Space') {
        event.preventDefault();
        togglePlayback();
      }

      if (event.code === 'ArrowRight') {
        event.preventDefault();
        step(event.shiftKey ? 5 : 1);
      }

      if (event.code === 'ArrowLeft') {
        event.preventDefault();
        step(event.shiftKey ? -5 : -1);
      }

      if (event.key === ']') {
        setPlaybackSpeed(Math.min(playbackSpeed + 0.5, 4));
      }

      if (event.key === '[') {
        setPlaybackSpeed(Math.max(playbackSpeed - 0.5, 0.5));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [playbackSpeed, setPlaybackSpeed, step, togglePlayback]);

  return <HomePage />;
};


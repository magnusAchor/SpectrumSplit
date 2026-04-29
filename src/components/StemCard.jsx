/**
 * StemCard.jsx
 * Displays a single stem with audio preview player and download button.
 * Shows whether the stem is AI-isolated or spectrally derived.
 */

import React, { useRef, useState, useEffect } from 'react';
import { Download, Play, Pause, Sparkles, FlaskConical } from 'lucide-react';
import { downloadBlob } from '@/utils/zipExport';

const STEM_COLORS = {
  vocals: 'from-pink-500/20 to-rose-500/10 border-pink-500/30',
  drums: 'from-orange-500/20 to-amber-500/10 border-orange-500/30',
  bass: 'from-blue-500/20 to-cyan-500/10 border-blue-500/30',
  other: 'from-green-500/20 to-emerald-500/10 border-green-500/30',
  kick: 'from-red-500/20 to-orange-500/10 border-red-500/30',
  snare: 'from-yellow-500/20 to-amber-500/10 border-yellow-500/30',
  cymbals: 'from-amber-500/20 to-yellow-500/10 border-amber-500/30',
  toms: 'from-orange-400/20 to-red-500/10 border-orange-400/30',
  otherDrums: 'from-red-400/20 to-orange-400/10 border-red-400/30',
  leadVocals: 'from-fuchsia-500/20 to-pink-500/10 border-fuchsia-500/30',
  backingVocals: 'from-purple-500/20 to-fuchsia-500/10 border-purple-500/30',
  guitar: 'from-lime-500/20 to-green-500/10 border-lime-500/30',
  piano: 'from-sky-500/20 to-blue-500/10 border-sky-500/30',
  synth: 'from-violet-500/20 to-purple-500/10 border-violet-500/30',
  strings: 'from-teal-500/20 to-cyan-500/10 border-teal-500/30',
};

const STEM_ICONS = {
  vocals: '🎤',
  drums: '🥁',
  bass: '🎸',
  other: '🎹',
  kick: '💥',
  snare: '🔔',
  cymbals: '✨',
  toms: '🪘',
  otherDrums: '🎼',
  leadVocals: '🌟',
  backingVocals: '🎵',
  guitar: '🎸',
  piano: '🎹',
  synth: '🎛️',
  strings: '🎻',
};

export default function StemCard({ name, label, blob, isAI }) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    setAudioUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [blob]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) setDuration(audioRef.current.duration);
  };

  const handleEnded = () => setIsPlaying(false);

  const handleSeek = (e) => {
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    audioRef.current.currentTime = ratio * duration;
  };

  const handleDownload = () => {
    if (blob) downloadBlob(blob, `${name}.wav`);
  };

  const colorClass = STEM_COLORS[name] || STEM_COLORS.other;
  const icon = STEM_ICONS[name] || '🎵';
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  const formatTime = (t) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`bg-gradient-to-br ${colorClass} border rounded-xl p-4 flex flex-col gap-3`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{icon}</span>
          <div>
            <p className="text-sm font-semibold text-foreground leading-tight">{label}</p>
            <div className="flex items-center gap-1 mt-0.5">
              {isAI ? (
                <>
                  <Sparkles className="w-3 h-3 text-violet-400" />
                  <span className="text-xs text-violet-400">AI Isolated</span>
                </>
              ) : (
                <>
                  <FlaskConical className="w-3 h-3 text-amber-400" />
                  <span className="text-xs text-amber-400">Approx.</span>
                </>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={handleDownload}
          className="w-8 h-8 rounded-lg bg-background/60 hover:bg-background/90 flex items-center justify-center transition-colors"
          title="Download WAV"
        >
          <Download className="w-4 h-4 text-foreground" />
        </button>
      </div>

      {/* Seek bar */}
      <div
        className="w-full h-1.5 bg-background/40 rounded-full cursor-pointer overflow-hidden"
        onClick={handleSeek}
      >
        <div
          className="h-full bg-white/60 rounded-full transition-all duration-100"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <button
          onClick={togglePlay}
          className="w-7 h-7 rounded-full bg-background/60 hover:bg-background/90 flex items-center justify-center transition-colors"
        >
          {isPlaying
            ? <Pause className="w-3.5 h-3.5 text-foreground" />
            : <Play className="w-3.5 h-3.5 text-foreground ml-0.5" />
          }
        </button>
        <span className="text-xs text-muted-foreground font-mono">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>

      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleEnded}
          preload="metadata"
        />
      )}
    </div>
  );
}
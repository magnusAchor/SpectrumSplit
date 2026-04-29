/**
 * ProgressPanel.jsx
 * Displays model loading and processing progress with animated status messages.
 */

import React from 'react';
import { Loader2, Cpu, Zap, Brain } from 'lucide-react';

const phaseIcons = {
  download: Zap,
  load: Cpu,
  inference: Brain,
  postprocess: Brain,
  default: Loader2,
};

export default function ProgressPanel({ progress }) {
  if (!progress) return null;

  const { phase, percent, message } = progress;
  const Icon = phaseIcons[phase] || phaseIcons.default;
  const isIndeterminate = percent === -1;

  return (
    <div className="w-full bg-card border border-border rounded-2xl p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-violet-500/10 flex items-center justify-center">
          <Icon className="w-5 h-5 text-violet-400 animate-pulse" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{message}</p>
          {!isIndeterminate && percent !== undefined && (
            <p className="text-xs text-muted-foreground mt-0.5">{percent}% complete</p>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
        {isIndeterminate ? (
          <div className="h-full w-1/3 bg-gradient-to-r from-violet-500 to-purple-400 rounded-full animate-[slide_1.5s_ease-in-out_infinite]" />
        ) : (
          <div
            className="h-full bg-gradient-to-r from-violet-500 to-purple-400 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${Math.max(2, percent || 0)}%` }}
          />
        )}
      </div>

      <style>{`
        @keyframes slide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
    </div>
  );
}
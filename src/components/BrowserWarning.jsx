/**
 * BrowserWarning.jsx
 * Detects unsupported browsers and missing features.
 * Shows warnings for WebGPU, WebGL, and Web Audio API support.
 */

import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, XCircle, Cpu } from 'lucide-react';

function checkCapabilities() {
  const caps = {
    webAudio: !!(window.AudioContext || window.webkitAudioContext),
    webGPU: !!(navigator.gpu),
    webGL: false,
    webAssembly: typeof WebAssembly !== 'undefined',
    offlineAudio: !!window.OfflineAudioContext,
  };

  try {
    const canvas = document.createElement('canvas');
    caps.webGL = !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    caps.webGL = false;
  }

  return caps;
}

export default function BrowserWarning() {
  const [caps, setCaps] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setCaps(checkCapabilities());
  }, []);

  if (!caps || dismissed) return null;

  const isCritical = !caps.webAudio || !caps.webAssembly;
  const hasWarning = !caps.webGPU && !caps.webGL;

  if (!isCritical && !hasWarning) return null;

  const items = [
    { label: 'Web Audio API', ok: caps.webAudio, critical: true },
    { label: 'WebAssembly (ONNX)', ok: caps.webAssembly, critical: true },
    { label: 'WebGPU (fastest)', ok: caps.webGPU, critical: false },
    { label: 'WebGL (fallback)', ok: caps.webGL, critical: false },
  ];

  return (
    <div className={`rounded-xl border p-4 ${isCritical
      ? 'bg-destructive/10 border-destructive/30'
      : 'bg-amber-500/10 border-amber-500/30'}`}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${isCritical ? 'text-destructive' : 'text-amber-400'}`} />
        <div className="flex-1 space-y-3">
          <div>
            <p className="text-sm font-semibold text-foreground">
              {isCritical ? 'Browser Not Supported' : 'Limited Performance Mode'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {isCritical
                ? 'Your browser is missing required APIs. Please use Chrome 113+ or Edge 113+.'
                : 'WebGPU is not available. Processing will use CPU and may be slower.'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {items.map(({ label, ok, critical }) => (
              <div key={label} className="flex items-center gap-1.5">
                {ok
                  ? <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                  : critical
                    ? <XCircle className="w-3.5 h-3.5 text-destructive" />
                    : <Cpu className="w-3.5 h-3.5 text-amber-400" />
                }
                <span className={`text-xs ${ok ? 'text-foreground' : critical ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {label}
                </span>
              </div>
            ))}
          </div>

          {!isCritical && (
            <button
              onClick={() => setDismissed(true)}
              className="text-xs text-muted-foreground hover:text-foreground underline transition-colors"
            >
              Dismiss
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
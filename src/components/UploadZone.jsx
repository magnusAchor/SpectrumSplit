/**
 * UploadZone.jsx
 * Drag-and-drop + click-to-upload area for audio files.
 * Validates file type (mp3/wav) and size (max 50MB).
 */

import React, { useCallback, useState } from 'react';
import { Upload, Music, AlertCircle } from 'lucide-react';

const MAX_FILE_SIZE_MB = 50;
const ACCEPTED_TYPES = ['audio/mpeg', 'audio/wav', 'audio/wave', 'audio/x-wav', 'audio/mp3'];

export default function UploadZone({ onFileSelected, disabled }) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState('');

  const validateAndSelect = useCallback((file) => {
    setError('');
    if (!file) return;

    const isAudio = ACCEPTED_TYPES.includes(file.type) ||
      file.name.endsWith('.mp3') ||
      file.name.endsWith('.wav');

    if (!isAudio) {
      setError('Please upload an MP3 or WAV file.');
      return;
    }

    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > MAX_FILE_SIZE_MB) {
      setError(`File too large (${sizeMB.toFixed(1)}MB). Maximum is ${MAX_FILE_SIZE_MB}MB.`);
      return;
    }

    onFileSelected(file);
  }, [onFileSelected]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    const file = e.dataTransfer.files[0];
    validateAndSelect(file);
  }, [disabled, validateAndSelect]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  }, [disabled]);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleClick = useCallback(() => {
    if (disabled) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.mp3,.wav,audio/mpeg,audio/wav';
    input.onchange = (e) => validateAndSelect(e.target.files[0]);
    input.click();
  }, [disabled, validateAndSelect]);

  return (
    <div className="w-full">
      <div
        onClick={handleClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer
          transition-all duration-300 group
          ${isDragging
            ? 'border-violet-500 bg-violet-500/10 scale-[1.02]'
            : 'border-border hover:border-violet-400 hover:bg-violet-500/5'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <div className="flex flex-col items-center gap-4">
          <div className={`
            w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300
            ${isDragging ? 'bg-violet-500/20' : 'bg-muted group-hover:bg-violet-500/10'}
          `}>
            {isDragging ? (
              <Music className="w-8 h-8 text-violet-400 animate-bounce" />
            ) : (
              <Upload className="w-8 h-8 text-muted-foreground group-hover:text-violet-400 transition-colors" />
            )}
          </div>

          <div>
            <p className="text-lg font-semibold text-foreground">
              {isDragging ? 'Drop your audio file' : 'Upload Audio File'}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Drag & drop or click to browse
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              MP3 or WAV · Max 50MB · Best results under 60 seconds
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-3 flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
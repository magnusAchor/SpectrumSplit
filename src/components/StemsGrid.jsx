/**
 * StemsGrid.jsx
 * Renders all separated stems in categorized groups.
 * Clearly distinguishes AI-isolated stems from spectral approximations.
 */

import React from 'react';
import { Download, Sparkles, FlaskConical, Info } from 'lucide-react';
import StemCard from './StemCard';
import { downloadAllAsZip, downloadAllIndividually } from '@/utils/zipExport';
import { useState } from 'react';

const AI_STEMS = [
  { name: 'vocals', label: 'Vocals' },
  { name: 'drums', label: 'Drums' },
  { name: 'bass', label: 'Bass' },
  { name: 'other', label: 'Other' },
];

const VOCAL_SUBSTEMS = [
  { name: 'leadVocals', label: 'Lead Vocals' },
  { name: 'backingVocals', label: 'Backing Vocals' },
];

const DRUM_SUBSTEMS = [
  { name: 'kick', label: 'Kick' },
  { name: 'snare', label: 'Snare' },
  { name: 'cymbals', label: 'Cymbals' },
  { name: 'toms', label: 'Toms' },
  { name: 'otherDrums', label: 'Other Drums' },
];

const INSTRUMENT_SUBSTEMS = [
  { name: 'guitar', label: 'Guitar' },
  { name: 'piano', label: 'Piano' },
  { name: 'synth', label: 'Synth' },
  { name: 'strings', label: 'Strings' },
];

export default function StemsGrid({ stems }) {
  const [zipStatus, setZipStatus] = useState('');

  if (!stems || Object.keys(stems).length === 0) return null;

  const allStemsList = Object.entries(stems).map(([name, data]) => ({
    name,
    blob: data.blob,
  }));

  const handleDownloadAll = async () => {
    setZipStatus('Preparing ZIP...');
    await downloadAllAsZip(allStemsList, setZipStatus);
    setTimeout(() => setZipStatus(''), 3000);
  };

  const renderGroup = (title, stemDefs, isAI) => (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {isAI
          ? <Sparkles className="w-4 h-4 text-violet-400" />
          : <FlaskConical className="w-4 h-4 text-amber-400" />
        }
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {!isAI && (
          <span className="text-xs text-muted-foreground">(spectral approximation)</span>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {stemDefs.map(({ name, label }) => {
          const stemData = stems[name];
          if (!stemData?.blob) return null;
          return (
            <StemCard
              key={name}
              name={name}
              label={label}
              blob={stemData.blob}
              isAI={stemData.isAI ?? isAI}
            />
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">Separated Stems</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {Object.keys(stems).length} tracks ready to download
          </p>
        </div>
        <button
          onClick={handleDownloadAll}
          className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-medium transition-colors"
        >
          <Download className="w-4 h-4" />
          {zipStatus || 'Download All as ZIP'}
        </button>
      </div>

      {/* Disclaimer */}
      <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
        <Info className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-muted-foreground">
          <span className="text-amber-400 font-semibold">About stem quality: </span>
          Stems marked <span className="text-violet-400 font-medium">AI Isolated</span> use the Demucs deep learning model for true separation.
          Stems marked <span className="text-amber-400 font-medium">Approx.</span> are derived via frequency band filtering — they are approximations
          and will contain bleed from other instruments. For professional use, only trust the 4 AI-isolated stems.
        </div>
      </div>

      {/* AI Stems */}
      {renderGroup('AI-Isolated Stems (Demucs)', AI_STEMS, true)}

      {/* Vocal Sub-stems */}
      {renderGroup('Vocal Sub-stems', VOCAL_SUBSTEMS, false)}

      {/* Drum Sub-stems */}
      {renderGroup('Drum Sub-stems', DRUM_SUBSTEMS, false)}

      {/* Instrument Sub-stems */}
      {renderGroup('Instrument Sub-stems (from "Other")', INSTRUMENT_SUBSTEMS, false)}
    </div>
  );
}
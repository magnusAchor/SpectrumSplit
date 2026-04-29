import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Music2,
  Upload,
  AlertCircle,
  Clock,
  Download,
  Play,
  Pause,
  Layers
} from 'lucide-react';

export default function Home() {
  const [file, setFile] = useState(null);
  const [stems, setStems] = useState(null);
  const [otherStem, setOtherStem] = useState(null);
  const [instrumentStems, setInstrumentStems] = useState(null);

  const [loading, setLoading] = useState(false);
  const [splitting, setSplitting] = useState(false);
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(120);
  const [progress, setProgress] = useState(0);

  /* ================= AUTO RESET ================= */
  useEffect(() => {
    if (!stems && !instrumentStems) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          reset();
          return 120;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [stems, instrumentStems]);

  /* ================= UPLOAD (DEMUCS STEP 1) ================= */
  const handleUpload = useCallback(async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setError('');
    setLoading(true);
    setProgress(0);
    setStems(null);
    setInstrumentStems(null);
    setOtherStem(null);
    setTimeLeft(120);

    const progressInterval = setInterval(() => {
      setProgress((p) => (p >= 92 ? 92 : p + Math.random() * 12));
    }, 250);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const res = await fetch('http://127.0.0.1:5000/separate', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Upload failed');

      const data = await res.json();

      setStems(data.stems || null);
      setOtherStem(data.stems?.other || null); // IMPORTANT FIX

      setProgress(100);
    } catch (err) {
      console.error(err);
      setError('Failed to process audio');
    } finally {
      setLoading(false);
      clearInterval(progressInterval);
    }
  }, []);

  /* ================= STEP 2: INSTRUMENT SPLIT ================= */
  const processOtherStem = async () => {
    try {
      setSplitting(true);
      setError('');

      const res = await fetch('http://127.0.0.1:5000/split-instruments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio: otherStem }),
      });

      if (!res.ok) throw new Error('Instrument split failed');

      const data = await res.json();
      setInstrumentStems(data.instruments);

    } catch (err) {
      console.error(err);
      setError('Failed to split instrument stem');
    } finally {
      setSplitting(false);
    }
  };

  const reset = () => {
    setFile(null);
    setStems(null);
    setOtherStem(null);
    setInstrumentStems(null);
    setError('');
    setTimeLeft(120);
    setProgress(0);
  };

  /* ================= FLATTEN INSTRUMENT STEMS ================= */
  const flattenedInstrumentStems = useMemo(() => {
    if (!instrumentStems) return [];

    return Object.entries(instrumentStems).map(([name, data]) => ({
      name,
      url: data?.url || data,
    }));
  }, [instrumentStems]);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-5xl mx-auto px-6 py-12">

        {/* HEADER */}
        <div className="flex justify-between mb-12">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-pink-500 rounded-2xl flex items-center justify-center">
              <Music2 className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-4xl font-bold">SpectrumSplits</h1>
              <p className="text-zinc-400">AI Audio Stem Separator</p>
            </div>
          </div>

          {(stems || instrumentStems) && (
            <button onClick={reset} className="text-zinc-400 hover:text-white">
              Reset
            </button>
          )}
        </div>

        {/* UPLOAD */}
        {!loading && !stems && (
          <div className="border-2 border-dashed border-zinc-700 rounded-3xl p-20 text-center">
            <Upload className="w-12 h-12 text-violet-400 mx-auto mb-6" />

            <h2 className="text-3xl font-semibold mb-3">Split Your Track</h2>
            <p className="text-zinc-400 mb-10">
              Upload → AI separates stems → optional instrument breakdown
            </p>

            <label className="bg-white text-black px-10 py-4 rounded-2xl font-semibold cursor-pointer">
              Select Audio
              <input type="file" accept="audio/*" hidden onChange={handleUpload} />
            </label>
          </div>
        )}

        {/* LOADING STEP 1 */}
        {loading && (
          <div className="text-center py-20">
            <div className="w-16 h-16 border-4 border-zinc-700 border-t-violet-500 rounded-full animate-spin mx-auto" />
            <p className="mt-6">Running Demucs separation...</p>
          </div>
        )}

        {/* TIMER */}
        {(stems || instrumentStems) && (
          <div className="bg-amber-950 border border-amber-800 p-4 rounded-2xl flex gap-3 mb-8">
            <Clock className="text-amber-400" />
            <p>Auto-delete in <b>{timeLeft}</b> seconds</p>
          </div>
        )}

        {/* MAIN STEMS */}
        {stems && (
          <div className="mb-10 space-y-6">
            <h2 className="flex items-center gap-2 text-zinc-300">
              <Layers className="w-4 h-4" />
              Main Stems
            </h2>

            <div className="grid gap-6">
              {Object.entries(stems).map(([name, url]) => (
                <StemPlayer key={name} name={name} url={url} />
              ))}
            </div>
          </div>
        )}

        {/* STEP 2 UI */}
        {stems && otherStem && !instrumentStems && (
          <div className="mb-10 bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
            <h2 className="text-xl font-semibold mb-2">
              🎛️ Process Other Stem
            </h2>

            <p className="text-zinc-400 mb-4 text-sm">
              This will extract:
              <span className="text-white"> Guitar, Piano, Synth</span>
            </p>

            <div className="flex gap-2 mb-5 text-sm">
              <span className="bg-zinc-800 px-3 py-1 rounded-full">🎸 Guitar</span>
              <span className="bg-zinc-800 px-3 py-1 rounded-full">🎹 Piano</span>
              <span className="bg-zinc-800 px-3 py-1 rounded-full">🎛️ Synth</span>
            </div>

            <button
              onClick={processOtherStem}
              disabled={splitting}
              className="bg-gradient-to-r from-violet-500 to-pink-500 px-6 py-3 rounded-2xl font-semibold"
            >
              {splitting ? 'Processing...' : 'Process Other Stem'}
            </button>
          </div>
        )}

        {/* INSTRUMENT STEMS */}
        {instrumentStems && (
          <div className="space-y-6">
            <h2 className="text-zinc-300">🎸 Instrument Split</h2>

            <div className="grid gap-6">
              {flattenedInstrumentStems.map((stem) => (
                <StemPlayer key={stem.name} name={stem.name} url={stem.url} />
              ))}
            </div>
          </div>
        )}

        {/* ERROR */}
        {error && (
          <div className="bg-red-950 border border-red-800 p-4 rounded-2xl mt-6 flex gap-3">
            <AlertCircle className="text-red-400" />
            <p>{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ================= PLAYER ================= */

function StemPlayer({ name, url }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const audioRef = React.useRef(null);

  const toggle = () => {
    if (!audioRef.current) return;

    isPlaying ? audioRef.current.pause() : audioRef.current.play();
    setIsPlaying(!isPlaying);
  };

  const update = () => {
    const a = audioRef.current;
    if (!a) return;
    setProgress((a.currentTime / a.duration) * 100 || 0);
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
      <div className="flex justify-between mb-4">
        <h3 className="capitalize">{name}</h3>

        <a href={url} download className="text-violet-400 flex gap-2 text-sm">
          <Download className="w-4 h-4" />
          Download
        </a>
      </div>

      <div className="flex items-center gap-4">
        <button onClick={toggle} className="w-12 h-12 bg-white text-black rounded-xl">
          {isPlaying ? <Pause /> : <Play />}
        </button>

        <div className="flex-1 h-1.5 bg-zinc-700 rounded-full">
          <div className="h-full bg-violet-500" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <audio
        ref={audioRef}
        src={url}
        onTimeUpdate={update}
        onEnded={() => setIsPlaying(false)}
      />
    </div>
  );
}
/**
 * modelRunner.js
 * Handles ONNX Runtime Web model loading and inference.
 *
 * ONNX Runtime is loaded dynamically from CDN.
 * The Demucs ONNX model is fetched from HuggingFace and cached in the
 * browser's Cache API — no manual file placement needed.
 *
 * Model source priority:
 *   1. Browser cache (instant, avoids re-download)
 *   2. /public/models/demucs.onnx (local override)
 *   3. HuggingFace CDN (auto-download + cache)
 *
 * If model loading fails entirely → falls back to spectral demo mode.
 */

// HuggingFace hosted Demucs v4 (htdemucs) ONNX model
// This is the ~85MB quantized version suitable for browser use
const HF_MODEL_URL = 'https://huggingface.co/ggml-org/demucs-onnx/resolve/main/ggml-demucs-htdemucs-4s-f16.gguf';
// Fallback: lighter open-source ONNX demucs conversion
const HF_MODEL_URLS = [
  '/models/htdemucs_6s.onnx',  // local override (6s model)
  '/models/demucs.onnx',       // local override (4s model)
  // MrCitron htdemucs v4 — confirmed real ONNX export
  'https://huggingface.co/MrCitron/demucs-v4-onnx/resolve/main/htdemucs.onnx',
  // timcsy web-optimized (181MB) — fallback
  'https://huggingface.co/timcsy/demucs-web-onnx/resolve/main/htdemucs_embedded.onnx',
];

const MODEL_CACHE_NAME = 'stemsplitter-model-v2'; // bumped to bust any previously bad cached files
const CHUNK_SAMPLES = 8 * 44100;
const OVERLAP_SAMPLES = Math.floor(44100 * 0.5);

let sessionCache = null;
let ortCache = null;

/**
 * Load ONNX Runtime Web from CDN (cached after first load).
 */
async function getOrt() {
  if (ortCache) return ortCache;
  await new Promise((resolve, reject) => {
    if (window.ort) { resolve(); return; }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/dist/ort.min.js';
    script.onload = resolve;
    script.onerror = () => reject(new Error('Failed to load ONNX Runtime from CDN'));
    document.head.appendChild(script);
  });
  ortCache = window.ort;
  return ortCache;
}

function getExecutionProviders() {
  const providers = [];
  if (typeof navigator !== 'undefined' && navigator.gpu) providers.push('webgpu');
  try {
    const canvas = document.createElement('canvas');
    if (canvas.getContext('webgl2') || canvas.getContext('webgl')) providers.push('webgl');
  } catch { /* ignore */ }
  providers.push('cpu');
  return providers;
}

async function loadFromCache(url) {
  try {
    if ('caches' in window) {
      const cache = await caches.open(MODEL_CACHE_NAME);
      const response = await cache.match(url);
      if (response) {
        const buf = await response.arrayBuffer();
        // Validate: ONNX protobuf starts with 0x08 (field 1, varint) or similar valid protobuf byte
        const firstBytes = new Uint8Array(buf.slice(0, 4));
        // A valid ONNX model starts with field tag 0x08 (irVersion)
        if (firstBytes[0] !== 0x08 && firstBytes[0] !== 0x0a && firstBytes[0] !== 0x12) {
          console.warn('[ModelRunner] Cached model appears invalid, removing from cache');
          await cache.delete(url);
          return null;
        }
        console.log('[ModelRunner] Loaded valid model from browser cache');
        return buf;
      }
    }
  } catch (e) {
    console.warn('[ModelRunner] Cache read failed:', e.message);
  }
  return null;
}

async function saveToCache(url, arrayBuffer) {
  try {
    if ('caches' in window) {
      const cache = await caches.open(MODEL_CACHE_NAME);
      await cache.put(url, new Response(arrayBuffer.slice(0), {
        headers: { 'Content-Type': 'application/octet-stream' },
      }));
      console.log('[ModelRunner] Model saved to browser cache');
    }
  } catch (e) {
    console.warn('[ModelRunner] Cache write failed:', e.message);
  }
}

/**
 * Fetch a model URL with streaming progress callback.
 * Returns ArrayBuffer or throws.
 */
async function fetchWithProgress(url, onProgress, label) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} from ${url}`);

  const total = parseInt(response.headers.get('Content-Length') || '0', 10);
  const reader = response.body.getReader();
  const chunks = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    const percent = total ? Math.round((received / total) * 100) : -1;
    onProgress({
      phase: 'download',
      percent,
      message: `${label}: ${(received / 1024 / 1024).toFixed(1)}MB${total ? ` / ${(total / 1024 / 1024).toFixed(1)}MB` : ' downloaded...'}`,
    });
  }

  const result = new Uint8Array(chunks.reduce((s, c) => s + c.length, 0));
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result.buffer;
}

/**
 * Download model, trying each URL in order, with cache support.
 */
async function downloadModel(onProgress) {
  // Check cache for all known URLs
  for (const url of HF_MODEL_URLS) {
    const cached = await loadFromCache(url);
    if (cached) {
      onProgress({ phase: 'download', percent: 100, message: 'Model loaded from browser cache ✓' });
      return cached;
    }
  }

  // Try fetching each URL
  for (let i = 0; i < HF_MODEL_URLS.length; i++) {
    const url = HF_MODEL_URLS[i];
    const label = url.startsWith('/') ? 'Loading local model' : 'Downloading model from HuggingFace';
    try {
      onProgress({ phase: 'download', percent: 0, message: `${label}...` });
      const buffer = await fetchWithProgress(url, onProgress, label);
      await saveToCache(url, buffer);
      onProgress({ phase: 'download', percent: 100, message: 'Model ready ✓' });
      return buffer;
    } catch (e) {
      console.warn(`[ModelRunner] Failed to fetch ${url}:`, e.message);
      if (i === HF_MODEL_URLS.length - 1) throw new Error('Could not load model from any source');
    }
  }
}

/**
 * Load ONNX Runtime + create inference session.
 */
export async function loadModel(onProgress) {
  if (sessionCache) {
    onProgress({ phase: 'load', percent: 100, message: 'Model already loaded ✓' });
    return sessionCache;
  }

  const providers = getExecutionProviders();
  onProgress({ phase: 'load', percent: 5, message: 'Loading ONNX Runtime from CDN...' });

  const ort = await getOrt();
  ort.env.wasm.numThreads = Math.min(navigator.hardwareConcurrency || 4, 8);
  ort.env.wasm.simd = true;

  const modelBuffer = await downloadModel(onProgress);

  onProgress({ phase: 'load', percent: 95, message: 'Initializing inference session...' });

  const session = await ort.InferenceSession.create(modelBuffer, {
    executionProviders: providers,
    graphOptimizationLevel: 'all',
  });

  sessionCache = session;
  onProgress({ phase: 'load', percent: 100, message: `Model ready (${providers[0]}) ✓` });
  console.log('[ModelRunner] Session ready. Inputs:', session.inputNames, 'Outputs:', session.outputNames);
  return session;
}

/**
 * Run Demucs inference on a single stereo chunk.
 * Input:  [1, 2, N]
 * Output: [1, 4, 2, N]
 */
export async function runInference(session, left, right) {
  const ort = await getOrt();
  const N = left.length;
  const inputData = new Float32Array(2 * N);
  inputData.set(left, 0);
  inputData.set(right, N);

  const inputTensor = new ort.Tensor('float32', inputData, [1, 2, N]);
  const results = await session.run({ [session.inputNames[0]]: inputTensor });
  const output = results[session.outputNames[0]];
  const [, , , outSamples] = output.dims;
  const stemSize = outSamples * 2;
  const stemNames = ['vocals', 'drums', 'bass', 'other'];
  const separated = {};

  for (let s = 0; s < 4; s++) {
    const base = s * stemSize;
    separated[stemNames[s]] = {
      left: new Float32Array(output.data.slice(base, base + outSamples)),
      right: new Float32Array(output.data.slice(base + outSamples, base + stemSize)),
    };
  }
  return separated;
}

/**
 * Process full audio in overlapping chunks.
 */
export async function processAudioInChunks(session, left, right, onProgress) {
  const totalSamples = left.length;
  const stemNames = ['vocals', 'drums', 'bass', 'other'];

  const chunks = [];
  let start = 0;
  while (start < totalSamples) {
    const end = Math.min(start + CHUNK_SAMPLES, totalSamples);
    chunks.push({ start, end });
    if (end >= totalSamples) break;
    start = end - OVERLAP_SAMPLES;
  }

  const accumulated = Object.fromEntries(stemNames.map(n => [n, {
    left: new Float32Array(totalSamples),
    right: new Float32Array(totalSamples),
  }]));
  const weight = new Float32Array(totalSamples);

  for (let i = 0; i < chunks.length; i++) {
    const { start: s, end: e } = chunks[i];
    onProgress({
      phase: 'inference',
      percent: Math.round(((i + 1) / chunks.length) * 100),
      message: `Running AI model: chunk ${i + 1} of ${chunks.length}...`,
    });

    const result = await runInference(session, left.slice(s, e), right.slice(s, e));
    const chunkLen = e - s;

    for (let j = 0; j < chunkLen; j++) {
      const w = Math.min(1, Math.min(j, chunkLen - 1 - j, OVERLAP_SAMPLES) / OVERLAP_SAMPLES + 0.5);
      for (const name of stemNames) {
        accumulated[name].left[s + j] += result[name].left[j] * w;
        accumulated[name].right[s + j] += result[name].right[j] * w;
      }
      weight[s + j] += w;
    }
    await new Promise(r => setTimeout(r, 0));
  }

  for (const name of stemNames) {
    for (let i = 0; i < totalSamples; i++) {
      if (weight[i] > 0) {
        accumulated[name].left[i] /= weight[i];
        accumulated[name].right[i] /= weight[i];
      }
    }
  }

  return accumulated;
}

/**
 * Demo/fallback spectral separation applied to the original stereo mix.
 * Uses proper subtractive techniques so each stem sounds different.
 * ⚠️ NOT true AI — frequency band filtering only.
 */
export async function simulateSeparation(left, right, sampleRate, onProgress) {
  const { applyBandpassFilter, applyLowpassFilter, applyHighpassFilter, subtractChannels } = await import('@/utils/spectralProcessing.js');

  onProgress({ phase: 'inference', percent: 10, message: 'Demo: extracting bass (20–250 Hz)...' });
  const bassL = await applyLowpassFilter(left, sampleRate, 250);
  const bassR = await applyLowpassFilter(right, sampleRate, 250);

  onProgress({ phase: 'inference', percent: 30, message: 'Demo: extracting drums (transient layer)...' });
  // Drums = full mix highpassed above 200Hz then lowpassed below 12kHz, minus bass
  const drumsFullL = await applyBandpassFilter(left, sampleRate, 60, 12000);
  const drumsFullR = await applyBandpassFilter(right, sampleRate, 60, 12000);
  // Approximate drums by keeping the percussive mid-band and subtracting bass
  const drumsL = subtractChannels(drumsFullL, bassL, 0.6);
  const drumsR = subtractChannels(drumsFullR, bassR, 0.6);

  onProgress({ phase: 'inference', percent: 55, message: 'Demo: extracting vocals (center channel)...' });
  // Vocals: mid-range 250Hz–5kHz, center-channel extraction (L+R)/2 minus sides
  const vocalsL = await applyBandpassFilter(left, sampleRate, 250, 5000);
  const vocalsR = await applyBandpassFilter(right, sampleRate, 250, 5000);
  // Center extraction: average L+R to boost centered vocals
  const vocalsMono = new Float32Array(vocalsL.length);
  for (let i = 0; i < vocalsMono.length; i++) vocalsMono[i] = (vocalsL[i] + vocalsR[i]) * 0.6;

  onProgress({ phase: 'inference', percent: 80, message: 'Demo: extracting instruments (other)...' });
  // Other: subtract bass + vocal estimate from full mix, keep mid-highs
  const otherL = await applyBandpassFilter(left, sampleRate, 300, 8000);
  const otherR = await applyBandpassFilter(right, sampleRate, 300, 8000);
  // Subtract vocal content to reduce bleed
  const otherCleanL = subtractChannels(otherL, vocalsMono, 0.4);
  const otherCleanR = subtractChannels(otherR, vocalsMono, 0.4);

  onProgress({ phase: 'inference', percent: 100, message: 'Demo separation complete ✓' });

  return {
    vocals: { left: vocalsMono,   right: vocalsMono   },
    drums:  { left: drumsL,       right: drumsR       },
    bass:   { left: bassL,        right: bassR        },
    other:  { left: otherCleanL,  right: otherCleanR  },
  };
}
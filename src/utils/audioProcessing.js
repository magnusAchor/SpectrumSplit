/**
 * audioProcessing.js
 * Handles all Web Audio API operations:
 * - Decoding uploaded audio files
 * - Resampling to 44.1kHz stereo
 * - Chunking audio into segments
 * - Converting Float32Arrays back to WAV blobs
 */

const TARGET_SAMPLE_RATE = 44100;
const TARGET_CHANNELS = 2;

/**
 * Decode an audio File object into an AudioBuffer.
 */
export async function decodeAudioFile(file) {
  const arrayBuffer = await file.arrayBuffer();
  const audioContext = new (window.AudioContext || window.webkitAudioContext)({
    sampleRate: TARGET_SAMPLE_RATE,
  });
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  await audioContext.close();
  return audioBuffer;
}

/**
 * Convert an AudioBuffer to a normalized stereo Float32Array [left, right] interleaved.
 * Returns { left: Float32Array, right: Float32Array, sampleRate: number, duration: number }
 */
export function extractStereoChannels(audioBuffer) {
  const numChannels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;

  // Get left channel (always present)
  const left = audioBuffer.getChannelData(0).slice();

  // Get right channel or duplicate left if mono
  const right = numChannels > 1 ? audioBuffer.getChannelData(1).slice() : left.slice();

  return {
    left,
    right,
    sampleRate: audioBuffer.sampleRate,
    duration: audioBuffer.duration,
  };
}

/**
 * Chunk audio channels into overlapping segments for processing.
 * chunkSize: number of samples per chunk
 * overlap: number of samples to overlap between chunks (for seamless reconstruction)
 */
export function chunkAudio(left, right, chunkSize = 44100 * 8, overlap = 4410) {
  const chunks = [];
  const length = left.length;
  let start = 0;

  while (start < length) {
    const end = Math.min(start + chunkSize, length);
    chunks.push({
      left: left.slice(start, end),
      right: right.slice(start, end),
      start,
      end,
      isLast: end >= length,
    });
    start += chunkSize - overlap;
    if (start >= length) break;
  }

  return chunks;
}

/**
 * Convert separated Float32Array channels (left + right) to a WAV Blob.
 * Returns a Blob with audio/wav MIME type.
 */
export function channelsToWav(leftChannel, rightChannel, sampleRate = TARGET_SAMPLE_RATE) {
  const numChannels = 2;
  const numSamples = leftChannel.length;
  const bytesPerSample = 2; // 16-bit PCM
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');

  // fmt chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true);  // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true);

  // data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Write interleaved PCM samples
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    // Clamp to [-1, 1] and convert to 16-bit int
    const l = Math.max(-1, Math.min(1, leftChannel[i]));
    const r = Math.max(-1, Math.min(1, rightChannel[i]));
    view.setInt16(offset, l * 0x7fff, true);
    offset += 2;
    view.setInt16(offset, r * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view, offset, str) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/**
 * Normalize audio to prevent clipping.
 */
export function normalizeAudio(channel) {
  const max = channel.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
  if (max === 0 || max === 1) return channel;
  const scale = 0.98 / max;
  return channel.map(v => v * scale);
}

/**
 * Apply a simple gain to a channel.
 */
export function applyGain(channel, gain) {
  return channel.map(v => v * gain);
}

/**
 * Mix two channels together (for reconstruction).
 */
export function mixChannels(a, b) {
  const result = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) {
    result[i] = a[i] + b[i];
  }
  return result;
}

/**
 * Subtract channel b from a (for stem isolation).
 */
export function subtractChannels(a, b) {
  const result = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) {
    result[i] = a[i] - b[i];
  }
  return result;
}
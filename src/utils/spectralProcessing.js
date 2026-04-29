/**
 * spectralProcessing.js
 * FFT-based spectral filtering for sub-stem derivation.
 *
 * ⚠️ IMPORTANT DISCLAIMER:
 * The sub-stems derived here (kick, snare, cymbals, lead vocals, etc.)
 * are APPROXIMATIONS based on frequency band filtering.
 * They are NOT true AI-isolated stems. The Demucs model provides the
 * base 4-stem separation (vocals, drums, bass, other). Everything below
 * is rule-based spectral processing on top of those AI stems.
 */

const FFT_SIZE = 4096;

/**
 * Apply a bandpass filter to a Float32Array using OfflineAudioContext.
 * frequencyLow and frequencyHigh define the passband in Hz.
 */
export async function applyBandpassFilter(channel, sampleRate, frequencyLow, frequencyHigh) {
  if (channel.length === 0) return channel;

  const ctx = new OfflineAudioContext(1, channel.length, sampleRate);
  const buffer = ctx.createBuffer(1, channel.length, sampleRate);
  buffer.copyToChannel(channel, 0);

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const lowpass = ctx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = frequencyHigh;
  lowpass.Q.value = 0.707;

  const highpass = ctx.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = frequencyLow;
  highpass.Q.value = 0.707;

  source.connect(highpass);
  highpass.connect(lowpass);
  lowpass.connect(ctx.destination);
  source.start(0);

  const rendered = await ctx.startRendering();
  return rendered.getChannelData(0).slice();
}

/**
 * Apply a lowpass filter.
 */
export async function applyLowpassFilter(channel, sampleRate, frequency) {
  if (channel.length === 0) return channel;

  const ctx = new OfflineAudioContext(1, channel.length, sampleRate);
  const buffer = ctx.createBuffer(1, channel.length, sampleRate);
  buffer.copyToChannel(channel, 0);

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = frequency;
  filter.Q.value = 0.707;

  source.connect(filter);
  filter.connect(ctx.destination);
  source.start(0);

  const rendered = await ctx.startRendering();
  return rendered.getChannelData(0).slice();
}

/**
 * Apply a highpass filter.
 */
export async function applyHighpassFilter(channel, sampleRate, frequency) {
  if (channel.length === 0) return channel;

  const ctx = new OfflineAudioContext(1, channel.length, sampleRate);
  const buffer = ctx.createBuffer(1, channel.length, sampleRate);
  buffer.copyToChannel(channel, 0);

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = frequency;
  filter.Q.value = 0.707;

  source.connect(filter);
  filter.connect(ctx.destination);
  source.start(0);

  const rendered = await ctx.startRendering();
  return rendered.getChannelData(0).slice();
}

/**
 * Subtract one channel from another with a gain factor.
 * Useful for subtractive separation (e.g. remove bass from drums).
 */
export function subtractChannels(a, b, gain = 1.0) {
  const result = new Float32Array(a.length);
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) result[i] = a[i] - b[i] * gain;
  return result;
}

/**
 * Derive sub-stems from the 4 AI-isolated base stems.
 *
 * Base stems (from Demucs AI model):
 *   - vocals: human singing/speech
 *   - drums: full drum kit
 *   - bass: bass frequencies
 *   - other: everything else (guitars, keys, etc.)
 *
 * Derived sub-stems (rule-based approximations):
 *   From drums: kick (<100Hz), snare (100-500Hz), cymbals (>6kHz), toms (100-400Hz mid), other drums
 *   From vocals: lead vocals (bandpass 300-3kHz), backing vocals (residual)
 *   From other: guitar (200Hz-6kHz), piano (100Hz-4kHz), synth (high-freq), strings (200Hz-3kHz)
 *
 * @param {Object} baseStems - { vocals, drums, bass, other } each = { left, right }
 * @param {number} sampleRate
 * @param {Function} onProgress - callback(message)
 */
export async function deriveSubStems(baseStems, sampleRate, onProgress) {
  const { vocals, drums, bass, other } = baseStems;

  onProgress('Deriving kick drum (sub-bass frequencies)...');
  // Kick drum lives in the sub-bass range: 40-100 Hz
  const kickL = await applyBandpassFilter(drums.left, sampleRate, 40, 100);
  const kickR = await applyBandpassFilter(drums.right, sampleRate, 40, 100);

  onProgress('Deriving snare (mid frequencies)...');
  // Snare: 150-500 Hz with some high-freq snap
  const snareL = await applyBandpassFilter(drums.left, sampleRate, 150, 500);
  const snareR = await applyBandpassFilter(drums.right, sampleRate, 150, 500);

  onProgress('Deriving cymbals (high frequencies)...');
  // Cymbals: 6kHz and above (hi-hats, crashes, rides)
  const cymbalsL = await applyHighpassFilter(drums.left, sampleRate, 6000);
  const cymbalsR = await applyHighpassFilter(drums.right, sampleRate, 6000);

  onProgress('Deriving toms (mid-low frequencies)...');
  // Toms: 80-400 Hz (overlaps with kick/snare but different character)
  const tomsL = await applyBandpassFilter(drums.left, sampleRate, 80, 400);
  const tomsR = await applyBandpassFilter(drums.right, sampleRate, 80, 400);

  onProgress('Deriving other drums (mid-high frequencies)...');
  // Other drums: 500Hz-6kHz (rim shots, percussion, etc.)
  const otherDrumsL = await applyBandpassFilter(drums.left, sampleRate, 500, 6000);
  const otherDrumsR = await applyBandpassFilter(drums.right, sampleRate, 500, 6000);

  onProgress('Deriving lead vocals (core vocal frequencies)...');
  // Lead vocals: fundamental vocal range 300Hz-3kHz
  const leadVocalsL = await applyBandpassFilter(vocals.left, sampleRate, 300, 3000);
  const leadVocalsR = await applyBandpassFilter(vocals.right, sampleRate, 300, 3000);

  onProgress('Deriving backing vocals (residual vocal content)...');
  // Backing vocals: higher harmonics and breathiness 3kHz-8kHz
  const backingVocalsL = await applyBandpassFilter(vocals.left, sampleRate, 1500, 8000);
  const backingVocalsR = await applyBandpassFilter(vocals.right, sampleRate, 1500, 8000);

  onProgress('Deriving guitar (mid-range frequencies)...');
  // Guitar: 200Hz-6kHz (fundamental + harmonics)
  const guitarL = await applyBandpassFilter(other.left, sampleRate, 200, 6000);
  const guitarR = await applyBandpassFilter(other.right, sampleRate, 200, 6000);

  onProgress('Deriving piano (wide frequency range)...');
  // Piano: 100Hz-4kHz
  const pianoL = await applyBandpassFilter(other.left, sampleRate, 100, 4000);
  const pianoR = await applyBandpassFilter(other.right, sampleRate, 100, 4000);

  onProgress('Deriving synth (high-frequency content)...');
  // Synth: often has bright high-frequency content 2kHz-12kHz
  const synthL = await applyBandpassFilter(other.left, sampleRate, 2000, 12000);
  const synthR = await applyBandpassFilter(other.right, sampleRate, 2000, 12000);

  onProgress('Deriving strings (warm mid-range)...');
  // Strings: 200Hz-3kHz (violin, cello, viola range)
  const stringsL = await applyBandpassFilter(other.left, sampleRate, 200, 3000);
  const stringsR = await applyBandpassFilter(other.right, sampleRate, 200, 3000);

  return {
    // Base AI stems
    vocals: { left: vocals.left, right: vocals.right, isAI: true },
    drums: { left: drums.left, right: drums.right, isAI: true },
    bass: { left: bass.left, right: bass.right, isAI: true },
    other: { left: other.left, right: other.right, isAI: true },

    // Derived drum sub-stems (spectral approximations)
    kick: { left: kickL, right: kickR, isAI: false },
    snare: { left: snareL, right: snareR, isAI: false },
    cymbals: { left: cymbalsL, right: cymbalsR, isAI: false },
    toms: { left: tomsL, right: tomsR, isAI: false },
    otherDrums: { left: otherDrumsL, right: otherDrumsR, isAI: false },

    // Derived vocal sub-stems
    leadVocals: { left: leadVocalsL, right: leadVocalsR, isAI: false },
    backingVocals: { left: backingVocalsL, right: backingVocalsR, isAI: false },

    // Derived instrument sub-stems
    guitar: { left: guitarL, right: guitarR, isAI: false },
    piano: { left: pianoL, right: pianoR, isAI: false },
    synth: { left: synthL, right: synthR, isAI: false },
    strings: { left: stringsL, right: stringsR, isAI: false },
  };
}
export function splitOtherStem(left, right, sampleRate) {
  const length = left.length;

  const guitarL = new Float32Array(length);
  const guitarR = new Float32Array(length);

  const pianoL = new Float32Array(length);
  const pianoR = new Float32Array(length);

  const synthL = new Float32Array(length);
  const synthR = new Float32Array(length);

  for (let i = 0; i < length; i++) {
    const l = left[i];
    const r = right[i];

    const energy = Math.abs(l) + Math.abs(r);

    // 🎸 Guitar (mid energy spikes)
    if (energy > 0.02 && energy < 0.3) {
      guitarL[i] = l * 0.8;
      guitarR[i] = r * 0.8;
    }

    // 🎹 Piano (balanced energy)
    else if (energy >= 0.3 && energy < 0.6) {
      pianoL[i] = l * 0.7;
      pianoR[i] = r * 0.7;
    }

    // 🎛️ Synth (sustained / high energy)
    else if (energy >= 0.6) {
      synthL[i] = l * 0.9;
      synthR[i] = r * 0.9;
    }
  }

  return {
    guitar: { left: guitarL, right: guitarR },
    piano: { left: pianoL, right: pianoR },
    synth: { left: synthL, right: synthR }
  };
}
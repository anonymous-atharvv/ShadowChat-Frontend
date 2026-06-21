/**
 * Audio Processor Utility
 * Performs client-side anonymization of voice recordings using the Web Audio API.
 */

function bufferToWav(buffer) {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const bufferArr = new ArrayBuffer(length);
  const view = new DataView(bufferArr);
  const channels = [];
  let i;
  let sample;
  let pos = 0;
  let offset = 0;

  // Helper functions to write bytes
  const setUint16 = (data) => {
    view.setUint16(pos, data, true);
    pos += 2;
  };
  const setUint32 = (data) => {
    view.setUint32(pos, data, true);
    pos += 4;
  };

  // RIFF Header
  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8); // file length - 8
  setUint32(0x45564157); // "WAVE"
  setUint32(0x20746d66); // "fmt " chunk
  setUint32(16);         // chunk length
  setUint16(1);          // sample format (raw PCM)
  setUint16(numOfChan);
  setUint32(buffer.sampleRate);
  setUint32(buffer.sampleRate * 2 * numOfChan); // byte rate
  setUint16(numOfChan * 2); // block align
  setUint16(16);         // bits per sample
  setUint32(0x61746164); // "data" - chunk
  setUint32(length - pos - 4); // chunk length

  // Write interleaved PCM audio data
  for (i = 0; i < buffer.numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  while (pos < length - 4) {
    for (i = 0; i < numOfChan; i++) {
      sample = Math.max(-1, Math.min(1, channels[i][offset])); // clamp
      sample = (sample < 0 ? sample * 0x8000 : sample * 0x7FFF); // scale to 16-bit
      view.setInt16(pos, sample, true);
      pos += 2;
    }
    offset++;
  }

  return new Blob([bufferArr], { type: 'audio/wav' });
}

function makeDistortionCurve(amount = 40) {
  const n_samples = 44100;
  const curve = new Float32Array(n_samples);
  const deg = Math.PI / 180;
  for (let i = 0; i < n_samples; ++i) {
    const x = (i * 2) / n_samples - 1;
    curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
  }
  return curve;
}

/**
 * Applies a voice mask to an input audio blob and returns the processed WAV blob.
 * @param {Blob} inputBlob - Raw recorded audio blob
 * @param {string} filterType - 'original' | 'deep' | 'helium' | 'scrambler'
 * @returns {Promise<Blob>} - Processed WAV Blob
 */
export async function applyVoiceMask(inputBlob, filterType) {
  if (filterType === 'original') {
    // Just re-encode raw to WAV
    const arrayBuffer = await inputBlob.arrayBuffer();
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const wavBlob = bufferToWav(audioBuffer);
    await audioCtx.close();
    return wavBlob;
  }

  const arrayBuffer = await inputBlob.arrayBuffer();
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const rawBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  await audioCtx.close();

  // Determine offline configuration
  let sampleRate = rawBuffer.sampleRate;
  let playbackRate = 1.0;
  let duration = rawBuffer.duration;

  if (filterType === 'deep') {
    playbackRate = 0.78;
    duration = rawBuffer.duration / 0.78;
  } else if (filterType === 'helium') {
    playbackRate = 1.35;
    duration = rawBuffer.duration / 1.35;
  }

  const length = Math.ceil(sampleRate * duration);
  const offlineCtx = new OfflineAudioContext(
    rawBuffer.numberOfChannels,
    length,
    sampleRate
  );

  // Source node
  const source = offlineCtx.createBufferSource();
  source.buffer = rawBuffer;
  source.playbackRate.value = playbackRate;

  let lastNode = source;

  if (filterType === 'deep') {
    // Add lowpass filter to remove crisp highs
    const lp = offlineCtx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1100;
    lastNode.connect(lp);
    lastNode = lp;
  } else if (filterType === 'helium') {
    // Add highpass filter to strip low frequencies
    const hp = offlineCtx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 350;
    lastNode.connect(hp);
    lastNode = hp;
  } else if (filterType === 'scrambler') {
    // Cyber scrambler: Bandpass filter + Waveshaper Distortion
    const bp = offlineCtx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 900;
    bp.Q.value = 1.5;

    const distortion = offlineCtx.createWaveShaper();
    distortion.curve = makeDistortionCurve(60);
    distortion.oversample = '4x';

    lastNode.connect(bp);
    bp.connect(distortion);
    lastNode = distortion;
  }

  // Connect to output
  lastNode.connect(offlineCtx.destination);
  source.start(0);

  const renderedBuffer = await offlineCtx.startRendering();
  return bufferToWav(renderedBuffer);
}

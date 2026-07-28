// WAV-format helpers for the BQST A/B demo, moved verbatim (maths-wise) out
// of `src/scripts/default/bqst-demo.js` (classic), which is where they
// originated — `buildSilentWavBuffer`/`buildSilentWavUrl` (:161-184) and
// `extractWavWaveform` (:266-340).

/** A single min/max peak pair for one waveform column. */
export interface WavPeak {
  min: number;
  max: number;
}

export interface WavWaveform {
  peaks: WavPeak[];
  duration: number;
}

/**
 * Build a silent, mono, 16-bit PCM WAV as raw bytes: `seconds` of digital
 * silence at 22.05kHz. Used as the iOS unlock primer/keepalive — see
 * `SilentWavUnlocker` in bqst-engine.ts. Pure and DOM-free (the caller wraps
 * the result in a Blob + object URL, which needs the DOM).
 */
export function buildSilentWavBuffer(seconds: number): ArrayBuffer {
  const sampleRate = 22050;
  const samples = Math.floor(sampleRate * seconds);
  const dataSize = samples * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeAscii = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(36, 'data');
  view.setUint32(40, dataSize, true);
  return buffer;
}

/** DOM wrapper: `buildSilentWavBuffer` as a playable object URL. Needs a
 *  browser (Blob + URL.createObjectURL); not covered by unit tests. */
export function buildSilentWavUrl(seconds = 5): string {
  return URL.createObjectURL(new Blob([buildSilentWavBuffer(seconds)], { type: 'audio/wav' }));
}

interface WavFormat {
  audioFormat: number;
  channels: number;
  sampleRate: number;
  blockAlign: number;
  bitsPerSample: number;
}

/**
 * Raw-RIFF pre-decode waveform: walks WAV chunks by hand (tolerating leading
 * chunks like `JUNK`/`LIST` before `fmt `/`data`, same as real-world files
 * exported by DAWs) to produce a peaks array BEFORE `decodeAudioData` has
 * finished — lets the waveform paint immediately on fetch instead of staying
 * blank until decode completes.
 */
export function extractWavWaveform(arrayBuffer: ArrayBuffer, targetPoints = 900): WavWaveform | null {
  try {
    const view = new DataView(arrayBuffer);
    const readId = (offset: number) =>
      String.fromCharCode(
        view.getUint8(offset),
        view.getUint8(offset + 1),
        view.getUint8(offset + 2),
        view.getUint8(offset + 3),
      );
    if (readId(0) !== 'RIFF' || readId(8) !== 'WAVE') return null;

    let format: WavFormat | null = null;
    let dataOffset = 0;
    let dataSize = 0;
    for (let offset = 12; offset + 8 <= view.byteLength; ) {
      const id = readId(offset);
      const size = view.getUint32(offset + 4, true);
      const chunkData = offset + 8;
      if (id === 'fmt ') {
        format = {
          audioFormat: view.getUint16(chunkData, true),
          channels: view.getUint16(chunkData + 2, true),
          sampleRate: view.getUint32(chunkData + 4, true),
          blockAlign: view.getUint16(chunkData + 12, true),
          bitsPerSample: view.getUint16(chunkData + 14, true),
        };
      } else if (id === 'data') {
        dataOffset = chunkData;
        dataSize = size;
        break;
      }
      offset = chunkData + size + (size % 2);
    }
    if (!format || !dataOffset || !dataSize || !format.channels || !format.blockAlign) return null;

    const bytesPerSample = format.bitsPerSample / 8;
    const frames = Math.floor(dataSize / format.blockAlign);
    const points = Math.max(1, Math.min(targetPoints, frames));
    const samplesPerPoint = Math.max(1, Math.floor(frames / points));
    const peaks: WavPeak[] = [];

    const readSample = (offset: number) => {
      if (format!.audioFormat === 3 && format!.bitsPerSample === 32) return view.getFloat32(offset, true);
      if (format!.bitsPerSample === 16) return view.getInt16(offset, true) / 32768;
      if (format!.bitsPerSample === 24) {
        const value = view.getUint8(offset) | (view.getUint8(offset + 1) << 8) | (view.getUint8(offset + 2) << 16);
        return ((value & 0x800000) !== 0 ? value | 0xff000000 : value) / 8388608;
      }
      if (format!.bitsPerSample === 32) return view.getInt32(offset, true) / 2147483648;
      return 0;
    };

    for (let point = 0; point < points; point++) {
      const startFrame = point * samplesPerPoint;
      const endFrame = point === points - 1 ? frames : Math.min(frames, startFrame + samplesPerPoint);
      let min = 1;
      let max = -1;
      for (let frame = startFrame; frame < endFrame; frame++) {
        const frameOffset = dataOffset + frame * format.blockAlign;
        let mono = 0;
        for (let channel = 0; channel < format.channels; channel++) {
          mono += readSample(frameOffset + channel * bytesPerSample);
        }
        mono /= format.channels;
        if (mono < min) min = mono;
        if (mono > max) max = mono;
      }
      peaks.push({ min, max });
    }

    return { peaks, duration: frames / format.sampleRate };
  } catch {
    return null;
  }
}

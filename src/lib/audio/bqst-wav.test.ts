import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { buildSilentWavBuffer, extractWavWaveform } from './bqst-wav';

const here = dirname(fileURLToPath(import.meta.url));
// Real WAV shipped for the BQST article demo — deliberately has a leading
// JUNK chunk before `fmt `/`data` (a real DAW export artifact), which is
// exactly the "tolerate non-fmt-first chunks" case extractWavWaveform's
// hand-rolled chunk walk exists for.
const fixturePath = resolve(here, '../../../public/assets/audio/bqst/drums-clean.wav');

function toArrayBuffer(buf: Buffer): ArrayBuffer {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

describe('buildSilentWavBuffer', () => {
  test('produces a well-formed mono 16-bit 22.05kHz RIFF/WAVE header', () => {
    const buf = buildSilentWavBuffer(0.1);
    const view = new DataView(buf);
    const id = (o: number) => String.fromCharCode(view.getUint8(o), view.getUint8(o + 1), view.getUint8(o + 2), view.getUint8(o + 3));
    expect(id(0)).toBe('RIFF');
    expect(id(8)).toBe('WAVE');
    expect(id(12)).toBe('fmt ');
    expect(view.getUint16(20, true)).toBe(1); // PCM
    expect(view.getUint16(22, true)).toBe(1); // mono
    expect(view.getUint32(24, true)).toBe(22050); // sample rate
    expect(view.getUint16(34, true)).toBe(16); // bits per sample
    expect(id(36)).toBe('data');
    const samples = Math.floor(22050 * 0.1);
    expect(view.getUint32(40, true)).toBe(samples * 2);
    expect(buf.byteLength).toBe(44 + samples * 2);
  });

  test('every sample is digital silence', () => {
    const buf = buildSilentWavBuffer(0.05);
    const view = new DataView(buf);
    const dataSize = view.getUint32(40, true);
    for (let o = 44; o < 44 + dataSize; o += 2) {
      expect(view.getInt16(o, true)).toBe(0);
    }
  });

  test('scales linearly with duration', () => {
    const short = buildSilentWavBuffer(1);
    const long = buildSilentWavBuffer(2);
    expect(long.byteLength).toBe(44 + (short.byteLength - 44) * 2);
  });
});

describe('extractWavWaveform on a real fixture', () => {
  const raw = readFileSync(fixturePath);
  const arrayBuffer = toArrayBuffer(raw);

  test('parses a real WAV with a leading JUNK chunk before fmt/data', () => {
    const waveform = extractWavWaveform(arrayBuffer, 64);
    expect(waveform).not.toBeNull();
    expect(waveform!.peaks.length).toBe(64);
    // Duration should be a plausible, finite, positive value for a short
    // drum loop, and every peak must be within [-1, 1] with min <= max.
    expect(waveform!.duration).toBeGreaterThan(0);
    expect(waveform!.duration).toBeLessThan(60);
    for (const peak of waveform!.peaks) {
      expect(peak.min).toBeGreaterThanOrEqual(-1);
      expect(peak.max).toBeLessThanOrEqual(1);
      expect(peak.min).toBeLessThanOrEqual(peak.max);
    }
    // Real audio (not silence): at least one point should have visible
    // amplitude, or this "parsed" a stream of zeros and the test would be
    // worthless as a regression guard.
    expect(waveform!.peaks.some((p) => p.max - p.min > 0.01)).toBe(true);
  });

  test('targetPoints is respected up to the frame count', () => {
    const coarse = extractWavWaveform(arrayBuffer, 8);
    expect(coarse!.peaks.length).toBe(8);
    const fine = extractWavWaveform(arrayBuffer, 4000);
    // targetPoints is clamped to the frame count, but this file has far more
    // than 4000 frames, so it should get exactly what it asked for.
    expect(fine!.peaks.length).toBe(4000);
  });

  test('malformed input (not RIFF/WAVE) returns null', () => {
    const junk = new ArrayBuffer(16);
    expect(extractWavWaveform(junk)).toBeNull();
  });

  test('a buffer with no data chunk returns null', () => {
    // RIFF/WAVE/fmt with no data chunk following.
    const buf = new ArrayBuffer(12 + 8 + 16);
    const view = new DataView(buf);
    const writeAscii = (o: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
    writeAscii(0, 'RIFF');
    view.setUint32(4, buf.byteLength - 8, true);
    writeAscii(8, 'WAVE');
    writeAscii(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, 22050, true);
    view.setUint32(28, 44100, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    expect(extractWavWaveform(buf)).toBeNull();
  });
});

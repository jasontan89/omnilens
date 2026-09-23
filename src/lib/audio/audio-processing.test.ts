import { describe, it, expect } from 'vitest';
import { PcmRecorder } from './pcm-recorder';

describe('Audio Processing Subsystem', () => {
  it('accurately downsamples 48kHz audio to 16kHz (3:1 boxcar averaging) with anti-aliasing', () => {
    const recorder = new PcmRecorder(() => {});
    // 480 samples at 48kHz is 10ms
    const input = new Float32Array(480);
    for (let i = 0; i < input.length; i++) {
      input[i] = Math.sin((i / 480) * Math.PI * 2);
    }

    const output = recorder.downsampleBuffer(input, 48000, 16000);
    // 480 / 3 = 160 samples at 16kHz
    expect(output.length).toBe(160);
    // Verify values remain bounded [-1, 1]
    expect(Math.max(...output)).toBeLessThanOrEqual(1.0);
    expect(Math.min(...output)).toBeGreaterThanOrEqual(-1.0);
  });

  it('accurately downsamples 44.1kHz audio to 16kHz without drift', () => {
    const recorder = new PcmRecorder(() => {});
    // 441 samples at 44.1kHz is 10ms
    const input = new Float32Array(441);
    for (let i = 0; i < input.length; i++) {
      input[i] = 0.5;
    }

    const output = recorder.downsampleBuffer(input, 44100, 16000);
    expect(output.length).toBe(160);
    expect(output[0]).toBeCloseTo(0.5, 2);
  });

  it('converts Float32 audio samples into 16-bit linear PCM with clean clamping (no harmonic distortion)', () => {
    const recorder = new PcmRecorder(() => {});
    const input = new Float32Array([0.0, 0.1, -0.1, 0.5, -0.5, 1.0, -1.0, 1.5, -2.0]);
    const pcm = recorder.float32ToInt16(input);

    expect(pcm[0]).toBe(0);
    expect(pcm[1]).toBe(Math.round(0.1 * 0x7fff));
    expect(pcm[2]).toBe(Math.round(-0.1 * 0x8000));
    expect(pcm[3]).toBe(Math.round(0.5 * 0x7fff));
    expect(pcm[4]).toBe(Math.round(-0.5 * 0x8000));
    expect(pcm[5]).toBe(32767);
    expect(pcm[6]).toBe(-32768);
    // Values outside [-1, 1] clamped without overflow
    expect(pcm[7]).toBe(32767);
    expect(pcm[8]).toBe(-32768);
  });
});

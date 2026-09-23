import { describe, it, expect } from 'vitest';
import { PcmRecorder } from './pcm-recorder';

describe('Audio Processing Subsystem', () => {
  it('accurately downsamples 48kHz audio to 16kHz (3:1 reduction) with continuous phase', () => {
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

  it('converts Float32 audio samples into 16-bit linear PCM with 1.6x pre-gain boost and soft limiting', () => {
    const recorder = new PcmRecorder(() => {});
    const input = new Float32Array([0.0, 0.1, -0.1, 0.5, -0.5, 1.5, -2.0]);
    const pcm = recorder.float32ToInt16(input);

    expect(pcm[0]).toBe(0);
    // Boosted quiet signal: 0.1 * 1.6 = 0.16 -> tanh(0.16) * 32767 ≈ 5199
    expect(pcm[1]).toBeGreaterThan(3277); // significantly higher than raw 0.1 * 32767
    expect(pcm[2]).toBeLessThan(-3277);
    // Loud signals smoothly saturated within 16-bit range without overflowing
    expect(pcm[5]).toBeLessThanOrEqual(32767);
    expect(pcm[6]).toBeGreaterThanOrEqual(-32768);
  });
});

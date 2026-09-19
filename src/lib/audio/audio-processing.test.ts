import { describe, it, expect } from 'vitest';

describe('Audio Processing Subsystem', () => {
  // Pure downsampling algorithm test
  function downsampleBuffer(buffer: Float32Array, inputRate: number, outputRate: number): Float32Array {
    if (outputRate === inputRate) return buffer;
    const sampleRateRatio = inputRate / outputRate;
    const newLength = Math.round(buffer.length / sampleRateRatio);
    const result = new Float32Array(newLength);
    let offsetResult = 0;
    let offsetBuffer = 0;

    while (offsetResult < result.length) {
      const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
      let accum = 0;
      let count = 0;
      for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
        accum += buffer[i];
        count++;
      }
      result[offsetResult] = count > 0 ? accum / count : 0;
      offsetResult++;
      offsetBuffer = nextOffsetBuffer;
    }
    return result;
  }

  // Float32 to Int16 conversion test
  function float32ToInt16(buffer: Float32Array): Int16Array {
    const l = buffer.length;
    const int16Array = new Int16Array(l);
    for (let i = 0; i < l; i++) {
      const s = Math.max(-1, Math.min(1, buffer[i]));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return int16Array;
  }

  it('accurately downsamples 48kHz audio to 16kHz (3:1 reduction)', () => {
    // 480 samples at 48kHz is 10ms
    const input = new Float32Array(480);
    for (let i = 0; i < input.length; i++) {
      input[i] = Math.sin((i / 480) * Math.PI * 2);
    }

    const output = downsampleBuffer(input, 48000, 16000);
    // 480 / 3 = 160 samples at 16kHz
    expect(output.length).toBe(160);
    // Verify values remain bounded [-1, 1]
    expect(Math.max(...output)).toBeLessThanOrEqual(1.0);
    expect(Math.min(...output)).toBeGreaterThanOrEqual(-1.0);
  });

  it('accurately downsamples 44.1kHz audio to 16kHz', () => {
    // 441 samples at 44.1kHz is 10ms
    const input = new Float32Array(441);
    for (let i = 0; i < input.length; i++) {
      input[i] = 0.5;
    }

    const output = downsampleBuffer(input, 44100, 16000);
    expect(output.length).toBe(160);
    expect(output[0]).toBeCloseTo(0.5, 2);
  });

  it('converts Float32 audio samples into 16-bit linear PCM with proper clipping', () => {
    const input = new Float32Array([0.0, 1.0, -1.0, 0.5, -0.5, 1.5, -2.0]);
    const pcm = float32ToInt16(input);

    expect(pcm[0]).toBe(0);
    expect(pcm[1]).toBe(32767); // Clamped positive max
    expect(pcm[2]).toBe(-32768); // Clamped negative min
    expect(pcm[3]).toBe(Math.floor(0.5 * 32767));
    expect(pcm[4]).toBe(Math.floor(-0.5 * 32768));
    expect(pcm[5]).toBe(32767); // Exceeded +1 clamped
    expect(pcm[6]).toBe(-32768); // Exceeded -1 clamped
  });
});

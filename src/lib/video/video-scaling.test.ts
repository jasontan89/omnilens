import { describe, it, expect } from 'vitest';

describe('Video Frame Token Optimization', () => {
  function calculateTargetDimensions(width: number, height: number, maxWidth = 1024) {
    if (width <= maxWidth) {
      return { width, height };
    }
    const scale = maxWidth / width;
    return {
      width: maxWidth,
      height: Math.round(height * scale),
    };
  }

  it('preserves aspect ratio when downscaling 1080p video (1920x1080) to max width 1024', () => {
    const original = { width: 1920, height: 1080 };
    const scaled = calculateTargetDimensions(original.width, original.height, 1024);

    expect(scaled.width).toBe(1024);
    expect(scaled.height).toBe(576); // 16:9 ratio preserved
    expect(scaled.width / scaled.height).toBeCloseTo(1920 / 1080, 2);
  });

  it('preserves aspect ratio when downscaling 1440p (2560x1440) to max width 1024', () => {
    const original = { width: 2560, height: 1440 };
    const scaled = calculateTargetDimensions(original.width, original.height, 1024);

    expect(scaled.width).toBe(1024);
    expect(scaled.height).toBe(576);
  });

  it('does not upscale frames that are already within maxWidth (e.g. 800x600)', () => {
    const original = { width: 800, height: 600 };
    const scaled = calculateTargetDimensions(original.width, original.height, 1024);

    expect(scaled.width).toBe(800);
    expect(scaled.height).toBe(600);
  });
});

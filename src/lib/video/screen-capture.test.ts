import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isMobileDevice, isScreenShareSupported, ScreenCapture } from './screen-capture';

describe('ScreenCapture Mobile & Device Detection', () => {
  const originalUserAgent = navigator.userAgent;

  afterEach(() => {
    Object.defineProperty(navigator, 'userAgent', {
      value: originalUserAgent,
      configurable: true,
    });
    vi.restoreAllMocks();
  });

  it('correctly detects desktop user agent as non-mobile', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      configurable: true,
    });

    expect(isMobileDevice()).toBe(false);
  });

  it('correctly detects iPhone user agent as mobile', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      configurable: true,
    });

    expect(isMobileDevice()).toBe(true);
  });

  it('correctly detects Android user agent as mobile', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      configurable: true,
    });

    expect(isMobileDevice()).toBe(true);
  });

  it('disallows screen share when on mobile device', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148 Safari/604.1',
      configurable: true,
    });

    // Even if getDisplayMedia is mocked, isScreenShareSupported should be false on mobile
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getDisplayMedia: vi.fn() },
      configurable: true,
    });

    expect(isScreenShareSupported()).toBe(false);
  });

  it('allows screen share when on desktop browser with getDisplayMedia', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      configurable: true,
    });

    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getDisplayMedia: vi.fn() },
      configurable: true,
    });

    expect(isScreenShareSupported()).toBe(true);
  });
});

describe('ScreenCapture Camera Direction & Flipping', () => {
  beforeEach(() => {
    // Mock navigator.mediaDevices.getUserMedia
    const fakeStream = {
      getTracks: () => [
        {
          stop: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        },
      ],
    } as unknown as MediaStream;

    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn().mockResolvedValue(fakeStream),
        enumerateDevices: vi.fn().mockResolvedValue([
          { kind: 'videoinput', deviceId: 'cam-front', label: 'Front Camera' },
          { kind: 'videoinput', deviceId: 'cam-back', label: 'Back Camera' },
        ]),
      },
      configurable: true,
    });
  });

  it('initializes and defaults camera facing mode', () => {
    const onFrame = vi.fn();
    const capture = new ScreenCapture(onFrame);

    expect(capture.getFacingMode()).toBeDefined();
  });

  it('starts camera with specific facing mode (environment vs user)', async () => {
    const onFrame = vi.fn();
    const capture = new ScreenCapture(onFrame);

    const stream = await capture.startCamera(2, 'environment');
    expect(stream).toBeDefined();
    expect(capture.getFacingMode()).toBe('environment');
    expect(capture.getCurrentSource()).toBe('camera');

    capture.stop();
  });

  it('flips camera direction from user to environment and vice versa', async () => {
    const onFrame = vi.fn();
    const capture = new ScreenCapture(onFrame);

    await capture.startCamera(1, 'user');
    expect(capture.getFacingMode()).toBe('user');

    const flipped1 = await capture.flipCamera(1);
    expect(flipped1.facingMode).toBe('environment');
    expect(capture.getFacingMode()).toBe('environment');

    const flipped2 = await capture.flipCamera(1);
    expect(flipped2.facingMode).toBe('user');
    expect(capture.getFacingMode()).toBe('user');

    capture.stop();
  });

  it('lists available video input devices', async () => {
    const onFrame = vi.fn();
    const capture = new ScreenCapture(onFrame);

    const devices = await capture.getAvailableCameras();
    expect(devices.length).toBe(2);
    expect(devices[0].deviceId).toBe('cam-front');
    expect(devices[1].deviceId).toBe('cam-back');
  });
});

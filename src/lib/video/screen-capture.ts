export type CaptureSource = 'screen' | 'camera' | null;

export class ScreenCapture {
  private mediaStream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private canvasElement: HTMLCanvasElement | null = null;
  private intervalId: number | null = null;
  private onFrameCallback: ((base64Jpeg: string) => void) | null = null;
  private onEndedCallback: (() => void) | null = null;
  private currentSource: CaptureSource = null;
  private maxWidth: number = 1024;
  private jpegQuality: number = 0.75;

  constructor(
    onFrame: (base64Jpeg: string) => void,
    onEnded?: () => void
  ) {
    this.onFrameCallback = onFrame;
    this.onEndedCallback = onEnded || null;

    // Create offscreen video and canvas elements
    this.videoElement = document.createElement('video');
    this.videoElement.autoplay = true;
    this.videoElement.muted = true;
    this.videoElement.playsInline = true;

    this.canvasElement = document.createElement('canvas');
  }

  public async startScreen(fps: number = 1): Promise<MediaStream> {
    this.stop();

    try {
      this.mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'monitor',
          frameRate: { max: 5 },
        },
        audio: false,
      });

      this.currentSource = 'screen';
      this.setupStream(fps);
      return this.mediaStream;
    } catch (err) {
      this.stop();
      throw err;
    }
  }

  public async startCamera(fps: number = 1): Promise<MediaStream> {
    this.stop();

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
        audio: false,
      });

      this.currentSource = 'camera';
      this.setupStream(fps);
      return this.mediaStream;
    } catch (err) {
      this.stop();
      throw err;
    }
  }

  private setupStream(fps: number): void {
    if (!this.mediaStream || !this.videoElement) return;

    this.videoElement.srcObject = this.mediaStream;
    this.videoElement.play().catch(() => {});

    // Listen for the native "Stop Sharing" button in the browser UI
    const videoTrack = this.mediaStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.onended = () => {
        this.stop();
        if (this.onEndedCallback) {
          this.onEndedCallback();
        }
      };
    }

    const intervalMs = Math.max(200, Math.floor(1000 / Math.max(1, fps)));
    this.intervalId = window.setInterval(() => {
      this.captureFrame();
    }, intervalMs);
  }

  public captureFrame(): string | null {
    if (
      !this.videoElement ||
      !this.canvasElement ||
      !this.mediaStream ||
      this.videoElement.readyState < 2
    ) {
      return null;
    }

    const video = this.videoElement;
    const canvas = this.canvasElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    let width = video.videoWidth;
    let height = video.videoHeight;

    if (width === 0 || height === 0) return null;

    // Scale down proportionally to maxWidth (e.g. 1024px) for token optimization
    if (width > this.maxWidth) {
      const scale = this.maxWidth / width;
      width = this.maxWidth;
      height = Math.round(height * scale);
    }

    canvas.width = width;
    canvas.height = height;

    ctx.drawImage(video, 0, 0, width, height);

    // Export as JPEG
    const dataUrl = canvas.toDataURL('image/jpeg', this.jpegQuality);
    const base64Jpeg = dataUrl.split(',')[1];

    if (this.onFrameCallback && base64Jpeg) {
      this.onFrameCallback(base64Jpeg);
    }

    return base64Jpeg;
  }

  public stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }

    this.currentSource = null;
  }

  public getStream(): MediaStream | null {
    return this.mediaStream;
  }

  public getCurrentSource(): CaptureSource {
    return this.currentSource;
  }

  public setFps(fps: number): void {
    if (this.intervalId !== null && this.mediaStream) {
      clearInterval(this.intervalId);
      const intervalMs = Math.max(200, Math.floor(1000 / Math.max(1, fps)));
      this.intervalId = window.setInterval(() => {
        this.captureFrame();
      }, intervalMs);
    }
  }
}

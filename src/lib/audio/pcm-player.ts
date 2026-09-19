export class PcmPlayer {
  private audioContext: AudioContext | null = null;
  private analyserNode: AnalyserNode | null = null;
  private nextPlayTime: number = 0;
  private sampleRate: number = 24000; // Gemini Live API output sample rate is 24kHz
  private activeSources: AudioBufferSourceNode[] = [];
  private isMuted: boolean = false;

  constructor() {
    // Initialized on first user interaction or audio arrival
  }

  private initContext(): void {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)({
        sampleRate: this.sampleRate,
      });
      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = 256;
      this.analyserNode.connect(this.audioContext.destination);
      this.nextPlayTime = this.audioContext.currentTime;
    }
  }

  public async resume(): Promise<void> {
    this.initContext();
    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  public playChunk(base64Pcm: string): void {
    if (this.isMuted) return;
    this.initContext();
    if (!this.audioContext || !this.analyserNode) return;

    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    try {
      const pcm16Data = this.base64ToInt16(base64Pcm);
      const float32Data = new Float32Array(pcm16Data.length);
      for (let i = 0; i < pcm16Data.length; i++) {
        float32Data[i] = pcm16Data[i] / 32768.0;
      }

      const audioBuffer = this.audioContext.createBuffer(1, float32Data.length, this.sampleRate);
      audioBuffer.getChannelData(0).set(float32Data);

      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.analyserNode);

      const now = this.audioContext.currentTime;
      // Add a tiny buffer lead (10ms) if the playhead fell behind
      if (this.nextPlayTime < now) {
        this.nextPlayTime = now + 0.01;
      }

      source.start(this.nextPlayTime);
      this.nextPlayTime += audioBuffer.duration;

      this.activeSources.push(source);
      source.onended = () => {
        const index = this.activeSources.indexOf(source);
        if (index > -1) {
          this.activeSources.splice(index, 1);
        }
      };
    } catch (err) {
      console.error('Error playing audio chunk:', err);
    }
  }

  /**
   * Immediately silences audio playback and clears scheduled buffers on interruption
   */
  public interrupt(): void {
    for (const source of this.activeSources) {
      try {
        source.stop();
        source.disconnect();
      } catch {
        // Source may already have finished
      }
    }
    this.activeSources = [];

    if (this.audioContext) {
      this.nextPlayTime = this.audioContext.currentTime;
    }
  }

  public getAnalyser(): AnalyserNode | null {
    return this.analyserNode;
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (muted) {
      this.interrupt();
    }
  }

  public destroy(): void {
    this.interrupt();
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
      this.analyserNode = null;
    }
  }

  private base64ToInt16(base64: string): Int16Array {
    const binary = window.atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Int16Array(bytes.buffer);
  }
}

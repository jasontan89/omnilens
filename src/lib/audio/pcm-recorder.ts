export class PcmRecorder {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private silenceGainNode: GainNode | null = null;
  private isRecording: boolean = false;
  private onDataCallback: ((base64Pcm: string) => void) | null = null;
  private targetSampleRate: number = 16000;

  // Fractional phase tracking for continuous linear interpolation (non-48kHz fallback)
  private resamplePhase: number = 0;
  private lastInputSample: number = 0;

  constructor(
    onData: (base64Pcm: string) => void,
    _onSpeechPause?: () => void
  ) {
    this.onDataCallback = onData;
  }

  /**
   * Optional speech pause listener.
   * Kept for backward compatibility; Gemini server-side VAD (automaticActivityDetection)
   * handles conversational boundaries naturally without premature client cutoffs.
   */
  public setOnSpeechPause(_cb: (() => void) | null): void {}

  public async start(): Promise<void> {
    if (this.isRecording) return;

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Initialize AudioContext at the hardware's native sample rate (typically 48kHz or 44.1kHz).
      // Hardware-rate context avoids browser-level resampling artifacts and buffer drops.
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioContext = new AudioContextClass();

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = 256;
      this.sourceNode.connect(this.analyserNode);

      // Reset resampling state
      this.resamplePhase = 0;
      this.lastInputSample = 0;

      // 2048 sample buffer at native hardware rate (~42.7ms at 48kHz).
      // Audio is streamed immediately to the WebSocket callback on every process cycle
      // with zero queue delay, eliminating tail latency and missed word endings.
      const bufferSize = 2048;
      this.processorNode = this.audioContext.createScriptProcessor(bufferSize, 1, 1);

      const actualSampleRate = this.audioContext.sampleRate;

      this.processorNode.onaudioprocess = (e) => {
        if (!this.isRecording) return;
        const inputData = e.inputBuffer.getChannelData(0);

        // 1. Resample to target 16kHz
        const downsampled = this.downsampleBuffer(
          inputData,
          actualSampleRate,
          this.targetSampleRate
        );

        if (downsampled.length === 0) return;

        // 2. Linear Float32 to Int16 PCM conversion (no harmonic distortion)
        const pcm16Data = this.float32ToInt16(downsampled);

        // 3. Dispatch base64 chunk immediately (zero buffering delay)
        const base64 = this.arrayBufferToBase64(pcm16Data.buffer);
        if (this.onDataCallback) {
          this.onDataCallback(base64);
        }
      };

      // Route through a GainNode with gain=0 (silence) so onaudioprocess fires in Chrome
      // while preventing live microphone audio from leaking into speakers (eliminating acoustic feedback)
      this.silenceGainNode = this.audioContext.createGain();
      this.silenceGainNode.gain.value = 0;

      this.sourceNode.connect(this.processorNode);
      this.processorNode.connect(this.silenceGainNode);
      this.silenceGainNode.connect(this.audioContext.destination);

      this.isRecording = true;
    } catch (err) {
      this.stop();
      throw err;
    }
  }

  public stop(): void {
    this.isRecording = false;

    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode = null;
    }
    if (this.silenceGainNode) {
      this.silenceGainNode.disconnect();
      this.silenceGainNode = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.analyserNode) {
      this.analyserNode.disconnect();
      this.analyserNode = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
  }

  public getAnalyser(): AnalyserNode | null {
    return this.analyserNode;
  }

  /**
   * Resamples float32 audio to 16kHz.
   * - For 48kHz -> 16kHz (standard across 95%+ modern PC/Mac/mobile hardware):
   *   uses exact 3:1 boxcar averaging, which acts as a clean anti-aliasing filter
   *   with zero phase delay.
   * - For general rates (e.g., 44.1kHz -> 16kHz):
   *   uses continuous linear interpolation with fractional phase tracking.
   */
  public downsampleBuffer(
    buffer: Float32Array,
    inputRate: number,
    outputRate: number
  ): Float32Array {
    if (outputRate === inputRate) {
      return buffer;
    }

    // 48kHz to 16kHz exact 3:1 boxcar averaging anti-aliasing decimation
    if (inputRate === 48000 && outputRate === 16000) {
      const outLen = Math.floor(buffer.length / 3);
      const output = new Float32Array(outLen);
      for (let i = 0; i < outLen; i++) {
        const idx = i * 3;
        output[i] = (buffer[idx] + buffer[idx + 1] + buffer[idx + 2]) / 3.0;
      }
      return output;
    }

    // Continuous linear interpolation for arbitrary rates (e.g. 44.1kHz -> 16kHz)
    const ratio = inputRate / outputRate;
    const outputSamples: number[] = [];
    let idx = this.resamplePhase;

    while (idx < buffer.length) {
      const i0 = Math.floor(idx);
      const frac = idx - i0;

      const s0 = i0 < 0 ? this.lastInputSample : buffer[i0];
      const s1 = i0 + 1 < buffer.length ? buffer[i0 + 1] : s0;

      const sample = s0 + frac * (s1 - s0);
      outputSamples.push(sample);
      idx += ratio;
    }

    // Retain fractional phase and boundary sample across blocks
    this.resamplePhase = idx - buffer.length;
    this.lastInputSample = buffer[buffer.length - 1];

    return new Float32Array(outputSamples);
  }

  /**
   * Converts float32 audio samples [-1.0, 1.0] to clean 16-bit linear PCM.
   * Uses pure linear conversion and hard clamping without non-linear tanh saturation,
   * preserving pristine acoustic formants for Gemini's neural speech recognition.
   */
  public float32ToInt16(buffer: Float32Array): Int16Array {
    const l = buffer.length;
    const int16Array = new Int16Array(l);

    for (let i = 0; i < l; i++) {
      const s = Math.max(-1, Math.min(1, buffer[i]));
      int16Array[i] = s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff);
    }
    return int16Array;
  }

  private arrayBufferToBase64(buffer: ArrayBufferLike): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }
}

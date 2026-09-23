export class PcmRecorder {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private silenceGainNode: GainNode | null = null;
  private isRecording: boolean = false;
  private onDataCallback: ((base64Pcm: string) => void) | null = null;
  private onSpeechPauseCallback: (() => void) | null = null;
  private targetSampleRate: number = 16000;

  // 100ms chunk buffer at 16kHz (16,000 samples/sec * 0.1s = 1600 samples)
  private readonly targetChunkSize: number = 1600;
  private chunkAccumulator: number[] = [];

  // Fractional phase tracking for click-free continuous resampling
  private resamplePhase: number = 0;
  private lastInputSample: number = 0;

  // Client-side Hybrid VAD tracking
  private hasActiveSpeech: boolean = false;
  private lastSpeechTime: number = 0;
  private readonly speechThreshold: number = 0.012; // RMS threshold
  private readonly silenceTimeoutMs: number = 650;   // Post-speech quiet threshold

  constructor(
    onData: (base64Pcm: string) => void,
    onSpeechPause?: () => void
  ) {
    this.onDataCallback = onData;
    this.onSpeechPauseCallback = onSpeechPause || null;
  }

  public setOnSpeechPause(cb: (() => void) | null): void {
    this.onSpeechPauseCallback = cb;
  }

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

      // Always initialize AudioContext at the hardware's native sample rate (e.g. 48kHz / 44.1kHz).
      // Forcing a 16kHz context directly with createMediaStreamSource triggers browser-level
      // resampling bugs and buffer drops on Windows and Android devices.
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioContext = new AudioContextClass();

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = 256;
      this.sourceNode.connect(this.analyserNode);

      // Reset resampling state and accumulator
      this.resamplePhase = 0;
      this.lastInputSample = 0;
      this.chunkAccumulator = [];
      this.hasActiveSpeech = false;
      this.lastSpeechTime = 0;

      // 2048 sample buffer at native hardware rate (~42ms at 48k)
      const bufferSize = 2048;
      this.processorNode = this.audioContext.createScriptProcessor(bufferSize, 1, 1);

      const actualSampleRate = this.audioContext.sampleRate;

      this.processorNode.onaudioprocess = (e) => {
        if (!this.isRecording) return;
        const inputData = e.inputBuffer.getChannelData(0);

        // 1. RMS Voice Activity Detection for Hybrid VAD
        let sumSquare = 0;
        for (let i = 0; i < inputData.length; i++) {
          sumSquare += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sumSquare / inputData.length);
        const now = Date.now();

        if (rms > this.speechThreshold) {
          this.hasActiveSpeech = true;
          this.lastSpeechTime = now;
        } else if (this.hasActiveSpeech && now - this.lastSpeechTime >= this.silenceTimeoutMs) {
          this.hasActiveSpeech = false;
          // Finalize conversational turn: flush buffered audio and notify listener
          this.flushAccumulator();
          if (this.onSpeechPauseCallback) {
            this.onSpeechPauseCallback();
          }
        }

        // 2. High-Fidelity Continuous Resampling to 16kHz
        const downsampled = this.downsampleBuffer(inputData, actualSampleRate, this.targetSampleRate);

        // 3. Accumulate into 100ms chunks (1,600 samples at 16kHz)
        for (let i = 0; i < downsampled.length; i++) {
          this.chunkAccumulator.push(downsampled[i]);
        }

        while (this.chunkAccumulator.length >= this.targetChunkSize) {
          const chunk = new Float32Array(this.chunkAccumulator.splice(0, this.targetChunkSize));
          const pcm16Data = this.float32ToInt16(chunk);
          const base64 = this.arrayBufferToBase64(pcm16Data.buffer);
          if (this.onDataCallback) {
            this.onDataCallback(base64);
          }
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

    // Flush any remaining audio
    this.flushAccumulator();

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
   * Resamples float32 audio to target sample rate using linear interpolation
   * with fractional phase tracking across consecutive buffers.
   */
  public downsampleBuffer(
    buffer: Float32Array,
    inputRate: number,
    outputRate: number
  ): Float32Array {
    if (outputRate === inputRate) {
      return buffer;
    }

    const ratio = inputRate / outputRate;
    const outputSamples: number[] = [];
    let idx = this.resamplePhase;

    while (idx < buffer.length) {
      const i0 = Math.floor(idx);
      const frac = idx - i0;

      let s0: number;
      if (i0 < 0) {
        s0 = this.lastInputSample;
      } else {
        s0 = buffer[i0];
      }

      let s1: number;
      if (i0 + 1 < buffer.length) {
        s1 = buffer[i0 + 1];
      } else {
        s1 = s0;
      }

      const sample = s0 + frac * (s1 - s0);
      outputSamples.push(sample);
      idx += ratio;
    }

    // Save fractional phase and last sample for seamless continuity in the next process block
    this.resamplePhase = idx - buffer.length;
    this.lastInputSample = buffer[buffer.length - 1];

    return new Float32Array(outputSamples);
  }

  /**
   * Converts float32 audio to 16-bit linear PCM with a 1.6x pre-gain boost
   * and smooth tanh soft-limiting to maximize speech pickup without digital clipping.
   */
  public float32ToInt16(buffer: Float32Array): Int16Array {
    const l = buffer.length;
    const int16Array = new Int16Array(l);
    const preGain = 1.6;

    for (let i = 0; i < l; i++) {
      const boosted = Math.tanh(buffer[i] * preGain);
      int16Array[i] = boosted < 0 ? Math.round(boosted * 0x8000) : Math.round(boosted * 0x7fff);
    }
    return int16Array;
  }

  private flushAccumulator(): void {
    if (this.chunkAccumulator.length > 0 && this.onDataCallback) {
      const chunk = new Float32Array(this.chunkAccumulator);
      this.chunkAccumulator = [];
      const pcm16Data = this.float32ToInt16(chunk);
      const base64 = this.arrayBufferToBase64(pcm16Data.buffer);
      this.onDataCallback(base64);
    }
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

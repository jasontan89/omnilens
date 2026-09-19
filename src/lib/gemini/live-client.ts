import type {
  BidiContentSetup,
  BidiRealtimeInput,
  BidiServerMessage,
  ConnectionState,
  SessionSettings,
} from '../../types/live';
import { PERSONA_PROMPTS } from './prompts';

export interface LiveClientCallbacks {
  onConnectionChange: (state: ConnectionState, error?: string) => void;
  onAudioChunk: (base64Pcm: string) => void;
  onInputTranscription: (text: string) => void;
  onOutputTranscription: (text: string) => void;
  onInterrupted: () => void;
  onTurnComplete: () => void;
}

export class GeminiLiveClient {
  private ws: WebSocket | null = null;
  private settings: SessionSettings;
  private callbacks: LiveClientCallbacks;
  private isConnected: boolean = false;
  private isSetupDone: boolean = false;

  constructor(settings: SessionSettings, callbacks: LiveClientCallbacks) {
    this.settings = settings;
    this.callbacks = callbacks;
  }

  public updateSettings(settings: SessionSettings): void {
    this.settings = settings;
  }

  public connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    if (!this.settings.apiKey || this.settings.apiKey.trim() === '') {
      this.callbacks.onConnectionChange('error', 'API Key is required to connect.');
      return;
    }

    this.callbacks.onConnectionChange('connecting');
    this.isSetupDone = false;
    this.isConnected = false;

    try {
      const endpoint = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${encodeURIComponent(
        this.settings.apiKey.trim()
      )}`;

      this.ws = new WebSocket(endpoint);

      this.ws.onopen = () => {
        this.sendSetup();
      };

      this.ws.onmessage = async (event: MessageEvent) => {
        try {
          let messageData: string;
          if (event.data instanceof Blob) {
            messageData = await event.data.text();
          } else {
            messageData = event.data;
          }

          const response: BidiServerMessage = JSON.parse(messageData);
          this.handleServerMessage(response);
        } catch (err) {
          console.error('Failed to parse Gemini Live message:', err);
        }
      };

      this.ws.onerror = (event: Event) => {
        console.error('Gemini Live WebSocket error:', event);
        this.callbacks.onConnectionChange('error', 'WebSocket connection error. Please verify your API key and connection.');
      };

      this.ws.onclose = (event: CloseEvent) => {
        this.isConnected = false;
        this.isSetupDone = false;
        console.log(`WebSocket closed (code: ${event.code}, reason: ${event.reason})`);

        if (event.code === 1000) {
          this.callbacks.onConnectionChange('disconnected');
        } else if (event.code === 1008 || event.reason.toLowerCase().includes('api key')) {
          this.callbacks.onConnectionChange('error', 'Invalid API key or unauthorized access.');
        } else {
          this.callbacks.onConnectionChange('disconnected', event.reason || `Disconnected (${event.code})`);
        }
      };
    } catch (err) {
      console.error('Failed to initiate WebSocket:', err);
      this.callbacks.onConnectionChange('error', 'Failed to initiate WebSocket connection.');
    }
  }

  private sendSetup(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    let basePrompt = PERSONA_PROMPTS[this.settings.persona] || PERSONA_PROMPTS['pair-programmer'];
    if (this.settings.model === 'gemini-3.5-live-translate-preview') {
      const targetLang = this.settings.targetLanguageCode || 'es';
      basePrompt = `You are a real-time speech and multimodal translation interpreter. Accurately translate spoken and textual input into the target language code: ${targetLang}. Maintain natural phrasing, correct cultural nuances, and clear pronunciation.`;
    } else if (this.settings.model === 'gemini-3.5-transcribe-live') {
      basePrompt = `You are a real-time live transcription engine. Accurately transcribe incoming speech and describe visual context concisely into formatted text without verbal commentary.`;
    }

    const fullPrompt = this.settings.customInstructions
      ? `${basePrompt}\n\nAdditional user guidelines: ${this.settings.customInstructions}`
      : basePrompt;

    // Build generationConfig dynamically based on model capabilities
    const isTranscribeOnly = this.settings.model === 'gemini-3.5-transcribe-live';
    const isTranslate = this.settings.model === 'gemini-3.5-live-translate-preview';

    const generationConfig: NonNullable<BidiContentSetup['setup']['generationConfig']> = {
      responseModalities: isTranscribeOnly ? ['TEXT'] : ['AUDIO'],
    };

    if (!isTranscribeOnly) {
      generationConfig.speechConfig = {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: this.settings.voice,
          },
        },
      };
    }

    // Thinking configuration:
    // IMPORTANT: gemini-3.8-live throws "Thinking level is not supported for this model" if thinkingConfig is sent.
    // Only attach thinkingConfig for models that explicitly support thinking.
    if (this.settings.model === 'gemini-3.8-live-extended-thinking') {
      generationConfig.thinkingConfig = {
        thinkingLevel: 'high',
      };
    } else if (this.settings.model === 'gemini-3.1-flash-live-preview') {
      generationConfig.thinkingConfig = {
        thinkingLevel: 'minimal',
      };
    }

    // Translation configuration
    if (isTranslate) {
      generationConfig.translationConfig = {
        targetLanguageCode: this.settings.targetLanguageCode || 'es',
        echoTargetLanguage: true,
      };
    }

    const setupPayload: BidiContentSetup = {
      setup: {
        model: `models/${this.settings.model}`,
        generationConfig,
        systemInstruction: {
          parts: [{ text: fullPrompt }],
        },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
      },
    };

    this.ws.send(JSON.stringify(setupPayload));
  }

  private handleServerMessage(data: BidiServerMessage): void {
    // 1. Check for setup completion handshake
    if (data.setupComplete) {
      this.isSetupDone = true;
      this.isConnected = true;
      this.callbacks.onConnectionChange('connected');
      return;
    }

    const content = data.serverContent;
    if (!content) return;

    // Check for interruption signal (instant cut-off)
    if (content.interrupted === true) {
      this.callbacks.onInterrupted();
    }

    // Audio stream output (24kHz raw PCM)
    if (content.modelTurn?.parts) {
      for (const part of content.modelTurn.parts) {
        if (part.inlineData?.data) {
          this.callbacks.onAudioChunk(part.inlineData.data);
        }
      }
    }

    // User speech transcription
    if (content.inputTranscription?.text) {
      this.callbacks.onInputTranscription(content.inputTranscription.text);
    }

    // AI speech transcription
    if (content.outputTranscription?.text) {
      this.callbacks.onOutputTranscription(content.outputTranscription.text);
    }

    // Turn completion
    if (content.turnComplete === true) {
      this.callbacks.onTurnComplete();
    }
  }

  public sendAudioChunk(base64Pcm: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.isSetupDone) return;

    const payload: BidiRealtimeInput = {
      realtimeInput: {
        audio: {
          mimeType: 'audio/pcm;rate=16000',
          data: base64Pcm,
        },
      },
    };

    this.ws.send(JSON.stringify(payload));
  }

  public sendVideoFrame(base64Jpeg: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.isSetupDone) return;

    const payload: BidiRealtimeInput = {
      realtimeInput: {
        video: {
          mimeType: 'image/jpeg',
          data: base64Jpeg,
        },
      },
    };

    this.ws.send(JSON.stringify(payload));
  }

  public sendText(text: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.isSetupDone) return;

    const payload: BidiRealtimeInput = {
      realtimeInput: {
        text: text.trim(),
      },
    };

    this.ws.send(JSON.stringify(payload));
  }

  public disconnect(): void {
    if (this.ws) {
      try {
        this.ws.close(1000, 'User disconnected');
      } catch {
        // WebSocket might already be closed
      }
      this.ws = null;
    }
    this.isConnected = false;
    this.isSetupDone = false;
    this.callbacks.onConnectionChange('disconnected');
  }

  public getIsConnected(): boolean {
    return this.isConnected;
  }

  public getIsSetupDone(): boolean {
    return this.isSetupDone;
  }
}

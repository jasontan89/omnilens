export type LiveModel = 'gemini-3.1-flash-live-preview' | 'gemini-3.8-live';

export type CopilotPersona = 'pair-programmer' | 'meeting-copilot' | 'study-tutor' | 'general-assistant';

export type GeminiVoice = 'Puck' | 'Charon' | 'Aoede' | 'Fenrir' | 'Kore';

export interface SessionSettings {
  apiKey: string;
  model: LiveModel;
  persona: CopilotPersona;
  voice: GeminiVoice;
  screenFps: number; // 1 or 2 fps
  customInstructions?: string;
}

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

export interface TranscriptMessage {
  id: string;
  sender: 'user' | 'gemini' | 'system';
  text: string;
  timestamp: Date;
  isPartial?: boolean;
}

export interface ExtractedNote {
  id: string;
  type: 'action-item' | 'key-insight' | 'code-snippet' | 'warning';
  title: string;
  content: string;
  timestamp: Date;
}

// Gemini Live WebSocket message protocol interfaces
export interface BidiContentSetup {
  setup: {
    model: string;
    generationConfig?: {
      responseModalities?: ('AUDIO' | 'TEXT')[];
      speechConfig?: {
        voiceConfig?: {
          prebuiltVoiceConfig?: {
            voiceName: GeminiVoice;
          };
        };
      };
      thinkingConfig?: {
        thinkingLevel?: 'minimal' | 'low' | 'medium' | 'high';
      };
    };
    systemInstruction?: {
      parts: { text: string }[];
    };
    inputAudioTranscription?: {
      mode?: 'smart' | 'verbatim';
    };
    outputAudioTranscription?: Record<string, unknown>;
  };
}

export interface BidiRealtimeInput {
  realtimeInput: {
    audio?: {
      mimeType: string; // "audio/pcm;rate=16000"
      data: string;     // Base64
    };
    video?: {
      mimeType: string; // "image/jpeg"
      data: string;     // Base64
    };
    text?: string;
  };
}

export interface BidiServerMessage {
  setupComplete?: Record<string, unknown>;
  serverContent?: {
    modelTurn?: {
      parts: {
        text?: string;
        inlineData?: {
          mimeType: string;
          data: string; // Base64 PCM 24kHz
        };
      }[];
    };
    turnComplete?: boolean;
    interrupted?: boolean;
    inputTranscription?: {
      text: string;
    };
    outputTranscription?: {
      text: string;
    };
  };
}

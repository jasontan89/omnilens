export type LiveModel =
  | 'gemini-3.1-flash-live-preview'
  | 'gemini-3.8-live'
  | 'gemini-3.8-live-extended-thinking'
  | 'gemini-3.5-live-translate-preview'
  | 'gemini-3.5-transcribe-live';

export type CopilotPersona =
  | 'pair-programmer'
  | 'meeting-copilot'
  | 'study-tutor'
  | 'general-assistant'
  | 'system-design'
  | 'legal-auditor'
  | 'language-tutor'
  | 'financial-analyst';

export type GeminiVoice =
  | 'Aoede'
  | 'Kore'
  | 'Leda'
  | 'Callirrhoe'
  | 'Autonoe'
  | 'Despina'
  | 'Puck'
  | 'Charon'
  | 'Fenrir'
  | 'Zephyr';

export interface SessionSettings {
  apiKey: string;
  model: LiveModel;
  persona: CopilotPersona;
  voice: GeminiVoice;
  screenFps: number; // 1 to 5 fps
  customInstructions?: string;
  targetLanguageCode?: string; // For live translation (e.g., 'es', 'fr', 'ja', 'zh')
  enableGoogleSearch?: boolean; // Google Live Search Grounding for real-time web data
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
  completed?: boolean;
}

// Gemini Live WebSocket message protocol interfaces
export interface BidiContentSetup {
  setup: {
    model: string;
    tools?: {
      googleSearch?: Record<string, unknown>;
      codeExecution?: Record<string, unknown>;
      functionDeclarations?: unknown[];
    }[];
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
      translationConfig?: {
        targetLanguageCode: string;
        echoTargetLanguage?: boolean;
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

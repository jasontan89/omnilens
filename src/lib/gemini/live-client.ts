import type {
  BidiContentSetup,
  BidiFunctionCall,
  BidiFunctionResponse,
  BidiRealtimeInput,
  BidiServerMessage,
  BidiToolResponse,
  ConnectionState,
  LiveModel,
  SessionSettings,
} from '../../types/live';
import { PERSONA_PROMPTS } from './prompts';
import { performGroundedSearch, type GroundedSearchSource } from './search-grounding';

/**
 * Maps the user's copilot model mode to the official Google Gemini Live API model endpoint.
 * In Google's Live API architecture, the native audio and thinking engine is gemini-3.1-flash-live-preview.
 */
export function resolveLiveApiModel(model: LiveModel): string {
  switch (model) {
    case 'gemini-3.5-live-translate-preview':
      return 'models/gemini-3.5-live-translate-preview';
    case 'gemini-3.5-transcribe-live':
      return 'models/gemini-3.5-transcribe-live';
    case 'gemini-3.8-live':
    case 'gemini-3.8-live-extended-thinking':
    case 'gemini-3.1-flash-live-preview':
    default:
      return 'models/gemini-3.1-flash-live-preview';
  }
}

export interface LiveClientCallbacks {
  onConnectionChange: (state: ConnectionState, error?: string) => void;
  onAudioChunk: (base64Pcm: string) => void;
  onInputTranscription: (text: string) => void;
  onOutputTranscription: (text: string) => void;
  onInterrupted: () => void;
  onTurnComplete: () => void;
  onSearchStatus?: (
    status: 'searching' | 'grounded' | 'error',
    data?: { query: string; sources?: GroundedSearchSource[]; error?: string }
  ) => void;
}

export class GeminiLiveClient {
  private ws: WebSocket | null = null;
  private settings: SessionSettings;
  private callbacks: LiveClientCallbacks;
  private isConnected: boolean = false;
  private isSetupDone: boolean = false;
  private lastSearchTimestamp: number = 0;

  /** Minimum milliseconds between consecutive google_search invocations */
  private static readonly SEARCH_COOLDOWN_MS = 5000;

  constructor(settings: SessionSettings, callbacks: LiveClientCallbacks) {
    this.settings = settings;
    this.callbacks = callbacks;
  }

  /**
   * Detects queries that are obviously well-established facts and should NOT
   * trigger a web search. This is a conservative safety net — the primary fix
   * is the refined system prompt that trains the model's own judgment.
   */
  public isObviouslyStaticQuery(query: string): boolean {
    const lower = query.toLowerCase().trim();

    const staticPatterns = [
      // Historical political figures ("first president of the USA")
      /\b(first|second|third|\d+(?:st|nd|rd|th))\s+(president|king|queen|emperor|pharaoh|chancellor)\b/,
      // Capital cities ("capital of France")
      /\b(?:what is|what's) (?:the )?capital (?:of|city of)\b/,
      // Well-known science / math constants
      /\b(speed of light|planck'?s? constant|avogadro|pythagorean|boiling point|freezing point|melting point|gravitational constant)\b/,
      // Historical events that will never change
      /\b(world war\s*[i1](?![iv])|world war\s*(?:ii|2)|wwi{1,2}|ww[12]|civil war|american revolution|french revolution|renaissance|ancient (rome|greece|egypt))\b/,
      // Definitions / explanations of stable concepts
      /^(?:what is|what are|define|explain|describe|tell me about)\s+(?:a |an |the )?(photosynthesis|mitosis|meiosis|democracy|communism|capitalism|socialism|evolution|gravity|magnetism|osmosis|diffusion)\b/,
      // Math operations / formulas
      /^(?:what is|calculate|solve|compute)\s+\d+\s*[+\-*/×÷^]\s*\d+/,
      // Programming / CS concepts
      /\b(?:what is|explain|how does)\b.*\b(binary search|bubble sort|merge sort|linked list|hash map|recursion|big o|polymorphism|inheritance|encapsulation)\b/,
    ];

    return staticPatterns.some(pattern => pattern.test(lower));
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
        } else if (event.reason.toLowerCase().includes('quota') || event.reason.toLowerCase().includes('billing')) {
          this.callbacks.onConnectionChange(
            'error',
            'Quota Exceeded: You have reached your current Google Gemini rate limit. Please check your quota at ai.google.dev or retry in a few moments.'
          );
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

    // Thinking configuration
    if (!isTranslate && !isTranscribeOnly) {
      if (this.settings.model === 'gemini-3.8-live-extended-thinking') {
        generationConfig.thinkingConfig = {
          thinkingLevel: 'high',
        };
      } else if (this.settings.model === 'gemini-3.8-live') {
        generationConfig.thinkingConfig = {
          thinkingLevel: 'medium',
        };
      } else if (this.settings.model === 'gemini-3.1-flash-live-preview') {
        generationConfig.thinkingConfig = {
          thinkingLevel: 'minimal',
        };
      }
    }

    // Translation configuration
    if (isTranslate) {
      generationConfig.translationConfig = {
        targetLanguageCode: this.settings.targetLanguageCode || 'es',
        echoTargetLanguage: true,
      };
    }

    const targetModel = resolveLiveApiModel(this.settings.model);

    const currentDateStr = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const currentYear = new Date().getFullYear();
    let promptWithSearch = fullPrompt;
    if (this.settings.enableGoogleSearch && !isTranscribeOnly) {
      const searchEngineDesc = this.settings.braveSearchApiKey
        ? 'Brave Search API + Gemini 3.1 Flash Lite'
        : 'Live Web Grounding + Gemini 3.1 Flash Lite';
      promptWithSearch += `\n\n[Real-Time Web Search Available via ${searchEngineDesc}]:
- Current Real-World Date: ${currentDateStr} (Year ${currentYear}).
- You have a \`google_search\` tool available for looking up LIVE, time-sensitive information.
- USE google_search ONLY when the answer genuinely depends on information that changes over time and your training data is likely outdated. Examples:
  • Today's weather, live sports scores, current stock/crypto prices
  • News events from the past 7 days
  • Current software version numbers or release dates from this year
  • People or officeholders who may have changed since your training cutoff
- DO NOT use google_search for:
  • Well-established historical facts (e.g., "first president of the USA", "when was WWII")
  • Stable scientific or mathematical knowledge (e.g., "speed of light", "Pythagorean theorem")
  • General knowledge that does not change (e.g., "capital of France", "what is photosynthesis")
  • Programming concepts, algorithms, or language syntax
  • Anything you can answer confidently from your training data
- When in doubt, answer directly from your knowledge. Only search if you are genuinely uncertain whether facts may have changed since your training cutoff.
- Once you receive the search output, answer the user conversationally and concisely using the retrieved facts.`;
    }

    const setupPayload: BidiContentSetup = {
      setup: {
        model: targetModel,
        generationConfig,
        systemInstruction: {
          parts: [{ text: promptWithSearch }],
        },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
      },
    };

    // Attach Google Search Function Declaration for live web grounding
    // Routes searches to Gemini 3.1 / 3.5 Flash Lite to ensure 100% Free Tier compatibility (500 free requests/day)
    if (this.settings.enableGoogleSearch && !isTranscribeOnly) {
      setupPayload.setup.tools = [
        {
          functionDeclarations: [
            {
              name: 'google_search',
              description:
                'Search the live web for REAL-TIME or RAPIDLY-CHANGING information ONLY. Use for: current news (past 7 days), live weather, today\'s stock prices, live sports scores, or very recent events. Do NOT use for historical facts, stable science, math, general knowledge, or well-known information that does not change.',
              parameters: {
                type: 'OBJECT',
                properties: {
                  query: {
                    type: 'STRING',
                    description: 'The exact search query to look up on Google',
                  },
                },
                required: ['query'],
              },
            },
          ],
        },
      ];
    }

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

    // 2. Handle model tool calls (Google Search via Gemini 3.1 Flash Lite)
    if (data.toolCall?.functionCalls && data.toolCall.functionCalls.length > 0) {
      this.handleToolCalls(data.toolCall.functionCalls);
    }

    const content = data.serverContent;
    if (!content) return;

    // Check for interruption signal (instant cut-off)
    if (content.interrupted === true) {
      this.callbacks.onInterrupted();
    }

    // Audio stream output (24kHz raw PCM) & text fallback
    if (content.modelTurn?.parts) {
      for (const part of content.modelTurn.parts) {
        if (part.inlineData?.data) {
          this.callbacks.onAudioChunk(part.inlineData.data);
        }
        if (part.text && !content.outputTranscription?.text) {
          this.callbacks.onOutputTranscription(part.text);
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

  private async handleToolCalls(functionCalls: BidiFunctionCall[]): Promise<void> {
    const responses: BidiFunctionResponse[] = [];

    for (const call of functionCalls) {
      if (call.name === 'google_search') {
        const query = (call.args?.query as string) || '';

        // Client-side guard: skip search for obviously static/historical knowledge
        if (this.isObviouslyStaticQuery(query)) {
          console.log(`[SearchGuard] Skipped search for static query: "${query}"`);
          responses.push({
            id: call.id,
            name: call.name,
            response: {
              output: 'This is well-established knowledge that does not change. Please answer directly from your own training data without searching.',
            },
          });
          continue;
        }

        // Cooldown: prevent rapid-fire consecutive searches
        const now = Date.now();
        if (now - this.lastSearchTimestamp < GeminiLiveClient.SEARCH_COOLDOWN_MS) {
          console.log(`[SearchCooldown] Skipped search within ${GeminiLiveClient.SEARCH_COOLDOWN_MS}ms cooldown: "${query}"`);
          responses.push({
            id: call.id,
            name: call.name,
            response: {
              output: 'A search was just performed. Please answer this follow-up using the previous search results or your own knowledge.',
            },
          });
          continue;
        }

        this.callbacks.onSearchStatus?.('searching', { query });

        try {
          const result = await performGroundedSearch(query, this.settings.apiKey, {
            braveApiKey: this.settings.braveSearchApiKey,
          });
          this.lastSearchTimestamp = Date.now();
          this.callbacks.onSearchStatus?.('grounded', {
            query,
            sources: result.sources,
          });

          responses.push({
            id: call.id,
            name: call.name,
            response: {
              output: result.text,
            },
          });
        } catch (err: unknown) {
          const errorMsg = (err as Error)?.message || 'Search failed';
          console.warn('Google Search Grounding failed:', err);
          this.callbacks.onSearchStatus?.('error', { query, error: errorMsg });

          responses.push({
            id: call.id,
            name: call.name,
            response: {
              output: 'Google Search was temporarily unavailable. Please answer using your best knowledge.',
            },
          });
        }
      } else {
        responses.push({
          id: call.id,
          name: call.name,
          response: {
            output: 'Function not recognized.',
          },
        });
      }
    }

    if (responses.length > 0 && this.ws && this.ws.readyState === WebSocket.OPEN) {
      const toolResponsePayload: BidiToolResponse = {
        toolResponse: {
          functionResponses: responses,
        },
      };
      this.ws.send(JSON.stringify(toolResponsePayload));
    }
  }

  public getIsConnected(): boolean {
    return this.isConnected;
  }

  public getIsSetupDone(): boolean {
    return this.isSetupDone;
  }
}

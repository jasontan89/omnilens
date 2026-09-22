import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeminiLiveClient } from './live-client';
import type { SessionSettings } from '../../types/live';

// Mock WebSocket
class MockWebSocket {
  public static OPEN = 1;
  public static CONNECTING = 0;
  public readyState = MockWebSocket.CONNECTING;
  public onopen: (() => void) | null = null;
  public onmessage: ((event: { data: string }) => void) | null = null;
  public onerror: ((event: unknown) => void) | null = null;
  public onclose: ((event: { code: number; reason: string }) => void) | null = null;
  public sentMessages: string[] = [];
  public url: string;

  constructor(url: string) {
    this.url = url;
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) this.onopen();
    }, 0);
  }

  public send(data: string) {
    this.sentMessages.push(data);
  }

  public close(code = 1000, reason = '') {
    this.readyState = 3;
    if (this.onclose) this.onclose({ code, reason });
  }

  public triggerMessage(data: Record<string, unknown>) {
    if (this.onmessage) {
      this.onmessage({ data: JSON.stringify(data) });
    }
  }
}

describe('GeminiLiveClient Protocol & Deprecation Fixes', () => {
  let mockWsInstance: MockWebSocket;

  beforeEach(() => {
    vi.stubGlobal('WebSocket', class extends MockWebSocket {
      constructor(url: string) {
        super(url);
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        mockWsInstance = this;
      }
    });
  });

  const testSettings: SessionSettings = {
    apiKey: 'test-api-key-12345',
    model: 'gemini-3.1-flash-live-preview',
    persona: 'pair-programmer',
    voice: 'Aoede',
    screenFps: 1,
    customInstructions: '',
  };

  it('sends correct setup message with models resource name and audio modality', async () => {
    const callbacks = {
      onConnectionChange: vi.fn(),
      onAudioChunk: vi.fn(),
      onInputTranscription: vi.fn(),
      onOutputTranscription: vi.fn(),
      onInterrupted: vi.fn(),
      onTurnComplete: vi.fn(),
    };

    const client = new GeminiLiveClient(testSettings, callbacks);
    client.connect();

    // Wait for ws.onopen to fire
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(mockWsInstance.sentMessages.length).toBe(1);
    const setupMsg = JSON.parse(mockWsInstance.sentMessages[0]);

    expect(setupMsg.setup).toBeDefined();
    expect(setupMsg.setup.model).toBe('models/gemini-3.1-flash-live-preview');
    expect(setupMsg.setup.generationConfig.responseModalities).toEqual(['AUDIO']);
    expect(setupMsg.setup.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName).toBe('Aoede');
    expect(setupMsg.setup.generationConfig.thinkingConfig).toEqual({ thinkingLevel: 'minimal' });
    expect(setupMsg.setup.contextWindowCompression).toEqual({ slidingWindow: {} });
    expect(setupMsg.setup.sessionResumption).toEqual({ handle: null });
  });

  it('maps gemini-3.8-live to models/gemini-3.1-flash-live-preview with medium thinkingLevel', async () => {
    const callbacks = {
      onConnectionChange: vi.fn(),
      onAudioChunk: vi.fn(),
      onInputTranscription: vi.fn(),
      onOutputTranscription: vi.fn(),
      onInterrupted: vi.fn(),
      onTurnComplete: vi.fn(),
    };

    const client = new GeminiLiveClient({ ...testSettings, model: 'gemini-3.8-live' }, callbacks);
    client.connect();
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(mockWsInstance.sentMessages.length).toBe(1);
    const setupMsg = JSON.parse(mockWsInstance.sentMessages[0]);

    // Maps to official Live API engine with balanced medium thinking
    expect(setupMsg.setup.model).toBe('models/gemini-3.1-flash-live-preview');
    expect(setupMsg.setup.generationConfig.thinkingConfig).toEqual({ thinkingLevel: 'medium' });
    expect(setupMsg.setup.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName).toBe('Aoede');
  });

  it('maps gemini-3.8-live-extended-thinking to models/gemini-3.1-flash-live-preview with high thinkingLevel', async () => {
    const callbacks = {
      onConnectionChange: vi.fn(),
      onAudioChunk: vi.fn(),
      onInputTranscription: vi.fn(),
      onOutputTranscription: vi.fn(),
      onInterrupted: vi.fn(),
      onTurnComplete: vi.fn(),
    };

    const client = new GeminiLiveClient({ ...testSettings, model: 'gemini-3.8-live-extended-thinking' }, callbacks);
    client.connect();
    await new Promise((resolve) => setTimeout(resolve, 10));

    const setupMsg = JSON.parse(mockWsInstance.sentMessages[0]);
    // Maps to official Live API engine with maximum high thinking depth
    expect(setupMsg.setup.model).toBe('models/gemini-3.1-flash-live-preview');
    expect(setupMsg.setup.generationConfig.thinkingConfig).toEqual({ thinkingLevel: 'high' });
  });

  it('configures translationConfig for gemini-3.5-live-translate-preview without thinkingConfig', async () => {
    const callbacks = {
      onConnectionChange: vi.fn(),
      onAudioChunk: vi.fn(),
      onInputTranscription: vi.fn(),
      onOutputTranscription: vi.fn(),
      onInterrupted: vi.fn(),
      onTurnComplete: vi.fn(),
    };

    const client = new GeminiLiveClient(
      { ...testSettings, model: 'gemini-3.5-live-translate-preview', targetLanguageCode: 'ja' },
      callbacks
    );
    client.connect();
    await new Promise((resolve) => setTimeout(resolve, 10));

    const setupMsg = JSON.parse(mockWsInstance.sentMessages[0]);
    expect(setupMsg.setup.model).toBe('models/gemini-3.5-live-translate-preview');
    expect(setupMsg.setup.generationConfig.translationConfig).toEqual({
      targetLanguageCode: 'ja',
      echoTargetLanguage: true,
    });
    expect(setupMsg.setup.generationConfig.thinkingConfig).toBeUndefined();
  });

  it('configures TEXT responseModality and omits speech/thinking for gemini-3.5-transcribe-live', async () => {
    const callbacks = {
      onConnectionChange: vi.fn(),
      onAudioChunk: vi.fn(),
      onInputTranscription: vi.fn(),
      onOutputTranscription: vi.fn(),
      onInterrupted: vi.fn(),
      onTurnComplete: vi.fn(),
    };

    const client = new GeminiLiveClient(
      { ...testSettings, model: 'gemini-3.5-transcribe-live' },
      callbacks
    );
    client.connect();
    await new Promise((resolve) => setTimeout(resolve, 10));

    const setupMsg = JSON.parse(mockWsInstance.sentMessages[0]);
    expect(setupMsg.setup.model).toBe('models/gemini-3.5-transcribe-live');
    expect(setupMsg.setup.generationConfig.responseModalities).toEqual(['TEXT']);
    expect(setupMsg.setup.generationConfig.speechConfig).toBeUndefined();
    expect(setupMsg.setup.generationConfig.thinkingConfig).toBeUndefined();
  });

  it('attaches functionDeclarations with google_search in setup message when enableGoogleSearch is true', async () => {
    const callbacks = {
      onConnectionChange: vi.fn(),
      onAudioChunk: vi.fn(),
      onInputTranscription: vi.fn(),
      onOutputTranscription: vi.fn(),
      onInterrupted: vi.fn(),
      onTurnComplete: vi.fn(),
    };

    const client = new GeminiLiveClient(
      { ...testSettings, enableGoogleSearch: true },
      callbacks
    );
    client.connect();
    await new Promise((resolve) => setTimeout(resolve, 10));

    const setupMsg = JSON.parse(mockWsInstance.sentMessages[0]);
    expect(setupMsg.setup.tools).toBeDefined();
    expect(setupMsg.setup.tools[0].functionDeclarations).toBeDefined();
    expect(setupMsg.setup.tools[0].functionDeclarations[0].name).toBe('google_search');
    expect(setupMsg.setup.tools[0].functionDeclarations[0].description).toContain('REAL-TIME or RAPIDLY-CHANGING');
    expect(setupMsg.setup.tools[0].functionDeclarations[0].description).toContain('Do NOT use for historical facts');
    expect(setupMsg.setup.systemInstruction.parts[0].text).toContain('google_search');
    expect(setupMsg.setup.systemInstruction.parts[0].text).toContain('DO NOT use google_search for');
    expect(setupMsg.setup.systemInstruction.parts[0].text).toContain('Well-established historical facts');
  });

  it('omits tools property when enableGoogleSearch is false', async () => {
    const callbacks = {
      onConnectionChange: vi.fn(),
      onAudioChunk: vi.fn(),
      onInputTranscription: vi.fn(),
      onOutputTranscription: vi.fn(),
      onInterrupted: vi.fn(),
      onTurnComplete: vi.fn(),
    };

    const client = new GeminiLiveClient(
      { ...testSettings, enableGoogleSearch: false },
      callbacks
    );
    client.connect();
    await new Promise((resolve) => setTimeout(resolve, 10));

    const setupMsg = JSON.parse(mockWsInstance.sentMessages[0]);
    expect(setupMsg.setup.tools).toBeUndefined();
  });

  it('omits googleSearch tools for transcribe-only model even if enableGoogleSearch is true', async () => {
    const callbacks = {
      onConnectionChange: vi.fn(),
      onAudioChunk: vi.fn(),
      onInputTranscription: vi.fn(),
      onOutputTranscription: vi.fn(),
      onInterrupted: vi.fn(),
      onTurnComplete: vi.fn(),
    };

    const client = new GeminiLiveClient(
      { ...testSettings, model: 'gemini-3.5-transcribe-live', enableGoogleSearch: true },
      callbacks
    );
    client.connect();
    await new Promise((resolve) => setTimeout(resolve, 10));

    const setupMsg = JSON.parse(mockWsInstance.sentMessages[0]);
    expect(setupMsg.setup.tools).toBeUndefined();
  });

  it('waits for setupComplete handshake before enabling isConnected and sending realtimeInput', async () => {
    const callbacks = {
      onConnectionChange: vi.fn(),
      onAudioChunk: vi.fn(),
      onInputTranscription: vi.fn(),
      onOutputTranscription: vi.fn(),
      onInterrupted: vi.fn(),
      onTurnComplete: vi.fn(),
    };

    const client = new GeminiLiveClient(testSettings, callbacks);
    client.connect();
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Initially, setup is sent but setupComplete is not yet received
    expect(client.getIsConnected()).toBe(false);
    expect(client.getIsSetupDone()).toBe(false);

    // Attempting to send audio before setupComplete should be safely dropped
    client.sendAudioChunk('testBase64Pcm');
    expect(mockWsInstance.sentMessages.length).toBe(1); // Only setup message was sent

    // Server sends setupComplete handshake
    mockWsInstance.triggerMessage({ setupComplete: {} });

    expect(client.getIsConnected()).toBe(true);
    expect(client.getIsSetupDone()).toBe(true);
    expect(callbacks.onConnectionChange).toHaveBeenCalledWith('connected');
  });

  it('uses realtimeInput.audio (NOT deprecated media_chunks) when streaming microphone audio', async () => {
    const callbacks = {
      onConnectionChange: vi.fn(),
      onAudioChunk: vi.fn(),
      onInputTranscription: vi.fn(),
      onOutputTranscription: vi.fn(),
      onInterrupted: vi.fn(),
      onTurnComplete: vi.fn(),
    };

    const client = new GeminiLiveClient(testSettings, callbacks);
    client.connect();
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Complete setup handshake
    mockWsInstance.triggerMessage({ setupComplete: {} });

    // Send audio chunk
    const pcmChunk = 'AAAABBBBCCCC';
    client.sendAudioChunk(pcmChunk);

    expect(mockWsInstance.sentMessages.length).toBe(2);
    const audioPayload = JSON.parse(mockWsInstance.sentMessages[1]);

    // MUST use audio key, NOT media_chunks
    expect(audioPayload.realtimeInput.mediaChunks).toBeUndefined();
    expect(audioPayload.realtimeInput.media_chunks).toBeUndefined();
    expect(audioPayload.realtimeInput.audio).toBeDefined();
    expect(audioPayload.realtimeInput.audio.mimeType).toBe('audio/pcm;rate=16000');
    expect(audioPayload.realtimeInput.audio.data).toBe(pcmChunk);
  });

  it('uses realtimeInput.video (NOT deprecated media_chunks) when streaming video frames', async () => {
    const callbacks = {
      onConnectionChange: vi.fn(),
      onAudioChunk: vi.fn(),
      onInputTranscription: vi.fn(),
      onOutputTranscription: vi.fn(),
      onInterrupted: vi.fn(),
      onTurnComplete: vi.fn(),
    };

    const client = new GeminiLiveClient(testSettings, callbacks);
    client.connect();
    await new Promise((resolve) => setTimeout(resolve, 10));
    mockWsInstance.triggerMessage({ setupComplete: {} });

    const jpegFrame = '/9j/4AAQSkZJRgABA...';
    client.sendVideoFrame(jpegFrame);

    expect(mockWsInstance.sentMessages.length).toBe(2);
    const videoPayload = JSON.parse(mockWsInstance.sentMessages[1]);

    // MUST use video key, NOT media_chunks
    expect(videoPayload.realtimeInput.mediaChunks).toBeUndefined();
    expect(videoPayload.realtimeInput.media_chunks).toBeUndefined();
    expect(videoPayload.realtimeInput.video).toBeDefined();
    expect(videoPayload.realtimeInput.video.mimeType).toBe('image/jpeg');
    expect(videoPayload.realtimeInput.video.data).toBe(jpegFrame);
  });

  it('uses clientContent with turnComplete when sending typed user prompts', async () => {
    const callbacks = {
      onConnectionChange: vi.fn(),
      onAudioChunk: vi.fn(),
      onInputTranscription: vi.fn(),
      onOutputTranscription: vi.fn(),
      onInterrupted: vi.fn(),
      onTurnComplete: vi.fn(),
    };

    const client = new GeminiLiveClient(testSettings, callbacks);
    client.connect();
    await new Promise((resolve) => setTimeout(resolve, 10));
    mockWsInstance.triggerMessage({ setupComplete: {} });

    client.sendText('Explain the function on screen');

    expect(mockWsInstance.sentMessages.length).toBe(2);
    const textPayload = JSON.parse(mockWsInstance.sentMessages[1]);

    expect(textPayload.clientContent).toBeDefined();
    expect(textPayload.clientContent.turnComplete).toBe(true);
    expect(textPayload.clientContent.turns).toHaveLength(1);
    expect(textPayload.clientContent.turns[0].role).toBe('user');
    expect(textPayload.clientContent.turns[0].parts[0].text).toBe('Explain the function on screen');
  });

  it('sends realtimeInput.audioStreamEnd when pausing or muting audio stream', async () => {
    const callbacks = {
      onConnectionChange: vi.fn(),
      onAudioChunk: vi.fn(),
      onInputTranscription: vi.fn(),
      onOutputTranscription: vi.fn(),
      onInterrupted: vi.fn(),
      onTurnComplete: vi.fn(),
    };

    const client = new GeminiLiveClient(testSettings, callbacks);
    client.connect();
    await new Promise((resolve) => setTimeout(resolve, 10));
    mockWsInstance.triggerMessage({ setupComplete: {} });

    client.sendAudioStreamEnd();

    expect(mockWsInstance.sentMessages.length).toBe(2);
    const payload = JSON.parse(mockWsInstance.sentMessages[1]);
    expect(payload.realtimeInput.audioStreamEnd).toBe(true);
  });

  it('handles server transcription and interruption events correctly', async () => {
    const callbacks = {
      onConnectionChange: vi.fn(),
      onAudioChunk: vi.fn(),
      onInputTranscription: vi.fn(),
      onOutputTranscription: vi.fn(),
      onInterrupted: vi.fn(),
      onTurnComplete: vi.fn(),
    };

    const client = new GeminiLiveClient(testSettings, callbacks);
    client.connect();
    await new Promise((resolve) => setTimeout(resolve, 10));
    mockWsInstance.triggerMessage({ setupComplete: {} });

    // Server sends user speech transcript
    mockWsInstance.triggerMessage({
      serverContent: {
        inputTranscription: { text: 'How do I debug line 12?' },
      },
    });
    expect(callbacks.onInputTranscription).toHaveBeenCalledWith('How do I debug line 12?');

    // Server sends AI audio chunk and transcript
    mockWsInstance.triggerMessage({
      serverContent: {
        modelTurn: {
          parts: [
            {
              inlineData: {
                mimeType: 'audio/pcm;rate=24000',
                data: 'PCM24KCHUNK',
              },
            },
          ],
        },
        outputTranscription: { text: 'You can check the return value.' },
      },
    });
    expect(callbacks.onAudioChunk).toHaveBeenCalledWith('PCM24KCHUNK');
    expect(callbacks.onOutputTranscription).toHaveBeenCalledWith('You can check the return value.');

    // Server sends interruption signal
    mockWsInstance.triggerMessage({
      serverContent: {
        interrupted: true,
      },
    });
    expect(callbacks.onInterrupted).toHaveBeenCalled();
  });

  it('handles incoming toolCall for google_search, invokes search grounding, and replies with toolResponse', async () => {
    const mockSearchResponse = {
      candidates: [
        {
          content: { parts: [{ text: 'The current temperature in Paris is 18°C.' }] },
          groundingMetadata: {
            groundingChunks: [{ web: { title: 'Meteo Paris', uri: 'https://parisweather.com' } }],
          },
        },
      ],
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockSearchResponse,
    });
    globalThis.fetch = fetchMock;

    const callbacks = {
      onConnectionChange: vi.fn(),
      onAudioChunk: vi.fn(),
      onInputTranscription: vi.fn(),
      onOutputTranscription: vi.fn(),
      onInterrupted: vi.fn(),
      onTurnComplete: vi.fn(),
      onSearchStatus: vi.fn(),
    };

    const client = new GeminiLiveClient(
      { ...testSettings, enableGoogleSearch: true },
      callbacks
    );
    client.connect();
    await new Promise((resolve) => setTimeout(resolve, 10));
    mockWsInstance.triggerMessage({ setupComplete: {} });

    // Server sends toolCall for google_search
    mockWsInstance.triggerMessage({
      toolCall: {
        functionCalls: [
          {
            id: 'call_paris_weather',
            name: 'google_search',
            args: { query: 'Paris weather today' },
          },
        ],
      },
    });

    // Wait for search-grounding async execution
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Verify search status callbacks
    expect(callbacks.onSearchStatus).toHaveBeenCalledWith('searching', { query: 'Paris weather today' });
    expect(callbacks.onSearchStatus).toHaveBeenCalledWith('grounded', {
      query: 'Paris weather today',
      sources: [{ title: 'Meteo Paris', uri: 'https://parisweather.com' }],
    });

    // Verify toolResponse was sent back over WebSocket
    const lastSent = JSON.parse(mockWsInstance.sentMessages[mockWsInstance.sentMessages.length - 1]);
    expect(lastSent.toolResponse).toBeDefined();
    expect(lastSent.toolResponse.functionResponses).toHaveLength(1);
    expect(lastSent.toolResponse.functionResponses[0].id).toBe('call_paris_weather');
    expect(lastSent.toolResponse.functionResponses[0].name).toBe('google_search');
    expect(lastSent.toolResponse.functionResponses[0].response.output).toBe(
      'The current temperature in Paris is 18°C.'
    );
  });

  it('handles quota rejection and suggests free tier rate limits', async () => {
    const callbacks = {
      onConnectionChange: vi.fn(),
      onAudioChunk: vi.fn(),
      onInputTranscription: vi.fn(),
      onOutputTranscription: vi.fn(),
      onInterrupted: vi.fn(),
      onTurnComplete: vi.fn(),
    };

    const client = new GeminiLiveClient(
      { ...testSettings, enableGoogleSearch: true },
      callbacks
    );
    client.connect();
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Simulate Google WebSocket closing with quota exceeded error reason
    mockWsInstance.close(1008, 'You exceeded your current quota, please check your plan and billing details.');

    expect(callbacks.onConnectionChange).toHaveBeenCalledWith(
      'error',
      expect.stringContaining('Quota Exceeded: You have reached your current Google Gemini rate limit')
    );
  });

  describe('isObviouslyStaticQuery - Static Knowledge Guard', () => {
    const client = new GeminiLiveClient(testSettings, {
      onConnectionChange: vi.fn(),
      onAudioChunk: vi.fn(),
      onInputTranscription: vi.fn(),
      onOutputTranscription: vi.fn(),
      onInterrupted: vi.fn(),
      onTurnComplete: vi.fn(),
    });

    it.each([
      'Who was the first president of the USA',
      'who was the first president of the united states',
      'What is the capital of France',
      "what's the capital of Japan",
      'speed of light in vacuum',
      'Explain the Pythagorean theorem',
      'What is photosynthesis',
      'Tell me about the French Revolution',
      'World War 2 timeline',
      'What is binary search',
      'explain recursion in programming',
      'What is 2 + 2',
      'calculate 15 * 7',
      'explain how does a linked list work',
      'what is democracy',
      'define osmosis',
      'Who was the 16th president',
      'ancient Rome history',
    ])('returns true for static query: "%s"', (query) => {
      expect(client.isObviouslyStaticQuery(query)).toBe(true);
    });

    it.each([
      'weather in Singapore today',
      'latest news about AI',
      'current stock price of NVIDIA',
      'Who won the NBA game last night',
      'What is the latest version of React',
      'news today',
      'current president of the United States',
      'bitcoin price right now',
      'Is it going to rain tomorrow in Tokyo',
      'how tall is the Eiffel Tower',
      'best restaurants near me',
    ])('returns false for time-sensitive or non-matching query: "%s"', (query) => {
      expect(client.isObviouslyStaticQuery(query)).toBe(false);
    });
  });

  it('handles static queries by executing fast direct synthesis with skipWebFetch and returning factual output to prevent agent hangs', async () => {
    const mockSearchResponse = {
      candidates: [
        {
          content: { parts: [{ text: 'George Washington was the first president of the United States.' }] },
          groundingMetadata: { groundingChunks: [] },
        },
      ],
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockSearchResponse,
    });
    globalThis.fetch = fetchMock;

    const callbacks = {
      onConnectionChange: vi.fn(),
      onAudioChunk: vi.fn(),
      onInputTranscription: vi.fn(),
      onOutputTranscription: vi.fn(),
      onInterrupted: vi.fn(),
      onTurnComplete: vi.fn(),
      onSearchStatus: vi.fn(),
    };

    const client = new GeminiLiveClient(
      { ...testSettings, enableGoogleSearch: true },
      callbacks
    );
    client.connect();
    await new Promise((resolve) => setTimeout(resolve, 10));
    mockWsInstance.triggerMessage({ setupComplete: {} });

    // Server sends toolCall for a static/historical query
    mockWsInstance.triggerMessage({
      toolCall: {
        functionCalls: [
          {
            id: 'call_static_history',
            name: 'google_search',
            args: { query: 'Who was the first president of the USA' },
          },
        ],
      },
    });

    // Wait for async handling
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Flash Lite was called directly
    expect(fetchMock).toHaveBeenCalled();

    // Verify search status callbacks
    expect(callbacks.onSearchStatus).toHaveBeenCalledWith('searching', {
      query: 'Who was the first president of the USA',
    });
    expect(callbacks.onSearchStatus).toHaveBeenCalledWith('grounded', {
      query: 'Who was the first president of the USA',
      sources: expect.any(Array),
    });

    // Verify toolResponse was sent back with factual answer (preventing Live agent hang)
    const lastSent = JSON.parse(mockWsInstance.sentMessages[mockWsInstance.sentMessages.length - 1]);
    expect(lastSent.toolResponse).toBeDefined();
    expect(lastSent.toolResponse.functionResponses[0].response.output).toBe(
      'George Washington was the first president of the United States.'
    );
  });

  describe('Session Resumption, GoAway, and Auto-Reconnect', () => {
    it('stores session resumption handle and includes it in next setup', async () => {
      const callbacks = {
        onConnectionChange: vi.fn(),
        onAudioChunk: vi.fn(),
        onInputTranscription: vi.fn(),
        onOutputTranscription: vi.fn(),
        onInterrupted: vi.fn(),
        onTurnComplete: vi.fn(),
      };

      const client = new GeminiLiveClient(testSettings, callbacks);
      client.connect();
      await new Promise((resolve) => setTimeout(resolve, 10));
      mockWsInstance.triggerMessage({ setupComplete: {} });

      // Server sends session resumption update with token
      mockWsInstance.triggerMessage({
        sessionResumptionUpdate: {
          resumable: true,
          newHandle: 'test_token_handle_999',
        },
      });

      expect(client.getResumptionHandle()).toBe('test_token_handle_999');
    });

    it('handles GoAway message by initiating proactive reconnection', async () => {
      const callbacks = {
        onConnectionChange: vi.fn(),
        onAudioChunk: vi.fn(),
        onInputTranscription: vi.fn(),
        onOutputTranscription: vi.fn(),
        onInterrupted: vi.fn(),
        onTurnComplete: vi.fn(),
      };

      const client = new GeminiLiveClient(testSettings, callbacks);
      client.connect();
      await new Promise((resolve) => setTimeout(resolve, 10));
      mockWsInstance.triggerMessage({ setupComplete: {} });

      // Server sends GoAway warning
      mockWsInstance.triggerMessage({
        goAway: {
          timeLeft: '15s',
        },
      });

      expect(callbacks.onConnectionChange).toHaveBeenCalledWith(
        'reconnecting',
        expect.stringContaining('Session expired. Reconnecting (1/3)...')
      );
      expect(client.getReconnectAttempts()).toBe(1);

      // Clean up timer by disconnecting
      client.disconnect();
    });

    it('distinguishes code 1008 session expiration from auth errors and attempts reconnection', async () => {
      const callbacks = {
        onConnectionChange: vi.fn(),
        onAudioChunk: vi.fn(),
        onInputTranscription: vi.fn(),
        onOutputTranscription: vi.fn(),
        onInterrupted: vi.fn(),
        onTurnComplete: vi.fn(),
      };

      const client = new GeminiLiveClient(testSettings, callbacks);
      client.connect();
      await new Promise((resolve) => setTimeout(resolve, 10));
      mockWsInstance.triggerMessage({ setupComplete: {} });

      // Server terminates session at ~10 minutes with code 1008 and non-auth reason
      mockWsInstance.close(1008, 'Session duration exceeded');

      // Must NOT be treated as "Invalid API key" error!
      expect(callbacks.onConnectionChange).not.toHaveBeenCalledWith(
        'error',
        'Invalid API key or unauthorized access.'
      );
      expect(callbacks.onConnectionChange).toHaveBeenCalledWith(
        'reconnecting',
        expect.stringContaining('Session expired. Reconnecting (1/3)...')
      );

      client.disconnect();
    });

    it('correctly reports error when close reason explicitly specifies API key / auth failure', async () => {
      const callbacks = {
        onConnectionChange: vi.fn(),
        onAudioChunk: vi.fn(),
        onInputTranscription: vi.fn(),
        onOutputTranscription: vi.fn(),
        onInterrupted: vi.fn(),
        onTurnComplete: vi.fn(),
      };

      const client = new GeminiLiveClient(testSettings, callbacks);
      client.connect();
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Simulate genuine auth error from server
      mockWsInstance.close(1008, 'API key not valid. Please pass a valid API key.');

      expect(callbacks.onConnectionChange).toHaveBeenCalledWith(
        'error',
        'Invalid API key or unauthorized access.'
      );
    });

    it('does not auto-reconnect when user explicitly calls disconnect()', async () => {
      const callbacks = {
        onConnectionChange: vi.fn(),
        onAudioChunk: vi.fn(),
        onInputTranscription: vi.fn(),
        onOutputTranscription: vi.fn(),
        onInterrupted: vi.fn(),
        onTurnComplete: vi.fn(),
      };

      const client = new GeminiLiveClient(testSettings, callbacks);
      client.connect();
      await new Promise((resolve) => setTimeout(resolve, 10));
      mockWsInstance.triggerMessage({ setupComplete: {} });

      client.disconnect();

      expect(callbacks.onConnectionChange).toHaveBeenCalledWith('disconnected');
      expect(client.getReconnectAttempts()).toBe(0);
      expect(client.getIsConnected()).toBe(false);
    });

    it('stops reconnecting and reports error when max reconnect attempts reached', async () => {
      vi.useFakeTimers();
      try {
        const callbacks = {
          onConnectionChange: vi.fn(),
          onAudioChunk: vi.fn(),
          onInputTranscription: vi.fn(),
          onOutputTranscription: vi.fn(),
          onInterrupted: vi.fn(),
          onTurnComplete: vi.fn(),
        };

        const client = new GeminiLiveClient(testSettings, callbacks);
        client.connect();
        await vi.advanceTimersByTimeAsync(10);

        // Attempt 1: socket drops
        mockWsInstance.close(1006, 'Connection lost 1');
        expect(client.getReconnectAttempts()).toBe(1);

        // Advance past delay (1000ms) to trigger reconnect()
        await vi.advanceTimersByTimeAsync(1100);

        // Attempt 2: new socket drops
        mockWsInstance.close(1006, 'Connection lost 2');
        expect(client.getReconnectAttempts()).toBe(2);

        // Advance past delay (2000ms) to trigger reconnect()
        await vi.advanceTimersByTimeAsync(2100);

        // Attempt 3: new socket drops
        mockWsInstance.close(1006, 'Connection lost 3');
        expect(client.getReconnectAttempts()).toBe(3);

        // Advance past delay (4000ms) to trigger reconnect()
        await vi.advanceTimersByTimeAsync(4100);

        // Attempt 4: fails because max attempts (3) is reached
        mockWsInstance.close(1006, 'Connection lost 4');

        expect(callbacks.onConnectionChange).toHaveBeenCalledWith(
          'error',
          'Session expired and reconnection failed. Please reconnect manually.'
        );
        expect(client.getReconnectAttempts()).toBe(0);

        client.disconnect();
      } finally {
        vi.useRealTimers();
      }
    });
  });
});

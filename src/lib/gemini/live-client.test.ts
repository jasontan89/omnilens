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

  it('uses realtimeInput.text when sending typed user prompts', async () => {
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

    expect(textPayload.realtimeInput.text).toBe('Explain the function on screen');
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
});

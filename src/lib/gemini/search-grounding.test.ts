import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { performGroundedSearch } from './search-grounding';

describe('search-grounding (Direct Gemini 3.1 & 3.5 Flash Lite with Live Web Context)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('throws an error if API key is missing or blank', async () => {
    await expect(performGroundedSearch('weather in Tokyo', '')).rejects.toThrow(
      'API key is required to perform grounded Google search.'
    );
    await expect(performGroundedSearch('weather in Tokyo', '   ')).rejects.toThrow(
      'API key is required to perform grounded Google search.'
    );
  });

  it('queries Gemini 3.1 Flash Lite with real-world date and live web context', async () => {
    const mockApiResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: 'Tokyo is currently sunny with a temperature of 22°C.',
              },
            ],
          },
        },
      ],
    };

    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (typeof url === 'string' && url.includes('open-meteo.com')) {
        return {
          ok: true,
          json: async () => ({
            results: [{ name: 'Tokyo', country: 'Japan', latitude: 35.68, longitude: 139.69 }],
            current_weather: { temperature: 22, windspeed: 5, winddirection: 10 },
          }),
        };
      }
      return {
        ok: true,
        json: async () => mockApiResponse,
      };
    });

    globalThis.fetch = fetchMock;

    const result = await performGroundedSearch('weather in Tokyo', 'test-key-123');

    // Find Gemini API call
    const geminiCall = fetchMock.mock.calls.find((c) =>
      (c[0] as string).includes('googleapis.com')
    );
    expect(geminiCall).toBeDefined();

    const [requestUrl, requestOptions] = geminiCall!;
    expect(requestUrl).toContain('models/gemini-3.1-flash-lite-preview:generateContent');
    expect(requestUrl).toContain('key=test-key-123');

    const body = JSON.parse(requestOptions.body as string);
    // Tools must be undefined so free-tier keys never trigger 429 RESOURCE_EXHAUSTED
    expect(body.tools).toBeUndefined();
    // Prompt must include current date anchor and user query
    expect(body.contents[0].parts[0].text).toContain('Current real-world date');
    expect(body.contents[0].parts[0].text).toContain('weather in Tokyo');

    // Verify parsed output
    expect(result.query).toBe('weather in Tokyo');
    expect(result.text).toBe('Tokyo is currently sunny with a temperature of 22°C.');
    expect(result.modelUsed).toBe('gemini-3.1-flash-lite-preview');
    expect(result.sources.length).toBeGreaterThan(0);
  });

  it('falls back to Gemini 3.5 Flash Lite if 3.1 Flash Lite preview returns 404', async () => {
    const mockApiResponse = {
      candidates: [
        {
          content: {
            parts: [{ text: 'Google DeepMind announced new research.' }],
          },
        },
      ],
    };

    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (typeof url === 'string' && url.includes('wikipedia.org')) {
        return {
          ok: true,
          json: async () => ({
            query: { search: [{ title: 'DeepMind', snippet: 'AI research lab' }] },
          }),
        };
      }
      if (typeof url === 'string' && url.includes('gemini-3.1-flash-lite-preview')) {
        return {
          ok: false,
          status: 404,
          text: async () => 'Model not found in preview',
        };
      }
      return {
        ok: true,
        json: async () => mockApiResponse,
      };
    });

    globalThis.fetch = fetchMock;

    const result = await performGroundedSearch('DeepMind news', 'test-key-456');

    const geminiCalls = fetchMock.mock.calls.filter((c) =>
      (c[0] as string).includes('googleapis.com')
    );
    expect(geminiCalls.length).toBe(2);

    // Call 1: gemini-3.1-flash-lite-preview (returned 404)
    expect(geminiCalls[0][0]).toContain('gemini-3.1-flash-lite-preview');

    // Call 2: fallback to gemini-3.5-flash-lite
    expect(geminiCalls[1][0]).toContain('gemini-3.5-flash-lite');

    expect(result.text).toBe('Google DeepMind announced new research.');
    expect(result.modelUsed).toBe('gemini-3.5-flash-lite');
  });

  it('strictly ensures NO Gemini 2.x models are ever called', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (typeof url === 'string' && url.includes('wikipedia.org')) {
        return { ok: true, json: async () => ({ query: { search: [] } }) };
      }
      return {
        ok: true,
        json: async () => ({ candidates: [{ content: { parts: [{ text: 'Answer' }] } }] }),
      };
    });
    globalThis.fetch = fetchMock;

    await performGroundedSearch('test query', 'test-key');

    const geminiCalls = fetchMock.mock.calls.filter((c) =>
      (c[0] as string).includes('googleapis.com')
    );
    for (const call of geminiCalls) {
      const url = call[0] as string;
      expect(url).not.toContain('gemini-2.0');
      expect(url).not.toContain('gemini-2.5');
      expect(url).toMatch(/gemini-3/);
    }
  });

  it('handles network error across all models gracefully by throwing', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (typeof url === 'string' && url.includes('wikipedia.org')) {
        return { ok: true, json: async () => ({ query: { search: [] } }) };
      }
      return {
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      };
    });
    globalThis.fetch = fetchMock;

    await expect(performGroundedSearch('test query', 'test-key')).rejects.toThrow(
      'Search request failed (500)'
    );
  });
});

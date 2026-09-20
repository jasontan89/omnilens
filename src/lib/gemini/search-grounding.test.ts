import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { performGroundedSearch } from './search-grounding';

describe('search-grounding (Gemini 3.1 & 3.5 Flash Lite)', () => {
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

  it('successfully queries Gemini 3.1 Flash Lite with Google Search grounding tool', async () => {
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
          groundingMetadata: {
            webSearchQueries: ['weather in Tokyo today'],
            groundingChunks: [
              {
                web: {
                  title: 'Tokyo Weather Report',
                  uri: 'https://weather.example.com/tokyo',
                },
              },
            ],
          },
        },
      ],
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse,
    });
    globalThis.fetch = fetchMock;

    const result = await performGroundedSearch('weather in Tokyo', 'test-key-123');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [requestUrl, requestOptions] = fetchMock.mock.calls[0];

    // Verify it uses Gemini 3.1 Flash Lite model
    expect(requestUrl).toContain('models/gemini-3.1-flash-lite-preview:generateContent');
    expect(requestUrl).toContain('key=test-key-123');

    const body = JSON.parse(requestOptions.body as string);
    expect(body.tools).toEqual([{ googleSearch: {} }]);
    expect(body.contents[0].parts[0].text).toContain('weather in Tokyo');

    // Verify parsed output
    expect(result.query).toBe('weather in Tokyo');
    expect(result.text).toBe('Tokyo is currently sunny with a temperature of 22°C.');
    expect(result.modelUsed).toBe('gemini-3.1-flash-lite-preview');
    expect(result.sources).toEqual([
      {
        title: 'Tokyo Weather Report',
        uri: 'https://weather.example.com/tokyo',
      },
    ]);
    expect(result.searchQueries).toEqual(['weather in Tokyo today']);
  });

  it('falls back to Gemini 3.5 Flash Lite if 3.1 Flash Lite preview returns 404', async () => {
    const mockApiResponse = {
      candidates: [
        {
          content: {
            parts: [{ text: 'Google DeepMind announced new research.' }],
          },
          groundingMetadata: {
            groundingChunks: [
              {
                web: {
                  title: 'DeepMind Research',
                  uri: 'https://deepmind.google/news',
                },
              },
            ],
          },
        },
      ],
    };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'Model not found in preview',
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponse,
      });

    globalThis.fetch = fetchMock;

    const result = await performGroundedSearch('DeepMind news', 'test-key-456');

    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Call 1: gemini-3.1-flash-lite-preview (returned 404)
    expect(fetchMock.mock.calls[0][0]).toContain('gemini-3.1-flash-lite-preview');

    // Call 2: fallback to gemini-3.5-flash-lite
    expect(fetchMock.mock.calls[1][0]).toContain('gemini-3.5-flash-lite');

    expect(result.text).toBe('Google DeepMind announced new research.');
    expect(result.modelUsed).toBe('gemini-3.5-flash-lite');
    expect(result.sources[0].uri).toBe('https://deepmind.google/news');
  });

  it('strictly ensures NO Gemini 2.x models are ever called', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: 'Answer' }] } }] }),
    });
    globalThis.fetch = fetchMock;

    await performGroundedSearch('test query', 'test-key');

    for (const call of fetchMock.mock.calls) {
      const url = call[0] as string;
      expect(url).not.toContain('gemini-2.0');
      expect(url).not.toContain('gemini-2.5');
      expect(url).toMatch(/gemini-3/);
    }
  });

  it('gracefully falls back to web-grounded synthesis when googleSearch tool hits 429 quota exhausted', async () => {
    const fetchMock = vi
      .fn()
      // Call 1: Native googleSearch call returns 429 RESOURCE_EXHAUSTED
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => 'RESOURCE_EXHAUSTED: You exceeded your current quota',
      })
      // Call 2: Wikipedia snippet search API call
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          query: {
            search: [
              {
                title: 'Sundar Pichai',
                snippet: 'Sundar Pichai is the chief executive officer of Alphabet and Google.',
              },
            ],
          },
        }),
      })
      // Call 3: Gemini 3.1 Flash Lite synthesis without googleSearch tool
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: 'Sundar Pichai is the CEO of Alphabet Inc. and its subsidiary Google.',
                  },
                ],
              },
            },
          ],
        }),
      });

    globalThis.fetch = fetchMock;

    const result = await performGroundedSearch('who is the CEO of Google', 'test-key-789');

    expect(fetchMock).toHaveBeenCalledTimes(3);

    // Call 1: Native search with googleSearch tool
    const [call1Url, call1Opts] = fetchMock.mock.calls[0];
    expect(call1Url).toContain('gemini-3.1-flash-lite-preview');
    expect(JSON.parse(call1Opts.body as string).tools).toBeDefined();

    // Call 2: Wikipedia query
    const [call2Url] = fetchMock.mock.calls[1];
    expect(call2Url).toContain('en.wikipedia.org/w/api.php');
    expect(call2Url).toContain('origin=*');

    // Call 3: Gemini 3.1 Flash Lite synthesis WITHOUT tools
    const [call3Url, call3Opts] = fetchMock.mock.calls[2];
    expect(call3Url).toContain('gemini-3.1-flash-lite-preview');
    const call3Body = JSON.parse(call3Opts.body as string);
    expect(call3Body.tools).toBeUndefined();
    expect(call3Body.contents[0].parts[0].text).toContain('Sundar Pichai');

    // Verification of result
    expect(result.text).toBe('Sundar Pichai is the CEO of Alphabet Inc. and its subsidiary Google.');
    expect(result.sources).toEqual([
      {
        title: 'Sundar Pichai',
        uri: 'https://en.wikipedia.org/wiki/Sundar_Pichai',
      },
    ]);
    expect(result.modelUsed).toContain('free-tier grounded');
  });

  it('synthesizes with Gemini 3 knowledge base even if Wikipedia returns no results on 429', async () => {
    const fetchMock = vi
      .fn()
      // Call 1: 429 quota error
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => 'Quota exhausted',
      })
      // Call 2: Wikipedia returns empty results
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          query: { search: [] },
        }),
      })
      // Call 3: Gemini 3.1 Flash Lite generates factual answer
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: 'Photosynthesis is the process by which green plants synthesize nutrients from sunlight.',
                  },
                ],
              },
            },
          ],
        }),
      });

    globalThis.fetch = fetchMock;

    const result = await performGroundedSearch('photosynthesis definition', 'test-key-abc');

    expect(result.text).toContain('Photosynthesis');
    expect(result.sources[0].title).toContain('Gemini 3');
    expect(result.sources[0].uri).toContain('ai.google.dev');
  });
});

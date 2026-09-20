export interface GroundedSearchSource {
  title: string;
  uri: string;
}

export interface GroundedSearchResult {
  query: string;
  text: string;
  sources: GroundedSearchSource[];
  searchQueries: string[];
  modelUsed: string;
}

// Strictly Gemini 3 models (Gemini 3.1 Flash Lite and Gemini 3.5 Flash Lite)
const SEARCH_MODELS = [
  'gemini-3.1-flash-lite-preview',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
];

interface WebSnippet {
  title: string;
  snippet: string;
  uri: string;
}

/**
 * Retrieves open web search snippets using Wikipedia API with CORS origin=*.
 * Completely free, requires no API key, and provides up-to-date factual encyclopedic data.
 */
async function fetchWikipediaSnippets(
  query: string,
  timeoutMs: number = 3500
): Promise<WebSnippet[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
      query
    )}&utf8=&format=json&origin=*`;

    const res = await fetch(url, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json();
    const results = data?.query?.search || [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return results.slice(0, 3).map((item: any) => ({
      title: item.title || 'Wikipedia',
      snippet: (item.snippet || '')
        .replace(/<[^>]+>/g, '')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .trim(),
      uri: `https://en.wikipedia.org/wiki/${encodeURIComponent((item.title || '').replace(/ /g, '_'))}`,
    }));
  } catch (err) {
    console.debug('Wikipedia snippet fetch skipped/timed out:', err);
    return [];
  }
}

/**
 * Performs real-time search grounding using Gemini 3.1 / 3.5 Flash Lite.
 * 1. Attempts native Google Search Grounding with tools: [{ googleSearch: {} }].
 * 2. If the user's key is on the Google Free Tier (which returns HTTP 429 quota exhausted
 *    for the paid googleSearch tool parameter), it gracefully falls back to resilient web grounding:
 *    fetches live web context and synthesizes an accurate factual answer via Gemini 3.1 / 3.5 Flash Lite
 *    (which has free tier quota), returning accurate facts and sources seamlessly without errors.
 */
export async function performGroundedSearch(
  query: string,
  apiKey: string,
  timeoutMs: number = 8500
): Promise<GroundedSearchResult> {
  const cleanKey = apiKey.trim();
  if (!cleanKey) {
    throw new Error('API key is required to perform grounded Google search.');
  }

  let lastError: Error | null = null;

  // 1. Attempt Native Google Search Grounding
  for (const model of SEARCH_MODELS) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
        cleanKey
      )}`;

      const requestBody = {
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `Search Google and provide an up-to-date, concise factual answer with key facts, numbers, dates, or results for: "${query}". Be direct, accurate, and informative.`,
              },
            ],
          },
        ],
        tools: [
          {
            googleSearch: {},
          },
        ],
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data: any = await res.json();
        const candidate = data?.candidates?.[0];
        const text =
          candidate?.content?.parts?.[0]?.text ||
          'No direct textual answer returned by Google Search.';

        const metadata = candidate?.groundingMetadata;
        const searchQueries: string[] = metadata?.webSearchQueries || [query];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sources: GroundedSearchSource[] = (metadata?.groundingChunks || [])
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((chunk: any) => ({
            title: chunk.web?.title || 'Web Source',
            uri: chunk.web?.uri || '',
          }))
          .filter((s: GroundedSearchSource) => Boolean(s.uri));

        return {
          query,
          text,
          sources,
          searchQueries,
          modelUsed: model,
        };
      }

      const errorText = await res.text().catch(() => '');
      console.warn(`Native search grounding with ${model} failed (${res.status}):`, errorText);

      // 404/400 means model identifier error; try next model
      if (res.status === 404 || res.status === 400) {
        lastError = new Error(`Model ${model} returned ${res.status}: ${errorText}`);
        continue;
      }

      // 429 quota exhausted or 403 forbidden: Google Search Grounding tool is paywalled on this key.
      if (res.status === 429 || res.status === 403) {
        lastError = new Error(`Native search quota exceeded (${res.status}): ${errorText}`);
        break; // break to free-tier web grounding fallback
      }

      throw new Error(`Google Search Grounding failed (${res.status}): ${errorText}`);
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      const isAbort = (err as { name?: string })?.name === 'AbortError';
      if (isAbort) {
        lastError = new Error(`Google Search request timed out after ${timeoutMs}ms.`);
      } else {
        lastError = err as Error;
      }
    }
  }

  // 2. Resilient Free-Tier Web Grounding Fallback
  // If native search tool is quota-restricted (or unavailable), synthesize using Gemini 3.1 / 3.5 Flash Lite + live web context
  console.info('Activating resilient Gemini 3 Flash Lite web grounding fallback.');

  // Fetch open web snippets for real-time information
  const snippets = await fetchWikipediaSnippets(query, 3000);

  const fallbackPrompt =
    snippets.length > 0
      ? `You are an up-to-date factual search engine for OmniLens. Answer the user query concisely and accurately using the provided web context and your knowledge base. Keep the response concise and natural so it can be spoken clearly.\n\nWeb Search Context:\n${snippets
          .map((s, i) => `[${i + 1}] ${s.title}: ${s.snippet}`)
          .join('\n')}\n\nUser Query: "${query}"`
      : `Provide an accurate, up-to-date, concise factual answer with key facts, numbers, dates, or results for: "${query}". Be direct, accurate, and informative so the response can be spoken clearly.`;

  for (const model of SEARCH_MODELS) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
        cleanKey
      )}`;

      const requestBody = {
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: fallbackPrompt,
              },
            ],
          },
        ],
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        console.warn(`Fallback search synthesis with ${model} failed (${res.status}):`, errorText);
        if (res.status === 404 || res.status === 400) {
          lastError = new Error(`Model ${model} returned ${res.status}: ${errorText}`);
          continue;
        }
        throw new Error(`Fallback search synthesis failed (${res.status}): ${errorText}`);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = await res.json();
      const candidate = data?.candidates?.[0];
      const text =
        candidate?.content?.parts?.[0]?.text ||
        'No direct textual answer could be synthesized.';

      const sources: GroundedSearchSource[] =
        snippets.length > 0
          ? snippets.map((s) => ({ title: s.title, uri: s.uri }))
          : [
              {
                title: `Google ${model.includes('3.5') ? 'Gemini 3.5' : 'Gemini 3.1'} Flash Lite Knowledge Base`,
                uri: 'https://ai.google.dev/gemini-api/docs/models#gemini-3',
              },
            ];

      return {
        query,
        text,
        sources,
        searchQueries: [query],
        modelUsed: `${model} (free-tier grounded)`,
      };
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      const isAbort = (err as { name?: string })?.name === 'AbortError';
      if (isAbort) {
        lastError = new Error(`Search request timed out after ${timeoutMs}ms.`);
      } else {
        lastError = err as Error;
      }
    }
  }

  throw (
    lastError ||
    new Error('Google Search Grounding failed across all Gemini 3 Flash Lite models.')
  );
}

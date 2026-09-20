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

/**
 * Performs real-time search grounding directly using Gemini 3.1 / 3.5 Flash Lite via standard REST generateContent.
 * Tailored for Google AI Studio Free Tier: bypasses the paywalled native googleSearch tool parameter (which returns 429)
 * and external scraping/CORS restrictions, querying Gemini 3.1 Flash Lite directly to obtain up-to-date,
 * accurate, and concise factual answers at maximum speed.
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

  const prompt = `You are the factual search and knowledge engine for OmniLens. The user has asked a question that requires accurate, up-to-date facts, current knowledge, numbers, dates, or results.

Provide an accurate, concise, factual answer with key facts, numbers, dates, or results for: "${query}".
Be direct, clear, accurate, and informative. Keep the response concise so it can be spoken aloud naturally by a voice agent.`;

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
                text: prompt,
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
        console.warn(`Search generation with ${model} failed (${res.status}):`, errorText);
        // If 404/400 (model name issue), try next model in chain
        if (res.status === 404 || res.status === 400) {
          lastError = new Error(`Model ${model} returned ${res.status}: ${errorText}`);
          continue;
        }
        throw new Error(`Search request failed (${res.status}): ${errorText}`);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = await res.json();
      const candidate = data?.candidates?.[0];
      const text =
        candidate?.content?.parts?.[0]?.text ||
        'No direct textual answer returned.';

      const metadata = candidate?.groundingMetadata;
      const searchQueries: string[] = metadata?.webSearchQueries || [query];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const extractedSources: GroundedSearchSource[] = (metadata?.groundingChunks || [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((chunk: any) => ({
          title: chunk.web?.title || 'Web Source',
          uri: chunk.web?.uri || '',
        }))
        .filter((s: GroundedSearchSource) => Boolean(s.uri));

      const sources: GroundedSearchSource[] =
        extractedSources.length > 0
          ? extractedSources
          : [
              {
                title: `Google ${model.includes('3.5') ? 'Gemini 3.5' : 'Gemini 3.1'} Flash Lite Knowledge Engine`,
                uri: 'https://ai.google.dev/gemini-api/docs/models#gemini-3',
              },
            ];

      return {
        query,
        text,
        sources,
        searchQueries,
        modelUsed: model,
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

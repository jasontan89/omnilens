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

export interface GroundedSearchOptions {
  braveApiKey?: string;
  timeoutMs?: number;
}

// Strictly Gemini 3 models (Gemini 3.1 Flash Lite and Gemini 3.5 Flash Lite)
const SEARCH_MODELS = [
  'gemini-3.1-flash-lite-preview',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
];

export interface WebSnippet {
  title: string;
  snippet: string;
  uri: string;
}

/**
 * Fetches real-time live search snippets from Brave Search API.
 * Free tier provides 2,000 queries/month with no credit card required.
 * Handles Vite dev proxy, direct endpoint, and CORS proxy fallbacks.
 */
export async function fetchBraveSearchSnippets(
  query: string,
  apiKey: string,
  timeoutMs: number = 4500
): Promise<WebSnippet[]> {
  const cleanKey = apiKey.trim();
  if (!cleanKey) return [];

  const endpoints = [
    // 1. Vercel Serverless / Edge Function & Vite dev proxy endpoint
    `/api/brave?q=${encodeURIComponent(query)}&count=5`,
    // 2. Full path proxy endpoint
    `/api/brave/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`,
    // 3. Direct Brave API endpoint (in environments where CORS allows or SSR/backend)
    `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`,
    // 4. Transparent CORS proxy fallback for client-side static PWA deployments
    `https://corsproxy.io/?url=${encodeURIComponent(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`
    )}`,
  ];

  for (const endpoint of endpoints) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(endpoint, {
        headers: {
          Accept: 'application/json',
          'X-Subscription-Token': cleanKey,
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        continue;
      }

      // Safeguard against HTML responses (e.g. index.html SPA fallbacks)
      const contentType = res.headers?.get?.('content-type') || '';
      if (contentType.includes('text/html')) {
        continue;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = await res.json();
      const webResults = data?.web?.results || [];
      const newsResults = data?.news?.results || [];
      const combined = [...webResults, ...newsResults];

      if (combined.length === 0) continue;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const snippets: WebSnippet[] = combined.slice(0, 5).map((item: any) => ({
        title: item.title || 'Web Search Result',
        snippet: (item.description || '').replace(/<[^>]+>/g, '').trim(),
        uri: item.url || '',
      }));

      return snippets.filter((s) => Boolean(s.snippet && s.uri));
    } catch {
      clearTimeout(timeoutId);
    }
  }

  return [];
}

/**
 * Fetches real-time live meteorological data using Open-Meteo for weather/temperature queries.
 * 100% free, requires no API key, and provides accurate current temperature and conditions worldwide.
 */
async function fetchLiveWeatherSnippet(query: string): Promise<WebSnippet | null> {
  const isWeather = /\b(weather|temperature|forecast|rain|snow|degrees|sunny|cloudy|wind)\b/i.test(
    query
  );
  if (!isWeather) return null;

  const match =
    query.match(/(?:in|at|for)\s+([a-zA-Z\s]+)/i) ||
    query.match(/([a-zA-Z\s]+)\s+(?:weather|temperature|forecast)/i);
  const city = match
    ? match[1].trim().replace(/\b(today|now|tomorrow|right now|currently)\b/gi, '').trim()
    : null;
  if (!city || city.length < 2) return null;

  try {
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      city
    )}&count=1&language=en&format=json`;
    const geoRes = await fetch(geoUrl);
    if (!geoRes.ok) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const geoData: any = await geoRes.json();
    const loc = geoData.results?.[0];
    if (!loc) return null;

    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current_weather=true`;
    const wRes = await fetch(weatherUrl);
    if (!wRes.ok) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wData: any = await wRes.json();
    const cw = wData.current_weather;
    if (!cw) return null;

    const tempC = cw.temperature;
    const tempF = ((tempC * 9) / 5 + 32).toFixed(1);
    return {
      title: `${loc.name}, ${loc.country || ''} Live Weather (Open-Meteo)`,
      snippet: `Current verified conditions in ${loc.name}: temperature is ${tempC}°C (${tempF}°F), windspeed ${cw.windspeed} km/h, wind direction ${cw.winddirection}°.`,
      uri: 'https://open-meteo.com',
    };
  } catch {
    return null;
  }
}

/**
 * Retrieves up-to-date live encyclopedic information from Wikipedia using full intro extracts.
 * Searching for the most relevant article and fetching its lead section ensures real-world accuracy
 * without needing an API key.
 */
async function fetchLiveWikiExtract(
  query: string,
  timeoutMs: number = 3500
): Promise<WebSnippet | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    // 1. Search Wikipedia for best match
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
      query
    )}&utf8=&format=json&origin=*`;

    const searchRes = await fetch(searchUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!searchRes.ok) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const searchData: any = await searchRes.json();
    const hits = searchData?.query?.search || [];
    if (hits.length === 0) return null;

    const topHit = hits[0];
    const topTitle = topHit.title;

    // 2. Fetch full introductory extract of the matched page
    const extractController = new AbortController();
    const extractTimeout = setTimeout(() => extractController.abort(), 2500);

    const extractUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&titles=${encodeURIComponent(
      topTitle
    )}&format=json&origin=*`;

    const extractRes = await fetch(extractUrl, { signal: extractController.signal });
    clearTimeout(extractTimeout);

    if (!extractRes.ok) {
      return {
        title: topTitle,
        snippet: (topHit.snippet || '').replace(/<[^>]+>/g, '').trim(),
        uri: `https://en.wikipedia.org/wiki/${encodeURIComponent(topTitle.replace(/ /g, '_'))}`,
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const extractData: any = await extractRes.json();
    const pages = extractData?.query?.pages || {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const page: any = Object.values(pages)[0];
    const extract = page?.extract || (topHit.snippet || '').replace(/<[^>]+>/g, '');

    return {
      title: topTitle,
      snippet: extract.slice(0, 1500).trim(),
      uri: `https://en.wikipedia.org/wiki/${encodeURIComponent(topTitle.replace(/ /g, '_'))}`,
    };
  } catch {
    return null;
  }
}

/**
 * Performs real-time search grounding using Gemini 3.1 / 3.5 Flash Lite backed by live web data.
 * Fixes outdated pre-training hallucination by:
 * 1. Searching Brave Search API for live web snippets (if Brave API key provided).
 * 2. Falling back to Open-Meteo or Wikipedia lead extracts when no key is entered.
 * 3. Synthesizing an accurate, spoken-ready answer using Gemini 3.1 Flash Lite anchored to the current date.
 */
export async function performGroundedSearch(
  query: string,
  apiKey: string,
  options?: GroundedSearchOptions | number
): Promise<GroundedSearchResult> {
  const cleanKey = apiKey.trim();
  if (!cleanKey) {
    throw new Error('API key is required to perform grounded Google search.');
  }

  const braveApiKey = typeof options === 'object' ? options?.braveApiKey : undefined;
  const timeoutMs =
    typeof options === 'number'
      ? options
      : typeof options === 'object' && options?.timeoutMs
        ? options.timeoutMs
        : 8500;

  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const currentYear = new Date().getFullYear();

  // 1. Fetch live web snippets (Brave Search > Weather > Wikipedia)
  let snippets: WebSnippet[] = [];

  if (braveApiKey && braveApiKey.trim()) {
    try {
      snippets = await fetchBraveSearchSnippets(query, braveApiKey);
    } catch {
      // Fall through to zero-key web snippets
    }
  }

  // If no Brave snippets retrieved, fall back to Open-Meteo & Wikipedia
  if (snippets.length === 0) {
    try {
      const weatherSnippet = await fetchLiveWeatherSnippet(query);
      if (weatherSnippet) {
        snippets.push(weatherSnippet);
      }
    } catch {
      // Ignore weather failure
    }
  }

  if (snippets.length === 0) {
    try {
      const wikiSnippet = await fetchLiveWikiExtract(query, 3500);
      if (wikiSnippet) {
        snippets.push(wikiSnippet);
      }
    } catch {
      // Ignore wiki failure
    }
  }

  const liveContextStr =
    snippets.length > 0
      ? `Live Web Context:\n` +
        snippets
          .map((s, idx) => `[Source ${idx + 1}: ${s.title}] (${s.uri})\n${s.snippet}`)
          .join('\n\n') +
        '\n\n'
      : '';

  const prompt = `Current real-world date: ${currentDate}. Current year: ${currentYear}.
You are the factual search grounding engine for OmniLens. The user has asked a question that requires accurate, up-to-date facts, current knowledge, numbers, dates, or results.

User query: "${query}"

${liveContextStr}Using the live web context and the current real-world date (${currentDate}), provide an up-to-date, accurate, concise, and factual answer.
Ensure your response reflects the current reality as of ${currentDate} (NOT outdated pre-training data).
Keep the response direct and concise so it can be spoken aloud naturally by a voice agent.`;

  let lastError: Error | null = null;

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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const metadataChunks: GroundedSearchSource[] = (candidate?.groundingMetadata?.groundingChunks || [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((chunk: any) => ({
          title: chunk.web?.title || 'Web Source',
          uri: chunk.web?.uri || '',
        }))
        .filter((s: GroundedSearchSource) => Boolean(s.uri));

      const sources: GroundedSearchSource[] =
        snippets.length > 0
          ? snippets.map((s) => ({ title: s.title, uri: s.uri }))
          : metadataChunks.length > 0
            ? metadataChunks
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
        searchQueries: [query],
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
    new Error('Search Grounding failed across all Gemini 3 Flash Lite models.')
  );
}

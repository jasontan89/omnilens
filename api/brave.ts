export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      },
    });
  }

  const url = new URL(req.url);
  const q = url.searchParams.get('q');
  const count = url.searchParams.get('count') || '5';
  const apiKey =
    req.headers.get('x-subscription-token') ||
    req.headers.get('X-Subscription-Token') ||
    url.searchParams.get('key');

  if (!q) {
    return new Response(JSON.stringify({ error: 'Missing query parameter "q"' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Missing Brave Search API key' }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  try {
    const braveUrl = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(
      q
    )}&count=${encodeURIComponent(count)}`;

    const braveRes = await fetch(braveUrl, {
      headers: {
        Accept: 'application/json',
        'X-Subscription-Token': apiKey,
      },
    });

    const data = await braveRes.text();

    return new Response(data, {
      status: braveRes.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
      },
    });
  } catch (err: unknown) {
    const message = (err as Error)?.message || 'Failed to fetch from Brave Search API';
    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}

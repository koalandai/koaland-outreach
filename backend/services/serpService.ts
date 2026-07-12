export interface SerpResult {
  hotelName: string;
  website: string;
  snippet: string;
  source: string;
  title: string;
  position: number;
}

export interface SerpSearchResponse {
  results: SerpResult[];
  query: string;
  total: number;
}

async function searchViaSerpApi(query: string, location: string, maxResults: number): Promise<SerpResult[]> {
  const apiKey = process.env.SERP_API_KEY;
  if (!apiKey) throw new Error('SERP_API_KEY not configured');

  const params = new URLSearchParams({
    q: query,
    location: location || '',
    api_key: apiKey,
    num: String(Math.min(maxResults, 20)),
    hl: 'en',
  });

  const response = await fetch(`https://serpapi.com/search?${params}`, {
    signal: AbortSignal.timeout(20000),
  });

  if (!response.ok) throw new Error(`SerpApi error: ${response.status}`);

  const data = await response.json() as any;
  const organicResults = data.organic_results || [];

  return organicResults.map((r: any, i: number) => ({
    hotelName: extractHotelName(r.title || ''),
    website: r.link || '',
    snippet: r.snippet || '',
    source: r.link || '',
    title: r.title || '',
    position: i + 1,
  }));
}

async function searchViaValueSerp(query: string, location: string, maxResults: number): Promise<SerpResult[]> {
  const apiKey = process.env.SERP_API_KEY;
  if (!apiKey) throw new Error('SERP_API_KEY not configured');

  const params = new URLSearchParams({
    q: query,
    location: location || '',
    api_key: apiKey,
    num: String(Math.min(maxResults, 20)),
  });

  const response = await fetch(`https://api.valueserp.com/search?${params}`, {
    signal: AbortSignal.timeout(20000),
  });

  if (!response.ok) throw new Error(`ValueSerp error: ${response.status}`);

  const data = await response.json() as any;
  const results = data.organic_results || [];

  return results.map((r: any, i: number) => ({
    hotelName: extractHotelName(r.title || ''),
    website: r.link || '',
    snippet: r.snippet || '',
    source: r.link || '',
    title: r.title || '',
    position: i + 1,
  }));
}

async function searchViaSerper(query: string, location: string, maxResults: number): Promise<SerpResult[]> {
  const apiKey = process.env.SERP_API_KEY;
  if (!apiKey) throw new Error('SERP_API_KEY not configured');

  const response = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ q: query, gl: 'us', num: Math.min(maxResults, 20) }),
    signal: AbortSignal.timeout(20000),
  });

  if (!response.ok) throw new Error(`Serper error: ${response.status}`);

  const data = await response.json() as any;
  const results = data.organic || [];

  return results.map((r: any, i: number) => ({
    hotelName: extractHotelName(r.title || ''),
    website: r.link || '',
    snippet: r.snippet || '',
    source: r.link || '',
    title: r.title || '',
    position: i + 1,
  }));
}

function extractHotelName(title: string): string {
  // Try to extract hotel name from SERP title (often "Hotel Name | Official Site" or "Hotel Name - 5 Star...")
  return title
    .split('|')[0]
    .split(' - ')[0]
    .split('-')[0]
    .replace(/official site/i, '')
    .trim();
}

function isLikelyHotel(result: SerpResult): boolean {
  const hotelKeywords = ['hotel', 'resort', 'boutique', 'villa', 'retreat', 'lodge', 'inn', 'suites', 'palace', 'manor', 'castle', 'pension', 'B&B', 'guest'];
  const text = `${result.title} ${result.snippet} ${result.website}`.toLowerCase();
  return hotelKeywords.some(kw => text.includes(kw));
}

function isOtaOrAggregator(url: string): boolean {
  const otas = ['booking.com', 'expedia.com', 'tripadvisor.com', 'hotels.com', 'airbnb.com', 'agoda.com', 'kayak.com', 'trivago', 'google.com/travel'];
  return otas.some(ota => url.toLowerCase().includes(ota));
}

export async function searchProspects(
  query: string,
  location: string,
  maxResults: number
): Promise<SerpSearchResponse> {
  const provider = process.env.SERP_PROVIDER || 'serpapi';

  let rawResults: SerpResult[];
  try {
    if (provider === 'valueserp') {
      rawResults = await searchViaValueSerp(query, location, maxResults * 2);
    } else if (provider === 'serper') {
      rawResults = await searchViaSerper(query, location, maxResults * 2);
    } else {
      rawResults = await searchViaSerpApi(query, location, maxResults * 2);
    }
  } catch (err: any) {
    throw new Error(`SERP search failed: ${err.message}`);
  }

  // Filter to likely hotels and exclude OTAs
  const filtered = rawResults
    .filter(r => !isOtaOrAggregator(r.website) && r.website)
    .filter(r => isLikelyHotel(r))
    .slice(0, maxResults);

  return {
    results: filtered,
    query,
    total: filtered.length,
  };
}

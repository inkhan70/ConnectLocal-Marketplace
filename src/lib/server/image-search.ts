export type ImageProvider = 'pexels' | 'pixabay';

export interface ImageSearchResult {
  id: string;
  previewUrl: string;
  imageUrl: string;
  width: number;
  height: number;
  alt: string;
  creatorName: string;
  creatorUrl?: string;
  sourceUrl: string;
  provider: ImageProvider;
  attribution: string;
}

export interface ImageSearchResponse {
  provider: ImageProvider;
  results: ImageSearchResult[];
  page: number;
  perPage: number;
  totalResults?: number;
  configured: boolean;
  message?: string;
}

const cache = new Map<string, { expiresAt: number; value: ImageSearchResponse }>();
const requests = new Map<string, { count: number; resetAt: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000;
const MAX_RESULTS = 24;

export function getConfiguredProvider(): { provider: ImageProvider; key: string | undefined } {
  const requested = process.env.IMAGE_SEARCH_PROVIDER?.toLowerCase();
  const pexels = process.env.PEXELS_API_KEY;
  const pixabay = process.env.PIXABAY_API_KEY;
  if ((requested === 'pixabay' || !requested) && pixabay) return { provider: 'pixabay', key: pixabay };
  if (requested !== 'pixabay' && pexels) return { provider: 'pexels', key: pexels };
  if (pixabay) return { provider: 'pixabay', key: pixabay };
  return { provider: requested === 'pixabay' ? 'pixabay' : 'pexels', key: undefined };
}

function clean(value: unknown, max: number) {
  return String(value || '').replace(/[<>]/g, '').trim().slice(0, max);
}

function limited(key: string) {
  const now = Date.now();
  const current = requests.get(key);
  if (!current || current.resetAt <= now) {
    requests.set(key, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  current.count += 1;
  return current.count > 30;
}

export async function searchImages(query: string, page = 1, perPage = 24, callerKey = 'anonymous'): Promise<ImageSearchResponse> {
  const q = clean(query, 100);
  const safePage = Math.max(1, Math.min(100, Math.floor(page)));
  const safePerPage = Math.max(1, Math.min(MAX_RESULTS, Math.floor(perPage)));
  const { provider, key } = getConfiguredProvider();
  if (!key) return { provider, results: [], page: safePage, perPage: safePerPage, configured: false, message: `External image search is not configured. Add ${provider === 'pexels' ? 'PEXELS_API_KEY' : 'PIXABAY_API_KEY'} on the server.` };
  if (limited(callerKey)) throw Object.assign(new Error('Image provider rate limit reached. Try again shortly.'), { status: 429 });
  const cacheKey = `${provider}:${q.toLowerCase()}:${safePage}:${safePerPage}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    let response: Response;
    let value: ImageSearchResponse;
    if (provider === 'pexels') {
      response = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&page=${safePage}&per_page=${safePerPage}`, { headers: { Authorization: key }, signal: controller.signal, next: { revalidate: 86400 } });
      if (response.status === 429) throw Object.assign(new Error('Image provider rate limit reached. Try again shortly.'), { status: 429 });
      if (!response.ok) throw new Error('The image provider is temporarily unavailable.');
      const data = await response.json();
      value = { provider, results: (data.photos || []).map((photo: any) => ({ id: String(photo.id), previewUrl: photo.src?.medium || photo.src?.small, imageUrl: photo.src?.large2x || photo.src?.large, width: photo.width, height: photo.height, alt: clean(photo.alt || q, 160), creatorName: clean(photo.photographer, 100), creatorUrl: photo.photographer_url, sourceUrl: photo.url, provider, attribution: `Photo by ${clean(photo.photographer, 100)} on Pexels` })), page: safePage, perPage: safePerPage, totalResults: data.total_results, configured: true };
    } else {
      response = await fetch(`https://pixabay.com/api/?key=${encodeURIComponent(key)}&q=${encodeURIComponent(q)}&page=${safePage}&per_page=${safePerPage}&image_type=photo&safesearch=true`, { signal: controller.signal, next: { revalidate: 86400 } });
      if (response.status === 429) throw Object.assign(new Error('Image provider rate limit reached. Try again shortly.'), { status: 429 });
      if (!response.ok) throw new Error('The image provider is temporarily unavailable.');
      const data = await response.json();
      value = { provider, results: (data.hits || []).map((hit: any) => ({ id: String(hit.id), previewUrl: hit.webformatURL, imageUrl: hit.largeImageURL || hit.webformatURL, width: hit.imageWidth, height: hit.imageHeight, alt: clean(hit.tags || q, 160), creatorName: clean(hit.user, 100), sourceUrl: hit.pageURL, provider, attribution: `Image by ${clean(hit.user, 100)} on Pixabay` })), page: safePage, perPage: safePerPage, totalResults: data.totalHits, configured: true };
    }
    cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL, value });
    return value;
  } finally { clearTimeout(timeout); }
}

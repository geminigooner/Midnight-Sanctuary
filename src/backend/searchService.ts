export interface SearchResultItem {
  title: string;
  link: string;
  snippet: string;
  displayLink?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
}

export interface SearchResponse {
  query: string;
  searchType?: 'web' | 'image';
  items: SearchResultItem[];
  error?: string;
}

export interface WebSearchOptions {
  searchType?: 'web' | 'image';
  num?: number;
}

/**
 * Executes a search query using Google Programmable / Custom Search JSON API.
 * Supports both general web search (`searchType: 'web'`) and photo/image search (`searchType: 'image'`)
 * so Sovereign Companion Entities can find photos for their PFP, quarters wall art, or visual references.
 */
export async function performWebSearch(
  query: string,
  options?: WebSearchOptions
): Promise<SearchResponse> {
  const searchType = options?.searchType === 'image' ? 'image' : 'web';
  const num = Math.min(Math.max(options?.num || 5, 1), 10);

  const apiKey =
    process.env.GOOGLE_SEARCH_API_KEY ||
    process.env.GENAI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.PRO_API_KEY ||
    process.env.GEMINI_LEGACY_API_KEY;
  const cx = process.env.GOOGLE_SEARCH_CX || 'e3faff4cc4d8743af';

  if (!apiKey) {
    return {
      query,
      searchType,
      items: [],
      error:
        'Google Search API key is not configured in the environment (set GOOGLE_SEARCH_API_KEY or GEMINI_API_KEY).',
    };
  }

  const executeQuery = async (mode: 'web' | 'image'): Promise<Response> => {
    const url = new URL('https://www.googleapis.com/customsearch/v1');
    url.searchParams.set('key', apiKey);
    url.searchParams.set('cx', cx);
    url.searchParams.set('q', query);
    url.searchParams.set('num', String(num));
    if (mode === 'image') {
      url.searchParams.set('searchType', 'image');
    }
    return fetch(url.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });
  };

  try {
    let res = await executeQuery(searchType);
    let effectiveMode: 'web' | 'image' = searchType;

    // If Programmable Search engine does not have `searchType=image` toggled on in CSE settings,
    // gracefully fall back to standard search and extract rich pagemap image URLs (`cse_image` / `og:image`).
    if (!res.ok && searchType === 'image') {
      res = await executeQuery('web');
      effectiveMode = 'web';
    }

    if (!res.ok) {
      const errText = await res.text();
      let parsedErr = errText;
      try {
        const jsonErr = JSON.parse(errText);
        parsedErr = jsonErr?.error?.message || errText;
      } catch {
        // use raw text
      }
      return {
        query,
        searchType,
        items: [],
        error: `Search API error (${res.status}): ${parsedErr}`,
      };
    }

    const data = await res.json();
    const rawItems = data?.items || [];
    const items: SearchResultItem[] = rawItems.map((item: any) => {
      const pagemapImage =
        item.pagemap?.cse_image?.[0]?.src ||
        item.pagemap?.metatags?.[0]?.['og:image'] ||
        item.pagemap?.metatags?.[0]?.['twitter:image'] ||
        undefined;
      const pagemapThumb =
        item.image?.thumbnailLink ||
        item.pagemap?.cse_thumbnail?.[0]?.src ||
        pagemapImage;

      const directImageUrl =
        effectiveMode === 'image'
          ? item.link || pagemapImage
          : pagemapImage ||
            (/\.(jpg|jpeg|png|webp|gif|svg)(\?.*)?$/i.test(item.link || '')
              ? item.link
              : undefined);

      return {
        title: item.title || 'Untitled',
        link: item.link || '',
        snippet: item.snippet || item.image?.contextLink || '',
        displayLink: item.displayLink || '',
        imageUrl: directImageUrl,
        thumbnailUrl: pagemapThumb,
      };
    });

    return {
      query,
      searchType,
      items,
    };
  } catch (err: any) {
    return {
      query,
      searchType,
      items: [],
      error: err?.message || 'Failed to execute web search query',
    };
  }
}

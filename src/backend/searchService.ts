export interface SearchResultItem {
  title: string;
  link: string;
  snippet: string;
  displayLink?: string;
}

export interface SearchResponse {
  query: string;
  items: SearchResultItem[];
  error?: string;
}

/**
 * Executes a search query using Google Programmable / Custom Search JSON API.
 */
export async function performWebSearch(query: string): Promise<SearchResponse> {
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY || process.env.GENAI_API_KEY || process.env.GEMINI_API_KEY;
  const cx = process.env.GOOGLE_SEARCH_CX || 'e3faff4cc4d8743af';

  if (!apiKey) {
    return {
      query,
      items: [],
      error: 'Google Search API key is not configured in the environment (set GOOGLE_SEARCH_API_KEY or GEMINI_API_KEY).',
    };
  }

  try {
    const url = new URL('https://www.googleapis.com/customsearch/v1');
    url.searchParams.set('key', apiKey);
    url.searchParams.set('cx', cx);
    url.searchParams.set('q', query);
    url.searchParams.set('num', '5');

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

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
        items: [],
        error: `Search API error (${res.status}): ${parsedErr}`,
      };
    }

    const data = await res.json();
    const rawItems = data?.items || [];
    const items: SearchResultItem[] = rawItems.map((item: any) => ({
      title: item.title || 'Untitled',
      link: item.link || '',
      snippet: item.snippet || '',
      displayLink: item.displayLink || '',
    }));

    return {
      query,
      items,
    };
  } catch (err: any) {
    return {
      query,
      items: [],
      error: err?.message || 'Failed to execute web search query',
    };
  }
}

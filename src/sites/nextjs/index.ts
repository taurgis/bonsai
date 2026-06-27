import type { SiteModule, SiteSearchResult } from '../types.js';
import { postJson } from '../../lib/research/fetcher.js';

export const nextjs: SiteModule = {
  id: 'nextjs',
  name: 'Next.js',
  domains: ['nextjs.org'],
  search: async (query: string): Promise<SiteSearchResult[]> => {
    const url = 'https://nextjs.org/api/search';
    const bodyStr = await postJson(url, { query, version: 'stable', routerType: 'app' }, {});

    let data;
    try {
      // The Next.js API returns a JSON array sometimes or a JSON object with 'hits'
      const parsed = JSON.parse(bodyStr);
      if (Array.isArray(parsed)) {
        data = parsed;
      } else if (parsed && Array.isArray(parsed.hits)) {
        data = parsed.hits;
      } else {
        throw new Error('Unexpected response format from Next.js search');
      }
    } catch (err: any) {
      throw new Error(`Failed to parse Next.js search response: ${err.message}`);
    }

    const queryLower = query.toLowerCase();

    return data.map((item: any) => {
      const content = item.content || '';
      let snippet = content;

      const idx = content.toLowerCase().indexOf(queryLower);
      if (idx !== -1) {
        const start = Math.max(0, idx - 40);
        const end = Math.min(content.length, idx + 110);
        snippet = content.slice(start, end);
        if (start > 0) snippet = '...' + snippet;
        if (end < content.length) snippet = snippet + '...';
      } else {
        snippet = content.slice(0, 150);
      }

      // Clean up whitespace and newlines so it looks like a snippet and not a raw script
      snippet = snippet.replace(/\s+/g, ' ').trim();

      return {
        url: `https://nextjs.org${item.path}${item.anchor ? `#${item.anchor}` : ''}`,
        title: item.title ? `${item.pageTitle} - ${item.title}` : item.pageTitle || 'Untitled',
        snippet,
      };
    });
  },
};

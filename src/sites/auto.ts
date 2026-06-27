import type { SiteModule } from './types.js';
import { runRemoteDocsSearch } from '../lib/research/docs/remote-search-runner.js';
import { fetchStaticHtml, fetchText, postJson } from '../lib/research/fetcher.js';

export function createAutoSite(
  id: string,
  name: string,
  domains: string[],
  docsUrl: string
): SiteModule {
  return {
    id,
    name,
    domains,
    search: async (query: string) => {
      const deps = {
        fetchStatic: async (url: string) => {
          const res = await fetchStaticHtml(url);
          return { content: res.content, finalUrl: res.finalUrl };
        },
        fetchText: async (url: string) => {
          const res = await fetchText(url);
          return { content: res.content, status: res.status };
        },
        postJson: (url: string, body: any, headers?: Record<string, string>) =>
          postJson(url, body, headers),
      };

      const { results } = await runRemoteDocsSearch(docsUrl, query, deps);
      return results;
    },
  };
}

export const angular = createAutoSite('angular', 'Angular', ['angular.dev'], 'https://angular.dev');
export const redux = createAutoSite('redux', 'Redux', ['redux.js.org'], 'https://redux.js.org');
export const vite = createAutoSite('vite', 'Vite', ['vitejs.dev', 'vite.dev'], 'https://vite.dev');
export const fastify = createAutoSite(
  'fastify',
  'Fastify',
  ['fastify.dev', 'fastify.io'],
  'https://fastify.dev'
);
export const rollup = createAutoSite('rollup', 'Rollup', ['rollupjs.org'], 'https://rollupjs.org');
export const vueuse = createAutoSite('vueuse', 'VueUse', ['vueuse.org'], 'https://vueuse.org');

import type { SiteModule } from './types.js';
import { algoliaQueryUrl, parseAlgoliaResponse } from '../lib/research/docs/remote-search.js';
import { postJson } from '../lib/research/fetcher.js';

export function createAlgoliaSite(
  id: string,
  name: string,
  domains: string[],
  appId: string,
  apiKey: string,
  indexName: string
): SiteModule {
  return {
    id,
    name,
    domains,
    search: async (query: string) => {
      const url = algoliaQueryUrl({ appId, apiKey, indexName });
      const bodyParams = { params: `query=${encodeURIComponent(query)}&hitsPerPage=20` };
      const res = await postJson(url, bodyParams, {
        'Content-Type': 'application/json',
        'X-Algolia-API-Key': apiKey,
        'X-Algolia-Application-Id': appId,
      });
      return parseAlgoliaResponse(res, url);
    },
  };
}

export const react = createAlgoliaSite(
  'react',
  'React',
  ['react.dev', 'legacy.reactjs.org'],
  '1FCF9AYYAT',
  '1b7ad4e1c89e645e351e59d40544eda1',
  'beta-react'
);
export const vue = createAlgoliaSite(
  'vue',
  'Vue.js',
  ['vuejs.org'],
  'ML0LEBN7FQ',
  '10e7a8b13e6aec4007343338ab134e05',
  'vuejs'
);
export const tailwind = createAlgoliaSite(
  'tailwind',
  'Tailwind CSS',
  ['tailwindcss.com'],
  'KNPXZI5B0M',
  '5fc87cef58bb80203d2207578309fab6',
  'tailwindcss'
);

export const jest = createAlgoliaSite(
  'jest',
  'Jest',
  ['jestjs.io'],
  'HP439UUSOL',
  'e5e670fd16f8f17caada79d6b0931682',
  'jest-v2'
);
export const cypress = createAlgoliaSite(
  'cypress',
  'Cypress',
  ['docs.cypress.io', 'cypress.io'],
  'R9KDA5FMJB',
  'b4af59e23bc2fa05281af7dcf13fcae5',
  'cypress_docs'
);
export const vitest = createAlgoliaSite(
  'vitest',
  'Vitest',
  ['vitest.dev'],
  'ZTF29HGJ69',
  '9c3ced6fed60d2670bb36ab7e8bed8bc',
  'vitest'
);
export const vitepress = createAlgoliaSite(
  'vitepress',
  'VitePress',
  ['vitepress.dev'],
  '8J64VVRP8K',
  '52f578a92b88ad6abde815aae2b0ad7c',
  'vitepress'
);

import { defineConfig } from 'vitepress';

// Deployed as a GitHub Pages project site at https://taurgis.github.io/bonsai/,
// so `base` must be the repo name with leading + trailing slashes.
// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: 'Bonsai',
  description:
    'A local research cache CLI for AI agents. Fetch docs once, prune them to fit a token budget, and reuse the cache instead of re-scraping.',
  lang: 'en-US',
  base: '/bonsai/',
  cleanUrls: true,
  lastUpdated: false,

  head: [
    // Favicon path includes `base` because `head` entries are not rewritten.
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/bonsai/favicon.svg' }],
    ['meta', { name: 'theme-color', content: '#18794e' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'Bonsai — research cache for AI agents' }],
    [
      'meta',
      {
        property: 'og:description',
        content:
          'Fetch docs once, prune them to fit a token budget, and reuse the cache instead of re-scraping.',
      },
    ],
  ],

  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/introduction', activeMatch: '/guide/' },
      { text: 'Reference', link: '/reference/commands', activeMatch: '/reference/' },
      { text: 'Troubleshooting', link: '/troubleshooting' },
    ],

    sidebar: [
      {
        text: 'Guide',
        collapsed: false,
        items: [
          { text: 'Introduction', link: '/guide/introduction' },
          { text: 'Getting Started', link: '/guide/getting-started' },
          { text: 'Caching & Freshness', link: '/guide/caching-and-freshness' },
          { text: 'Compression & Token Budgeting', link: '/guide/compression' },
          { text: 'Storage Modes', link: '/guide/storage-modes' },
          { text: 'Agent Integration', link: '/guide/agent-integration' },
        ],
      },
      {
        text: 'Reference',
        collapsed: false,
        items: [
          { text: 'Command Reference', link: '/reference/commands' },
          { text: 'Configuration', link: '/reference/configuration' },
          { text: 'Cache Protocol', link: '/reference/cache-protocol' },
        ],
      },
      {
        text: 'Help',
        collapsed: false,
        items: [{ text: 'Troubleshooting & Limits', link: '/troubleshooting' }],
      },
    ],

    socialLinks: [{ icon: 'github', link: 'https://github.com/taurgis/bonsai' }],

    // Built-in, dependency-free full-text search.
    // https://vitepress.dev/reference/default-theme-search
    search: { provider: 'local' },

    editLink: {
      pattern: 'https://github.com/taurgis/bonsai/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },

    footer: {
      message: 'Pruned and shaped with care.',
      copyright: 'Copyright © 2026 · @taurgis/bonsai',
    },
  },
});

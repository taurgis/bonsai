import { defineConfig } from 'vitepress';
import type { HeadConfig, PageData } from 'vitepress';

type PageMetadata = {
  title: string;
  description: string;
  keywords: string[];
};

const siteUrl = 'https://taurgis.github.io/bonsai/';
const siteName = 'Bonsai Docs';
const productName = 'Bonsai';
const defaultKeywords = [
  'Bonsai CLI',
  'AI agent research',
  'documentation cache',
  'local research cache',
  'context engineering',
  'technical documentation',
];

const pageMetadata: Record<string, PageMetadata> = {
  'index.md': {
    title: 'Bonsai Documentation',
    description:
      'Bonsai is a local research cache CLI for AI agents that captures docs once, compresses them for token budgets, and reuses source-cited Markdown.',
    keywords: ['AI documentation workflow', 'research cache CLI', 'source-cited Markdown'],
  },
  'guide/introduction.md': {
    title: 'Introduction to Bonsai',
    description:
      'Learn how Bonsai turns official documentation and web pages into reusable, deterministic, source-cited Markdown artifacts for AI agents.',
    keywords: ['Bonsai introduction', 'AI agent docs', 'deterministic research'],
  },
  'guide/getting-started.md': {
    title: 'Getting Started with Bonsai',
    description:
      'Run Bonsai from an empty cache, fetch a documentation page, inspect the stored artifact, and search cached research from the command line.',
    keywords: ['Bonsai getting started', 'npx @taurgis/bonsai', 'CLI tutorial'],
  },
  'concepts/caching-and-freshness.md': {
    title: 'Caching and Freshness',
    description:
      'Understand Bonsai cache keys, freshness tiers, stale revalidation, TTLs, and the storage rules that keep docs research reusable.',
    keywords: ['cache freshness', 'TTL revalidation', 'documentation cache keys'],
  },
  'concepts/compression.md': {
    title: 'Compression and Token Budgeting',
    description:
      'See how Bonsai creates compressed and detailed Markdown variants so agents can fit complete technical docs into constrained context windows.',
    keywords: ['token budgeting', 'Markdown compression', 'AI context window'],
  },
  'concepts/storage-modes.md': {
    title: 'Storage Modes',
    description:
      'Compare Bonsai global and project storage modes, including lookup fallback, committed team caches, and secret-safe routing.',
    keywords: ['Bonsai storage', 'project cache', 'oclif data directory'],
  },
  'concepts/vs-memory.md': {
    title: 'Bonsai vs Agent Memory',
    description:
      'Compare Bonsai with agent memory and learn why source-cited, freshness-aware documentation cache artifacts solve a different problem.',
    keywords: ['agent memory', 'documentation cache', 'fresh research'],
  },
  'how-to/share-cache-with-your-team.md': {
    title: 'Share a Bonsai Cache with Your Team',
    description:
      'Configure project storage, commit shared research artifacts, and let teammates or CI reuse the same captured documentation cache.',
    keywords: ['shared research cache', 'team documentation cache', 'project storage'],
  },
  'how-to/cache-pages-you-cant-fetch.md': {
    title: "Cache Pages Bonsai Can't Fetch",
    description:
      'Import authenticated, blocked, localhost, or JavaScript-rendered pages into Bonsai when automatic static fetching is not enough.',
    keywords: ['manual import', 'browser-rendered docs', 'authenticated documentation'],
  },
  'how-to/search.md': {
    title: 'Search Cached Research',
    description:
      'Use Bonsai search to find cached research by keyword, topic, tag, freshness, and remote documentation search before fetching again.',
    keywords: ['bonsai search', 'cached docs search', 'remote docs discovery'],
  },
  'how-to/importing-synthesis.md': {
    title: 'Import Synthesized Research',
    description:
      'Import manually synthesized notes, multi-source research, and durable metadata into Bonsai while preserving searchable cache artifacts.',
    keywords: ['import research notes', 'multi-source synthesis', 'research metadata'],
  },
  'how-to/agent-integration.md': {
    title: 'Agent Integration',
    description:
      'Drive Bonsai from coding agents with cache-first lookup, deterministic JSON output, status checks, and source-cited documentation retrieval.',
    keywords: ['agent integration', 'JSON CLI output', 'cache-first research'],
  },
  'how-to/agent-kit.md': {
    title: 'Install the Bonsai Agent Kit',
    description:
      'Install Bonsai agent instructions, skills, and subagents so AI coding tools research official docs through a reusable local cache.',
    keywords: ['agent kit', 'Claude Code skills', 'GitHub Copilot instructions'],
  },
  'reference/commands.md': {
    title: 'Bonsai Command Reference',
    description:
      'Reference every Bonsai command, positional argument, flag, JSON output envelope, and configuration command for agent-safe CLI use.',
    keywords: ['Bonsai commands', 'CLI reference', 'JSON output schema'],
  },
  'reference/configuration.md': {
    title: 'Bonsai Configuration',
    description:
      'Configure Bonsai storage and summary behavior with flags, environment variables, project config, user config, and built-in defaults.',
    keywords: ['Bonsai config', 'BONSAI_STORAGE', 'BONSAI_SUMMARY'],
  },
  'reference/cache-protocol.md': {
    title: 'Cache Protocol Specification',
    description:
      'Review the Bonsai cache file format, YAML frontmatter fields, freshness lifecycle, revalidation behavior, and artifact metadata schema.',
    keywords: ['cache protocol', 'YAML frontmatter', 'artifact schema'],
  },
  'reference/site-modules.md': {
    title: 'Site Modules Reference',
    description:
      'Learn how Bonsai site modules match documentation hosts, discover source URLs, extract page content, and preserve provenance metadata.',
    keywords: ['site modules', 'documentation extraction', 'source discovery'],
  },
  'reference/glossary.md': {
    title: 'Bonsai Glossary',
    description:
      'Definitions for Bonsai cache artifacts, freshness states, capture methods, storage modes, and documentation research workflow terms.',
    keywords: ['Bonsai glossary', 'freshness states', 'capture methods'],
  },
  'examples.md': {
    title: 'Agent Web Fetch vs Bonsai',
    description:
      'Compare built-in agent web fetch behavior with Bonsai on real documentation pages, including token counts and missing-content analysis.',
    keywords: ['agent web fetch comparison', 'documentation benchmark', 'token counts'],
  },
  'troubleshooting.md': {
    title: 'Troubleshooting and Limits',
    description:
      'Diagnose Bonsai fetch failures, network limits, SSRF protection, redirects, oversized responses, browser rendering, and cache issues.',
    keywords: ['Bonsai troubleshooting', 'fetch limits', 'SSRF protection'],
  },
};

function canonicalUrl(relativePath: string): string {
  const route = relativePath.replace(/(^|\/)index\.md$/, '$1').replace(/\.md$/, '');
  return new URL(route, siteUrl).href;
}

function metadataForPage(pageData: PageData): PageMetadata {
  return (
    pageMetadata[pageData.relativePath] ?? {
      title: pageData.title || productName,
      description: pageData.description,
      keywords: [],
    }
  );
}

function structuredDataForPage(pageData: PageData, metadata: PageMetadata, url: string) {
  const organization = {
    '@type': 'Organization',
    name: 'Taurgis',
    url: 'https://github.com/taurgis',
  };

  const software = {
    '@type': 'SoftwareApplication',
    name: productName,
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'macOS, Linux, Windows',
    url: siteUrl,
    description:
      'A standalone local research cache CLI that turns documentation into reusable, source-cited Markdown for AI agents.',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
  };

  const page = {
    '@type': pageData.relativePath === 'index.md' ? 'WebPage' : 'TechArticle',
    '@id': `${url}#page`,
    url,
    headline: metadata.title,
    name: metadata.title,
    description: metadata.description,
    isPartOf: {
      '@type': 'WebSite',
      '@id': `${siteUrl}#website`,
      name: siteName,
      url: siteUrl,
      publisher: organization,
    },
    about: software,
    publisher: organization,
    author: organization,
    inLanguage: 'en-US',
  };

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${siteUrl}#website`,
        name: siteName,
        url: siteUrl,
        description: 'Documentation for Bonsai, a local research cache CLI for AI agents.',
        publisher: organization,
      },
      software,
      page,
    ],
  };
}

function metadataHead(pageData: PageData, metadata: PageMetadata): HeadConfig[] {
  const url = canonicalUrl(pageData.relativePath);
  const title = `${metadata.title} | ${siteName}`;
  const keywords = [...metadata.keywords, ...defaultKeywords].join(', ');

  return [
    ['link', { rel: 'canonical', href: url }],
    ['meta', { name: 'keywords', content: keywords }],
    ['meta', { name: 'application-name', content: productName }],
    [
      'meta',
      {
        property: 'og:type',
        content: pageData.relativePath === 'index.md' ? 'website' : 'article',
      },
    ],
    ['meta', { property: 'og:site_name', content: siteName }],
    ['meta', { property: 'og:locale', content: 'en_US' }],
    ['meta', { property: 'og:url', content: url }],
    ['meta', { property: 'og:title', content: title }],
    ['meta', { property: 'og:description', content: metadata.description }],
    ['meta', { name: 'twitter:card', content: 'summary' }],
    ['meta', { name: 'twitter:title', content: title }],
    ['meta', { name: 'twitter:description', content: metadata.description }],
    [
      'script',
      { type: 'application/ld+json' },
      JSON.stringify(structuredDataForPage(pageData, metadata, url)),
    ],
  ];
}

// Deployed as a GitHub Pages project site at https://taurgis.github.io/bonsai/,
// so `base` must be the repo name with leading + trailing slashes.
// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: 'Bonsai',
  titleTemplate: `:title | ${siteName}`,
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
  ],

  transformPageData(pageData) {
    const metadata = metadataForPage(pageData);
    pageData.title = metadata.title;
    pageData.description = metadata.description;
    pageData.frontmatter.description = metadata.description;
    pageData.frontmatter.head = [
      ...(pageData.frontmatter.head ?? []),
      ...metadataHead(pageData, metadata),
    ];
  },

  themeConfig: {
    // Color the trailing "ai" of "Bonsai" to signal the tool is built for AI
    // agents. siteTitle is rendered with v-html by VPNavBarTitle, so inline
    // markup is supported; the string is a static constant (no XSS surface).
    // https://vitepress.dev/reference/default-theme-nav#site-title-and-logo
    siteTitle: 'Bons<span class="brand-ai">ai</span>',

    nav: [
      {
        text: 'Guide',
        link: '/guide/introduction',
        activeMatch: '/guide/(introduction|getting-started)',
      },
      { text: 'How-to', link: '/how-to/share-cache-with-your-team', activeMatch: '/how-to/' },
      { text: 'Reference', link: '/reference/commands', activeMatch: '/reference/' },
      { text: 'Examples', link: '/examples' },
      { text: 'Troubleshooting', link: '/troubleshooting' },
    ],

    sidebar: [
      {
        text: 'Guide',
        collapsed: false,
        items: [
          { text: 'Introduction', link: '/guide/introduction' },
          { text: 'Getting Started', link: '/guide/getting-started' },
        ],
      },
      {
        text: 'Core concepts',
        collapsed: false,
        items: [
          { text: 'Caching & Freshness', link: '/concepts/caching-and-freshness' },
          { text: 'Compression & Token Budgeting', link: '/concepts/compression' },
          { text: 'Storage Modes', link: '/concepts/storage-modes' },
          { text: 'Isn’t this just memory?', link: '/concepts/vs-memory' },
        ],
      },
      {
        text: 'How-to guides',
        collapsed: false,
        items: [
          { text: 'Share your cache with a team', link: '/how-to/share-cache-with-your-team' },
          { text: 'Cache pages you can’t fetch', link: '/how-to/cache-pages-you-cant-fetch' },
          { text: 'Search your research', link: '/how-to/search' },
          { text: 'Import synthesized research', link: '/how-to/importing-synthesis' },
          { text: 'Drive Bonsai from an agent', link: '/how-to/agent-integration' },
          { text: 'Install the agent kit', link: '/how-to/agent-kit' },
        ],
      },
      {
        text: 'Reference',
        collapsed: false,
        items: [
          { text: 'Command Reference', link: '/reference/commands' },
          { text: 'Configuration', link: '/reference/configuration' },
          { text: 'Cache Protocol', link: '/reference/cache-protocol' },
          { text: 'Site Modules', link: '/reference/site-modules' },
          { text: 'Glossary', link: '/reference/glossary' },
        ],
      },
      {
        text: 'Examples',
        collapsed: false,
        items: [{ text: 'Agent fetch vs Bonsai', link: '/examples' }],
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

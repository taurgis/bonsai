# Site Selection Rationale

## Why These Sites

The Phase 2 sample targets the docs sites most likely to be used by coding agents working on web projects, while also maximizing coverage of different documentation architectures.

The 2025 Stack Overflow Developer Survey web frameworks and technologies table lists these relevant technologies among current usage by all respondents:

- Node.js: 48.7%
- React: 44.7%
- Next.js: 20.8%
- Express: 19.9%
- Angular: 18.2%
- Vue.js: 17.6%
- Svelte: 7.2%
- NestJS: 6.7%
- Astro: 4.5%

Source: https://survey.stackoverflow.co/2025/technology/#most-popular-technologies-webframe

The Stack Overflow build-tool table also lists Vite at 25.4% among all respondents and 27.2% among professional developers, which makes Vite docs an important target independent of frontend framework usage.

Source: https://survey.stackoverflow.co/2025/technology/#most-popular-technologies-tools-tech

The remaining sampled docs are included because agents frequently need them in web work and because they exercise important extraction patterns:

- MDN: canonical web platform reference.
- TypeScript: core language/tooling reference for modern web projects.
- Tailwind CSS: high-usage styling library with code-heavy docs and a Next.js App Router site.
- Prisma: common TypeScript data layer with public MDX docs and product maturity metadata.
- TanStack Query: common server-state library with rendered docs requirements.
- Redux Toolkit: Docusaurus-style state-management docs with code fidelity issues.

## Why Not Only "Top N" Usage

Parser support should be driven by the intersection of popularity and extraction shape. A less-used site that exposes Pagefind or VitePress local search can unlock generic support for many downstream sites. A very popular site that already extracts cleanly may need only source/search discovery, not a bespoke parser.

This is why Phase 2 prioritizes docs-engine capabilities first, then site modules.


# Site Modules

Most pages go through one generic pipeline: fetch the HTML, extract the main
article, convert it to Markdown, and cache it. Some documentation sites don't
cooperate. They render content client-side or hide it in shadow DOM.

**Site modules** are Bonsai's answer. A site module is a small, per-domain
plug-in that overrides just the parts of the pipeline a particular site needs
and inherits everything else. Today the only sites with custom behavior are
**Salesforce Help** and **Salesforce Developer**, but the mechanism is
domain-agnostic: any site can have one.

::: tip Where they live
Site modules ship with the CLI under `src/sites/`. They are a plain constant
array, not a runtime registry, so there is nothing to install or configure. You
add a new site by adding a module to the source and rebuilding.
:::

## How a site is matched

Every fetch starts by resolving the URL's hostname to a site module. When
nothing matches, the generic pipeline runs.

```ts
// src/sites/index.ts
export function detectSite(url: string): SiteModule | undefined {
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return undefined;
  }
  return SITES.find((site) => site.domains.includes(hostname));
}
```

Matching rules:

- **Exact hostname only.** `help.salesforce.com` matches; `docs.help.salesforce.com`
  does **not**. There is no wildcard or subdomain matching, so list every host a
  module should own in its `domains` array.
- **First match wins.** `SITES` is scanned in order, so module order decides
  precedence if two modules ever claim the same host (none do today).
- **No match is normal.** An unrecognized host returns `undefined` and falls
  straight through to the generic fetch/extract pipeline.

## The `SiteModule` interface

A module is one object. Three fields identify it; the rest are optional
capabilities. When a capability is absent, the generic pipeline fills in.

```ts
// src/sites/types.ts
export interface SiteModule {
  id: string;
  name: string;
  domains: string[];
  // Per-site fetch overrides. Only `rendered` is honored today; it ORs with the
  // user's --rendered flag, so a missing/false value is a safe default.
  defaults?: { rendered?: boolean };
  // Optional site-specific fetch. When absent, callers use the generic fetch/extract pipeline.
  fetchPage?: (url: string) => Promise<SiteFetchResult>;
}
```

| Item | Type | Required | What it does |
| --- | --- | :---: | --- |
| `id` | `string` | ✅ | Stable identifier (e.g. `salesforce`). Stored on every artifact this module produces as `site_module_id`, and used to re-find the module on revalidation. Must be unique. |
| `name` | `string` | ✅ | Human-readable label (e.g. `Salesforce Help`). |
| `domains` | `string[]` | ✅ | The exact hostnames this module owns. A module can claim several (e.g. a site plus its legacy domain). |
| `defaults.rendered` | `boolean` | — | Force browser rendering for this site. **ORs** with the user's `--rendered` flag, so `true` means "always render," and absent means "respect the flag." It is the only `defaults` key honored today. |
| `fetchPage` | `(url) => Promise<SiteFetchResult>` | — | Replaces the generic fetch **and** extraction for this site. See [Custom fetching](#capability-custom-fetching). |

### Capability: custom fetching

When a module defines `fetchPage`, it owns the whole "get the content" step for
its domain. It must return the same shape the generic pipeline produces, so the
result slots into caching unchanged:

```ts
// src/sites/types.ts
export interface SiteFetchResult {
  fetchResult: {
    contentType: string | null;
    etag: string | null;
    lastModified: string | null;
    finalUrl: string;
    responseSize: number;
    content: string;
  };
  extraction: ExtractionResult; // { title, detailedMarkdown, confidence, qualityNotes }
}
```

Because the return type matches `createArtifactFromFetch`'s input, a custom
fetcher inherits the rest of the pipeline for free: compression into
`compressed`/`detailed` variants, token estimation, auto-tagging, freshness
metadata, and caching. A module only has to solve the part that's actually hard
for its site, which is usually getting clean article HTML out of a
JavaScript-rendered page.

## Where each hook runs in the pipeline

Site modules hook into two flows. In both a module is optional; the generic path
runs when no module matches.

**1. Fetch (cache miss).** Detection happens first, then the module's overrides
apply:

```
detectSite(url)
  → useRendered = --rendered OR module.defaults.rendered
  → module.fetchPage ? module.fetchPage(url) : capturePage(url)
  → build artifact, stamp metadata.site_module_id = module.id ?? null
  → compress, tag, cache
```

```ts
// src/commands/fetch.ts (executeCacheMiss)
const siteModule = detectSite(normalizedUrl);
const useRendered = rendered || Boolean(siteModule?.defaults?.rendered);
if (siteModule?.fetchPage) {
  ({ fetchResult, extraction } = await siteModule.fetchPage(normalizedUrl));
} else {
  capture = await capturePage(normalizedUrl, { forceRendered: useRendered }, CAPTURE_DEPS);
}
// ...
artifact.metadata.site_module_id = siteModule?.id ?? null;
```

**2. Revalidation (stale refresh).** The artifact remembers which module made
it, so the refresh uses the same one:

```ts
// src/lib/research/revalidate.ts
const siteModule = meta.site_module_id ? getSiteModuleById(meta.site_module_id) : null;
if (siteModule?.fetchPage) {
  const { fetchResult, extraction } = await siteModule.fetchPage(meta.source_url);
  // ...full re-fetch via the module
} else {
  // generic conditional request (ETag / If-Modified-Since)
}
```

::: warning No conditional requests for module-fetched pages
The generic path can revalidate cheaply with `ETag`/`If-Modified-Since`. A
`fetchPage` module always does a full re-fetch on refresh: there is no
conditional shortcut for client-rendered content.
:::

## The `site_module_id` field

Every artifact records which module produced it, in its frontmatter:

```ts
// src/lib/research/schema.ts
site_module_id: string | null;
```

- It is set to the matched module's `id`, or `null` when the generic pipeline
  handled the page.
- It is preserved across revalidation, so a page captured by a module keeps
  being refreshed by that module.
- It surfaces in JSON output as `siteModuleId`, which is useful for auditing
  which strategy captured a page.
- Legacy artifacts with no such field parse as `null`, so the change is fully
  backward compatible.

## Registered sites

| `id` | Domains | Custom behavior |
| --- | --- | --- |
| `salesforce` | `help.salesforce.com` | `fetchPage`, `rendered: true`. |
| `salesforce-developer` | `developer.salesforce.com` | `fetchPage`, `rendered: true`. |
| `tanstack` | `tanstack.com` | None. Relies on the generic source-resolution path that prefers a page's GitHub Markdown source (keeping fenced code intact), so it deliberately does **not** force `rendered`. |

## The Salesforce modules in detail

Both Salesforce sites are Lightning Web Runtime (LWR) experiences: the article
text is rendered by JavaScript, so a plain HTTP GET returns an almost-empty
shell. Both therefore set `defaults.rendered: true` and ship a `fetchPage` that
drives a headless browser and extracts the real content. They are kept as
**two separate modules** because Help and Developer render their content
differently and need different extraction.

### `salesforce` — Salesforce Help

```ts
// src/sites/salesforce/index.ts
export const salesforce: SiteModule = {
  id: 'salesforce',
  name: 'Salesforce Help',
  domains: ['help.salesforce.com'],
  defaults: { rendered: true },
  fetchPage: fetchSalesforcePage,
};
```

- **`fetchPage`** renders the article, targets Help's content containers
  (e.g. `c-hc-documentation-article`, `.markdown-content`), strips Help-only
  chrome (the article-feedback widget, in-page table of contents, breadcrumbs,
  screen-reader-only text), and normalizes Coveo's internal
  `/help_doccontent?id=…` links to the canonical `/s/articleView?id=…` page.

Example URLs it owns:

```
https://help.salesforce.com/s/articleView?id=sf.users_about.htm&type=5
https://help.salesforce.com/help_doccontent?id=sf.query.htm   → normalized to /s/articleView
```

### `salesforce-developer` — Salesforce Developer

```ts
// src/sites/salesforce-developer/index.ts
export const salesforceDeveloper: SiteModule = {
  id: 'salesforce-developer',
  name: 'Salesforce Developer',
  domains: ['developer.salesforce.com'],
  defaults: { rendered: true },
  fetchPage: fetchDeveloperPage,
};
```

- **`fetchPage`** renders the page and reads content out of Developer's web
  components (`doc-content-layout`, `doc-amf-reference`, …). Its capture step
  also expands collapsed sections, inlines `<dx-code-block>` code samples, and
  folds API-reference field stacks into compact Markdown tables.

Example URLs it owns:

```
https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_what_is_rest_api.htm
https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_classes.htm
```

## Adding a new site module

The interface is fully generic, so a new site only needs the parts that differ
from the default pipeline.

1. **Create the module** under `src/sites/<your-site>/index.ts`:

   ```ts
   import type { SiteModule } from '../types.js';

   export const acme: SiteModule = {
     id: 'acme',
     name: 'Acme Docs',
     domains: ['docs.acme.com'],
     // Only add what differs from the generic pipeline:
     // defaults: { rendered: true },
     // fetchPage: fetchAcmePage,
   };
   ```

2. **Register it** by adding it to the `SITES` array in `src/sites/index.ts`.
   Order matters only if two modules could match the same host.

3. **Add a sibling test** (`index.test.ts`, `fetch-page.test.ts`, …). The
   existing Salesforce tests in `src/sites/` are good templates; they cover
   hostname matching, URL normalization, and the fetch hooks.

4. **Decide which hooks you actually need.** If the generic pipeline already
   extracts the site well, you may need no hooks at all, just `id`, `name`,
   and `domains` to claim the domain.

::: tip Reach for a module only when the generic path falls short
A site module is the right tool when a domain renders client-side or hides
content in shadow DOM. If a plain fetch already produces clean Markdown, no
module is needed, and none is the simplest thing that works.
:::

## What's Salesforce-specific vs. general

- **General / reusable:** the `SiteModule` interface, hostname detection, the
  `site_module_id` metadata round-trip, and revalidation-by-module. None of
  it assumes Salesforce.
- **Salesforce-specific:** the implementations under `src/sites/salesforce/`
  and `src/sites/salesforce-developer/`, namely the shadow-DOM extraction and URL
  normalization. Those live entirely inside their modules and don't leak into
  the shared pipeline.

# Prisma

## Sources

- Docs: https://www.prisma.io/docs
- Observed edit link: https://github.com/prisma/docs/edit/main/apps/docs/content/docs/(index)/index.mdx

## Organization

The sampled Prisma docs landing page separates Prisma ORM, Prisma Postgres, Prisma Compute, Studio, Console, and related product docs. Product maturity matters because some products are beta.

## Search

Search appears site/app backed. Public endpoint status was not confirmed in this task, so source mapping should be prioritized before search connector work.

## Markdown or Source Site

Yes. The sampled page exposes a GitHub edit link to MDX source in `prisma/docs`.

## Default Cache Verdict

Mostly sufficient for simple article content. Static extraction returned concise Markdown and included the edit link.

Not sufficient for:

- Product-area search.
- Beta/public-preview freshness handling.
- Source MDX preference.

## Recommended Work

- Use generic GitHub edit-link source mapping.
- Mark beta/public-preview product pages as `volatile` or `standard` with short TTL.
- Add product area metadata when URL paths include `/orm`, `/postgres`, `/compute`, `/studio`, or `/console`.

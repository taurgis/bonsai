# T-17: Preserve Highlighted Code Blocks and Tabbed Examples

## Goal

Prevent documentation code examples from being collapsed or damaged during HTML-to-Markdown conversion.

## Evidence

- Tailwind output collapsed `npm create vite@latest my-project` and `cd my-project` into one line.
- Tailwind output collapsed imports and `defineConfig` into one line.
- Redux Toolkit output collapsed multiple template commands/imports in at least one block.
- Vite and Node preserve many code blocks, so the fix should be targeted to highlighted/tabbed code HTML, not a rewrite of the whole Markdown pipeline.

## Scope

- Normalize Shiki, Docusaurus, Next.js, and common highlighted-code DOM before Turndown.
- Convert visible `.line` spans into newline-separated text.
- Preserve language labels from classes such as `language-bash`, `language-ts`, `language-js`, `language-html`, and visible code headers.
- Drop copy buttons from Markdown.
- Optionally use copy-button payloads when they are clearly attached to the visible code block and safer than rendered spans.
- Add quality warnings when code blocks appear to have collapsed commands.

## Out of Scope

- Rebuilding syntax highlighting.
- Supporting arbitrary interactive playgrounds.

## Acceptance Criteria

- Tailwind Vite installation fixture preserves commands on separate lines.
- Tailwind JavaScript config fixture preserves import lines and object structure.
- Redux Toolkit getting-started fixture preserves multi-command examples.
- Existing table conversion tests continue to pass.
- `qualityNotes` include a stable code when collapsed code is detected.

## Validation

```bash
pnpm test -- --run src/lib/research/markdown
pnpm test -- --run src/lib/research
pnpm type-check
```


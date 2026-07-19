---
name: javascript-development
description: 'Guidance for modern JavaScript language features, modules, async code, and browser APIs. Use when building or reviewing general JavaScript for web apps, Node tools, or shared libraries, and when translating specs into practical patterns.'
license: Forward Proprietary
compatibility: 'VS Code 1.x+, modern browsers, Node.js 18+'
metadata:
  version: '1.0.0'
---

# JavaScript Development

Practical guidance for modern JavaScript across browsers and Node. Focuses on language features, modules, async patterns, and reliable runtime behavior.

## When to Use This Skill

- Designing or reviewing modern JavaScript in shared libraries or web apps
- Choosing the right language feature or built-in for a task
- Building async flows with robust error handling and cancellation
- **Not for:** TypeScript-only patterns, framework-specific guidance, or legacy ES5-only code

## Prerequisites

- A modern JavaScript runtime (current browser or Node.js 18+)
- Familiarity with modules and async syntax

## Quick Start

1. Identify the environment (browser, Node, worker).
2. Pick the smallest language feature that solves the problem.
3. Add explicit error handling and cancellation when I/O is involved.

## How to Use

### Basic Usage

Use modules and small functions, keep side effects contained, and expose typed-like inputs with runtime checks.

```js
// fetch-json.js
export async function fetchJson(url, { timeoutMs = 8000, signal } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const mergedSignal = signal ?? controller.signal;

  try {
    const response = await fetch(url, {
      signal: mergedSignal,
      headers: { accept: 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}
```

### Advanced Usage

Use Maps and Sets for deduping, Intl for formatting, and structured cloning to avoid accidental mutation.

```js
const uniqueTags = new Set(['ui', 'ui', 'perf']);
const tags = [...uniqueTags].sort();

const fmt = new Intl.NumberFormat('en-US', { notation: 'compact' });
const summary = `Tags: ${tags.join(', ')} | Views: ${fmt.format(12500)}`;
```

## Quick Reference

| Topic | Prefer | Avoid |
|------|--------|-------|
| Modules | `import` and `export` | Global variables | 
| Async | `async`/`await` + `try/catch` | Unhandled promise chains |
| Collections | `Map`/`Set` for keys and dedupe | Array scans on large data |
| Immutability | Copy with spread or `structuredClone` | Shared mutable objects |
| Formatting | `Intl` APIs | Manual string building |

## Examples

### Example 1: Safe fetch with retry

```js
async function retry(fn, { retries = 2 } = {}) {
  let lastError;
  for (let i = 0; i <= retries; i += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

const data = await retry(() => fetchJson('/api/items'));
```

### Example 2: Normalize API results

```js
function normalizeById(items) {
  const byId = new Map();
  for (const item of items) {
    if (item && item.id != null) {
      byId.set(String(item.id), item);
    }
  }
  return byId;
}

const byId = normalizeById([{ id: 1, name: 'A' }, { id: 2, name: 'B' }]);
```

## Troubleshooting

### Issue: Inconsistent async errors

**Cause:** Promises rejected without a `catch` in the call chain.

**Solution:** Centralize async calls and `try/catch` at the boundary.

```js
try {
  const result = await fetchJson('/api/items');
  console.log(result);
} catch (error) {
  console.error('Request failed', error);
}
```

## Assets

- [Module template](assets/module-template.js) - Minimal ES module layout

## References

- [Core language and syntax](references/CORE-LANGUAGE.md) - ECMAScript and MDN guidance
- [Runtime APIs](references/RUNTIME-APIS.md) - Browser and platform APIs
- [Quality and performance](references/QUALITY.md) - Performance, testing, and best practices
- [MDN JavaScript Guide](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide)
- [MDN JavaScript Reference](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference)

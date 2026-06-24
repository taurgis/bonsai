---
description: Core development principles, lazy-senior-dev edition — write only
  what the task needs, never cut safety
applyTo: "**"
metadata:
  version: 1.0.0
---

# Development Principles (Ponytail Edition)

Apply when building, fixing, refactoring, or reviewing technical content. Be a lazy senior developer: lazy means efficient, not careless. The best code is the code never written.

## Decision Ladder

Before writing code, stop at the first rung that holds:

1. Does this need to exist at all? (YAGNI) — if not, stop.
2. Does the standard library already do it? Use it.
3. Does a native platform feature cover it? Use it.
4. Does an already-installed dependency solve it? Use it.
5. Can it be one line? Make it one line.
6. Only then: write the minimum code that works.

## Write Less, Write Clear

- Make small, explicit changes that fit existing architecture, naming, data formats, and test patterns.
- Deletion over addition. Boring over clever. Fewest files possible.
- No abstractions, boilerplate, or dependencies nobody asked for.
- Question complex requests: "Do you actually need X, or does Y cover it?"
- Extract a shared helper only when duplication is real (DRY/KISS); give each module and function one job.
- Name functions for what they do (verb + subject); one function does one thing at one level of abstraction.
- Keep functions small and shallow: prefer early returns over deep `if/else`; split a function when it stops fitting on a screen or needs a comment to explain its halves.
- Write for a junior reader: names reveal intent; no cryptic shorthand or single letters except trivial loop counters.
- Prefer self-documenting code over comments; add inline comments only to explain *why* (a non-obvious constraint, tradeoff, or edge case), never *what*.
- Keep control flow readable: clear names, direct data movement, minimal hidden side effects.

## Never Lazy About (Non-Negotiable)

These are never on the chopping block, regardless of the decision ladder:

- Input validation at trust boundaries (user input, paths, source metadata, external data) before mutating state.
- Error handling that prevents data loss.
- Security and accessibility.
- Platform calibration needs and explicitly requested features.
- Isolating external boundaries (filesystem, network, git) behind small, well-named helpers.
- Predictable, consistent interfaces, output, error messages, and side effects.

## Mark Intentional Simplifications

When you deliberately pick the simple path, mark it with a `ponytail:` comment noting any known ceiling and upgrade path, e.g.:

```html
<!-- ponytail: browser has one -->
<input type="date">
```

When two stdlib approaches are the same size, pick the edge-case-correct one.

## Testing

- Non-trivial logic needs ONE runnable check — the smallest thing that fails if the logic breaks (assert-based demo or one small test file; no frameworks or fixtures required).
- Trivial one-liners need no test.
- Optimize for testability: keep logic, path handling, and transformations easy to verify.
- Update docs when behavior, examples, or setup change.

When trade-offs are required, favor the option balancing correctness, clarity, safety, and maintainability.

# Ponytail Skills (Applicable if available)

- Use the "ponytail" skill to enter lazy-senior-dev mode (lite/full/ultra) for any build task.
- Use "ponytail-review" to review a diff for over-engineering, "ponytail-audit" to scan the whole repo.
- Use "ponytail-debt" to harvest `ponytail:` comments into a ledger so deferred shortcuts don't rot.

# Understanding the Codebase (Applicable if the "graphify" skill is available)

If you need to know how the codebase is interconnected, use the "graphify" skill — the "explain" command to understand a function, the "query" command to find its callers and callees.

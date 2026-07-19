# Beginner Technical Writing Reference

This reference supports the `beginner-technical-writing` skill with local best practices and example patterns.

## Source Basis

This guidance is distilled from audience-focused technical writing, plain-language guidance, and task-oriented documentation practice.

- University writing-center guidance on audience awareness
- Plain-language guidance on direct explanation
- Developer documentation guidance on prescriptive writing and task-first structure
- Technical style guidance on voice and clarity

## Best Practices

- Write for an intelligent reader who does not yet know SFCC.
- Define terms before relying on them.
- Explain cause and effect directly.
- Use the smallest example that teaches the point.
- Add architectural significance only after the implementation is clear.

## Explanation Pattern

1. Name the concept.
2. State why it exists.
3. Show the smallest working example.
4. Explain the lines that matter.
5. Call out one mistake or edge case.
6. Add a short architecture implication if it changes the reader's reasoning.

## Example Rewrites

Weak:

"Pipelines are important in SFCC because they help orchestrate many different behaviors in an efficient way."

Stronger:

"A pipeline defines the order in which SFCC runs a set of processing steps. In older storefront implementations, pipelines often handle request flow that newer projects would place in controllers."

Weak:

"This object is used to manage the basket."

Stronger:

"`BasketMgr` gives server-side code access to the current shopper basket. That lets your script inspect line items and change checkout state for the current session."

## Review Questions

- Would a newer SFCC developer understand the term after reading this section?
- Did the section explain why the behavior matters, not only what it is called?
- Would an architect understand the design consequence without reading a second explanation of the same thing?
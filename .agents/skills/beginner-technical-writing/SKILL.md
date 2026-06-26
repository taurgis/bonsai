---
name: beginner-technical-writing
description: Write SFCC explanations that stay technically correct while remaining readable for developers who are still learning the platform.
metadata:
  version: '1.0.0'
---

# Beginner Technical Writing

Use this skill when drafting or rewriting technical explanations for readers who need SFCC concepts explained clearly, including developers who are still learning the platform and architects who need precise implementation context.

## Research Base

This skill is grounded in audience-aware technical writing guidance. See [the local reference guide](references/REFERENCE.md) for distilled best practices and examples.

## Reader Model

Assume the reader:

- Knows basic web development.
- May not know SFCC vocabulary, request flow, or Business Manager concepts in detail.
- Needs the reason behind each step, not only the step itself.
- May approach the chapter as a builder, a reviewer, or an architect trying to understand platform consequences.

## Writing Defaults

1. Define platform-specific terms the first time they appear.
2. Prefer short declarative sentences over stacked clauses.
3. Explain cause and effect directly: what triggers the behavior, what the platform does, and what the user sees.
4. Keep paragraphs short enough that one idea can be skimmed without losing context.
5. Use examples that resemble real storefront work, not abstract toy code when avoidable.
6. Layer architectural significance after the implementation is clear, not before.

## Explanation Pattern

Use this order for most explanations:

1. Name the concept.
2. Explain why it exists.
3. Show the smallest working example.
4. Explain each important line or step.
5. Call out one common mistake or edge case.
6. Add the design consequence only if it changes how the reader should reason about the solution.

## Recommended Section Pattern

When a topic needs more than one paragraph, use this sequence:

1. Start with the reader question.
2. State the answer in plain language.
3. Add the SFCC term or runtime detail.
4. Show the example.
5. Explain the result the reader should expect.
6. Add a short architecture note when the decision matters beyond the local example.

## Code Example Rules

- Keep examples small enough to read without scrolling when possible.
- Introduce the file or runtime context before the code block.
- Explain only the lines that carry the teaching point.
- Avoid showing three different patterns when one pattern is enough.
- When an example is incomplete by design, say so explicitly.

## Example

Weak explanation:

"Pipelines are important in SFCC because they help orchestrate many different behaviors in an efficient way."

Stronger explanation:

"A pipeline defines the order in which SFCC runs a set of processing steps. In older storefront implementations, pipelines often handle request flow that newer projects would place in controllers."

Weak explanation:

"This object is used to manage the basket."

Stronger explanation:

"`BasketMgr` gives server-side code access to the current shopper basket. In practice, that means your script can read the basket, inspect line items, and change checkout state for the current session."

## Tone

- Sound like an experienced engineer teaching a colleague.
- Be calm and direct.
- Avoid hype, marketing language, and filler transitions.
- Do not talk down to the reader.

## Beginner-Friendly Moves

- Replace compressed jargon with plain language, then add the correct term.
- Use contrast: what happens if you do this, and what happens if you do not.
- Repeat the core mental model with slightly different wording near the end of a section.
- Use small headings that mirror reader questions.
- Put conditions before instructions when the condition changes what the reader should do.
- Add architect-facing context as a short implication, not a second full explanation of the same material.

## Avoid

- Dense paragraphs that mix concepts, caveats, and examples.
- Unexplained acronyms.
- Empty reassurance such as easy, simple, obvious, or just.
- Narration that describes the author instead of the platform behavior.

## Final Check

Before you finish, ask:

- Could a reader explain this idea back in one or two sentences?
- Does each code block have a teaching reason?
- Did I explain the SFCC-specific part instead of assuming platform familiarity?
- Would a beginner know what to try next?
- Would an architect understand the design consequence without wading through repeated implementation detail?

## Best Practice References

- See [references/REFERENCE.md](references/REFERENCE.md) for repository-local guidance and examples.

## Local Examples

- See [examples/EXAMPLES.md](examples/EXAMPLES.md) for beginner-oriented explanation patterns.

## Related

- Agent: [Senior Technical Writer](../../agents/senior-technical-writer.agent.md) uses this skill when drafting or auditing audience-aware documentation.
- Instructions: [Post-Feature Technical Writing](../../instructions/post-feature-technical-writing.instructions.md) requires this skill after changes that affect docs or user-facing guidance.
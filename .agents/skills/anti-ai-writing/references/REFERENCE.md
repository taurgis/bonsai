# Anti-AI Writing Reference

This reference supports the `anti-ai-writing` skill with repository-local rewrite patterns and examples.

## Source Basis

This guidance is distilled from established plain-language, concision, and technical style guidance.

- University writing-center guidance on style, transitions, and concision
- Government plain-language guidance on direct verbs and clear sentences
- Technical style guidance on concise wording and specific statements

## What To Cut

- Throat-clearing openings
- Decorative transitions
- Empty adjectives
- Stacked hedges
- Weak verb phrases
- Generic abstractions that hide the real subject

## Rewrite Moves

- Move the real subject to the front.
- Replace noun-heavy phrases with a direct verb.
- Name the actual SFCC object, file, API, or behavior.
- Keep transitions only when they express contrast, cause, or sequence.

## Example Rewrites

Before:

"In today's fast-moving ecommerce landscape, it is important to note that SFCC provides a powerful and flexible framework for handling checkout customization."

After:

"SFCC exposes specific extension points for checkout customization. This chapter focuses on the ones that change validation and basket behavior before an order is placed."

Before:

"Furthermore, there are a number of considerations that developers should keep in mind when working with caching."

After:

"Caching changes what data can safely appear in a response. If a page is cached too broadly, shopper-specific state can leak into shared output."

## Sentence Audit

- Can the sentence start later?
- Is the verb doing real work?
- Does the sentence make a specific claim?
- Could this line appear unchanged in almost any technical book? If yes, rewrite it.
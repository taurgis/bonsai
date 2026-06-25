---
name: anti-ai-writing
description: Edit sentence-level prose to remove formulaic AI patterns and replace them with direct, specific, human writing.
metadata:
  version: '1.0.0'
---

# Anti-AI Writing

Use this skill when a sentence sounds generic, padded, or mechanically polished in a way that makes the draft feel generated.

This skill is for line editing, not paragraph shaping. If the problem is rhythm, section flow, repeated paragraph structure, or voice, use `human-prose-editing`.

## Goal

Improve prose quality by making sentences more direct, specific, and audience-aware.

Do not use this skill to game detectors or add fake human quirks. The point is better writing, not disguise.

## Research Base

This skill is based on plain-language, concision, transition, and style guidance. Treat the patterns below as editorial heuristics, not proof that a sentence was AI-written.

See [the local reference guide](references/REFERENCE.md) for the distilled patterns and rewrite examples used in this repository.

## Sentence-Level Signals To Remove

- Throat-clearing openings such as "It is important to note that," "In order to," or "The reason for this is that."
- Decorative transitions such as "moreover," "furthermore," or "in conclusion" when the logic is already obvious.
- Stacked hedges such as "generally," "somewhat," "really," "very," or "probably" when they do not add real scope.
- Empty praise words such as "robust," "powerful," "seamless," "comprehensive," or "innovative."
- Weak verb phrases such as "conduct an analysis," "perform an evaluation," or "is responsible for management of."
- Noun-heavy abstractions such as solution, functionality, capability, process, or approach when a specific object or action exists.
- Nominalized phrasing that hides the action inside words such as implementation, utilization, evaluation, or improvement.
- Prepositional clutter that stacks phrases with of, in, for, at, or through until the sentence loses its subject and verb.
- Repetitive intensifiers or qualifiers that make the sentence sound polished but less exact.
- Habit punctuation used to create polish instead of clarity.

## Boundary With `human-prose-editing`

- If the same sentence scaffold repeats across a paragraph, fix the sentence here and then hand the paragraph to `human-prose-editing`.
- If the issue is flat rhythm across several sentences, section endings that merely recap, or a whole paragraph that feels synthetic, use `human-prose-editing`.
- Use this skill to sharpen one sentence at a time without changing the chapter's structure or voice.

## Prefer These Rewrites

| Avoid | Prefer |
| --- | --- |
| In order to configure a cartridge | To configure a cartridge |
| It is important to note that hooks run before this step | Hooks run before this step |
| SFCC provides a robust way to handle this | This hook lets SFCC call custom logic before the basket is recalculated |
| The reason for this is that the cache is shared | This happens because the cache is shared |
| The code performs validation of the request | The code validates the request |
| There is a need for careful naming here | Name this carefully |
| This is generally very useful in many cases | Use this when the storefront needs the behavior described below |

## Longer Example

Before:

"In today's fast-moving ecommerce landscape, it is important to note that SFCC provides a powerful and flexible framework for handling checkout customization."

After:

"SFCC exposes specific extension points for checkout customization. In this chapter, we will focus on the ones that change validation and basket behavior before an order is placed."

Before:

"Furthermore, there are a number of considerations that developers should keep in mind when working with caching."

After:

"Caching changes what data can safely appear in a response. If a page is cached too broadly, shopper-specific state can leak into output that should be shared."

## Rewrite Method

1. Find the actual subject of the sentence.
2. Move that subject closer to the front.
3. Replace abstract nouns with the real SFCC object, API, file, or behavior.
4. Replace weak verb phrases with a direct verb.
5. Reduce prepositional clutter until the action is easy to follow.
6. Delete qualifiers unless they express real uncertainty.
7. Keep transitions only when they mark a genuine contrast, cause, or sequence.
8. Read the sentence aloud once. If the cadence sounds canned, simplify again.

## Technical Book Rules

- Repeat the correct technical term when precision matters. Do not force synonym variation just to sound less repetitive.
- Prefer active voice when it makes responsibility or flow clearer.
- Keep one claim per sentence when introducing a new SFCC concept.
- If a sentence uses a broad adjective, replace it with the concrete effect on storefront behavior, Business Manager behavior, or developer workflow.
- If punctuation is doing the work that a sharper verb or cleaner clause should do, rewrite the sentence instead of adding another mark.

## What Not To Do

- Do not inject mistakes, slang, or awkward phrasing to look more human.
- Do not add personal asides that distract from the explanation.
- Do not swap precise terms for looser synonyms.
- Do not keep filler because it sounds polished.

## Quick Pass Checklist

- Can the sentence start later?
- Does every qualifier earn its place?
- Is the verb doing real work?
- Does the sentence name the real thing rather than a vague abstraction?
- Is the sentence clearer if one prepositional phrase disappears?
- Would the sentence still sound good if read aloud?

## Best Practice References

- See [references/REFERENCE.md](references/REFERENCE.md) for repository-local guidance and examples.

## Local Examples

- See [examples/EXAMPLES.md](examples/EXAMPLES.md) for sentence-level rewrite examples.

## When To Use Alongside Other Skills

- Use `beginner-technical-writing` for first-pass explanations.
- Use this skill for sentence-level cleanup.
- Use `human-prose-editing` for paragraph flow, voice, section endings, and overall texture.
- If you find yourself rewriting three adjacent sentences for rhythm, switch skills.
---
name: human-prose-editing
description: Rewrite technical prose so it sounds specific, deliberate, and human instead of generic, formulaic, or AI-generated copy.
metadata:
  version: '1.0.0'
---

# Human Prose Editing

Use this skill when a draft is technically acceptable but reads like generated text, a paraphrase of generated text, or an over-smoothed editorial pass.

## Research Base

Public guidance around AI-writing detection repeatedly reacts to the same cluster of problems: predictable wording, low variation in sentence shape, repeated scaffolds, and low-specificity prose. Public sources also repeatedly warn that detectors are unreliable.

Use those signals as editorial warnings, not proof of authorship. The goal is better writing, not gaming detectors.

This skill is grounded in style, concision, and plain-language editing guidance, and tuned against the author's published blog voice. See [the local reference guide](references/REFERENCE.md) for repository-local editing patterns and examples.

## Primary Goal

Make the prose feel written by a thoughtful engineer who knows the subject and respects the reader's time.

## What This Skill Owns

- Paragraph texture, rhythm, and ordering.
- Section openings and endings.
- The balance between clarity, specificity, and voice.
- The difference between a paragraph that advances the chapter and a paragraph that only sounds polished.

Use `anti-ai-writing` for sentence-level cleanup once this pass reveals the local weak spots.

## Detection Reality

- Humans and automated systems tend to react to predictability more than to any single forbidden word or punctuation mark.
- Low burstiness in editorial terms means too many sentences with similar length, cadence, or structure.
- Low perplexity in editorial terms means wording that sounds safe, expected, and interchangeable.
- Dash overuse, adjective padding, and transition spam matter when they reinforce that broader predictability.
- Do not add randomness, mistakes, or fake personality to compensate. Fix the actual weakness in the prose.

## Signals To Investigate

- Repetitive sentence openings.
- Three or more consecutive sentences built on the same scaffold.
- Empty emphasis such as robust, seamless, powerful, important, crucial, or comprehensive.
- Dash-heavy paragraphs where clauses are stapled together instead of shaped.
- Paragraphs that restate the same point with slightly different wording.
- Generic transitions such as in today's world, when it comes to, or it is worth noting that.
- Flat rhythm across a full paragraph or section.
- Abstract nouns such as solution, functionality, capability, process, aspect, or context where a concrete SFCC object exists.
- Repeated contrast formulas such as not just X but Y or this is not A it is B.
- Conclusions that summarize without adding sharper understanding.
- Synonym swaps that sound technically legal but wrong for the domain.

## Rewrite Strategy

1. Cut any sentence that does not add information, contrast, explanation, or judgment.
2. Replace vague praise with observable facts, risks, or consequences.
3. Swap generic nouns like solution, functionality, and capability for the actual SFCC concept.
4. Break repeated scaffolds before you polish wording.
5. Vary rhythm by mixing short verdict sentences with longer explanatory ones.
6. Prefer one precise example, tradeoff, or failure mode over three abstract claims.

## Paragraph-Level Method

1. Identify the one point the paragraph should make.
2. Cut any sentence that only repeats that point.
3. Move the sharpest sentence earlier if the paragraph starts slowly.
4. Replace general claims with one concrete behavior, file, API, risk, or consequence.
5. Check the rhythm. If every sentence lands the same way, rewrite at least one of them.
6. End on an insight, implication, or caution that moves the chapter forward.

## Dash And Structure Audit

- Count the dashes in the paragraph. One sharp interruption can help. Several usually signal loose thinking or fake texture.
- If the dash clause could stand on its own, split it into a sentence or cut it.
- If every paragraph opens with a tidy thesis sentence and closes with a tidy moral, loosen the pattern.
- Keep transitions only when they mark a real contrast, cause, condition, or sequence.
- When a paragraph feels detector bait because it is too smooth, add specificity and consequence, not quirks.

## Style Rules

- Use concrete subject nouns early in the sentence.
- Let verbs carry meaning; avoid adjective piles.
- Keep metaphors rare and only where they clarify behavior.
- Preserve the author's point of view, but remove self-conscious narration.
- End sections on insight, implication, or a useful caution.

## Preferred Rewrites

Instead of broad phrasing like "SFCC provides a powerful way to handle this," write what the platform actually does.

Instead of "This is important because performance matters," say what slows down, where it happens, and why the reader should care.

Instead of adding another dash clause to rescue a weak sentence, decide whether the second idea deserves its own sentence, a sharper verb, or deletion.

## Example Rewrite

Before:

"When it comes to promotions, SFCC offers a powerful and flexible mechanism that is important for modern ecommerce experiences."

After:

"SFCC promotions let merchandisers change pricing behavior without editing storefront code for each campaign. That separation matters because pricing rules usually change faster than a deployment cycle."

Before:

"Caching can improve performance - but it is important to understand the nuances - because mistakes here can create real issues."

After:

"Caching helps only when the response can be safely shared. If a template mixes shopper-specific data into cached output, one shopper can see another shopper's state."

Before:

"This architecture is not just flexible, but also powerful, because it gives teams a way to handle many different scenarios in a seamless way."

After:

"This architecture gives teams one extension point for storefront behavior and another for back-office processing. That split keeps request-time logic separate from batch work, which makes failures easier to isolate."

## Editing Checklist

- Every paragraph contains one main idea.
- Repeated wording and repeated scaffolds have been collapsed.
- The prose names concrete objects, APIs, files, behaviors, or risks.
- Sentence rhythm varies where the thought benefits from it.
- Dash use is restrained and intentional.
- The reader can hear a human judgment, not a template.
- The ending leaves the reader with a sharper model of the system.

## Best Practice References

- See [references/REFERENCE.md](references/REFERENCE.md) for repository-local guidance and examples.

## Local Examples

- See [examples/EXAMPLES.md](examples/EXAMPLES.md) for paragraph-level rewrite examples.

## When Not To Use

- Early rough outlines where structure matters more than voice.
- Factual verification. Use the fact checker.
- Large chapter reordering. Use the structure skill.
- Attempts to mimic human writing by adding mistakes, randomness, or fake eccentricity.
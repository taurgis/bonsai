# Pre-Ticket Analysis Pack

Use these documents before turning the research CLI idea into implementation tickets.

The purpose of this folder is to freeze the project context, integration constraints, and validation expectations that tickets normally assume but rarely state. A ticket should not be created until the relevant sections here have been read and any open questions affecting scope have been resolved.

## Documents

- [Project brief](PROJECT-BRIEF.md) - problem, product goals, non-goals, users, glossary.
- [Target CLI integration](TARGET-CLI-INTEGRATION.md) - what the existing `forward-nexus` oclif CLI currently supports and what that means for a research command/plugin.
- [Research cache contract](RESEARCH-CACHE-CONTRACT.md) - artifact schema, cache keys, freshness, revalidation, output modes, and JSON response shape.
- [Technical research notes](TECHNICAL-RESEARCH.md) - Node APIs, dependency candidates, and copy-vs-depend recommendations.
- [Token-saving strategy](TOKEN-SAVING-STRATEGY.md) - how compressed and detailed outputs reduce context without a large dependency stack.
- [Technical spikes](TECHNICAL-SPIKES.md) - focused proof points to run before implementation tickets depend on parser, cache, or dependency choices.
- [Decision log and open questions](DECISIONS-AND-OPEN-QUESTIONS.md) - decisions already implied by the analysis, plus questions that must be answered before ticketing.
- [Risks and validation plan](RISKS-AND-VALIDATION.md) - security, correctness, performance, UX risks, and the test matrix tickets should satisfy.
- [Generated implementation tickets](../tickets/README.md) - sequenced tickets derived from this analysis pack.
- [Junior handoff guide](../tickets/JUNIOR-HANDOFF.md) - exact plugin-package expectations, host contract examples, and validation order for implementers.

## Definition of Ready for Ticket Creation

A ticket is ready only when it can answer:

1. Which user outcome does this ticket deliver?
2. Which existing `forward-nexus` contract does it touch?
3. Which files or modules are likely involved?
4. Which command examples must still work?
5. What is the expected JSON shape?
6. What state is read or written?
7. What source content is treated as untrusted?
8. What failure modes and exit codes are expected?
9. Which tests prove the behavior?
10. Which docs need to change with the implementation?

If the answer is "unknown" for any of these, the missing fact belongs in this analysis pack before a ticket is written.

## Source Baseline

This pack was prepared from:

- local research plan: `analysis/README.md`
- manual research rule: `.agents/rules/repo-research.md`
- manual researcher agent: `.github/agents/official-docs-researcher.agent.md`
- plugin implementation repo: this repository
- target CLI host repo: `/Users/thomastheunen/Documents/Projects/forward-nexus`
- target CLI docs: `/Users/thomastheunen/Documents/Projects/forward-nexus/AGENTS.md`
- target CLI contracts: `/Users/thomastheunen/Documents/Projects/forward-nexus/analysis/CONTRACT.md`
- target CLI extensibility record: `/Users/thomastheunen/Documents/Projects/forward-nexus/analysis/EXTENSIBILITY.md`
- official oclif docs checked on 2026-06-24:
  - https://oclif.io/docs/configuring_your_cli/
  - https://oclif.io/docs/plugins/
  - https://oclif.io/docs/hooks/
  - https://oclif.io/docs/json/
- extraction library references checked on 2026-06-24:
  - https://github.com/mozilla/readability
  - https://github.com/mixmark-io/turndown
  - https://github.com/jsdom/jsdom
  - https://github.com/WebReflection/linkedom
- Node API references checked on 2026-06-24:
  - https://nodejs.org/api/globals.html#fetch
  - https://nodejs.org/api/url.html#the-whatwg-url-api
  - https://nodejs.org/api/fs.html#fspromisesrenameoldpath-newpath
  - https://nodejs.org/api/crypto.html#cryptocreatehashalgorithm-options

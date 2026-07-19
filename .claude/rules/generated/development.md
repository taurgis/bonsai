<!-- GENERATED: forward-nexus ide-sync -->

Source: `.github/instructions/development.instructions.md`

# Development Instructions

These instructions apply to every coding task in this repository: writing,
refactoring, fixing, and reviewing code.

## Mandatory skills

Two installed skills govern how code is written and reviewed here. Read and
apply them — do not approximate them from memory:

- [ponytail](../../.agents/skills/ponytail/SKILL.md) — governs **how you write
  code**. Apply it during development, on every change.
- [thermo-nuclear-code-quality-review](../../.agents/skills/thermo-nuclear-code-quality-review/SKILL.md)
  — governs **how you review code**. Apply it after development.

### During development: ponytail

Write all code under the ponytail ladder (default intensity: full). Stop at
the first rung that holds: question whether the change needs to exist (YAGNI),
reuse what is already in this codebase, prefer the standard library, prefer
native platform features, prefer already-installed dependencies, prefer one
line — only then write the minimum new code that works. Never add a dependency
for what a few lines can do. Fix root causes, not symptoms. Never skip
understanding the problem to ship a small diff.

### After development: review gate

Once the change is functionally complete, and before declaring the task done,
execute both skills as a review pass on your own diff:

1. Run the **ponytail** skill against the change: delete unrequested
   abstractions, speculative scaffolding, and anything a simpler rung of the
   ladder covers.
2. Run the **thermo-nuclear-code-quality-review** skill against the change:
   an ambitious maintainability audit — improve abstractions and modularity,
   remove spaghetti conditions, and take clear behavior-preserving
   restructurings rather than settling for local cleanup.

Apply the findings before finishing. A change that has not passed both review
passes is not done.

## CLI development best practices

This repository ships a CLI (`bonsai`, built on oclif). Follow the
[Command Line Interface Guidelines](https://clig.dev/) and
[Node.js CLI Apps Best Practices](https://github.com/lirantal/nodejs-cli-apps-best-practices).
The rules that matter most here:

- Return exit code 0 on success and non-zero on failure, because scripts and
  agents branch on exit codes.
- Send primary output to stdout and all messaging (progress, warnings,
  errors) to stderr, so piped output stays clean.
- Keep output deterministic: same input and cache state produce byte-identical
  output. Agents diff and reuse Bonsai output, so incidental variation
  (timestamps, ordering, randomness) is a bug.
- Every command supports `-h`/`--help` with a description, flag docs, and at
  least one example invocation. Define flags and args through oclif — never
  hand-parse `process.argv`.
- Support `--json` for machine-readable output on any command whose output an
  agent may consume.
- Error messages state what went wrong and suggest what to do next (Bonsai's
  "Try this:" pattern). Never print a raw stack trace to a user.
- Validate input at trust boundaries: URLs, file paths, stdin, and fetched
  HTML are untrusted. Sanitize before storing or rendering.
- Respect POSIX signals (SIGINT/SIGTERM): exit promptly and never leave the
  cache in a corrupt state.
- Honor read-only/plan mode (`--read-only`, `BONSAI_READ_ONLY`) in any code
  path that writes to disk or config.
- Keep the dependency footprint small — a slow `npx` install is a broken CLI.

## Readability for junior developers

Write code a junior developer can follow without asking for help. Minimal
code (ponytail) and readable code are the same goal: fewer, clearer lines.

- Names reveal intent: `staleCacheEntries`, not `data` or `arr`; `resolveCacheKey()`,
  not `doIt()` or `process()`. A reader should know what a thing is without
  opening its definition.
- Functions do one thing, named after that thing. If the name needs "and",
  split the function.
- No unexplained abbreviations or single-letter names outside tiny scopes
  (a loop index is fine; `nrmUrl` as a parameter is not).
- Replace magic numbers and inline literals with named constants
  (`STALE_AFTER_DAYS = 90`, not `90` in a condition), because the name carries
  the reasoning the literal cannot.
- Every exported function, class, and type carries a short JSDoc block:
  what it does, parameters, return value, and thrown errors. Internal helpers
  need JSDoc only when the signature alone does not explain them.
- Inline comments explain *why* (a constraint, a workaround, a non-obvious
  choice), never *what* the next line does — the code already says that.
- Prefer early returns over nested conditionals; more than two levels of
  nesting is a signal to extract or invert.
- Avoid clever constructs a junior would have to decode: nested ternaries,
  dense chained expressions, implicit type coercion tricks. Boring and
  explicit beats compact and cryptic.

## General development best practices

- Non-trivial logic ships with at least one runnable check that fails if the
  logic breaks. Trivial one-liners need no test — YAGNI applies to tests too.
- Never simplify away input validation, error handling that prevents data
  loss, or security measures.
- Prefer the smallest diff in the right place: grep every caller before
  changing shared code, and fix shared behavior in the shared function.
- Mark deliberate simplifications that cut a real corner with a `ponytail:`
  comment naming the ceiling and the upgrade path.
- Match the surrounding code's style, naming, and idiom; comments state
  constraints the code cannot show, nothing else.
- Verify official platform documentation through the web-research workflow
  (Bonsai, cache-first) before relying on platform behavior.

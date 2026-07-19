---
trigger: always_on
description: "Define report format for Senior Quality Engineer validations"
---

<!-- GENERATED: forward-nexus ide-sync -->

# Senior Quality Engineer Reporting

## When Invoking This Agent

- When invoking the **Senior Quality Engineer** agent, require it to return its validation report with these sections in this order: `Findings`, `Scenarios Tested`, `Commands and Environment`, `Coverage Gaps`, `Verdict`.
- `Findings` must come first. If no issues are found, the agent must state that explicitly.
- `Scenarios Tested` must list each scenario with a status of `pass`, `fail`, or `not validated`.
- `Commands and Environment` must include the automated commands run, any runtime environment started, and the URL or entry point tested if applicable.
- `Coverage Gaps` must list blockers, assumptions, and anything left untested.
- `Verdict` must summarize release confidence in one concise paragraph.

## Severity Expectations

- Order findings by severity, highest first.
- Include reproduction steps for failures when available.
- Distinguish verified failures from assumptions or suspected risks.

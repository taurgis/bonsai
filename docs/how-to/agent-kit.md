# Install the agent kit

Bonsai ships a small kit that teaches an AI coding agent to research the
cache-first way: search what's already captured, fetch through Bonsai when the
cache misses, and import anything it had to read by hand. The core kit is three
files — a skill, an instruction, and a subagent — plus an optional Salesforce
variant, and you install it into your own agent's config.

The source files live in [`agents/`](https://github.com/taurgis/bonsai/tree/main/agents)
in the Bonsai repo, written in GitHub Copilot format. The installer converts them
to whichever agent you target, so the same kit drops into Copilot, Claude Code,
or Cursor.

## What's in the kit

| Piece | File | What it does |
| --- | --- | --- |
| **Skill** | `web-research` | The actual workflow: search the cache, fetch with `--format detailed`, use `--rendered` for SPAs, import manual notes. The agent runs this whenever it needs docs. |
| **Instruction** | `web-research` | The always-on rule that *requires* the agent to verify current official docs before technical changes, and says when to run the skill inline vs. delegate to the subagent. |
| **Subagent** | `official-docs-researcher` | A focused researcher the main agent delegates to for large or multi-source research, so verbose fetching stays out of the main context. It returns source-cited findings. |

The skill is the engine, the instruction decides when it fires, and the subagent
isolates the heavy research. You can install all three or just the skill.

### Optional: Salesforce variant

The kit also ships a Salesforce specialization of the instruction and subagent,
for teams whose research targets Salesforce docs. They reuse the same
`web-research` skill but add Bonsai's [Salesforce site modules](/reference/site-modules):
searching Help live with `--domain help.salesforce.com`, and letting the modules
render and extract the JavaScript-only Help and Developer pages.

| Piece | File | What it does |
| --- | --- | --- |
| **Instruction** | `salesforce-research` | Requires verifying current Salesforce docs before Salesforce-related changes, and points at the site-module workflow. |
| **Subagent** | `salesforce-docs-researcher` | The researcher specialized for Salesforce Help and Developer docs; returns source-cited findings. |

- [View the instruction source →](https://github.com/taurgis/bonsai/blob/main/agents/instructions/salesforce-research.instructions.md)
- [View the subagent source →](https://github.com/taurgis/bonsai/blob/main/agents/agents/salesforce-docs-researcher.agent.md)

`--all` installs these alongside the generic pieces; omit them if you don't
research Salesforce.

## Install with forward-nexus

[`forward-nexus`](https://www.npmjs.com/package/forward-nexus) reads the kit from
the repo and writes it into your project in the right format. Point `add` at the
`agents/` folder and name the agent(s) you want:

```bash
# Install all three pieces for GitHub Copilot and Claude Code
npx forward-nexus add https://github.com/taurgis/bonsai/tree/main/agents \
  --all --agent=github-copilot,claude-code
```

`--all` takes every artifact in the folder (skill, instruction, subagent).
`--agent` is a comma-separated list of targets; pass one or several:

```bash
# Claude Code only
npx forward-nexus add https://github.com/taurgis/bonsai/tree/main/agents \
  --all --agent=claude-code

# Add Cursor to the mix
npx forward-nexus add https://github.com/taurgis/bonsai/tree/main/agents \
  --all --agent=github-copilot,claude-code,cursor
```

Each target writes to that agent's own config directory (`.github/`, `.claude/`,
`.cursor/`). Commit the result and your teammates pick up the same research
workflow.

## What lands for Claude Code

`--agent=claude-code` writes three files, each a native Claude Code config. The
links below go to Bonsai's own checked-in copies, which double as ready-to-copy
examples.

### Skill → `.claude/skills/web-research/SKILL.md`

A [Claude Agent Skill](https://code.claude.com/docs/en/skills). The frontmatter
needs only `name` and `description`; the command you type is the **directory**
name, so this one is invoked with `/web-research`.

```yaml
---
name: web-research
description: 'Bonsai-backed official documentation and web research workflow. Use
  before technical changes that depend on platform behavior, when fetching docs…'
---
```

[View the full skill →](https://github.com/taurgis/bonsai/blob/main/.claude/skills/web-research/SKILL.md)

### Instruction → `.claude/rules/web-research.md`

Claude Code loads every `.md` file under
[`.claude/rules/`](https://docs.anthropic.com/en/docs/claude-code/memory) at
launch, with the same weight as `CLAUDE.md`. No frontmatter is required for an
always-on rule. (You can also `@`-import it from `CLAUDE.md` instead.)

[View the rule →](https://github.com/taurgis/bonsai/blob/main/.claude/rules/generated/web-research.md)

### Subagent → `.claude/agents/official-docs-researcher.md`

A [Claude Code subagent](https://code.claude.com/docs/en/sub-agents). `name` and
`description` are required; `tools` is a comma-separated allowlist (omit it to
inherit every tool), and `model` accepts `sonnet`, `opus`, `haiku`, `fable`, a
full model ID, or `inherit`.

```yaml
---
name: official-docs-researcher
description: "Researches official documentation through Bonsai and returns source-cited findings"
model: sonnet
tools: Read, Glob, Grep, Bash, WebFetch, WebSearch
---
```

[View the full subagent →](https://github.com/taurgis/bonsai/blob/main/.claude/agents/official-docs-researcher.md)

## Other agents

### GitHub Copilot (the source format)

The kit is authored in Copilot's format, so these files are the originals the
installer converts from:

- Skill — [`agents/skills/web-research/SKILL.md`](https://github.com/taurgis/bonsai/blob/main/agents/skills/web-research/SKILL.md)
- Instruction — [`agents/instructions/web-research.instructions.md`](https://github.com/taurgis/bonsai/blob/main/agents/instructions/web-research.instructions.md)
  (`applyTo: '**'`, with a `skills:` link to the skill)
- Subagent — [`agents/agents/official-docs-researcher.agent.md`](https://github.com/taurgis/bonsai/blob/main/agents/agents/official-docs-researcher.agent.md)

### Cursor

[Cursor project rules](https://cursor.com/docs/rules) use the `.mdc` extension
(a plain `.md` file in `.cursor/rules/` is ignored) with `description`, `globs`,
and `alwaysApply` frontmatter:

- Rule — [`.cursor/rules/web-research.mdc`](https://github.com/taurgis/bonsai/blob/main/.cursor/rules/web-research.mdc)

Cursor has no documented project-level *subagent* file. The closest native homes
for the researcher's behavior are a rule or a
[Cursor skill](https://cursor.com/docs/skills) (`.cursor/skills/<name>/SKILL.md`).
Bonsai still ships a [`.cursor/agents/` example](https://github.com/taurgis/bonsai/blob/main/.cursor/agents/official-docs-researcher.md),
but treat it as a convention, not an official Cursor feature.

## Verify it works

After installing, the agent should reach for Bonsai before fetching. A quick
check: ask it to research a doc page and confirm it runs a `bonsai search` first,
then a `bonsai <url> --format detailed` on a miss. If you installed the subagent,
ask for a multi-source comparison and confirm it delegates to
`official-docs-researcher` rather than fetching inline.

For how an agent reads Bonsai's machine output — the JSON envelope and exit
codes the kit relies on — see [Drive Bonsai from an agent](/how-to/agent-integration).

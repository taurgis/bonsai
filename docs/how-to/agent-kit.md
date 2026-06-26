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

## Start here

If you are new to agent config, use this order:

1. Install Bonsai and make sure `bonsai --help` works.
2. Install the agent kit with `forward-nexus`.
3. Add a hook example only if you want to block the agent's built-in web fetch.
4. Ask the agent to research one doc page and watch for a `bonsai search` or
   `bonsai <url> --format detailed` command.

You do not need to understand every generated file before you start. The skill
teaches the agent what to do, the instruction tells it when to do it, and the
subagent handles bigger research jobs without filling the main chat with fetch
output.

## What's in the kit

| Piece             | File                       | What it does                                                                                                                                                               |
| ----------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Skill**         | `web-research`             | The actual workflow: search the cache, fetch with `--format detailed`, use `--rendered` for SPAs, import manual notes. The agent runs this whenever it needs docs.         |
| **Instruction**   | `web-research`             | The always-on rule that _requires_ the agent to verify current official docs before technical changes, and says when to run the skill inline vs. delegate to the subagent. |
| **Subagent**      | `official-docs-researcher` | A focused researcher the main agent delegates to for large or multi-source research, so verbose fetching stays out of the main context. It returns source-cited findings.  |
| **Hook examples** | `hooks/`                   | Optional native hook configs that block one-off URL fetch tools and tell the agent to run Bonsai instead.                                                                  |

The skill is the engine, the instruction decides when it fires, and the subagent
isolates the heavy research. You can install all three or just the skill.

### Optional: Salesforce variant

The kit also ships a Salesforce specialization of the instruction and subagent,
for teams whose research targets Salesforce docs. They reuse the same
`web-research` skill but add Bonsai's [Salesforce site modules](/reference/site-modules):
searching Help live with `--domain help.salesforce.com`, and letting the modules
render and extract the JavaScript-only Help and Developer pages.

| Piece           | File                         | What it does                                                                                                          |
| --------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Instruction** | `salesforce-research`        | Requires verifying current Salesforce docs before Salesforce-related changes, and points at the site-module workflow. |
| **Subagent**    | `salesforce-docs-researcher` | The researcher specialized for Salesforce Help and Developer docs; returns source-cited findings.                     |

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

Use one `--agent` value for one tool, or a comma-separated list for several:

| You use               | Run                                                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Claude Code           | `npx forward-nexus add https://github.com/taurgis/bonsai/tree/main/agents --all --agent=claude-code`                |
| GitHub Copilot        | `npx forward-nexus add https://github.com/taurgis/bonsai/tree/main/agents --all --agent=github-copilot`             |
| Cursor                | `npx forward-nexus add https://github.com/taurgis/bonsai/tree/main/agents --all --agent=cursor`                     |
| Claude Code + Copilot | `npx forward-nexus add https://github.com/taurgis/bonsai/tree/main/agents --all --agent=claude-code,github-copilot` |

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

## Add hook examples

The kit also includes optional hook examples under
[`agents/hooks/`](https://github.com/taurgis/bonsai/tree/main/agents/hooks).
These are not installed automatically by `forward-nexus`; copy the example for
your agent when you want the editor or agent runtime to block native URL fetches
and return a model-visible Bonsai command instead.

::: warning Hooks are intrusive
These examples block the agent's native web-fetch tool. If Bonsai fails because
of network access, installation, permissions, or extraction quality, the agent
may have no native fallback for real research. Use hooks with caution, monitor
whether they improve your workflow, and remove or narrow them if they get in the
way.
:::

| Agent          | Native hook location                              | Bonsai example                 |
| -------------- | ------------------------------------------------- | ------------------------------ |
| Claude Code    | `.claude/settings.json` plus `.claude/hooks/*.sh` | `agents/hooks/claude-code/`    |
| GitHub Copilot | `.github/hooks/*.json` plus matching scripts      | `agents/hooks/github-copilot/` |
| Cursor         | `.cursor/hooks.json` plus `.cursor/hooks/*.sh`    | `agents/hooks/cursor/`         |
| Codex          | `.codex/hooks.json` plus `.codex/hooks/*.sh`      | `agents/hooks/codex/`          |

Copy the files into the matching locations in your project. For example, for
Cursor:

```bash
mkdir -p .cursor/hooks
cp agents/hooks/cursor/hooks.json .cursor/hooks.json
cp agents/hooks/cursor/hooks/bonsai-web-fetch.sh .cursor/hooks/bonsai-web-fetch.sh
```

For Claude Code:

```bash
mkdir -p .claude/hooks
cp agents/hooks/claude-code/settings.json .claude/settings.json
cp agents/hooks/claude-code/hooks/bonsai-web-fetch.sh .claude/hooks/bonsai-web-fetch.sh
```

For GitHub Copilot:

```bash
mkdir -p .github/hooks
cp agents/hooks/github-copilot/bonsai-web-fetch.json .github/hooks/bonsai-web-fetch.json
cp agents/hooks/github-copilot/bonsai-web-fetch.sh .github/hooks/bonsai-web-fetch.sh
```

For Codex:

```bash
mkdir -p .codex/hooks
cp agents/hooks/codex/hooks.json .codex/hooks.json
cp agents/hooks/codex/hooks/*.sh .codex/hooks/
```

The hooks do not silently rewrite a web fetch into a shell command. The reliable
pattern across tools is to deny the native URL-fetch tool and tell the agent to
run:

```bash
bonsai <url> --format detailed
```

Use `node bin/cli.mjs <url> --format detailed` when testing inside the Bonsai
repo. Codex has a narrower hook surface than the other examples: its
`PreToolUse` hook can block shell, patch, and MCP tool calls, but not every
built-in web or search tool. The Codex example therefore covers MCP-style fetch
tools and adds prompt-time context for URL-heavy requests.

These examples are based on the current native hook docs for
[Claude Code](https://docs.anthropic.com/en/docs/claude-code/hooks),
[GitHub Copilot](https://docs.github.com/en/copilot/concepts/agents/hooks),
[Cursor](https://cursor.com/docs/hooks), and
[Codex](https://developers.openai.com/codex/hooks). Antigravity is omitted
because no official project hook surface is currently documented for replacing
`read_url_content` or similar URL-fetch tools.

## What to tell your agent

After installing the kit, you can give the agent a simple instruction like this:

```text
Before changing code that depends on external docs, search Bonsai first. If the
page is not cached, fetch it with `bonsai <url> --format detailed`. Use
`--rendered` only when a normal fetch misses client-rendered content. Cite the
sources you used.
```

That is enough for most junior-friendly workflows. The agent should follow this
loop:

1. Search: `bonsai search "<topic>" --json`
2. Check a known URL: `bonsai status <url> --json`
3. Fetch only on a miss: `bonsai <url> --format detailed --json`
4. Use `--rendered` for JavaScript-heavy docs pages.
5. Import manual notes when Bonsai cannot fetch a page:
   `bonsai import <url> --file notes.md --json`

The agent does not need to browse first and cache later. Bonsai should be the
first fetch path, because the result is reusable by the next agent and the next
session.

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
description: 'Researches official documentation through Bonsai and returns source-cited findings'
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

Cursor has no documented project-level _subagent_ file. The closest native homes
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

# Bonsai Hook Examples

These examples show how to steer agents away from one-off web fetch tools and
toward Bonsai's reusable research cache.

They are examples, not an installer contract. Copy the relevant folder contents
into the agent's native hook location and adjust paths if your repository layout
differs.

## Ambient session context (`bonsai setup`)

The examples below only cover the *redirect-away-from-web-fetch* half of hook
integration. For the complementary half — showing an agent the cache's current
state before it does anything — run `bonsai setup <agent>` instead of copying
files by hand. It installs (and repairs) a `SessionStart` hook that runs
`bonsai context` at the start of every session, supporting `claude-code` and
`codex` today. See [Ambient session
context](https://bonsai.rhino-inquisitor.com/how-to/agent-integration#ambient-session-context)
for the full workflow.

OpenCode is not supported by `setup` yet: its plugin docs don't document a
confirmed hook signature for injecting session-start context (closest is
`session.created`, unconfirmed shape), so `setup` won't guess at one rather than
ship an integration that might not work.

## What The Hooks Do

The hooks deny native URL-fetch tools and return model-visible guidance like:

```bash
npx @taurgis/bonsai https://example.com/docs --format detailed
```

Most hook systems cannot transparently replace a web-fetch tool call with a shell
command. Blocking the native fetch and giving the agent the exact Bonsai command
is the reliable cross-agent pattern.

## Use With Caution

These hooks are intentionally intrusive. If Bonsai fails because of network,
installation, permissions, or extraction issues, the agent may have no fallback
path to its native web-fetch tool. That can block valid research instead of
making it better.

Start with one repository, watch how the agent behaves, and remove or narrow the
hook if it blocks work you still need the native tool to handle.

## Supported Examples

| Agent          | Native hook file        | Example           |
| -------------- | ----------------------- | ----------------- |
| Claude Code    | `.claude/settings.json` | `claude-code/`    |
| GitHub Copilot | `.github/hooks/*.json`  | `github-copilot/` |
| Cursor         | `.cursor/hooks.json`    | `cursor/`         |
| Codex          | `.codex/hooks.json`     | `codex/`          |

Antigravity is intentionally omitted: no current official hook configuration
surface was found for replacing `read_url_content` or similar URL-fetch tools.

Codex has one important limitation: `PreToolUse` hooks cover shell, patch, and
MCP tool calls, but not every built-in web/search tool. The Codex example blocks
MCP-style URL fetch tools when they are available and adds prompt-time context
that tells the agent to prefer Bonsai for URLs.

## Published Command

Run Bonsai through the published npm package:

```bash
npx @taurgis/bonsai <url> --format detailed
```

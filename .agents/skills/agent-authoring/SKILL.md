---
name: agent-authoring
description: How to design, structure, and validate custom AI agents for this workspace.
metadata:
  version: '1.0.0'
---

# Agent Authoring Skill
Guidelines for creating and maintaining custom AI agents (e.g., Copilot `.agent.md` files) tailored to this repository.

## When to Use
- You need a new agent focused on a specific workflow (e.g., Storybook tests, log triage, deployment setup).
- You want to adjust tools, constraints, or the persona for existing agents.
- You are adding workspace-level or profile-level agents for team reuse.

## Quick Start
1) Create the agent configuration file in your platform's designated directory (e.g., `.agents/`, `.github/agents/`, or a root configuration file).
2) Add the required metadata (YAML frontmatter, JSON, or UI configuration depending on your tool). Define the `name`, `description`, allowed `tools`, and `model`. Include `mcp-servers` or `handoffs` only when the workflow actively requires them.
3) In the body, write concise instructions: task focus, guardrails, execution steps, and validation methods.
4) Keep it under ~200-300 lines; link out to repository documentation instead of pasting exhaustive context.

## Configuration & Metadata Cheatsheet
*(Adapt these concepts to your specific AI platform's syntax)*
- `name` / `description`: Display name and placeholder text; keep them short and intent-driven.
- `tools`: List allowed capabilities. For Model Context Protocol (MCP) servers, explicitly allow the server name or specific endpoints so the agent knows how to interact with external APIs or local containers.
- `model`: Pin a specific model (e.g., Claude 3.5 Sonnet, GPT-4o) only when the workflow dictates specific reasoning or context window requirements.
- `routing` / `handoffs`: If your platform supports sub-agents, define clear triggers to pass context to the next specialized agent.

## Body Structure (recommended)
- **Purpose and scope**: What this agent does and, crucially, what it must *not* do.
- **Operating defaults**: Where to run commands, preferred package managers, and what context to inspect first.
- **Playbooks**: Ordered, step-by-step flows for common tasks (e.g., plan, execute, debug, validate).
- **Guardrails**: Safe-edit rules (scope boundaries, no unrelated changes, mandatory confirmation before destructive operations).
- **Validation**: How to verify the work (specific test commands, linters) and how to summarize outputs.
- **Links**: Point to repo docs or other reference files for deeper detail.

## Tool Selection Patterns
- **Editing agent**: Start with file read/search. Add execution capabilities only when terminal commands are required. Add web browsing only if external documentation lookups are strictly necessary.
- **Read-only / Review agent**: Limit to read, search, and memory. Never grant command execution to a planning-only or static-review agent.
- **MCP Integration**: Ensure your agent knows exactly *when* to invoke attached MCP tools (e.g., querying project management tickets, connecting to hardware APIs, or analyzing databases).
- Match tool identifiers to your platform's exact specifications (e.g., `execute_command`, `read_file`, `ask_user`).

## Quality Bar
- **KIS (Keep It Simple)**: Minimal, task-focused instructions. Avoid boilerplate and conversational filler.
- **DRY (Don't Repeat Yourself)**: If multiple agents share strict architectural rules, extract those into a shared markdown file they can all read, rather than copying text across agent configs.
- Prefer scoped, isolated commands over global state changes or installs. Always specify the working directory.
- Add strict guardrails for destructive commands (e.g., never propose `git reset --hard` or unprompted database drops).
- Keep instructions concise; use fenced code blocks for exact commands.

## Validation Checklist
- [ ] Configuration fields match the target AI platform's supported schema.
- [ ] Tools list strictly matches the agent’s intent; no over-broad capabilities.
- [ ] Clear run/validate steps with default workspace commands are provided.
- [ ] Destructive guardrails are explicitly called out.
- [ ] Links and file paths resolve correctly within the repository.

## Examples
- Read-heavy research agent: `.agents/official-docs-researcher.md`.
- Validation agent: `.agents/senior-quality-engineer.md`.
- Planning agent: Configured with read/search tools only. Body instructs the agent to gather context, produce a technical plan, and then hand off to an implementation agent.

## Maintenance Tips
- Keep agents in sync with repository workflows (scripts, test commands, CI/CD pipelines). Update instructions immediately after build script changes.
- Remove stale handoffs or sub-agent references when target agents are deprecated.
- Prefer additive changes; avoid reformatting existing, working agent prompts without a functional need.
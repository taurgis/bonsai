---
name: skill-authoring
description: 'Create new Agent Skills for GitHub Copilot with proper structure, frontmatter, and bundled resources. Use when asked to "create a skill", "make a new skill", "scaffold a skill", or when building specialized AI capabilities. Generates SKILL.md files following the agentskills.io specification with Forward best practices for Salesforce development.'
license: Forward Proprietary
compatibility: VS Code 1.x+, GitHub Copilot
metadata:
  version: '1.0.0'
---

# Skill Authoring Guide

This skill helps you create well-structured Agent Skills for GitHub Copilot that follow the [agentskills.io](https://agentskills.io) specification and Forward's conventions.

## When to Use This Skill

- Creating a new skill from scratch
- Converting documentation into a skill
- Scaffolding skill structure for a new Salesforce feature
- Understanding skill best practices and patterns

## Quick Start

1. **Create folder**: `skills/{skill-name}/` (lowercase, hyphens only)
2. **Add SKILL.md** with required frontmatter
3. **Write instructions** in the body
4. **Add references** for detailed documentation
5. **Validate** with `npm run skill:validate`

## Skill Directory Structure

```
my-skill/
├── SKILL.md           # Required: instructions + metadata
├── scripts/           # Optional: executable code
├── references/        # Optional: detailed documentation
├── assets/            # Optional: static resources
└── templates/         # Optional: starter code for agent to modify
```

### Optional Directories

- `scripts/`: Executable code an agent can run. Keep scripts self-contained or document dependencies, include helpful errors, and handle edge cases.
- `references/`: Additional documentation (e.g., `REFERENCE.md`, `FORMS.md`, or domain-specific files). Keep files focused for on-demand loading.
- `assets/`: Static resources such as templates, images, and data files (schemas, lookup tables).

## Required Frontmatter

```yaml
---
name: skill-name                    # Must match folder name
description: 'What it does AND when to use it'
---
```

| Field | Required | Constraints |
|-------|----------|-------------|
| `name` | **Yes** | 1-64 chars, lowercase letters/numbers/hyphens, matches folder |
| `description` | **Yes** | 1-1024 chars, describes WHAT + WHEN |
| `license` | No | License name (e.g., Forward Proprietary) |
| `compatibility` | No | 1-500 chars, environment requirements |
| `metadata` | No | Key-value pairs for custom properties such as `metadata.version` |
| `allowed-tools` | No | Space-delimited pre-approved tools (experimental) |

## Versioning

If you want semantic version metadata on a skill, put it under `metadata.version`.

```yaml
metadata:
  version: '1.0.0'
```

Do not add a top-level `version` field. Forward Nexus preserves `metadata.version` in installed files and uses it for tracked `sync` version decisions.

## Writing Effective Descriptions

The `description` field is **critical** for skill discovery. Include:

1. **WHAT** the skill does (capabilities)
2. **WHEN** to use it (triggers, scenarios)
3. **Keywords** users might mention

### Good Examples

```yaml
# Salesforce-focused
description: 'Creates SFRA cartridges with proper structure, webpack config, and ESLint setup. Use when starting a new B2C Commerce project, adding a custom cartridge, or setting up a plugin cartridge.'

# General development
description: 'Toolkit for testing web applications using Playwright. Use when asked to verify frontend functionality, debug UI behavior, or capture screenshots.'
```

### Bad Examples

```yaml
# Too vague
description: 'Helps with cartridges'

# Missing "when to use"
description: 'Creates SFRA cartridge structures'
```

## Recommended Body Sections

```markdown
# Skill Title

Brief overview (1-2 sentences).

## When to Use This Skill

- Scenario 1
- Scenario 2
- NOT for: alternative scenarios

## Prerequisites

- Required tool 1
- Required tool 2

## How to Use

### Basic Usage
Step-by-step instructions...

### Advanced Usage
More complex scenarios...

## Quick Reference

| Command | Description |
|---------|-------------|
| cmd1    | Does X      |
| cmd2    | Does Y      |

## Examples

### Example 1: Basic
[concrete, runnable example]

### Example 2: Advanced
[more complex example]

## Troubleshooting

### Issue: X happens
**Solution**: Do Y

## References

- [PATTERNS.md](references/PATTERNS.md) - Detailed patterns
- [External docs](https://example.com) - Official documentation
```

## Progressive Disclosure Model

Keep your SKILL.md focused. Use references for details.

| Layer | Token Budget | When Loaded |
|-------|--------------|-------------|
| Metadata | ~100 tokens | At startup (all skills) |
| SKILL.md body | < 5000 tokens | When skill activated |
| References | As needed | On demand |

### Guidelines

- **SKILL.md**: Under 400-500 lines
- **References**: One level deep only (SKILL.md → ref.md)
- **Front-load**: Put most important info first
- **Tables**: Easy to scan, low token usage

## File References

When referencing other files in your skill, use relative paths from the skill root:

See [the reference guide](references/REFERENCE.md) for details.

Keep file references one level deep from SKILL.md and avoid chaining references.

## Extraction Script

If your workflow includes an extraction step, run the script from the skill root:

`scripts/extract.py`

## Validation Checklist

Before publishing, verify:

- [ ] Folder name is lowercase with hyphens only
- [ ] `name` field exactly matches folder name
- [ ] `name` uses only lowercase letters, numbers, and hyphens
- [ ] `description` is 1-1024 characters
- [ ] Description includes WHAT + WHEN
- [ ] SKILL.md body under 500 lines
- [ ] Key information appears early
- [ ] Examples are concrete and runnable
- [ ] Reference links are valid
- [ ] No deeply nested reference chains
- [ ] Tested with GitHub Copilot

## Anti-Patterns to Avoid

| ❌ Bad | ✅ Good |
|--------|---------|
| 2000+ line SKILL.md | < 500 lines with references |
| Missing context in examples | Full context with explanations |
| Vague description | Specific WHAT + WHEN + keywords |
| Deeply nested references | One level deep only |
| Duplicating official docs | Link to authoritative sources |

## Salesforce-Specific Tips

When creating skills for Salesforce platforms:

1. **Include platform context**: SFCC, Marketing Cloud, Core, etc.
2. **Reference governor limits**: For Apex skills
3. **Note SFRA version compatibility**: For Commerce Cloud
4. **Include BM setup steps**: If configuration required
5. **Link to Salesforce docs**: Don't duplicate official content

## Templates

See [assets/skill-template.md](assets/skill-template.md) for a copy-paste starter.

## References

- [PATTERNS.md](references/PATTERNS.md) - Content organization patterns
- [REFERENCE.md](references/REFERENCE.md) - File reference rules and examples
- [VALIDATION.md](references/VALIDATION.md) - Detailed validation rules
- [agentskills.io](https://agentskills.io/specification) - Official specification

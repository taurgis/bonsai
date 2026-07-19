---
name: cli-design-principles
description: >
  General principles for designing well-behaved, human-first CLI tools. Use
  when designing command structure, naming flags and arguments, writing help
  text, handling errors, managing configuration, or deciding how a CLI should
  behave in interactive versus scripted contexts. Applies to any Node.js or
  oclif-based CLI, including Bonsai.
license: MIT
metadata:
  version: '1.0.0'
  sources:
    - https://clig.dev/
    - https://github.com/lirantal/nodejs-cli-apps-best-practices
---

# CLI Design Principles

Distilled from the Command Line Interface Guidelines (clig.dev) and the
Node.js CLI Apps Best Practices. Design for humans first; composability with
scripts and other programs follows from the same discipline, not against it.

## The basics (non-negotiable)

- Use an argument parsing library, never hand-parse `process.argv`. In this
  repository that library is oclif.
- Return exit code 0 on success, non-zero on failure. Scripts and agents
  branch on exit codes.
- Send primary output to stdout; send messaging (progress, warnings, errors)
  to stderr so piped output stays clean.
- Support `-h` and `--help` everywhere; a bare invocation that needs
  arguments prints concise help (description, an example, pointer to
  `--help`).

## Help and discoverability

- Help text leads with what the command does, then one or two example
  invocations, then flag docs. Examples are the most-read part — put the
  common case first.
- Suggest the next step: after an error, say what to try; after a multi-step
  setup, say what command comes next.
- If the user typo'd a command or flag, say what was received and list valid
  options.

## Flags and arguments

- Prefer flags to positional arguments; flags self-document at the call site.
- Follow existing conventions: `-f`/`--force`, `-q`/`--quiet`, `--json`,
  `--version`, `-h`/`--help` mean what they mean everywhere else.
- Full-length flag names are kebab-case; every flag has a long form so
  scripts stay readable.
- Never require a prompt to complete an operation: everything interactive
  must also be reachable by flags, or the CLI is unusable in CI and by
  agents.
- Confirm before doing anything destructive, and offer `--yes`/`-y` to skip
  the prompt explicitly.

## Errors

- An error message states what went wrong and what to do next. Bonsai's
  "Try this:" pattern is the house style.
- Never show a raw stack trace to a user; put stack traces behind a debug
  flag or environment variable.
- Catch errors you can explain; let truly unexpected ones fail loudly with a
  pointer to where to report them.

## Configuration and state

- Zero configuration by default: the tool works out of the box, with smart
  detection over required setup.
- Precedence order: command-line flags beat environment variables, which
  beat project config, which beats user config, which beats defaults.
- Follow the XDG base directory spec for where config and cache files live;
  clean up any files the tool creates that it no longer needs.

## Robustness

- Respect POSIX signals: on SIGINT/SIGTERM, exit promptly and never leave
  caches or state files corrupted.
- Validate input at trust boundaries — URLs, file paths, stdin, fetched
  content are untrusted.
- Responsiveness beats raw speed: print something within ~100ms so the user
  knows the tool is alive; show progress for anything long-running.
- Keep the dependency footprint small: install time is part of the UX, and
  every dependency is supply-chain surface.

## When to break a rule

Convention beats novelty, but "abandon a standard when it is demonstrably
harmful to productivity or user satisfaction" (clig.dev, quoting Raskin).
Break convention deliberately, in one documented place — never by accident.

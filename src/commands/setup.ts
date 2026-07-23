import { Args, Flags } from '@oclif/core';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { BaseCommand } from '../base-command.js';
import { atomicWriteFile } from '../lib/atomic-write.js';
import { resolveBinCommand } from '../lib/setup/bin-command.js';
import {
  SETUP_AGENTS,
  SETUP_AGENT_TARGETS,
  SETUP_HOOK_MARKER_SUFFIX,
} from '../lib/setup/agents.js';
import {
  InvalidHookFileError,
  planSessionStartHookInstall,
  type HookInstallPlan,
} from '../lib/setup/hook-file-io.js';
import { closestMatch, maxFuzzyDistance } from '../lib/text.js';
import type { SetupAgent, SetupResult } from '../lib/cli-result-types.js';

function isSetupAgent(value: string): value is SetupAgent {
  return (SETUP_AGENTS as readonly string[]).includes(value);
}

/** Maps a plan outcome to the reported status, remapping write outcomes to `would_*` under dry-run. */
function reportSetupStatus(
  planStatus: HookInstallPlan['status'],
  dryRun: boolean
): SetupResult['status'] {
  if (!dryRun) return planStatus;
  if (planStatus === 'unchanged') return 'unchanged';
  return planStatus === 'repaired' ? 'would_repair' : 'would_install';
}

const SETUP_STATUS_LABEL: Record<SetupResult['status'], string> = {
  installed: 'Installed',
  repaired: 'Repaired',
  unchanged: 'Already up to date:',
  would_install: '[dry-run] Would install',
  would_repair: '[dry-run] Would repair',
};

/**
 * Installs (or repairs) a `SessionStart` hook that runs `bonsai context` at the start of every
 * agent session, so the cache's current state is visible before the agent takes any action (AXI
 * principle 7: ambient context via session integrations).
 */
export default class Setup extends BaseCommand<typeof Setup> {
  static id = 'setup';
  static summary = 'Install a SessionStart hook that shows live cache context';
  static description =
    'Writes (or repairs) a SessionStart hook entry that runs `bonsai context` at the start of ' +
    'every session, so the agent sees the cache state before doing anything. Project-scoped by ' +
    'default (shareable via version control); pass --global for a user-level, machine-only install. ' +
    'Re-running is idempotent: an unchanged install is a no-op, and a stale executable path is repaired.';

  static examples = [
    {
      description: 'install the hook for this project (Claude Code)',
      command: '<%= config.bin %> setup claude-code',
    },
    {
      description: 'install the hook for this project (Codex)',
      command: '<%= config.bin %> setup codex',
    },
    {
      description: 'preview a user-level install without writing anything',
      command: '<%= config.bin %> setup claude-code --global --dry-run --json',
    },
  ];

  static args = {
    agent: Args.string({
      required: true,
      description: `agent to install the hook for (${SETUP_AGENTS.join(', ')})`,
    }),
  };

  static flags = {
    global: Flags.boolean({
      char: 'g',
      description: 'install to the user-level config instead of the project (default: project)',
    }),
    local: Flags.boolean({
      description: 'install to the project config (default; explicit form of the default)',
      aliases: ['project'],
    }),
    'dry-run': Flags.boolean({
      description: 'preview the install without writing anything',
      default: false,
    }),
  };

  static stdoutIsPrimaryData = true;

  private assertKnownAgent(agentArg: string): asserts agentArg is SetupAgent {
    if (isSetupAgent(agentArg)) return;
    const suggestion = closestMatch(agentArg, SETUP_AGENTS, maxFuzzyDistance(agentArg));
    const hint = suggestion ? ` Did you mean "${suggestion}"?` : '';
    if (agentArg === 'opencode') {
      this.error(
        'OpenCode is not supported by `setup` yet: its plugin hook signature for injecting ' +
          "session-start context isn't confirmed in official docs, so Bonsai won't guess at one. " +
          'See the "Ambient session context" docs for status.',
        { exit: 2, code: 'UNKNOWN_AGENT', suggestions: [`Use one of: ${SETUP_AGENTS.join(', ')}`] }
      );
    }
    this.error(
      `Unknown agent: "${agentArg}".${hint} Supported agents: ${SETUP_AGENTS.join(', ')}.`,
      {
        exit: 2,
        code: 'UNKNOWN_AGENT',
        suggestions: suggestion
          ? [`Use "${suggestion}": ${this.config.bin} setup ${suggestion}`]
          : [`Use one of: ${SETUP_AGENTS.join(', ')}`],
      }
    );
  }

  private assertScopeFlagsExclusive(): void {
    if (this.flags.global && this.flags.local) {
      this.error('--global and --local are mutually exclusive.', {
        exit: 2,
        code: 'CONFLICTING_FLAGS',
        suggestions: ['Pass --global or --local, not both.'],
      });
    }
  }

  async run(): Promise<SetupResult> {
    const agentArg = this.args.agent;
    this.assertKnownAgent(agentArg);
    this.assertScopeFlagsExclusive();

    const target = SETUP_AGENT_TARGETS[agentArg];
    const scope: SetupResult['scope'] = this.flags.global ? 'user' : 'project';
    const root = scope === 'user' ? homedir() : process.cwd();
    const path = join(root, target.relativePath);

    const binCommand = resolveBinCommand(process.argv[1] ?? this.config.bin);
    const command = `${binCommand} ${SETUP_HOOK_MARKER_SUFFIX}`;

    const existingContent = existsSync(path) ? readFileSync(path, 'utf-8') : null;
    let plan;
    try {
      plan = planSessionStartHookInstall(existingContent, {
        eventName: target.eventName,
        matcher: target.matcher,
        command,
        timeout: target.timeout,
        markerSuffix: SETUP_HOOK_MARKER_SUFFIX,
      });
    } catch (err) {
      if (err instanceof InvalidHookFileError) {
        this.error(`Cannot install into ${path}: ${err.message}.`, {
          exit: 1,
          code: 'INVALID_HOOK_FILE',
          suggestions: [
            'Fix or remove the existing file so it contains a single JSON object, then re-run setup.',
          ],
        });
      }
      throw err;
    }

    const dryRun = this.effectiveDryRun(this.flags['dry-run']);
    const status = reportSetupStatus(plan.status, dryRun);

    if (!dryRun && plan.status !== 'unchanged') {
      mkdirSync(dirname(path), { recursive: true });
      atomicWriteFile(path, plan.content);
    }

    if (!this.jsonEnabled()) {
      this.log(`${SETUP_STATUS_LABEL[status]} ${agentArg} SessionStart hook at ${path} (${scope})`);
    }

    return { agent: agentArg, scope, path, binCommand, status, dryRun };
  }
}

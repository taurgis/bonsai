import { Command, Flags } from '@oclif/core';
import { BaseCommand } from '../../../base-command.js';
import { isKnownKey, suggestKey, validKeysHint } from '../../../lib/config/index.js';
import type { ConfigKey, ConfigScope } from '../../../lib/config/index.js';

/**
 * Shared base for the four `research config` subcommands: the mutually-exclusive
 * scope-flag guard, the binary write-scope helper, and known-key validation.
 */
export abstract class ConfigCommand<T extends typeof Command> extends BaseCommand<T> {
  protected assertScopeFlagsExclusive(global?: boolean, local?: boolean): void {
    if (global && local) {
      this.error('--global and --local are mutually exclusive.', { exit: 2 });
    }
  }

  /** `--local` writes/reads the project file; otherwise the user-level file. */
  protected writeScope(local?: boolean): 'user' | 'project' {
    return local ? 'project' : 'user';
  }

  /** Read scope for get/list: an explicit `--global`/`--local`, else the merged effective view. */
  protected readScope(global?: boolean, local?: boolean): ConfigScope {
    if (global) return 'global';
    if (local) return 'local';
    return 'effective';
  }

  protected assertKnownKey(keyArg: string): asserts keyArg is ConfigKey {
    if (!isKnownKey(keyArg)) {
      const suggestion = suggestKey(keyArg);
      const hint = suggestion ? ` Did you mean: ${suggestion}?` : '';
      this.error(`Unknown config key: "${keyArg}".${hint} Valid keys: ${validKeysHint()}.`, {
        exit: 2,
      });
    }
  }
}

/** Build the `--global`/`--local` scope-flag pair with per-command descriptions. */
export function configScopeFlags(descriptions: { global: string; local: string }) {
  return {
    global: Flags.boolean({ char: 'g', description: descriptions.global }),
    local: Flags.boolean({
      description: descriptions.local,
      aliases: ['project'],
      charAliases: ['p'],
    }),
  };
}

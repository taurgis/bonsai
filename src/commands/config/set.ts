import { Args, Flags } from '@oclif/core';
import { ConfigCommand, configScopeFlags } from './base.js';
import { KEY_META, validKeysHint } from '../../lib/config/index.js';
import type { ConfigValues } from '../../lib/config/index.js';
import { persistConfigPatch } from '../../lib/config-persist.js';
import type { ConfigWriteResult } from '../../lib/cli-result-types.js';

export default class ConfigSet extends ConfigCommand<typeof ConfigSet> {
  static id = 'config set';
  static summary = 'Set a research configuration key';
  static description =
    'Persist a configuration value. Writes user-level config by default; pass --local for project-level config (.bonsai.json in cwd).\n\n' +
    `Valid keys: ${validKeysHint()}. The inline form \`<key>=<value>\` is also accepted.`;

  static examples = [
    {
      description: 'store research cache in the current project',
      command: '<%= config.bin %> config set storage project --local',
    },
    {
      description: 'set the user-level default with key=value',
      command: '<%= config.bin %> config set storage=global',
    },
  ];

  static args = {
    key: Args.string({ required: false, description: 'the configuration key to set' }),
    value: Args.string({ required: false, description: 'the value to assign' }),
  };

  static flags = {
    ...configScopeFlags({
      global: 'write user-level config (default)',
      local: 'write project-level config (.bonsai.json in cwd)',
    }),
    'dry-run': Flags.boolean({
      description: 'preview write without saving',
      default: false,
    }),
  };

  static stdoutIsPrimaryData = true;

  async run(): Promise<ConfigWriteResult> {
    const { keyArg, valueArg } = splitInlineKeyValue(this.args.key, this.args.value);

    this.validateConfigKeyAndScope(keyArg, this.flags.global, this.flags.local);

    const meta = KEY_META[keyArg];
    if (valueArg === undefined) {
      this.error(`Missing required argument: value for key "${keyArg}"`, {
        exit: 2,
        code: 'MISSING_ARGUMENT',
        suggestions: [
          meta.values
            ? `Use one of: ${meta.values.join(', ')}`
            : `Provide a value for ${keyArg}: ${meta.description}`,
        ],
      });
    }
    const parsed = meta.parseValue(valueArg);
    if (!meta.isValid(parsed)) {
      const guidance = meta.values ? `Valid values: ${meta.values.join(', ')}.` : meta.description;
      this.error(`Invalid value "${valueArg}" for "${keyArg}". ${guidance}`, {
        exit: 2,
        code: 'INVALID_VALUE',
        suggestions: meta.values?.map(
          (value) => `Set ${keyArg}: ${this.config.bin} config set ${keyArg} ${value}`
        ),
      });
    }

    const scope = this.writeScope(this.flags.local);
    const formatted = meta.format(parsed);
    const dryRun = this.effectiveDryRun(this.flags['dry-run']);
    if (dryRun) {
      if (!this.jsonEnabled()) this.log(`[dry-run] Would set ${keyArg} = ${formatted} (${scope})`);
      return { key: keyArg, value: parsed, scope, dryRun: true, status: 'would_set' };
    }

    const persisted = persistConfigPatch({
      scope,
      cwd: process.cwd(),
      configDir: this.config.configDir,
      patch: { [keyArg]: parsed } as Partial<ConfigValues>,
      action: 'set',
      bin: this.config.bin,
      key: keyArg,
    });
    if (!persisted.ok) {
      this.error(persisted.message, {
        exit: 1,
        code: persisted.code,
        suggestions: persisted.suggestions,
      });
    }

    if (!this.jsonEnabled()) this.log(`Set ${keyArg} = ${formatted} (${scope})`);
    return { key: keyArg, value: parsed, scope, dryRun: false, status: 'set' };
  }
}

/**
 * Accept the `key=value` convenience form alongside the canonical `key value`.
 * Splits only when no separate value positional was supplied, and on the FIRST `=`
 * so a value may itself contain `=`.
 */
function splitInlineKeyValue(
  rawKey: string | undefined,
  rawValue: string | undefined
): { keyArg: string | undefined; valueArg: string | undefined } {
  if (rawValue === undefined && rawKey !== undefined) {
    const eq = rawKey.indexOf('=');
    if (eq !== -1) {
      return { keyArg: rawKey.slice(0, eq), valueArg: rawKey.slice(eq + 1) };
    }
  }
  return { keyArg: rawKey, valueArg: rawValue };
}

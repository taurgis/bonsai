import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { atomicWriteFile } from '../atomic-write.js';
import type { ConfigValues } from './schema.js';
import { KEY_META, ALL_KEYS } from './schema.js';

/** Global, user-level config lives in the OCLIF config dir; project config sits at the repo root. */
export const USER_CONFIG_FILENAME = 'config.json';
export const PROJECT_CONFIG_FILENAME = '.bonsai.json';

interface ParsedConfigFile {
  values: Partial<ConfigValues>;
  /** One message per problem that made `parseConfigFile` drop the whole file or a key silently. */
  warnings: string[];
}

/**
 * Parse a config file, keeping only known keys with valid values. Unparseable JSON, a non-object
 * top level, or an invalid value for a known key degrades that part to "absent" rather than
 * throwing — callers that only need values (`readUserConfig`/`readProjectConfig`) ignore
 * `warnings`; {@link invalidConfigFileWarnings} surfaces them so the degradation is never silent.
 */
function parseConfigFile(
  filePath: string,
  raw: string,
  scopeFlag: '--global' | '--local',
  bin: string
): ParsedConfigFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      values: {},
      warnings: [
        `Ignoring ${filePath}: not valid JSON. Using the configured value or default instead. ` +
          `Fix the file by hand, or overwrite it with ${bin} config set <key> <value> ${scopeFlag}.`,
      ],
    };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return {
      values: {},
      warnings: [
        `Ignoring ${filePath}: expected a JSON object at the top level. Using the configured value or default instead.`,
      ],
    };
  }
  const obj = parsed as Record<string, unknown>;
  const values: Partial<ConfigValues> = {};
  const warnings: string[] = [];
  for (const key of ALL_KEYS) {
    const val = obj[key];
    if (val === undefined) continue;
    if (KEY_META[key].isValid(val)) {
      Object.assign(values, { [key]: val });
    } else {
      const validValues = KEY_META[key].values;
      const validValuesHint = validValues ? ` Valid values: ${validValues.join(', ')}.` : '';
      warnings.push(
        `Ignoring "${key}" in ${filePath}: invalid value ${JSON.stringify(val)}.${validValuesHint} ` +
          `Using the configured value or default instead.`
      );
    }
  }
  return { values, warnings };
}

// Only the "fix it" suggestion in a warning message names the binary; every value-only caller
// below (readUserConfig/readProjectConfig, and transitively write*Config) discards warnings
// entirely, so this default never reaches a user — it's a placeholder for an unused code path,
// not a claim about the real bin name. invalidConfigFileWarnings passes the real `this.config.bin`.
const DEFAULT_BIN = 'bonsai';

function readConfigFile(
  filePath: string,
  scopeFlag: '--global' | '--local',
  bin: string = DEFAULT_BIN
): ParsedConfigFile {
  if (!existsSync(filePath)) return { values: {}, warnings: [] };
  let raw: string;
  try {
    raw = readFileSync(filePath, 'utf-8');
  } catch {
    return { values: {}, warnings: [] };
  }
  return parseConfigFile(filePath, raw, scopeFlag, bin);
}

export function readUserConfig(configDir: string | undefined): Partial<ConfigValues> {
  if (!configDir) return {};
  return readConfigFile(join(configDir, USER_CONFIG_FILENAME), '--global').values;
}

export function readProjectConfig(cwd: string): Partial<ConfigValues> {
  return readConfigFile(join(cwd, PROJECT_CONFIG_FILENAME), '--local').values;
}

/**
 * Warnings for the user and project config files, so a corrupted or hand-edited file that would
 * otherwise silently degrade to `{}` (or drop just the offending key) is never a silent surprise —
 * mirrors {@link invalidEnvOverrideWarnings} for env vars. Empty when both files are missing,
 * unreadable, or valid.
 *
 * @param bin - CLI binary name (`this.config.bin`) for the "fix it" suggestion in a warning.
 */
export function invalidConfigFileWarnings(
  configDir: string | undefined,
  cwd: string,
  bin: string
): string[] {
  const warnings: string[] = [];
  if (configDir) {
    warnings.push(
      ...readConfigFile(join(configDir, USER_CONFIG_FILENAME), '--global', bin).warnings
    );
  }
  warnings.push(...readConfigFile(join(cwd, PROJECT_CONFIG_FILENAME), '--local', bin).warnings);
  return warnings;
}

function writeAtomically(filePath: string, data: unknown): void {
  atomicWriteFile(filePath, JSON.stringify(data, null, 2) + '\n');
}

function omitUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

export function writeUserConfig(configDir: string, patch: Partial<ConfigValues>): void {
  mkdirSync(configDir, { recursive: true });
  const filePath = join(configDir, USER_CONFIG_FILENAME);
  const merged = omitUndefined({ ...readUserConfig(configDir), ...patch });
  writeAtomically(filePath, { schemaVersion: 1, ...merged });
}

export function writeProjectConfig(cwd: string, patch: Partial<ConfigValues>): void {
  const filePath = join(cwd, PROJECT_CONFIG_FILENAME);
  const merged = omitUndefined({ ...readProjectConfig(cwd), ...patch });
  writeAtomically(filePath, { schemaVersion: 1, ...merged });
}

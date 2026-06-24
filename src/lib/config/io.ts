import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { atomicWriteFile } from '../atomic-write.js';
import type { ConfigValues } from './schema.js';
import { KEY_META, ALL_KEYS } from './schema.js';

/** Global, user-level config lives in the OCLIF config dir; project config sits at the repo root. */
export const USER_CONFIG_FILENAME = 'config.json';
export const PROJECT_CONFIG_FILENAME = '.bonsai.json';

/** Parse a config file, keeping only known keys with valid values. Invalid input degrades to {}. */
function parseConfigFile(raw: string): Partial<ConfigValues> {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    const obj = parsed as Record<string, unknown>;
    const result: Partial<ConfigValues> = {};
    for (const key of ALL_KEYS) {
      const val = obj[key];
      if (val !== undefined && KEY_META[key].isValid(val)) {
        Object.assign(result, { [key]: val });
      }
    }
    return result;
  } catch {
    return {};
  }
}

function readConfigFile(filePath: string): Partial<ConfigValues> {
  if (!existsSync(filePath)) return {};
  try {
    return parseConfigFile(readFileSync(filePath, 'utf-8'));
  } catch {
    return {};
  }
}

export function readUserConfig(configDir: string | undefined): Partial<ConfigValues> {
  if (!configDir) return {};
  return readConfigFile(join(configDir, USER_CONFIG_FILENAME));
}

export function readProjectConfig(cwd: string): Partial<ConfigValues> {
  return readConfigFile(join(cwd, PROJECT_CONFIG_FILENAME));
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

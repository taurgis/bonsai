import { Flags } from '@oclif/core';

/** Build the `--global`/`--local` scope-flag pair with per-command descriptions. */
export function scopeFlags(descriptions: { global: string; local: string }) {
  return {
    global: Flags.boolean({ char: 'g', description: descriptions.global }),
    local: Flags.boolean({
      description: descriptions.local,
      aliases: ['project'],
      charAliases: ['p'],
    }),
  };
}

/**
 * Rejects `--global`/`--local` passed together. Shared by every command with this scope-flag pair
 * (`config`, `setup`) so the guard, its message, and its error code can't drift between them.
 *
 * @param error - The command's own `this.error`, bound by the caller (it always throws, hence `never`).
 */
export function assertScopeFlagsExclusive(
  error: (message: string, options: { exit: 2; code: string; suggestions: string[] }) => never,
  global: boolean | undefined,
  local: boolean | undefined
): void {
  if (global && local) {
    error('--global and --local are mutually exclusive.', {
      exit: 2,
      code: 'CONFLICTING_FLAGS',
      suggestions: ['Pass --global or --local, not both.'],
    });
  }
}

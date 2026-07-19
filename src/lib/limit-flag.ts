import { Errors, Flags } from '@oclif/core';
import { EXIT_USAGE } from './cli-error-policy.js';

/**
 * Build an oclif integer `--limit` flag capped at `maxLimit`.
 *
 * @param maxLimit - Inclusive upper bound for accepted values.
 * @param defaultValue - Default when the flag is omitted.
 * @param description - Help text for the flag.
 * @returns An oclif custom flag definition.
 * @throws {Errors.CLIError} With code `INVALID_LIMIT` and exit {@link EXIT_USAGE} on bad input
 *   (thrown by oclif during parse, not by this factory itself).
 */
export function limitFlag(maxLimit: number, defaultValue: number, description: string) {
  return Flags.custom<number>({
    parse: async (input) => {
      if (!/^\d+$/.test(input)) {
        throw new Errors.CLIError(`Limit must be an integer between 1 and ${maxLimit}.`, {
          exit: EXIT_USAGE,
          code: 'INVALID_LIMIT',
          suggestions: [`Use an integer from 1 to ${maxLimit}.`],
        });
      }

      const value = Number(input);
      if (value < 1 || value > maxLimit) {
        throw new Errors.CLIError(`Limit must be between 1 and ${maxLimit}.`, {
          exit: EXIT_USAGE,
          code: 'INVALID_LIMIT',
          suggestions: [`Use a value from 1 to ${maxLimit}.`],
        });
      }

      return value;
    },
  })({
    default: defaultValue,
    description,
  });
}

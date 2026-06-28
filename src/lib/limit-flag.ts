import { Errors, Flags } from '@oclif/core';

export function limitFlag(max: number, defaultValue: number, description: string) {
  return Flags.custom<number>({
    parse: async (input) => {
      if (!/^\d+$/.test(input)) {
        throw new Errors.CLIError(`Limit must be an integer between 1 and ${max}.`, {
          exit: 2,
          code: 'INVALID_LIMIT',
        });
      }

      const value = Number(input);
      if (value < 1 || value > max) {
        throw new Errors.CLIError(`Limit must be between 1 and ${max}.`, {
          exit: 2,
          code: 'INVALID_LIMIT',
        });
      }

      return value;
    },
  })({
    default: defaultValue,
    description,
  });
}

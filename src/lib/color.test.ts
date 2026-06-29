import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { colors } from './color.js';

describe('color helpers', () => {
  const originalEnv = { ...process.env };
  // Keep track of the original values to restore them exactly
  let originalStdoutTty: any;
  let originalStderrTty: any;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.NO_COLOR;
    delete process.env.NODE_DISABLE_COLORS;
    delete process.env.FORCE_COLOR;
    // Isolate from the ambient terminal: TERM=dumb would otherwise suppress color in the
    // "color is supported" baseline cases.
    delete process.env.TERM;

    originalStdoutTty = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY');
    originalStderrTty = Object.getOwnPropertyDescriptor(process.stderr, 'isTTY');
  });

  afterEach(() => {
    process.env = originalEnv;

    if (originalStdoutTty) {
      Object.defineProperty(process.stdout, 'isTTY', originalStdoutTty);
    } else {
      // @ts-ignore
      delete process.stdout.isTTY;
    }

    if (originalStderrTty) {
      Object.defineProperty(process.stderr, 'isTTY', originalStderrTty);
    } else {
      // @ts-ignore
      delete process.stderr.isTTY;
    }
  });

  const setStdoutTty = (val: boolean | undefined) => {
    if (val === undefined) {
      // @ts-ignore
      delete process.stdout.isTTY;
    } else {
      Object.defineProperty(process.stdout, 'isTTY', {
        value: val,
        configurable: true,
        writable: true,
      });
    }
  };

  const setStderrTty = (val: boolean | undefined) => {
    if (val === undefined) {
      // @ts-ignore
      delete process.stderr.isTTY;
    } else {
      Object.defineProperty(process.stderr, 'isTTY', {
        value: val,
        configurable: true,
        writable: true,
      });
    }
  };

  it('formats text with ANSI codes when color is supported', () => {
    setStdoutTty(true);

    expect(colors.bold('text')).toBe('\x1b[1mtext\x1b[0m');
    expect(colors.cyan('text')).toBe('\x1b[36mtext\x1b[0m');
    expect(colors.gray('text')).toBe('\x1b[90mtext\x1b[0m');
    expect(colors.green('text')).toBe('\x1b[32mtext\x1b[0m');
    expect(colors.magenta('text')).toBe('\x1b[35mtext\x1b[0m');
    expect(colors.red('text')).toBe('\x1b[31mtext\x1b[0m');
    expect(colors.yellow('text')).toBe('\x1b[33mtext\x1b[0m');
  });

  it('returns plain text when color is disabled via environment variables', () => {
    setStdoutTty(true);
    process.env.NO_COLOR = '1';

    expect(colors.bold('text')).toBe('text');
    expect(colors.cyan('text')).toBe('text');
  });

  it('disables color for any non-empty NO_COLOR value, including "0" (clig.dev/no-color.org)', () => {
    setStdoutTty(true);
    for (const value of ['0', 'false', 'yes', 'anything']) {
      process.env.NO_COLOR = value;
      expect(colors.bold('text'), `NO_COLOR=${value}`).toBe('text');
    }
  });

  it('treats an empty NO_COLOR as unset and keeps color on a TTY', () => {
    setStdoutTty(true);
    process.env.NO_COLOR = '';

    expect(colors.cyan('text')).toBe('\x1b[36mtext\x1b[0m');
  });

  it('disables color when TERM=dumb (cannot render ANSI)', () => {
    setStdoutTty(true);
    process.env.TERM = 'dumb';

    expect(colors.bold('text')).toBe('text');
  });

  it('lets NO_COLOR win over a TTY but FORCE_COLOR still overrides NO_COLOR', () => {
    setStdoutTty(true);
    process.env.NO_COLOR = '1';
    process.env.FORCE_COLOR = '1';

    expect(colors.bold('text')).toBe('\x1b[1mtext\x1b[0m');
  });

  it('treats FORCE_COLOR=0 as off rather than a force-on signal', () => {
    setStdoutTty(false);
    setStderrTty(false);
    process.env.FORCE_COLOR = '0';

    expect(colors.bold('text')).toBe('text');
  });

  it('treats documented off-values of FORCE_COLOR ("false", "") as not forcing color on', () => {
    setStdoutTty(false);
    setStderrTty(false);
    for (const value of ['false', '']) {
      process.env.FORCE_COLOR = value;
      expect(colors.bold('text'), `FORCE_COLOR=${JSON.stringify(value)}`).toBe('text');
    }
  });

  it('returns plain text when TTY is not supported and FORCE_COLOR is absent', () => {
    setStdoutTty(false);
    setStderrTty(false);

    expect(colors.bold('text')).toBe('text');
  });

  it('supports color if FORCE_COLOR is set even without TTY', () => {
    setStdoutTty(false);
    setStderrTty(false);
    process.env.FORCE_COLOR = '1';

    expect(colors.bold('text')).toBe('\x1b[1mtext\x1b[0m');
  });
});

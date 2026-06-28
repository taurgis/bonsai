import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { colors, highlightQuery } from './color.js';

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

  it('highlights query terms within a text snippet', () => {
    setStdoutTty(true);

    const text = 'This is about React Suspense and components.';
    const query = ['react', 'suspense'];
    const highlighted = highlightQuery(text, query);

    expect(highlighted).toContain('\x1b[1m\x1b[33mReact\x1b[0m');
    expect(highlighted).toContain('\x1b[1m\x1b[33mSuspense\x1b[0m');
  });

  it('returns unchanged text if text is empty or no query terms are provided', () => {
    expect(highlightQuery('', ['term'])).toBe('');
    expect(highlightQuery('some text', [])).toBe('some text');
  });
});

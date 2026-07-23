import { describe, it, expect, vi } from 'vitest';
import { decode } from '@toon-format/toon';
import ResearchList from './commands/list.js';
import ResearchStatus from './commands/status.js';
import ResearchImport from './commands/import.js';
import { useIsolatedCache } from '../tests/helpers/isolated-cache.js';

/** Capture stdout writes (both --json's console.log and --toon's ux.stdout share this sink). */
async function captureStdout(
  fn: () => Promise<unknown>
): Promise<{ result: unknown; text: string }> {
  const writes: string[] = [];
  const spy = vi
    .spyOn(console, 'log')
    .mockImplementation((...args: unknown[]) => void writes.push(args.map(String).join(' ')));
  try {
    const result = await fn();
    return { result, text: writes.join('\n').trim() };
  } finally {
    spy.mockRestore();
  }
}

describe('--toon output', () => {
  useIsolatedCache();

  it('encodes the same envelope --json would, for a successful multi-field result', async () => {
    const readSpy = vi
      .spyOn(ResearchImport.prototype as any, 'readStdin')
      .mockResolvedValue('# Toon Encode Test');
    await ResearchImport.run(['https://example.com/toon-encode', '--stdin', '--topic', 'ToonTest']);
    readSpy.mockRestore();

    const { text: jsonText } = await captureStdout(() => ResearchList.run(['--json']));
    const jsonEnvelope = JSON.parse(jsonText);

    const { text: toonText } = await captureStdout(() => ResearchList.run(['--toon']));
    // TOON's own syntax (indentation, `[N]{fields}:` headers) proves it isn't just JSON reformatted.
    expect(toonText).not.toBe(jsonText);
    expect(toonText).toContain('command: list');
    const decoded = decode(toonText);

    expect(decoded).toEqual(jsonEnvelope);
  });

  it('encodes an error envelope identically to --json (schema, code, exit)', async () => {
    const { text: jsonText } = await captureStdout(() =>
      ResearchStatus.run(['https://example.com/toon-error-miss', '--json']).catch(() => undefined)
    );
    const jsonEnvelope = JSON.parse(jsonText);
    expect(jsonEnvelope.code).toBe('CACHE_MISS');

    const { text: toonText } = await captureStdout(() =>
      ResearchStatus.run(['https://example.com/toon-error-miss', '--toon']).catch(() => undefined)
    );
    const decoded = decode(toonText) as any;

    expect(decoded.code).toBe('CACHE_MISS');
    expect(decoded.ok).toBe(false);
    expect(decoded.exitCode).toBe(1);
    // TOON's encoder always writes a key it sees, even for an `undefined` value (`ref: null` here),
    // where JSON.stringify drops that key outright — toMatchObject tolerates that harmless extra key.
    expect(decoded).toMatchObject(jsonEnvelope);
  });

  it('leaves --json output completely unchanged (no regression) when --toon is not passed', async () => {
    const { text } = await captureStdout(() => ResearchList.run(['--json']));
    const envelope = JSON.parse(text);
    expect(envelope).toMatchObject({ schemaVersion: 1, command: 'list', ok: true, exitCode: 0 });
  });

  it('rejects combining --json and --toon with CONFLICTING_FLAGS at exit 2', async () => {
    // --json wins jsonEnabled() here (both flags set jsonEnabled() true), so oclif's own error
    // catch logs the JSON envelope and resolves rather than rejecting — same contract as any other
    // usage error under --json (see the CACHE_MISS envelope test above). Reuses the existing
    // CONFLICTING_FLAGS code shared by every other mutually-exclusive-flag rejection in this CLI.
    const { text } = await captureStdout(() => ResearchList.run(['--json', '--toon']));
    const envelope = JSON.parse(text);
    expect(envelope.code).toBe('CONFLICTING_FLAGS');
    expect(envelope.exitCode).toBe(2);
    expect(envelope.ok).toBe(false);
  });

  it('suppresses human-mode output under --toon just like --json (no table, no tips)', async () => {
    const readSpy = vi
      .spyOn(ResearchImport.prototype as any, 'readStdin')
      .mockResolvedValue('# Toon Human Suppression');
    await ResearchImport.run(['https://example.com/toon-human-suppress', '--stdin']);
    readSpy.mockRestore();

    const warnSpy = vi.spyOn(ResearchStatus.prototype as any, 'warn').mockImplementation(() => '');
    try {
      await ResearchStatus.run(['https://example.com/toon-human-suppress', '--toon']);
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });
});

/** A single hook handler entry inside a matcher group (Claude Code / Codex hook-file shape). */
interface HookHandler {
  type: string;
  command: string;
  timeout?: number;
  [extra: string]: unknown;
}

/** A matcher group: one condition plus the handlers that run when it matches. */
interface HookMatcherGroup {
  matcher?: string;
  hooks: HookHandler[];
  [extra: string]: unknown;
}

/** The SessionStart hook Bonsai wants installed. */
export interface SessionStartHookSpec {
  /** Hook event name, e.g. `"SessionStart"`. */
  eventName: string;
  matcher: string;
  /** Full command to run (already resolved to a PATH-verified name or absolute path). */
  command: string;
  timeout: number;
  /**
   * Suffix a `command` string must end with to be recognized as Bonsai's own entry (rather than
   * some unrelated hook a user already configured). All of Bonsai's setup-installed commands end
   * in `context`, so that's what identifies "this is ours" for idempotent repair.
   */
  markerSuffix: string;
}

/** Outcome of planning a hook-file install: what changed, and the file content to persist. */
export interface HookInstallPlan {
  status: 'installed' | 'repaired' | 'unchanged';
  content: string;
}

/** Thrown when an existing hook file can't be safely merged into (not JSON, or not an object). */
export class InvalidHookFileError extends Error {}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Whether `command`'s trailing word is exactly `markerSuffix` — a substring match alone would
 * false-positive on an unrelated command that merely ends with the same letters (e.g. a user's own
 * `load_context` hook), silently claiming and overwriting it as Bonsai's.
 */
function endsWithMarkerWord(command: string, markerSuffix: string): boolean {
  const trimmed = command.trim();
  return trimmed === markerSuffix || trimmed.endsWith(` ${markerSuffix}`);
}

function isBonsaiHandler(handler: unknown, markerSuffix: string): handler is HookHandler {
  return (
    isPlainObject(handler) &&
    typeof handler.command === 'string' &&
    endsWithMarkerWord(handler.command, markerSuffix)
  );
}

function serialize(root: Record<string, unknown>): string {
  return `${JSON.stringify(root, null, 2)}\n`;
}

/**
 * Parses an existing hook-file's content into its root JSON object, or `{}` when the file doesn't
 * exist yet. Deliberately refuses (rather than silently discarding) content that isn't a JSON
 * object — the file may carry a user's own unrelated hooks, and Bonsai must never clobber content
 * it can't understand.
 *
 * @throws {InvalidHookFileError} When `existingContent` is set but isn't a JSON object.
 */
function parseHookFileRoot(existingContent: string | null): Record<string, unknown> {
  if (existingContent === null || existingContent.trim() === '') return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(existingContent);
  } catch (err) {
    throw new InvalidHookFileError(`not valid JSON: ${(err as Error).message}`);
  }
  if (!isPlainObject(parsed)) {
    throw new InvalidHookFileError('expected a JSON object at the top level');
  }
  return parsed;
}

/**
 * Plans installing or repairing a Bonsai-managed `SessionStart` hook entry inside an existing (or
 * not-yet-created) hook-config file, without touching any other hooks already in that file (AXI
 * rules: explicit opt-in install, path repair, idempotent). Pure — callers own reading the
 * existing file and persisting `content` (see `setup.ts`).
 *
 * - No existing Bonsai entry for this event → append a new matcher group (`installed`).
 * - An existing Bonsai entry with a stale `command` → update it in place (`repaired`).
 * - An existing Bonsai entry with the same `command` → no-op, original bytes returned (`unchanged`).
 *
 * @throws {InvalidHookFileError} When `existingContent` isn't a mergeable JSON object.
 */
export function planSessionStartHookInstall(
  existingContent: string | null,
  spec: SessionStartHookSpec
): HookInstallPlan {
  const root = parseHookFileRoot(existingContent);
  const hooks = isPlainObject(root.hooks) ? { ...root.hooks } : {};
  const eventGroups: HookMatcherGroup[] = Array.isArray(hooks[spec.eventName])
    ? [...(hooks[spec.eventName] as HookMatcherGroup[])]
    : [];

  for (const group of eventGroups) {
    if (!isPlainObject(group) || !Array.isArray(group.hooks)) continue;
    const index = group.hooks.findIndex((handler) => isBonsaiHandler(handler, spec.markerSuffix));
    if (index === -1) continue;

    const existingHandler = group.hooks[index] as HookHandler;
    if (existingHandler.command === spec.command) {
      // Byte-identical no-op: return the original content rather than a reserialized copy, so a
      // repeated install never churns the file's formatting.
      return { status: 'unchanged', content: existingContent ?? serialize(root) };
    }
    group.hooks[index] = { ...existingHandler, command: spec.command };
    hooks[spec.eventName] = eventGroups;
    root.hooks = hooks;
    return { status: 'repaired', content: serialize(root) };
  }

  eventGroups.push({
    matcher: spec.matcher,
    hooks: [{ type: 'command', command: spec.command, timeout: spec.timeout }],
  });
  hooks[spec.eventName] = eventGroups;
  root.hooks = hooks;
  return { status: 'installed', content: serialize(root) };
}

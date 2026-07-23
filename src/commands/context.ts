import { BaseCommand } from '../base-command.js';
import { loadStoreRoots } from '../lib/research/store-roots.js';
import { buildContextDashboard } from '../lib/research/context-dashboard.js';
import { NO_TOPIC_LABEL, formatTip, pluralize, sanitizeForTerminal } from '../lib/text.js';
import { colors } from '../lib/color.js';
import type { ContextDashboard } from '../lib/cli-result-types.js';

const FRESHNESS_COLOR: Record<'fresh' | 'stale_grace' | 'stale_expired', (t: string) => string> = {
  fresh: colors.green,
  stale_grace: colors.yellow,
  stale_expired: colors.red,
};

/**
 * Compact, directory-scoped cache summary (AXI principle 7: ambient session-start context).
 * Plain-text human output is deliberately short — it's meant to be piped verbatim into a
 * SessionStart hook's `additionalContext` by `bonsai setup`, so every line here is also a
 * reasonable thing for an agent to read unprompted at the start of a session.
 */
export default class Context extends BaseCommand<typeof Context> {
  static id = 'context';
  static summary = 'Show a compact cache dashboard for ambient session context';
  static description =
    'Print a short summary of the current research cache: total entries, a freshness ' +
    'breakdown, and the most recently touched pages. This is what `bonsai setup` wires into a ' +
    "SessionStart hook, so a session starts with the cache's state already visible.";

  static examples = [
    {
      description: 'preview what a SessionStart hook would show',
      command: '<%= config.bin %> context',
    },
    {
      description: 'get the dashboard as JSON',
      command: '<%= config.bin %> context --json',
    },
  ];

  static stdoutIsPrimaryData = true;

  private logDashboard(dashboard: ContextDashboard): void {
    if (this.jsonEnabled()) return;

    if (dashboard.total === 0) {
      this.log(`${this.config.bin} cache: 0 entries found.`);
      this.log(formatTip(`populate the cache: ${colors.cyan(`${this.config.bin} <url>`)}`));
      return;
    }

    const { fresh, stale_grace: staleGrace, stale_expired: staleExpired } = dashboard.byFreshness;
    this.log(
      `${this.config.bin} cache: ${dashboard.total} ${pluralize(dashboard.total, 'entry', 'entries')} ` +
        `(${fresh} fresh, ${staleGrace} stale_grace, ${staleExpired} stale_expired)`
    );
    for (const entry of dashboard.entries) {
      const topicStr = entry.topic
        ? colors.cyan(sanitizeForTerminal(entry.topic))
        : colors.gray(NO_TOPIC_LABEL);
      const freshnessStr = FRESHNESS_COLOR[entry.freshness](entry.freshness);
      const url = entry.sourceUrls[0] ?? '';
      this.log(`- [${topicStr}] ${freshnessStr} — ${colors.gray(url)}`);
    }
    if (dashboard.total > dashboard.shown) {
      this.log(
        formatTip(`see all ${dashboard.total} entries: ${colors.cyan(`${this.config.bin} list`)}`)
      );
    }
    this.log(formatTip(`research a new page: ${colors.cyan(`${this.config.bin} <url>`)}`));
  }

  async run(): Promise<ContextDashboard> {
    const roots = loadStoreRoots({
      configDir: this.config.configDir,
      cwd: process.cwd(),
      dataDir: this.config.dataDir,
    });
    const dashboard = buildContextDashboard(roots.readRoots, new Date(), {
      persistIndex: !this.readOnly,
    });
    this.logDashboard(dashboard);
    return dashboard;
  }
}

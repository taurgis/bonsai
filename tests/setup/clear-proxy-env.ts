import { ALL_PROXY_ENV_VARS } from '../../src/lib/research/proxy.js';

// Running inside a sandboxed dev environment (e.g. Claude Code's remote sandbox) sets these to
// route egress through a proxy. Left as-is, they'd silently flip every test onto the proxy
// codepath in fetcher.ts/browser.ts regardless of what the test intends to exercise.
for (const name of ALL_PROXY_ENV_VARS) {
  delete process.env[name];
}

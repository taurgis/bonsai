#!/usr/bin/env node
/**
 * Manual CLI audit entry point.
 * Usage: pnpm audit:cli
 *        AUDIT_NETWORK=1 pnpm audit:cli   # optional live network scenarios
 */
import { createHarness, ensureBuilt } from './audit/harness.mjs';
import { createFixtures } from './audit/fixtures.mjs';
import registerHelp from './audit/scenarios/help.mjs';
import registerJsonEnvelope from './audit/scenarios/json-envelope.mjs';
import registerFetch from './audit/scenarios/fetch.mjs';
import registerInspectStatus from './audit/scenarios/inspect-status.mjs';
import registerSearch from './audit/scenarios/search.mjs';
import registerList from './audit/scenarios/list.mjs';
import registerPrune from './audit/scenarios/prune.mjs';
import registerImport from './audit/scenarios/import.mjs';
import registerConfig from './audit/scenarios/config.mjs';
import registerCommandNotFound from './audit/scenarios/command-not-found.mjs';
import registerEnv from './audit/scenarios/env.mjs';
import registerColor from './audit/scenarios/color.mjs';
import registerErrorCodes from './audit/scenarios/error-codes.mjs';

ensureBuilt();

const harness = createHarness();
const fixtures = createFixtures(harness);

const scenarios = [
  registerHelp,
  registerJsonEnvelope,
  registerFetch,
  registerInspectStatus,
  registerSearch,
  registerList,
  registerPrune,
  registerImport,
  registerConfig,
  registerCommandNotFound,
  registerEnv,
  registerColor,
  registerErrorCodes,
];

for (const register of scenarios) {
  register(harness, fixtures);
}

harness.report();

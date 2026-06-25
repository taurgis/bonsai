import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  decodeJwtPayload,
  isTokenValid,
  getTokenExpiryMs,
  parseAuraToken,
  applyTokenExpiry,
  loadToken,
  storeToken,
  COVEO_DEFAULTS,
  type TokenInfo,
} from './token.js';

// A throwaway JWT (header.payload.signature) whose payload carries exp + filterer.
function makeJwt(payload: Record<string, unknown>): string {
  const part = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  return `${part({ alg: 'none' })}.${part(payload)}.sig`;
}

describe('salesforce token helpers', () => {
  it('decodeJwtPayload decodes the middle segment', () => {
    expect(decodeJwtPayload(makeJwt({ exp: 123, filterer: '@source==Help' }))).toEqual({
      exp: 123,
      filterer: '@source==Help',
    });
    expect(decodeJwtPayload('garbage')).toBeNull();
  });

  it('isTokenValid respects the expiry skew', () => {
    expect(isTokenValid(Date.now() + 60 * 60 * 1000)).toBe(true);
    expect(isTokenValid(Date.now() - 1000)).toBe(false);
    expect(isTokenValid(null)).toBe(false);
  });

  it('getTokenExpiryMs converts second-precision exp to milliseconds', () => {
    const expSeconds = 2_000_000_000; // year 2033, in seconds
    expect(getTokenExpiryMs(makeJwt({ exp: expSeconds }))).toBe(expSeconds * 1000);
  });

  it('parseAuraToken extracts a bare JWT return value and derives filterer from it', () => {
    const jwt = makeJwt({ exp: 2_000_000_000, filterer: '@commonsource==Help' });
    const body = `for(;;);${JSON.stringify({
      actions: [{ state: 'SUCCESS', returnValue: jwt }],
    })}`;
    const token = parseAuraToken(body);
    expect(token?.accessToken).toBe(jwt);
    expect(token?.filterer).toBe('@commonsource==Help');
    expect(token?.searchHub).toBe('HTCommunity'); // default applied
  });

  it('parseAuraToken extracts a JSON return value', () => {
    const jwt = makeJwt({ exp: 2_000_000_000 });
    const body = JSON.stringify({
      actions: [{ state: 'SUCCESS', returnValue: { accessToken: jwt, searchHub: 'Custom' } }],
    });
    const token = parseAuraToken(body);
    expect(token?.accessToken).toBe(jwt);
    expect(token?.searchHub).toBe('Custom');
  });

  it('parseAuraToken returns null for errored or empty payloads', () => {
    expect(parseAuraToken('not json')).toBeNull();
    expect(parseAuraToken(JSON.stringify({ actions: [{ state: 'ERROR' }] }))).toBeNull();
    expect(parseAuraToken(JSON.stringify({ actions: [] }))).toBeNull();
  });

  it('getTokenExpiryMs returns null when no exp claim is present', () => {
    expect(getTokenExpiryMs(makeJwt({ filterer: 'x' }))).toBeNull();
  });

  it('getTokenExpiryMs passes through millisecond-precision exp unchanged', () => {
    const expMs = 2_000_000_000_000; // already milliseconds
    expect(getTokenExpiryMs(makeJwt({ exp: expMs }))).toBe(expMs);
  });

  it('parseAuraToken strips the )]}\\u0027 anti-JSON-hijack prefix', () => {
    const jwt = makeJwt({ exp: 2_000_000_000 });
    const body = `)]}',\n${JSON.stringify({ actions: [{ state: 'SUCCESS', returnValue: jwt }] })}`;
    expect(parseAuraToken(body)?.accessToken).toBe(jwt);
  });

  it('parseAuraToken reads a nested returnValue.returnValue object', () => {
    const jwt = makeJwt({ exp: 2_000_000_000 });
    const body = JSON.stringify({
      actions: [{ state: 'SUCCESS', returnValue: { returnValue: JSON.stringify({ token: jwt }) } }],
    });
    expect(parseAuraToken(body)?.accessToken).toBe(jwt);
  });

  it('parseAuraToken returns null when the returnValue has no recognizable token', () => {
    const body = JSON.stringify({ actions: [{ state: 'SUCCESS', returnValue: { nope: 1 } }] });
    expect(parseAuraToken(body)).toBeNull();
  });

  it('applyTokenExpiry defaults to a ~24h TTL when no exp can be derived', () => {
    const before = Date.now();
    const out = applyTokenExpiry({
      accessToken: makeJwt({}),
      ...COVEO_DEFAULTS,
      filterer: null,
      expiresAtMs: 0,
    } as TokenInfo);
    expect(out.expiresAtMs).toBeGreaterThan(before + 23 * 60 * 60 * 1000);
  });

  it('applyTokenExpiry is a no-op when there is no accessToken', () => {
    const input = { accessToken: '', expiresAtMs: 0 } as TokenInfo;
    expect(applyTokenExpiry(input)).toBe(input);
  });
});

describe('token cache (storeToken / loadToken)', () => {
  let cacheHome: string;
  const original = process.env.XDG_CACHE_HOME;

  beforeEach(() => {
    cacheHome = mkdtempSync(join(tmpdir(), 'sf-token-'));
    process.env.XDG_CACHE_HOME = cacheHome;
  });

  afterEach(() => {
    if (original === undefined) delete process.env.XDG_CACHE_HOME;
    else process.env.XDG_CACHE_HOME = original;
    rmSync(cacheHome, { recursive: true, force: true });
  });

  const token: TokenInfo = {
    accessToken: makeJwt({ exp: 2_000_000_000 }),
    organizationId: COVEO_DEFAULTS.organizationId,
    searchHub: 'HTCommunity',
    endpointBase: COVEO_DEFAULTS.endpointBase,
    clientUri: COVEO_DEFAULTS.clientUri,
    filterer: '@source==Help',
    expiresAtMs: 0,
  };

  it('storeToken round-trips through loadToken with restored defaults', () => {
    storeToken(token);
    const loaded = loadToken();
    expect(loaded?.accessToken).toBe(token.accessToken);
    expect(loaded?.filterer).toBe('@source==Help');
    expect(loaded?.expiresAtMs).toBe(2_000_000_000 * 1000); // derived from the JWT exp
  });

  it('storeToken writes the cache file with 0600 permissions', () => {
    storeToken(token);
    const path = join(cacheHome, 'bonsai', 'salesforce-coveo-token.json');
    expect((statSync(path).mode & 0o777).toString(8)).toBe('600');
    expect(JSON.parse(readFileSync(path, 'utf8')).accessToken).toBe(token.accessToken);
  });

  it('loadToken returns null when the cache file is missing', () => {
    expect(loadToken()).toBeNull();
  });

  it('loadToken returns null for a cached entry without an accessToken', () => {
    const dir = join(cacheHome, 'bonsai');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'salesforce-coveo-token.json'), JSON.stringify({ searchHub: 'x' }));
    expect(loadToken()).toBeNull();
  });

  it('loadToken returns null when the cache file is corrupt JSON', () => {
    const dir = join(cacheHome, 'bonsai');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'salesforce-coveo-token.json'), '{ not json');
    expect(loadToken()).toBeNull();
  });
});

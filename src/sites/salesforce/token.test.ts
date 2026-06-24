import { describe, it, expect } from 'vitest';
import { decodeJwtPayload, isTokenValid, getTokenExpiryMs, parseAuraToken } from './token.js';

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
});

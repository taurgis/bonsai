import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

// Salesforce Help routes anonymous doc search through a public Coveo org. These are
// the published defaults for that org; they are not user credentials.
export const COVEO_DEFAULTS = {
  organizationId: 'org62salesforce',
  searchHub: 'HTCommunity',
  endpointBase: 'https://help.salesforce.com/services/apexrest/coveo',
  clientUri: 'https://platform.cloud.coveo.com',
} as const;

const DEFAULT_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const TOKEN_EXPIRY_SKEW_MS = 2 * 60 * 1000;

export interface TokenInfo {
  accessToken: string;
  organizationId: string;
  searchHub: string;
  endpointBase: string;
  clientUri: string;
  filterer: string | null;
  expiresAtMs: number;
}

export function isTokenValid(expiresAtMs: number | null | undefined): boolean {
  if (!Number.isFinite(expiresAtMs)) return false;
  return Date.now() + TOKEN_EXPIRY_SKEW_MS < (expiresAtMs as number);
}

export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length < 2 || !parts[1]) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

export function getTokenExpiryMs(accessToken: string): number | null {
  const payload = decodeJwtPayload(accessToken);
  const rawExp = payload?.exp ?? payload?.expires_at ?? payload?.expiresAt;
  const expNumber = Number(rawExp);
  if (rawExp === undefined || rawExp === null || !Number.isFinite(expNumber)) return null;
  // JWT `exp` is seconds; values past year ~33658 are already milliseconds.
  return expNumber > 1_000_000_000_000 ? expNumber : expNumber * 1000;
}

export function applyTokenExpiry(tokenInfo: TokenInfo): TokenInfo {
  if (!tokenInfo?.accessToken) return tokenInfo;
  const expiresAtMs =
    tokenInfo.expiresAtMs ||
    getTokenExpiryMs(tokenInfo.accessToken) ||
    Date.now() + DEFAULT_TOKEN_TTL_MS;
  return { ...tokenInfo, expiresAtMs };
}

function stripAuraResponsePrefix(text: string): string {
  return text
    .trim()
    .replace(/^for\(;;\);/, '')
    .replace(/^\)\]\}',?/, '')
    .trim();
}

/**
 * Parses the access token out of a Salesforce Aura `getToken` response body.
 * Returns null when the payload is missing, errored, or lacks a token.
 */
export function parseAuraToken(rawResponseBody: string): TokenInfo | null {
  let payload: any;
  try {
    payload = JSON.parse(stripAuraResponsePrefix(rawResponseBody));
  } catch {
    return null;
  }

  const action = Array.isArray(payload?.actions) ? payload.actions[0] : null;
  if (!action || (action.state && action.state !== 'SUCCESS')) return null;

  let returnValue = action.returnValue ?? null;
  if (typeof returnValue?.returnValue === 'string') returnValue = returnValue.returnValue;

  const fields = readTokenFields(returnValue);
  const accessToken = fields.accessToken;
  if (!accessToken) return null;

  let filterer = fields.filterer;
  const jwtFilterer = decodeJwtPayload(accessToken)?.filterer;
  if (!filterer && typeof jwtFilterer === 'string') filterer = jwtFilterer;

  return applyTokenExpiry({
    accessToken,
    organizationId: fields.organizationId || COVEO_DEFAULTS.organizationId,
    searchHub: fields.searchHub || COVEO_DEFAULTS.searchHub,
    endpointBase: fields.endpointBase || COVEO_DEFAULTS.endpointBase,
    clientUri: fields.clientUri || COVEO_DEFAULTS.clientUri,
    filterer,
    expiresAtMs: 0,
  });
}

type TokenFields = { accessToken: string | null; filterer: string | null } & Partial<
  Pick<TokenInfo, 'organizationId' | 'searchHub' | 'endpointBase' | 'clientUri'>
>;

function readTokenFields(returnValue: unknown): TokenFields {
  if (typeof returnValue === 'string') {
    const trimmed = returnValue.trim();
    if (/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/.test(trimmed)) {
      return { accessToken: trimmed, filterer: null };
    }
    if (trimmed.startsWith('{')) {
      try {
        return readTokenFields(JSON.parse(trimmed));
      } catch {
        return { accessToken: null, filterer: null };
      }
    }
    return { accessToken: null, filterer: null };
  }
  if (returnValue && typeof returnValue === 'object') {
    const v = returnValue as Record<string, string | undefined>;
    return {
      accessToken: v.accessToken || v.token || v.authToken || v.access_token || null,
      organizationId: v.organizationId || v.organization || v.sfOrganizationId,
      searchHub: v.searchHub,
      endpointBase: v.platformUri || v.clientUri,
      clientUri: v.clientUri,
      filterer: v.filterer || v.filter || null,
    };
  }
  return { accessToken: null, filterer: null };
}

function tokenCachePath(): string {
  const base = process.env.XDG_CACHE_HOME || join(homedir(), '.cache');
  return join(base, 'forward-nexus-research', 'salesforce-coveo-token.json');
}

export function loadToken(): TokenInfo | null {
  try {
    const parsed = JSON.parse(readFileSync(tokenCachePath(), 'utf8')) as Partial<TokenInfo>;
    if (!parsed.accessToken) return null;
    return applyTokenExpiry({
      ...COVEO_DEFAULTS,
      filterer: null,
      expiresAtMs: 0,
      ...parsed,
    } as TokenInfo);
  } catch {
    return null;
  }
}

// ponytail: token persisted as plaintext on disk. It is a public anonymous Coveo
// search token (no user data, ~24h TTL), so the OS keychain isn't warranted. Move to
// keytar here if these modules ever hold a privileged token.
export function storeToken(tokenInfo: TokenInfo): void {
  try {
    const path = tokenCachePath();
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(applyTokenExpiry(tokenInfo)), {
      encoding: 'utf8',
      mode: 0o600,
    });
  } catch {
    // A non-writable cache dir just means we re-mint via the browser next time.
  }
}

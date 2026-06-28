import { isIP } from 'node:net';

/**
 * Checks if a literal IPv4 address is in a safe range.
 * Rejects loopback, private RFC1918, and link-local ranges.
 */
export function isSafeIpv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) return false;
  const [a, b, c] = parts;
  if (a === undefined || b === undefined || c === undefined) return false;

  // Loopback: 127.0.0.0/8
  if (a === 127) return false;
  // Private (RFC1918): 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
  if (a === 10) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  // Link-local: 169.254.0.0/16
  if (a === 169 && b === 254) return false;
  return true;
}

/**
 * Checks if a literal IPv6 address is in a safe range.
 * Rejects loopback, unspecified, link-local, and mapped unsafe IPv4 ranges.
 */
export function isSafeIpv6(ip: string): boolean {
  const cleanIp = ip.toLowerCase().trim();
  // Loopback: ::1
  if (cleanIp === '::1' || cleanIp === '0:0:0:0:0:0:0:1') return false;
  // Unspecified: ::
  if (cleanIp === '::' || cleanIp === '0:0:0:0:0:0:0:0') return false;
  // Link-local: fe80::/10 (fe80 to febf)
  if (
    cleanIp.startsWith('fe8') ||
    cleanIp.startsWith('fe9') ||
    cleanIp.startsWith('fea') ||
    cleanIp.startsWith('feb')
  ) {
    return false;
  }
  // IPv4-mapped IPv6: ::ffff:127.0.0.1
  if (cleanIp.startsWith('::ffff:')) {
    const ipv4Part = ip.slice(7);
    if (isIP(ipv4Part) === 4) {
      return isSafeIpv4(ipv4Part);
    }
  }
  return true;
}

/**
 * Checks if a literal IP address is a safe public IP.
 * Returns false for loopback, private, link-local, or unspecified ranges.
 */
export function isSafeIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return isSafeIpv4(ip);
  if (version === 6) return isSafeIpv6(ip);
  return false;
}

/**
 * Validates a hostname to ensure it is not blocked (e.g. localhost or literal private IP).
 */
export function validateHostname(hostname: string): void {
  const lower = hostname.toLowerCase().trim();
  if (lower === 'localhost' || lower.endsWith('.localhost')) {
    throw new Error(`Hostname "${hostname}" is a blocked local target.`);
  }

  let ipToCheck = lower;
  if (ipToCheck.startsWith('[') && ipToCheck.endsWith(']')) {
    ipToCheck = ipToCheck.slice(1, -1);
  }

  if (isIP(ipToCheck) !== 0) {
    if (!isSafeIp(ipToCheck)) {
      throw new Error(`IP address "${ipToCheck}" is a blocked local or private target.`);
    }
  }
}

/**
 * Parses and normalizes a URL. Strips fragments, credentials, default ports,
 * and sorts query parameters lexicographically.
 */
export function normalizeUrl(input: string): string {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    // new URL() only ever throws the constant "Invalid URL" (no structured cause worth keeping),
    // and every caller prefixes its own "Invalid URL:" — forwarding the native text would stutter.
    // Drop the binding and emit an actionable, self-contained reason instead.
    throw new Error(
      `Could not parse "${input}" as a URL; provide a full http(s) URL like https://example.com/page.`
    );
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Unsupported protocol "${url.protocol}". Only http: and https: are supported.`);
  }

  if (url.username || url.password) {
    throw new Error('URLs containing usernames or passwords are rejected.');
  }

  validateHostname(url.hostname);

  // Clear default ports
  if (url.protocol === 'https:' && url.port === '443') {
    url.port = '';
  }
  if (url.protocol === 'http:' && url.port === '80') {
    url.port = '';
  }

  // Strip plain anchor fragments, but PRESERVE SPA hash routes (e.g. Docsify "#/guide/intro",
  // "#!/path") so client-rendered docs get a distinct, consistent cache key per page (T-28).
  if (!/^#!?\//.test(url.hash)) {
    url.hash = '';
  }

  // Sort query parameters
  const params = Array.from(url.searchParams.entries()).sort(
    (a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1])
  );
  url.search = new URLSearchParams(params).toString();

  return url.toString();
}

/**
 * Checks if a URL matches a wildcard pattern (case-insensitive, supports * wildcard).
 */
export function matchesUrlGlob(url: string, glob: string): boolean {
  // Collapse consecutive wildcards to prevent ReDoS
  const collapsedGlob = glob.replace(/\*+/g, '*');
  const normalizedGlob = collapsedGlob.toLowerCase();
  const normalizedUrl = url.toLowerCase();

  // Escape regex characters except *
  const escapedGlob = normalizedGlob.replace(/[/\-\\^$+?.()|[\]{}]/g, '\\$&');
  // Replace * with .*
  const regexString = '^' + escapedGlob.replace(/\*/g, '.*') + '$';
  const regex = new RegExp(regexString);
  return regex.test(normalizedUrl);
}

/**
 * Checks if artifact metadata contains any URL matching the filter glob.
 */
export function artifactMatchesUrlFilter(
  meta: { source_urls?: string[]; source_url?: string },
  filterUrl: string | undefined
): boolean {
  if (!filterUrl) return true;
  const urls = meta.source_urls || (meta.source_url ? [meta.source_url] : []);
  return urls.some((u) => matchesUrlGlob(u, filterUrl));
}

/**
 * Checks if a filename matches the standard research note naming pattern.
 */
export function isResearchFile(file: string): boolean {
  return (
    file.endsWith('.md') &&
    !file.includes('.tmp') &&
    !file.includes('.corrupt') &&
    !file.includes('.superseded')
  );
}

/**
 * Validates that a URL is safe for server-side fetching.
 * Blocks private/internal IP ranges, non-HTTP(S) schemes, and metadata endpoints.
 */
export function isSafeUrl(urlStr: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    return false;
  }

  // Only allow HTTP(S)
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return false;
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block localhost variants
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname === "::1" ||
    hostname === "[::1]"
  ) {
    return false;
  }

  // Block cloud metadata endpoints
  if (hostname === "169.254.169.254" || hostname === "metadata.google.internal") {
    return false;
  }

  // Block IPv6 private/reserved (bracket-stripped by URL parser)
  if (hostname.startsWith("[")) {
    return false; // block all bracketed IPv6 for safety
  }
  // fc00::/7 (unique local), fe80::/10 (link-local)
  if (/^f[cd][0-9a-f]{2}:/i.test(hostname) || /^fe[89ab][0-9a-f]:/i.test(hostname)) {
    return false;
  }

  // Block private/reserved IPv4 ranges
  const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [, a, b] = ipv4Match.map(Number);
    if (a === 0) return false;           // 0.0.0.0/8
    if (a === 10) return false;          // 10.0.0.0/8
    if (a === 100 && b >= 64 && b <= 127) return false; // 100.64.0.0/10 (CGNAT)
    if (a === 127) return false;         // 127.0.0.0/8
    if (a === 169 && b === 254) return false; // 169.254.0.0/16 (link-local)
    if (a === 172 && b >= 16 && b <= 31) return false; // 172.16.0.0/12
    if (a === 192 && b === 168) return false; // 192.168.0.0/16
    if (a === 198 && (b === 18 || b === 19)) return false; // 198.18.0.0/15 (benchmark)
    if (a >= 240) return false;          // 240.0.0.0/4 (reserved)
  }

  return true;
}

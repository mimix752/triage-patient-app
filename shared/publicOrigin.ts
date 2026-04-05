const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

let lastKnownPublicOrigin = "";

export function __resetPublicOriginForTests() {
  lastKnownPublicOrigin = "";
}

function isLocalHostname(hostname: string) {
  return LOCAL_HOSTNAMES.has(hostname.toLowerCase());
}

function rememberPublicOrigin(origin: string) {
  lastKnownPublicOrigin = origin;
  return origin;
}

function firstHeaderValue(value?: string | string[] | null) {
  if (Array.isArray(value)) {
    return value[0] || "";
  }

  return value?.split(",")[0]?.trim() || "";
}

function parsePublicOrigin(candidate?: string | null) {
  if (!candidate) {
    return null;
  }

  try {
    const url = new URL(candidate);
    const protocol = url.protocol.toLowerCase();

    if ((protocol !== "http:" && protocol !== "https:") || isLocalHostname(url.hostname)) {
      return null;
    }

    return rememberPublicOrigin(url.origin);
  } catch {
    return null;
  }
}

function parseCurrentOrigin(candidate?: string | null) {
  if (!candidate) {
    return "";
  }

  try {
    return new URL(candidate).origin;
  } catch {
    return "";
  }
}

export function preferPublicUrl(input: {
  candidateUrl?: string | null;
  fallbackPath?: string | null;
  currentOrigin?: string | null;
  referrer?: string | null;
  ancestorOrigins?: ArrayLike<string> | Iterable<string> | null;
}) {
  const candidateUrl = input.candidateUrl || "";

  if (candidateUrl) {
    try {
      const parsedCandidateUrl = new URL(candidateUrl);
      if (!isLocalHostname(parsedCandidateUrl.hostname)) {
        return rememberPublicOrigin(parsedCandidateUrl.toString());
      }
    } catch {
      // Ignore malformed candidate URL and rebuild below.
    }
  }

  const fallbackPath = input.fallbackPath || "";
  if (!fallbackPath) {
    return "";
  }

  const publicOrigin = resolvePublicOrigin({
    currentOrigin: input.currentOrigin,
    referrer: input.referrer,
    ancestorOrigins: input.ancestorOrigins,
  });

  if (!publicOrigin) {
    return "";
  }

  return new URL(fallbackPath, publicOrigin).toString();
}

export function resolvePublicOrigin(input: {
  currentOrigin?: string | null;
  referrer?: string | null;
  ancestorOrigins?: ArrayLike<string> | Iterable<string> | null;
}) {
  const currentOrigin = parseCurrentOrigin(input.currentOrigin);

  if (currentOrigin) {
    const currentUrl = new URL(currentOrigin);
    if (!isLocalHostname(currentUrl.hostname)) {
      return rememberPublicOrigin(currentOrigin);
    }
  }

  if (input.ancestorOrigins) {
    for (const candidate of Array.from(input.ancestorOrigins)) {
      const publicOrigin = parsePublicOrigin(candidate);
      if (publicOrigin) {
        return publicOrigin;
      }
    }
  }

  const referrerOrigin = parsePublicOrigin(input.referrer);
  if (referrerOrigin) {
    return referrerOrigin;
  }

  return lastKnownPublicOrigin;
}

export function resolveRequestPublicOrigin(headers: {
  host?: string | string[] | null;
  origin?: string | string[] | null;
  referer?: string | string[] | null;
  "x-forwarded-host"?: string | string[] | null;
  "x-forwarded-proto"?: string | string[] | null;
  "x-forwarded-origin"?: string | string[] | null;
}) {
  const forwardedOrigin = parsePublicOrigin(firstHeaderValue(headers["x-forwarded-origin"]));
  if (forwardedOrigin) {
    return forwardedOrigin;
  }

  const originHeader = parsePublicOrigin(firstHeaderValue(headers.origin));
  if (originHeader) {
    return originHeader;
  }

  const refererOrigin = parsePublicOrigin(firstHeaderValue(headers.referer));
  if (refererOrigin) {
    return refererOrigin;
  }

  const forwardedHost = firstHeaderValue(headers["x-forwarded-host"]);
  const host = forwardedHost || firstHeaderValue(headers.host);
  const proto = firstHeaderValue(headers["x-forwarded-proto"]) || "https";

  if (!host) {
    return lastKnownPublicOrigin;
  }

  const candidate = `${proto}://${host}`;
  const publicOrigin = parsePublicOrigin(candidate);
  return publicOrigin || lastKnownPublicOrigin;
}

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

function isLocalHostname(hostname: string) {
  return LOCAL_HOSTNAMES.has(hostname.toLowerCase());
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

    return url.origin;
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

export function resolvePublicOrigin(input: {
  currentOrigin?: string | null;
  referrer?: string | null;
  ancestorOrigins?: ArrayLike<string> | Iterable<string> | null;
}) {
  const currentOrigin = parseCurrentOrigin(input.currentOrigin);

  if (currentOrigin) {
    const currentUrl = new URL(currentOrigin);
    if (!isLocalHostname(currentUrl.hostname)) {
      return currentOrigin;
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

  return currentOrigin;
}

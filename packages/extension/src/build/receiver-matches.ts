const localReceiverBridgeMatches = ['http://127.0.0.1/*', 'http://localhost/*'] as const;

function isLocalReceiverHostname(hostname: string) {
  return (
    hostname === '127.0.0.1' ||
    hostname === 'localhost' ||
    hostname === '::1' ||
    hostname === '[::1]'
  );
}

function parseReceiverAppUrl(rawReceiverAppUrl: string) {
  let url: URL;

  try {
    url = new URL(rawReceiverAppUrl);
  } catch {
    throw new Error(
      `VITE_COOP_RECEIVER_APP_URL must be a valid http(s) URL. Received: ${rawReceiverAppUrl}`,
    );
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(
      `VITE_COOP_RECEIVER_APP_URL must use http or https. Received: ${rawReceiverAppUrl}`,
    );
  }

  return url;
}

export function validateStoreReceiverAppUrl(rawReceiverAppUrl?: string) {
  if (!rawReceiverAppUrl) {
    return {
      ok: false as const,
      message:
        'VITE_COOP_RECEIVER_APP_URL must be set to the production HTTPS receiver origin before running store-readiness validation.',
    };
  }

  let url: URL;
  try {
    url = parseReceiverAppUrl(rawReceiverAppUrl);
  } catch (error) {
    return {
      ok: false as const,
      message: error instanceof Error ? error.message : 'Invalid VITE_COOP_RECEIVER_APP_URL.',
    };
  }

  if (url.protocol !== 'https:') {
    return {
      ok: false as const,
      message: 'VITE_COOP_RECEIVER_APP_URL must use HTTPS for Chrome Web Store release validation.',
    };
  }

  if (isLocalReceiverHostname(url.hostname)) {
    return {
      ok: false as const,
      message:
        'VITE_COOP_RECEIVER_APP_URL must point at the production receiver origin, not localhost, for store-readiness validation.',
    };
  }

  return {
    ok: true as const,
    url,
  };
}

export function resolveReceiverBridgeMatches(rawReceiverAppUrl?: string) {
  if (!rawReceiverAppUrl) {
    return [...localReceiverBridgeMatches];
  }

  const url = parseReceiverAppUrl(rawReceiverAppUrl);
  // Chrome extension match patterns cannot include ports, so use hostname only
  const exactOriginMatch = `${url.protocol}//${url.hostname}/*`;
  if (isLocalReceiverHostname(url.hostname)) {
    return [...new Set([...localReceiverBridgeMatches, exactOriginMatch])].sort();
  }

  return [exactOriginMatch];
}

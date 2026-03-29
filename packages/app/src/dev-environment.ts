export const DEV_STATE_PATH = '/__coop_dev__/state.json';
export const DEV_ACCESS_TOKEN_PARAM = 'coop-dev-token';
export const DEV_ACCESS_STORAGE_KEY = 'coop-dev-access-token';

export type DevServiceState = {
  localUrl?: string;
  publicUrl?: string;
  websocketUrl?: string;
  qrUrl?: string;
  status: 'starting' | 'ready' | 'disabled' | 'error';
  reason?: string;
};

export type DevEnvironmentState = {
  version: 1;
  updatedAt: string;
  accessToken?: string;
  app: DevServiceState;
  api: DevServiceState;
  docs: DevServiceState;
  extension: {
    distPath: string;
    mode: 'watch';
    receiverAppUrl: string;
    signalingUrls: string[];
    status: 'starting' | 'ready' | 'disabled' | 'error';
  };
  tunnel: {
    enabled: boolean;
    provider?: 'cloudflare';
    status: 'starting' | 'ready' | 'disabled' | 'error';
    reason?: string;
  };
};

export async function loadDevEnvironmentState(fetchImpl: typeof fetch = fetch) {
  const response = await fetchImpl(DEV_STATE_PATH, {
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`Dev state request failed (${response.status}).`);
  }

  return (await response.json()) as DevEnvironmentState;
}

export function isLocalHostname(hostname: string) {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname.endsWith('.localhost')
  );
}

export function getStoredDevAccessToken() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage.getItem(DEV_ACCESS_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function rememberDevAccessToken(token: string) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(DEV_ACCESS_STORAGE_KEY, token);
  } catch {
    // Ignore storage failures in private browsing or restricted environments.
  }
}

export function stripDevAccessToken(url: URL) {
  const next = new URL(url.toString());
  next.searchParams.delete(DEV_ACCESS_TOKEN_PARAM);
  return `${next.pathname}${next.search}${next.hash}`;
}

export function getDevAccessTokenFromUrl(url: URL) {
  const token = url.searchParams.get(DEV_ACCESS_TOKEN_PARAM);
  return token && token.length > 0 ? token : null;
}

export function isDevAccessRequired(state: DevEnvironmentState | null, url: URL) {
  if (!state?.accessToken || !state.app.publicUrl || isLocalHostname(url.hostname)) {
    return false;
  }

  try {
    return new URL(state.app.publicUrl).origin === url.origin;
  } catch {
    return false;
  }
}

export function hasValidDevAccess(
  state: DevEnvironmentState | null,
  url: URL,
  storedToken?: string | null,
) {
  if (!isDevAccessRequired(state, url)) {
    return true;
  }

  const tokenFromUrl = getDevAccessTokenFromUrl(url);
  return tokenFromUrl === state?.accessToken || storedToken === state?.accessToken;
}

/** Default signaling server URL. */
export const defaultSignalingUrls: string[] = ['wss://api.coop.town'];

/** Default Yjs document sync URL (y-websocket endpoint). */
export const defaultWebsocketSyncUrl = 'wss://api.coop.town/yws';

/**
 * Default ICE servers for WebRTC peer connections.
 *
 * STUN-only is sufficient for open NATs but will fail for symmetric NAT or
 * restrictive firewalls. Production deployments MUST configure TURN via:
 *   VITE_COOP_TURN_URLS      — comma-separated turn: or turns: URIs
 *   VITE_COOP_TURN_USERNAME   — TURN credential username
 *   VITE_COOP_TURN_CREDENTIAL — TURN credential password
 *
 * Without TURN, blob sync (audio, photos, files) falls back to the yws
 * WebSocket relay, but direct peer connections will not be established.
 */
export const defaultIceServers: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

/** Parse a comma-separated signaling URL string into an array. */
export function parseSignalingUrls(raw?: string) {
  const urls = raw
    ?.split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return urls && urls.length > 0 ? urls : undefined;
}

/** Filter signaling URLs to only valid WebSocket/HTTP protocols. */
export function filterUsableSignalingUrls(urls: string[] = []) {
  return urls.filter((value) => {
    try {
      const url = new URL(value);
      return ['ws:', 'wss:', 'http:', 'https:'].includes(url.protocol);
    } catch {
      return false;
    }
  });
}

/** Build ICE server list, merging STUN defaults with optional TURN config. */
export function buildIceServers(turn?: {
  urls?: string;
  username?: string;
  credential?: string;
}): RTCIceServer[] {
  if (!turn?.urls) {
    return defaultIceServers;
  }

  const turnUrls = turn.urls
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean);

  if (turnUrls.length === 0) {
    return defaultIceServers;
  }

  return [
    ...defaultIceServers,
    { urls: turnUrls, username: turn.username ?? '', credential: turn.credential ?? '' },
  ];
}

export interface IceConfigResponse {
  iceServers: RTCIceServer[];
  expiresAt: string | null;
  degraded: boolean;
  reason?: string;
}

export function resolveSyncApiBaseUrl(websocketSyncUrl = defaultWebsocketSyncUrl) {
  const url = new URL(websocketSyncUrl);
  url.protocol = url.protocol === 'wss:' ? 'https:' : 'http:';
  url.pathname = '';
  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/$/, '');
}

export async function fetchServerMintedIceConfig(input?: {
  apiBaseUrl?: string;
  websocketSyncUrl?: string;
  fetchImpl?: typeof fetch;
}): Promise<IceConfigResponse | null> {
  const fetcher = input?.fetchImpl ?? globalThis.fetch;
  if (!fetcher) {
    return null;
  }

  const baseUrl = input?.apiBaseUrl ?? resolveSyncApiBaseUrl(input?.websocketSyncUrl);
  try {
    const response = await fetcher(`${baseUrl}/sync/ice`, {
      headers: { accept: 'application/json' },
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as IceConfigResponse;
    return {
      iceServers: Array.isArray(payload.iceServers) ? payload.iceServers : [],
      expiresAt: payload.expiresAt ?? null,
      degraded: Boolean(payload.degraded),
      reason: payload.reason,
    };
  } catch {
    return null;
  }
}

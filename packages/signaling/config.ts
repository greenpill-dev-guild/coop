/** Default signaling server URL (Fly.io-hosted). */
export const defaultSignalingUrls: string[] = ['wss://coop.fly.dev'];

/** Default ICE servers for WebRTC peer connections (STUN only). */
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

import { getAddress, keccak256, stringToHex } from 'viem';

export function createId(prefix = 'coop') {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`}`;
}

export function hashText(value: string) {
  return keccak256(stringToHex(value));
}

export function hashJson(value: unknown) {
  return hashText(JSON.stringify(value));
}

export function toPseudoCid(value: string) {
  return `bafy${hashText(value).slice(2, 30).toLowerCase()}`;
}

export function toDeterministicAddress(value: string) {
  const hash = hashText(value).slice(2, 42);
  return getAddress(`0x${hash.padEnd(40, '0')}`);
}

export function toDeterministicBigInt(value: string) {
  return BigInt(hashText(value));
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function nowIso() {
  return new Date().toISOString();
}

export function canonicalizeUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    url.hash = '';
    const trackingParams = [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'utm_content',
      'gclid',
      'fbclid',
    ];
    for (const key of trackingParams) {
      url.searchParams.delete(key);
    }
    return url.toString();
  } catch {
    return rawUrl;
  }
}

export function extractDomain(rawUrl: string) {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./, '');
  } catch {
    return 'local';
  }
}

export function truncateWords(value: string, maxWords: number) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) {
    return words.join(' ');
  }
  return `${words.slice(0, maxWords).join(' ')}…`;
}

export function compactWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

export function groupBy<T>(items: T[], key: (item: T) => string) {
  return items.reduce<Record<string, T[]>>((groups, item) => {
    const groupKey = key(item);
    groups[groupKey] ??= [];
    groups[groupKey].push(item);
    return groups;
  }, {});
}

export function asArray<T>(value: T | T[] | undefined) {
  if (value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

export function encodeBase64Url(value: string) {
  const utf8 = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of utf8) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  const binary = atob(`${normalized}${padding}`);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

import { getAddress, keccak256, stringToHex } from 'viem';

export function createId(prefix = 'coop') {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${prefix}-${hex}`;
  }
  throw new Error(
    'No secure random source available (crypto.randomUUID or crypto.getRandomValues).',
  );
}

export function assertHexString(value: string, fieldName?: string): `0x${string}` {
  if (typeof value !== 'string' || !value.startsWith('0x') || !/^0x[0-9a-fA-F]+$/.test(value)) {
    throw new Error(
      fieldName
        ? `Expected ${fieldName} to be a hex string (0x-prefixed), got: ${value.slice(0, 20)}`
        : `Expected a hex string (0x-prefixed), got: ${value.slice(0, 20)}`,
    );
  }
  return value as `0x${string}`;
}

export function hashText(value: string) {
  return keccak256(stringToHex(value));
}

function canonicalStringify(value: unknown): string {
  if (value === null || value === undefined) return JSON.stringify(value);
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const sortedKeys = Object.keys(obj).sort();
  const entries = sortedKeys.map((k) => `${JSON.stringify(k)}:${canonicalStringify(obj[k])}`);
  return `{${entries.join(',')}}`;
}

export function hashJson(value: unknown) {
  return hashText(canonicalStringify(value));
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

export function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export function bytesToBase64Url(bytes: Uint8Array) {
  return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

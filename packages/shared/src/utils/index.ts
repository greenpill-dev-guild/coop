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

export function appendQueryParams(
  rawUrl: string,
  params: Record<string, string | null | undefined>,
) {
  try {
    const url = new URL(rawUrl);
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string' && value.length > 0) {
        url.searchParams.set(key, value);
      }
    }
    return url.toString();
  } catch {
    return rawUrl;
  }
}

const TRACKING_QUERY_PARAM_NAMES = new Set([
  'dclid',
  'fbclid',
  'gclid',
  'hsctatracking',
  'igshid',
  'mc_cid',
  'mc_eid',
  'mkt_tok',
  'msclkid',
  'oly_anon_id',
  'oly_enc_id',
  'rb_clickid',
  'ref',
  'ref_src',
  'si',
  'source',
  'spm',
  'src',
  'trk',
  'vero_conv',
  'vero_id',
  '_hsenc',
  '_hsmi',
]);

const SENSITIVE_QUERY_PARAM_NAMES = new Set([
  'access_token',
  'api_key',
  'apikey',
  'auth',
  'auth_token',
  'credential',
  'id_token',
  'oauth_token',
  'password',
  'refresh_token',
  'secret',
  'session',
  'session_id',
  'sessionid',
  'sig',
  'signature',
  'token',
]);

const SENSITIVE_OBJECT_KEY_NAMES = new Set([
  'access_token',
  'api_key',
  'apikey',
  'auth',
  'auth_token',
  'credential',
  'id_token',
  'oauth_token',
  'password',
  'refresh_token',
  'secret',
  'session',
  'session_id',
  'sessionid',
  'sig',
  'signature',
  'token',
]);

const INLINE_URL_PATTERN = /https?:\/\/\S+/gi;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_PATTERN = /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?){2}\d{4}\b/g;
const BEARER_TOKEN_PATTERN = /\bBearer\s+[A-Za-z0-9\-._~+/]+=*\b/gi;
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9._-]+\.[A-Za-z0-9._-]+\b/g;
const HEX_SECRET_PATTERN = /\b0x[a-fA-F0-9]{64}\b/g;
const KEY_VALUE_SECRET_PATTERN =
  /\b(access_token|api_key|apikey|auth_token|id_token|oauth_token|password|refresh_token|secret|session(?:_id|id)?|sig(?:nature)?|token)\b\s*[:=]\s*([^\s,;]+)/gi;

function shouldStripCanonicalQueryParam(key: string) {
  const normalized = key.trim().toLowerCase();
  return (
    normalized.startsWith('utm_') ||
    TRACKING_QUERY_PARAM_NAMES.has(normalized) ||
    SENSITIVE_QUERY_PARAM_NAMES.has(normalized)
  );
}

export function canonicalizeUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    url.username = '';
    url.password = '';
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
      if (shouldStripCanonicalQueryParam(key)) {
        url.searchParams.delete(key);
      }
    }
    if ([...url.searchParams.keys()].length === 0) {
      url.search = '';
    }
    return url.toString();
  } catch {
    return rawUrl;
  }
}

function splitTrailingUrlPunctuation(value: string) {
  const match = value.match(/[),.;!?]+$/);
  if (!match) {
    return {
      core: value,
      suffix: '',
    };
  }
  return {
    core: value.slice(0, -match[0].length),
    suffix: match[0],
  };
}

function isSensitiveObjectKey(key: string) {
  const normalized = key.trim().toLowerCase();
  return (
    SENSITIVE_OBJECT_KEY_NAMES.has(normalized) ||
    normalized.endsWith('_token') ||
    normalized.endsWith('_secret')
  );
}

export function sanitizeTextForInference(value: string) {
  let sanitized = value.replace(INLINE_URL_PATTERN, (match) => {
    const { core, suffix } = splitTrailingUrlPunctuation(match);
    return `${canonicalizeUrl(core)}${suffix}`;
  });

  sanitized = sanitized.replace(BEARER_TOKEN_PATTERN, 'Bearer [redacted-token]');
  sanitized = sanitized.replace(JWT_PATTERN, '[redacted-token]');
  sanitized = sanitized.replace(HEX_SECRET_PATTERN, '[redacted-secret]');
  sanitized = sanitized.replace(KEY_VALUE_SECRET_PATTERN, (_, key: string) => `${key}=[redacted]`);
  sanitized = sanitized.replace(EMAIL_PATTERN, '[redacted-email]');
  sanitized = sanitized.replace(PHONE_PATTERN, '[redacted-phone]');

  return sanitized;
}

export function sanitizeValueForInference(
  value: unknown,
  options?: {
    maxStringWords?: number;
  },
): unknown {
  const maxStringWords = options?.maxStringWords ?? 80;

  if (typeof value === 'string') {
    return truncateWords(sanitizeTextForInference(value), maxStringWords);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeValueForInference(entry, options));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => {
        if (isSensitiveObjectKey(key)) {
          return [key, '[redacted]'];
        }

        return [key, sanitizeValueForInference(entry, options)];
      }),
    );
  }

  return value;
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
  if (typeof globalThis.btoa === 'function') {
    let binary = '';
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    return globalThis.btoa(binary);
  }

  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }

  throw new Error('Base64 encoding is unavailable in this runtime.');
}

export function bytesToBase64Url(bytes: Uint8Array) {
  return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

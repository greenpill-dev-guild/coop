import {
  type CoopChainKey,
  type IntegrationMode,
  type ProviderMode,
  type SessionMode,
  type TrustedNodeArchiveConfig,
  trustedNodeArchiveConfigSchema,
} from '@coop/shared';

export function resolveConfiguredChain(raw?: string): CoopChainKey {
  return raw === 'arbitrum' ? 'arbitrum' : 'sepolia';
}

export function resolveConfiguredOnchainMode(
  raw?: string,
  _pimlicoApiKey?: string,
): IntegrationMode {
  return raw === 'live' || raw === 'mock' ? raw : 'mock';
}

export function resolveConfiguredArchiveMode(raw?: string): IntegrationMode {
  return raw === 'live' || raw === 'mock' ? raw : 'mock';
}

export function resolveConfiguredSessionMode(raw?: string): SessionMode {
  return raw === 'live' || raw === 'mock' || raw === 'off' ? raw : 'off';
}

export function resolveConfiguredProviderMode(raw?: string): ProviderMode {
  return raw === 'kohaku' ? 'kohaku' : 'standard';
}

export { parseSignalingUrls as parseConfiguredSignalingUrls } from '@coop/signaling';

export function resolveArchiveGatewayUrl(raw?: string) {
  return raw ?? 'https://storacha.link';
}

export function resolveReceiverAppUrl(raw?: string) {
  return raw ?? 'http://127.0.0.1:3001';
}

export function resolveConfiguredPrivacyMode(raw?: string): 'off' | 'on' {
  return raw === 'on' ? 'on' : 'off';
}

export function isLocalEnhancementEnabled(raw?: string) {
  return raw !== 'off';
}

function parseConfiguredProofs(raw?: string) {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === 'string' && value.length > 0)
      : [raw];
  } catch {
    return [raw];
  }
}

function parseConfiguredBoolean(raw?: string) {
  if (raw === undefined) {
    return undefined;
  }
  return raw.toLowerCase() === 'true';
}

function parseConfiguredPositiveInt(raw?: string) {
  if (!raw) {
    return undefined;
  }
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : undefined;
}

export function resolveTrustedNodeArchiveBootstrapConfig(env: {
  VITE_COOP_TRUSTED_NODE_ARCHIVE_AGENT_PRIVATE_KEY?: string;
  VITE_COOP_TRUSTED_NODE_ARCHIVE_SPACE_DID?: string;
  VITE_COOP_TRUSTED_NODE_ARCHIVE_DELEGATION_ISSUER?: string;
  VITE_COOP_TRUSTED_NODE_ARCHIVE_SPACE_DELEGATION?: string;
  VITE_COOP_TRUSTED_NODE_ARCHIVE_PROOFS?: string;
  VITE_COOP_TRUSTED_NODE_ARCHIVE_GATEWAY_URL?: string;
  VITE_COOP_TRUSTED_NODE_ARCHIVE_ALLOWS_FILECOIN_INFO?: string;
  VITE_COOP_TRUSTED_NODE_ARCHIVE_EXPIRATION_SECONDS?: string;
}): TrustedNodeArchiveConfig | null {
  const hasAnyValue = [
    env.VITE_COOP_TRUSTED_NODE_ARCHIVE_AGENT_PRIVATE_KEY,
    env.VITE_COOP_TRUSTED_NODE_ARCHIVE_SPACE_DID,
    env.VITE_COOP_TRUSTED_NODE_ARCHIVE_DELEGATION_ISSUER,
    env.VITE_COOP_TRUSTED_NODE_ARCHIVE_SPACE_DELEGATION,
    env.VITE_COOP_TRUSTED_NODE_ARCHIVE_PROOFS,
    env.VITE_COOP_TRUSTED_NODE_ARCHIVE_GATEWAY_URL,
    env.VITE_COOP_TRUSTED_NODE_ARCHIVE_ALLOWS_FILECOIN_INFO,
    env.VITE_COOP_TRUSTED_NODE_ARCHIVE_EXPIRATION_SECONDS,
  ].some((value) => Boolean(value));

  if (!hasAnyValue) {
    return null;
  }

  return trustedNodeArchiveConfigSchema.parse({
    agentPrivateKey: env.VITE_COOP_TRUSTED_NODE_ARCHIVE_AGENT_PRIVATE_KEY || undefined,
    spaceDid: env.VITE_COOP_TRUSTED_NODE_ARCHIVE_SPACE_DID,
    delegationIssuer: env.VITE_COOP_TRUSTED_NODE_ARCHIVE_DELEGATION_ISSUER,
    spaceDelegation: env.VITE_COOP_TRUSTED_NODE_ARCHIVE_SPACE_DELEGATION,
    proofs: parseConfiguredProofs(env.VITE_COOP_TRUSTED_NODE_ARCHIVE_PROOFS),
    gatewayBaseUrl: env.VITE_COOP_TRUSTED_NODE_ARCHIVE_GATEWAY_URL,
    allowsFilecoinInfo: parseConfiguredBoolean(
      env.VITE_COOP_TRUSTED_NODE_ARCHIVE_ALLOWS_FILECOIN_INFO,
    ),
    expirationSeconds: parseConfiguredPositiveInt(
      env.VITE_COOP_TRUSTED_NODE_ARCHIVE_EXPIRATION_SECONDS,
    ),
  });
}

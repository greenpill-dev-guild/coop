import type { CoopChainKey, IntegrationMode } from '@coop/shared';

export function resolveConfiguredChain(raw?: string): CoopChainKey {
  return raw === 'arbitrum' ? 'arbitrum' : 'sepolia';
}

export function resolveConfiguredOnchainMode(
  raw?: string,
  pimlicoApiKey?: string,
): IntegrationMode {
  return raw === 'live' || raw === 'mock' ? raw : pimlicoApiKey ? 'live' : 'mock';
}

export function resolveConfiguredArchiveMode(raw?: string, issuerUrl?: string): IntegrationMode {
  return raw === 'live' || raw === 'mock' ? raw : issuerUrl ? 'live' : 'mock';
}

export function parseConfiguredSignalingUrls(raw?: string) {
  const urls = raw
    ?.split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return urls && urls.length > 0 ? urls : undefined;
}

export function resolveArchiveGatewayUrl(raw?: string) {
  return raw ?? 'https://storacha.link';
}

export function resolveReceiverAppUrl(raw?: string) {
  return raw ?? 'http://127.0.0.1:3001';
}

export function isLocalEnhancementEnabled(raw?: string) {
  return raw !== 'off';
}

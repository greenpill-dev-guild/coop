export type CoopChainKey = 'celo' | 'celo-sepolia';
export type RuntimeMode = 'live' | 'mock';

export function resolveConfiguredChain(raw?: string): CoopChainKey {
  return raw === 'celo' ? 'celo' : 'celo-sepolia';
}

export function resolveConfiguredOnchainMode(raw?: string, pimlicoApiKey?: string): RuntimeMode {
  return raw === 'live' || raw === 'mock' ? raw : pimlicoApiKey ? 'live' : 'mock';
}

export function resolveConfiguredArchiveMode(raw?: string, issuerUrl?: string): RuntimeMode {
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

export function isLocalEnhancementEnabled(raw?: string) {
  return raw !== 'off';
}

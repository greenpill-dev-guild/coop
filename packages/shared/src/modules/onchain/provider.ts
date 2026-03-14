import { http, type PublicClient, createPublicClient } from 'viem';
import type { CoopChainKey, ProviderMode } from '../../contracts/schema';
import { getCoopChainConfig } from './onchain';

/** Kohaku provider factory signature: takes a viem-compatible client, returns an EthereumProvider. */
type KohakuViemFactory = (client: PublicClient) => unknown;

let kohakuViem: KohakuViemFactory | null = null;
let kohakuResolved = false;

async function resolveKohakuProvider(): Promise<KohakuViemFactory | null> {
  if (kohakuResolved) return kohakuViem;
  kohakuResolved = true;
  try {
    const mod = await import('@kohaku-eth/provider/viem');
    kohakuViem = ((mod as Record<string, unknown>).viem as KohakuViemFactory) ?? null;
    return kohakuViem;
  } catch {
    return null;
  }
}

/** Exposed for testing: override the resolved Kohaku factory. */
export function _setKohakuViem(factory: KohakuViemFactory | null): void {
  kohakuViem = factory;
  kohakuResolved = true;
}

export interface CreateCoopPublicClientOptions {
  /** Provider mode: 'standard' (default) uses plain viem, 'kohaku' wraps with Helios light client verification. */
  mode?: ProviderMode;
  /** Custom RPC URL. Defaults to the chain's built-in RPC endpoint. */
  rpcUrl?: string;
}

/**
 * Factory that creates a viem public client for Coop onchain operations.
 *
 * When `mode` is `'kohaku'`, the client is augmented with a Kohaku EthereumProvider
 * for Helios light client verification. Falls back to standard mode gracefully if
 * Kohaku fails to initialize.
 */
export async function createCoopPublicClient(
  chainKey: CoopChainKey = 'sepolia',
  options: CreateCoopPublicClientOptions = {},
): Promise<PublicClient> {
  const { mode = 'standard', rpcUrl } = options;
  const config = getCoopChainConfig(chainKey);
  const transport = http(rpcUrl ?? config.chain.rpcUrls.default.http[0]);

  const client = createPublicClient({
    chain: config.chain,
    transport,
  }) as PublicClient & { _kohakuProvider?: unknown };

  if (mode === 'kohaku') {
    try {
      const factory = await resolveKohakuProvider();
      if (!factory) {
        throw new Error('Kohaku provider not available');
      }
      client._kohakuProvider = factory(client);
    } catch {
      console.warn(
        '[coop:onchain] Kohaku provider failed to initialize, falling back to standard viem client.',
      );
    }
  }

  return client;
}

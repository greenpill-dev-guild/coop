import { afterEach, describe, expect, it, vi } from 'vitest';
import { _setKohakuViem, createCoopPublicClient } from '../provider';

describe('createCoopPublicClient', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a standard viem public client by default', async () => {
    const client = await createCoopPublicClient('sepolia');

    expect(client).toBeDefined();
    expect(client.chain?.id).toBe(11155111);
  });

  it('creates a standard client when mode is explicitly standard', async () => {
    const client = await createCoopPublicClient('sepolia', { mode: 'standard' });

    expect(client).toBeDefined();
    expect(client.chain?.id).toBe(11155111);
  });

  it('creates a client for arbitrum chain', async () => {
    const client = await createCoopPublicClient('arbitrum');

    expect(client).toBeDefined();
    expect(client.chain?.id).toBe(42161);
  });

  it('defaults chainKey to sepolia when not provided', async () => {
    const client = await createCoopPublicClient();

    expect(client.chain?.id).toBe(11155111);
  });

  it('creates a kohaku-wrapped client when mode is kohaku and factory is available', async () => {
    const mockKohakuProvider = { _internal: 'mock-kohaku' };
    const mockFactory = vi.fn().mockReturnValue(mockKohakuProvider);
    _setKohakuViem(mockFactory);

    const client = await createCoopPublicClient('sepolia', { mode: 'kohaku' });

    expect(client).toBeDefined();
    expect(client.chain?.id).toBe(11155111);
    expect((client as unknown as Record<string, unknown>)._kohakuProvider).toBe(mockKohakuProvider);
    expect(mockFactory).toHaveBeenCalledOnce();

    _setKohakuViem(null);
  });

  it('falls back to standard mode when kohaku factory is null', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    _setKohakuViem(null);

    const client = await createCoopPublicClient('sepolia', { mode: 'kohaku' });

    expect(client).toBeDefined();
    expect(client.chain?.id).toBe(11155111);
    expect((client as unknown as Record<string, unknown>)._kohakuProvider).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Kohaku provider failed to initialize'),
    );

    warnSpy.mockRestore();
  });

  it('falls back to standard mode when kohaku factory throws', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    _setKohakuViem(() => {
      throw new Error('WASM init failed');
    });

    const client = await createCoopPublicClient('sepolia', { mode: 'kohaku' });

    expect(client).toBeDefined();
    expect(client.chain?.id).toBe(11155111);
    expect((client as unknown as Record<string, unknown>)._kohakuProvider).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Kohaku provider failed to initialize'),
    );

    _setKohakuViem(null);
    warnSpy.mockRestore();
  });

  it('accepts a custom rpcUrl', async () => {
    const client = await createCoopPublicClient('sepolia', {
      rpcUrl: 'https://custom-rpc.example.com',
    });

    expect(client).toBeDefined();
    expect(client.chain?.id).toBe(11155111);
  });
});

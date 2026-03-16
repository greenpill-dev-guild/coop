import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RuntimeRequest } from '../messages';

/**
 * Tests for per-coop archive config resolution message types.
 *
 * The actual Dexie/Storacha integration cannot be unit-tested here
 * (requires a live background context), so we focus on:
 *
 * 1. Message types exist in RuntimeRequest union
 * 2. Payloads carry the expected shape
 * 3. Message bridge forwards correctly
 */

describe('set-coop-archive-config message type', () => {
  it('is a valid RuntimeRequest variant', () => {
    const message: RuntimeRequest = {
      type: 'set-coop-archive-config',
      payload: {
        coopId: 'coop-abc',
        publicConfig: {
          spaceDid: 'did:key:z6Mk...',
          delegationIssuer: 'did:key:z6Mk...',
          gatewayBaseUrl: 'https://storacha.link',
          allowsFilecoinInfo: true,
          expirationSeconds: 600,
        },
        secrets: {
          agentPrivateKey: '0xdeadbeef',
          spaceDelegation: 'base64-delegation-proof',
          proofs: ['proof-1'],
        },
      },
    };

    expect(message.type).toBe('set-coop-archive-config');
    expect(message.payload.coopId).toBe('coop-abc');
  });

  it('payload requires coopId, publicConfig, and secrets', () => {
    const message: RuntimeRequest = {
      type: 'set-coop-archive-config',
      payload: {
        coopId: 'coop-1',
        publicConfig: {
          spaceDid: 'did:key:z6Mk...',
          delegationIssuer: 'did:key:z6Mk...',
        },
        secrets: {
          spaceDelegation: 'base64-proof',
        },
      },
    };

    expect(message.payload.coopId).toBeDefined();
    expect(message.payload.publicConfig).toBeDefined();
    expect(message.payload.publicConfig.spaceDid).toBeDefined();
    expect(message.payload.publicConfig.delegationIssuer).toBeDefined();
    expect(message.payload.secrets).toBeDefined();
    expect(message.payload.secrets.spaceDelegation).toBeDefined();
  });

  it('publicConfig optional fields can be omitted', () => {
    const message: RuntimeRequest = {
      type: 'set-coop-archive-config',
      payload: {
        coopId: 'coop-1',
        publicConfig: {
          spaceDid: 'did:key:z6Mk...',
          delegationIssuer: 'did:key:z6Mk...',
        },
        secrets: {
          spaceDelegation: 'base64-proof',
        },
      },
    };

    expect(message.payload.publicConfig.gatewayBaseUrl).toBeUndefined();
    expect(message.payload.publicConfig.allowsFilecoinInfo).toBeUndefined();
    expect(message.payload.publicConfig.expirationSeconds).toBeUndefined();
  });

  it('secrets optional fields can be omitted', () => {
    const message: RuntimeRequest = {
      type: 'set-coop-archive-config',
      payload: {
        coopId: 'coop-1',
        publicConfig: {
          spaceDid: 'did:key:z6Mk...',
          delegationIssuer: 'did:key:z6Mk...',
        },
        secrets: {
          spaceDelegation: 'base64-proof',
        },
      },
    };

    expect(message.payload.secrets.agentPrivateKey).toBeUndefined();
    expect(message.payload.secrets.proofs).toBeUndefined();
  });
});

describe('remove-coop-archive-config message type', () => {
  it('is a valid RuntimeRequest variant', () => {
    const message: RuntimeRequest = {
      type: 'remove-coop-archive-config',
      payload: { coopId: 'coop-abc' },
    };

    expect(message.type).toBe('remove-coop-archive-config');
    expect(message.payload.coopId).toBe('coop-abc');
  });

  it('payload requires coopId', () => {
    const message: RuntimeRequest = {
      type: 'remove-coop-archive-config',
      payload: { coopId: 'coop-1' },
    };

    expect(message.payload.coopId).toBeDefined();
  });
});

describe('per-coop archive config via sendRuntimeMessage', () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'chrome');
  });

  it('sends set-coop-archive-config through the runtime bridge', async () => {
    const sendMessage = vi.fn().mockResolvedValue({ ok: true });
    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: { runtime: { sendMessage } },
    });

    const { sendRuntimeMessage } = await import('../messages');
    const result = await sendRuntimeMessage({
      type: 'set-coop-archive-config',
      payload: {
        coopId: 'coop-1',
        publicConfig: {
          spaceDid: 'did:key:z6Mk...',
          delegationIssuer: 'did:key:z6Mk...',
        },
        secrets: {
          spaceDelegation: 'base64-proof',
        },
      },
    });

    expect(sendMessage).toHaveBeenCalledWith({
      type: 'set-coop-archive-config',
      payload: {
        coopId: 'coop-1',
        publicConfig: {
          spaceDid: 'did:key:z6Mk...',
          delegationIssuer: 'did:key:z6Mk...',
        },
        secrets: {
          spaceDelegation: 'base64-proof',
        },
      },
    });
    expect(result).toEqual({ ok: true });
  });

  it('sends remove-coop-archive-config through the runtime bridge', async () => {
    const sendMessage = vi.fn().mockResolvedValue({ ok: true });
    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: { runtime: { sendMessage } },
    });

    const { sendRuntimeMessage } = await import('../messages');
    const result = await sendRuntimeMessage({
      type: 'remove-coop-archive-config',
      payload: { coopId: 'coop-1' },
    });

    expect(sendMessage).toHaveBeenCalledWith({
      type: 'remove-coop-archive-config',
      payload: { coopId: 'coop-1' },
    });
    expect(result).toEqual({ ok: true });
  });

  it('returns error when coop not found for set', async () => {
    const sendMessage = vi.fn().mockResolvedValue({
      ok: false,
      error: 'Coop not found.',
    });
    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: { runtime: { sendMessage } },
    });

    const { sendRuntimeMessage } = await import('../messages');
    const result = await sendRuntimeMessage({
      type: 'set-coop-archive-config',
      payload: {
        coopId: 'nonexistent',
        publicConfig: {
          spaceDid: 'did:key:z6Mk...',
          delegationIssuer: 'did:key:z6Mk...',
        },
        secrets: {
          spaceDelegation: 'base64-proof',
        },
      },
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain('Coop not found');
  });

  it('returns error when coop not found for remove', async () => {
    const sendMessage = vi.fn().mockResolvedValue({
      ok: false,
      error: 'Coop not found.',
    });
    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: { runtime: { sendMessage } },
    });

    const { sendRuntimeMessage } = await import('../messages');
    const result = await sendRuntimeMessage({
      type: 'remove-coop-archive-config',
      payload: { coopId: 'nonexistent' },
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain('Coop not found');
  });

  it('returns no-config error when per-coop config has public but no secrets', async () => {
    const sendMessage = vi.fn().mockResolvedValue({
      ok: false,
      error: 'No archive config available for this coop. Connect a Storacha space in Nest Tools.',
    });
    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: { runtime: { sendMessage } },
    });

    const { sendRuntimeMessage } = await import('../messages');
    const result = await sendRuntimeMessage({
      type: 'archive-artifact',
      payload: { coopId: 'coop-with-partial-config', artifactId: 'art-1' },
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain('No archive config available');
  });
});

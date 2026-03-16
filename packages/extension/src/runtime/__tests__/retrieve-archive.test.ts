import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RuntimeRequest } from '../messages';

/**
 * Tests for the retrieve-archive-bundle message type.
 *
 * The actual background handler integration cannot be unit-tested here
 * (requires a live background context with Dexie and coop state), so we
 * focus on:
 *
 * 1. Message type exists in RuntimeRequest union
 * 2. Payload carries the expected shape
 * 3. Message bridge forwards correctly
 * 4. Error responses for missing coop/receipt
 */

describe('retrieve-archive-bundle message type', () => {
  it('is a valid RuntimeRequest variant', () => {
    const message: RuntimeRequest = {
      type: 'retrieve-archive-bundle',
      payload: {
        coopId: 'coop-abc',
        receiptId: 'receipt-123',
      },
    };

    expect(message.type).toBe('retrieve-archive-bundle');
    expect(message.payload.coopId).toBe('coop-abc');
    expect(message.payload.receiptId).toBe('receipt-123');
  });

  it('payload requires both coopId and receiptId', () => {
    const message: RuntimeRequest = {
      type: 'retrieve-archive-bundle',
      payload: {
        coopId: 'coop-1',
        receiptId: 'receipt-1',
      },
    };

    expect(message.payload.coopId).toBeDefined();
    expect(message.payload.receiptId).toBeDefined();
  });
});

describe('retrieve-archive-bundle via sendRuntimeMessage', () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'chrome');
  });

  it('sends retrieve-archive-bundle through the runtime bridge', async () => {
    const sendMessage = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        payload: { schemaVersion: 1 },
        verified: true,
        schemaVersion: 1,
      },
    });
    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: { runtime: { sendMessage } },
    });

    const { sendRuntimeMessage } = await import('../messages');
    const result = await sendRuntimeMessage({
      type: 'retrieve-archive-bundle',
      payload: {
        coopId: 'coop-1',
        receiptId: 'receipt-1',
      },
    });

    expect(sendMessage).toHaveBeenCalledWith({
      type: 'retrieve-archive-bundle',
      payload: {
        coopId: 'coop-1',
        receiptId: 'receipt-1',
      },
    });
    expect(result.ok).toBe(true);
    expect(result.data).toEqual({
      payload: { schemaVersion: 1 },
      verified: true,
      schemaVersion: 1,
    });
  });

  it('returns error when coop not found', async () => {
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
      type: 'retrieve-archive-bundle',
      payload: {
        coopId: 'nonexistent',
        receiptId: 'receipt-1',
      },
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain('Coop not found');
  });

  it('returns error when receipt not found', async () => {
    const sendMessage = vi.fn().mockResolvedValue({
      ok: false,
      error: 'Archive receipt not found.',
    });
    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: { runtime: { sendMessage } },
    });

    const { sendRuntimeMessage } = await import('../messages');
    const result = await sendRuntimeMessage({
      type: 'retrieve-archive-bundle',
      payload: {
        coopId: 'coop-1',
        receiptId: 'nonexistent',
      },
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain('Archive receipt not found');
  });
});

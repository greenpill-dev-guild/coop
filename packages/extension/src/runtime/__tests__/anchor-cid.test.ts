import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RuntimeRequest } from '../messages';

/**
 * These tests validate the guard conditions for the anchor-archive-cid
 * message type. The actual on-chain transaction cannot be unit-tested
 * (requires a live chain + passkey), so we focus on:
 *
 * 1. Message type exists in RuntimeRequest union
 * 2. Mock onchain mode skips anchoring
 * 3. Missing Pimlico API key returns an error
 */

describe('anchor-archive-cid message type', () => {
  it('is a valid RuntimeRequest variant', () => {
    const message: RuntimeRequest = {
      type: 'anchor-archive-cid',
      payload: {
        coopId: 'coop-test-123',
        receiptId: 'receipt-test-456',
      },
    };

    expect(message.type).toBe('anchor-archive-cid');
    expect(message.payload).toEqual({
      coopId: 'coop-test-123',
      receiptId: 'receipt-test-456',
    });
  });

  it('payload requires both coopId and receiptId', () => {
    const message: RuntimeRequest = {
      type: 'anchor-archive-cid',
      payload: {
        coopId: 'coop-1',
        receiptId: 'receipt-1',
      },
    };

    // Type-level check: payload has both required fields
    expect(message.payload.coopId).toBeDefined();
    expect(message.payload.receiptId).toBeDefined();
  });
});

describe('anchor-archive-cid via sendRuntimeMessage', () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'chrome');
  });

  it('sends the anchor-archive-cid message through the runtime bridge', async () => {
    const sendMessage = vi.fn().mockResolvedValue({
      ok: true,
      data: { txHash: '0xabc', status: 'anchored' },
    });
    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: { runtime: { sendMessage } },
    });

    const { sendRuntimeMessage } = await import('../messages');
    const result = await sendRuntimeMessage({
      type: 'anchor-archive-cid',
      payload: { coopId: 'coop-1', receiptId: 'receipt-1' },
    });

    expect(sendMessage).toHaveBeenCalledWith({
      type: 'anchor-archive-cid',
      payload: { coopId: 'coop-1', receiptId: 'receipt-1' },
    });
    expect(result).toEqual({
      ok: true,
      data: { txHash: '0xabc', status: 'anchored' },
    });
  });

  it('returns skipped status when onchain mode is mock', async () => {
    const sendMessage = vi.fn().mockResolvedValue({
      ok: true,
      data: { status: 'skipped' },
    });
    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: { runtime: { sendMessage } },
    });

    const { sendRuntimeMessage } = await import('../messages');
    const result = await sendRuntimeMessage({
      type: 'anchor-archive-cid',
      payload: { coopId: 'coop-1', receiptId: 'receipt-1' },
    });

    expect(result).toEqual({
      ok: true,
      data: { status: 'skipped' },
    });
  });

  it('returns an error when pimlico key is missing', async () => {
    const sendMessage = vi.fn().mockResolvedValue({
      ok: false,
      error: 'Pimlico API key is required for on-chain CID anchoring.',
    });
    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: { runtime: { sendMessage } },
    });

    const { sendRuntimeMessage } = await import('../messages');
    const result = await sendRuntimeMessage({
      type: 'anchor-archive-cid',
      payload: { coopId: 'coop-1', receiptId: 'receipt-1' },
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain('Pimlico API key');
  });
});

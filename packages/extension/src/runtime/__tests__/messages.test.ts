import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendRuntimeMessage } from '../messages';

describe('runtime message bridge', () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'chrome');
  });

  it('forwards runtime requests through the extension bridge', async () => {
    const sendMessage = vi.fn().mockResolvedValue({
      ok: true,
      data: 3,
    });
    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: {
        runtime: {
          sendMessage,
        },
      },
    });

    const message = { type: 'manual-capture' } as const;
    await expect(sendRuntimeMessage<number>(message)).resolves.toEqual({
      ok: true,
      data: 3,
    });
    expect(sendMessage).toHaveBeenCalledWith(message);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mergeClipboardText, pasteClipboardText } from '../clipboard';

describe('clipboard helpers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('appends clipboard text on a new line for append mode', () => {
    expect(mergeClipboardText('Existing note', 'Fresh clip', 'append')).toBe(
      'Existing note\nFresh clip',
    );
  });

  it('keeps only the latest pasted block for single-value fields', () => {
    expect(mergeClipboardText('OLD-CODE', 'NEW-CODE', 'keep-last-block')).toBe('NEW-CODE');
  });

  it('trims whitespace before merging clipboard text', () => {
    expect(mergeClipboardText('  Existing note  ', '  Fresh clip  ', 'append')).toBe(
      'Existing note\nFresh clip',
    );
  });

  it('returns empty when the clipboard has no usable text', async () => {
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: {
        readText: vi.fn().mockResolvedValue('   '),
      },
    });

    await expect(
      pasteClipboardText({
        currentValue: 'Existing note',
        mode: 'append',
      }),
    ).resolves.toEqual({
      status: 'empty',
      pastedText: '',
      value: 'Existing note',
    });
  });

  it('returns unavailable when the clipboard API is missing', async () => {
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    });

    await expect(
      pasteClipboardText({
        currentValue: 'Existing note',
        mode: 'append',
      }),
    ).resolves.toEqual({
      status: 'unavailable',
      pastedText: '',
      value: 'Existing note',
    });
  });

  it('reads and merges clipboard text through the browser API', async () => {
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: {
        readText: vi.fn().mockResolvedValue('Fresh clip'),
      },
    });

    await expect(
      pasteClipboardText({
        currentValue: 'Existing note',
        mode: 'append',
      }),
    ).resolves.toEqual({
      status: 'success',
      pastedText: 'Fresh clip',
      value: 'Existing note\nFresh clip',
    });
  });
});

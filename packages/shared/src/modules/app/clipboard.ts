export type ClipboardPasteMode = 'append' | 'keep-last-block';

export type ClipboardPasteResult =
  | {
      status: 'success';
      pastedText: string;
      value: string;
    }
  | {
      status: 'empty' | 'unavailable';
      pastedText: '';
      value: string;
    };

export const clipboardPasteFallbackMessage = 'Clipboard access unavailable. Use Cmd/Ctrl+V to paste.';

function normalizeClipboardText(value: string) {
  return value.trim();
}

export function mergeClipboardText(
  currentValue: string,
  pastedText: string,
  mode: ClipboardPasteMode,
) {
  const normalizedCurrent = normalizeClipboardText(currentValue);
  const normalizedPasted = normalizeClipboardText(pastedText);

  if (!normalizedPasted) {
    return normalizedCurrent;
  }

  if (mode === 'keep-last-block') {
    return normalizedPasted;
  }

  return normalizedCurrent ? `${normalizedCurrent}\n${normalizedPasted}` : normalizedPasted;
}

export async function pasteClipboardText(input: {
  currentValue: string;
  mode: ClipboardPasteMode;
}): Promise<ClipboardPasteResult> {
  if (!navigator.clipboard?.readText) {
    return {
      status: 'unavailable',
      pastedText: '',
      value: input.currentValue,
    };
  }

  try {
    const pastedText = normalizeClipboardText(await navigator.clipboard.readText());
    if (!pastedText) {
      return {
        status: 'empty',
        pastedText: '',
        value: normalizeClipboardText(input.currentValue),
      };
    }

    return {
      status: 'success',
      pastedText,
      value: mergeClipboardText(input.currentValue, pastedText, input.mode),
    };
  } catch {
    return {
      status: 'unavailable',
      pastedText: '',
      value: input.currentValue,
    };
  }
}

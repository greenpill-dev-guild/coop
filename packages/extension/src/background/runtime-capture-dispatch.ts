import type { ReceiverCapture, ReviewDraft } from '@coop/shared';
import type {
  ActiveTabCaptureResult,
  PopupPreparedCapture,
  RuntimeActionResponse,
  RuntimeRequest,
} from '../runtime/messages';

export type CaptureRuntimeMessage = Extract<
  RuntimeRequest,
  | { type: 'manual-capture' }
  | { type: 'capture-active-tab' }
  | { type: 'prepare-visible-screenshot' }
  | { type: 'capture-visible-screenshot' }
  | { type: 'capture-file' }
  | { type: 'create-note-draft' }
  | { type: 'capture-audio' }
  | { type: 'save-popup-capture' }
>;

const captureRuntimeMessageTypes = new Set<CaptureRuntimeMessage['type']>([
  'manual-capture',
  'capture-active-tab',
  'prepare-visible-screenshot',
  'capture-visible-screenshot',
  'capture-file',
  'create-note-draft',
  'capture-audio',
  'save-popup-capture',
]);

export function isCaptureRuntimeMessage(message: RuntimeRequest): message is CaptureRuntimeMessage {
  return captureRuntimeMessageTypes.has(message.type as CaptureRuntimeMessage['type']);
}

export async function dispatchCaptureRuntimeMessage(
  message: CaptureRuntimeMessage,
  handlers: {
    runCaptureCycle: () => Promise<number>;
    captureActiveTab: (
      options?: Extract<RuntimeRequest, { type: 'capture-active-tab' }>['payload'],
    ) => Promise<ActiveTabCaptureResult>;
    prepareVisibleScreenshot: () => Promise<PopupPreparedCapture>;
    captureVisibleScreenshot: () => Promise<ReceiverCapture>;
    captureFile: (
      payload: Extract<RuntimeRequest, { type: 'capture-file' }>['payload'],
    ) => Promise<ReceiverCapture>;
    createNoteDraft: (
      payload: Extract<RuntimeRequest, { type: 'create-note-draft' }>['payload'],
    ) => Promise<ReviewDraft>;
    captureAudio: (
      payload: Extract<RuntimeRequest, { type: 'capture-audio' }>['payload'],
    ) => Promise<ReceiverCapture>;
    savePopupCapture: (
      payload: Extract<RuntimeRequest, { type: 'save-popup-capture' }>['payload'],
    ) => Promise<ReceiverCapture>;
  },
): Promise<RuntimeActionResponse>;
export async function dispatchCaptureRuntimeMessage(
  message: RuntimeRequest,
  handlers: {
    runCaptureCycle: () => Promise<number>;
    captureActiveTab: (
      options?: Extract<RuntimeRequest, { type: 'capture-active-tab' }>['payload'],
    ) => Promise<ActiveTabCaptureResult>;
    prepareVisibleScreenshot: () => Promise<PopupPreparedCapture>;
    captureVisibleScreenshot: () => Promise<ReceiverCapture>;
    captureFile: (
      payload: Extract<RuntimeRequest, { type: 'capture-file' }>['payload'],
    ) => Promise<ReceiverCapture>;
    createNoteDraft: (
      payload: Extract<RuntimeRequest, { type: 'create-note-draft' }>['payload'],
    ) => Promise<ReviewDraft>;
    captureAudio: (
      payload: Extract<RuntimeRequest, { type: 'capture-audio' }>['payload'],
    ) => Promise<ReceiverCapture>;
    savePopupCapture: (
      payload: Extract<RuntimeRequest, { type: 'save-popup-capture' }>['payload'],
    ) => Promise<ReceiverCapture>;
  },
): Promise<RuntimeActionResponse | null> {
  if (!isCaptureRuntimeMessage(message)) {
    return null;
  }

  switch (message.type) {
    case 'manual-capture':
      return respond(handlers.runCaptureCycle, 'Roundup failed.');
    case 'capture-active-tab':
      return respond(
        () => handlers.captureActiveTab(message.payload),
        'Could not capture this tab.',
      );
    case 'prepare-visible-screenshot':
      return respond(handlers.prepareVisibleScreenshot, 'Screenshot capture failed.');
    case 'capture-visible-screenshot':
      return respond(handlers.captureVisibleScreenshot, 'Screenshot capture failed.');
    case 'capture-file':
      return respond(() => handlers.captureFile(message.payload), 'File capture failed.');
    case 'create-note-draft':
      return respond(() => handlers.createNoteDraft(message.payload), 'Note creation failed.');
    case 'capture-audio':
      return respond(() => handlers.captureAudio(message.payload), 'Audio capture failed.');
    case 'save-popup-capture':
      return respond(() => handlers.savePopupCapture(message.payload), 'Could not save capture.');
    default:
      return null;
  }
}

async function respond<T>(
  action: () => Promise<T>,
  fallbackError: string,
): Promise<RuntimeActionResponse<T>> {
  try {
    return {
      ok: true,
      data: await action(),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : fallbackError,
    };
  }
}

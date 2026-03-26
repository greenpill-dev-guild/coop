import { defineContentScript } from 'wxt/utils/define-content-script';
import { resolveReceiverBridgeMatches } from '../src/build/receiver-matches';

const APP_SOURCE = 'coop-receiver-app';
const EXTENSION_SOURCE = 'coop-receiver-extension';
const RECEIVER_BRIDGE_FLAG = '__coopReceiverBridgeInstalled';

export default defineContentScript({
  world: 'ISOLATED',
  matches: resolveReceiverBridgeMatches(import.meta.env.VITE_COOP_RECEIVER_APP_URL),
  runAt: 'document_start',
  main() {
    if ((window as Window & { [RECEIVER_BRIDGE_FLAG]?: boolean })[RECEIVER_BRIDGE_FLAG]) {
      return;
    }
    (window as Window & { [RECEIVER_BRIDGE_FLAG]?: boolean })[RECEIVER_BRIDGE_FLAG] = true;

    function postResponse(message: {
      requestId: string;
      ok: boolean;
      data?: unknown;
      error?: string;
    }) {
      window.postMessage(
        {
          source: EXTENSION_SOURCE,
          requestId: message.requestId,
          ok: message.ok,
          data: message.data,
          error: message.error,
        },
        window.location.origin,
      );
    }

    window.addEventListener('message', (event) => {
      if (event.source !== window || !event.data || typeof event.data !== 'object') {
        return;
      }

      const data = event.data as Record<string, unknown>;
      if (data.source !== APP_SOURCE || typeof data.requestId !== 'string') {
        return;
      }

      if (data.type === 'ping') {
        postResponse({
          requestId: data.requestId,
          ok: true,
        });
        return;
      }

      if (data.type !== 'ingest' || !data.envelope || typeof data.envelope !== 'object') {
        return;
      }

      chrome.runtime.sendMessage(
        {
          type: 'ingest-receiver-capture',
          payload: data.envelope,
        },
        (response) => {
          const runtimeError = chrome.runtime.lastError;
          if (runtimeError) {
            postResponse({
              requestId: data.requestId,
              ok: false,
              error: runtimeError.message || 'Receiver bridge sync failed.',
            });
            return;
          }

          postResponse({
            requestId: data.requestId,
            ok: Boolean(response?.ok),
            data: response?.data,
            error: response?.ok
              ? undefined
              : response?.error
                ? response.error
                : 'Receiver bridge sync failed.',
          });
        },
      );
    });
  },
});

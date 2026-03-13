(function receiverBridge() {
  const APP_SOURCE = 'coop-receiver-app';
  const EXTENSION_SOURCE = 'coop-receiver-extension';

  function postResponse(message) {
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

    const data = event.data;
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
})();

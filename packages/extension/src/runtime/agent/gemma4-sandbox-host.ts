import { type Gemma4HostTransport, startGemma4Host } from './gemma4-worker';

// Entry for the sandboxed iframe. The page's CSP (declared in the manifest
// under `content_security_policy.sandbox`) allows `'unsafe-eval'`, so
// onnxruntime-web's `new Function()` hot path executes. The transport relays
// postMessage between this window and the parent (the offscreen page or any
// extension page that mounted the iframe).
function createWindowTransport(): Gemma4HostTransport {
  let replyTarget: Window | null = null;

  return {
    onMessage(handler) {
      window.addEventListener('message', (event) => {
        if (!event.source) return;
        // Lock the reply target to the first sender. The parent extension page
        // is the only legitimate caller; the iframe is opaque-origin so the
        // browser already isolates inbound traffic to messages our parent sent.
        if (!replyTarget) {
          replyTarget = event.source as Window;
        }
        handler(event.data);
      });
    },
    postMessage(message) {
      // The sandboxed iframe runs at an opaque origin; targetOrigin '*' is the
      // correct (and only safe) choice — the parent's identity is fixed by who
      // mounted the iframe in the first place, not by the postMessage check.
      replyTarget?.postMessage(message, '*');
    },
  };
}

startGemma4Host(createWindowTransport());

// Signal readiness so the bridge can resolve its "iframe alive" promise
// without waiting for the model load to begin.
window.parent?.postMessage({ type: 'sandbox-ready' }, '*');

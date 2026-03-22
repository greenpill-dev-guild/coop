import { webcrypto } from 'node:crypto';
import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';

if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    configurable: true,
  });
}

// happy-dom's HTMLMediaElement.srcObject setter rejects non-MediaStream values;
// relax it so test mocks (plain objects with getTracks) are accepted.
const srcObjectStore = new WeakMap<object, unknown>();
if (typeof HTMLMediaElement !== 'undefined') {
  Object.defineProperty(HTMLMediaElement.prototype, 'srcObject', {
    configurable: true,
    set(value: unknown) {
      srcObjectStore.set(this as object, value);
    },
    get() {
      return srcObjectStore.get(this as object) ?? null;
    },
  });
}

// Ensure HTMLDialogElement methods exist in happy-dom
if (typeof HTMLDialogElement !== 'undefined') {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute('open', '');
    };
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function () {
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    };
  }
}

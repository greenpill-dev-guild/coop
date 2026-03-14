import { webcrypto } from 'node:crypto';
import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';

if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    configurable: true,
  });
}

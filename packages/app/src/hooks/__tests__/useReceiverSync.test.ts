import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Verifies that useReceiverSync does NOT use setInterval for periodic
 * reconciliation. Instead, it should rely exclusively on doc.on('update')
 * callbacks from the Yjs document.
 *
 * We read the raw source file to verify the interval pattern is gone,
 * since .toString() on compiled functions is unreliable.
 */
describe('useReceiverSync polling removal', () => {
  const hookPath = path.resolve(__dirname, '../useReceiverSync.ts');
  const source = fs.readFileSync(hookPath, 'utf-8');

  it('does not contain a setInterval-based periodic reconciliation effect', () => {
    // The old pattern was: setInterval(() => { void reconcilePairing(); }, 2_000)
    expect(source).not.toMatch(/setInterval/);
  });

  it('relies on doc.on update for reconciliation', () => {
    // Verify the Yjs doc update listener is still in place
    expect(source).toMatch(/doc\.on\(['"]update['"]/);
  });
});

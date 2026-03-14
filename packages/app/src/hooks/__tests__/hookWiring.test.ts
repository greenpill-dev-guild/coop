import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Structural tests verifying that app.tsx delegates to extracted hooks
 * rather than containing inline implementations.
 */
describe('app.tsx hook wiring', () => {
  const appPath = path.resolve(__dirname, '../../app.tsx');
  const source = fs.readFileSync(appPath, 'utf-8');

  it('imports useReceiverSettings', () => {
    expect(source).toMatch(/useReceiverSettings/);
  });

  it('imports useCapture', () => {
    expect(source).toMatch(/useCapture/);
  });

  it('imports usePairingFlow', () => {
    expect(source).toMatch(/usePairingFlow/);
  });

  it('imports useReceiverSync', () => {
    expect(source).toMatch(/useReceiverSync/);
  });

  it('does not define inline reconcilePairing callback', () => {
    // After wiring, reconcilePairing should come from useReceiverSync, not be defined inline
    expect(source).not.toMatch(/const reconcilePairing = useCallback/);
  });

  it('does not define inline stashCapture callback', () => {
    // After wiring, stashCapture should come from useCapture, not be defined inline
    expect(source).not.toMatch(/const stashCapture = useCallback/);
  });

  it('does not define inline startRecording callback', () => {
    expect(source).not.toMatch(/const startRecording = useCallback/);
  });

  it('does not define inline reviewPairing callback', () => {
    expect(source).not.toMatch(/const reviewPairing = useCallback/);
  });

  it('does not define inline ensureDeviceIdentity callback', () => {
    expect(source).not.toMatch(/const ensureDeviceIdentity = useCallback/);
  });
});

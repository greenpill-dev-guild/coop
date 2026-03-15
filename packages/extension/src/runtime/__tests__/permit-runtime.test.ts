import { createPasskeySession } from '@coop/shared';
import { describe, expect, it } from 'vitest';
import {
  createRuntimePermitExecutor,
  resolveDelegatedActionExecution,
  runtimePermitExecutorLabel,
} from '../permit-runtime';

describe('permit runtime helpers', () => {
  it('binds the current passkey session to the runtime permit executor', async () => {
    const session = await createPasskeySession({
      displayName: 'Ari',
      rpId: 'coop.test',
      credential: {
        id: 'credential-1',
        publicKey: `0x${'11'.repeat(32)}`,
      },
    });

    expect(createRuntimePermitExecutor(session)).toEqual({
      label: runtimePermitExecutorLabel,
      localIdentityId: 'identity-credential-1',
    });
    expect(createRuntimePermitExecutor(null)).toEqual({
      label: runtimePermitExecutorLabel,
      localIdentityId: undefined,
    });
  });

  it('rejects delegated archive execution when the payload coop drifts from the scoped coop', () => {
    const result = resolveDelegatedActionExecution({
      actionClass: 'archive-artifact',
      coopId: 'coop-1',
      actionPayload: {
        coopId: 'coop-2',
        artifactId: 'artifact-1',
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain('does not match scoped coop');
    }
  });

  it('collects draft and target coop ids for delegated publish validation', () => {
    const result = resolveDelegatedActionExecution({
      actionClass: 'publish-ready-draft',
      coopId: 'coop-1',
      actionPayload: {
        draftId: 'draft-1',
        targetCoopIds: ['coop-1', 'coop-2'],
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.targetIds).toEqual(['draft-1', 'coop-1', 'coop-2']);
    }
  });
});

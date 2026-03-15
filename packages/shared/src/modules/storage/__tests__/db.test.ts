import { afterEach, describe, expect, it } from 'vitest';
import type {
  ActionBundle,
  ActionLogEntry,
  ActionPolicy,
  AgentObservation,
  AgentPlan,
  AnchorCapability,
  EncryptedSessionMaterial,
  ExecutionPermit,
  PermitLogEntry,
  PrivilegedActionLogEntry,
  ReviewDraft,
  SessionCapability,
  SessionCapabilityLogEntry,
  SkillRun,
  TrustedNodeArchiveConfig,
} from '../../../contracts/schema';
import { createMockPasskeyIdentity } from '../../auth/identity';
import { createCoop } from '../../coop/flows';
import { createReceiverCapture, createReceiverDeviceIdentity } from '../../receiver/capture';
import { createReceiverPairingPayload, toReceiverPairingRecord } from '../../receiver/pairing';
import {
  type CoopDexie,
  createCoopDb,
  deleteEncryptedSessionMaterial,
  findAgentObservationByFingerprint,
  getActionBundle,
  getActiveReceiverPairing,
  getAgentObservation,
  getAgentPlan,
  getAnchorCapability,
  getAuthSession,
  getEncryptedSessionMaterial,
  getExecutionPermit,
  getReceiverCapture,
  getReceiverCaptureBlob,
  getReceiverDeviceIdentity,
  getReviewDraft,
  getSessionCapability,
  getSkillRun,
  getSoundPreferences,
  getTrustedNodeArchiveConfig,
  getUiPreferences,
  isReplayIdRecorded,
  listActionBundles,
  listActionBundlesByStatus,
  listActionLogEntries,
  listActionPolicies,
  listAgentObservations,
  listAgentObservationsByStatus,
  listAgentPlans,
  listAgentPlansByObservationId,
  listExecutionPermits,
  listExecutionPermitsByCoopId,
  listLocalIdentities,
  listPermitLogEntries,
  listPrivilegedActionLog,
  listReceiverCaptures,
  listReceiverPairings,
  listRecordedReplayIds,
  listSessionCapabilities,
  listSessionCapabilitiesByCoopId,
  listSessionCapabilityLogEntries,
  listSkillRuns,
  listSkillRunsByPlanId,
  loadCoopState,
  recordReplayId,
  saveActionBundle,
  saveActionLogEntry,
  saveAgentObservation,
  saveAgentPlan,
  saveCoopState,
  saveEncryptedSessionMaterial,
  saveExecutionPermit,
  savePermitLogEntry,
  saveReceiverCapture,
  saveReviewDraft,
  saveSessionCapability,
  saveSessionCapabilityLogEntry,
  saveSkillRun,
  setActionPolicies,
  setActiveReceiverPairing,
  setAnchorCapability,
  setAuthSession,
  setPrivilegedActionLog,
  setReceiverDeviceIdentity,
  setSoundPreferences,
  setTrustedNodeArchiveConfig,
  setUiPreferences,
  updateReceiverCapture,
  updateReceiverPairing,
  updateReviewDraft,
  upsertLocalIdentity,
  upsertReceiverPairing,
} from '../db';

const databases: CoopDexie[] = [];

/** Create a uniquely-named Dexie instance and track it for cleanup. */
function freshDb(): CoopDexie {
  const db = createCoopDb(`coop-db-${crypto.randomUUID()}`);
  databases.push(db);
  return db;
}

const NOW = '2026-03-13T12:00:00.000Z';
const LATER = '2026-03-13T13:00:00.000Z';
const MUCH_LATER = '2026-03-14T12:00:00.000Z';

function buildSetupInsights() {
  return {
    summary: 'A valid setup payload for Dexie persistence tests.',
    crossCuttingPainPoints: ['Context is scattered'],
    crossCuttingOpportunities: ['Shared memory can persist cleanly'],
    lenses: [
      {
        lens: 'capital-formation',
        currentState: 'Links are scattered.',
        painPoints: 'Funding context disappears.',
        improvements: 'Route leads into shared state.',
      },
      {
        lens: 'impact-reporting',
        currentState: 'Reporting is rushed.',
        painPoints: 'Evidence gets dropped.',
        improvements: 'Collect evidence incrementally.',
      },
      {
        lens: 'governance-coordination',
        currentState: 'Calls happen weekly.',
        painPoints: 'Actions slip.',
        improvements: 'Review actions through the board.',
      },
      {
        lens: 'knowledge-garden-resources',
        currentState: 'Resources live in tabs.',
        painPoints: 'Research repeats.',
        improvements: 'Persist high-signal references.',
      },
    ],
  } as const;
}

function buildReviewDraft(overrides: Partial<ReviewDraft> = {}): ReviewDraft {
  return {
    id: `draft-${crypto.randomUUID()}`,
    interpretationId: 'interp-1',
    extractId: 'extract-1',
    sourceCandidateId: 'candidate-1',
    title: 'Test Draft',
    summary: 'A test summary',
    sources: [{ label: 'Source', url: 'https://example.com', domain: 'example.com' }],
    tags: ['test'],
    category: 'resource',
    whyItMatters: 'It matters because tests.',
    suggestedNextStep: 'Review it.',
    suggestedTargetCoopIds: ['coop-1'],
    confidence: 0.8,
    rationale: 'High confidence draft.',
    status: 'draft',
    workflowStage: 'ready',
    provenance: {
      type: 'tab',
      interpretationId: 'interp-1',
      extractId: 'extract-1',
      sourceCandidateId: 'candidate-1',
    },
    createdAt: NOW,
    ...overrides,
  };
}

function buildActionBundle(overrides: Partial<ActionBundle> = {}): ActionBundle {
  return {
    id: `bundle-${crypto.randomUUID()}`,
    replayId: `replay-${crypto.randomUUID()}`,
    actionClass: 'archive-artifact',
    coopId: 'coop-1',
    memberId: 'member-1',
    payload: { artifactId: 'art-1' },
    createdAt: NOW,
    expiresAt: MUCH_LATER,
    policyId: 'policy-1',
    status: 'proposed',
    digest: `0x${'ab'.repeat(32)}`,
    ...overrides,
  };
}

function buildActionLogEntry(overrides: Partial<ActionLogEntry> = {}): ActionLogEntry {
  return {
    id: `log-${crypto.randomUUID()}`,
    bundleId: 'bundle-1',
    eventType: 'proposal-created',
    actionClass: 'archive-artifact',
    detail: 'Bundle proposed',
    createdAt: NOW,
    ...overrides,
  };
}

function buildExecutionPermit(overrides: Partial<ExecutionPermit> = {}): ExecutionPermit {
  return {
    id: `permit-${crypto.randomUUID()}`,
    coopId: 'coop-1',
    issuedBy: { memberId: 'member-1', displayName: 'Rae' },
    executor: { label: 'Coop Agent' },
    createdAt: NOW,
    expiresAt: MUCH_LATER,
    maxUses: 10,
    usedCount: 0,
    allowedActions: ['archive-artifact'],
    status: 'active',
    ...overrides,
  };
}

function buildPermitLogEntry(overrides: Partial<PermitLogEntry> = {}): PermitLogEntry {
  return {
    id: `plog-${crypto.randomUUID()}`,
    permitId: 'permit-1',
    eventType: 'permit-issued',
    detail: 'Permit issued',
    createdAt: NOW,
    ...overrides,
  };
}

function buildSessionCapability(overrides: Partial<SessionCapability> = {}): SessionCapability {
  return {
    id: `cap-${crypto.randomUUID()}`,
    coopId: 'coop-1',
    createdAt: NOW,
    updatedAt: NOW,
    sessionAddress: '0x1111111111111111111111111111111111111111',
    validatorAddress: '0x2222222222222222222222222222222222222222',
    validatorInitData: '0xabcd',
    status: 'active',
    statusDetail: 'Session created',
    scope: {
      allowedActions: ['green-goods-create-garden'],
      targetAllowlist: {},
      maxUses: 5,
      expiresAt: MUCH_LATER,
      chainKey: 'sepolia',
      safeAddress: '0x3333333333333333333333333333333333333333',
    },
    issuedBy: { memberId: 'member-1', displayName: 'Rae' },
    executor: { label: 'Session Executor' },
    usedCount: 0,
    ...overrides,
  };
}

function buildSessionCapabilityLogEntry(
  overrides: Partial<SessionCapabilityLogEntry> = {},
): SessionCapabilityLogEntry {
  return {
    id: `sclog-${crypto.randomUUID()}`,
    capabilityId: 'cap-1',
    coopId: 'coop-1',
    eventType: 'session-issued',
    detail: 'Session capability issued',
    createdAt: NOW,
    ...overrides,
  };
}

function buildEncryptedSessionMaterial(
  overrides: Partial<EncryptedSessionMaterial> = {},
): EncryptedSessionMaterial {
  return {
    capabilityId: `cap-${crypto.randomUUID()}`,
    sessionAddress: '0x1111111111111111111111111111111111111111',
    ciphertext: 'encrypted-data-here',
    iv: 'iv-data-here',
    algorithm: 'aes-gcm',
    wrappedAt: NOW,
    version: 1,
    ...overrides,
  };
}

function buildAgentObservation(overrides: Partial<AgentObservation> = {}): AgentObservation {
  return {
    id: `obs-${crypto.randomUUID()}`,
    trigger: 'high-confidence-draft',
    status: 'pending',
    title: 'Test Observation',
    summary: 'A draft with high confidence was detected.',
    fingerprint: `fp-${crypto.randomUUID()}`,
    payload: { draftId: 'draft-1' },
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function buildAgentPlan(overrides: Partial<AgentPlan> = {}): AgentPlan {
  return {
    id: `plan-${crypto.randomUUID()}`,
    observationId: 'obs-1',
    status: 'pending',
    provider: 'heuristic',
    confidence: 0.9,
    goal: 'Process draft',
    rationale: 'Draft is ready.',
    steps: [],
    actionProposals: [],
    requiresApproval: false,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function buildSkillRun(overrides: Partial<SkillRun> = {}): SkillRun {
  return {
    id: `run-${crypto.randomUUID()}`,
    observationId: 'obs-1',
    planId: 'plan-1',
    skillId: 'opportunity-extractor',
    skillVersion: '1.0.0',
    provider: 'heuristic',
    status: 'pending',
    startedAt: NOW,
    outputSchemaRef: 'opportunity-extractor-output',
    ...overrides,
  };
}

afterEach(async () => {
  while (databases.length > 0) {
    const db = databases.pop();
    await db?.delete();
  }
});

// ---------------------------------------------------------------------------
// Coop state persistence
// ---------------------------------------------------------------------------

describe('coop Dexie storage', () => {
  it('persists and reloads coop state through IndexedDB', async () => {
    const db = freshDb();
    const created = createCoop({
      coopName: 'Storage Coop',
      purpose: 'Test local persistence.',
      creatorDisplayName: 'Rae',
      captureMode: 'manual',
      seedContribution: 'I care about clean local persistence.',
      setupInsights: buildSetupInsights(),
    });

    await saveCoopState(db, created.state);
    const loaded = await loadCoopState(db, created.state.profile.id);

    expect(loaded?.profile.id).toBe(created.state.profile.id);
    expect(loaded?.artifacts).toHaveLength(created.state.artifacts.length);
  });

  it('returns null when loading a non-existent coop', async () => {
    const db = freshDb();
    expect(await loadCoopState(db, 'non-existent')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Review draft CRUD
// ---------------------------------------------------------------------------

describe('review draft persistence', () => {
  it('saves and retrieves a review draft', async () => {
    const db = freshDb();
    const draft = buildReviewDraft();

    await saveReviewDraft(db, draft);
    const loaded = await getReviewDraft(db, draft.id);

    expect(loaded).toBeDefined();
    expect(loaded?.id).toBe(draft.id);
    expect(loaded?.title).toBe('Test Draft');
  });

  it('returns undefined for a non-existent draft', async () => {
    const db = freshDb();
    expect(await getReviewDraft(db, 'no-such-draft')).toBeUndefined();
  });

  it('updates an existing review draft with a patch', async () => {
    const db = freshDb();
    const draft = buildReviewDraft();
    await saveReviewDraft(db, draft);

    const updated = await updateReviewDraft(db, draft.id, { title: 'Updated Title' });

    expect(updated).not.toBeNull();
    expect(updated?.title).toBe('Updated Title');
    expect(updated?.summary).toBe(draft.summary);

    const reloaded = await getReviewDraft(db, draft.id);
    expect(reloaded?.title).toBe('Updated Title');
  });

  it('returns null when updating a non-existent draft', async () => {
    const db = freshDb();
    const result = await updateReviewDraft(db, 'missing', { title: 'New' });
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Settings: sound, UI, auth session
// ---------------------------------------------------------------------------

describe('settings persistence', () => {
  it('stores sound preferences and auth sessions explicitly', async () => {
    const db = freshDb();

    await setSoundPreferences(db, {
      enabled: true,
      reducedMotion: true,
      reducedSound: false,
    });
    await setAuthSession(db, {
      authMode: 'passkey',
      displayName: 'Kai',
      primaryAddress: '0x1111111111111111111111111111111111111111',
      createdAt: new Date().toISOString(),
      identityWarning: 'Stored locally.',
      passkey: {
        id: 'credential-1',
        publicKey: '0x1234',
        rpId: 'coop.local',
      },
    });

    expect(await getSoundPreferences(db)).toEqual({
      enabled: true,
      reducedMotion: true,
      reducedSound: false,
    });
    expect((await getAuthSession(db))?.displayName).toBe('Kai');

    await setAuthSession(db, null);
    expect(await getAuthSession(db)).toBeNull();
  });

  it('stores ui preferences separately from coop content', async () => {
    const db = freshDb();

    await setUiPreferences(db, {
      notificationsEnabled: false,
      localInferenceOptIn: true,
      preferredExportMethod: 'file-picker',
    });

    expect(await getUiPreferences(db)).toEqual({
      notificationsEnabled: false,
      localInferenceOptIn: true,
      preferredExportMethod: 'file-picker',
    });
  });

  it('returns null from getSoundPreferences when no value is stored', async () => {
    const db = freshDb();
    expect(await getSoundPreferences(db)).toBeNull();
  });

  it('returns null from getAuthSession when no value is stored', async () => {
    const db = freshDb();
    expect(await getAuthSession(db)).toBeNull();
  });

  it('returns null from getUiPreferences when stored value does not match schema', async () => {
    const db = freshDb();
    await db.settings.put({
      key: 'ui-preferences',
      value: { bad: 'data', notificationsEnabled: 42 },
    });

    expect(await getUiPreferences(db)).toBeNull();
  });

  it('returns defaults from getSoundPreferences when stored value has extra keys', async () => {
    const db = freshDb();
    // soundPreferencesSchema uses .default() on all booleans, so extra keys are stripped
    // and missing keys get defaults rather than causing parse failure
    await db.settings.put({
      key: 'sound-preferences',
      value: { bad: 'data' },
    });

    expect(await getSoundPreferences(db)).toEqual({
      enabled: false,
      reducedMotion: false,
      reducedSound: false,
    });
  });

  it('returns null from getSoundPreferences when stored value is null', async () => {
    const db = freshDb();
    await db.settings.put({
      key: 'sound-preferences',
      value: null,
    });

    expect(await getSoundPreferences(db)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Anchor capability
// ---------------------------------------------------------------------------

describe('anchor capability persistence', () => {
  it('saves and retrieves an anchor capability', async () => {
    const db = freshDb();
    const capability: AnchorCapability = {
      enabled: true,
      nodeId: 'test-node',
      updatedAt: NOW,
      actorAddress: '0x1111111111111111111111111111111111111111',
    };

    await setAnchorCapability(db, capability);
    const loaded = await getAnchorCapability(db);

    expect(loaded).not.toBeNull();
    expect(loaded?.enabled).toBe(true);
    expect(loaded?.nodeId).toBe('test-node');
  });

  it('returns null when stored value does not match schema', async () => {
    const db = freshDb();
    await db.settings.put({ key: 'anchor-capability', value: { corrupt: true } });

    expect(await getAnchorCapability(db)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Privileged action log
// ---------------------------------------------------------------------------

describe('privileged action log persistence', () => {
  it('saves and retrieves valid privileged action log entries', async () => {
    const db = freshDb();
    const entries: PrivilegedActionLogEntry[] = [
      {
        id: 'pal-1',
        actionType: 'anchor-mode-toggle',
        status: 'succeeded',
        detail: 'Anchor mode enabled',
        createdAt: NOW,
        context: {},
      },
    ];

    await setPrivilegedActionLog(db, entries);
    const loaded = await listPrivilegedActionLog(db);

    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('pal-1');
  });

  it('returns empty array when no log is stored', async () => {
    const db = freshDb();
    expect(await listPrivilegedActionLog(db)).toEqual([]);
  });

  it('filters out corrupt entries while preserving valid ones', async () => {
    const db = freshDb();
    await db.settings.put({
      key: 'privileged-action-log',
      value: [
        {
          id: 'pal-good',
          actionType: 'archive-upload',
          status: 'succeeded',
          detail: 'Upload OK',
          createdAt: NOW,
          context: {},
        },
        { bad: 'entry' },
      ],
    });

    const result = await listPrivilegedActionLog(db);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('pal-good');
  });

  it('returns empty array from listPrivilegedActionLog when entries are corrupt', async () => {
    const db = freshDb();
    await db.settings.put({
      key: 'privileged-action-log',
      value: [{ bad: 'entry' }, { also: 'bad' }],
    });

    expect(await listPrivilegedActionLog(db)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Trusted node archive config
// ---------------------------------------------------------------------------

describe('trusted node archive config persistence', () => {
  it('saves and retrieves a trusted node archive config', async () => {
    const db = freshDb();
    const config: TrustedNodeArchiveConfig = {
      spaceDid: 'did:key:z1234',
      delegationIssuer: 'did:key:zIssuer',
      gatewayBaseUrl: 'https://storacha.link',
      spaceDelegation: 'delegation-proof-abc',
      proofs: [],
      allowsFilecoinInfo: false,
      expirationSeconds: 600,
    };

    await setTrustedNodeArchiveConfig(db, config);
    const loaded = await getTrustedNodeArchiveConfig(db);

    expect(loaded).not.toBeNull();
    expect(loaded?.spaceDid).toBe('did:key:z1234');
  });

  it('returns null when stored value does not match schema', async () => {
    const db = freshDb();
    await db.settings.put({ key: 'trusted-node-archive-config', value: { corrupt: true } });

    expect(await getTrustedNodeArchiveConfig(db)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Local identities
// ---------------------------------------------------------------------------

describe('local identity persistence', () => {
  it('upserts and sorts local passkey identities by recency', async () => {
    const db = freshDb();
    const older = createMockPasskeyIdentity('Older').record;
    const newer = createMockPasskeyIdentity('Newer').record;

    await upsertLocalIdentity(db, {
      ...older,
      lastUsedAt: '2026-03-10T10:00:00.000Z',
    });
    await upsertLocalIdentity(db, {
      ...newer,
      lastUsedAt: '2026-03-11T10:00:00.000Z',
    });

    const identities = await listLocalIdentities(db);
    expect(identities.map((identity) => identity.displayName)).toEqual(['Newer', 'Older']);
  });

  it('updates an existing identity on re-upsert', async () => {
    const db = freshDb();
    const identity = createMockPasskeyIdentity('First').record;

    await upsertLocalIdentity(db, { ...identity, lastUsedAt: '2026-03-10T10:00:00.000Z' });
    await upsertLocalIdentity(db, { ...identity, lastUsedAt: '2026-03-12T10:00:00.000Z' });

    const identities = await listLocalIdentities(db);
    expect(identities).toHaveLength(1);
    expect(identities[0].lastUsedAt).toBe('2026-03-12T10:00:00.000Z');
  });

  it('returns empty list when no identities exist', async () => {
    const db = freshDb();
    expect(await listLocalIdentities(db)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Receiver pairings
// ---------------------------------------------------------------------------

describe('receiver pairing persistence', () => {
  function makePairing(memberName: string, acceptedAt: string, issuedAt?: string) {
    return toReceiverPairingRecord(
      createReceiverPairingPayload({
        coopId: 'coop-1',
        coopDisplayName: 'River Coop',
        memberId: `member-${memberName}`,
        memberDisplayName: memberName,
        issuedAt,
      }),
      acceptedAt,
    );
  }

  it('stores and lists receiver pairings ordered by issuedAt descending', async () => {
    const db = freshDb();
    // Pass explicit issuedAt to control ordering (createReceiverPairingPayload defaults to nowIso)
    const first = makePairing('Mina', '2026-03-11T18:00:00.000Z', '2026-03-10T10:00:00.000Z');
    const second = makePairing('Ari', '2026-03-11T19:00:00.000Z', '2026-03-11T10:00:00.000Z');

    await upsertReceiverPairing(db, first);
    await upsertReceiverPairing(db, second);

    const list = await listReceiverPairings(db);
    expect(list).toHaveLength(2);
    expect(list[0].memberDisplayName).toBe('Ari');
    expect(list[1].memberDisplayName).toBe('Mina');
  });

  it('stores receiver pairings, captures, blobs, and device identity locally', async () => {
    const db = freshDb();
    const device = createReceiverDeviceIdentity('Field Phone');
    const pairing = makePairing('Mina', '2026-03-11T18:00:00.000Z');
    const blob = new Blob(['soft clucks'], { type: 'audio/webm' });
    const capture = createReceiverCapture({
      deviceId: device.id,
      kind: 'audio',
      blob,
      pairing,
      title: 'Field voice note',
    });

    await setReceiverDeviceIdentity(db, device);
    await upsertReceiverPairing(db, pairing);
    await setActiveReceiverPairing(db, pairing.pairingId);
    await saveReceiverCapture(db, capture, blob);

    expect(await getReceiverDeviceIdentity(db)).toEqual(device);
    expect((await getActiveReceiverPairing(db))?.pairingId).toBe(pairing.pairingId);
    expect((await listReceiverPairings(db)).map((item) => item.coopDisplayName)).toEqual([
      'River Coop',
    ]);
    expect((await listReceiverCaptures(db)).map((item) => item.title)).toEqual([
      'Field voice note',
    ]);
    const storedBlob = await getReceiverCaptureBlob(db, capture.id);
    expect(storedBlob).not.toBeNull();
  });

  it('does not clear the active receiver pairing when switching to an unknown id', async () => {
    const db = freshDb();
    const first = makePairing('Mina', '2026-03-11T18:00:00.000Z');
    const second = makePairing('Ari', '2026-03-11T18:10:00.000Z');

    await upsertReceiverPairing(db, { ...first, active: true });
    await upsertReceiverPairing(db, { ...second, active: false });

    const result = await setActiveReceiverPairing(db, 'missing-pairing-id');

    expect(result).toBeNull();
    expect((await getActiveReceiverPairing(db))?.pairingId).toBe(first.pairingId);
  });

  it('returns null from getActiveReceiverPairing when no pairings exist', async () => {
    const db = freshDb();
    expect(await getActiveReceiverPairing(db)).toBeNull();
  });

  it('switches active pairing and deactivates all others', async () => {
    const db = freshDb();
    const first = makePairing('Mina', '2026-03-11T18:00:00.000Z');
    const second = makePairing('Ari', '2026-03-11T19:00:00.000Z');

    await upsertReceiverPairing(db, { ...first, active: true });
    await upsertReceiverPairing(db, { ...second, active: false });

    await setActiveReceiverPairing(db, second.pairingId);

    const active = await getActiveReceiverPairing(db);
    expect(active?.pairingId).toBe(second.pairingId);

    const all = await listReceiverPairings(db);
    const activeCount = all.filter((p) => p.active).length;
    expect(activeCount).toBe(1);
  });

  it('updates an existing receiver pairing with a patch', async () => {
    const db = freshDb();
    const pairing = makePairing('Mina', '2026-03-11T18:00:00.000Z');
    await upsertReceiverPairing(db, pairing);

    const updated = await updateReceiverPairing(db, pairing.pairingId, {
      coopDisplayName: 'Updated Coop',
    });

    expect(updated).not.toBeNull();
    expect(updated?.coopDisplayName).toBe('Updated Coop');
  });

  it('returns null when updating a non-existent pairing', async () => {
    const db = freshDb();
    const result = await updateReceiverPairing(db, 'missing', { coopDisplayName: 'New' });
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Receiver captures
// ---------------------------------------------------------------------------

describe('receiver capture persistence', () => {
  it('saves a capture with blob and retrieves both independently', async () => {
    const db = freshDb();
    const device = createReceiverDeviceIdentity('Phone');
    const pairing = toReceiverPairingRecord(
      createReceiverPairingPayload({
        coopId: 'coop-1',
        coopDisplayName: 'Test Coop',
        memberId: 'member-1',
        memberDisplayName: 'Tester',
      }),
      NOW,
    );
    const blob = new Blob(['audio data'], { type: 'audio/webm' });
    const capture = createReceiverCapture({
      deviceId: device.id,
      kind: 'audio',
      blob,
      pairing,
      title: 'Test capture',
    });

    await saveReceiverCapture(db, capture, blob);

    const loaded = await getReceiverCapture(db, capture.id);
    expect(loaded).toBeDefined();
    expect(loaded?.title).toBe('Test capture');

    const loadedBlob = await getReceiverCaptureBlob(db, capture.id);
    expect(loadedBlob).not.toBeNull();
  });

  it('returns null from getReceiverCaptureBlob for a non-existent capture', async () => {
    const db = freshDb();
    expect(await getReceiverCaptureBlob(db, 'missing')).toBeNull();
  });

  it('updates an existing receiver capture with a patch', async () => {
    const db = freshDb();
    const device = createReceiverDeviceIdentity('Phone');
    const pairing = toReceiverPairingRecord(
      createReceiverPairingPayload({
        coopId: 'coop-1',
        coopDisplayName: 'Test Coop',
        memberId: 'member-1',
        memberDisplayName: 'Tester',
      }),
      NOW,
    );
    const blob = new Blob(['data'], { type: 'audio/webm' });
    const capture = createReceiverCapture({
      deviceId: device.id,
      kind: 'audio',
      blob,
      pairing,
      title: 'Original',
    });
    await saveReceiverCapture(db, capture, blob);

    const updated = await updateReceiverCapture(db, capture.id, { title: 'Renamed' });

    expect(updated).not.toBeNull();
    expect(updated?.title).toBe('Renamed');
  });

  it('returns null when updating a non-existent capture', async () => {
    const db = freshDb();
    expect(await updateReceiverCapture(db, 'missing', { title: 'Nope' })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Receiver device identity
// ---------------------------------------------------------------------------

describe('receiver device identity persistence', () => {
  it('returns null when no device identity is stored', async () => {
    const db = freshDb();
    expect(await getReceiverDeviceIdentity(db)).toBeNull();
  });

  it('returns null when stored device identity does not match schema', async () => {
    const db = freshDb();
    await db.settings.put({ key: 'receiver-device-identity', value: { corrupt: true } });
    expect(await getReceiverDeviceIdentity(db)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Action policies
// ---------------------------------------------------------------------------

describe('action policy persistence', () => {
  it('saves and retrieves action policies', async () => {
    const db = freshDb();
    const policies: ActionPolicy[] = [
      {
        id: 'pol-1',
        actionClass: 'archive-artifact',
        approvalRequired: true,
        replayProtection: true,
        createdAt: NOW,
        updatedAt: NOW,
      },
      {
        id: 'pol-2',
        actionClass: 'publish-ready-draft',
        approvalRequired: false,
        replayProtection: true,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ];

    await setActionPolicies(db, policies);
    const loaded = await listActionPolicies(db);

    expect(loaded).toHaveLength(2);
    expect(loaded.map((p) => p.id)).toEqual(['pol-1', 'pol-2']);
  });

  it('returns empty array when no policies are stored', async () => {
    const db = freshDb();
    expect(await listActionPolicies(db)).toEqual([]);
  });

  it('overwrites existing policies on re-set', async () => {
    const db = freshDb();
    await setActionPolicies(db, [
      {
        id: 'pol-old',
        actionClass: 'archive-artifact',
        approvalRequired: true,
        replayProtection: true,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ]);
    await setActionPolicies(db, [
      {
        id: 'pol-new',
        actionClass: 'publish-ready-draft',
        approvalRequired: false,
        replayProtection: true,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ]);

    const loaded = await listActionPolicies(db);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('pol-new');
  });
});

// ---------------------------------------------------------------------------
// Action bundles
// ---------------------------------------------------------------------------

describe('action bundle persistence', () => {
  it('saves and retrieves an action bundle by id', async () => {
    const db = freshDb();
    const bundle = buildActionBundle();

    await saveActionBundle(db, bundle);
    const loaded = await getActionBundle(db, bundle.id);

    expect(loaded).toBeDefined();
    expect(loaded?.id).toBe(bundle.id);
    expect(loaded?.actionClass).toBe('archive-artifact');
  });

  it('returns undefined for a non-existent bundle', async () => {
    const db = freshDb();
    expect(await getActionBundle(db, 'no-such-bundle')).toBeUndefined();
  });

  it('lists action bundles ordered by createdAt descending', async () => {
    const db = freshDb();
    const older = buildActionBundle({ createdAt: NOW });
    const newer = buildActionBundle({ createdAt: LATER });

    await saveActionBundle(db, older);
    await saveActionBundle(db, newer);

    const list = await listActionBundles(db);
    expect(list).toHaveLength(2);
    expect(list[0].id).toBe(newer.id);
    expect(list[1].id).toBe(older.id);
  });

  it('filters action bundles by status', async () => {
    const db = freshDb();
    const proposed = buildActionBundle({ status: 'proposed' });
    const approved = buildActionBundle({ status: 'approved' });
    const rejected = buildActionBundle({ status: 'rejected' });

    await saveActionBundle(db, proposed);
    await saveActionBundle(db, approved);
    await saveActionBundle(db, rejected);

    const result = await listActionBundlesByStatus(db, ['proposed', 'approved']);
    expect(result).toHaveLength(2);
    expect(result.map((b) => b.status).sort()).toEqual(['approved', 'proposed']);
  });

  it('returns empty array when filtering by status with no matches', async () => {
    const db = freshDb();
    const proposed = buildActionBundle({ status: 'proposed' });
    await saveActionBundle(db, proposed);

    const result = await listActionBundlesByStatus(db, ['executed']);
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Action log entries
// ---------------------------------------------------------------------------

describe('action log entry persistence', () => {
  it('saves and lists action log entries', async () => {
    const db = freshDb();
    const entry = buildActionLogEntry();

    await saveActionLogEntry(db, entry);
    const list = await listActionLogEntries(db);

    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(entry.id);
  });

  it('lists entries ordered by createdAt descending with limit', async () => {
    const db = freshDb();
    const entries = Array.from({ length: 5 }, (_, i) =>
      buildActionLogEntry({
        createdAt: `2026-03-13T1${i}:00:00.000Z`,
      }),
    );

    for (const entry of entries) {
      await saveActionLogEntry(db, entry);
    }

    const limited = await listActionLogEntries(db, 3);
    expect(limited).toHaveLength(3);
    // Most recent first
    expect(limited[0].createdAt).toBe('2026-03-13T14:00:00.000Z');
  });
});

// ---------------------------------------------------------------------------
// Replay IDs
// ---------------------------------------------------------------------------

describe('replay ID persistence', () => {
  it('records and checks replay IDs', async () => {
    const db = freshDb();

    expect(await isReplayIdRecorded(db, 'replay-1')).toBe(false);

    await recordReplayId(db, 'replay-1', 'bundle-1', NOW);

    expect(await isReplayIdRecorded(db, 'replay-1')).toBe(true);
    expect(await isReplayIdRecorded(db, 'replay-unknown')).toBe(false);
  });

  it('lists all recorded replay IDs', async () => {
    const db = freshDb();

    await recordReplayId(db, 'replay-a', 'bundle-a', NOW);
    await recordReplayId(db, 'replay-b', 'bundle-b', NOW);

    const ids = await listRecordedReplayIds(db);
    expect(ids.sort()).toEqual(['replay-a', 'replay-b']);
  });

  it('returns empty list when no replay IDs are recorded', async () => {
    const db = freshDb();
    expect(await listRecordedReplayIds(db)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Execution permits
// ---------------------------------------------------------------------------

describe('execution permit persistence', () => {
  it('saves and retrieves an execution permit by id', async () => {
    const db = freshDb();
    const permit = buildExecutionPermit();

    await saveExecutionPermit(db, permit);
    const loaded = await getExecutionPermit(db, permit.id);

    expect(loaded).toBeDefined();
    expect(loaded?.id).toBe(permit.id);
    expect(loaded?.status).toBe('active');
  });

  it('returns undefined for a non-existent permit', async () => {
    const db = freshDb();
    expect(await getExecutionPermit(db, 'no-such-permit')).toBeUndefined();
  });

  it('lists execution permits ordered by createdAt descending', async () => {
    const db = freshDb();
    const older = buildExecutionPermit({ createdAt: NOW });
    const newer = buildExecutionPermit({ createdAt: LATER });

    await saveExecutionPermit(db, older);
    await saveExecutionPermit(db, newer);

    const list = await listExecutionPermits(db);
    expect(list).toHaveLength(2);
    expect(list[0].id).toBe(newer.id);
  });

  it('filters execution permits by coopId', async () => {
    const db = freshDb();
    const coopA = buildExecutionPermit({ coopId: 'coop-a', createdAt: NOW });
    const coopB = buildExecutionPermit({ coopId: 'coop-b', createdAt: LATER });
    const coopA2 = buildExecutionPermit({ coopId: 'coop-a', createdAt: LATER });

    await saveExecutionPermit(db, coopA);
    await saveExecutionPermit(db, coopB);
    await saveExecutionPermit(db, coopA2);

    const filtered = await listExecutionPermitsByCoopId(db, 'coop-a');
    expect(filtered).toHaveLength(2);
    expect(filtered.every((g) => g.coopId === 'coop-a')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Permit log entries
// ---------------------------------------------------------------------------

describe('permit log entry persistence', () => {
  it('saves and lists permit log entries', async () => {
    const db = freshDb();
    const entry = buildPermitLogEntry();

    await savePermitLogEntry(db, entry);
    const list = await listPermitLogEntries(db);

    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(entry.id);
  });

  it('respects the limit parameter', async () => {
    const db = freshDb();
    const entries = Array.from({ length: 5 }, (_, i) =>
      buildPermitLogEntry({ createdAt: `2026-03-13T1${i}:00:00.000Z` }),
    );

    for (const entry of entries) {
      await savePermitLogEntry(db, entry);
    }

    const limited = await listPermitLogEntries(db, 2);
    expect(limited).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Session capabilities
// ---------------------------------------------------------------------------

describe('session capability persistence', () => {
  it('saves and retrieves a session capability by id', async () => {
    const db = freshDb();
    const cap = buildSessionCapability();

    await saveSessionCapability(db, cap);
    const loaded = await getSessionCapability(db, cap.id);

    expect(loaded).toBeDefined();
    expect(loaded?.id).toBe(cap.id);
    expect(loaded?.status).toBe('active');
  });

  it('returns undefined for a non-existent capability', async () => {
    const db = freshDb();
    expect(await getSessionCapability(db, 'no-such-cap')).toBeUndefined();
  });

  it('lists session capabilities ordered by createdAt descending', async () => {
    const db = freshDb();
    const older = buildSessionCapability({ createdAt: NOW });
    const newer = buildSessionCapability({ createdAt: LATER });

    await saveSessionCapability(db, older);
    await saveSessionCapability(db, newer);

    const list = await listSessionCapabilities(db);
    expect(list).toHaveLength(2);
    expect(list[0].id).toBe(newer.id);
  });

  it('filters session capabilities by coopId', async () => {
    const db = freshDb();
    const capA = buildSessionCapability({ coopId: 'coop-a', createdAt: NOW });
    const capB = buildSessionCapability({ coopId: 'coop-b', createdAt: LATER });

    await saveSessionCapability(db, capA);
    await saveSessionCapability(db, capB);

    const filtered = await listSessionCapabilitiesByCoopId(db, 'coop-a');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].coopId).toBe('coop-a');
  });
});

// ---------------------------------------------------------------------------
// Session capability log entries
// ---------------------------------------------------------------------------

describe('session capability log entry persistence', () => {
  it('saves and lists session capability log entries', async () => {
    const db = freshDb();
    const entry = buildSessionCapabilityLogEntry();

    await saveSessionCapabilityLogEntry(db, entry);
    const list = await listSessionCapabilityLogEntries(db);

    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(entry.id);
  });

  it('respects the limit parameter', async () => {
    const db = freshDb();
    const entries = Array.from({ length: 5 }, (_, i) =>
      buildSessionCapabilityLogEntry({ createdAt: `2026-03-13T1${i}:00:00.000Z` }),
    );

    for (const entry of entries) {
      await saveSessionCapabilityLogEntry(db, entry);
    }

    const limited = await listSessionCapabilityLogEntries(db, 3);
    expect(limited).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// Encrypted session materials
// ---------------------------------------------------------------------------

describe('encrypted session material persistence', () => {
  it('saves and retrieves encrypted session material', async () => {
    const db = freshDb();
    const material = buildEncryptedSessionMaterial();

    await saveEncryptedSessionMaterial(db, material);
    const loaded = await getEncryptedSessionMaterial(db, material.capabilityId);

    expect(loaded).toBeDefined();
    expect(loaded?.ciphertext).toBe('encrypted-data-here');
    expect(loaded?.algorithm).toBe('aes-gcm');
    expect(loaded?.version).toBe(1);
  });

  it('returns undefined for a non-existent material', async () => {
    const db = freshDb();
    expect(await getEncryptedSessionMaterial(db, 'no-such-cap')).toBeUndefined();
  });

  it('deletes encrypted session material', async () => {
    const db = freshDb();
    const material = buildEncryptedSessionMaterial();

    await saveEncryptedSessionMaterial(db, material);
    expect(await getEncryptedSessionMaterial(db, material.capabilityId)).toBeDefined();

    await deleteEncryptedSessionMaterial(db, material.capabilityId);
    expect(await getEncryptedSessionMaterial(db, material.capabilityId)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Agent observations
// ---------------------------------------------------------------------------

describe('agent observation persistence', () => {
  it('saves and retrieves an agent observation by id', async () => {
    const db = freshDb();
    const obs = buildAgentObservation();

    await saveAgentObservation(db, obs);
    const loaded = await getAgentObservation(db, obs.id);

    expect(loaded).toBeDefined();
    expect(loaded?.id).toBe(obs.id);
    expect(loaded?.trigger).toBe('high-confidence-draft');
  });

  it('returns undefined for a non-existent observation', async () => {
    const db = freshDb();
    expect(await getAgentObservation(db, 'no-such-obs')).toBeUndefined();
  });

  it('lists agent observations ordered by createdAt descending', async () => {
    const db = freshDb();
    const older = buildAgentObservation({ createdAt: NOW, updatedAt: NOW });
    const newer = buildAgentObservation({ createdAt: LATER, updatedAt: LATER });

    await saveAgentObservation(db, older);
    await saveAgentObservation(db, newer);

    const list = await listAgentObservations(db);
    expect(list).toHaveLength(2);
    expect(list[0].id).toBe(newer.id);
  });

  it('finds an agent observation by fingerprint', async () => {
    const db = freshDb();
    const obs = buildAgentObservation({ fingerprint: 'unique-fp-123' });

    await saveAgentObservation(db, obs);
    const found = await findAgentObservationByFingerprint(db, 'unique-fp-123');

    expect(found).toBeDefined();
    expect(found?.id).toBe(obs.id);
  });

  it('returns undefined when fingerprint is not found', async () => {
    const db = freshDb();
    expect(await findAgentObservationByFingerprint(db, 'nonexistent-fp')).toBeUndefined();
  });

  it('filters agent observations by status', async () => {
    const db = freshDb();
    const pending = buildAgentObservation({ status: 'pending', createdAt: NOW, updatedAt: NOW });
    const processing = buildAgentObservation({
      status: 'processing',
      createdAt: LATER,
      updatedAt: LATER,
    });
    const completed = buildAgentObservation({
      status: 'completed',
      createdAt: MUCH_LATER,
      updatedAt: MUCH_LATER,
    });

    await saveAgentObservation(db, pending);
    await saveAgentObservation(db, processing);
    await saveAgentObservation(db, completed);

    const result = await listAgentObservationsByStatus(db, ['pending', 'processing']);
    expect(result).toHaveLength(2);
    expect(result.map((o) => o.status).sort()).toEqual(['pending', 'processing']);
  });

  it('respects the limit parameter on listAgentObservations', async () => {
    const db = freshDb();
    const observations = Array.from({ length: 5 }, (_, i) =>
      buildAgentObservation({
        createdAt: `2026-03-13T1${i}:00:00.000Z`,
        updatedAt: `2026-03-13T1${i}:00:00.000Z`,
      }),
    );

    for (const obs of observations) {
      await saveAgentObservation(db, obs);
    }

    const limited = await listAgentObservations(db, 3);
    expect(limited).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// Agent plans
// ---------------------------------------------------------------------------

describe('agent plan persistence', () => {
  it('saves and retrieves an agent plan by id', async () => {
    const db = freshDb();
    const plan = buildAgentPlan();

    await saveAgentPlan(db, plan);
    const loaded = await getAgentPlan(db, plan.id);

    expect(loaded).toBeDefined();
    expect(loaded?.id).toBe(plan.id);
    expect(loaded?.goal).toBe('Process draft');
  });

  it('returns undefined for a non-existent plan', async () => {
    const db = freshDb();
    expect(await getAgentPlan(db, 'no-such-plan')).toBeUndefined();
  });

  it('lists agent plans ordered by createdAt descending', async () => {
    const db = freshDb();
    const older = buildAgentPlan({ createdAt: NOW, updatedAt: NOW });
    const newer = buildAgentPlan({ createdAt: LATER, updatedAt: LATER });

    await saveAgentPlan(db, older);
    await saveAgentPlan(db, newer);

    const list = await listAgentPlans(db);
    expect(list).toHaveLength(2);
    expect(list[0].id).toBe(newer.id);
  });

  it('filters agent plans by observationId', async () => {
    const db = freshDb();
    const planA = buildAgentPlan({
      observationId: 'obs-a',
      createdAt: NOW,
      updatedAt: NOW,
    });
    const planB = buildAgentPlan({
      observationId: 'obs-b',
      createdAt: LATER,
      updatedAt: LATER,
    });
    const planA2 = buildAgentPlan({
      observationId: 'obs-a',
      createdAt: LATER,
      updatedAt: LATER,
    });

    await saveAgentPlan(db, planA);
    await saveAgentPlan(db, planB);
    await saveAgentPlan(db, planA2);

    const filtered = await listAgentPlansByObservationId(db, 'obs-a');
    expect(filtered).toHaveLength(2);
    expect(filtered.every((p) => p.observationId === 'obs-a')).toBe(true);
  });

  it('respects the limit parameter on listAgentPlans', async () => {
    const db = freshDb();
    const plans = Array.from({ length: 5 }, (_, i) =>
      buildAgentPlan({
        createdAt: `2026-03-13T1${i}:00:00.000Z`,
        updatedAt: `2026-03-13T1${i}:00:00.000Z`,
      }),
    );

    for (const plan of plans) {
      await saveAgentPlan(db, plan);
    }

    const limited = await listAgentPlans(db, 2);
    expect(limited).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Skill runs
// ---------------------------------------------------------------------------

describe('skill run persistence', () => {
  it('saves and retrieves a skill run by id', async () => {
    const db = freshDb();
    const run = buildSkillRun();

    await saveSkillRun(db, run);
    const loaded = await getSkillRun(db, run.id);

    expect(loaded).toBeDefined();
    expect(loaded?.id).toBe(run.id);
    expect(loaded?.skillId).toBe('opportunity-extractor');
  });

  it('returns undefined for a non-existent skill run', async () => {
    const db = freshDb();
    expect(await getSkillRun(db, 'no-such-run')).toBeUndefined();
  });

  it('lists skill runs ordered by startedAt descending', async () => {
    const db = freshDb();
    const older = buildSkillRun({ startedAt: NOW });
    const newer = buildSkillRun({ startedAt: LATER });

    await saveSkillRun(db, older);
    await saveSkillRun(db, newer);

    const list = await listSkillRuns(db);
    expect(list).toHaveLength(2);
    expect(list[0].id).toBe(newer.id);
  });

  it('filters skill runs by planId', async () => {
    const db = freshDb();
    const runA = buildSkillRun({ planId: 'plan-a', startedAt: NOW });
    const runB = buildSkillRun({ planId: 'plan-b', startedAt: LATER });
    const runA2 = buildSkillRun({ planId: 'plan-a', startedAt: LATER });

    await saveSkillRun(db, runA);
    await saveSkillRun(db, runB);
    await saveSkillRun(db, runA2);

    const filtered = await listSkillRunsByPlanId(db, 'plan-a');
    expect(filtered).toHaveLength(2);
    expect(filtered.every((r) => r.planId === 'plan-a')).toBe(true);
  });

  it('respects the limit parameter on listSkillRuns', async () => {
    const db = freshDb();
    const runs = Array.from({ length: 5 }, (_, i) =>
      buildSkillRun({ startedAt: `2026-03-13T1${i}:00:00.000Z` }),
    );

    for (const run of runs) {
      await saveSkillRun(db, run);
    }

    const limited = await listSkillRuns(db, 2);
    expect(limited).toHaveLength(2);
  });
});

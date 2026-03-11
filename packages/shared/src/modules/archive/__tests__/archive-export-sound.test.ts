import { describe, expect, it } from 'vitest';
import {
  deriveExtensionIconState,
  extensionIconBadge,
  extensionIconStateLabel,
} from '../../app/icon-state';
import { defaultSoundPreferences, shouldPlaySound, soundPattern } from '../../app/sound';
import { createCoop } from '../../coop/flows';
import { createArchiveBundle, createMockArchiveReceipt, recordArchiveReceipt } from '../archive';
import {
  exportArchiveReceiptJson,
  exportArchiveReceiptTextBundle,
  exportArtifactJson,
  exportArtifactTextBundle,
  exportCoopSnapshotJson,
  exportReviewDraftJson,
  exportSnapshotTextBundle,
} from '../export';

function buildSetupInsights() {
  return {
    summary: 'A compact setup payload for testing export and archive behavior.',
    crossCuttingPainPoints: ['Context leaks across too many tools'],
    crossCuttingOpportunities: ['Keep archives explicit and portable'],
    lenses: [
      {
        lens: 'capital-formation',
        currentState: 'Grant tracking is ad hoc.',
        painPoints: 'No durable record.',
        improvements: 'Store approved leads clearly.',
      },
      {
        lens: 'impact-reporting',
        currentState: 'Reports are rushed.',
        painPoints: 'Evidence is fragmented.',
        improvements: 'Make evidence legible sooner.',
      },
      {
        lens: 'governance-coordination',
        currentState: 'Calls generate action items.',
        painPoints: 'Actions disappear.',
        improvements: 'Track action-worthy artifacts.',
      },
      {
        lens: 'knowledge-garden-resources',
        currentState: 'Guides live in private tabs.',
        painPoints: 'People duplicate work.',
        improvements: 'Turn resources into shared memory.',
      },
    ],
  } as const;
}

describe('archive, export, and sound behavior', () => {
  it('creates and stores archive receipts for approved artifacts', () => {
    const created = createCoop({
      coopName: 'Archive Coop',
      purpose: 'Keep approved artifacts portable and durable.',
      creatorDisplayName: 'Kai',
      captureMode: 'manual',
      seedContribution: 'I care about durable long-memory bundles.',
      setupInsights: buildSetupInsights(),
    });
    const artifact = created.state.artifacts[0];
    if (!artifact) {
      throw new Error('Expected an initial artifact.');
    }
    const bundle = createArchiveBundle({
      scope: 'artifact',
      state: created.state,
      artifactIds: [artifact.id],
    });
    const receipt = createMockArchiveReceipt({
      bundle,
      delegationIssuer: 'trusted-node-demo',
      artifactIds: [artifact.id],
    });
    const updated = recordArchiveReceipt(created.state, receipt, [artifact.id]);

    expect(receipt.rootCid.startsWith('bafy')).toBe(true);
    expect(updated.archiveReceipts).toHaveLength(1);
    expect(updated.artifacts[0]?.archiveReceiptIds).toContain(receipt.id);
    expect(updated.artifacts[0]?.archiveStatus).toBe('archived');
    expect(updated.memoryProfile.archiveSignals.archivedTagCounts[artifact.tags[0] ?? '']).toBe(1);
    expect(exportArchiveReceiptTextBundle(receipt)).toContain(receipt.rootCid);
  });

  it('exports structured snapshots without raw passive browsing exhaust', () => {
    const created = createCoop({
      coopName: 'Archive Coop',
      purpose: 'Keep approved artifacts portable and durable.',
      creatorDisplayName: 'Kai',
      captureMode: 'manual',
      seedContribution: 'I care about durable long-memory bundles.',
      setupInsights: buildSetupInsights(),
    });

    const json = exportCoopSnapshotJson(created.state);
    const text = exportSnapshotTextBundle(created.state);

    expect(json).toContain('"type": "coop-snapshot"');
    expect(json).not.toContain('tabCandidates');
    expect(text).toContain('Archive Coop');
    expect(text).toContain('Safe:');
  });

  it('exports draft, artifact, and receipt payloads as structured json', () => {
    const created = createCoop({
      coopName: 'Archive Coop',
      purpose: 'Keep approved artifacts portable and durable.',
      creatorDisplayName: 'Kai',
      captureMode: 'manual',
      seedContribution: 'I care about durable long-memory bundles.',
      setupInsights: buildSetupInsights(),
    });
    const artifact = created.state.artifacts[0];
    if (!artifact) {
      throw new Error('Expected an initial artifact.');
    }
    const bundle = createArchiveBundle({
      scope: 'artifact',
      state: created.state,
      artifactIds: [artifact.id],
    });
    const receipt = createMockArchiveReceipt({
      bundle,
      delegationIssuer: 'trusted-node-demo',
      artifactIds: [artifact.id],
    });

    expect(exportArtifactJson(artifact)).toContain('"type": "artifact"');
    expect(exportArtifactTextBundle(artifact)).toContain(artifact.title);
    expect(exportArchiveReceiptJson(receipt)).toContain('"type": "archive-receipt"');
    expect(
      exportReviewDraftJson({
        id: 'draft-1',
        interpretationId: 'interpretation-1',
        extractId: 'extract-1',
        sourceCandidateId: 'candidate-1',
        title: 'Weekly roundup',
        summary: 'A manual roundup for review.',
        sources: artifact.sources,
        tags: ['roundup'],
        category: 'insight',
        whyItMatters: 'It helps the coop review signal.',
        suggestedNextStep: 'Publish the draft.',
        suggestedTargetCoopIds: [created.state.profile.id],
        confidence: 0.77,
        rationale: 'Manual review keeps the signal legible.',
        status: 'draft',
        createdAt: new Date().toISOString(),
      }),
    ).toContain('"type": "review-draft"');
  });

  it('keeps sounds muted by default and only allows explicit success moments', () => {
    expect(defaultSoundPreferences.enabled).toBe(false);
    expect(
      shouldPlaySound('coop-created', {
        enabled: false,
        reducedMotion: false,
        reducedSound: false,
      }),
    ).toBe(false);

    expect(
      shouldPlaySound(
        'artifact-published',
        {
          enabled: true,
          reducedMotion: false,
          reducedSound: false,
        },
        true,
      ),
    ).toBe(true);
    expect(soundPattern('coop-created')).toHaveLength(3);
    expect(soundPattern('artifact-published')).toHaveLength(2);
    expect(soundPattern('sound-test')).toHaveLength(3);
  });

  it('derives icon state text for review-needed and error cases', () => {
    expect(
      deriveExtensionIconState({
        pendingDrafts: 2,
        watching: false,
        offline: false,
        missingPermission: false,
        syncError: false,
      }),
    ).toBe('review-needed');
    expect(extensionIconStateLabel('idle')).toBe('Idle');
    expect(extensionIconStateLabel('review-needed')).toBe('Review Needed');
    expect(extensionIconBadge('review-needed')).toEqual({
      text: 'ROST',
      color: '#fd8a01',
    });
    expect(
      deriveExtensionIconState({
        pendingDrafts: 0,
        watching: true,
        offline: false,
        missingPermission: false,
        syncError: false,
      }),
    ).toBe('watching');
    expect(extensionIconBadge('watching')).toEqual({
      text: 'SCAN',
      color: '#5a7d10',
    });
    expect(
      deriveExtensionIconState({
        pendingDrafts: 0,
        watching: false,
        offline: false,
        missingPermission: false,
        syncError: false,
      }),
    ).toBe('idle');
    expect(extensionIconBadge('idle')).toEqual({
      text: 'IDLE',
      color: '#4f2e1f',
    });

    expect(
      deriveExtensionIconState({
        pendingDrafts: 0,
        watching: false,
        offline: true,
        missingPermission: false,
        syncError: false,
      }),
    ).toBe('error-offline');
    expect(extensionIconStateLabel('error-offline')).toBe('Error / Offline');
    expect(extensionIconBadge('error-offline')).toEqual({
      text: 'ERR',
      color: '#a63b20',
    });
  });
});

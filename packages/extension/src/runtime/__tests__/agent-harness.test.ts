import {
  type AgentObservation,
  type AgentPlan,
  type ReceiverCapture,
  type ReviewDraft,
  type SkillRun,
  createAgentObservation,
  createAgentPlan,
} from '@coop/shared';
import { describe, expect, it } from 'vitest';
import {
  filterAgentDashboardState,
  isTrustedNodeRole,
  selectSkillIdsForObservation,
} from '../agent-harness';
import { listRegisteredSkills } from '../agent-registry';

function makeReceiverCapture(overrides: Partial<ReceiverCapture> = {}): ReceiverCapture {
  return {
    id: overrides.id ?? 'capture-1',
    deviceId: overrides.deviceId ?? 'device-1',
    pairingId: overrides.pairingId,
    coopId: overrides.coopId ?? 'coop-1',
    coopDisplayName: overrides.coopDisplayName ?? 'River Coop',
    memberId: overrides.memberId ?? 'member-1',
    memberDisplayName: overrides.memberDisplayName ?? 'Ari',
    kind: overrides.kind ?? 'file',
    title: overrides.title ?? 'Receiver capture',
    note: overrides.note ?? 'Private note',
    fileName: overrides.fileName,
    mimeType: overrides.mimeType ?? 'text/plain',
    byteSize: overrides.byteSize ?? 64,
    createdAt: overrides.createdAt ?? '2026-03-13T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-03-13T00:00:00.000Z',
    syncState: overrides.syncState ?? 'queued',
    syncError: overrides.syncError,
    syncedAt: overrides.syncedAt,
    lastSyncAttemptAt: overrides.lastSyncAttemptAt,
    nextRetryAt: overrides.nextRetryAt,
    retryCount: overrides.retryCount ?? 0,
    intakeStatus: overrides.intakeStatus ?? 'private-intake',
    linkedDraftId: overrides.linkedDraftId,
    archivedAt: overrides.archivedAt,
    publishedAt: overrides.publishedAt,
    archiveWorthiness: overrides.archiveWorthiness,
  };
}

function makeDraft(overrides: Partial<ReviewDraft> = {}): ReviewDraft {
  return {
    id: overrides.id ?? 'draft-1',
    interpretationId: overrides.interpretationId ?? 'interp-1',
    extractId: overrides.extractId ?? 'extract-1',
    sourceCandidateId: overrides.sourceCandidateId ?? 'candidate-1',
    title: overrides.title ?? 'Visible draft',
    summary: overrides.summary ?? 'Draft summary',
    sources: overrides.sources ?? [
      {
        label: 'Source',
        url: 'https://example.com',
        domain: 'example.com',
      },
    ],
    tags: overrides.tags ?? [],
    category: overrides.category ?? 'insight',
    whyItMatters: overrides.whyItMatters ?? 'It matters.',
    suggestedNextStep: overrides.suggestedNextStep ?? 'Review it.',
    suggestedTargetCoopIds: overrides.suggestedTargetCoopIds ?? ['coop-1'],
    confidence: overrides.confidence ?? 0.8,
    rationale: overrides.rationale ?? 'Reasonable.',
    previewImageUrl: overrides.previewImageUrl,
    status: overrides.status ?? 'draft',
    workflowStage: overrides.workflowStage ?? 'ready',
    archiveWorthiness: overrides.archiveWorthiness,
    provenance:
      overrides.provenance ??
      ({
        type: 'receiver',
        captureId: 'capture-1',
        coopId: 'coop-1',
        memberId: 'member-1',
        receiverKind: 'file',
        seedMethod: 'metadata-only',
      } as const),
    createdAt: overrides.createdAt ?? '2026-03-13T00:00:00.000Z',
  };
}

function makePlan(observationId: string): AgentPlan {
  return createAgentPlan({
    observationId,
    provider: 'transformers',
    confidence: 0.8,
    goal: 'Run skill',
    rationale: 'Testing visibility',
  });
}

function makeSkillRun(observationId: string, planId: string): SkillRun {
  return {
    id: 'skill-run-1',
    observationId,
    planId,
    skillId: 'review-digest',
    skillVersion: '0.1.0',
    provider: 'transformers',
    status: 'completed',
    startedAt: '2026-03-13T00:00:00.000Z',
    finishedAt: '2026-03-13T00:00:02.000Z',
    outputSchemaRef: 'review-digest-output',
    output: {
      title: 'Digest',
      summary: 'Summary',
      whyItMatters: 'Why',
      suggestedNextStep: 'Next',
      highlights: [],
      tags: [],
    },
  };
}

describe('agent harness helpers', () => {
  it('treats creator and trusted roles as trusted-node operators', () => {
    expect(isTrustedNodeRole('creator')).toBe(true);
    expect(isTrustedNodeRole('trusted')).toBe(true);
    expect(isTrustedNodeRole('member')).toBe(false);
  });

  it('selects skills from manifest triggers in execution order', () => {
    const manifests = listRegisteredSkills().map((entry) => entry.manifest);

    const receiverBacklog = createAgentObservation({
      trigger: 'receiver-backlog',
      title: 'Receiver backlog',
      summary: 'Pending intake',
      coopId: 'coop-1',
      captureId: 'capture-1',
    });
    expect(selectSkillIdsForObservation(receiverBacklog, manifests)).toEqual([
      'opportunity-extractor',
      'grant-fit-scorer',
      'capital-formation-brief',
      'ecosystem-entity-extractor',
    ]);

    const ritualReview = createAgentObservation({
      trigger: 'ritual-review-due',
      title: 'Digest due',
      summary: 'Weekly review',
      coopId: 'coop-1',
    });
    expect(selectSkillIdsForObservation(ritualReview, manifests)).toEqual([
      'review-digest',
      'ecosystem-entity-extractor',
      'theme-clusterer',
    ]);

    const gapAdminSync = createAgentObservation({
      trigger: 'green-goods-gap-admin-sync-needed',
      title: 'Gap admin sync',
      summary: 'Sync trusted operators to GAP.',
      coopId: 'coop-1',
    });
    expect(selectSkillIdsForObservation(gapAdminSync, manifests)).toEqual([
      'green-goods-gap-admin-sync',
    ]);
  });

  it('filters private receiver observations and related plans/runs from the dashboard', () => {
    const privateObservation: AgentObservation = createAgentObservation({
      trigger: 'receiver-backlog',
      title: 'Receiver backlog: private',
      summary: 'Private note',
      coopId: 'coop-1',
      captureId: 'capture-2',
    });
    const visibleObservation: AgentObservation = createAgentObservation({
      trigger: 'ritual-review-due',
      title: 'Digest due',
      summary: 'Weekly review',
      coopId: 'coop-1',
    });
    const hiddenPlan = makePlan(privateObservation.id);
    const visiblePlan = makePlan(visibleObservation.id);
    const hiddenRun = makeSkillRun(privateObservation.id, hiddenPlan.id);
    const visibleRun = {
      ...makeSkillRun(visibleObservation.id, visiblePlan.id),
      id: 'skill-run-2',
    };

    const filtered = filterAgentDashboardState({
      observations: [privateObservation, visibleObservation],
      plans: [hiddenPlan, visiblePlan],
      skillRuns: [hiddenRun, visibleRun],
      drafts: [makeDraft()],
      captures: [
        makeReceiverCapture({
          id: 'capture-2',
          memberId: 'member-2',
          memberDisplayName: 'Robin',
          title: 'Private capture',
          note: 'Should stay private',
        }),
      ],
      activeCoopId: 'coop-1',
      activeMemberId: 'member-1',
      operatorAccess: true,
    });

    expect(filtered.observations.map((observation) => observation.id)).toEqual([
      visibleObservation.id,
    ]);
    expect(filtered.plans.map((plan) => plan.id)).toEqual([visiblePlan.id]);
    expect(filtered.skillRuns.map((run) => run.id)).toEqual([visibleRun.id]);
  });

  it('returns an empty dashboard when trusted-node access is unavailable', () => {
    const observation = createAgentObservation({
      trigger: 'ritual-review-due',
      title: 'Digest due',
      summary: 'Weekly review',
      coopId: 'coop-1',
    });

    const filtered = filterAgentDashboardState({
      observations: [observation],
      plans: [makePlan(observation.id)],
      skillRuns: [],
      drafts: [],
      captures: [],
      activeCoopId: 'coop-1',
      activeMemberId: 'member-1',
      operatorAccess: false,
    });

    expect(filtered.observations).toEqual([]);
    expect(filtered.plans).toEqual([]);
    expect(filtered.skillRuns).toEqual([]);
  });
});

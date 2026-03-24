/**
 * Reusable test fixture factories for the coop project.
 *
 * Each factory returns a schema-valid object with deterministic defaults.
 * All fields can be overridden via partial parameter.
 *
 * Usage:
 *   import { makeReviewDraft, makeArtifact } from '../../__tests__/fixtures';
 */

import type {
  ActionBundle,
  AgentObservation,
  AgentPlan,
  Artifact,
  ReviewDraft,
  SetupInsights,
  SkillRun,
  TabCandidate,
} from '../../contracts/schema';
import { type CoopDexie, createCoopDb } from '../../modules/storage/db';

// ---------------------------------------------------------------------------
// Deterministic constants
// ---------------------------------------------------------------------------

const FIXED_TIMESTAMP = '2026-03-22T00:00:00.000Z';
const FIXED_MUCH_LATER = '2026-03-29T00:00:00.000Z';

// ---------------------------------------------------------------------------
// makeSetupInsights — used by every createCoop call
// ---------------------------------------------------------------------------

export function makeSetupInsights(overrides?: Partial<SetupInsights>): SetupInsights {
  return {
    summary: 'A concise but valid setup payload for testing purposes.',
    crossCuttingPainPoints: ['Context is fragmented across tools'],
    crossCuttingOpportunities: ['Shared state can persist cleanly'],
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
        painPoints: 'Actions slip after calls.',
        improvements: 'Review actions through the board.',
      },
      {
        lens: 'knowledge-garden-resources',
        currentState: 'Resources live in browser tabs.',
        painPoints: 'People repeat research.',
        improvements: 'Persist high-signal references.',
      },
    ],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// makeReviewDraft — the most duplicated factory across test files
// ---------------------------------------------------------------------------

export function makeReviewDraft(overrides?: Partial<ReviewDraft>): ReviewDraft {
  return {
    id: 'draft-1',
    interpretationId: 'interp-1',
    extractId: 'extract-1',
    sourceCandidateId: 'candidate-1',
    title: 'River restoration lead',
    summary: 'A rounded-up draft that still needs quick review.',
    sources: [
      {
        label: 'Example',
        url: 'https://example.com/article',
        domain: 'example.com',
      },
    ],
    tags: ['test'],
    category: 'resource',
    whyItMatters: 'Important context for the coop.',
    suggestedNextStep: 'Review and share.',
    suggestedTargetCoopIds: ['coop-1'],
    confidence: 0.8,
    rationale: 'Captured from a relevant tab.',
    previewImageUrl: 'https://example.com/preview.png',
    status: 'draft',
    workflowStage: 'ready',
    attachments: [],
    provenance: {
      type: 'tab',
      interpretationId: 'interp-1',
      extractId: 'extract-1',
      sourceCandidateId: 'candidate-1',
    },
    createdAt: FIXED_TIMESTAMP,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// makeArtifact — published feed item
// ---------------------------------------------------------------------------

export function makeArtifact(overrides?: Partial<Artifact>): Artifact {
  return {
    id: 'artifact-1',
    originId: 'origin-1',
    targetCoopId: 'coop-1',
    title: 'Shared watershed note',
    summary: 'A published artifact in the feed.',
    sources: [
      {
        label: 'Example',
        url: 'https://example.com/article',
        domain: 'example.com',
      },
    ],
    tags: ['shared'],
    category: 'resource',
    whyItMatters: 'Helps the coop stay aligned on the latest research.',
    suggestedNextStep: 'Open the note and decide what to share next.',
    previewImageUrl: 'https://example.com/artifact.png',
    createdBy: 'member-1',
    createdAt: FIXED_TIMESTAMP,
    reviewStatus: 'published',
    archiveStatus: 'not-archived',
    archiveReceiptIds: [],
    attachments: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// makeTabCandidate — captured browser tab
// ---------------------------------------------------------------------------

export function makeTabCandidate(overrides?: Partial<TabCandidate>): TabCandidate {
  return {
    id: 'tab-candidate-1',
    tabId: 1,
    windowId: 1,
    url: 'https://example.com/article',
    canonicalUrl: 'https://example.com/article',
    title: 'Example Article',
    domain: 'example.com',
    capturedAt: FIXED_TIMESTAMP,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// makeAgentObservation
// ---------------------------------------------------------------------------

export function makeAgentObservation(overrides?: Partial<AgentObservation>): AgentObservation {
  return {
    id: 'observation-1',
    trigger: 'roundup-batch-ready',
    status: 'pending',
    title: 'Batch of tabs ready for routing',
    summary: 'Three new tabs were captured and are ready for the agent pipeline.',
    coopId: 'coop-1',
    fingerprint: 'fp-roundup-batch-1',
    payload: { candidateIds: ['tab-candidate-1'] },
    createdAt: FIXED_TIMESTAMP,
    updatedAt: FIXED_TIMESTAMP,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// makeAgentPlan
// ---------------------------------------------------------------------------

export function makeAgentPlan(overrides?: Partial<AgentPlan>): AgentPlan {
  return {
    id: 'plan-1',
    observationId: 'observation-1',
    status: 'pending',
    provider: 'heuristic',
    confidence: 0.85,
    goal: 'Route captured tabs to relevant coops.',
    rationale: 'Tabs match the coop purpose and ritual lenses.',
    steps: [],
    actionProposals: [],
    requiresApproval: false,
    createdAt: FIXED_TIMESTAMP,
    updatedAt: FIXED_TIMESTAMP,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// makeSkillRun
// ---------------------------------------------------------------------------

export function makeSkillRun(overrides?: Partial<SkillRun>): SkillRun {
  return {
    id: 'skill-run-1',
    observationId: 'observation-1',
    planId: 'plan-1',
    skillId: 'tab-router',
    skillVersion: '1.0.0',
    provider: 'heuristic',
    status: 'pending',
    startedAt: FIXED_TIMESTAMP,
    outputSchemaRef: 'tab-router-output',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// makeActionBundle — policy approval workflow
// ---------------------------------------------------------------------------

export function makeActionBundle(overrides?: Partial<ActionBundle>): ActionBundle {
  return {
    id: 'bundle-1',
    replayId: 'replay-1',
    actionClass: 'archive-artifact',
    coopId: 'coop-1',
    memberId: 'member-1',
    payload: { artifactId: 'artifact-1' },
    createdAt: FIXED_TIMESTAMP,
    expiresAt: FIXED_MUCH_LATER,
    policyId: 'policy-1',
    status: 'proposed',
    digest: '0x' + 'ab'.repeat(32),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// freshDb — uniquely-named Dexie instance for isolation
// ---------------------------------------------------------------------------

let dbCounter = 0;

export function freshDb(): CoopDexie {
  dbCounter += 1;
  return createCoopDb(`coop-test-db-${dbCounter}-${Date.now()}`);
}

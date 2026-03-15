import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AgentObservation,
  AgentPlan,
  AgentPlanStep,
  CapitalFormationBriefOutput,
  ReviewDigestOutput,
  SkillRun,
} from '../../../contracts/schema';
import {
  approveAgentPlan,
  buildAgentObservationFingerprint,
  completeAgentPlan,
  completeSkillRun,
  createActionProposal,
  createAgentGeneratedDraft,
  createAgentObservation,
  createAgentPlan,
  createAgentPlanStep,
  createCapitalFormationDraft,
  createReviewDigestDraft,
  createSkillRun,
  failAgentPlan,
  failSkillRun,
  rejectAgentPlan,
  skillOutputSchemas,
  summarizeOpportunityCandidates,
  summarizePublishReadiness,
  updateAgentObservation,
  updateAgentPlan,
  updateAgentPlanStep,
  validateSkillManifest,
  validateSkillOutput,
} from '../agent';

/* ---------------------------------------------------------------------------
 * Helpers
 * --------------------------------------------------------------------------- */

function makeObservation(overrides?: Partial<Parameters<typeof createAgentObservation>[0]>) {
  return createAgentObservation({
    trigger: 'high-confidence-draft',
    title: 'Test observation',
    summary: 'A test observation.',
    coopId: 'coop-1',
    ...overrides,
  });
}

function makePlan(overrides?: Partial<Parameters<typeof createAgentPlan>[0]>) {
  return createAgentPlan({
    observationId: 'agent-observation-1',
    provider: 'heuristic',
    confidence: 0.8,
    goal: 'Test goal',
    rationale: 'Test rationale.',
    ...overrides,
  });
}

function makeSkillRun(overrides?: Partial<Parameters<typeof createSkillRun>[0]>) {
  return createSkillRun({
    observationId: 'agent-observation-1',
    planId: 'agent-plan-1',
    skill: {
      id: 'opportunity-extractor',
      version: '1.0.0',
      outputSchemaRef: 'opportunity-extractor-output',
    },
    provider: 'heuristic',
    ...overrides,
  });
}

/* ---------------------------------------------------------------------------
 * Existing tests (preserved)
 * --------------------------------------------------------------------------- */

describe('agent helpers', () => {
  it('builds a stable observation fingerprint', () => {
    const first = buildAgentObservationFingerprint({
      trigger: 'high-confidence-draft',
      coopId: 'coop-1',
      draftId: 'draft-1',
      payload: { confidence: 0.8 },
    });
    const second = buildAgentObservationFingerprint({
      trigger: 'high-confidence-draft',
      coopId: 'coop-1',
      draftId: 'draft-1',
      payload: { confidence: 0.8 },
    });

    expect(first).toBe(second);
  });

  it('creates and approves an agent plan', () => {
    const observation = createAgentObservation({
      trigger: 'high-confidence-draft',
      title: 'High confidence draft',
      summary: 'Potential funding signal.',
      coopId: 'coop-1',
      draftId: 'draft-1',
    });
    const plan = createAgentPlan({
      observationId: observation.id,
      provider: 'transformers',
      confidence: 0.8,
      goal: 'Review funding signal',
      rationale: 'The draft is highly relevant.',
    });

    const approved = approveAgentPlan(plan);

    expect(approved.status).toBe('approved');
    expect(approved.approvedAt).toBeDefined();
  });

  it('rejects an agent plan with a reason', () => {
    const plan = createAgentPlan({
      observationId: 'agent-observation-1',
      provider: 'heuristic',
      confidence: 0.6,
      goal: 'Hold for later review',
      rationale: 'Needs human judgement first.',
    });

    const rejected = rejectAgentPlan(plan as AgentPlan, 'Not aligned with current ritual scope.');

    expect(rejected.status).toBe('rejected');
    expect(rejected.failureReason).toContain('ritual scope');
  });

  it('validates capital formation brief outputs', () => {
    const output = validateSkillOutput<CapitalFormationBriefOutput>(
      'capital-formation-brief-output',
      {
        title: 'Watershed capital brief',
        summary: 'A concise funding thesis.',
        whyItMatters: 'It aligns with the coop mission.',
        suggestedNextStep: 'Review with the funding circle.',
        tags: ['watershed', 'funding'],
        targetCoopIds: ['coop-1'],
        supportingCandidateIds: ['candidate-1'],
      },
    );

    expect(output.title).toContain('Watershed');
    expect(output.tags).toContain('funding');
  });

  it('creates agent-generated drafts with agent provenance', () => {
    const draft = createCapitalFormationDraft({
      observationId: 'agent-observation-1',
      planId: 'agent-plan-1',
      skillRunId: 'skill-run-1',
      skillId: 'capital-formation-brief',
      coopId: 'coop-1',
      output: {
        title: 'Capital readiness',
        summary: 'A concise funding summary.',
        whyItMatters: 'This is relevant to the coop.',
        suggestedNextStep: 'Review and route it.',
        tags: ['funding'],
        targetCoopIds: ['coop-1'],
        supportingCandidateIds: ['candidate-1'],
      },
    });

    expect(draft.provenance.type).toBe('agent');
    if (draft.provenance.type !== 'agent') {
      throw new Error('Expected agent provenance.');
    }
    expect(draft.provenance.skillId).toBe('capital-formation-brief');
    expect(draft.suggestedTargetCoopIds).toEqual(['coop-1']);
  });
});

/* ---------------------------------------------------------------------------
 * updateAgentObservation
 * --------------------------------------------------------------------------- */

describe('updateAgentObservation', () => {
  it('patches observation fields and bumps updatedAt', () => {
    const obs = makeObservation();

    const updated = updateAgentObservation(obs, {
      status: 'processing',
      summary: 'Revised summary.',
    });

    expect(updated.status).toBe('processing');
    expect(updated.summary).toBe('Revised summary.');
    expect(updated.id).toBe(obs.id);
    expect(updated.updatedAt).toBeTruthy();
  });

  it('preserves untouched fields', () => {
    const obs = makeObservation({ coopId: 'coop-42', draftId: 'draft-7' });

    const updated = updateAgentObservation(obs, { status: 'completed' });

    expect(updated.coopId).toBe('coop-42');
    expect(updated.draftId).toBe('draft-7');
    expect(updated.trigger).toBe('high-confidence-draft');
  });
});

/* ---------------------------------------------------------------------------
 * createAgentPlanStep / updateAgentPlanStep
 * --------------------------------------------------------------------------- */

describe('createAgentPlanStep', () => {
  it('creates a pending step with a generated id', () => {
    const step = createAgentPlanStep({
      skillId: 'opportunity-extractor',
      provider: 'transformers',
      summary: 'Extract opportunities from draft.',
    });

    expect(step.id).toMatch(/^agent-step-/);
    expect(step.status).toBe('pending');
    expect(step.skillId).toBe('opportunity-extractor');
    expect(step.provider).toBe('transformers');
    expect(step.summary).toBe('Extract opportunities from draft.');
  });

  it('accepts an optional startedAt', () => {
    const ts = '2026-01-01T00:00:00.000Z';
    const step = createAgentPlanStep({
      skillId: 'review-digest',
      provider: 'heuristic',
      summary: 'Digest reviews.',
      startedAt: ts,
    });

    expect(step.startedAt).toBe(ts);
  });
});

describe('updateAgentPlanStep', () => {
  it('patches step fields', () => {
    const step = createAgentPlanStep({
      skillId: 'theme-clusterer',
      provider: 'webllm',
      summary: 'Cluster themes.',
    });

    const updated = updateAgentPlanStep(step, {
      status: 'completed',
      finishedAt: '2026-01-01T01:00:00.000Z',
      outputRef: 'skill-run-abc',
    });

    expect(updated.status).toBe('completed');
    expect(updated.finishedAt).toBe('2026-01-01T01:00:00.000Z');
    expect(updated.outputRef).toBe('skill-run-abc');
    expect(updated.id).toBe(step.id);
    expect(updated.skillId).toBe('theme-clusterer');
  });

  it('can mark a step as failed with an error', () => {
    const step = createAgentPlanStep({
      skillId: 'opportunity-extractor',
      provider: 'heuristic',
      summary: 'Extract.',
    });

    const failed = updateAgentPlanStep(step, {
      status: 'failed',
      error: 'Model timed out.',
    });

    expect(failed.status).toBe('failed');
    expect(failed.error).toBe('Model timed out.');
  });
});

/* ---------------------------------------------------------------------------
 * createActionProposal
 * --------------------------------------------------------------------------- */

describe('createActionProposal', () => {
  it('creates a proposal with required fields', () => {
    const proposal = createActionProposal({
      actionClass: 'publish-ready-draft',
      coopId: 'coop-1',
      payload: { draftId: 'draft-1' },
      reason: 'Draft is ready for publishing.',
      approvalMode: 'proposal',
    });

    expect(proposal.id).toMatch(/^agent-proposal-/);
    expect(proposal.actionClass).toBe('publish-ready-draft');
    expect(proposal.coopId).toBe('coop-1');
    expect(proposal.reason).toBe('Draft is ready for publishing.');
    expect(proposal.approvalMode).toBe('proposal');
    expect(proposal.requiresPermit).toBe(false);
    expect(proposal.createdAt).toBeDefined();
  });

  it('sets optional fields when provided', () => {
    const proposal = createActionProposal({
      actionClass: 'archive-artifact',
      coopId: 'coop-2',
      memberId: 'member-1',
      payload: { artifactId: 'artifact-1' },
      reason: 'Artifact is archivable.',
      approvalMode: 'advisory',
      requiresPermit: true,
      permitId: 'permit-1',
      generatedBySkillId: 'capital-formation-brief',
    });

    expect(proposal.memberId).toBe('member-1');
    expect(proposal.requiresPermit).toBe(true);
    expect(proposal.permitId).toBe('permit-1');
    expect(proposal.generatedBySkillId).toBe('capital-formation-brief');
  });
});

/* ---------------------------------------------------------------------------
 * updateAgentPlan
 * --------------------------------------------------------------------------- */

describe('updateAgentPlan', () => {
  it('patches plan fields and bumps updatedAt', () => {
    const plan = makePlan();

    const updated = updateAgentPlan(plan, {
      confidence: 0.95,
      goal: 'Revised goal.',
    });

    expect(updated.confidence).toBe(0.95);
    expect(updated.goal).toBe('Revised goal.');
    expect(updated.id).toBe(plan.id);
    expect(updated.updatedAt).toBeTruthy();
  });
});

/* ---------------------------------------------------------------------------
 * completeAgentPlan / failAgentPlan
 * --------------------------------------------------------------------------- */

describe('completeAgentPlan', () => {
  it('sets status to completed with a completedAt timestamp', () => {
    const plan = makePlan();

    const completed = completeAgentPlan(plan);

    expect(completed.status).toBe('completed');
    expect(completed.completedAt).toBeDefined();
    expect(completed.id).toBe(plan.id);
  });
});

describe('failAgentPlan', () => {
  it('sets status to failed with a reason and completedAt', () => {
    const plan = makePlan();

    const failed = failAgentPlan(plan, 'Model inference error.');

    expect(failed.status).toBe('failed');
    expect(failed.failureReason).toBe('Model inference error.');
    expect(failed.completedAt).toBeDefined();
    expect(failed.id).toBe(plan.id);
  });
});

/* ---------------------------------------------------------------------------
 * createAgentPlan with steps and actionProposals
 * --------------------------------------------------------------------------- */

describe('createAgentPlan with steps and proposals', () => {
  it('includes steps when provided', () => {
    const step = createAgentPlanStep({
      skillId: 'opportunity-extractor',
      provider: 'heuristic',
      summary: 'Extract.',
    });

    const plan = makePlan({ steps: [step] });

    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0].skillId).toBe('opportunity-extractor');
  });

  it('sets requiresApproval true when actionProposals are provided', () => {
    const proposal = createActionProposal({
      actionClass: 'publish-ready-draft',
      coopId: 'coop-1',
      payload: {},
      reason: 'Ready.',
      approvalMode: 'proposal',
    });

    const plan = makePlan({ actionProposals: [proposal] });

    expect(plan.requiresApproval).toBe(true);
    expect(plan.actionProposals).toHaveLength(1);
  });

  it('defaults requiresApproval to false when no proposals', () => {
    const plan = makePlan({ actionProposals: [] });

    expect(plan.requiresApproval).toBe(false);
  });
});

/* ---------------------------------------------------------------------------
 * createSkillRun / completeSkillRun / failSkillRun
 * --------------------------------------------------------------------------- */

describe('createSkillRun', () => {
  it('creates a pending skill run with generated id', () => {
    const run = makeSkillRun();

    expect(run.id).toMatch(/^skill-run-/);
    expect(run.status).toBe('pending');
    expect(run.observationId).toBe('agent-observation-1');
    expect(run.planId).toBe('agent-plan-1');
    expect(run.skillId).toBe('opportunity-extractor');
    expect(run.skillVersion).toBe('1.0.0');
    expect(run.provider).toBe('heuristic');
    expect(run.outputSchemaRef).toBe('opportunity-extractor-output');
    expect(run.startedAt).toBeDefined();
  });

  it('accepts optional promptHash and notes', () => {
    const run = makeSkillRun({
      skill: {
        id: 'review-digest',
        version: '2.0.0',
        outputSchemaRef: 'review-digest-output',
      },
      promptHash: 'abc123',
      notes: 'Test run',
    } as Parameters<typeof createSkillRun>[0]);

    expect(run.promptHash).toBe('abc123');
    expect(run.notes).toBe('Test run');
  });
});

describe('completeSkillRun', () => {
  it('completes a run with validated output', () => {
    const run = makeSkillRun();
    const output = { candidates: [] };

    const completed = completeSkillRun(run, output);

    expect(completed.status).toBe('completed');
    expect(completed.finishedAt).toBeDefined();
    expect(completed.output).toEqual({ candidates: [] });
    expect(completed.id).toBe(run.id);
  });

  it('appends notes when provided', () => {
    const run = makeSkillRun();

    const completed = completeSkillRun(run, { candidates: [] }, 'Run was successful.');

    expect(completed.notes).toBe('Run was successful.');
  });

  it('preserves original notes when no new notes provided', () => {
    const run = createSkillRun({
      observationId: 'obs-1',
      planId: 'plan-1',
      skill: {
        id: 'opportunity-extractor',
        version: '1.0.0',
        outputSchemaRef: 'opportunity-extractor-output',
      },
      provider: 'heuristic',
      notes: 'Original note.',
    });

    const completed = completeSkillRun(run, { candidates: [] });

    expect(completed.notes).toBe('Original note.');
  });
});

describe('failSkillRun', () => {
  it('fails a run with an error message', () => {
    const run = makeSkillRun();

    const failed = failSkillRun(run, 'Inference timeout.');

    expect(failed.status).toBe('failed');
    expect(failed.error).toBe('Inference timeout.');
    expect(failed.finishedAt).toBeDefined();
    expect(failed.id).toBe(run.id);
  });
});

/* ---------------------------------------------------------------------------
 * validateSkillManifest
 * --------------------------------------------------------------------------- */

describe('validateSkillManifest', () => {
  it('validates a well-formed skill manifest', () => {
    const manifest = validateSkillManifest({
      id: 'opportunity-extractor',
      version: '1.0.0',
      description: 'Extracts opportunities from draft content.',
      runtime: 'extension-offscreen',
      model: 'heuristic',
      triggers: ['high-confidence-draft'],
      inputSchemaRef: 'agent-observation',
      outputSchemaRef: 'opportunity-extractor-output',
      allowedTools: [],
      allowedActionClasses: [],
      requiredCapabilities: [],
      approvalMode: 'auto-run-eligible',
      timeoutMs: 30000,
    });

    expect(manifest.id).toBe('opportunity-extractor');
    expect(manifest.outputSchemaRef).toBe('opportunity-extractor-output');
    expect(manifest.timeoutMs).toBe(30000);
  });

  it('throws on invalid manifest', () => {
    expect(() => validateSkillManifest({ id: '' })).toThrow();
  });
});

/* ---------------------------------------------------------------------------
 * createAgentGeneratedDraft
 * --------------------------------------------------------------------------- */

describe('createAgentGeneratedDraft', () => {
  it('creates a draft with all agent provenance fields', () => {
    const draft = createAgentGeneratedDraft({
      observationId: 'obs-1',
      planId: 'plan-1',
      skillRunId: 'run-1',
      skillId: 'review-digest',
      coopId: 'coop-1',
      title: 'Digest draft',
      summary: 'A digest summary.',
      whyItMatters: 'Important context.',
      suggestedNextStep: 'Review it.',
      tags: ['digest', 'review'],
      category: 'insight',
    });

    expect(draft.id).toMatch(/^draft-/);
    expect(draft.title).toBe('Digest draft');
    expect(draft.summary).toBe('A digest summary.');
    expect(draft.whyItMatters).toBe('Important context.');
    expect(draft.suggestedNextStep).toBe('Review it.');
    expect(draft.tags).toEqual(['digest', 'review']);
    expect(draft.category).toBe('insight');
    expect(draft.status).toBe('draft');
    expect(draft.workflowStage).toBe('candidate');
    expect(draft.confidence).toBe(0.72);
    expect(draft.suggestedTargetCoopIds).toEqual(['coop-1']);
    expect(draft.provenance).toEqual({
      type: 'agent',
      observationId: 'obs-1',
      planId: 'plan-1',
      skillRunId: 'run-1',
      skillId: 'review-digest',
    });
    expect(draft.sources).toHaveLength(1);
    expect(draft.sources[0].domain).toBe('agent.local');
    expect(draft.sources[0].url).toContain('review-digest');
  });

  it('uses custom workflowStage and confidence when provided', () => {
    const draft = createAgentGeneratedDraft({
      observationId: 'obs-1',
      planId: 'plan-1',
      skillRunId: 'run-1',
      skillId: 'test-skill',
      coopId: 'coop-1',
      title: 'Custom draft',
      summary: 'Summary.',
      whyItMatters: 'Matters.',
      suggestedNextStep: 'Next.',
      category: 'funding-lead',
      confidence: 0.99,
      workflowStage: 'ready',
    });

    expect(draft.confidence).toBe(0.99);
    expect(draft.workflowStage).toBe('ready');
  });

  it('defaults tags to empty array', () => {
    const draft = createAgentGeneratedDraft({
      observationId: 'obs-1',
      planId: 'plan-1',
      skillRunId: 'run-1',
      skillId: 'test-skill',
      coopId: 'coop-1',
      title: 'No tags',
      summary: 'Summary.',
      whyItMatters: 'Matters.',
      suggestedNextStep: 'Next.',
      category: 'insight',
    });

    expect(draft.tags).toEqual([]);
  });
});

/* ---------------------------------------------------------------------------
 * createReviewDigestDraft
 * --------------------------------------------------------------------------- */

describe('createReviewDigestDraft', () => {
  it('creates a draft from review digest output', () => {
    const output: ReviewDigestOutput = {
      title: 'Weekly digest',
      summary: 'A summary of weekly reviews.',
      whyItMatters: 'Keeps the team aligned.',
      suggestedNextStep: 'Share with members.',
      highlights: ['highlight-1'],
      tags: ['weekly', 'digest'],
    };

    const draft = createReviewDigestDraft({
      observationId: 'obs-1',
      planId: 'plan-1',
      skillRunId: 'run-1',
      skillId: 'review-digest',
      coopId: 'coop-1',
      output,
    });

    expect(draft.provenance.type).toBe('agent');
    if (draft.provenance.type !== 'agent') throw new Error('Expected agent provenance.');
    expect(draft.provenance.skillId).toBe('review-digest');
    expect(draft.category).toBe('insight');
    expect(draft.confidence).toBe(0.76);
    expect(draft.tags).toEqual(['weekly', 'digest']);
    expect(draft.summary).toBe('A summary of weekly reviews.');
    expect(draft.title).toContain('Review digest');
  });
});

/* ---------------------------------------------------------------------------
 * summarizeOpportunityCandidates
 * --------------------------------------------------------------------------- */

describe('summarizeOpportunityCandidates', () => {
  it('summarizes up to 3 candidates', () => {
    const candidates = [
      {
        id: 'c1',
        title: 'Alpha',
        summary: 'First opp.',
        rationale: 'r',
        regionTags: [],
        ecologyTags: [],
        fundingSignals: [],
        priority: 0.9,
        recommendedNextStep: 'step',
      },
      {
        id: 'c2',
        title: 'Beta',
        summary: 'Second opp.',
        rationale: 'r',
        regionTags: [],
        ecologyTags: [],
        fundingSignals: [],
        priority: 0.8,
        recommendedNextStep: 'step',
      },
      {
        id: 'c3',
        title: 'Gamma',
        summary: 'Third opp.',
        rationale: 'r',
        regionTags: [],
        ecologyTags: [],
        fundingSignals: [],
        priority: 0.7,
        recommendedNextStep: 'step',
      },
      {
        id: 'c4',
        title: 'Delta',
        summary: 'Fourth opp.',
        rationale: 'r',
        regionTags: [],
        ecologyTags: [],
        fundingSignals: [],
        priority: 0.6,
        recommendedNextStep: 'step',
      },
    ];

    const result = summarizeOpportunityCandidates(candidates);

    expect(result).toContain('Alpha: First opp.');
    expect(result).toContain('Beta: Second opp.');
    expect(result).toContain('Gamma: Third opp.');
    expect(result).not.toContain('Delta');
  });

  it('handles empty candidates', () => {
    const result = summarizeOpportunityCandidates([]);

    expect(result).toBe('');
  });

  it('handles fewer than 3 candidates', () => {
    const candidates = [
      {
        id: 'c1',
        title: 'Only',
        summary: 'Single.',
        rationale: 'r',
        regionTags: [],
        ecologyTags: [],
        fundingSignals: [],
        priority: 0.9,
        recommendedNextStep: 'step',
      },
    ];

    const result = summarizeOpportunityCandidates(candidates);

    expect(result).toBe('Only: Single.');
  });
});

/* ---------------------------------------------------------------------------
 * summarizePublishReadiness
 * --------------------------------------------------------------------------- */

describe('summarizePublishReadiness', () => {
  it('returns ready message when draft is ready', () => {
    const result = summarizePublishReadiness({
      draftId: 'draft-1',
      ready: true,
      suggestions: [],
      proposedPatch: {},
    });

    expect(result).toBe('Draft is ready to publish.');
  });

  it('returns suggestions when draft needs work', () => {
    const result = summarizePublishReadiness({
      draftId: 'draft-1',
      ready: false,
      suggestions: ['Add more context.', 'Fix title.'],
      proposedPatch: {},
    });

    expect(result).toContain('Draft needs work');
    expect(result).toContain('Add more context.');
    expect(result).toContain('Fix title.');
  });

  it('handles empty suggestions on not-ready draft', () => {
    const result = summarizePublishReadiness({
      draftId: 'draft-1',
      ready: false,
      suggestions: [],
      proposedPatch: {},
    });

    expect(result).toContain('Draft needs work');
  });
});

/* ---------------------------------------------------------------------------
 * skillOutputSchemas map
 * --------------------------------------------------------------------------- */

describe('skillOutputSchemas', () => {
  it('has a parse function for every registered schema ref', () => {
    const expectedRefs = [
      'opportunity-extractor-output',
      'grant-fit-scorer-output',
      'capital-formation-brief-output',
      'review-digest-output',
      'ecosystem-entity-extractor-output',
      'theme-clusterer-output',
      'publish-readiness-check-output',
      'green-goods-garden-bootstrap-output',
      'green-goods-garden-sync-output',
      'green-goods-work-approval-output',
      'green-goods-assessment-output',
      'green-goods-gap-admin-sync-output',
    ] as const;

    for (const ref of expectedRefs) {
      expect(skillOutputSchemas[ref]).toBeDefined();
      expect(typeof skillOutputSchemas[ref].parse).toBe('function');
    }
  });

  it('opportunity-extractor-output parses valid output', () => {
    const result = skillOutputSchemas['opportunity-extractor-output'].parse({
      candidates: [],
    });
    expect(result).toEqual({ candidates: [] });
  });

  it('review-digest-output parses valid output', () => {
    const result = skillOutputSchemas['review-digest-output'].parse({
      title: 'Digest',
      summary: 'Sum.',
      whyItMatters: 'Matters.',
      suggestedNextStep: 'Next.',
      highlights: [],
      tags: [],
    });
    expect(result).toHaveProperty('title', 'Digest');
  });

  it('publish-readiness-check-output parses valid output', () => {
    const result = skillOutputSchemas['publish-readiness-check-output'].parse({
      draftId: 'draft-1',
      ready: true,
      suggestions: [],
    });
    expect(result).toHaveProperty('ready', true);
  });
});

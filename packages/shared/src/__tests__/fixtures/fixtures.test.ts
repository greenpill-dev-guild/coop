import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { IDBKeyRange, indexedDB } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import {
  actionBundleSchema,
  agentObservationSchema,
  agentPlanSchema,
  artifactSchema,
  reviewDraftSchema,
  setupInsightsSchema,
  skillRunSchema,
  tabCandidateSchema,
} from '../../contracts/schema';
import {
  freshDb,
  makeActionBundle,
  makeAgentObservation,
  makeAgentPlan,
  makeArtifact,
  makeReviewDraft,
  makeSetupInsights,
  makeSkillRun,
  makeTabCandidate,
} from './index';

Dexie.dependencies.indexedDB = indexedDB;
Dexie.dependencies.IDBKeyRange = IDBKeyRange;

describe('shared test fixture factories', () => {
  describe('makeReviewDraft', () => {
    it('returns a valid ReviewDraft with defaults', () => {
      const draft = makeReviewDraft();
      const result = reviewDraftSchema.safeParse(draft);
      expect(result.success).toBe(true);
    });

    it('applies overrides without breaking validation', () => {
      const draft = makeReviewDraft({
        id: 'custom-draft',
        title: 'Custom title',
        confidence: 0.95,
      });
      expect(draft.id).toBe('custom-draft');
      expect(draft.title).toBe('Custom title');
      expect(draft.confidence).toBe(0.95);
      const result = reviewDraftSchema.safeParse(draft);
      expect(result.success).toBe(true);
    });

    it('uses deterministic values for reproducibility', () => {
      const a = makeReviewDraft();
      const b = makeReviewDraft();
      expect(a.id).toBe(b.id);
      expect(a.createdAt).toBe(b.createdAt);
    });
  });

  describe('makeArtifact', () => {
    it('returns a valid Artifact with defaults', () => {
      const artifact = makeArtifact();
      const result = artifactSchema.safeParse(artifact);
      expect(result.success).toBe(true);
    });

    it('applies overrides', () => {
      const artifact = makeArtifact({
        id: 'custom-artifact',
        title: 'Override title',
      });
      expect(artifact.id).toBe('custom-artifact');
      expect(artifact.title).toBe('Override title');
    });
  });

  describe('makeTabCandidate', () => {
    it('returns a valid TabCandidate with defaults', () => {
      const tab = makeTabCandidate();
      const result = tabCandidateSchema.safeParse(tab);
      expect(result.success).toBe(true);
    });

    it('applies overrides', () => {
      const tab = makeTabCandidate({ url: 'https://custom.org' });
      expect(tab.url).toBe('https://custom.org');
    });
  });

  describe('makeSetupInsights', () => {
    it('returns a valid SetupInsights with all four lenses', () => {
      const insights = makeSetupInsights();
      const result = setupInsightsSchema.safeParse(insights);
      expect(result.success).toBe(true);
      expect(insights.lenses).toHaveLength(4);
    });
  });

  describe('makeAgentObservation', () => {
    it('returns a valid AgentObservation with defaults', () => {
      const obs = makeAgentObservation();
      const result = agentObservationSchema.safeParse(obs);
      expect(result.success).toBe(true);
    });

    it('applies overrides', () => {
      const obs = makeAgentObservation({
        trigger: 'high-confidence-draft',
        status: 'completed',
      });
      expect(obs.trigger).toBe('high-confidence-draft');
      expect(obs.status).toBe('completed');
    });
  });

  describe('makeAgentPlan', () => {
    it('returns a valid AgentPlan with defaults', () => {
      const plan = makeAgentPlan();
      const result = agentPlanSchema.safeParse(plan);
      expect(result.success).toBe(true);
    });
  });

  describe('makeSkillRun', () => {
    it('returns a valid SkillRun with defaults', () => {
      const run = makeSkillRun();
      const result = skillRunSchema.safeParse(run);
      expect(result.success).toBe(true);
    });
  });

  describe('makeActionBundle', () => {
    it('returns a valid ActionBundle with defaults', () => {
      const bundle = makeActionBundle();
      const result = actionBundleSchema.safeParse(bundle);
      expect(result.success).toBe(true);
    });

    it('applies overrides', () => {
      const bundle = makeActionBundle({
        actionClass: 'safe-deployment',
        status: 'approved',
      });
      expect(bundle.actionClass).toBe('safe-deployment');
      expect(bundle.status).toBe('approved');
    });
  });

  describe('freshDb', () => {
    it('returns a Dexie instance with the expected tables', () => {
      const db = freshDb();
      expect(db).toBeDefined();
      expect(db.table('coopDocs')).toBeDefined();
      expect(db.table('reviewDrafts')).toBeDefined();
      expect(db.table('tabCandidates')).toBeDefined();
    });
  });
});

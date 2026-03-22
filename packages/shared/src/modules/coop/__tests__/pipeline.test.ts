import { describe, expect, it } from 'vitest';
import { createCoop } from '../flows';
import {
  createLocalEnhancementAdapter,
  detectLocalEnhancementAvailability,
  inferFromTranscript,
  runPassivePipeline,
} from '../pipeline';

function buildSetupInsights() {
  return {
    summary:
      'We need a shared membrane for funding leads, governance follow-up, and knowledge handoff.',
    crossCuttingPainPoints: ['Research disappears', 'Meeting follow-up gets lost'],
    crossCuttingOpportunities: ['Turn tabs into funding-ready evidence'],
    lenses: [
      {
        lens: 'capital-formation',
        currentState: 'We collect grant links in scattered docs.',
        painPoints: 'Funding context arrives too late.',
        improvements: 'Surface fundable leads during weekly review.',
      },
      {
        lens: 'impact-reporting',
        currentState: 'Impact evidence sits in private notes.',
        painPoints: 'Reporting is assembled at the last minute.',
        improvements: 'Keep evidence visible in shared memory.',
      },
      {
        lens: 'governance-coordination',
        currentState: 'Calls happen regularly.',
        painPoints: 'Decision follow-up disappears after meetings.',
        improvements: 'Keep next steps visible in the coop feed.',
      },
      {
        lens: 'knowledge-garden-resources',
        currentState: 'Guides and resources are spread across tabs and drives.',
        painPoints: 'People repeat the same research.',
        improvements: 'Create a living resource commons.',
      },
    ],
  } as const;
}

describe('pipeline', () => {
  it('shapes review drafts with heuristics when local enhancement is unavailable', () => {
    const created = createCoop({
      coopName: 'River Coop',
      purpose: 'Share evidence and funding-ready next steps for watershed work.',
      creatorDisplayName: 'Ari',
      captureMode: 'manual',
      seedContribution: 'I track grants and river restoration programs.',
      setupInsights: buildSetupInsights(),
    });

    const pipeline = runPassivePipeline({
      candidate: {
        id: 'candidate-1',
        tabId: 1,
        windowId: 1,
        url: 'https://example.org/watershed-grant-roundup',
        canonicalUrl: 'https://example.org/watershed-grant-roundup',
        title: 'Watershed grant roundup for 2026',
        domain: 'example.org',
        capturedAt: new Date().toISOString(),
      },
      page: {
        metaDescription: 'A roundup of watershed funding opportunities and program deadlines.',
        headings: ['Funding opportunities', 'Shared evidence'],
        paragraphs: [
          'This grant roundup tracks fundable opportunities for watershed collaboratives.',
          'It includes evidence requirements, impact reporting needs, and next steps for proposals.',
        ],
      },
      coops: [created.state],
    });

    expect(pipeline.extract.cleanedTitle).toContain('Watershed grant roundup');
    expect(pipeline.drafts).toHaveLength(1);
    expect(pipeline.drafts[0]?.category).toBe('funding-lead');
    expect(pipeline.drafts[0]?.whyItMatters).toContain('River Coop');
  });

  it('reports local enhancement availability and fallback status cleanly', () => {
    expect(
      detectLocalEnhancementAvailability({
        prefersLocalModels: true,
        hasWorkerRuntime: false,
        hasWebGpu: true,
      }).status,
    ).toBe('unavailable');

    const ready = detectLocalEnhancementAvailability({
      prefersLocalModels: true,
      hasWorkerRuntime: true,
      hasWebGpu: true,
    });

    expect(ready.status).toBe('ready');
    expect(ready.model).toContain('Keyword classifier');
  });

  it('runs a real local refinement pass when enhancement is enabled', () => {
    const created = createCoop({
      coopName: 'River Coop',
      purpose: 'Share evidence and funding-ready next steps for watershed work.',
      creatorDisplayName: 'Ari',
      captureMode: 'manual',
      seedContribution: 'I track grants and river restoration programs.',
      setupInsights: buildSetupInsights(),
    });
    created.state.memoryProfile.archiveSignals.archivedDomainCounts['example.org'] = 2;
    created.state.memoryProfile.archiveSignals.archivedTagCounts.grant = 3;

    const pipeline = runPassivePipeline({
      candidate: {
        id: 'candidate-2',
        tabId: 2,
        windowId: 1,
        url: 'https://example.org/grant-deadline',
        canonicalUrl: 'https://example.org/grant-deadline',
        title: 'Grant deadline update',
        domain: 'example.org',
        capturedAt: new Date().toISOString(),
      },
      page: {
        metaDescription: 'Funding deadline update for watershed evidence and proposal work.',
        headings: ['Funding deadline', 'Proposal evidence'],
        paragraphs: [
          'This update confirms the funding deadline and evidence packet expectations.',
          'The coop should review whether to archive the final grant materials after publish.',
        ],
      },
      coops: [created.state],
      inferenceAdapter: createLocalEnhancementAdapter({
        prefersLocalModels: true,
        hasWorkerRuntime: true,
        hasWebGpu: false,
      }),
    });

    expect(pipeline.drafts[0]?.rationale).toContain('Local classifier');
    expect(pipeline.drafts[0]?.suggestedNextStep).toContain('push or archive');
    expect(pipeline.drafts[0]?.confidence).toBeGreaterThan(0.18);
  });
});

describe('inferFromTranscript', () => {
  it('infers funding-lead category from grant-related transcript', () => {
    const result = inferFromTranscript({
      transcriptText:
        'We need to submit the grant application by Friday. The funding deadline is approaching and the treasury allocation is confirmed.',
      title: 'Voice note about grants',
    });

    expect(result.category).toBe('funding-lead');
    expect(result.confidence).toBeGreaterThan(0.34);
    expect(result.tags.length).toBeGreaterThan(0);
  });

  it('infers evidence category from report-related transcript', () => {
    const result = inferFromTranscript({
      transcriptText:
        'The soil samples show improved metric readings. The evidence from the field report confirms the evaluation findings.',
      title: 'Field report notes',
    });

    expect(result.category).toBe('evidence');
    expect(result.confidence).toBeGreaterThan(0.34);
  });

  it('infers next-step category from action-oriented transcript', () => {
    const result = inferFromTranscript({
      transcriptText:
        'The next step is to finalize the proposal. We need to follow up with the team about the deadline for action items.',
      title: 'Meeting follow-up',
    });

    expect(result.category).toBe('next-step');
    expect(result.confidence).toBeGreaterThan(0.34);
  });

  it('extracts meaningful tags from transcript content', () => {
    const result = inferFromTranscript({
      transcriptText:
        'We need to update the garden irrigation system. The tomatoes are ready for harvest. The compost application seems to be working well.',
      title: 'Garden update notes',
    });

    expect(result.tags.length).toBeGreaterThan(0);
    expect(result.tags.some((tag) => tag.length > 4)).toBe(true);
  });

  it('returns insight as default category for generic content', () => {
    const result = inferFromTranscript({
      transcriptText: 'Just talking about some general things that happened today.',
      title: 'Random note',
    });

    expect(result.category).toBeDefined();
    expect(result.confidence).toBeGreaterThan(0.34);
  });

  it('uses segments for tag extraction when provided', () => {
    const result = inferFromTranscript({
      transcriptText: 'The full transcript text here with garden and irrigation details.',
      title: 'Segment test',
      segments: [
        { start: 0, end: 5, text: 'The full transcript text here', confidence: 0.9 },
        { start: 5, end: 10, text: 'with garden and irrigation details', confidence: 0.85 },
      ],
    });

    expect(result.tags.length).toBeGreaterThan(0);
  });
});

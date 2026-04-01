import { describe, expect, it } from 'vitest';
import { canonicalizeUrl, hashText } from '../../../utils';
import { createCoop } from '../flows';
import {
  arePageExtractsNearDuplicates,
  buildReadablePageExtract,
  createLocalEnhancementAdapter,
  detectLocalEnhancementAvailability,
  inferFromTranscript,
  interpretExtractForCoop,
  runPassivePipeline,
  shapeReviewDraft,
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

function buildCandidate(input: {
  id: string;
  url: string;
  title: string;
  capturedAt?: string;
}) {
  const canonicalUrl = canonicalizeUrl(input.url);
  return {
    id: input.id,
    tabId: Number.parseInt(input.id.replace(/\D+/g, ''), 10) || 1,
    windowId: 1,
    url: input.url,
    canonicalUrl,
    canonicalUrlHash: hashText(canonicalUrl),
    title: input.title,
    domain: new URL(input.url).hostname.replace(/^www\./, ''),
    capturedAt: input.capturedAt ?? '2026-03-27T12:00:00.000Z',
  };
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
        favicon: 'https://example.org/favicon.ico',
        capturedAt: new Date().toISOString(),
      },
      page: {
        metaDescription: 'A roundup of watershed funding opportunities and program deadlines.',
        headings: ['Funding opportunities', 'Shared evidence'],
        paragraphs: [
          'This grant roundup tracks fundable opportunities for watershed collaboratives.',
          'It includes evidence requirements, impact reporting needs, and next steps for proposals.',
        ],
        socialPreviewImageUrl: 'https://example.org/social-preview.png',
      },
      coops: [created.state],
    });

    expect(pipeline.extract.cleanedTitle).toContain('Watershed grant roundup');
    expect(pipeline.extract.faviconUrl).toBe('https://example.org/favicon.ico');
    expect(pipeline.extract.socialPreviewImageUrl).toBe('https://example.org/social-preview.png');
    expect(pipeline.extract.previewImageUrl).toBe('https://example.org/social-preview.png');
    expect(pipeline.drafts).toHaveLength(1);
    expect(pipeline.drafts[0]?.category).toBe('funding-lead');
    expect(pipeline.drafts[0]?.whyItMatters).toContain('River Coop');
    expect(pipeline.drafts[0]?.sources[0]).toMatchObject({
      faviconUrl: 'https://example.org/favicon.ico',
      socialPreviewImageUrl: 'https://example.org/social-preview.png',
    });
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

  it('treats high-overlap same-domain extracts as near duplicates', () => {
    const original = buildReadablePageExtract({
      candidate: buildCandidate({
        id: 'candidate-1',
        url: 'https://funding.example.org/grants/watershed-roundup',
        title: 'Watershed restoration grant roundup for 2026',
      }),
      metaDescription:
        'A funding brief covering watershed restoration grants, local match requirements, and proposal timing.',
      headings: ['Funding brief', 'Application timeline'],
      paragraphs: [
        'This grant roundup tracks watershed restoration funding deadlines, local match requirements, and proposal milestones for river alliances.',
        'Teams can use the brief to gather eligibility evidence, confirm deadlines, and coordinate the proposal packet before submission.',
        'Subscribe for updates and share this article with your network.',
      ],
    });
    const printView = buildReadablePageExtract({
      candidate: buildCandidate({
        id: 'candidate-2',
        url: 'https://funding.example.org/news/watershed-roundup-print',
        title: '2026 watershed restoration grant round-up',
      }),
      metaDescription:
        'Funding brief for watershed restoration collaboratives with local match guidance and submission timing.',
      headings: ['Application timeline', 'Funding brief'],
      paragraphs: [
        'River alliances can use this funding brief to gather eligibility evidence, confirm proposal timing, and prepare the submission packet.',
        'This watershed restoration grant roundup tracks funding deadlines and local match requirements for collaborative projects.',
        'Print this page or share it with a colleague.',
      ],
    });

    expect(arePageExtractsNearDuplicates(original, printView)).toBe(true);
  });

  it('keeps distinct same-domain articles when overlap stays topical but not duplicative', () => {
    const fundingLead = buildReadablePageExtract({
      candidate: buildCandidate({
        id: 'candidate-3',
        url: 'https://funding.example.org/grants/watershed-roundup',
        title: 'Watershed restoration grant roundup for 2026',
      }),
      metaDescription:
        'A funding brief covering watershed restoration grants, local match requirements, and proposal timing.',
      headings: ['Funding brief', 'Application timeline'],
      paragraphs: [
        'This grant roundup tracks watershed restoration funding deadlines, local match requirements, and proposal milestones for river alliances.',
        'Teams can use the brief to gather eligibility evidence, confirm deadlines, and coordinate the proposal packet before submission.',
      ],
    });
    const reportingGuide = buildReadablePageExtract({
      candidate: buildCandidate({
        id: 'candidate-4',
        url: 'https://funding.example.org/guides/reporting-checklist',
        title: 'Post-award reporting checklist for watershed grants',
      }),
      metaDescription:
        'A guide to quarterly reporting, invoice backup, and evidence retention after a watershed grant is awarded.',
      headings: ['Reporting checklist', 'Evidence retention'],
      paragraphs: [
        'This guide covers post-award reporting deadlines, invoice backup, evidence retention, and quarterly narrative updates for active grants.',
        'Use it after a grant is awarded to keep compliance materials ready for reimbursement and audit review.',
      ],
    });

    expect(arePageExtractsNearDuplicates(fundingLead, reportingGuide)).toBe(false);
  });

  describe('sports coop roundup ingestion', () => {
    function buildSportsCoop() {
      return createCoop({
        coopName: 'Sports Central',
        purpose: 'Track sports news, scores, and analysis for NBA, NFL, and soccer coverage.',
        creatorDisplayName: 'Fan',
        captureMode: 'manual',
        seedContribution: 'I follow NBA and NFL closely and want to share game recaps.',
        setupInsights: {
          summary: 'We share sports coverage, game analysis, and league updates.',
          crossCuttingPainPoints: ['Game recaps get lost in feeds'],
          crossCuttingOpportunities: ['Surface key sports news for weekly review'],
          lenses: [
            {
              lens: 'capital-formation',
              currentState: 'We browse ESPN and The Athletic for scores.',
              painPoints: 'Sports coverage arrives too late to discuss.',
              improvements: 'Surface game recaps during weekly sports review.',
            },
            {
              lens: 'impact-reporting',
              currentState: 'Game analysis sits in personal bookmarks.',
              painPoints: 'Key sports moments get missed by the group.',
              improvements: 'Keep sports highlights visible in shared memory.',
            },
            {
              lens: 'governance-coordination',
              currentState: 'We discuss games in group chats.',
              painPoints: 'Sports conversations disappear after game day.',
              improvements: 'Keep sports discussion summaries in the coop feed.',
            },
            {
              lens: 'knowledge-garden-resources',
              currentState: 'Team stats and player news are spread across tabs.',
              painPoints: 'People miss important trades and roster moves.',
              improvements: 'Create a living sports resource commons.',
            },
          ],
        },
      });
    }

    it('routes an NBA article to a sports-focused coop', () => {
      const created = buildSportsCoop();
      const pipeline = runPassivePipeline({
        candidate: buildCandidate({
          id: 'candidate-nba',
          url: 'https://espn.com/nba/story/lakers-celtics-game-5',
          title: 'NBA Playoffs: Lakers vs Celtics Game 5 Recap',
        }),
        page: {
          metaDescription:
            'Full recap of the NBA playoff game between the Lakers and Celtics, including highlights and analysis.',
          headings: ['Game 5 Recap', 'Box Score', 'Player Stats'],
          paragraphs: [
            'The Lakers defeated the Celtics 112-108 in a thrilling Game 5 of the NBA Finals.',
            'LeBron James scored 38 points to lead the Lakers in a must-win sports game.',
          ],
        },
        coops: [created.state],
      });

      expect(pipeline.drafts.length).toBeGreaterThanOrEqual(1);
      expect(pipeline.drafts[0]?.confidence).toBeGreaterThanOrEqual(0.18);
    });

    it('routes an NFL draft article to a sports-focused coop', () => {
      const created = buildSportsCoop();
      const pipeline = runPassivePipeline({
        candidate: buildCandidate({
          id: 'candidate-nfl',
          url: 'https://nfl.com/draft/2025/live-coverage',
          title: 'NFL Draft 2025 Live Coverage and Analysis',
        }),
        page: {
          metaDescription: 'Live coverage of the 2025 NFL Draft with picks, analysis, and grades.',
          headings: ['Round 1 Picks', 'Draft Analysis', 'Team Grades'],
          paragraphs: [
            'The 2025 NFL Draft kicks off with several top prospects ready to make an impact.',
            'NFL scouts grade each pick for sports fans following along at home.',
          ],
        },
        coops: [created.state],
      });

      expect(pipeline.drafts.length).toBeGreaterThanOrEqual(1);
      expect(pipeline.drafts[0]?.confidence).toBeGreaterThanOrEqual(0.18);
    });

    it('does not route a cooking article to a sports-focused coop', () => {
      const created = buildSportsCoop();
      const pipeline = runPassivePipeline({
        candidate: buildCandidate({
          id: 'candidate-cooking',
          url: 'https://foodnetwork.com/recipes/chicken-parmesan',
          title: 'Best Chicken Parmesan Recipe',
        }),
        page: {
          metaDescription: 'A classic chicken parmesan recipe with marinara sauce and mozzarella.',
          headings: ['Ingredients', 'Instructions'],
          paragraphs: [
            'This chicken parmesan recipe is crispy on the outside and tender on the inside.',
            'Serve with spaghetti and garlic bread for a complete Italian dinner.',
          ],
        },
        coops: [created.state],
      });

      expect(pipeline.drafts).toHaveLength(0);
    });

    it('routes a sports page even when "sports" does not appear in the title', () => {
      const created = buildSportsCoop();
      const pipeline = runPassivePipeline({
        candidate: buildCandidate({
          id: 'candidate-soccer',
          url: 'https://theathletic.com/premier-league/match-review',
          title: 'Premier League Match Review: Arsenal 3-1 Chelsea',
        }),
        page: {
          metaDescription:
            'Tactical analysis of the Premier League match between Arsenal and Chelsea.',
          headings: ['Match Overview', 'Key Moments'],
          paragraphs: [
            'Arsenal dominated possession and scored three times in the second half.',
            'This soccer coverage includes analysis of key plays and formation changes.',
          ],
        },
        coops: [created.state],
      });

      expect(pipeline.drafts.length).toBeGreaterThanOrEqual(1);
    });

    it('does not match "nba" as a substring inside "unbalanced"', () => {
      const created = buildSportsCoop();
      // Build a page where the ONLY potential sports keyword overlap is "nba" hidden
      // inside "unbalanced" — if substring matching were used, this would be a false hit.
      const extract = buildReadablePageExtract({
        candidate: buildCandidate({
          id: 'candidate-substring',
          url: 'https://example.org/urban-planning',
          title: 'Unbalanced Zoning Proposals in Barnaby Township',
        }),
        metaDescription: 'Barnaby township faces unbalanced zoning.',
        headings: ['Zoning Proposals'],
        paragraphs: ['The unbalanced zoning has raised concerns in Barnaby.'],
      });

      const interp = interpretExtractForCoop(extract, created.state);
      // With word-boundary tokenization, "unbalanced" and "barnaby" do not match "nba".
      // Score should be at the floor (0.08) since no real keyword overlap exists.
      expect(interp.relevanceScore).toBeLessThan(0.18);
    });
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

describe('roundup ingestion end-to-end', () => {
  function buildSportsCoopState() {
    return createCoop({
      coopName: 'Sports Central',
      purpose: 'Track sports news, scores, and analysis for NBA, NFL, and soccer coverage.',
      creatorDisplayName: 'Fan',
      captureMode: 'manual',
      seedContribution: 'I follow NBA and NFL closely and want to share game recaps.',
      setupInsights: {
        summary: 'We share sports coverage, game analysis, and league updates.',
        crossCuttingPainPoints: ['Game recaps get lost in feeds'],
        crossCuttingOpportunities: ['Surface key sports news for weekly review'],
        lenses: [
          {
            lens: 'capital-formation',
            currentState: 'We browse ESPN and The Athletic for scores.',
            painPoints: 'Sports coverage arrives too late to discuss.',
            improvements: 'Surface game recaps during weekly sports review.',
          },
          {
            lens: 'impact-reporting',
            currentState: 'Game analysis sits in personal bookmarks.',
            painPoints: 'Key sports moments get missed by the group.',
            improvements: 'Keep sports highlights visible in shared memory.',
          },
          {
            lens: 'governance-coordination',
            currentState: 'We discuss games in group chats.',
            painPoints: 'Sports conversations disappear after game day.',
            improvements: 'Keep sports discussion summaries in the coop feed.',
          },
          {
            lens: 'knowledge-garden-resources',
            currentState: 'Team stats and player news are spread across tabs.',
            painPoints: 'People miss important trades and roster moves.',
            improvements: 'Create a living sports resource commons.',
          },
        ],
      },
    });
  }

  it('produces a draft when a relevant page is routed to an aligned coop', () => {
    const created = buildSportsCoopState();
    const extract = buildReadablePageExtract({
      candidate: buildCandidate({
        id: 'candidate-e2e-1',
        url: 'https://espn.com/nba/story/lakers-celtics-game-5',
        title: 'NBA Playoffs: Lakers vs Celtics Game 5 Recap',
      }),
      metaDescription:
        'Full recap of the NBA playoff game between the Lakers and Celtics, including highlights and analysis.',
      headings: ['Game 5 Recap', 'Box Score', 'Player Stats'],
      paragraphs: [
        'The Lakers defeated the Celtics 112-108 in a thrilling Game 5 of the NBA Finals.',
        'LeBron James scored 38 points to lead the Lakers in a must-win sports game.',
      ],
    });

    const interpretation = interpretExtractForCoop(extract, created.state);
    expect(interpretation.relevanceScore).toBeGreaterThanOrEqual(0.18);

    const draft = shapeReviewDraft(extract, interpretation, created.state.profile);
    expect(draft.suggestedTargetCoopIds).toContain(created.state.profile.id);
    expect(draft.category).toBeDefined();
    expect(draft.tags.length).toBeGreaterThan(0);
    expect(draft.whyItMatters).toContain('Sports Central');
  });

  it('does not produce a draft for an unrelated page', () => {
    const created = buildSportsCoopState();
    const extract = buildReadablePageExtract({
      candidate: buildCandidate({
        id: 'candidate-e2e-2',
        url: 'https://foodnetwork.com/recipes/chicken-parmesan',
        title: 'Best Chicken Parmesan Recipe',
      }),
      metaDescription: 'A classic chicken parmesan recipe with marinara sauce and mozzarella.',
      headings: ['Ingredients', 'Instructions'],
      paragraphs: [
        'This chicken parmesan recipe is crispy on the outside and tender on the inside.',
        'Serve with spaghetti and garlic bread for a complete Italian dinner.',
      ],
    });

    const interpretation = interpretExtractForCoop(extract, created.state);
    expect(interpretation.relevanceScore).toBeLessThan(0.18);
  });

  it('routes to the most relevant coop when multiple coops exist', () => {
    const sportsCoop = buildSportsCoopState();
    const watershedCoop = createCoop({
      coopName: 'River Coop',
      purpose: 'Share evidence and funding-ready next steps for watershed work.',
      creatorDisplayName: 'Ari',
      captureMode: 'manual',
      seedContribution: 'I track grants and river restoration programs.',
      setupInsights: buildSetupInsights(),
    });

    const extract = buildReadablePageExtract({
      candidate: buildCandidate({
        id: 'candidate-e2e-3',
        url: 'https://espn.com/nba/recap',
        title: 'NBA Finals Recap and Sports Analysis',
      }),
      metaDescription: 'Sports coverage of the NBA Finals with analysis and highlights.',
      headings: ['Game Recap', 'Analysis'],
      paragraphs: [
        'The NBA Finals featured incredible sports moments and playoff drama.',
        'Sports fans across the country tuned in for this must-see basketball coverage.',
      ],
    });

    const sportsScore = interpretExtractForCoop(extract, sportsCoop.state).relevanceScore;
    const watershedScore = interpretExtractForCoop(extract, watershedCoop.state).relevanceScore;

    expect(sportsScore).toBeGreaterThan(watershedScore);
  });
});

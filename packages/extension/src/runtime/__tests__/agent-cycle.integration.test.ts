import 'fake-indexeddb/auto';
import {
  createAgentMemory,
  createCoop,
  listAgentObservations,
  listPageExtracts,
  listReceiverCaptures,
  listReviewDrafts,
  listTabRoutings,
  nowIso,
  saveCoopState,
  setAuthSession,
} from '@coop/shared';
import * as shared from '@coop/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const agentCycleTimeout = 20_000;

const { mockCompleteSkillOutput } = vi.hoisted(() => ({
  mockCompleteSkillOutput: vi.fn(),
}));

vi.mock('../agent/models', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../agent/models')>();
  return {
    ...actual,
    completeSkillOutput: mockCompleteSkillOutput,
  };
});

vi.mock('../../background/dashboard', () => ({
  refreshBadge: vi.fn(),
}));

function buildSetupInsights(input: {
  summary: string;
  capitalFormation: string;
  impactReporting: string;
  governance: string;
  knowledge: string;
}) {
  return {
    summary: input.summary,
    crossCuttingPainPoints: ['Signal is fragmented', 'Context gets lost between tools'],
    crossCuttingOpportunities: ['Turn capture into shared action'],
    lenses: [
      {
        lens: 'capital-formation' as const,
        currentState: input.capitalFormation,
        painPoints: 'Funding leads are hard to compare.',
        improvements: 'Route fundable opportunities into the coop review loop.',
      },
      {
        lens: 'impact-reporting' as const,
        currentState: input.impactReporting,
        painPoints: 'Evidence is assembled late.',
        improvements: 'Keep evidence visible across the week.',
      },
      {
        lens: 'governance-coordination' as const,
        currentState: input.governance,
        painPoints: 'Decisions lose momentum.',
        improvements: 'Keep next steps in front of the coop.',
      },
      {
        lens: 'knowledge-garden-resources' as const,
        currentState: input.knowledge,
        painPoints: 'Research gets repeated.',
        improvements: 'Persist high-signal resources locally.',
      },
    ],
  };
}

function makeAuthSession(address: string, displayName: string) {
  return {
    authMode: 'passkey' as const,
    displayName,
    primaryAddress: address,
    createdAt: nowIso(),
    identityWarning: 'Stored locally.',
  };
}

function makeTab(overrides: {
  id: number;
  windowId: number;
  url: string;
  title: string;
}): chrome.tabs.Tab {
  return {
    active: true,
    autoDiscardable: true,
    discarded: false,
    frozen: false,
    groupId: -1,
    highlighted: true,
    id: overrides.id,
    incognito: false,
    index: 0,
    pinned: false,
    selected: true,
    status: 'complete',
    title: overrides.title,
    url: overrides.url,
    windowId: overrides.windowId,
  };
}

async function resetCoopExtensionDb() {
  const [{ db: runtimeDb }, { db: backgroundDb }] = await Promise.all([
    import('../agent/runner-state'),
    import('../../background/context'),
  ]);

  await new Promise((resolve) => setTimeout(resolve, 50));
  await Promise.all([
    ...runtimeDb.tables.map((table) => table.clear()),
    ...backgroundDb.tables.map((table) => table.clear()),
  ]);
}

async function loadAgentIntegrationModules() {
  const [{ db: runtimeDb }, { db: backgroundDb }, captureHandlers, agentRunner] = await Promise.all(
    [
      import('../agent/runner-state'),
      import('../../background/context'),
      import('../../background/handlers/capture'),
      import('../agent/runner'),
    ],
  );

  return {
    runtimeDb,
    backgroundDb,
    captureAudio: captureHandlers.captureAudio,
    runCaptureForTabs: captureHandlers.runCaptureForTabs,
    runAgentCycle: agentRunner.runAgentCycle,
  };
}

describe('agent cycle integration', () => {
  beforeEach(async () => {
    mockCompleteSkillOutput.mockReset();

    Object.assign(globalThis, {
      chrome: {
        runtime: {
          sendMessage: vi.fn().mockResolvedValue({ ok: true }),
        },
        scripting: {
          executeScript: vi.fn(),
        },
        notifications: {
          create: vi.fn().mockResolvedValue(undefined),
        },
        permissions: {
          contains: vi.fn().mockResolvedValue(true),
        },
      },
    });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    Reflect.deleteProperty(globalThis, 'chrome');
  });

  it(
    'limits routed output to authorized coops and drafts only the strongest authorized match',
    async () => {
      await resetCoopExtensionDb();
      const { backgroundDb, runAgentCycle, runCaptureForTabs, runtimeDb } =
        await loadAgentIntegrationModules();
      const sharedCreator = createCoop({
        coopName: 'Watershed Funding Coop',
        purpose: 'Track watershed restoration funding and grant readiness.',
        creatorDisplayName: 'Ari',
        captureMode: 'manual',
        seedContribution: 'I collect funding opportunities and match them to restoration work.',
        setupInsights: buildSetupInsights({
          summary: 'This coop turns research into funding-ready action.',
          capitalFormation: 'We watch watershed grants and restoration funding.',
          impactReporting: 'We package evidence for grant reporting.',
          governance: 'We review leads weekly.',
          knowledge: 'Funding notes live across scattered tabs.',
        }),
      });
      const strongAuthorizedCoop = sharedCreator.state;
      const authorizedAddress = sharedCreator.creator.address;

      const weakAuthorizedCoop = createCoop({
        coopName: 'Governance Circle',
        purpose: 'Coordinate meetings, governance follow-up, and facilitation notes.',
        creatorDisplayName: sharedCreator.creator.displayName,
        creator: {
          ...sharedCreator.creator,
          id: 'member-authorized-2',
        },
        captureMode: 'manual',
        seedContribution: 'I keep governance tasks moving across weekly meetings.',
        setupInsights: buildSetupInsights({
          summary: 'This coop is about governance follow-through, not funding.',
          capitalFormation: 'Budgeting is secondary to meeting coordination.',
          impactReporting: 'We log decisions and commitments.',
          governance: 'Meeting follow-up is the primary job.',
          knowledge: 'Notes from facilitators need a shared home.',
        }),
      }).state;

      const unauthorizedCoop = createCoop({
        coopName: 'Federal Grants Desk',
        purpose: 'Match federal watershed restoration grants to local river resilience projects.',
        creatorDisplayName: 'Blair',
        captureMode: 'manual',
        seedContribution: 'I chase every federal grant and restoration deadline.',
        setupInsights: buildSetupInsights({
          summary: 'This coop is extremely grant-oriented.',
          capitalFormation: 'Federal watershed restoration grants are the core signal.',
          impactReporting: 'We compile evidence packets for funding submissions.',
          governance: 'We only meet to approve funding moves.',
          knowledge: 'Grant intelligence should be captured immediately.',
        }),
      }).state;

      await Promise.all([
        saveCoopState(backgroundDb, strongAuthorizedCoop),
        saveCoopState(backgroundDb, weakAuthorizedCoop),
        saveCoopState(backgroundDb, unauthorizedCoop),
        setAuthSession(
          backgroundDb,
          makeAuthSession(authorizedAddress, sharedCreator.creator.displayName),
        ),
      ]);

      vi.mocked(chrome.scripting.executeScript).mockResolvedValue([
        {
          result: {
            title: 'Federal watershed restoration grant opportunity',
            metaDescription:
              'A high-signal funding brief covering watershed restoration grants and local resilience projects.',
            headings: ['Federal grant round-up', 'Restoration funding'],
            paragraphs: [
              'This page tracks watershed restoration grants, resilience funding, and application deadlines.',
              'River alliances can use the funding brief to coordinate next steps and proposal evidence.',
            ],
            previewImageUrl: undefined,
          },
        },
      ] as never);

      mockCompleteSkillOutput.mockImplementation(async ({ schemaRef }) => {
        if (schemaRef !== 'tab-router-output') {
          throw new Error(`Unexpected schema request: ${schemaRef}`);
        }
        const [extract] = await listPageExtracts(runtimeDb);
        if (!extract) {
          throw new Error('Expected a captured extract before routing.');
        }

        return {
          provider: 'transformers' as const,
          model: 'integration-test-model',
          durationMs: 5,
          output: {
            routings: [
              {
                sourceCandidateId: extract.sourceCandidateId,
                extractId: extract.id,
                coopId: unauthorizedCoop.profile.id,
                relevanceScore: 0.93,
                matchedRitualLenses: ['capital-formation'],
                category: 'funding-lead',
                tags: ['grant', 'federal', 'watershed'],
                rationale: 'This is the clearest federal grant match.',
                suggestedNextStep: 'Draft an immediate funding brief.',
                archiveWorthinessHint: true,
              },
              {
                sourceCandidateId: extract.sourceCandidateId,
                extractId: extract.id,
                coopId: strongAuthorizedCoop.profile.id,
                relevanceScore: 0.86,
                matchedRitualLenses: ['capital-formation'],
                category: 'funding-lead',
                tags: ['grant', 'watershed'],
                rationale: 'This is a strong match for local watershed funding work.',
                suggestedNextStep: 'Draft a coop-facing funding note.',
                archiveWorthinessHint: true,
              },
              {
                sourceCandidateId: extract.sourceCandidateId,
                extractId: extract.id,
                coopId: weakAuthorizedCoop.profile.id,
                relevanceScore: 0.31,
                matchedRitualLenses: ['governance-coordination'],
                category: 'next-step',
                tags: ['meeting'],
                rationale: 'It may matter later for governance follow-up.',
                suggestedNextStep: 'Keep this as routed context only.',
                archiveWorthinessHint: false,
              },
            ],
          },
        };
      });

      const captureResult = await runCaptureForTabs(
        [
          makeTab({
            id: 7,
            windowId: 3,
            url: 'https://funding.example.com/watershed?utm_source=newsletter',
            title: 'Funding round-up',
          }),
        ],
        { drainAgent: false },
      );

      expect(captureResult).toBe(1);

      await runAgentCycle({ force: true, reason: 'integration-routing' });

      const routings = await listTabRoutings(runtimeDb);
      const drafts = await listReviewDrafts(runtimeDb);

      expect(routings.map((routing) => routing.coopId).sort()).toEqual(
        [strongAuthorizedCoop.profile.id, weakAuthorizedCoop.profile.id].sort(),
      );
      expect(
        routings.find((routing) => routing.coopId === unauthorizedCoop.profile.id),
      ).toBeUndefined();
      expect(
        routings.find((routing) => routing.coopId === strongAuthorizedCoop.profile.id)?.status,
      ).toBe('drafted');
      expect(
        routings.find((routing) => routing.coopId === weakAuthorizedCoop.profile.id)?.status,
      ).toBe('routed');
      expect(drafts).toHaveLength(1);
      expect(drafts[0]?.suggestedTargetCoopIds).toEqual([strongAuthorizedCoop.profile.id]);
    },
    agentCycleTimeout,
  );

  it(
    'collapses near-duplicate captures into one extract and one routed draft',
    async () => {
      await resetCoopExtensionDb();
      const { backgroundDb, runAgentCycle, runCaptureForTabs, runtimeDb } =
        await loadAgentIntegrationModules();
      const created = createCoop({
        coopName: 'Watershed Funding Coop',
        purpose: 'Turn watershed funding research into actionable local opportunities.',
        creatorDisplayName: 'Ari',
        captureMode: 'manual',
        seedContribution: 'I collect grant leads and compare them for the coop.',
        setupInsights: buildSetupInsights({
          summary: 'This coop turns captured grant research into one actionable queue.',
          capitalFormation: 'We look for watershed restoration grants and deadlines.',
          impactReporting: 'We keep proposal evidence and reporting requirements visible.',
          governance: 'We review routed opportunities weekly.',
          knowledge: 'Research often arrives as duplicate tabs and print views.',
        }),
      });
      const coop = created.state;

      await Promise.all([
        saveCoopState(backgroundDb, coop),
        setAuthSession(
          backgroundDb,
          makeAuthSession(created.creator.address, created.creator.displayName),
        ),
      ]);

      vi.mocked(chrome.scripting.executeScript)
        .mockResolvedValueOnce([
          {
            result: {
              title: 'Watershed restoration grant roundup for 2026',
              metaDescription:
                'A funding brief covering watershed restoration grants, local match requirements, and proposal timing.',
              headings: ['Funding brief', 'Application timeline'],
              paragraphs: [
                'This grant roundup tracks watershed restoration funding deadlines, local match requirements, and proposal milestones for river alliances.',
                'Teams can use the brief to gather eligibility evidence, confirm deadlines, and coordinate the proposal packet before submission.',
                'Subscribe for updates and share this article with your network.',
              ],
              previewImageUrl: undefined,
            },
          },
        ] as never)
        .mockResolvedValueOnce([
          {
            result: {
              title: '2026 watershed restoration grant round-up',
              metaDescription:
                'Funding brief for watershed restoration collaboratives with local match guidance and submission timing.',
              headings: ['Application timeline', 'Funding brief'],
              paragraphs: [
                'River alliances can use this funding brief to gather eligibility evidence, confirm proposal timing, and prepare the submission packet.',
                'This watershed restoration grant roundup tracks funding deadlines and local match requirements for collaborative projects.',
                'Print this page or share it with a colleague.',
              ],
              previewImageUrl: undefined,
            },
          },
        ] as never);

      mockCompleteSkillOutput.mockImplementation(async ({ schemaRef }) => {
        if (schemaRef !== 'tab-router-output') {
          throw new Error(`Unexpected schema request: ${schemaRef}`);
        }
        const [extract] = await listPageExtracts(runtimeDb);
        if (!extract) {
          throw new Error('Expected a captured extract before routing.');
        }

        return {
          provider: 'transformers' as const,
          model: 'integration-test-model',
          durationMs: 5,
          output: {
            routings: [
              {
                sourceCandidateId: extract.sourceCandidateId,
                extractId: extract.id,
                coopId: coop.profile.id,
                relevanceScore: 0.87,
                matchedRitualLenses: ['capital-formation'],
                category: 'funding-lead',
                tags: ['grant', 'watershed'],
                rationale: 'This is a strong watershed funding opportunity for the coop.',
                suggestedNextStep: 'Draft a funding brief for weekly review.',
                archiveWorthinessHint: true,
              },
            ],
          },
        };
      });

      const captureResult = await runCaptureForTabs(
        [
          makeTab({
            id: 8,
            windowId: 3,
            url: 'https://funding.example.org/grants/watershed-roundup?utm_source=newsletter',
            title: 'Funding round-up',
          }),
          makeTab({
            id: 9,
            windowId: 3,
            url: 'https://funding.example.org/news/watershed-roundup-print',
            title: 'Print view',
          }),
        ],
        { drainAgent: false },
      );

      expect(captureResult).toBe(2);
      expect(await listPageExtracts(runtimeDb)).toHaveLength(1);

      const observations = await listAgentObservations(runtimeDb);
      const roundupObservation = observations.find(
        (observation) => observation.trigger === 'roundup-batch-ready',
      );
      expect(roundupObservation).toBeDefined();
      expect(roundupObservation?.payload.extractIds).toHaveLength(1);

      await runAgentCycle({ force: true, reason: 'integration-near-duplicate-dedupe' });

      const routings = await listTabRoutings(runtimeDb);
      const drafts = await listReviewDrafts(runtimeDb);

      expect(routings).toHaveLength(1);
      expect(drafts).toHaveLength(1);
      expect(drafts[0]?.suggestedTargetCoopIds).toEqual([coop.profile.id]);
    },
    agentCycleTimeout,
  );

  it('runs transcript inference end-to-end with prompt redaction and freshness-ordered memory context', async () => {
    await resetCoopExtensionDb();
    const { backgroundDb, captureAudio, runAgentCycle, runtimeDb } =
      await loadAgentIntegrationModules();
    const created = createCoop({
      coopName: 'River Grants Coop',
      purpose: 'Turn watershed grant intelligence into capital-formation briefs.',
      creatorDisplayName: 'Kai',
      captureMode: 'manual',
      seedContribution: 'I turn voice notes and tabs into funding-ready next steps.',
      setupInsights: buildSetupInsights({
        summary: 'This coop converts raw capture into fundable action.',
        capitalFormation: 'We work from grants, capital formation, and funding deadlines.',
        impactReporting: 'Evidence packets matter because grants demand proof.',
        governance: 'We assign owners during weekly review.',
        knowledge: 'Voice notes and tabs both feed shared memory.',
      }),
    });
    const coop = created.state;
    const member = created.creator;
    const coopId = coop.profile.id;

    await Promise.all([
      saveCoopState(backgroundDb, coop),
      setAuthSession(backgroundDb, makeAuthSession(member.address, member.displayName)),
    ]);

    await createAgentMemory(backgroundDb, {
      scope: 'member',
      memberId: member.id,
      coopId,
      type: 'decision-context',
      domain: 'funding',
      content: 'Stale member memory should appear after the fresh coop memory in prompts.',
      confidence: 0.64,
      createdAt: '2025-01-10T00:00:00.000Z',
    });
    await createAgentMemory(backgroundDb, {
      coopId,
      type: 'skill-pattern',
      domain: 'funding',
      content: 'Fresh coop memory says prioritize watershed resilience grants with local match.',
      confidence: 0.92,
      createdAt: '2026-03-26T12:00:00.000Z',
    });

    vi.spyOn(shared, 'isWhisperSupported').mockResolvedValue(true);
    vi.spyOn(shared, 'transcribeAudio').mockResolvedValue({
      text: 'Email maya@example.org or call 415-555-1212 about the watershed grant. Submit at https://grants.example.org/apply?access_token=super-secret&utm_source=mail and confirm the local match requirement this week.',
      segments: [
        {
          start: 0,
          end: 12,
          text: 'Email maya@example.org or call 415-555-1212 about the watershed grant.',
          confidence: 0.99,
        },
        {
          start: 12,
          end: 24,
          text: 'Submit at https://grants.example.org/apply?access_token=super-secret&utm_source=mail and confirm the local match requirement this week.',
          confidence: 0.98,
        },
      ],
      duration: 24,
      language: 'en',
      modelId: 'whisper-test',
    });

    const promptsBySchema = new Map<string, string[]>();
    mockCompleteSkillOutput.mockImplementation(async ({ schemaRef, prompt }) => {
      promptsBySchema.set(schemaRef, [...(promptsBySchema.get(schemaRef) ?? []), prompt]);

      switch (schemaRef) {
        case 'opportunity-extractor-output':
          return {
            provider: 'transformers' as const,
            model: 'integration-test-model',
            durationMs: 7,
            output: {
              candidates: [
                {
                  id: 'opportunity-1',
                  title: 'Watershed resilience grant lead',
                  summary:
                    'A concrete watershed grant opportunity with a local match requirement and clear next steps.',
                  rationale:
                    'The transcript names a watershed grant, a submission path, and a local match requirement that the coop can act on quickly.',
                  regionTags: ['watershed'],
                  ecologyTags: ['restoration'],
                  fundingSignals: ['grant', 'local match'],
                  priority: 0.88,
                  recommendedNextStep: 'Confirm eligibility and gather the match evidence packet.',
                },
              ],
            },
          };
        case 'grant-fit-scorer-output':
          return {
            provider: 'transformers' as const,
            model: 'integration-test-model',
            durationMs: 5,
            output: {
              scores: [
                {
                  candidateId: 'opportunity-1',
                  candidateTitle: 'Watershed resilience grant lead',
                  score: 0.91,
                  reasons: [
                    'Matches watershed grant priorities.',
                    'Supports local capital-formation work.',
                    'Includes a concrete local match requirement.',
                  ],
                  recommendedTargetCoopId: coopId,
                },
              ],
            },
          };
        case 'capital-formation-brief-output':
          return {
            provider: 'webllm' as const,
            model: 'integration-test-model',
            durationMs: 11,
            output: {
              title: 'Watershed resilience grant brief',
              summary:
                'The transcript points to a specific watershed grant, names a submission path, and surfaces the local match requirement the coop must verify before moving.',
              whyItMatters:
                'This is a timely capital-formation lead because it connects a real grant pathway to the coop’s watershed work and highlights the evidence needed to qualify.',
              suggestedNextStep:
                'Confirm eligibility, verify the local match, and assign an owner to assemble the supporting materials this week.',
              tags: ['grant', 'watershed', 'resilience'],
              targetCoopIds: [coopId],
              supportingCandidateIds: ['opportunity-1'],
            },
          };
        case 'ecosystem-entity-extractor-output':
          return {
            provider: 'transformers' as const,
            model: 'integration-test-model',
            durationMs: 4,
            output: {
              entities: [],
            },
          };
        default:
          throw new Error(`Unexpected schema request: ${schemaRef}`);
      }
    });

    await captureAudio({
      dataBase64: btoa('audio-data'),
      mimeType: 'audio/webm',
      durationSeconds: 24,
      fileName: 'watershed-note.webm',
    });

    await vi.waitFor(
      async () => {
        const observations = await listAgentObservations(runtimeDb, 20);
        expect(
          observations.some((observation) => observation.trigger === 'audio-transcript-ready'),
        ).toBe(true);
      },
      { timeout: agentCycleTimeout },
    );

    await runAgentCycle({ force: true, reason: 'integration-transcript' });

    const captures = await listReceiverCaptures(runtimeDb);
    const drafts = await listReviewDrafts(runtimeDb);
    const opportunityPrompt = promptsBySchema.get('opportunity-extractor-output')?.[0] ?? '';

    expect(captures).toHaveLength(1);
    expect(
      drafts.some(
        (draft) =>
          draft.provenance.type === 'agent' &&
          draft.provenance.skillId === 'capital-formation-brief' &&
          draft.suggestedTargetCoopIds.includes(coopId),
      ),
    ).toBe(true);
    expect(opportunityPrompt).toContain('[redacted-email]');
    expect(opportunityPrompt).toContain('[redacted-phone]');
    expect(opportunityPrompt).toContain('https://grants.example.org/apply');
    expect(opportunityPrompt).not.toContain('maya@example.org');
    expect(opportunityPrompt).not.toContain('415-555-1212');
    expect(opportunityPrompt).not.toContain('access_token=super-secret');
    expect(opportunityPrompt).not.toContain('utm_source=mail');
    expect(opportunityPrompt.indexOf('Fresh coop memory says prioritize')).toBeGreaterThanOrEqual(
      0,
    );
    expect(
      opportunityPrompt.indexOf('Stale member memory should appear after'),
    ).toBeGreaterThanOrEqual(0);
    expect(opportunityPrompt.indexOf('Fresh coop memory says prioritize')).toBeLessThan(
      opportunityPrompt.indexOf('Stale member memory should appear after'),
    );
  });
});

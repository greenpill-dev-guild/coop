import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { Artifact, ReviewDraft, TabCandidate } from '@coop/shared';
import type {
  AgentDashboardResponse,
  DashboardResponse,
  ProactiveSignal,
} from '../../../../runtime/messages';
import type { useDraftEditor } from '../../hooks/useDraftEditor';
import type { useTabCapture } from '../../hooks/useTabCapture';
import { ChickensTab, type ChickensTabProps } from '../ChickensTab';

vi.mock('../../cards', () => ({
  SkeletonCards: ({ label }: { label: string }) => <div data-testid="skeleton-cards">{label}</div>,
}));

function makeCandidate(overrides: Partial<TabCandidate> = {}): TabCandidate {
  return {
    id: 'candidate-1',
    tabId: 1,
    windowId: 1,
    url: 'https://news.example/river',
    canonicalUrl: 'https://news.example/river',
    title: 'River candidate',
    domain: 'news.example',
    tabGroupHint: 'news.example',
    capturedAt: '2026-03-01T09:00:00.000Z',
    ...overrides,
  } as TabCandidate;
}

function makeDraft(overrides: Partial<ReviewDraft> = {}): ReviewDraft {
  return {
    id: 'draft-1',
    title: 'Restore wetland corridor',
    summary: 'Draft summary',
    category: 'insight',
    tags: ['water'],
    whyItMatters: 'Shared habitat restoration opportunity',
    suggestedNextStep: 'Review and publish',
    sources: [],
    createdAt: '2026-03-01T10:00:00.000Z',
    updatedAt: '2026-03-01T10:00:00.000Z',
    workflowStage: 'candidate',
    targetCoopIds: [],
    suggestedTargetCoopIds: [],
    archiveWorthiness: 'not-flagged',
    rationale: '',
    provenance: { type: 'agent' },
    ...overrides,
  } as unknown as ReviewDraft;
}

function makeArtifact(overrides: Partial<Artifact> = {}): Artifact {
  return {
    id: 'artifact-1',
    targetCoopId: 'coop-1',
    title: 'Shared watershed plan',
    summary: 'Shared summary',
    category: 'insight',
    tags: ['water'],
    whyItMatters: 'Matters because coordination is needed',
    suggestedNextStep: 'Review the shared plan',
    sources: [{ url: 'https://coop.example/plan', domain: 'coop.example' }],
    attachments: [],
    createdAt: '2026-03-01T11:00:00.000Z',
    ...overrides,
  } as unknown as Artifact;
}

function makeSignal(overrides: Partial<ProactiveSignal> = {}): ProactiveSignal {
  return {
    id: 'signal-1',
    sourceCandidateId: 'candidate-1',
    extractId: 'extract-1',
    title: 'River restoration signal',
    url: 'https://news.example/river',
    domain: 'news.example',
    category: 'insight',
    tags: ['water'],
    archiveWorthinessHint: false,
    draftId: 'draft-1',
    topRelevanceScore: 0.82,
    targetCoops: [
      {
        coopId: 'coop-1',
        coopName: 'Alpha Coop',
        relevanceScore: 0.82,
        rationale: 'Matches the coop restoration focus.',
        suggestedNextStep: 'Review the linked draft.',
        matchedRitualLenses: ['knowledge-garden-resources'],
      },
    ],
    support: [
      {
        id: 'support-1',
        kind: 'memory',
        title: 'Earlier note',
        detail: 'Previous memory supports this route.',
      },
    ],
    updatedAt: '2026-03-01T12:00:00.000Z',
    ...overrides,
  } as ProactiveSignal;
}

function buildDashboard(overrides: Partial<DashboardResponse> = {}): DashboardResponse {
  return {
    activeCoopId: 'coop-1',
    candidates: [makeCandidate()],
    coops: [
      {
        profile: {
          id: 'coop-1',
          name: 'Alpha Coop',
        },
        artifacts: [makeArtifact()],
      },
    ],
    drafts: [],
    tabRoutings: [],
    proactiveSignals: [makeSignal()],
    runtimeConfig: {
      chainKey: 'sepolia',
      onchainMode: 'mock',
      archiveMode: 'mock',
      sessionMode: 'off',
      privacyMode: 'off',
      providerMode: 'rpc',
      receiverAppUrl: 'https://receiver.test',
      signalingUrls: ['wss://api.coop.town'],
      websocketSyncUrl: 'wss://api.coop.town/yws',
    },
    summary: {
      iconState: 'ready',
      iconLabel: 'Coop',
      pendingDrafts: 1,
      routedTabs: 1,
      insightDrafts: 1,
      pendingActions: 0,
      staleObservationCount: 1,
      pendingAttentionCount: 2,
      coopCount: 1,
      syncState: 'idle',
      syncLabel: 'Idle',
      syncDetail: 'Idle',
      syncTone: 'ok',
      captureMode: 'manual',
      agentCadenceMinutes: 64,
      localEnhancement: 'ready',
      localInferenceOptIn: true,
      pendingOutboxCount: 0,
    },
    ...overrides,
  } as DashboardResponse;
}

function buildAgentDashboard(
  overrides: Partial<AgentDashboardResponse> = {},
): AgentDashboardResponse {
  return {
    observations: [
      {
        id: 'observation-1',
        title: 'Older observation',
        summary: 'Needs attention',
        trigger: 'roundup',
        status: 'pending',
        createdAt: '2026-02-01T08:00:00.000Z',
        draftId: 'draft-1',
      },
      {
        id: 'observation-2',
        title: 'Newer observation',
        summary: 'Still pending',
        trigger: 'roundup',
        status: 'pending',
        createdAt: '2026-02-02T08:00:00.000Z',
        draftId: 'draft-2',
      },
    ],
    plans: [],
    skillRuns: [],
    manifests: [],
    autoRunSkillIds: [],
    memories: [],
    ...overrides,
  } as AgentDashboardResponse;
}

function buildTabCapture(): ReturnType<typeof useTabCapture> {
  return {
    runManualCapture: vi.fn(),
    runActiveTabCapture: vi.fn(),
    captureVisibleScreenshotAction: vi.fn(),
    requestRoundupAccess: vi.fn(),
    requestingRoundupAccess: false,
    roundupAccessStatus: 'granted',
  } as unknown as ReturnType<typeof useTabCapture>;
}

function buildDraftEditor(): ReturnType<typeof useDraftEditor> {
  return {
    draftValue: vi.fn(),
    updateDraft: vi.fn(),
    toggleDraftTargetCoop: vi.fn(),
    saveDraft: vi.fn(),
    publishDraft: vi.fn(),
    refineDraft: vi.fn(),
    refineResults: {},
    refiningDrafts: new Set<string>(),
    applyRefineResult: vi.fn(),
    dismissRefineResult: vi.fn(),
    toggleDraftArchiveWorthiness: vi.fn(),
    changeDraftWorkflowStage: vi.fn(),
    anonymousPublish: false,
    setAnonymousPublish: vi.fn(),
    convertReceiverCapture: vi.fn(),
    archiveReceiverCapture: vi.fn(),
    toggleReceiverCaptureArchiveWorthiness: vi.fn(),
    promoteSignalToDraft: vi.fn(),
    promoteSignalAndPublish: vi.fn(),
  } as unknown as ReturnType<typeof useDraftEditor>;
}

function buildProps(overrides: Partial<ChickensTabProps> = {}): ChickensTabProps {
  return {
    dashboard: buildDashboard(),
    agentDashboard: buildAgentDashboard(),
    visibleDrafts: [makeDraft()],
    draftEditor: buildDraftEditor(),
    inferenceState: null,
    runtimeConfig: buildDashboard().runtimeConfig,
    tabCapture: buildTabCapture(),
    synthesisSegment: 'review',
    onSelectSynthesisSegment: vi.fn(),
    ...overrides,
  };
}

describe('ChickensTab interactions', () => {
  it('renders the loading skeleton when the dashboard has not loaded yet', () => {
    render(<ChickensTab {...buildProps({ dashboard: null })} />);

    expect(screen.getByTestId('skeleton-cards')).toHaveTextContent('Loading chickens');
  });

  it('switches between review and shared segments', async () => {
    const user = userEvent.setup();
    const onSelectSynthesisSegment = vi.fn();

    render(
      <ChickensTab
        {...buildProps({
          onSelectSynthesisSegment,
        })}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Shared' }));

    expect(onSelectSynthesisSegment).toHaveBeenCalledWith('shared');
  });

  it('shows the passive roundup access prompt and lets the user dismiss it', async () => {
    const user = userEvent.setup();
    const onDismissRoundupAccessPrompt = vi.fn();

    render(
      <ChickensTab
        {...buildProps({
          roundupAccessPromptMode: 'passive',
          onDismissRoundupAccessPrompt,
        })}
      />,
    );

    expect(screen.getByText('Enable roundup site access')).toBeInTheDocument();
    expect(
      screen.getByText(
        /Coop only needs this permission to inspect your open tabs locally when you ask it to round up chickens\./i,
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Not now' }));

    expect(onDismissRoundupAccessPrompt).toHaveBeenCalledTimes(1);
  });

  it('requests permission and runs roundup from the explicit popup follow-up flow', async () => {
    const user = userEvent.setup();
    const tabCapture = buildTabCapture();

    render(
      <ChickensTab
        {...buildProps({
          tabCapture,
          roundupAccessPromptMode: 'grant-and-roundup',
        })}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Enable access and round up' }));

    expect(tabCapture.requestRoundupAccess).toHaveBeenCalledWith({
      runRoundupAfterGrant: true,
    });
  });

  it('shows shared artifacts when the shared segment is active', () => {
    render(
      <ChickensTab
        {...buildProps({
          synthesisSegment: 'shared',
        })}
      />,
    );

    expect(screen.getByText('Shared watershed plan')).toBeInTheDocument();
  });

  it('merges signal+draft pairs into a single card when signal has a linked draftId', () => {
    render(<ChickensTab {...buildProps()} />);

    // Signal draftId matches draft id — merged into one card using draft title
    expect(screen.getByText('Restore wetland corridor')).toBeInTheDocument();
    // Signal title should NOT appear as a separate card
    expect(screen.queryByText('River restoration signal')).not.toBeInTheDocument();
  });

  it('shows orphan signals as separate reviewable cards', () => {
    render(
      <ChickensTab
        {...buildProps({
          dashboard: buildDashboard({
            proactiveSignals: [
              makeSignal({ id: 'orphan-1', draftId: undefined, title: 'Orphan signal' }),
            ],
          }),
          visibleDrafts: [makeDraft()],
        })}
      />,
    );

    // Orphan signal renders its own card
    expect(screen.getByText('Orphan signal')).toBeInTheDocument();
    // Draft still renders separately
    expect(screen.getByText('Restore wetland corridor')).toBeInTheDocument();
  });

  it('filters review items by category and clears the filter', async () => {
    const user = userEvent.setup();

    render(
      <ChickensTab
        {...buildProps({
          visibleDrafts: [
            makeDraft({ id: 'draft-insight', category: 'insight', title: 'Insight draft' }),
            makeDraft({
              id: 'draft-opportunity',
              category: 'opportunity',
              title: 'Opportunity draft',
            }),
          ],
          dashboard: buildDashboard({ proactiveSignals: [] }),
        })}
      />,
    );

    // Open the category filter and select opportunity
    await user.click(screen.getByRole('button', { name: /category/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Opportunity' }));

    expect(screen.getByText('Opportunity draft')).toBeInTheDocument();
    expect(screen.queryByText('Insight draft')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument();

    // Clear the filter
    await user.click(screen.getByRole('button', { name: /clear/i }));

    expect(screen.getByText('Insight draft')).toBeInTheDocument();
    expect(screen.getByText('Opportunity draft')).toBeInTheDocument();
  });

  it('highlights a merged card when focused by signal ID', () => {
    render(
      <ChickensTab
        {...buildProps({
          focusedSignalId: 'signal-1',
        })}
      />,
    );

    // Merged card carries both signal and draft; focused via signal ID shows draft title
    const focusedCard = document.querySelector('[data-focused]');
    expect(focusedCard).not.toBeNull();
    expect(focusedCard?.textContent).toContain('Restore wetland corridor');
  });

  it('shows the empty state when there are no review items', () => {
    render(
      <ChickensTab
        {...buildProps({
          dashboard: buildDashboard({ proactiveSignals: [] }),
          visibleDrafts: [],
          agentDashboard: buildAgentDashboard({ observations: [] }),
        })}
      />,
    );

    expect(screen.getByText(/round up your loose chickens/i)).toBeInTheDocument();
  });

  it('shows the empty state when there are no shared artifacts', () => {
    render(
      <ChickensTab
        {...buildProps({
          synthesisSegment: 'shared',
          dashboard: buildDashboard({ coops: [] }),
        })}
      />,
    );

    expect(screen.getByText(/nothing shared yet/i)).toBeInTheDocument();
  });

  it('groups orientation artifacts into a single summary card in the shared segment', () => {
    render(
      <ChickensTab
        {...buildProps({
          synthesisSegment: 'shared',
          dashboard: buildDashboard({
            coops: [
              {
                profile: { id: 'coop-1', name: 'Alpha Coop' },
                artifacts: [
                  makeArtifact({
                    id: 'soul-1',
                    title: 'Coop Soul',
                    category: 'coop-soul',
                    summary: 'Restoring watersheds together',
                  }),
                  makeArtifact({
                    id: 'setup-1',
                    title: 'Setup Insights',
                    category: 'setup-insight',
                  }),
                  makeArtifact({ id: 'ritual-1', title: 'Rituals', category: 'ritual' }),
                  makeArtifact({
                    id: 'seed-1',
                    title: "Ana's Seed Contribution",
                    category: 'seed-contribution',
                  }),
                  makeArtifact({
                    id: 'real-1',
                    title: 'River restoration plan',
                    category: 'insight',
                  }),
                ],
              },
            ],
          }),
        })}
      />,
    );

    // Orientation summary card renders with soul text
    expect(screen.getByText('Coop orientation')).toBeInTheDocument();
    expect(screen.getByText('Restoring watersheds together')).toBeInTheDocument();

    // Orientation item titles listed compactly
    expect(screen.getByText('Setup Insights')).toBeInTheDocument();
    expect(screen.getByText('Rituals')).toBeInTheDocument();

    // Real artifact still renders as a separate card
    expect(screen.getByText('River restoration plan')).toBeInTheDocument();
  });

  it('collapses time groups with more than 3 items behind a show-more toggle', async () => {
    const user = userEvent.setup();

    render(
      <ChickensTab
        {...buildProps({
          dashboard: buildDashboard({ proactiveSignals: [] }),
          visibleDrafts: [
            makeDraft({ id: 'd1', title: 'Draft one', createdAt: '2026-03-31T10:00:00.000Z' }),
            makeDraft({ id: 'd2', title: 'Draft two', createdAt: '2026-03-31T10:01:00.000Z' }),
            makeDraft({ id: 'd3', title: 'Draft three', createdAt: '2026-03-31T10:02:00.000Z' }),
            makeDraft({ id: 'd4', title: 'Draft four', createdAt: '2026-03-31T10:03:00.000Z' }),
            makeDraft({ id: 'd5', title: 'Draft five', createdAt: '2026-03-31T10:04:00.000Z' }),
          ],
          agentDashboard: buildAgentDashboard({ observations: [] }),
        })}
      />,
    );

    // First 3 visible, last 2 hidden
    expect(screen.getByText('Draft five')).toBeInTheDocument();
    expect(screen.getByText('Draft four')).toBeInTheDocument();
    expect(screen.getByText('Draft three')).toBeInTheDocument();
    expect(screen.queryByText('Draft two')).not.toBeInTheDocument();
    expect(screen.queryByText('Draft one')).not.toBeInTheDocument();

    // Overflow toggle is visible
    const toggle = screen.getByRole('button', { name: /show 2 more/i });
    expect(toggle).toBeInTheDocument();

    // Expand
    await user.click(toggle);

    expect(screen.getByText('Draft two')).toBeInTheDocument();
    expect(screen.getByText('Draft one')).toBeInTheDocument();
  });

  it('shows subtle surface tags on the card and full tags in details', async () => {
    const user = userEvent.setup();

    render(<ChickensTab {...buildProps()} />);

    // Surface tags are visible on the card (outside details)
    const surfaceTags = document.querySelectorAll('.compact-card__surface-tag');
    expect(surfaceTags.length).toBeGreaterThan(0);
    for (const tag of surfaceTags) {
      const details = tag.closest('details');
      expect(details).toBeNull(); // surface tags are NOT inside <details>
    }

    // Detail tags are inside <details> (collapsed by default)
    const detailTags = document.querySelectorAll('.compact-card__tag');
    for (const tag of detailTags) {
      const details = tag.closest('details');
      expect(details).not.toBeNull();
    }

    // Open details and tags appear
    const summaries = screen.getAllByText('Details');
    await user.click(summaries[0]);

    const visibleTag = document.querySelector('details[open] .compact-card__tag');
    expect(visibleTag).not.toBeNull();
  });

  it('renders push controls on orphan signals via promoteSignalAndPublish', async () => {
    const user = userEvent.setup();
    const draftEditor = buildDraftEditor();

    render(
      <ChickensTab
        {...buildProps({
          draftEditor,
          dashboard: buildDashboard({
            proactiveSignals: [
              makeSignal({ id: 'orphan-1', draftId: undefined, title: 'Orphan signal' }),
            ],
          }),
          visibleDrafts: [],
          agentDashboard: buildAgentDashboard({ observations: [] }),
        })}
      />,
    );

    // Orphan signal should have a push button
    const pushBtn = screen.getByRole('button', { name: /push to alpha coop/i });
    expect(pushBtn).toBeInTheDocument();

    await user.click(pushBtn);

    expect(draftEditor.promoteSignalAndPublish).toHaveBeenCalledTimes(1);
  });

  it('renders push controls on merged signal+draft cards via publishDraft', async () => {
    const user = userEvent.setup();
    const draftEditor = buildDraftEditor();

    render(
      <ChickensTab
        {...buildProps({
          draftEditor,
          agentDashboard: buildAgentDashboard({ observations: [] }),
        })}
      />,
    );

    // Merged card should have a push button
    const pushBtn = screen.getByRole('button', { name: /push to alpha coop/i });
    expect(pushBtn).toBeInTheDocument();

    await user.click(pushBtn);

    expect(draftEditor.publishDraft).toHaveBeenCalledTimes(1);
  });
});

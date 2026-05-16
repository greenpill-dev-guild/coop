import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * ChickensTab subheader structure (post-simplification):
 * - Two segment tabs: "Review" and "Shared" via PopupSubheader
 * - Category filter popover (only shown on the Review segment when categories exist)
 * - Clear button when a filter is active
 * - No action buttons (Round Up, Capture Tab, Screenshot)
 * - No Status or Time filter popovers
 * - Uses SidepanelSubheader sticky wrapper
 */

import type { ReviewDraft } from '@coop/shared';
import type { AgentDashboardResponse, DashboardResponse } from '../../../../runtime/messages';
import type { useDraftEditor } from '../../hooks/useDraftEditor';
import type { useTabCapture } from '../../hooks/useTabCapture';
import { ChickensTab, type ChickensTabProps } from '../ChickensTab';

function buildDashboard(overrides: Partial<DashboardResponse> = {}): DashboardResponse {
  return {
    candidates: [],
    coops: [],
    drafts: [],
    tabRoutings: [],
    proactiveSignals: [],
    activeReviewItemFeedbacks: [],
    runtimeConfig: {
      chainKey: 'sepolia',
      onchainMode: 'mock',
      archiveMode: 'mock',
      sessionMode: 'off',
      privacyMode: 'off',
      providerMode: 'standard',
      receiverAppUrl: 'http://localhost:3000',
      signalingUrls: [],
    },
    summary: {
      iconState: 'ready',
      iconLabel: 'Coop',
      pendingDrafts: 0,
      routedTabs: 0,
      insightDrafts: 0,
      pendingActions: 0,
      staleObservationCount: 0,
      pendingAttentionCount: 0,
      coopCount: 0,
      syncState: 'idle',
      syncLabel: 'Idle',
      syncDetail: 'Idle',
      syncTone: 'ok',
      captureMode: 'manual',
      agentCadenceMinutes: 64,
      localEnhancement: 'none',
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
    observations: [],
    plans: [],
    skillRuns: [],
    manifests: [],
    autoRunSkillIds: [],
    memories: [],
    ...overrides,
  };
}

function buildTabCapture(): ReturnType<typeof useTabCapture> {
  return {
    runManualCapture: vi.fn(),
    runActiveTabCapture: vi.fn(),
    captureVisibleScreenshotAction: vi.fn(),
  } as unknown as ReturnType<typeof useTabCapture>;
}

function buildDraftEditor(): ReturnType<typeof useDraftEditor> {
  return {
    draftValue: vi.fn().mockReturnValue({
      title: '',
      summary: '',
      category: 'insight',
      tags: [],
      whyItMatters: '',
      suggestedNextStep: '',
      sources: [],
      workflowStage: 'candidate',
      provenance: { type: 'tab' },
      suggestedTargetCoopIds: [],
      rationale: '',
      archiveWorthiness: 'not-flagged',
    }),
    updateDraft: vi.fn(),
    toggleDraftTargetCoop: vi.fn(),
    saveDraft: vi.fn(),
    publishDraft: vi.fn(),
    refineDraft: vi.fn(),
    refineResults: {},
    refiningDrafts: new Set(),
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
    recordReviewFeedback: vi.fn(),
  } as unknown as ReturnType<typeof useDraftEditor>;
}

function buildProps(overrides: Partial<ChickensTabProps> = {}): ChickensTabProps {
  return {
    dashboard: buildDashboard(),
    agentDashboard: buildAgentDashboard(),
    visibleDrafts: [],
    draftEditor: buildDraftEditor(),
    inferenceState: null,
    runtimeConfig: buildDashboard().runtimeConfig,
    tabCapture: buildTabCapture(),
    synthesisSegment: 'review',
    onSelectSynthesisSegment: vi.fn(),
    uiMode: 'advanced',
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ChickensTab subheader (review/shared segments)', () => {
  it('renders Review and Shared segment tabs in the subheader', () => {
    render(<ChickensTab {...buildProps()} />);

    expect(screen.getByRole('button', { name: 'Review' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Shared' })).toBeInTheDocument();
  });

  it('wraps content in a sticky sidepanel-subheader', () => {
    render(<ChickensTab {...buildProps()} />);

    const wrapper = document.querySelector('.sidepanel-subheader');
    expect(wrapper).not.toBeNull();
    expect(wrapper?.querySelector('.sidepanel-action-row')).not.toBeNull();
  });

  it('does not render action buttons (Round Up, Capture Tab, Screenshot)', () => {
    render(<ChickensTab {...buildProps()} />);

    expect(screen.queryByLabelText('Round Up')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Capture Tab')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Screenshot')).not.toBeInTheDocument();
  });

  it('does not render Status or Time filter buttons', () => {
    render(<ChickensTab {...buildProps()} />);

    expect(screen.queryByRole('button', { name: /status/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /time/i })).not.toBeInTheDocument();
  });

  it('shows the category filter when drafts have multiple categories', () => {
    render(
      <ChickensTab
        {...buildProps({
          visibleDrafts: [
            {
              id: 'draft-1',
              category: 'insight',
              title: 'Insight item',
              tags: [],
              whyItMatters: '',
              suggestedNextStep: '',
              sources: [],
              createdAt: new Date().toISOString(),
              suggestedTargetCoopIds: [],
            } as unknown as ReviewDraft,
            {
              id: 'draft-2',
              category: 'opportunity',
              title: 'Opportunity item',
              tags: [],
              whyItMatters: '',
              suggestedNextStep: '',
              sources: [],
              createdAt: new Date().toISOString(),
              suggestedTargetCoopIds: [],
            } as unknown as ReviewDraft,
          ],
        })}
      />,
    );

    expect(screen.getByRole('button', { name: /category/i })).toBeInTheDocument();
  });

  it('hides the category filter in simple mode', () => {
    render(
      <ChickensTab
        {...buildProps({
          uiMode: 'simple',
          visibleDrafts: [
            {
              id: 'draft-1',
              category: 'insight',
              title: 'Insight item',
              tags: [],
              whyItMatters: '',
              suggestedNextStep: '',
              sources: [],
              createdAt: new Date().toISOString(),
              suggestedTargetCoopIds: [],
            } as unknown as ReviewDraft,
            {
              id: 'draft-2',
              category: 'opportunity',
              title: 'Opportunity item',
              tags: [],
              whyItMatters: '',
              suggestedNextStep: '',
              sources: [],
              createdAt: new Date().toISOString(),
              suggestedTargetCoopIds: [],
            } as unknown as ReviewDraft,
          ],
        })}
      />,
    );

    expect(screen.queryByRole('button', { name: /category/i })).not.toBeInTheDocument();
  });

  it('hides the category filter on the shared segment', () => {
    render(
      <ChickensTab
        {...buildProps({
          synthesisSegment: 'shared',
          visibleDrafts: [
            {
              id: 'draft-1',
              category: 'insight',
              title: 'Insight item',
              tags: [],
              whyItMatters: '',
              suggestedNextStep: '',
              sources: [],
              createdAt: new Date().toISOString(),
              suggestedTargetCoopIds: [],
            } as unknown as ReviewDraft,
            {
              id: 'draft-2',
              category: 'opportunity',
              title: 'Opportunity item',
              tags: [],
              whyItMatters: '',
              suggestedNextStep: '',
              sources: [],
              createdAt: new Date().toISOString(),
              suggestedTargetCoopIds: [],
            } as unknown as ReviewDraft,
          ],
        })}
      />,
    );

    expect(screen.queryByRole('button', { name: /category/i })).not.toBeInTheDocument();
  });

  it('shows a clear button when a category filter is applied', async () => {
    const user = userEvent.setup();

    render(
      <ChickensTab
        {...buildProps({
          visibleDrafts: [
            {
              id: 'draft-1',
              category: 'insight',
              title: 'Insight item',
              tags: [],
              whyItMatters: '',
              suggestedNextStep: '',
              sources: [],
              createdAt: new Date().toISOString(),
              suggestedTargetCoopIds: [],
            } as unknown as ReviewDraft,
            {
              id: 'draft-2',
              category: 'opportunity',
              title: 'Opportunity item',
              tags: [],
              whyItMatters: '',
              suggestedNextStep: '',
              sources: [],
              createdAt: new Date().toISOString(),
              suggestedTargetCoopIds: [],
            } as unknown as ReviewDraft,
          ],
          dashboard: buildDashboard({ proactiveSignals: [] }),
        })}
      />,
    );

    await user.click(screen.getByRole('button', { name: /category/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Insight' }));

    expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument();
  });

  it('renders review items with compact cards showing signals', () => {
    render(
      <ChickensTab
        {...buildProps({
          dashboard: buildDashboard({
            proactiveSignals: [
              {
                id: 'signal-1',
                sourceCandidateId: 'candidate-1',
                extractId: 'extract-1',
                title: 'River signal',
                url: 'https://example.com/river',
                domain: 'example.com',
                category: 'insight',
                tags: ['water'],
                archiveWorthinessHint: false,
                draftId: 'draft-1',
                topRelevanceScore: 0.82,
                targetCoops: [
                  {
                    coopId: 'coop-1',
                    coopName: 'Starter Coop',
                    relevanceScore: 0.82,
                    rationale: 'Matches current watershed priorities.',
                    suggestedNextStep: 'Review and merge context.',
                    matchedRitualLenses: ['knowledge-garden-resources'],
                  },
                ],
                support: [
                  {
                    id: 'memory-1',
                    kind: 'memory',
                    title: 'Memory from Starter Coop',
                    detail: 'Earlier work connected this topic to wetlands restoration.',
                  },
                ],
                updatedAt: new Date().toISOString(),
              },
            ],
          }),
        })}
      />,
    );

    expect(screen.getByText('River signal')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Review' })).toBeInTheDocument();
  });
});

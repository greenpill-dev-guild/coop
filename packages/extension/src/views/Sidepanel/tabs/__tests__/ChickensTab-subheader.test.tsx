import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * ChickensTab subheader regression fix:
 * - Action buttons use popup-icon-button class + Tooltip wrapping inside sidepanel-action-row
 * - Round Up gets popup-icon-button--primary
 * - Filter popovers rendered inline in the same action row
 * - Uses SidepanelSubheader sticky wrapper
 */

import type { ReviewDraft } from '@coop/shared';
import type { InferenceBridgeState } from '../../../../runtime/inference-bridge';
import type { DashboardResponse } from '../../../../runtime/messages';
import type { useDraftEditor } from '../../hooks/useDraftEditor';
import type { useTabCapture } from '../../hooks/useTabCapture';
import { ChickensTab, type ChickensTabProps } from '../ChickensTab';

function buildDashboard(overrides: Partial<DashboardResponse> = {}): DashboardResponse {
  return {
    candidates: [],
    coops: [],
    runtimeConfig: {
      captureMode: 'manual',
      onchainMode: 'mock',
      archiveMode: 'mock',
      sessionMode: 'off',
      privacyMode: 'off',
      providerMode: 'standard',
      fvmChain: 'filecoin-calibration',
      localEnhancement: 'off',
    },
    ...overrides,
  } as DashboardResponse;
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
  } as unknown as ReturnType<typeof useDraftEditor>;
}

function buildProps(overrides: Partial<ChickensTabProps> = {}): ChickensTabProps {
  return {
    dashboard: buildDashboard(),
    visibleDrafts: [],
    draftEditor: buildDraftEditor(),
    inferenceState: null,
    runtimeConfig: buildDashboard().runtimeConfig,
    tabCapture: buildTabCapture(),
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ChickensTab subheader regression (popup-icon-button)', () => {
  it('renders Round Up as popup-icon-button--primary inside sidepanel-action-row', () => {
    render(<ChickensTab {...buildProps()} />);

    const actionRow = document.querySelector('.sidepanel-action-row');
    expect(actionRow).not.toBeNull();

    const roundUpBtn = screen.getByLabelText('Round Up');
    expect(roundUpBtn.classList.contains('popup-icon-button')).toBe(true);
    expect(roundUpBtn.classList.contains('popup-icon-button--primary')).toBe(true);
  });

  it('renders Capture Tab and Screenshot as default popup-icon-button', () => {
    render(<ChickensTab {...buildProps()} />);

    const captureBtn = screen.getByLabelText('Capture Tab');
    expect(captureBtn.classList.contains('popup-icon-button')).toBe(true);
    expect(captureBtn.classList.contains('popup-icon-button--primary')).toBe(false);

    const screenshotBtn = screen.getByLabelText('Screenshot');
    expect(screenshotBtn.classList.contains('popup-icon-button')).toBe(true);
    expect(screenshotBtn.classList.contains('popup-icon-button--primary')).toBe(false);
  });

  it('renders filter popovers inline in the action row', () => {
    render(<ChickensTab {...buildProps()} />);

    const actionRow = document.querySelector('.sidepanel-action-row');
    expect(actionRow).not.toBeNull();

    // Status and Time filter buttons should be present
    expect(screen.getByRole('button', { name: /status/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /time/i })).toBeInTheDocument();
  });

  it('wraps action row in a sticky sidepanel-subheader', () => {
    render(<ChickensTab {...buildProps()} />);

    const wrapper = document.querySelector('.sidepanel-subheader');
    expect(wrapper).not.toBeNull();
    expect(wrapper?.querySelector('.sidepanel-action-row')).not.toBeNull();
    // Old BEM sub-element classes remain absent
    expect(document.querySelector('.sidepanel-subheader__action')).toBeNull();
    expect(document.querySelector('.sidepanel-subheader__actions')).toBeNull();
  });

  it('renders all three action buttons as icon-only with aria-label', () => {
    render(<ChickensTab {...buildProps()} />);

    const actionButtons = document.querySelectorAll('.popup-icon-button');
    expect(actionButtons.length).toBe(3);
    for (const btn of actionButtons) {
      expect(btn.getAttribute('aria-label')).toBeTruthy();
    }
  });
});

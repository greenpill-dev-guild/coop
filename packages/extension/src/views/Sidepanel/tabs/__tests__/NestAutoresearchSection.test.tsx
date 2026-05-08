import type { AutoresearchConfig, ExperimentRecord, SkillManifest } from '@coop/shared';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { sendRuntimeMessageMock } = vi.hoisted(() => ({
  sendRuntimeMessageMock: vi.fn(),
}));

vi.mock('../../../../runtime/messages', () => ({
  sendRuntimeMessage: sendRuntimeMessageMock,
}));

const { NestAutoresearchSection } = await import('../NestAutoresearchSection');

function makeConfig(overrides: Partial<AutoresearchConfig> = {}): AutoresearchConfig {
  return {
    skillId: 'tab-router',
    enabled: true,
    maxExperimentsPerCycle: 5,
    timeBudgetMs: 60_000,
    qualityFloor: 0.3,
    updatedAt: Date.UTC(2026, 4, 8, 12, 0, 0),
    ...overrides,
  };
}

function makeRecord(overrides: Partial<ExperimentRecord> = {}): ExperimentRecord {
  return {
    id: `experiment-${overrides.createdAt ?? 1}`,
    skillId: 'tab-router',
    variantId: 'variant-1',
    baselineVariantId: 'baseline-1',
    promptDiff: '--- baseline\n+++ variant\n-more vague\n+be specific',
    compositeScore: 0.72,
    baselineScore: 0.61,
    delta: 0.11,
    fixtureResults: [{ fixtureId: 'fixture-1', score: 0.72, passed: true }],
    outcome: 'kept',
    duration: 1200,
    createdAt: Date.UTC(2026, 4, 8, 12, 0, 0),
    ...overrides,
  };
}

function makeManifest(overrides: Partial<SkillManifest> = {}): SkillManifest {
  return {
    id: 'tab-router',
    version: '1.0.0',
    description: 'Test autoresearch skill',
    runtime: 'extension-offscreen',
    model: 'webllm',
    triggers: ['manual'],
    inputSchemaRef: 'agent-observation',
    outputSchemaRef: 'tab-routing',
    allowedTools: [],
    allowedActionClasses: [],
    requiredCapabilities: [],
    approvalMode: 'advisory',
    timeoutMs: 30_000,
    depends: [],
    provides: [],
    ...overrides,
  } as SkillManifest;
}

describe('NestAutoresearchSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('surfaces initial load failures', async () => {
    sendRuntimeMessageMock
      .mockResolvedValueOnce({ ok: false, error: 'Could not load autoresearch settings.' })
      .mockResolvedValueOnce({ ok: true, data: [] });

    render(<NestAutoresearchSection skillManifests={[makeManifest()]} />);

    expect(await screen.findByText('Could not load autoresearch settings.')).toBeInTheDocument();
  });

  it('surfaces run-now failures and clears the running state', async () => {
    const user = userEvent.setup();
    sendRuntimeMessageMock
      .mockResolvedValueOnce({
        ok: true,
        data: {
          'tab-router': {
            skillId: 'tab-router',
            enabled: true,
            maxExperimentsPerCycle: 5,
            timeBudgetMs: 60_000,
            qualityFloor: 0.3,
          },
        },
      })
      .mockResolvedValueOnce({ ok: true, data: [] })
      .mockResolvedValueOnce({ ok: false, error: 'Cycle failed.' });

    render(<NestAutoresearchSection skillManifests={[makeManifest()]} />);

    await user.click(screen.getByText('Autoresearch'));
    await user.click(await screen.findByRole('button', { name: 'Run now' }));

    expect(await screen.findByText('Cycle failed.')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Run now' })).toBeEnabled();
    });
  });

  it('renders a disabled state when no WebLLM skills are available', async () => {
    sendRuntimeMessageMock
      .mockResolvedValueOnce({ ok: true, data: {} })
      .mockResolvedValueOnce({ ok: true, data: [] });

    render(<NestAutoresearchSection skillManifests={[makeManifest({ model: 'heuristic' })]} />);

    await userEvent.click(screen.getByText('Autoresearch'));

    expect(
      await screen.findByText('No WebLLM skills are available for autoresearch.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Run now' })).not.toBeInTheDocument();
  });

  it('updates budget and quality-floor settings through the runtime config message', async () => {
    const user = userEvent.setup();
    sendRuntimeMessageMock
      .mockResolvedValueOnce({ ok: true, data: { 'tab-router': makeConfig() } })
      .mockResolvedValueOnce({ ok: true, data: [] })
      .mockResolvedValue({ ok: true });

    render(<NestAutoresearchSection skillManifests={[makeManifest()]} />);

    await user.click(screen.getByText('Autoresearch'));
    const budget = await screen.findByRole('slider', {
      name: 'Experiments per cycle for tab-router',
    });
    fireEvent.change(budget, { target: { value: '8' } });

    const qualityFloor = screen.getByRole('spinbutton', {
      name: 'Quality floor for tab-router',
    });
    await user.clear(qualityFloor);
    await user.type(qualityFloor, '0.55');
    await user.tab();

    await waitFor(() => {
      expect(sendRuntimeMessageMock).toHaveBeenCalledWith({
        type: 'set-autoresearch-config',
        payload: expect.objectContaining({
          skillId: 'tab-router',
          maxExperimentsPerCycle: 8,
        }),
      });
      expect(sendRuntimeMessageMock).toHaveBeenCalledWith({
        type: 'set-autoresearch-config',
        payload: expect.objectContaining({
          skillId: 'tab-router',
          qualityFloor: 0.55,
        }),
      });
    });
  });

  it('reloads persisted settings when the section remounts', async () => {
    sendRuntimeMessageMock
      .mockResolvedValueOnce({
        ok: true,
        data: { 'tab-router': makeConfig({ qualityFloor: 0.4 }) },
      })
      .mockResolvedValueOnce({ ok: true, data: [] })
      .mockResolvedValueOnce({
        ok: true,
        data: { 'tab-router': makeConfig({ qualityFloor: 0.65 }) },
      })
      .mockResolvedValueOnce({ ok: true, data: [] });

    const { unmount } = render(<NestAutoresearchSection skillManifests={[makeManifest()]} />);

    await userEvent.click(screen.getByText('Autoresearch'));
    expect(await screen.findByDisplayValue('0.4')).toBeInTheDocument();

    unmount();
    render(<NestAutoresearchSection skillManifests={[makeManifest()]} />);

    await userEvent.click(screen.getByText('Autoresearch'));
    expect(await screen.findByDisplayValue('0.65')).toBeInTheDocument();
  });

  it('shows run progress and refreshes the journal after a successful run', async () => {
    const user = userEvent.setup();
    let resolveRun: (value: unknown) => void = () => {};
    const runPromise = new Promise((resolve) => {
      resolveRun = resolve;
    });

    sendRuntimeMessageMock
      .mockResolvedValueOnce({ ok: true, data: { 'tab-router': makeConfig() } })
      .mockResolvedValueOnce({ ok: true, data: [] })
      .mockReturnValueOnce(runPromise)
      .mockResolvedValueOnce({ ok: true, data: [makeRecord({ id: 'experiment-success' })] })
      .mockResolvedValueOnce({ ok: true, data: { 'tab-router': makeConfig() } });

    render(<NestAutoresearchSection skillManifests={[makeManifest()]} />);

    await user.click(screen.getByText('Autoresearch'));
    await user.click(await screen.findByRole('button', { name: 'Run now' }));

    expect(screen.getByRole('button', { name: 'Running...' })).toBeDisabled();

    resolveRun({ ok: true, data: { experimentsRun: 1, kept: 1, reverted: 0, bestScore: 0.72 } });

    await user.click(await screen.findByText('Experiment journal'));
    expect(await screen.findByText('experiment-success')).toBeInTheDocument();
  });

  it('paginates the journal in batches of 20', async () => {
    const user = userEvent.setup();
    const records = Array.from({ length: 25 }, (_, index) =>
      makeRecord({
        id: `experiment-${index + 1}`,
        createdAt: Date.UTC(2026, 4, 8, 12, index, 0),
      }),
    );
    sendRuntimeMessageMock
      .mockResolvedValueOnce({ ok: true, data: { 'tab-router': makeConfig() } })
      .mockResolvedValueOnce({ ok: true, data: records });

    render(<NestAutoresearchSection skillManifests={[makeManifest()]} />);

    await user.click(screen.getByText('Experiment journal'));

    expect(await screen.findByText('experiment-25')).toBeInTheDocument();
    expect(screen.queryByText('experiment-1')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show 5 more experiments' }));

    expect(await screen.findByText('experiment-1')).toBeInTheDocument();
  });

  it('shows trend, score bars, and filters journal cards by skill', async () => {
    const user = userEvent.setup();
    const records = [
      makeRecord({ id: 'tab-experiment', skillId: 'tab-router', delta: 0.08 }),
      makeRecord({
        id: 'review-experiment',
        skillId: 'review-digest',
        delta: -0.04,
        outcome: 'reverted',
      }),
    ];
    sendRuntimeMessageMock
      .mockResolvedValueOnce({
        ok: true,
        data: {
          'tab-router': makeConfig(),
          'review-digest': makeConfig({ skillId: 'review-digest' }),
        },
      })
      .mockResolvedValueOnce({ ok: true, data: records });

    render(
      <NestAutoresearchSection
        skillManifests={[makeManifest(), makeManifest({ id: 'review-digest' })]}
      />,
    );

    await user.click(screen.getByText('Autoresearch'));
    expect(await screen.findByText(/Trend: improving/)).toBeInTheDocument();
    expect(await screen.findByText(/Trend: regressing/)).toBeInTheDocument();

    await user.click(screen.getByText('Experiment journal'));
    expect(await screen.findAllByLabelText('Score bar 72.0%')).toHaveLength(2);

    await user.selectOptions(screen.getByLabelText('Filter experiment journal by skill'), [
      'review-digest',
    ]);

    expect(await screen.findByText('review-experiment')).toBeInTheDocument();
    expect(screen.queryByText('tab-experiment')).not.toBeInTheDocument();
  });
});

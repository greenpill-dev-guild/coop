import type { SkillManifest } from '@coop/shared';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { sendRuntimeMessageMock } = vi.hoisted(() => ({
  sendRuntimeMessageMock: vi.fn(),
}));

vi.mock('../../../../runtime/messages', () => ({
  sendRuntimeMessage: sendRuntimeMessageMock,
}));

const { NestAutoresearchSection } = await import('../NestAutoresearchSection');

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
});

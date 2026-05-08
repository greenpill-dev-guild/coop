import type { AgentMemory } from '@coop/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { AgentMemorySection } from '../AgentMemorySection';

function makeMemory(overrides: Partial<AgentMemory> = {}): AgentMemory {
  return {
    id: 'memory-1',
    scope: 'coop',
    coopId: 'coop-1',
    type: 'skill-pattern',
    domain: 'routing',
    content: 'Prefer scoped routing suggestions.',
    contentHash: 'hash-1',
    confidence: 0.78,
    createdAt: '2026-05-08T00:00:00.000Z',
    ...overrides,
  };
}

describe('AgentMemorySection', () => {
  it('shows provenance and confirmation labels for durable memories', async () => {
    render(
      <AgentMemorySection
        memories={[
          makeMemory({
            provenanceLabel: 'inferred',
            confirmationStatus: 'unconfirmed',
            sourceChannel: 'skill',
            providerId: 'webllm',
            modelId: 'local-model',
          }),
          makeMemory({
            id: 'memory-2',
            type: 'user-feedback',
            content: 'Member confirmed this preference.',
            provenanceLabel: 'user-confirmed',
            confirmationStatus: 'confirmed',
            sourceChannel: 'member',
          }),
        ]}
      />,
    );

    await userEvent.click(screen.getByText('Agent Memory (2)'));

    expect(screen.getByText('inferred')).toBeInTheDocument();
    expect(screen.getByText('unconfirmed')).toBeInTheDocument();
    expect(screen.getByText('skill')).toBeInTheDocument();
    expect(screen.getByText('webllm · local-model')).toBeInTheDocument();
    expect(screen.getByText('user-confirmed')).toBeInTheDocument();
    expect(screen.getByText('confirmed')).toBeInTheDocument();
  });
});

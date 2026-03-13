import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OperatorConsole } from '../operator-console';

describe('operator console', () => {
  it('renders anchor state, action log entries, and refresh affordances', () => {
    render(
      <OperatorConsole
        actionLog={[
          {
            id: 'action-1',
            actionType: 'archive-upload',
            status: 'succeeded',
            detail: 'Live archive upload completed and receipt stored.',
            createdAt: '2026-03-13T00:20:00.000Z',
            context: {
              coopName: 'Coop Town',
              memberDisplayName: 'Ari',
              mode: 'live',
            },
          },
        ]}
        anchorActive={true}
        anchorCapability={{
          enabled: true,
          nodeId: 'coop-extension',
          updatedAt: '2026-03-13T00:10:00.000Z',
          actorAddress: '0x1111111111111111111111111111111111111111',
          actorDisplayName: 'Ari',
          memberId: 'member-1',
          memberDisplayName: 'Ari',
        }}
        anchorDetail="Anchor mode is active for this authenticated member context."
        archiveMode="live"
        liveArchiveAvailable={true}
        liveArchiveDetail="Live archive uploads are ready from this anchor node."
        liveOnchainAvailable={true}
        liveOnchainDetail="Live Safe deployments are ready from this anchor node."
        onRefreshArchiveStatus={vi.fn()}
        onToggleAnchor={vi.fn()}
        onchainMode="live"
        refreshableReceiptCount={2}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Operator Console' })).toBeVisible();
    expect(screen.getByText(/anchor mode is active/i)).toBeVisible();
    expect(screen.getByRole('log', { name: /privileged action log/i })).toBeVisible();
    expect(screen.getByText(/live archive upload completed and receipt stored/i)).toBeVisible();
    expect(screen.getByRole('button', { name: /refresh archive status/i })).toBeEnabled();
  });
});

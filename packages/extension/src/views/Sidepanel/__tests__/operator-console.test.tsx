import type {
  ActionBundle,
  ActionLogEntry,
  ActionPolicy,
  AgentObservation,
  AgentPlan,
  ExecutionPermit,
  PermitLogEntry,
  SessionCapability,
  SessionCapabilityLogEntry,
  SkillManifest,
  SkillRun,
} from '@coop/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { OperatorConsole } from '../OperatorConsole';

/** Click a collapsible section heading to expand it. */
async function expandSection(user: ReturnType<typeof userEvent.setup>, name: string | RegExp) {
  const heading = screen.getByRole('heading', { name });
  await user.click(heading);
}

const baseProps = {
  actionLog: [
    {
      id: 'action-1',
      actionType: 'archive-upload' as const,
      status: 'succeeded' as const,
      detail: 'Live archive upload completed and receipt stored.',
      createdAt: '2026-03-13T00:20:00.000Z',
      context: {
        coopName: 'Coop Town',
        memberDisplayName: 'Ari',
        mode: 'live',
      },
    },
  ],
  anchorActive: true,
  anchorCapability: {
    enabled: true,
    nodeId: 'coop-extension',
    updatedAt: '2026-03-13T00:10:00.000Z',
    actorAddress: '0x1111111111111111111111111111111111111111',
    actorDisplayName: 'Ari',
    memberId: 'member-1',
    memberDisplayName: 'Ari',
  },
  anchorDetail: 'Trusted mode is active for this authenticated member context.',
  archiveMode: 'live' as const,
  liveArchiveAvailable: true,
  liveArchiveDetail: 'Live saves are ready from this trusted browser.',
  liveOnchainAvailable: true,
  liveOnchainDetail: 'Live shared-wallet steps are ready from this trusted browser.',
  onRefreshArchiveStatus: vi.fn(),
  onToggleAnchor: vi.fn(),
  onchainMode: 'live' as const,
  sessionMode: 'live' as const,
  refreshableReceiptCount: 2,
  policies: [] as ActionPolicy[],
  actionQueue: [] as ActionBundle[],
  actionHistory: [] as ActionLogEntry[],
  onSetPolicy: vi.fn(),
  onProposeAction: vi.fn(),
  onApproveAction: vi.fn(),
  onRejectAction: vi.fn(),
  onExecuteAction: vi.fn(),
  permits: [] as ExecutionPermit[],
  permitLog: [] as PermitLogEntry[],
  onIssuePermit: vi.fn(),
  onRevokePermit: vi.fn(),
  onExecuteWithPermit: vi.fn(),
  sessionCapabilities: [] as SessionCapability[],
  sessionCapabilityLog: [] as SessionCapabilityLogEntry[],
  onIssueSessionCapability: vi.fn(),
  onRotateSessionCapability: vi.fn(),
  onRevokeSessionCapability: vi.fn(),
  agentObservations: [] as AgentObservation[],
  agentPlans: [] as AgentPlan[],
  skillRuns: [] as SkillRun[],
  skillManifests: [] as SkillManifest[],
  autoRunSkillIds: [] as string[],
  activeCoopId: 'coop-1',
  activeCoopName: 'Coop Town',
  onRunAgentCycle: vi.fn(),
  onApprovePlan: vi.fn(),
  onRejectPlan: vi.fn(),
  onRetrySkillRun: vi.fn(),
  onToggleSkillAutoRun: vi.fn(),
} as unknown as ComponentProps<typeof OperatorConsole>;

describe('operator console', () => {
  it('renders anchor state, action log entries, and refresh affordances', async () => {
    const user = userEvent.setup();
    render(<OperatorConsole {...baseProps} />);

    expect(screen.getByRole('heading', { name: 'Trusted Helpers' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Trusted Nest Controls' })).toBeVisible();

    await expandSection(user, 'Trusted Nest Controls');
    expect(screen.getByText(/trusted mode is active/i)).toBeVisible();
    expect(screen.getByRole('button', { name: /refresh saved proof/i })).toBeEnabled();

    await expandSection(user, 'Trusted Action Log');
    expect(screen.getByRole('log', { name: /trusted action log/i })).toBeVisible();
    expect(screen.getByText(/live archive upload completed and receipt stored/i)).toBeVisible();
  });

  it('shows practice and off mode labels when live paths are not enabled', async () => {
    const user = userEvent.setup();

    render(
      <OperatorConsole
        {...baseProps}
        anchorActive={false}
        archiveMode="mock"
        onchainMode="mock"
        sessionMode="off"
        liveArchiveAvailable={false}
        liveOnchainAvailable={false}
        refreshableReceiptCount={0}
      />,
    );

    await expandSection(user, 'Trusted Nest Controls');
    expect(screen.getAllByText('Practice').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Off')).toBeVisible();
    expect(screen.getByRole('button', { name: /refresh saved proof/i })).toBeDisabled();
  });

  it('renders Green Goods request controls for a linked garden and queues GAP admin sync', async () => {
    const user = userEvent.setup();
    const onQueueGreenGoodsGapAdminSync = vi.fn();

    render(
      <OperatorConsole
        {...baseProps}
        greenGoodsContext={{
          coopId: 'coop-1',
          coopName: 'Coop Town',
          enabled: true,
          gardenAddress: '0x1111111111111111111111111111111111111111',
        }}
        onQueueGreenGoodsGapAdminSync={onQueueGreenGoodsGapAdminSync}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Garden Requests' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: /sync garden admins/i }));
    expect(onQueueGreenGoodsGapAdminSync).toHaveBeenCalledWith('coop-1');
  });

  it('shows member bindings and queues gardener sync actions', async () => {
    const user = userEvent.setup();
    const onQueueGreenGoodsMemberSync = vi.fn();

    render(
      <OperatorConsole
        {...baseProps}
        greenGoodsContext={{
          coopId: 'coop-1',
          coopName: 'Coop Town',
          enabled: true,
          gardenAddress: '0x1111111111111111111111111111111111111111',
          memberBindings: [
            {
              memberId: 'member-1',
              memberDisplayName: 'Ari',
              actorAddress: '0x2222222222222222222222222222222222222222',
              desiredRoles: ['gardener', 'operator'],
              currentRoles: [],
              status: 'pending-sync',
            },
          ],
        }}
        actionQueue={[
          {
            id: 'bundle-1',
            actionClass: 'green-goods-add-gardener',
            status: 'approved',
            coopId: 'coop-1',
            memberId: 'member-admin',
            policyId: 'policy-add',
            chainId: 11155111,
            chainKey: 'sepolia',
            safeAddress: '0x9999999999999999999999999999999999999999',
            payload: {
              coopId: 'coop-1',
              memberId: 'member-1',
              gardenerAddress: '0x2222222222222222222222222222222222222222',
            },
            rationale: 'Sync member into the garden.',
            approvals: [],
            rejections: [],
            executionAttempts: [],
            createdAt: '2026-03-20T00:05:00.000Z',
            updatedAt: '2026-03-20T00:05:00.000Z',
          } as unknown as ActionBundle,
        ]}
        actionHistory={[
          {
            id: 'history-1',
            bundleId: 'bundle-1',
            actionClass: 'green-goods-add-gardener',
            eventType: 'executed',
            detail: 'Added gardener 0x2222... to the linked garden.',
            createdAt: '2026-03-20T00:06:00.000Z',
          } as unknown as ActionLogEntry,
        ]}
        onQueueGreenGoodsMemberSync={onQueueGreenGoodsMemberSync}
      />,
    );

    await expandSection(user, 'Garden Requests');
    expect(screen.getAllByText('Ari').length).toBeGreaterThan(0);
    expect(screen.getByText(/pending-sync/i)).toBeVisible();
    expect(screen.getByText(/queued bundles/i)).toBeVisible();
    expect(screen.getAllByText(/add gardener/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/added gardener 0x2222/i).length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: /queue gardener sync/i }));
    expect(onQueueGreenGoodsMemberSync).toHaveBeenCalledWith('coop-1');
  });

  describe('policy settings section', () => {
    it('renders the Approval Rules heading', () => {
      render(<OperatorConsole {...baseProps} />);
      expect(screen.getByRole('heading', { name: 'Approval Rules' })).toBeVisible();
    });

    it('renders policy toggle for each policy', async () => {
      const user = userEvent.setup();
      const policies: ActionPolicy[] = [
        {
          id: 'policy-1',
          actionClass: 'archive-artifact',
          approvalRequired: true,
          replayProtection: true,
          createdAt: '2026-03-12T00:00:00.000Z',
          updatedAt: '2026-03-12T00:00:00.000Z',
        },
        {
          id: 'policy-2',
          actionClass: 'publish-ready-draft',
          approvalRequired: false,
          replayProtection: true,
          createdAt: '2026-03-12T00:00:00.000Z',
          updatedAt: '2026-03-12T00:00:00.000Z',
        },
      ];

      render(<OperatorConsole {...baseProps} policies={policies} />);

      await expandSection(user, 'Approval Rules');
      expect(screen.getByText('Archive artifact')).toBeVisible();
      expect(screen.getByText('Publish ready draft')).toBeVisible();
    });

    it('disables the safe-deployment toggle with human confirmation note', async () => {
      const user = userEvent.setup();
      const policies: ActionPolicy[] = [
        {
          id: 'policy-safe',
          actionClass: 'safe-deployment',
          approvalRequired: true,
          replayProtection: true,
          createdAt: '2026-03-12T00:00:00.000Z',
          updatedAt: '2026-03-12T00:00:00.000Z',
        },
      ];

      render(<OperatorConsole {...baseProps} policies={policies} />);

      await expandSection(user, 'Approval Rules');
      expect(screen.getByText('Safe deployment')).toBeVisible();
      expect(screen.getByText(/a person must always confirm this one/i)).toBeVisible();
      const checkbox = screen.getByRole('checkbox', { name: /safe deployment/i });
      expect(checkbox).toBeDisabled();
    });

    it('calls onSetPolicy when toggling a non-safe-deployment policy', async () => {
      const user = userEvent.setup();
      const onSetPolicy = vi.fn();
      const policies: ActionPolicy[] = [
        {
          id: 'policy-1',
          actionClass: 'archive-artifact',
          approvalRequired: true,
          replayProtection: true,
          createdAt: '2026-03-12T00:00:00.000Z',
          updatedAt: '2026-03-12T00:00:00.000Z',
        },
      ];

      render(<OperatorConsole {...baseProps} policies={policies} onSetPolicy={onSetPolicy} />);

      const checkbox = screen.getByRole('checkbox', { name: /archive artifact/i });
      await user.click(checkbox);
      expect(onSetPolicy).toHaveBeenCalledWith('archive-artifact', false);
    });
  });

  describe('action queue section', () => {
    it('renders the Waiting Actions heading', () => {
      render(<OperatorConsole {...baseProps} />);
      expect(screen.getByRole('heading', { name: 'Waiting Chores' })).toBeVisible();
    });

    it('shows empty state when no bundles', async () => {
      const user = userEvent.setup();
      render(<OperatorConsole {...baseProps} actionQueue={[]} />);
      await expandSection(user, 'Waiting Chores');
      expect(screen.getByText('No waiting chores.')).toBeVisible();
    });

    it('renders proposed bundle with Approve and Reject buttons', async () => {
      const user = userEvent.setup();
      const actionQueue: ActionBundle[] = [
        {
          id: 'bundle-1',
          replayId: 'replay-1',
          actionClass: 'archive-artifact',
          coopId: 'coop-1',
          memberId: 'member-1',
          payload: { artifactId: 'art-1' },
          createdAt: '2026-03-12T00:00:00.000Z',
          expiresAt: '2026-03-13T00:00:00.000Z',
          policyId: 'policy-1',
          status: 'proposed',
          digest: `0x${'ab'.repeat(32)}`,
        },
      ];

      render(<OperatorConsole {...baseProps} actionQueue={actionQueue} />);

      await expandSection(user, 'Waiting Chores');
      expect(screen.getByText('Archive artifact')).toBeVisible();
      expect(screen.getByRole('button', { name: /approve/i })).toBeVisible();
      expect(screen.getByRole('button', { name: /reject/i })).toBeVisible();
    });

    it('renders approved bundle with Execute button', async () => {
      const user = userEvent.setup();
      const actionQueue: ActionBundle[] = [
        {
          id: 'bundle-2',
          replayId: 'replay-2',
          actionClass: 'archive-snapshot',
          coopId: 'coop-1',
          memberId: 'member-1',
          payload: {},
          createdAt: '2026-03-12T00:00:00.000Z',
          expiresAt: '2026-03-13T00:00:00.000Z',
          policyId: 'policy-1',
          status: 'approved',
          digest: `0x${'cd'.repeat(32)}`,
          approvedAt: '2026-03-12T00:01:00.000Z',
        },
      ];

      render(<OperatorConsole {...baseProps} actionQueue={actionQueue} />);

      await expandSection(user, 'Waiting Chores');
      expect(screen.getByRole('button', { name: /run now/i })).toBeVisible();
    });

    it('calls onApproveAction when Approve is clicked', async () => {
      const user = userEvent.setup();
      const onApproveAction = vi.fn();
      const actionQueue: ActionBundle[] = [
        {
          id: 'bundle-1',
          replayId: 'replay-1',
          actionClass: 'archive-artifact',
          coopId: 'coop-1',
          memberId: 'member-1',
          payload: {},
          createdAt: '2026-03-12T00:00:00.000Z',
          expiresAt: '2026-03-13T00:00:00.000Z',
          policyId: 'policy-1',
          status: 'proposed',
          digest: `0x${'ab'.repeat(32)}`,
        },
      ];

      render(
        <OperatorConsole
          {...baseProps}
          actionQueue={actionQueue}
          onApproveAction={onApproveAction}
        />,
      );

      await user.click(screen.getByRole('button', { name: /approve/i }));
      expect(onApproveAction).toHaveBeenCalledWith('bundle-1');
    });

    it('calls onRejectAction when Reject is clicked', async () => {
      const user = userEvent.setup();
      const onRejectAction = vi.fn();
      const actionQueue: ActionBundle[] = [
        {
          id: 'bundle-1',
          replayId: 'replay-1',
          actionClass: 'archive-artifact',
          coopId: 'coop-1',
          memberId: 'member-1',
          payload: {},
          createdAt: '2026-03-12T00:00:00.000Z',
          expiresAt: '2026-03-13T00:00:00.000Z',
          policyId: 'policy-1',
          status: 'proposed',
          digest: `0x${'ab'.repeat(32)}`,
        },
      ];

      render(
        <OperatorConsole
          {...baseProps}
          actionQueue={actionQueue}
          onRejectAction={onRejectAction}
        />,
      );

      await user.click(screen.getByRole('button', { name: /reject/i }));
      expect(onRejectAction).toHaveBeenCalledWith('bundle-1');
    });

    it('calls onExecuteAction when Run now is clicked', async () => {
      const user = userEvent.setup();
      const onExecuteAction = vi.fn();
      const actionQueue: ActionBundle[] = [
        {
          id: 'bundle-2',
          replayId: 'replay-2',
          actionClass: 'archive-snapshot',
          coopId: 'coop-1',
          memberId: 'member-1',
          payload: {},
          createdAt: '2026-03-12T00:00:00.000Z',
          expiresAt: '2026-03-13T00:00:00.000Z',
          policyId: 'policy-1',
          status: 'approved',
          digest: `0x${'cd'.repeat(32)}`,
          approvedAt: '2026-03-12T00:01:00.000Z',
        },
      ];

      render(
        <OperatorConsole
          {...baseProps}
          actionQueue={actionQueue}
          onExecuteAction={onExecuteAction}
        />,
      );

      await user.click(screen.getByRole('button', { name: /run now/i }));
      expect(onExecuteAction).toHaveBeenCalledWith('bundle-2');
    });
  });

  describe('action history section', () => {
    it('renders the Recent Actions heading', () => {
      render(<OperatorConsole {...baseProps} />);
      expect(screen.getByRole('heading', { name: 'Recent Chores' })).toBeVisible();
    });

    it('shows empty state when no history entries', async () => {
      const user = userEvent.setup();
      render(<OperatorConsole {...baseProps} actionHistory={[]} />);
      await expandSection(user, 'Recent Chores');
      expect(screen.getByText('No recent chores yet.')).toBeVisible();
    });

    it('renders action history entries with labels', async () => {
      const user = userEvent.setup();
      const actionHistory: ActionLogEntry[] = [
        {
          id: 'alog-1',
          bundleId: 'bundle-1',
          eventType: 'proposal-approved',
          actionClass: 'archive-artifact',
          detail: 'Approved by operator.',
          createdAt: '2026-03-12T01:00:00.000Z',
          coopId: 'coop-1',
          memberId: 'member-1',
        },
        {
          id: 'alog-2',
          bundleId: 'bundle-2',
          eventType: 'execution-succeeded',
          actionClass: 'archive-snapshot',
          detail: 'Snapshot archived successfully.',
          createdAt: '2026-03-12T02:00:00.000Z',
          coopId: 'coop-1',
        },
      ];

      render(<OperatorConsole {...baseProps} actionHistory={actionHistory} />);

      await expandSection(user, 'Recent Chores');
      expect(screen.getByText('Approved')).toBeVisible();
      expect(screen.getByText('Approved by operator.')).toBeVisible();
      expect(screen.getByText('Executed')).toBeVisible();
      expect(screen.getByText('Snapshot archived successfully.')).toBeVisible();
    });

    it('limits display to 20 entries', () => {
      const actionHistory: ActionLogEntry[] = Array.from({ length: 25 }, (_, i) => ({
        id: `alog-${i}`,
        bundleId: `bundle-${i}`,
        eventType: 'proposal-created' as const,
        actionClass: 'archive-artifact' as const,
        detail: `Entry ${i}`,
        createdAt: `2026-03-12T${String(i).padStart(2, '0')}:00:00.000Z`,
        coopId: 'coop-1',
      }));

      render(<OperatorConsole {...baseProps} actionHistory={actionHistory} />);

      // Should show only 20 entries, not all 25
      const proposedBadges = screen.getAllByText('Proposed');
      expect(proposedBadges.length).toBeLessThanOrEqual(20);
    });
  });

  describe('session keys section', () => {
    it('renders the Garden Passes heading and issue control', async () => {
      const user = userEvent.setup();
      render(
        <OperatorConsole
          {...baseProps}
          greenGoodsContext={{
            coopId: 'coop-1',
            coopName: 'Coop Town',
            enabled: true,
            gardenAddress: '0x1111111111111111111111111111111111111111',
          }}
        />,
      );

      expect(screen.getByRole('heading', { name: 'Garden Passes' })).toBeVisible();
      await expandSection(user, 'Garden Passes');
      expect(screen.getByRole('button', { name: /hatch garden pass/i })).toBeVisible();
    });

    it('renders issued session keys with status and actions', async () => {
      const user = userEvent.setup();
      const sessionCapabilities: SessionCapability[] = [
        {
          id: 'session-1',
          coopId: 'coop-1',
          createdAt: '2026-03-12T00:00:00.000Z',
          updatedAt: '2026-03-12T00:00:00.000Z',
          permissionId: `0x${'ab'.repeat(32)}`,
          sessionAddress: '0x1111111111111111111111111111111111111111',
          validatorAddress: '0x2222222222222222222222222222222222222222',
          validatorInitData: '0x1234',
          status: 'unusable',
          statusDetail: 'Pimlico is required before a live session key can send transactions.',
          lastValidationFailure: 'missing-pimlico',
          scope: {
            allowedActions: ['green-goods-sync-garden-profile', 'green-goods-create-garden-pools'],
            targetAllowlist: {
              'green-goods-sync-garden-profile': ['0x3333333333333333333333333333333333333333'],
              'green-goods-create-garden-pools': ['0x4444444444444444444444444444444444444444'],
            },
            maxUses: 12,
            expiresAt: '2026-03-13T00:00:00.000Z',
            chainKey: 'sepolia',
            safeAddress: '0x5555555555555555555555555555555555555555',
          },
          issuedBy: {
            memberId: 'member-1',
            displayName: 'Ari',
            address: '0x6666666666666666666666666666666666666666',
          },
          executor: {
            label: 'operator-console',
            localIdentityId: 'identity-1',
          },
          usedCount: 3,
        },
      ];

      render(<OperatorConsole {...baseProps} sessionCapabilities={sessionCapabilities} />);

      await expandSection(user, 'Garden Passes');
      expect(screen.getByText('Unavailable')).toBeVisible();
      expect(screen.getByText('3/12 uses')).toBeVisible();
      expect(
        screen.getByText('Green Goods sync garden profile, Green Goods create garden pools'),
      ).toBeVisible();
      expect(screen.getByText(/last failure: Missing Pimlico/i)).toBeVisible();
    });

    it('calls onIssueSessionCapability when hatching a garden pass', async () => {
      const user = userEvent.setup();
      const onIssueSessionCapability = vi.fn();

      render(
        <OperatorConsole
          {...baseProps}
          onIssueSessionCapability={onIssueSessionCapability}
          greenGoodsContext={{
            coopId: 'coop-1',
            coopName: 'Coop Town',
            enabled: true,
            gardenAddress: '0x1111111111111111111111111111111111111111',
          }}
        />,
      );

      await user.click(screen.getByRole('button', { name: /hatch garden pass/i }));
      expect(onIssueSessionCapability).toHaveBeenCalledWith(
        expect.objectContaining({
          coopId: 'coop-1',
          maxUses: 12,
          allowedActions: [
            'green-goods-sync-garden-profile',
            'green-goods-set-garden-domains',
            'green-goods-create-garden-pools',
          ],
        }),
      );
    });

    it('renders the session audit log with friendly labels', async () => {
      const user = userEvent.setup();
      const sessionCapabilityLog: SessionCapabilityLogEntry[] = [
        {
          id: 'slog-1',
          capabilityId: 'session-1',
          coopId: 'coop-1',
          eventType: 'session-validation-rejected',
          actionClass: 'green-goods-create-garden',
          detail: 'Action bundle is missing typed authorization metadata.',
          createdAt: '2026-03-12T02:00:00.000Z',
          reason: 'module-unavailable',
        },
      ];

      render(<OperatorConsole {...baseProps} sessionCapabilityLog={sessionCapabilityLog} />);

      expect(screen.getByRole('heading', { name: 'Garden Pass Log' })).toBeVisible();
      await expandSection(user, 'Garden Pass Log');
      expect(screen.getByText('Validation rejected')).toBeVisible();
      expect(screen.getByText('Module unavailable')).toBeVisible();
      expect(screen.getByText(/missing typed authorization metadata/i)).toBeVisible();
    });
  });

  describe('execution permits section', () => {
    it('renders the Helper Passes heading', () => {
      render(<OperatorConsole {...baseProps} />);
      expect(screen.getByRole('heading', { name: 'Helper Passes' })).toBeVisible();
    });

    it('shows empty state when no permits', async () => {
      const user = userEvent.setup();
      render(<OperatorConsole {...baseProps} permits={[]} />);
      await expandSection(user, 'Helper Passes');
      expect(screen.getByText('No helper passes issued yet.')).toBeVisible();
    });

    it('renders an active permit with status, coop, usage, and actions', async () => {
      const user = userEvent.setup();
      const permits: ExecutionPermit[] = [
        {
          id: 'permit-1',
          coopId: 'coop-1',
          issuedBy: { memberId: 'member-1', displayName: 'Ari' },
          executor: { label: 'operator-console' },
          createdAt: '2026-03-12T00:00:00.000Z',
          expiresAt: '2026-03-13T00:00:00.000Z',
          maxUses: 10,
          usedCount: 3,
          allowedActions: ['archive-artifact', 'archive-snapshot'],
          status: 'active',
        },
      ];

      render(<OperatorConsole {...baseProps} permits={permits} />);

      await expandSection(user, 'Helper Passes');
      expect(screen.getByText('Active')).toBeVisible();
      expect(screen.getByText('coop-1')).toBeVisible();
      expect(screen.getByText('3/10 uses')).toBeVisible();
      expect(screen.getByText('Archive artifact, Archive snapshot')).toBeVisible();
      expect(screen.getByText(/issued by ari/i)).toBeVisible();
      expect(screen.getByRole('button', { name: /turn off pass/i })).toBeVisible();
    });

    it('does not show Turn off pass button for non-active permits', async () => {
      const user = userEvent.setup();
      const permits: ExecutionPermit[] = [
        {
          id: 'permit-1',
          coopId: 'coop-1',
          issuedBy: { memberId: 'member-1', displayName: 'Ari' },
          executor: { label: 'operator-console' },
          createdAt: '2026-03-12T00:00:00.000Z',
          expiresAt: '2026-03-11T00:00:00.000Z',
          maxUses: 10,
          usedCount: 0,
          allowedActions: ['archive-artifact'],
          status: 'expired',
        },
      ];

      render(<OperatorConsole {...baseProps} permits={permits} />);

      await expandSection(user, 'Helper Passes');
      expect(screen.getByText('Expired')).toBeVisible();
      expect(screen.queryByRole('button', { name: /turn off pass/i })).toBeNull();
    });

    it('shows revoked timestamp for revoked permits', async () => {
      const user = userEvent.setup();
      const permits: ExecutionPermit[] = [
        {
          id: 'permit-1',
          coopId: 'coop-1',
          issuedBy: { memberId: 'member-1', displayName: 'Ari' },
          executor: { label: 'operator-console' },
          createdAt: '2026-03-12T00:00:00.000Z',
          expiresAt: '2026-03-13T00:00:00.000Z',
          maxUses: 10,
          usedCount: 2,
          allowedActions: ['archive-artifact'],
          status: 'revoked',
          revokedAt: '2026-03-12T06:00:00.000Z',
        },
      ];

      render(<OperatorConsole {...baseProps} permits={permits} />);

      await expandSection(user, 'Helper Passes');
      expect(screen.getByText('Revoked')).toBeVisible();
      expect(screen.getByText(/· Revoked/)).toBeVisible();
    });

    it('calls onRevokePermit when Turn off pass is clicked', async () => {
      const user = userEvent.setup();
      const onRevokePermit = vi.fn();
      const permits: ExecutionPermit[] = [
        {
          id: 'permit-1',
          coopId: 'coop-1',
          issuedBy: { memberId: 'member-1', displayName: 'Ari' },
          executor: { label: 'operator-console' },
          createdAt: '2026-03-12T00:00:00.000Z',
          expiresAt: '2026-03-13T00:00:00.000Z',
          maxUses: 10,
          usedCount: 0,
          allowedActions: ['archive-artifact'],
          status: 'active',
        },
      ];

      render(<OperatorConsole {...baseProps} permits={permits} onRevokePermit={onRevokePermit} />);

      await user.click(screen.getByRole('button', { name: /turn off pass/i }));
      expect(onRevokePermit).toHaveBeenCalledWith('permit-1');
    });
  });

  describe('permit audit log section', () => {
    it('renders the Helper Pass Log heading', () => {
      render(<OperatorConsole {...baseProps} />);
      expect(screen.getByRole('heading', { name: 'Helper Pass Log' })).toBeVisible();
    });

    it('shows empty state when no permit log entries', async () => {
      const user = userEvent.setup();
      render(<OperatorConsole {...baseProps} permitLog={[]} />);
      await expandSection(user, 'Helper Pass Log');
      expect(screen.getByText('No helper-pass activity yet.')).toBeVisible();
    });

    it('renders permit log entries with event labels and details', async () => {
      const user = userEvent.setup();
      const permitLog: PermitLogEntry[] = [
        {
          id: 'glog-1',
          permitId: 'permit-1',
          eventType: 'permit-issued',
          detail: 'Permit issued for archive-artifact (max 10 uses).',
          createdAt: '2026-03-12T00:00:00.000Z',
        },
        {
          id: 'glog-2',
          permitId: 'permit-1',
          eventType: 'delegated-execution-succeeded',
          actionClass: 'archive-artifact',
          detail: 'Delegated archive-artifact succeeded.',
          createdAt: '2026-03-12T01:00:00.000Z',
          coopId: 'coop-1',
          replayId: 'dreplay-1',
        },
      ];

      render(<OperatorConsole {...baseProps} permitLog={permitLog} />);

      await expandSection(user, 'Helper Pass Log');
      expect(screen.getByText('Issued')).toBeVisible();
      expect(screen.getByText('Permit issued for archive-artifact (max 10 uses).')).toBeVisible();
      expect(screen.getByText('Succeeded')).toBeVisible();
      expect(screen.getByText('Delegated archive-artifact succeeded.')).toBeVisible();
      expect(screen.getByText('Archive artifact')).toBeVisible();
    });

    it('limits display to 20 entries', () => {
      const permitLog: PermitLogEntry[] = Array.from({ length: 25 }, (_, i) => ({
        id: `glog-${i}`,
        permitId: 'permit-1',
        eventType: 'delegated-execution-attempted' as const,
        detail: `Attempt ${i}`,
        createdAt: `2026-03-12T${String(i).padStart(2, '0')}:00:00.000Z`,
        coopId: 'coop-1',
      }));

      render(<OperatorConsole {...baseProps} permitLog={permitLog} />);

      const attemptedBadges = screen.getAllByText('Attempted');
      expect(attemptedBadges.length).toBeLessThanOrEqual(20);
    });
  });
});

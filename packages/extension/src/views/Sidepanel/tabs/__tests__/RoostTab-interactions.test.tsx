import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ActionBundle, CoopSharedState } from '@coop/shared';
import {
  makeCoopState,
  makeGreenGoodsMemberBinding,
  makeGreenGoodsState,
  makeMemberOnchainAccount,
} from '../../../../__tests__/fixtures';
import { RoostTab, type RoostTabProps } from '../RoostTab';

const accessSummarySpy = vi.fn();
const provisionPropsSpy = vi.fn();

vi.mock('../../cards/GreenGoodsActionCards', () => ({
  GreenGoodsAccessSummary: (props: unknown) => {
    accessSummarySpy(props);
    return <div data-testid="gg-summary">Green goods summary</div>;
  },
  GreenGoodsProvisionButton: ({
    canSubmit,
    onProvision,
  }: {
    canSubmit: boolean;
    onProvision: () => Promise<void>;
  }) => {
    provisionPropsSpy({ canSubmit });
    return (
      <button onClick={() => void onProvision()} type="button">
        Provision garden access
      </button>
    );
  },
  GreenGoodsWorkSubmissionForm: ({
    onSubmit,
  }: {
    onSubmit: (input: {
      actionUid: number;
      title: string;
      feedback: string;
      metadataCid: string;
      mediaCids: string[];
    }) => Promise<void>;
  }) => (
    <button
      onClick={() =>
        void onSubmit({
          actionUid: 7,
          title: 'Watershed update',
          feedback: 'Riparian repair complete',
          metadataCid: 'bafy-meta',
          mediaCids: ['bafy-media'],
        })
      }
      type="button"
    >
      Submit mocked work
    </button>
  ),
}));

function createCoop(overrides: Partial<CoopSharedState> = {}): CoopSharedState {
  return makeCoopState({
    profile: {
      id: 'coop-1',
      name: 'Alpha Coop',
      purpose: 'Restore watersheds',
    },
    members: [
      {
        ...makeCoopState().members[0],
        id: 'member-1',
        displayName: 'Ari',
        role: 'creator',
        address: '0x1111111111111111111111111111111111111111',
      },
      {
        ...makeCoopState().members[0],
        id: 'member-2',
        displayName: 'Bo',
        role: 'member',
        address: '0x2222222222222222222222222222222222222222',
        joinedAt: '2026-01-02T00:00:00.000Z',
      },
    ],
    greenGoods: makeGreenGoodsState({
      status: 'linked',
      gardenAddress: '0x1234567890abcdef1234567890abcdef12345678',
      memberBindings: [],
    }),
    ...(overrides as Parameters<typeof makeCoopState>[0]),
  });
}

function makeGardenerBundle(overrides: Partial<ActionBundle> = {}): ActionBundle {
  return {
    id: 'bundle-1',
    actionClass: 'green-goods-add-gardener',
    status: 'queued',
    createdAt: '2026-03-01T10:00:00.000Z',
    payload: {
      memberId: 'member-1',
      gardenerAddress: '0xgardenmember1',
    },
    ...overrides,
  } as unknown as ActionBundle;
}

function buildProps(overrides: Partial<RoostTabProps> = {}): RoostTabProps {
  const activeCoop = createCoop();
  return {
    activeCoop,
    activeMember: activeCoop.members[0],
    allCoops: [activeCoop],
    selectActiveCoop: vi.fn(),
    greenGoodsActionQueue: [],
    summary: {
      routedTabs: 2,
      pendingDrafts: 3,
      staleObservationCount: 1,
    } as RoostTabProps['summary'],
    agentDashboard: null,
    onProvisionMemberOnchainAccount: vi.fn(),
    onSubmitGreenGoodsWorkSubmission: vi.fn(),
    onRunAgentCycle: vi.fn(),
    onApproveAgentPlan: vi.fn(),
    onRejectAgentPlan: vi.fn(),
    onOpenSynthesisSegment: vi.fn(),
    ...overrides,
  };
}

afterEach(() => {
  accessSummarySpy.mockReset();
  provisionPropsSpy.mockReset();
});

describe('RoostTab interactions', () => {
  it('defaults to the Focus sub-tab', () => {
    render(<RoostTab {...buildProps()} />);

    const focusButton = screen.getByRole('button', { name: /focus/i });
    const agentButton = screen.getByRole('button', { name: /^agent$/i });
    const gardenButton = screen.getByRole('button', { name: /^garden$/i });
    expect(focusButton.className).toContain('is-active');
    expect(focusButton).toHaveAttribute('aria-pressed', 'true');
    expect(agentButton).toHaveAttribute('aria-pressed', 'false');
    expect(gardenButton).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText(/what's next/i)).toBeInTheDocument();
  });

  it('switches between Focus, Agent, and Garden sub-tabs', async () => {
    const user = userEvent.setup();
    render(<RoostTab {...buildProps()} />);

    // Focus is default
    expect(screen.getByText(/what's next/i)).toBeInTheDocument();

    // Switch to Agent
    await user.click(screen.getByRole('button', { name: /^agent$/i }));
    expect(screen.getByRole('button', { name: /focus/i })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: /^agent$/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: /^garden$/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.queryByText(/what's next/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /run now/i })).toBeInTheDocument();

    // Switch to Garden
    await user.click(screen.getByRole('button', { name: /^garden$/i }));
    expect(screen.getByRole('button', { name: /focus/i })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: /^agent$/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByRole('button', { name: /^garden$/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.queryByRole('button', { name: /run now/i })).not.toBeInTheDocument();
    expect(screen.getByText(/capital & payouts/i)).toBeInTheDocument();

    // Switch back to Focus
    await user.click(screen.getByRole('button', { name: /focus/i }));
    expect(screen.getByRole('button', { name: /focus/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /^agent$/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByRole('button', { name: /^garden$/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByText(/what's next/i)).toBeInTheDocument();
  });

  it("shows What's Next items when drafts and stale observations exist", () => {
    render(<RoostTab {...buildProps()} />);

    expect(screen.getByText(/3 drafts ready for review/i)).toBeInTheDocument();
    expect(screen.getByText(/1 stale observation/i)).toBeInTheDocument();
  });

  it('shows "All caught up" when no items need attention', () => {
    render(
      <RoostTab
        {...buildProps({
          summary: {
            routedTabs: 0,
            pendingDrafts: 0,
            staleObservationCount: 0,
          } as RoostTabProps['summary'],
        })}
      />,
    );

    expect(screen.getByText(/all caught up/i)).toBeInTheDocument();
  });

  it('opens review and switches the active coop', async () => {
    const user = userEvent.setup();
    const alpha = createCoop();
    const beta = createCoop({
      profile: {
        ...createCoop().profile,
        id: 'coop-2',
        name: 'Beta Coop',
      },
    });
    const selectActiveCoop = vi.fn();
    const onOpenSynthesisSegment = vi.fn();

    render(
      <RoostTab
        {...buildProps({
          activeCoop: alpha,
          allCoops: [alpha, beta],
          selectActiveCoop,
          onOpenSynthesisSegment,
        })}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Beta Coop' }));
    await user.click(screen.getByRole('button', { name: /review/i }));

    expect(selectActiveCoop).toHaveBeenCalledWith('coop-2');
    expect(onOpenSynthesisSegment).toHaveBeenCalledWith('review');
  });

  it('triggers agent cycle from the Agent tab Run Now button', async () => {
    const user = userEvent.setup();
    const onRunAgentCycle = vi.fn();

    render(<RoostTab {...buildProps({ onRunAgentCycle })} />);

    await user.click(screen.getByRole('button', { name: /^agent$/i }));
    await user.click(screen.getByRole('button', { name: /run now/i }));

    expect(onRunAgentCycle).toHaveBeenCalledOnce();
  });

  it('disables Run Now button and shows Running label while agent is running', async () => {
    const user = userEvent.setup();

    render(<RoostTab {...buildProps({ agentRunning: true })} />);

    await user.click(screen.getByRole('button', { name: /^agent$/i }));

    const runButton = screen.getByRole('button', { name: /running/i });
    expect(runButton).toBeDisabled();
    expect(runButton).toHaveTextContent('Running...');
  });

  it('shows progressive onboarding on Garden tab when garden is requested', async () => {
    const user = userEvent.setup();
    render(
      <RoostTab
        {...buildProps({
          activeCoop: createCoop({
            greenGoods: makeGreenGoodsState({
              status: 'requested',
              gardenAddress: undefined,
              memberBindings: [],
            }),
          }),
        })}
      />,
    );

    await user.click(screen.getByRole('button', { name: /garden/i }));

    expect(screen.getByText(/garden requested/i)).toBeInTheDocument();
    expect(screen.getByText(/operator agent will provision/i)).toBeInTheDocument();
  });

  it('shows provision button on Garden tab when garden is linked but member needs account', async () => {
    const user = userEvent.setup();
    render(
      <RoostTab
        {...buildProps({
          activeCoop: createCoop({
            greenGoods: makeGreenGoodsState({
              status: 'linked',
              gardenAddress: '0x1234567890abcdef1234567890abcdef12345678',
              memberBindings: [],
            }),
            memberAccounts: [],
          }),
        })}
      />,
    );

    await user.click(screen.getByRole('button', { name: /garden/i }));

    expect(screen.getByText(/garden is live/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /provision my garden account/i }),
    ).toBeInTheDocument();
  });

  it('shows the disabled state on Garden tab when Green Goods is off', async () => {
    const user = userEvent.setup();
    render(
      <RoostTab
        {...buildProps({
          activeCoop: createCoop({
            greenGoods: makeGreenGoodsState({
              enabled: false,
              status: 'disabled',
              gardenAddress: undefined,
              memberBindings: [],
            }),
          }),
        })}
      />,
    );

    await user.click(screen.getByRole('button', { name: /garden/i }));

    expect(screen.getByText(/green goods is not enabled/i)).toBeInTheDocument();
  });

  it('renders the Green Goods workflow on the Garden tab when ready and filters gardener bundles', async () => {
    const user = userEvent.setup();
    const activeCoop = createCoop({
      memberAccounts: [
        makeMemberOnchainAccount({
          memberId: 'member-1',
          accountAddress: '0x1234567890abcdef1234567890abcdef12345678',
        }),
      ],
      greenGoods: makeGreenGoodsState({
        status: 'linked',
        gardenAddress: '0x1234567890abcdef1234567890abcdef12345678',
        lastWorkSubmissionAt: '2026-03-01T12:00:00.000Z',
        memberBindings: [
          makeGreenGoodsMemberBinding({
            memberId: 'member-1',
            status: 'synced',
            actorAddress: '0x1234567890abcdef1234567890abcdef12345678',
            desiredRoles: ['gardener'],
            currentRoles: ['gardener'],
          }),
        ],
      }),
    });
    const onProvisionMemberOnchainAccount = vi.fn();
    const onSubmitGreenGoodsWorkSubmission = vi.fn();

    render(
      <RoostTab
        {...buildProps({
          activeCoop,
          activeMember: activeCoop.members[0],
          greenGoodsActionQueue: [
            makeGardenerBundle(),
            makeGardenerBundle({
              id: 'bundle-2',
              payload: {
                memberId: 'member-2',
                gardenerAddress: '0xgardenmember2',
              },
            }),
            makeGardenerBundle({
              id: 'bundle-3',
              actionClass: 'green-goods-submit-work-submission',
            }),
          ],
          onProvisionMemberOnchainAccount,
          onSubmitGreenGoodsWorkSubmission,
        })}
      />,
    );

    // Switch to Garden tab to see Green Goods content
    await user.click(screen.getByRole('button', { name: /garden/i }));

    await user.click(screen.getByRole('button', { name: /provision garden access/i }));
    await user.click(screen.getByRole('button', { name: /submit mocked work/i }));

    expect(accessSummarySpy).toHaveBeenCalledTimes(1);
    expect(accessSummarySpy.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        memberGardenerBundles: [
          expect.objectContaining({
            id: 'bundle-1',
          }),
        ],
      }),
    );
    expect(provisionPropsSpy).toHaveBeenCalledWith({ canSubmit: true });
    expect(onProvisionMemberOnchainAccount).toHaveBeenCalledOnce();
    expect(onSubmitGreenGoodsWorkSubmission).toHaveBeenCalledWith({
      actionUid: 7,
      title: 'Watershed update',
      feedback: 'Riparian repair complete',
      metadataCid: 'bafy-meta',
      mediaCids: ['bafy-media'],
    });
    expect(
      screen.queryByText(/provision your garden account and wait for garden linking/i),
    ).not.toBeInTheDocument();
  });
});

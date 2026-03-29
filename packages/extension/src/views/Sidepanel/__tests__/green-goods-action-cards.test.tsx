import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  GreenGoodsAccessSummary,
  GreenGoodsProvisionButton,
  GreenGoodsWorkSubmissionForm,
} from '../cards/GreenGoodsActionCards';

describe('GreenGoods action cards', () => {
  it('renders garden access details and queued member bundles', () => {
    render(
      <GreenGoodsAccessSummary
        activeCoop={
          {
            greenGoods: {
              gardenAddress: '0xgarden',
              lastWorkSubmissionAt: '2026-03-28T00:00:00.000Z',
            },
          } as never
        }
        memberAccount={
          {
            status: 'active',
            accountType: 'member',
            accountAddress: '0xmember',
            statusNote: 'Synced to the garden.',
          } as never
        }
        memberBinding={{
          status: 'pending-sync',
          actorAddress: '0xactor',
          lastSyncedAt: '2026-03-28T01:00:00.000Z',
        }}
        memberGardenerBundles={[
          {
            id: 'bundle-1',
            status: 'queued',
            actionClass: 'green-goods-add-gardener',
            payload: {
              gardenerAddress: '0xmember',
            },
            createdAt: '2026-03-28T01:30:00.000Z',
          } as never,
        ]}
      />,
    );

    expect(screen.getByText('Linked')).toBeInTheDocument();
    expect(screen.getByText('queued')).toBeInTheDocument();
    expect(screen.getByText('Add gardener')).toBeInTheDocument();
    expect(screen.getAllByText('0xmember')).toHaveLength(2);
    expect(screen.getByText('Synced to the garden.')).toBeInTheDocument();
  });

  it('submits work with parsed numeric and CID values', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async () => undefined);

    render(<GreenGoodsWorkSubmissionForm onSubmit={onSubmit} />);

    await user.clear(screen.getByLabelText('Action UID'));
    await user.type(screen.getByLabelText('Action UID'), '42');
    await user.type(screen.getByLabelText('Submission title'), 'Patch wetland outlet');
    await user.type(screen.getByLabelText('Feedback'), 'Completed with local team.');
    await user.type(screen.getByLabelText('Metadata CID'), 'bafy-meta');
    await user.type(screen.getByLabelText('Media CIDs'), 'bafy-one, bafy-two\nbafy-three');
    await user.click(screen.getByRole('button', { name: 'Submit work submission' }));

    expect(onSubmit).toHaveBeenCalledWith({
      actionUid: 42,
      title: 'Patch wetland outlet',
      feedback: 'Completed with local team.',
      metadataCid: 'bafy-meta',
      mediaCids: ['bafy-one', 'bafy-two', 'bafy-three'],
    });
  });

  it('renders the right provision guidance based on account state', async () => {
    const user = userEvent.setup();
    const onProvision = vi.fn(async () => undefined);
    const { rerender } = render(
      <GreenGoodsProvisionButton
        memberAccount={undefined}
        gardenAddress={undefined}
        canSubmit={false}
        onProvision={onProvision}
      />,
    );

    expect(screen.getByRole('button', { name: 'Provision my garden account' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Wait for the coop garden to be linked before submitting member attestations.',
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Provision my garden account' }));
    expect(onProvision).toHaveBeenCalledTimes(1);

    rerender(
      <GreenGoodsProvisionButton
        memberAccount={{ accountAddress: '0xmember' } as never}
        gardenAddress="0xgarden"
        canSubmit={false}
        onProvision={onProvision}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Refresh local garden account' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Provision your local garden account first. Once the address is predicted, this browser can submit work from your member smart account.',
      ),
    ).toBeInTheDocument();
  });
});

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ArchiveSetupWizard } from '../ArchiveSetupWizard';

const { sendRuntimeMessageMock } = vi.hoisted(() => ({
  sendRuntimeMessageMock: vi.fn(),
}));

vi.mock('../../../runtime/messages', () => ({
  sendRuntimeMessage: sendRuntimeMessageMock,
}));

describe('ArchiveSetupWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders connected archive status and disconnects when requested', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn(async () => undefined);
    const setMessage = vi.fn();
    sendRuntimeMessageMock.mockResolvedValue({ ok: true });

    render(
      <ArchiveSetupWizard
        coopId="coop-1"
        coopName="River Coop"
        archiveConfig={{
          enabled: true,
          spaceDid: 'did:key:z6Mkarchiveproofspace',
          gatewayBaseUrl: 'https://storacha.link',
          proofStrategy: 'storacha',
        }}
        onComplete={onComplete}
        setMessage={setMessage}
      />,
    );

    expect(screen.getByText('Live')).toBeInTheDocument();
    expect(screen.getByText('https://storacha.link')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Disconnect' }));

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(sendRuntimeMessageMock).toHaveBeenCalledWith({
      type: 'remove-coop-archive-config',
      payload: { coopId: 'coop-1' },
    });
    expect(setMessage).toHaveBeenCalledWith('Filecoin archiving disconnected.');
  });

  it('requires a valid email before provisioning', async () => {
    const user = userEvent.setup();

    render(
      <ArchiveSetupWizard
        coopId="coop-1"
        coopName="River Coop"
        onComplete={vi.fn()}
        setMessage={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument();
    expect(sendRuntimeMessageMock).not.toHaveBeenCalled();
  });

  it('provisions archive space and marks archiving live after success', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn(async () => undefined);
    const setMessage = vi.fn();
    sendRuntimeMessageMock.mockResolvedValue({
      ok: true,
      data: { spaceDid: 'did:key:z6Mkspace1234567890abcdef' },
    });

    render(
      <ArchiveSetupWizard
        coopId="coop-1"
        coopName="River Coop"
        onComplete={onComplete}
        setMessage={setMessage}
      />,
    );

    await user.type(screen.getByLabelText('Email'), 'ari@example.com');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => expect(screen.getByText('Archiving is live')).toBeInTheDocument());
    expect(sendRuntimeMessageMock).toHaveBeenCalledWith({
      type: 'provision-archive-space',
      payload: {
        coopId: 'coop-1',
        email: 'ari@example.com',
        coopName: 'River Coop',
      },
    });
    expect(setMessage).toHaveBeenCalledWith('Filecoin archiving is live.');
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('returns to the email step and shows runtime errors when provisioning fails', async () => {
    const user = userEvent.setup();
    sendRuntimeMessageMock.mockResolvedValue({
      ok: false,
      error: 'Verification could not be completed.',
    });

    render(
      <ArchiveSetupWizard
        coopId="coop-1"
        coopName="River Coop"
        onComplete={vi.fn()}
        setMessage={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText('Email'), 'ari@example.com');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() =>
      expect(screen.getByText('Verification could not be completed.')).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
  });
});

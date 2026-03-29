import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CaptureView } from '../CaptureView';
import { InboxView } from '../InboxView';

function makeCapture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'capture-1',
    deviceId: 'device-1',
    kind: 'file',
    title: 'Field note',
    mimeType: 'text/plain',
    byteSize: 128,
    syncState: 'queued',
    createdAt: '2026-03-28T00:00:00.000Z',
    updatedAt: '2026-03-28T00:00:00.000Z',
    intakeStatus: 'private-intake',
    ...overrides,
  } as never;
}

describe('receiver view actions', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('wires capture controls, file pickers, and preview actions', () => {
    const onStartRecording = vi.fn();
    const onFinishRecording = vi.fn();
    const onPickFile = vi.fn();
    const onShareCapture = vi.fn();
    const onNavigateInbox = vi.fn();
    const onNavigatePair = vi.fn();
    const inputClick = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
    const newestCapture = makeCapture({
      id: 'capture-photo',
      kind: 'photo',
      title: 'Canopy photo',
      mimeType: 'image/webp',
      byteSize: 2048,
    });
    const newestCard = { capture: newestCapture, previewUrl: 'blob:photo' };

    const { container, rerender } = render(
      <CaptureView
        isRecording={false}
        newestCapture={newestCapture}
        hatchedCaptureId="capture-photo"
        captures={[newestCard]}
        pairingReady={false}
        canShare
        photoInputRef={{ current: null }}
        fileInputRef={{ current: null }}
        onStartRecording={onStartRecording}
        onFinishRecording={onFinishRecording}
        onPickFile={onPickFile}
        onShareCapture={onShareCapture}
        onNavigateInbox={onNavigateInbox}
        onNavigatePair={onNavigatePair}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Start recording' }));
    fireEvent.click(screen.getByRole('button', { name: 'Take photo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Attach file' }));

    const photoInput = container.querySelector('input[aria-label="Take photo"]');
    const fileInput = container.querySelector('input[aria-label="Attach file"]');
    expect(photoInput).not.toBeNull();
    expect(fileInput).not.toBeNull();
    if (!photoInput || !fileInput) {
      throw new Error('Expected receiver file inputs to render');
    }

    fireEvent.change(photoInput, {
      target: {
        files: [new File(['photo'], 'canopy.jpg', { type: 'image/jpeg' })],
      },
    });
    fireEvent.change(fileInput, {
      target: {
        files: [new File(['file'], 'field-notes.pdf', { type: 'application/pdf' })],
      },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Open inbox' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mate to sync' }));
    fireEvent.click(screen.getByRole('button', { name: 'Share' }));

    expect(onStartRecording).toHaveBeenCalledTimes(1);
    expect(inputClick).toHaveBeenCalledTimes(2);
    expect(onPickFile.mock.calls.map(([, kind]) => kind)).toEqual(['photo', 'file']);
    expect(onNavigateInbox).toHaveBeenCalledTimes(1);
    expect(onNavigatePair).toHaveBeenCalledTimes(1);
    expect(onShareCapture).toHaveBeenCalledWith(newestCard);

    rerender(
      <CaptureView
        isRecording
        newestCapture={newestCapture}
        hatchedCaptureId="capture-photo"
        captures={[newestCard]}
        pairingReady
        canShare={false}
        photoInputRef={{ current: null }}
        fileInputRef={{ current: null }}
        onStartRecording={onStartRecording}
        onFinishRecording={onFinishRecording}
        onPickFile={onPickFile}
        onShareCapture={onShareCapture}
        onNavigateInbox={onNavigateInbox}
        onNavigatePair={onNavigatePair}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Stop recording' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save voice note' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onFinishRecording).toHaveBeenCalledWith('save');
    expect(onFinishRecording).toHaveBeenCalledWith('cancel');
  });

  it('renders inbox media states and routes share, copy, download, and retry actions', () => {
    const onShareCapture = vi.fn();
    const onCopyCaptureLink = vi.fn();
    const onDownloadCapture = vi.fn();
    const onRetrySync = vi.fn();
    const linkCard = {
      capture: makeCapture({
        id: 'link-1',
        kind: 'link',
        title: 'Shared trail',
        sourceUrl: 'https://example.com/trail',
        note: 'Trail note',
      }),
    };
    const audioCard = {
      capture: makeCapture({
        id: 'audio-1',
        kind: 'audio',
        title: 'Birdsong',
        mimeType: 'audio/webm',
      }),
      previewUrl: 'blob:audio',
    };
    const photoCard = {
      capture: makeCapture({
        id: 'photo-1',
        kind: 'photo',
        title: 'Canopy',
        mimeType: 'image/webp',
      }),
      previewUrl: 'blob:photo',
    };
    const failedFileCard = {
      capture: makeCapture({
        id: 'file-1',
        kind: 'file',
        title: 'Spec',
        mimeType: 'application/pdf',
        syncState: 'failed',
        syncError: 'Need a fresh pairing.',
      }),
      previewUrl: 'blob:file',
    };

    const { container } = render(
      <InboxView
        captures={[linkCard, audioCard, photoCard, failedFileCard]}
        hatchedCaptureId="photo-1"
        canShare
        onShareCapture={onShareCapture}
        onCopyCaptureLink={onCopyCaptureLink}
        onDownloadCapture={onDownloadCapture}
        onRetrySync={onRetrySync}
      />,
    );

    expect(screen.getByRole('link', { name: 'https://example.com/trail' })).toHaveAttribute(
      'href',
      'https://example.com/trail',
    );
    expect(screen.getByAltText('Canopy')).toHaveAttribute('src', 'blob:photo');
    expect(container.querySelector('audio')).toHaveAttribute('src', 'blob:audio');
    expect(screen.getByText('Trail note')).toBeInTheDocument();
    expect(screen.getByText('Need a fresh pairing.')).toBeInTheDocument();

    const linkArticle = screen.getByText('Shared trail').closest('article');
    const failedFileArticle = screen.getByText('Spec').closest('article');
    expect(linkArticle).not.toBeNull();
    expect(failedFileArticle).not.toBeNull();
    if (!linkArticle || !failedFileArticle) {
      throw new Error('Expected receiver inbox articles to render');
    }

    fireEvent.click(within(linkArticle).getByRole('button', { name: 'Share' }));
    fireEvent.click(within(linkArticle).getByRole('button', { name: 'Copy link' }));
    fireEvent.click(within(failedFileArticle).getByRole('button', { name: 'Download local file' }));
    fireEvent.click(within(failedFileArticle).getByRole('button', { name: 'Retry sync' }));

    expect(onShareCapture).toHaveBeenCalledWith(linkCard);
    expect(onCopyCaptureLink).toHaveBeenCalledWith(linkCard.capture);
    expect(onDownloadCapture).toHaveBeenCalledWith(failedFileCard);
    expect(onRetrySync).toHaveBeenCalledWith('file-1');
  });
});

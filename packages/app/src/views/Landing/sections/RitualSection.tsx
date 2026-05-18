import type { SetupInsightsInput } from '@coop/shared/app';
import {
  clipboardPasteFallbackMessage,
  type getRitualLenses,
  pasteClipboardText,
} from '@coop/shared/app';
import type { CSSProperties, MutableRefObject, RefObject } from 'react';
import { useI18n } from '../../../hooks/useI18n';
import { defaultTranscriptStatus, ritualCardMappings, statusLabel } from '../landing-data';
import type {
  AudienceId,
  LensProgress,
  SetupFieldKey,
  TranscriptKey,
  TranscriptMap,
} from '../landing-types';

type RitualLens = ReturnType<typeof getRitualLenses>[number];

export type RitualSectionProps = {
  ritualSectionRef: RefObject<HTMLElement | null>;
  setupInput: SetupInsightsInput;
  transcripts: TranscriptMap;
  audience: AudienceId;
  openCardId: TranscriptKey | null;
  sharedNotes: string;
  copyState: 'idle' | 'copied' | 'failed';
  recordingLens: TranscriptKey | null;
  transcriptStatus: string;
  transcriptStatusCardId: TranscriptKey | null;
  ritualLenses: RitualLens[];
  lensProgress: LensProgress[];
  allLensesReady: boolean;
  completedLensCount: number;
  setupPacketText: string;
  flashcardTriggerRefs: MutableRefObject<Record<TranscriptKey, HTMLButtonElement | null>>;
  flashcardCloseRefs: MutableRefObject<Record<TranscriptKey, HTMLButtonElement | null>>;
  flashcardNotesRefs: MutableRefObject<Record<TranscriptKey, HTMLTextAreaElement | null>>;
  setSharedNotes: (value: string) => void;
  updateField: (key: SetupFieldKey, value: string) => void;
  updateTranscript: (key: TranscriptKey, value: string) => void;
  toggleCard: (cardId: TranscriptKey) => void;
  closeOpenCard: () => void;
  resetRitual: () => void;
  copySetupNotes: () => Promise<void>;
  downloadSetupNotes: () => void;
  startRecording: (cardId: TranscriptKey) => void;
  stopRecording: () => void;
  setScopedTranscriptStatus: (cardId: TranscriptKey, message: string) => void;
};

export function RitualSection({
  ritualSectionRef,
  setupInput,
  transcripts,
  audience,
  openCardId,
  sharedNotes,
  copyState,
  recordingLens,
  transcriptStatus,
  transcriptStatusCardId,
  ritualLenses,
  lensProgress,
  allLensesReady,
  completedLensCount,
  setupPacketText,
  flashcardTriggerRefs,
  flashcardCloseRefs,
  flashcardNotesRefs,
  setSharedNotes,
  updateField,
  updateTranscript,
  toggleCard,
  closeOpenCard,
  resetRitual,
  copySetupNotes,
  downloadSetupNotes,
  startRecording,
  stopRecording,
  setScopedTranscriptStatus,
}: RitualSectionProps) {
  const { t } = useI18n();

  const openCardIndex = openCardId ? ritualLenses.findIndex((lens) => lens.id === openCardId) : -1;
  const openCardLens = openCardIndex >= 0 ? ritualLenses[openCardIndex] : null;
  const openCardMapping = openCardIndex >= 0 ? ritualCardMappings[openCardIndex] : null;
  const openCardProgress = openCardIndex >= 0 ? lensProgress[openCardIndex] : null;

  function setFlashcardTriggerRef(id: TranscriptKey) {
    return (node: HTMLButtonElement | null) => {
      flashcardTriggerRefs.current[id] = node;
    };
  }

  function setFlashcardCloseRef(id: TranscriptKey) {
    return (node: HTMLButtonElement | null) => {
      flashcardCloseRefs.current[id] = node;
    };
  }

  function setFlashcardNotesRef(id: TranscriptKey) {
    return (node: HTMLTextAreaElement | null) => {
      flashcardNotesRefs.current[id] = node;
    };
  }

  function renderOpenCardStage() {
    if (!openCardLens || !openCardMapping || !openCardProgress) {
      return null;
    }

    const isDone = openCardProgress.status === 'ready';
    const isLeftColumn = openCardIndex % 2 === 0;
    const isTopRow = openCardIndex < 2;
    const stageStyle = {
      '--flashcard-pickup-x': isLeftColumn ? '-2.35rem' : '2.35rem',
      '--flashcard-pickup-y': isTopRow ? '-1.1rem' : '1.1rem',
      '--flashcard-pickup-tilt': isLeftColumn ? '-2deg' : '2deg',
      '--flashcard-pickup-settle-tilt': isLeftColumn ? '0.35deg' : '-0.35deg',
    } as CSSProperties;

    return (
      <dialog
        aria-label={openCardLens.title}
        aria-modal="false"
        className={`flashcard-stage flashcard-${openCardLens.id}${isDone ? ' is-done' : ''}`}
        id={`flashcard-panel-${openCardLens.id}`}
        open
        style={stageStyle}
      >
        <div className="flashcard-stage-header">
          <div className="flashcard-front-meta">
            <span className="flashcard-number">
              {t('ritual.lens')} {openCardIndex + 1}
            </span>
            <span className={`flashcard-status-pill is-${openCardProgress.status}`}>
              {statusLabel(openCardProgress.status, t)}
            </span>
          </div>
          <button
            className="flashcard-close-btn"
            onClick={closeOpenCard}
            ref={setFlashcardCloseRef(openCardLens.id)}
            type="button"
            aria-label={t('ritual.closeCardLabel')}
          >
            {'\u00D7'}
          </button>
        </div>

        <div className="flashcard-stage-copy">
          <p className="flashcard-stage-label">{openCardLens.title}</p>
          <h3 className="flashcard-question">{openCardLens.transcriptPrompt}</h3>
          <p className="flashcard-detail">{openCardLens.detail}</p>
        </div>

        <div className="flashcard-stage-actions">
          <button
            className={
              recordingLens === openCardLens.id
                ? 'button button-primary button-small ritual-record-button is-recording'
                : 'button button-secondary button-small ritual-record-button'
            }
            onClick={() =>
              recordingLens === openCardLens.id ? stopRecording() : startRecording(openCardLens.id)
            }
            type="button"
          >
            <span className="record-dot" aria-hidden="true" />
            {recordingLens === openCardLens.id
              ? t('ritual.stopRecordButton')
              : t('ritual.recordButton')}
          </button>

          <button
            className="button button-secondary button-small"
            onClick={async () => {
              const result = await pasteClipboardText({
                currentValue: transcripts[openCardLens.id],
                mode: 'append',
              });
              if (result.status === 'success') {
                updateTranscript(openCardLens.id, result.value);
                return;
              }
              if (result.status === 'unavailable') {
                setScopedTranscriptStatus(openCardLens.id, clipboardPasteFallbackMessage);
              }
            }}
            type="button"
          >
            {t('ritual.pasteButton')}
          </button>
        </div>

        <output
          aria-live="polite"
          className={`ritual-transcript-status${
            recordingLens === openCardLens.id ||
            transcripts[openCardLens.id] ||
            (
              transcriptStatusCardId === openCardLens.id &&
                transcriptStatus !== defaultTranscriptStatus
            )
              ? ' is-active'
              : ''
          }`}
        >
          {transcriptStatus}
        </output>

        <label className="ritual-field flashcard-notes-field">
          <span className="sr-only">
            {openCardLens.title} {t('ritual.notesSrLabel')}
          </span>
          <textarea
            aria-label={`${openCardLens.title} ${t('ritual.notesSrLabel')}`}
            onChange={(event) => updateTranscript(openCardLens.id, event.target.value)}
            placeholder={t('ritual.notesPlaceholder')}
            ref={setFlashcardNotesRef(openCardLens.id)}
            value={transcripts[openCardLens.id]}
          />
        </label>

        <div className="flashcard-stage-footer">
          <p className="flashcard-stage-footnote">
            {isDone ? t('ritual.readyMessage') : t('ritual.captureMessage')}
          </p>
          <button
            className={isDone ? 'flashcard-complete-btn is-done' : 'flashcard-complete-btn'}
            onClick={() => {
              if (!isDone) {
                updateField(
                  openCardMapping.currentKey,
                  setupInput[openCardMapping.currentKey] || 'Captured',
                );
                updateField(
                  openCardMapping.painKey,
                  setupInput[openCardMapping.painKey] || 'Captured',
                );
                updateField(
                  openCardMapping.improveKey,
                  setupInput[openCardMapping.improveKey] || 'Captured',
                );
              }
              toggleCard(openCardLens.id);
            }}
            type="button"
          >
            {isDone ? t('ritual.completeButton') : t('ritual.markCompleteButton')}
          </button>
        </div>
      </dialog>
    );
  }

  return (
    <section className="section ritual-section" id="ritual" ref={ritualSectionRef}>
      <div className="section-heading ritual-section-heading">
        <h2>{t('ritual.heading')}</h2>
        <p className="lede ritual-section-copy">{t('ritual.description')}</p>
      </div>

      <aside className="landing-trust-strip" aria-label={t('trust.heading')}>
        <p className="landing-trust-strip__eyebrow">{t('trust.heading')}</p>
        <ul className="landing-trust-strip__points">
          <li>{t('trust.points.onDevice')}</li>
          <li>{t('trust.points.multimodal')}</li>
          <li>{t('trust.points.offline')}</li>
          <li>{t('trust.points.noCloud')}</li>
          <li>{t('trust.points.openSource')}</li>
        </ul>
        <p className="landing-trust-strip__tagline">{t('trust.tagline')}</p>
      </aside>

      <div className="ritual-game-shell nest-card" data-audience={audience}>
        <div className="ritual-toolbar">
          <span className="ritual-local-badge" aria-label={t('ritual.localBadgeLabel')}>
            <svg
              aria-hidden="true"
              className="ritual-local-icon"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M8 1C5.8 1 4 2.8 4 5v2H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-1V5c0-2.2-1.8-4-4-4Zm0 1.5A2.5 2.5 0 0 1 10.5 5v2h-5V5A2.5 2.5 0 0 1 8 2.5Z"
                fill="currentColor"
              />
            </svg>
            {t('ritual.localBadgeLabel')}
          </span>

          <button
            className="button button-secondary button-small ritual-reset-inline"
            onClick={resetRitual}
            type="button"
          >
            {t('ritual.resetButton')}
          </button>
        </div>

        <div className={`flashcard-deck${openCardLens ? ' has-open-card' : ''}`}>
          <div className={`flashcard-focus-shell${openCardLens ? ' is-active' : ''}`}>
            {openCardLens ? (
              <button
                aria-label={t('ritual.closeCardBackdrop')}
                className="flashcard-focus-backdrop"
                onClick={closeOpenCard}
                type="button"
              />
            ) : null}
            {renderOpenCardStage()}
          </div>

          <div className="flashcard-grid">
            {ritualLenses.map((lens, index) => {
              const progress = lensProgress[index];
              const isOpen = openCardId === lens.id;
              const isDone = progress.status === 'ready';
              const isMuted = openCardId !== null && openCardId !== lens.id;

              return (
                <article
                  className={[
                    'flashcard',
                    `flashcard-${lens.id}`,
                    isOpen ? 'is-open-source' : '',
                    isMuted ? 'is-muted' : '',
                    isDone ? 'is-done' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  key={lens.id}
                >
                  <button
                    aria-controls={`flashcard-panel-${lens.id}`}
                    aria-expanded={isOpen}
                    aria-haspopup="dialog"
                    className="flashcard-front"
                    onClick={() => toggleCard(lens.id)}
                    ref={setFlashcardTriggerRef(lens.id)}
                    type="button"
                  >
                    <div className="flashcard-front-top">
                      <div className="flashcard-front-meta">
                        <span className="flashcard-number">
                          {t('ritual.lens')} {index + 1}
                        </span>
                        <span className={`flashcard-status-pill is-${progress.status}`}>
                          {statusLabel(progress.status, t)}
                        </span>
                      </div>
                      <h3>{lens.title}</h3>
                      <p>{lens.detail}</p>
                    </div>

                    <div className="flashcard-front-bottom">
                      {isDone ? (
                        <span
                          className="flashcard-check"
                          aria-label={t('ritual.completeCheckmark')}
                        >
                          &#10003;
                        </span>
                      ) : null}
                    </div>
                  </button>
                </article>
              );
            })}
          </div>
        </div>

        {allLensesReady ? (
          <div className="ritual-synthesis">
            <div className="section-heading">
              <h3>{t('ritual.setupPacketReady')}</h3>
              <p className="lede">{t('ritual.setupPacketReadyDesc')}</p>
            </div>

            <div className="ritual-setup-grid">
              <label className="ritual-field">
                <span>{t('ritual.coopNameLabel')}</span>
                <input
                  onChange={(event) => updateField('coopName', event.target.value)}
                  placeholder={t('ritual.coopNamePlaceholder')}
                  type="text"
                  value={setupInput.coopName}
                />
              </label>

              <label className="ritual-field">
                <span>{t('ritual.purposeLabel')}</span>
                <textarea
                  onChange={(event) => updateField('purpose', event.target.value)}
                  placeholder={t('ritual.purposePlaceholder')}
                  value={setupInput.purpose}
                />
              </label>
            </div>

            <label className="ritual-field">
              <span>{t('ritual.sharedNotesLabel')}</span>
              <textarea
                onChange={(event) => setSharedNotes(event.target.value)}
                placeholder={t('ritual.sharedNotesPlaceholder')}
                value={sharedNotes}
              />
            </label>

            <div className="prompt-shell ritual-packet-shell">
              <div className="prompt-toolbar">
                <div>
                  <strong>{t('ritual.setupPacketLabel')}</strong>
                  <div>{t('ritual.setupPacketDesc')}</div>
                </div>
                <div className="cta-row packet-actions">
                  <button
                    className={
                      copyState === 'copied'
                        ? 'button button-primary button-small'
                        : 'button button-secondary button-small'
                    }
                    onClick={() => void copySetupNotes()}
                    type="button"
                  >
                    {copyState === 'copied'
                      ? t('ritual.copiedButton')
                      : copyState === 'failed'
                        ? t('ritual.clipboardUnavailableButton')
                        : t('ritual.copyPacketButton')}
                  </button>
                  <button
                    className="button button-secondary button-small"
                    onClick={downloadSetupNotes}
                    type="button"
                  >
                    {t('ritual.downloadButton')}
                  </button>
                </div>
              </div>
              <pre>{setupPacketText}</pre>
            </div>
          </div>
        ) : (
          <p className="ritual-progress-hint">
            {completedLensCount > 0
              ? `${completedLensCount} ${t('ritual.progressPartial')}`
              : t('ritual.progressStart')}
          </p>
        )}
      </div>
    </section>
  );
}

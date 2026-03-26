import type { ArtifactCategory } from '@coop/shared';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { PopupSubheader, type PopupSubheaderTag } from './PopupSubheader';
import type { PopupRecordingStatus } from './hooks/usePopupRecording';

export interface YardItem {
  id: string;
  type: 'draft' | 'artifact';
  category?: ArtifactCategory;
  isExternal?: boolean;
}

function categoryGroup(cat?: ArtifactCategory): string | undefined {
  if (!cat) return undefined;
  if (cat === 'thought' || cat === 'insight') return 'thought';
  if (cat === 'opportunity' || cat === 'funding-lead') return 'opportunity';
  if (cat === 'resource' || cat === 'evidence') return 'resource';
  if (cat === 'ritual' || cat === 'coop-soul' || cat === 'setup-insight') return 'ritual';
  if (cat === 'seed-contribution') return 'seed';
  return undefined;
}

/* ── Deterministic pseudo-random from string ID ── */

function hashId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
}

/* ── SVG Icons ── */

function ChickenIcon({ flip }: { flip?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      style={flip ? { transform: 'scaleX(-1)' } : undefined}
      viewBox="0 0 20 20"
    >
      <ellipse cx="10" cy="11" rx="5.5" ry="4.5" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="6" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M4 7.5l-1.5-.8" stroke="currentColor" strokeLinecap="round" strokeWidth="1.3" />
      <path d="M5.2 6l-.4-1.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.2" />
      <circle cx="5.4" cy="7.6" fill="currentColor" r="0.6" />
      <path
        d="M8 15.5l-1 3M12 15.5l1 3"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.2"
      />
      <path
        d="M14.5 9c1-.3 1.8-1 2-1.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.2"
      />
    </svg>
  );
}

function ChickIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 16 16">
      <ellipse cx="8" cy="9.5" rx="4.5" ry="3.8" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="8" cy="5.5" r="3" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="6.8" cy="5" fill="currentColor" r="0.5" />
      <path d="M5.2 5.8l-1.2-.2" stroke="currentColor" strokeLinecap="round" strokeWidth="1.2" />
      <path
        d="M6.5 13.3l-.6 1.5M9.5 13.3l.6 1.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.1"
      />
    </svg>
  );
}

function CaptureTabIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 20 20">
      <rect height="12" rx="2" stroke="currentColor" strokeWidth="1.4" width="16" x="2" y="4" />
      <path d="M6 4V2.5h8V4" stroke="currentColor" strokeWidth="1.3" />
      <path d="M7 10h6M7 12.5h4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.3" />
    </svg>
  );
}

function ScreenshotIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 20 20">
      <rect height="12" rx="2.5" stroke="currentColor" strokeWidth="1.4" width="14" x="3" y="4" />
      <circle cx="10" cy="10.5" r="2.8" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="10" cy="10.5" fill="currentColor" r="1" />
    </svg>
  );
}

function MicrophoneIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 20 20">
      <rect height="10" rx="3" stroke="currentColor" strokeWidth="1.4" width="6" x="7" y="2" />
      <path
        d="M4.5 10a5.5 5.5 0 0 0 11 0"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.4"
      />
      <path d="M10 15.5V18" stroke="currentColor" strokeLinecap="round" strokeWidth="1.4" />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 20 20">
      <path
        d="M6 2.5h5l4 4V17.5H6z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.4"
      />
      <path d="M11 2.5v4h4" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.4" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 20 20">
      <path d="M10 4v12M4 10h12" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

function PasteIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 20 20">
      <rect height="12" rx="2" stroke="currentColor" strokeWidth="1.4" width="10" x="5" y="6" />
      <path d="M8 6V4.5a2 2 0 0 1 4 0V6" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 11h4M8 14h2" stroke="currentColor" strokeLinecap="round" strokeWidth="1.3" />
    </svg>
  );
}

/* ── Chicken Yard ── */

function ChickenYard({
  items,
}: {
  items: YardItem[];
}) {
  const positions = useMemo(() => {
    return items.map((item) => {
      const h = hashId(item.id);
      const rng = seededRandom(h);
      return {
        x: 8 + rng() * 84, // 8-92% horizontal
        y: 10 + rng() * 72, // 10-82% vertical
        flip: rng() > 0.5,
      };
    });
  }, [items]);

  const chickenSize = items.length > 0 ? Math.max(12, Math.min(20, 160 / items.length)) : 20;

  if (items.length === 0) {
    return (
      <div className="popup-yard popup-yard--empty" aria-label="Chicken yard">
        <div className="popup-yard__empty-chicken">
          <ChickenIcon />
        </div>
        <span className="popup-yard__empty-text">Round up your loose chickens</span>
      </div>
    );
  }

  return (
    <div className="popup-yard" aria-label="Chicken yard">
      {items.map((item, i) => {
        const pos = positions[i];
        const catGroup = categoryGroup(item.category);
        const externalClass = item.isExternal ? ' popup-yard__chicken--external' : '';
        return (
          <span
            className={`popup-yard__chicken popup-yard__chicken--${item.type}${externalClass}`}
            data-category={catGroup}
            key={item.id}
            style={{
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              width: item.type === 'artifact' ? chickenSize * 0.75 : chickenSize,
              height: item.type === 'artifact' ? chickenSize * 0.75 : chickenSize,
              animationDelay: `${i * 60}ms`,
            }}
          >
            {item.type === 'draft' ? <ChickenIcon flip={pos.flip} /> : <ChickIcon />}
          </span>
        );
      })}
    </div>
  );
}

/* ── Home Screen ── */

export function PopupHomeScreen(props: {
  statusItems: PopupSubheaderTag[];
  yardItems: YardItem[];
  noteText: string;
  onChangeNote: (value: string) => void;
  onSaveNote: () => void;
  onPaste: () => void;
  onRoundUp: () => void;
  onCaptureTab: () => void;
  onScreenshot: () => void;
  onFileSelected: (file: File) => void;
  isCapturing: boolean;
  isRecording: boolean;
  audioStatus: PopupRecordingStatus;
  audioPermissionMessage: string | null;
  elapsedSeconds: number;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onCancelRecording: () => void;
}) {
  const {
    statusItems,
    yardItems,
    noteText,
    onChangeNote,
    onSaveNote,
    onPaste,
    onRoundUp,
    onCaptureTab,
    onScreenshot,
    onFileSelected,
    isCapturing,
    isRecording,
    audioStatus,
    audioPermissionMessage,
    elapsedSeconds,
    onStartRecording,
    onStopRecording,
    onCancelRecording,
  } = props;

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const busy = isCapturing || isRecording || audioStatus === 'requesting-permission';

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(46, Math.min(el.scrollHeight, 92))}px`;
  }, []);

  useEffect(() => {
    void noteText;
    autoResize();
  }, [noteText, autoResize]);

  return (
    <section className="popup-screen popup-screen--fill popup-screen--home popup-screen--home-aggregate">
      <PopupSubheader ariaLabel="Home status" equalWidth tags={statusItems} />

      <div className="popup-screen--home-body">
        <ChickenYard items={yardItems} />

        <button className="popup-primary-action" disabled={busy} onClick={onRoundUp} type="button">
          Roundup Chickens
        </button>

        {isRecording ? (
          <div className="popup-recording" aria-label="Recording audio">
            <div className="popup-recording__status">
              <span className="popup-recording__dot" />
              <span className="popup-recording__timer">
                {String(Math.floor(elapsedSeconds / 60)).padStart(2, '0')}:
                {String(elapsedSeconds % 60).padStart(2, '0')}
                {' / 00:30'}
              </span>
            </div>
            <p className="popup-recording__hint">Keep popup open while recording</p>
            <div className="popup-recording__actions">
              <button className="popup-primary-action" onClick={onStopRecording} type="button">
                Save Voice Note
              </button>
              <button
                className="popup-handoff-button"
                data-accent="red"
                onClick={onCancelRecording}
                type="button"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            {audioStatus === 'requesting-permission' ? (
              <div className="popup-audio-permission popup-audio-permission--pending" aria-live="polite">
                <strong>Requesting microphone access</strong>
                <p>Allow microphone access to record a voice note here in the popup.</p>
              </div>
            ) : null}

            {audioStatus === 'denied' ? (
              <div className="popup-audio-permission" aria-live="polite">
                <strong>Microphone access needed</strong>
                <p>{audioPermissionMessage ?? 'Allow microphone access to record a voice note.'}</p>
                <button className="popup-secondary-action" onClick={onStartRecording} type="button">
                  Try Again
                </button>
              </div>
            ) : null}

            <div className="popup-action-grid" aria-label="Quick actions">
              <button
                className="popup-handoff-button"
                data-accent="blue"
                disabled={busy}
                onClick={onCaptureTab}
                type="button"
              >
                <CaptureTabIcon />
                <span>Capture Tab</span>
              </button>
              <button
                className="popup-handoff-button"
                data-accent="purple"
                disabled={busy}
                onClick={onScreenshot}
                type="button"
              >
                <ScreenshotIcon />
                <span>Screenshot</span>
              </button>
              <button
                className="popup-handoff-button"
                data-accent="green"
                disabled={busy}
                onClick={onStartRecording}
                type="button"
              >
                <MicrophoneIcon />
                <span>{audioStatus === 'denied' ? 'Retry Audio' : 'Audio'}</span>
              </button>
              <button
                className="popup-handoff-button"
                data-accent="orange"
                disabled={busy}
                onClick={() => fileInputRef.current?.click()}
                type="button"
              >
                <DocumentIcon />
                <span>Files</span>
              </button>
              <input
                type="file"
                hidden
                ref={fileInputRef}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (file) onFileSelected(file);
                }}
              />
            </div>
          </>
        )}

        <div className="popup-note-bar">
          <div className="popup-note-bar__field">
            <textarea
              aria-label="Note"
              className="popup-note-bar__input"
              disabled={busy}
              onChange={(event) => {
                onChangeNote(event.target.value);
                autoResize();
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  onSaveNote();
                }
              }}
              placeholder="Jot a quick note..."
              ref={textareaRef}
              rows={1}
              value={noteText}
            />
            <button
              aria-label="Paste"
              className="popup-note-bar__paste"
              disabled={busy}
              onClick={onPaste}
              type="button"
            >
              <PasteIcon />
            </button>
          </div>
          <button
            aria-label="Save note"
            className="popup-note-bar__save"
            disabled={!noteText.trim() || busy}
            onClick={onSaveNote}
            type="button"
          >
            <PlusIcon />
          </button>
        </div>
      </div>
    </section>
  );
}

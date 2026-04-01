import type { ArtifactCategory } from '@coop/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { PopupSubheader, type PopupSubheaderTag } from './PopupSubheader';
import type { PopupRecordingStatus } from './hooks/usePopupRecording';

export interface YardItem {
  id: string;
  type: 'draft' | 'artifact';
  title?: string;
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

function categoryLabel(cat?: ArtifactCategory): string {
  if (!cat) return 'Loose chicken';
  const labels: Record<string, string> = {
    thought: 'Thought',
    insight: 'Insight',
    opportunity: 'Opportunity',
    'funding-lead': 'Funding Lead',
    resource: 'Resource',
    evidence: 'Evidence',
    ritual: 'Ritual',
    'coop-soul': 'Coop Soul',
    'setup-insight': 'Setup Insight',
    'seed-contribution': 'Seed',
  };
  return labels[cat] || 'Chicken';
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

function ChickIcon({ flip }: { flip?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      style={flip ? { transform: 'scaleX(-1)' } : undefined}
      viewBox="0 0 16 16"
    >
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
  /* Stable key for the current item set — avoids resetting positions on referential changes */
  const itemKey = items.map((i) => i.id).join(',');

  const chickenConfigRef = useRef<{
    key: string;
    value: Array<{
      initialX: number;
      initialY: number;
      initialFlip: boolean;
      roamDuration: number;
    }>;
  }>({
    key: '',
    value: [],
  });

  if (chickenConfigRef.current.key !== itemKey) {
    chickenConfigRef.current = {
      key: itemKey,
      value: items.map((item) => {
        const h = hashId(item.id);
        const rng = seededRandom(h);
        return {
          initialX: 8 + rng() * 84,
          initialY: 10 + rng() * 72,
          initialFlip: rng() > 0.5,
          roamDuration: 3 + rng() * 3,
        };
      }),
    };
  }

  const chickenConfig = chickenConfigRef.current.value;

  const [positions, setPositions] = useState(() =>
    chickenConfig.map((c) => ({
      x: c.initialX,
      y: c.initialY,
      flip: c.initialFlip,
      roamDuration: c.roamDuration,
    })),
  );
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [clickedIndex, setClickedIndex] = useState<number | null>(null);

  /* Sync positions when the item set changes */
  useEffect(() => {
    setPositions(
      chickenConfig.map((c) => ({
        x: c.initialX,
        y: c.initialY,
        flip: c.initialFlip,
        roamDuration: c.roamDuration,
      })),
    );
  }, [chickenConfig]);

  /* Roaming: periodically move a random chicken to a new nearby target.
   * Interval must exceed the CSS transition duration (3–6s) to avoid
   * restarting transitions before they complete, which causes jank. */
  useEffect(() => {
    if (items.length === 0) return;

    const interval = setInterval(() => {
      setPositions((prev) => {
        const next = [...prev];
        // Move just one chicken per tick for a gentle, low-cost animation
        const i = Math.floor(Math.random() * items.length);
        const current = next[i];
        if (!current || Math.random() < 0.3) return prev; // sometimes skip — chicken is pecking

        const dx = (Math.random() - 0.5) * 18;
        const dy = (Math.random() - 0.5) * 12;
        const newX = Math.max(8, Math.min(92, current.x + dx));
        const newY = Math.max(10, Math.min(82, current.y + dy));
        const flip = newX !== current.x ? newX > current.x : current.flip;
        const roamDuration = 3 + Math.random() * 3;

        next[i] = { x: newX, y: newY, flip, roamDuration };
        return next;
      });
    }, 6000);

    return () => clearInterval(interval);
  }, [items.length]);

  /* Clear click animation after it finishes */
  useEffect(() => {
    if (clickedIndex === null) return;
    const timer = setTimeout(() => setClickedIndex(null), 500);
    return () => clearTimeout(timer);
  }, [clickedIndex]);

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
        if (!pos) return null;
        const config = chickenConfig[i];
        const catGroup = categoryGroup(item.category);
        const externalClass = item.isExternal ? ' popup-yard__chicken--external' : '';
        const isClicked = clickedIndex === i;
        const bodyAnimClass = isClicked
          ? item.isExternal
            ? 'popup-yard__chicken-body--cackle'
            : 'popup-yard__chicken-body--rooster'
          : 'popup-yard__chicken-body--idle';

        return (
          <button
            className={`popup-yard__chicken popup-yard__chicken--${item.type}${externalClass}`}
            data-category={catGroup}
            key={item.id}
            onClick={() => setClickedIndex(i)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setClickedIndex(i);
              }
            }}
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex(null)}
            style={{
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              width: item.type === 'artifact' ? chickenSize * 0.75 : chickenSize,
              height: item.type === 'artifact' ? chickenSize * 0.75 : chickenSize,
              animationDelay: `${i * 60}ms`,
              transitionDuration: `${pos.roamDuration}s, ${pos.roamDuration}s, 0.3s, 0.3s`,
            }}
            tabIndex={0}
            type="button"
          >
            <span
              className={`popup-yard__chicken-body ${bodyAnimClass}`}
              style={!isClicked ? { animationDelay: `${400 + i * 200}ms` } : undefined}
            >
              {item.type === 'draft' ? (
                <ChickenIcon flip={pos.flip} />
              ) : (
                <ChickIcon flip={pos.flip} />
              )}
            </span>
            {hoveredIndex === i && (
              <span
                className={`popup-yard__tooltip${pos.y < 25 ? ' popup-yard__tooltip--below' : ''}`}
              >
                <span className="popup-yard__tooltip-title">
                  {item.title || (item.type === 'draft' ? 'Untitled draft' : 'Shared item')}
                </span>
                <span className="popup-yard__tooltip-detail">
                  {categoryLabel(item.category)}
                  {item.isExternal ? ' · Shared' : ' · Draft'}
                </span>
              </span>
            )}
          </button>
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
  isRoundupInFlight: boolean;
  isRecording: boolean;
  audioStatus: PopupRecordingStatus;
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
    isRoundupInFlight,
    isRecording,
    audioStatus,
    elapsedSeconds,
    onStartRecording,
    onStopRecording,
    onCancelRecording,
  } = props;

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const busy = isCapturing || isRecording || audioStatus === 'requesting-permission';
  const roundupBusy =
    isRoundupInFlight || isCapturing || isRecording || audioStatus === 'requesting-permission';

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
      <PopupSubheader
        ariaLabel="Home status"
        className="popup-subheader--home-status"
        equalWidth
        tags={statusItems}
      />

      <div className="popup-screen--home-body">
        <ChickenYard items={yardItems} />

        <button
          aria-busy={isRoundupInFlight}
          className="popup-primary-action"
          disabled={roundupBusy}
          onClick={onRoundUp}
          type="button"
        >
          {isRoundupInFlight ? 'Rounding up…' : 'Roundup Chickens'}
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
                <span>
                  {audioStatus === 'denied' || audioStatus === 'unavailable'
                    ? 'Retry Audio'
                    : 'Audio'}
                </span>
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

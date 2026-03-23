import { useCallback, useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function ShareIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 20 20" width="15" height="15">
      <path
        d="M13.5 7a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM6.5 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM13.5 18a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path
        d="M8.7 11.3l2.6 2.2M8.7 8.7l2.6-2.2"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 16 16" width="14" height="14">
      <rect x="5" y="5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M11 3H4.5A1.5 1.5 0 0 0 3 4.5V11"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function FeedIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 16 16" width="14" height="14">
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M8 5v3l2 1.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function NativeShareIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 16 16" width="14" height="14">
      <path
        d="M8 2v8M5 5l3-3 3 3M3 10v3h10v-3"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 16 16" width="14" height="14">
      <path
        d="M3 8.5l3.5 3.5 6.5-8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// ShareMenu
// ---------------------------------------------------------------------------

export interface ShareMenuProps {
  /** URL to share / copy */
  url: string;
  /** Title used in native share and feed share */
  title: string;
  /** Summary text used in native share */
  summary?: string;
  /** Callback to publish/share this item to the coop feed */
  onShareToFeed?: () => void;
}

export function ShareMenu({ url, title, summary, onShareToFeed }: ShareMenuProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const supportsNativeShare = typeof navigator.share === 'function';

  // Close on outside click
  useEffect(() => {
    if (!open) return;

    function handleClick(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    };
  }, []);

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      copiedTimerRef.current = setTimeout(() => {
        setCopied(false);
        setOpen(false);
      }, 1500);
    } catch {
      // Clipboard API may fail silently in some contexts
      setOpen(false);
    }
  }, [url]);

  const handleShareToFeed = useCallback(() => {
    onShareToFeed?.();
    setOpen(false);
  }, [onShareToFeed]);

  const handleNativeShare = useCallback(async () => {
    try {
      await navigator.share({
        title,
        text: summary ?? '',
        url,
      });
    } catch {
      // User cancelled or share failed -- no action needed
    }
    setOpen(false);
  }, [title, summary, url]);

  return (
    <div className="share-menu" ref={containerRef}>
      <button
        aria-label="Share"
        className="popup-icon-button share-menu__trigger"
        onClick={() => setOpen((prev) => !prev)}
        type="button"
      >
        <ShareIcon />
      </button>

      {open && (
        <div className="share-menu__popover" role="menu">
          {copied ? (
            <div className="share-menu__confirmation">
              <CheckIcon />
              <span>Copied!</span>
            </div>
          ) : (
            <>
              <button
                className="share-menu__option"
                onClick={() => void handleCopyLink()}
                role="menuitem"
                type="button"
              >
                <CopyIcon />
                <span>Copy link</span>
              </button>

              {onShareToFeed ? (
                <button
                  className="share-menu__option"
                  onClick={handleShareToFeed}
                  role="menuitem"
                  type="button"
                >
                  <FeedIcon />
                  <span>Share to feed</span>
                </button>
              ) : null}

              {supportsNativeShare ? (
                <button
                  className="share-menu__option"
                  onClick={() => void handleNativeShare()}
                  role="menuitem"
                  type="button"
                >
                  <NativeShareIcon />
                  <span>Share via...</span>
                </button>
              ) : null}
            </>
          )}
        </div>
      )}
    </div>
  );
}

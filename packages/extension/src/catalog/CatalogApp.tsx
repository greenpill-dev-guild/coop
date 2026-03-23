import '../../global.css';
import '../views/Popup/popup.css';
import './catalog.css';

const COLORS = [
  { token: '--coop-cream', label: 'Cream', light: '#fcf5ef', dark: '#1a1410' },
  { token: '--coop-brown', label: 'Brown', light: '#4f2e1f', dark: '#e8d5c4' },
  { token: '--coop-brown-soft', label: 'Brown Soft', light: '#6b4a36', dark: '#b8a090' },
  { token: '--coop-green', label: 'Green', light: '#5a7d10', dark: '#8ab840' },
  { token: '--coop-orange', label: 'Orange', light: '#fd8a01', dark: '#ffaa44' },
  { token: '--coop-mist', label: 'Mist', light: '#d8d4d0', dark: '#3a3632' },
  { token: '--coop-ink', label: 'Ink', light: '#27140e', dark: '#f0e8e0' },
  { token: '--coop-error', label: 'Error', light: '#a63b20', dark: '#ff6b4a' },
] as const;

const SPACING = [
  { token: '--coop-space-3xs', label: '3xs', value: '0.15rem' },
  { token: '--coop-space-2xs', label: '2xs', value: '0.2rem' },
  { token: '--coop-space-xs', label: 'xs', value: '0.35rem' },
  { token: '--coop-space-sm', label: 'sm', value: '0.65rem' },
  { token: '--coop-space-md', label: 'md', value: '1rem' },
  { token: '--coop-space-lg', label: 'lg', value: '1.5rem' },
  { token: '--coop-space-xl', label: 'xl', value: '2rem' },
] as const;

const RADII = [
  { token: '--coop-radius-xs', label: 'xs', value: '6px' },
  { token: '--coop-radius-sm', label: 'sm', value: '8px' },
  { token: '--coop-radius-icon', label: 'icon', value: '10px' },
  { token: '--coop-radius-chip', label: 'chip', value: '12px' },
  { token: '--coop-radius-button', label: 'button', value: '14px' },
  { token: '--coop-radius-input', label: 'input', value: '16px' },
  { token: '--coop-radius-photo', label: 'photo', value: '18px' },
  { token: '--coop-radius-input-lg', label: 'input-lg', value: '20px' },
  { token: '--coop-radius-card', label: 'card', value: '24px' },
  { token: '--coop-radius-pill', label: 'pill', value: '999px' },
] as const;

function CatalogPanel({ theme }: { theme: 'light' | 'dark' }) {
  const colors = COLORS.map((c) => ({
    ...c,
    hex: theme === 'light' ? c.light : c.dark,
  }));

  return (
    <div className="catalog-panel" data-theme={theme}>
      <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem', fontWeight: 800 }}>
        {theme === 'light' ? 'Light' : 'Dark'}
      </h2>

      {/* ── Buttons ── */}
      <section className="catalog-section">
        <h2>Buttons</h2>
        <div className="catalog-column">
          <div className="catalog-row">
            <button className="popup-primary-action" type="button">
              Primary
            </button>
          </div>
          <div className="catalog-row">
            <button className="popup-secondary-action" type="button">
              Secondary
            </button>
          </div>
          <div className="catalog-row">
            <button className="popup-secondary-action" type="button" disabled>
              Disabled
            </button>
          </div>
          <div className="catalog-row">
            <button className="popup-text-button" type="button">
              Text Button
            </button>
          </div>
          <div className="catalog-row">
            <button className="popup-icon-button" type="button" aria-label="Icon">
              <svg
                aria-hidden="true"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M12 1v6m0 6v6m-7-7h6m6 0h6" />
              </svg>
            </button>
            <button className="popup-icon-button is-active" type="button" aria-label="Active icon">
              <svg
                aria-hidden="true"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M5 13l4 4L19 7" />
              </svg>
            </button>
            <button className="popup-mark popup-mark--button" type="button" aria-label="Mark">
              <svg
                aria-hidden="true"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z" />
              </svg>
            </button>
          </div>
          <div className="catalog-row">
            <button className="popup-handoff-button" type="button" data-accent="green">
              <svg
                aria-hidden="true"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              Green
            </button>
            <button className="popup-handoff-button" type="button" data-accent="orange">
              <svg
                aria-hidden="true"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              Orange
            </button>
          </div>
        </div>
      </section>

      {/* ── Cards ── */}
      <section className="catalog-section">
        <h2>Cards</h2>
        <div className="catalog-column">
          <div className="panel-card">
            <h3 style={{ margin: '0 0 0.4rem' }}>Panel Card</h3>
            <p style={{ margin: 0, color: 'var(--coop-text-soft)', fontSize: '0.9rem' }}>
              Standard elevated card with border and shadow.
            </p>
          </div>
          <div className="summary-card">
            <strong>12</strong>
            <span>Loose Chickens</span>
          </div>
          <details className="panel-card collapsible-card">
            <summary>
              <h3>Collapsible Card</h3>
            </summary>
            <div className="collapsible-card__content">
              <p style={{ margin: 0, color: 'var(--coop-text-soft)' }}>
                Expanded content area with the details/summary pattern.
              </p>
            </div>
          </details>
        </div>
      </section>

      {/* ── Badges & Pills ── */}
      <section className="catalog-section">
        <h2>Badges & Pills</h2>
        <div className="catalog-column">
          <div className="catalog-row">
            <span className="state-pill">Active</span>
            <span className="state-pill is-error">Error</span>
            <span className="badge">Badge</span>
          </div>
          <div className="catalog-row">
            <span className="popup-mini-pill">Mini Pill</span>
            <span className="popup-mini-pill">3 drafts</span>
          </div>
          <div className="catalog-row">
            <button
              className="popup-subheader__tag popup-subheader__tag--interactive is-active"
              type="button"
            >
              Filter Active
            </button>
            <button
              className="popup-subheader__tag popup-subheader__tag--interactive"
              type="button"
            >
              Filter
            </button>
            <span className="popup-subheader__tag popup-subheader__tag--ok">OK</span>
            <span className="popup-subheader__tag popup-subheader__tag--warning">Warn</span>
            <span className="popup-subheader__tag popup-subheader__tag--error">Err</span>
          </div>
        </div>
      </section>

      {/* ── Form Controls ── */}
      <section className="catalog-section">
        <h2>Form Controls</h2>
        <div className="popup-form">
          <div className="popup-field">
            <span>Label</span>
            <input type="text" placeholder="Text input..." />
          </div>
          <div className="popup-field">
            <span>Notes</span>
            <textarea placeholder="Textarea..." style={{ minHeight: '60px' }} />
          </div>
          <div className="popup-field">
            <span>Select</span>
            <select
              className="popup-setting-row"
              style={{
                width: '100%',
                borderRadius: 'var(--coop-radius-button)',
                border: '1px solid var(--coop-border)',
                background: 'var(--coop-field)',
                color: 'var(--coop-text)',
                padding: '12px 14px',
              }}
            >
              <option>Option A</option>
              <option>Option B</option>
              <option>Option C</option>
            </select>
          </div>
        </div>
      </section>

      {/* ── Typography ── */}
      <section className="catalog-section">
        <h2>Typography</h2>
        <div className="catalog-column">
          <h1 className="catalog-type-sample" style={{ fontSize: '1.46rem', margin: 0 }}>
            Heading 1
          </h1>
          <h2
            className="catalog-type-sample"
            style={{
              fontSize: '1.22rem',
              margin: 0,
              opacity: 1,
              letterSpacing: 0,
              textTransform: 'none',
            }}
          >
            Heading 2
          </h2>
          <h3 className="catalog-type-sample" style={{ fontSize: '1rem', margin: 0 }}>
            Heading 3
          </h3>
          <p
            className="catalog-type-sample"
            style={{ margin: 0, fontSize: '0.94rem', lineHeight: 1.45 }}
          >
            Body text -- The quick brown fox jumped over the lazy rooster.
          </p>
          <span className="popup-eyebrow">Eyebrow Text</span>
          <span style={{ color: 'var(--coop-text-soft)', fontSize: '0.9rem' }}>
            Soft text (--coop-text-soft)
          </span>
          <code style={{ fontFamily: 'var(--coop-font-mono)', fontSize: '0.85rem' }}>
            Monospace: 0x1a2b3c...
          </code>
        </div>
      </section>

      {/* ── Colors ── */}
      <section className="catalog-section">
        <h2>Colors</h2>
        <div className="catalog-column">
          {colors.map((c) => (
            <div className="catalog-swatch" key={c.token}>
              <div className="catalog-swatch__color" style={{ background: c.hex }} />
              <div className="catalog-swatch__label">
                <span>{c.label}</span>
                <code>{c.hex}</code>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Spacing ── */}
      <section className="catalog-section">
        <h2>Spacing</h2>
        <div className="catalog-column">
          {SPACING.map((s) => (
            <div key={s.token} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div
                className="catalog-spacing-box"
                style={{ width: `calc(${s.value} * 6)`, minWidth: 8 }}
              />
              <span className="catalog-spacing-label">
                {s.label} ({s.value})
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Radii ── */}
      <section className="catalog-section">
        <h2>Radii</h2>
        <div className="catalog-row" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
          {RADII.map((r) => (
            <div key={r.token} style={{ textAlign: 'center' }}>
              <div className="catalog-radius-box" style={{ borderRadius: r.value }}>
                {r.value}
              </div>
              <div style={{ fontSize: '0.7rem', marginTop: '0.25rem', opacity: 0.6 }}>
                {r.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Shadows ── */}
      <section className="catalog-section">
        <h2>Shadows</h2>
        <div className="catalog-row">
          <div className="catalog-shadow-box" style={{ boxShadow: 'var(--coop-shadow-sm)' }}>
            sm
          </div>
          <div className="catalog-shadow-box" style={{ boxShadow: 'var(--coop-shadow-md)' }}>
            md
          </div>
          <div className="catalog-shadow-box" style={{ boxShadow: 'var(--coop-shadow-lg)' }}>
            lg
          </div>
        </div>
      </section>
    </div>
  );
}

export function CatalogApp() {
  return (
    <div className="catalog">
      <h1 className="catalog-title">Coop UI Catalog</h1>
      <p className="catalog-subtitle">
        Design tokens and CSS specimens -- light and dark side by side
      </p>
      <CatalogPanel theme="light" />
      <CatalogPanel theme="dark" />
    </div>
  );
}

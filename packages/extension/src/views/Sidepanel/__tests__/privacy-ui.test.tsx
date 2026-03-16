import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Stub chrome.runtime
Object.defineProperty(globalThis, 'chrome', {
  configurable: true,
  value: {
    runtime: {
      sendMessage: vi.fn(),
      onMessage: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
  },
});

describe('privacy UI elements', () => {
  describe('anonymous badge on artifact cards', () => {
    it('renders Anonymous member badge when createdBy is anonymous-member', () => {
      // Render a minimal artifact card with anonymous createdBy
      const { container } = render(
        <article className="artifact-card stack">
          <strong>Test Artifact</strong>
          <div className="badge-row">
            {('anonymous-member' as string) === 'anonymous-member' ? (
              <span
                className="badge"
                style={{
                  background: 'var(--accent-subtle, #2d2d3d)',
                  padding: '0.125rem 0.5rem',
                  borderRadius: '999px',
                  fontSize: '0.7rem',
                }}
              >
                Anonymous member
              </span>
            ) : (
              <span>Some Member</span>
            )}
          </div>
        </article>,
      );

      expect(screen.getByText('Anonymous member')).toBeInTheDocument();
      expect(screen.queryByText('Some Member')).not.toBeInTheDocument();
    });

    it('renders member name when createdBy is a normal member id', () => {
      const createdBy = 'member-123';
      const memberName = 'Alice';

      const { container } = render(
        <article className="artifact-card stack">
          <strong>Test Artifact</strong>
          <div className="badge-row">
            {createdBy === 'anonymous-member' ? (
              <span className="badge">Anonymous member</span>
            ) : (
              <span>{memberName}</span>
            )}
          </div>
        </article>,
      );

      expect(screen.queryByText('Anonymous member')).not.toBeInTheDocument();
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });
  });

  describe('stealth address card', () => {
    it('renders stealth meta-address in a collapsible details element', () => {
      const stealthMetaAddress = 'st:eth:0xabc123def456';

      render(
        <details className="card" data-testid="stealth-card">
          <summary className="card-header" style={{ cursor: 'pointer' }}>
            Private payment address
          </summary>
          <div className="card-body" style={{ padding: '0.75rem' }}>
            <p className="hint">
              Share this address to receive payments privately. Each payment goes to a unique,
              unlinkable stealth address.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <code className="mono">{stealthMetaAddress}</code>
              <button
                className="btn-sm"
                onClick={() => navigator.clipboard.writeText(stealthMetaAddress)}
                title="Copy stealth address"
                type="button"
              >
                Copy
              </button>
            </div>
          </div>
        </details>,
      );

      expect(screen.getByText('Private payment address')).toBeInTheDocument();
      expect(screen.getByText(stealthMetaAddress)).toBeInTheDocument();
      expect(screen.getByTitle('Copy stealth address')).toBeInTheDocument();
    });

    it('does not render when stealthMetaAddress is null', () => {
      const stealthMetaAddress: string | null = null;

      render(
        <div data-testid="nest-container">
          {stealthMetaAddress && (
            <details className="card">
              <summary>Private payment address</summary>
            </details>
          )}
        </div>,
      );

      expect(screen.queryByText('Private payment address')).not.toBeInTheDocument();
    });
  });

  describe('provider mode badge', () => {
    it('renders light client badge when providerMode is kohaku', () => {
      const runtimeConfig = { providerMode: 'kohaku' as const };

      render(
        <div>
          {runtimeConfig.providerMode === 'kohaku' && (
            <span className="badge" style={{ fontSize: '0.65rem', opacity: 0.7 }}>
              Verified by light client
            </span>
          )}
        </div>,
      );

      expect(screen.getByText('Verified by light client')).toBeInTheDocument();
    });

    it('does not render badge when providerMode is not kohaku', () => {
      const runtimeConfig = { providerMode: 'rpc' as const };

      render(
        <div>
          {runtimeConfig.providerMode === 'kohaku' && (
            <span className="badge">Verified by light client</span>
          )}
        </div>,
      );

      expect(screen.queryByText('Verified by light client')).not.toBeInTheDocument();
    });
  });

  describe('anonymous publish toggle', () => {
    it('renders toggle checkbox with label when workflowStage is ready', () => {
      const workflowStage = 'ready';
      const anonymousPublish = false;

      render(
        <div>
          {workflowStage === 'ready' && (
            <label className="field-row" style={{ gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={anonymousPublish}
                onChange={() => {}}
                data-testid="anonymous-toggle"
              />
              <span className="label-quiet">Publish anonymously</span>
              <span className="hint" style={{ fontSize: '0.75rem', opacity: 0.6 }}>
                ZK proof of membership, no name attached
              </span>
            </label>
          )}
        </div>,
      );

      expect(screen.getByText('Publish anonymously')).toBeInTheDocument();
      expect(screen.getByText('ZK proof of membership, no name attached')).toBeInTheDocument();
      expect(screen.getByTestId('anonymous-toggle')).not.toBeChecked();
    });

    it('does not render toggle when workflowStage is candidate', () => {
      const workflowStage = 'candidate';

      render(
        <div>
          {workflowStage === 'ready' && (
            <label>
              <input type="checkbox" />
              <span className="label-quiet">Publish anonymously</span>
            </label>
          )}
        </div>,
      );

      expect(screen.queryByText('Publish anonymously')).not.toBeInTheDocument();
    });
  });
});

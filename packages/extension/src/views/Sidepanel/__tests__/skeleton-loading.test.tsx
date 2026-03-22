import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Isolated skeleton-loading tests.
 *
 * These verify that the skeleton shimmer elements appear when `dashboard`
 * is null and are hidden (or absent) once the dashboard resolves.
 *
 * We test via a thin wrapper component rather than the full SidepanelApp
 * because the real component brings in background-script messaging,
 * inference bridges, and extension APIs that are impractical to mock here.
 */

type DashboardSummary = {
  iconLabel: string;
  iconState: string;
  pendingDrafts: number;
  syncState: string;
};

function SkeletonHeader({ dashboard }: { dashboard: { summary: DashboardSummary } | null }) {
  return (
    <div className="panel-brand">
      {dashboard ? (
        <div
          className={
            dashboard.summary.iconState === 'blocked' ? 'state-pill is-error' : 'state-pill'
          }
        >
          {dashboard.summary.iconLabel}
        </div>
      ) : (
        <div
          className="skeleton skeleton-text"
          style={{ width: '5rem', height: '1.4em' }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

function SkeletonChickens({
  dashboard,
}: { dashboard: { candidates: Array<{ id: string; title: string }> } | null }) {
  return (
    <section className="panel-card">
      <h2>Loose Chickens</h2>
      {!dashboard ? (
        <output aria-label="Loading chickens">
          <div className="skeleton skeleton-card" aria-hidden="true" />
          <div className="skeleton skeleton-card" aria-hidden="true" />
          <div className="skeleton skeleton-card" aria-hidden="true" />
        </output>
      ) : (
        <ul className="list-reset stack">
          {dashboard.candidates.map((c) => (
            <li key={c.id}>{c.title}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SkeletonRoost({
  dashboard,
}: {
  dashboard: {
    summary: DashboardSummary;
  } | null;
}) {
  return (
    <section className="panel-card">
      {!dashboard ? (
        <output aria-label="Loading roost">
          <div className="summary-strip">
            <div className="skeleton skeleton-summary" aria-hidden="true" />
            <div className="skeleton skeleton-summary" aria-hidden="true" />
            <div className="skeleton skeleton-summary" aria-hidden="true" />
          </div>
          <div className="skeleton skeleton-header" aria-hidden="true" />
          <div className="skeleton skeleton-card" aria-hidden="true" />
          <div className="skeleton skeleton-card" aria-hidden="true" />
        </output>
      ) : (
        <>
          <div className="summary-strip">
            <div className="summary-card">
              <span>Drafts</span>
              <strong>{dashboard.summary.pendingDrafts}</strong>
            </div>
          </div>
          <h2>Roost</h2>
        </>
      )}
    </section>
  );
}

function SkeletonFeed({ dashboard }: { dashboard: { summary: DashboardSummary } | null }) {
  return (
    <article className="panel-card">
      <h2>Coop Feed</h2>
      {!dashboard ? (
        <output aria-label="Loading feed">
          <div className="summary-strip">
            <div className="skeleton skeleton-summary" aria-hidden="true" />
            <div className="skeleton skeleton-summary" aria-hidden="true" />
            <div className="skeleton skeleton-summary" aria-hidden="true" />
          </div>
          <div className="skeleton skeleton-card" aria-hidden="true" />
          <div className="skeleton skeleton-card" aria-hidden="true" />
        </output>
      ) : (
        <div className="summary-strip">
          <div className="summary-card">
            <span>Shared finds</span>
            <strong>3</strong>
          </div>
        </div>
      )}
    </article>
  );
}

describe('Skeleton loading indicators', () => {
  afterEach(() => {
    cleanup();
  });

  // --- Header ---

  it('shows skeleton in header when dashboard is null', () => {
    const { container } = render(<SkeletonHeader dashboard={null} />);
    const skeleton = container.querySelector('.skeleton.skeleton-text');
    expect(skeleton).toBeInTheDocument();
    expect(skeleton).toHaveAttribute('aria-hidden', 'true');
  });

  it('hides skeleton in header when dashboard is loaded', () => {
    const dashboard = {
      summary: {
        iconLabel: 'Ready',
        iconState: 'ready',
        pendingDrafts: 0,
        syncState: 'synced',
      },
    };
    const { container } = render(<SkeletonHeader dashboard={dashboard} />);
    expect(container.querySelector('.skeleton')).toBeNull();
    expect(screen.getByText('Ready')).toBeInTheDocument();
  });

  // --- Chickens tab ---

  it('shows skeleton cards in Chickens tab when dashboard is null', () => {
    render(<SkeletonChickens dashboard={null} />);
    const status = screen.getByRole('status', { name: /loading chickens/i });
    expect(status).toBeInTheDocument();
    const skeletons = status.querySelectorAll('.skeleton.skeleton-card');
    expect(skeletons).toHaveLength(3);
  });

  it('shows candidate list in Chickens tab when dashboard is loaded', () => {
    const dashboard = {
      candidates: [{ id: '1', title: 'GitHub PR review' }],
    };
    render(<SkeletonChickens dashboard={dashboard} />);
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByText('GitHub PR review')).toBeInTheDocument();
  });

  // --- Roost tab ---

  it('shows skeleton summary strip in Roost tab when dashboard is null', () => {
    render(<SkeletonRoost dashboard={null} />);
    const status = screen.getByRole('status', { name: /loading roost/i });
    expect(status).toBeInTheDocument();
    const summarySkeletons = status.querySelectorAll('.skeleton.skeleton-summary');
    expect(summarySkeletons).toHaveLength(3);
    const cardSkeletons = status.querySelectorAll('.skeleton.skeleton-card');
    expect(cardSkeletons).toHaveLength(2);
  });

  it('shows summary cards in Roost tab when dashboard is loaded', () => {
    const dashboard = {
      summary: {
        iconLabel: 'Ready',
        iconState: 'ready',
        pendingDrafts: 5,
        syncState: 'synced',
      },
    };
    render(<SkeletonRoost dashboard={dashboard} />);
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('Roost')).toBeInTheDocument();
  });

  // --- Feed tab ---

  it('shows skeleton in Feed tab when dashboard is null', () => {
    render(<SkeletonFeed dashboard={null} />);
    const status = screen.getByRole('status', { name: /loading feed/i });
    expect(status).toBeInTheDocument();
    const summarySkeletons = status.querySelectorAll('.skeleton.skeleton-summary');
    expect(summarySkeletons).toHaveLength(3);
    const cardSkeletons = status.querySelectorAll('.skeleton.skeleton-card');
    expect(cardSkeletons).toHaveLength(2);
  });

  it('shows summary cards in Feed tab when dashboard is loaded', () => {
    const dashboard = {
      summary: {
        iconLabel: 'Ready',
        iconState: 'ready',
        pendingDrafts: 0,
        syncState: 'synced',
      },
    };
    render(<SkeletonFeed dashboard={dashboard} />);
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByText('Shared finds')).toBeInTheDocument();
  });

  // --- Accessibility ---

  it('marks all skeleton elements as aria-hidden', () => {
    const { container } = render(
      <>
        <SkeletonHeader dashboard={null} />
        <SkeletonChickens dashboard={null} />
        <SkeletonRoost dashboard={null} />
        <SkeletonFeed dashboard={null} />
      </>,
    );
    const skeletons = container.querySelectorAll('.skeleton');
    expect(skeletons.length).toBeGreaterThan(0);
    for (const el of skeletons) {
      expect(el).toHaveAttribute('aria-hidden', 'true');
    }
  });

  it('wraps skeleton groups in status role with accessible name', () => {
    render(
      <>
        <SkeletonChickens dashboard={null} />
        <SkeletonRoost dashboard={null} />
        <SkeletonFeed dashboard={null} />
      </>,
    );
    expect(screen.getByRole('status', { name: /loading chickens/i })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: /loading roost/i })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: /loading feed/i })).toBeInTheDocument();
  });
});

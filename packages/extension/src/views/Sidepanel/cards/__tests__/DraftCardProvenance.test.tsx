import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DraftCardProvenance } from '../DraftCardProvenance';

afterEach(cleanup);

describe('DraftCardProvenance', () => {
  it('renders "Sourced from" with SourceBadges for agent draft with sourceRefs', () => {
    render(
      <DraftCardProvenance
        provenanceType="agent"
        sourceRefs={['youtube:UC_abc', 'github:org/repo']}
        precedent={null}
        confidence={0.85}
      />,
    );

    expect(screen.getByText('Sourced from')).toBeInTheDocument();
    expect(screen.getByText('UC_abc')).toBeInTheDocument();
    expect(screen.getByText('org/repo')).toBeInTheDocument();
    expect(screen.getByText('observed/unconfirmed')).toBeInTheDocument();
  });

  it('does not render "Sourced from" when sourceRefs is undefined', () => {
    const { container } = render(
      <DraftCardProvenance provenanceType="agent" precedent={null} confidence={0.72} />,
    );

    expect(screen.queryByText('Sourced from')).not.toBeInTheDocument();
    expect(container.querySelector('.draft-card__provenance')).toBeNull();
  });

  it('does not render "Sourced from" when sourceRefs is empty', () => {
    const { container } = render(
      <DraftCardProvenance
        provenanceType="agent"
        sourceRefs={[]}
        precedent={null}
        confidence={0.72}
      />,
    );

    expect(screen.queryByText('Sourced from')).not.toBeInTheDocument();
    expect(container.querySelector('.draft-card__provenance')).toBeNull();
  });

  it('does not render "Sourced from" for tab-captured drafts even with sourceRefs', () => {
    const { container } = render(
      <DraftCardProvenance
        provenanceType="tab"
        sourceRefs={['youtube:UC_abc']}
        precedent={null}
        confidence={0.9}
      />,
    );

    expect(screen.queryByText('Sourced from')).not.toBeInTheDocument();
    expect(container.querySelector('.draft-card__provenance')).toBeNull();
  });

  it('limits source references to at most 3', () => {
    render(
      <DraftCardProvenance
        provenanceType="agent"
        sourceRefs={[
          'youtube:UC_first',
          'github:org/second',
          'rss:https://third.com/feed',
          'web:fourth.com',
          'github:org/fifth',
        ]}
        precedent={null}
        confidence={0.8}
      />,
    );

    expect(screen.getByText('UC_first')).toBeInTheDocument();
    expect(screen.getByText('org/second')).toBeInTheDocument();
    expect(screen.getByText('https://third.com/feed')).toBeInTheDocument();
    expect(screen.queryByText('fourth.com')).not.toBeInTheDocument();
    expect(screen.queryByText('org/fifth')).not.toBeInTheDocument();
  });

  it('renders PrecedentIndicator when precedent data is present', () => {
    render(
      <DraftCardProvenance
        provenanceType="agent"
        sourceRefs={['youtube:UC_abc']}
        precedent={{ decision: 'Funded similar project', outcome: 'positive', timeAgo: '3 months' }}
        confidence={0.88}
      />,
    );

    expect(screen.getByText(/Funded similar project/)).toBeInTheDocument();
  });

  it('renders ConfidenceTooltip with the confidence value', () => {
    render(
      <DraftCardProvenance
        provenanceType="agent"
        sourceRefs={['youtube:UC_abc']}
        precedent={null}
        confidence={0.85}
      />,
    );

    // ConfidenceTooltip renders the percentage
    expect(screen.getByText(/85%/)).toBeInTheDocument();
  });

  it('does not render PrecedentIndicator when precedent is null', () => {
    render(
      <DraftCardProvenance
        provenanceType="agent"
        sourceRefs={['youtube:UC_abc']}
        precedent={null}
        confidence={0.7}
      />,
    );

    // The section should render (because sourceRefs is present), but no precedent text
    expect(screen.getByText('Sourced from')).toBeInTheDocument();
    // No precedent decision text should appear
    expect(screen.queryByText(/positive|negative/i)).not.toBeInTheDocument();
  });

  it('skips unparseable source references gracefully', () => {
    render(
      <DraftCardProvenance
        provenanceType="agent"
        sourceRefs={['youtube:UC_good', 'invalid-no-colon', 'github:org/valid']}
        precedent={null}
        confidence={0.75}
      />,
    );

    expect(screen.getByText('UC_good')).toBeInTheDocument();
    expect(screen.getByText('org/valid')).toBeInTheDocument();
    // The invalid ref produces no badge, but does not crash
  });
});

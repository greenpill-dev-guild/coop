import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import KnowledgeSkillsSection from '../operator-sections/KnowledgeSkillsSection';

function makeSkillEntry() {
  return {
    skill: {
      id: 'skill-1',
      name: 'Field Notes',
      description: 'Collects field observations.',
      url: 'https://example.com/SKILL.md',
      fetchedAt: '2026-03-28T00:00:00.000Z',
    },
    effectiveEnabled: true,
    effectiveTriggerPatterns: ['field', 'watershed'],
    freshness: 'fresh',
    override: {
      enabled: true,
      triggerPatterns: ['local-pattern'],
    },
  } as never;
}

describe('KnowledgeSkillsSection', () => {
  it('renders empty state and imports a new skill URL', async () => {
    const user = userEvent.setup();
    const onImportKnowledgeSkill = vi.fn(async () => true);

    render(
      <KnowledgeSkillsSection
        knowledgeSkills={[]}
        onImportKnowledgeSkill={onImportKnowledgeSkill}
        onRefreshKnowledgeSkill={vi.fn()}
        onSetCoopKnowledgeSkillEnabled={vi.fn()}
        onSaveKnowledgeSkillTriggerPatterns={vi.fn()}
      />,
    );

    expect(screen.getByText('No knowledge skills imported yet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import skill' })).toBeDisabled();

    await user.type(screen.getByLabelText('Knowledge skill URL'), 'https://example.com/SKILL.md');
    await user.click(screen.getByRole('button', { name: 'Import skill' }));

    expect(onImportKnowledgeSkill).toHaveBeenCalledWith('https://example.com/SKILL.md');
    expect(screen.getByLabelText('Knowledge skill URL')).toHaveValue('');
  });

  it('toggles skills, refreshes them, and saves trigger patterns', async () => {
    const user = userEvent.setup();
    const onRefreshKnowledgeSkill = vi.fn(async () => true);
    const onSetCoopKnowledgeSkillEnabled = vi.fn();
    const onSaveKnowledgeSkillTriggerPatterns = vi.fn(async () => true);

    render(
      <KnowledgeSkillsSection
        knowledgeSkills={[makeSkillEntry()]}
        activeCoopId="coop-1"
        activeCoopName="River Coop"
        onImportKnowledgeSkill={vi.fn()}
        onRefreshKnowledgeSkill={onRefreshKnowledgeSkill}
        onSetCoopKnowledgeSkillEnabled={onSetCoopKnowledgeSkillEnabled}
        onSaveKnowledgeSkillTriggerPatterns={onSaveKnowledgeSkillTriggerPatterns}
      />,
    );

    expect(screen.getByText('fresh')).toBeInTheDocument();
    expect(screen.getByText('enabled')).toBeInTheDocument();
    expect(screen.getByText('Collects field observations.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'https://example.com/SKILL.md' })).toHaveAttribute(
      'href',
      'https://example.com/SKILL.md',
    );

    await user.click(screen.getByRole('checkbox', { name: 'Enable for River Coop' }));
    expect(onSetCoopKnowledgeSkillEnabled).toHaveBeenCalledWith('skill-1', false);

    const textarea = screen.getByLabelText('Trigger patterns');
    await user.clear(textarea);
    await user.type(textarea, 'pond, stream\nrepair');
    await user.click(screen.getByRole('button', { name: 'Refresh skill' }));
    expect(onRefreshKnowledgeSkill).toHaveBeenCalledWith('skill-1');
    expect(screen.getByLabelText('Trigger patterns')).toHaveValue('field, watershed');

    await user.clear(screen.getByLabelText('Trigger patterns'));
    await user.type(screen.getByLabelText('Trigger patterns'), 'pond, stream\nrepair');
    await user.click(screen.getByRole('button', { name: 'Save patterns' }));

    expect(onSaveKnowledgeSkillTriggerPatterns).toHaveBeenCalledWith('skill-1', [
      'pond',
      'stream',
      'repair',
    ]);
    expect(
      screen.getByText('Coop override is enabled with local trigger patterns.'),
    ).toBeInTheDocument();
  });
});

import { describe, expect, it } from 'vitest';
import { initialCreateForm, toSetupInsights } from '../setup-insights';

describe('sidepanel setup insights shaping', () => {
  it('starts from the locked v1 manual-create baseline', () => {
    expect(initialCreateForm.captureMode).toBe('manual');
    expect(initialCreateForm.summary).toBe('');
    expect(initialCreateForm.coopName).toBe('');
  });

  it('builds a four-lens setup payload and trims empty cross-cutting items', () => {
    const insights = toSetupInsights({
      ...initialCreateForm,
      summary: 'A shared membrane for tabs, evidence, and next steps.',
      capitalCurrent: 'Funding context is scattered.',
      capitalPain: 'Grant links disappear in chats.',
      capitalImprove: 'Track leads in one shared flow.',
      impactCurrent: 'Evidence is gathered late.',
      impactPain: '',
      impactImprove: 'Keep impact evidence visible earlier.',
      governanceCurrent: 'Calls happen weekly.',
      governancePain: 'Follow-up slips after the meeting.',
      governanceImprove: 'Use a shared review board.',
      knowledgeCurrent: 'Resources live in browser tabs.',
      knowledgePain: 'People repeat research.',
      knowledgeImprove: '',
    });

    expect(insights.lenses).toHaveLength(4);
    expect(insights.crossCuttingPainPoints).toEqual([
      'Grant links disappear in chats.',
      'Follow-up slips after the meeting.',
      'People repeat research.',
    ]);
    expect(insights.crossCuttingOpportunities).toEqual([
      'Track leads in one shared flow.',
      'Keep impact evidence visible earlier.',
      'Use a shared review board.',
    ]);
  });
});

import { describe, expect, it } from 'vitest';
import {
  createDefaultSeedContribution,
  summarizeRitualArtifact,
  summarizeSoulArtifact,
  synthesizeCoopFromPurpose,
  synthesizeTranscriptsToPurpose,
} from '../synthesis';

describe('synthesizeCoopFromPurpose', () => {
  it('derives soul and rituals from a funding-focused purpose', () => {
    const result = synthesizeCoopFromPurpose({
      coopName: 'Watershed Coop',
      purpose: 'Track grant funding opportunities and evidence for watershed restoration.',
      captureMode: 'manual',
    });

    expect(result.soul.purposeStatement).toContain('grant funding');
    expect(result.soul.whyThisCoopExists).toContain('Watershed Coop');
    expect(result.soul.artifactFocus).toContain('funding leads');
    expect(result.soul.artifactFocus).toContain('evidence');
    expect(result.soul.confidenceThreshold).toBe(0.72);
    expect(result.rituals).toHaveLength(1);
    expect(result.rituals[0]?.weeklyReviewCadence).toContain('review circle');
  });

  it('respects the spaceType when building rituals', () => {
    const project = synthesizeCoopFromPurpose({
      coopName: 'Build Team',
      purpose: 'Coordinate action items and next steps for the sprint.',
      spaceType: 'project',
      captureMode: 'manual',
    });

    expect(project.rituals[0]?.weeklyReviewCadence).toBe('Weekly working review');
    expect(project.soul.toneAndWorkingStyle).toContain('Direct');

    const family = synthesizeCoopFromPurpose({
      coopName: 'Family Hub',
      purpose: 'Share care reminders and household notes.',
      spaceType: 'family',
      captureMode: 'manual',
    });

    expect(family.rituals[0]?.weeklyReviewCadence).toBe('Weekly family check-in');
    expect(family.soul.toneAndWorkingStyle).toContain('Gentle');
  });

  it('derives artifact focus from purpose keywords in order of appearance', () => {
    const result = synthesizeCoopFromPurpose({
      coopName: 'All-in Coop',
      purpose: 'Research knowledge, gather evidence, and follow up on action items.',
      captureMode: 'manual',
    });

    // "knowledge" matches research notes, "evidence" matches evidence, "action" matches next steps
    expect(result.soul.artifactFocus[0]).toBe('research notes');
    expect(result.soul.artifactFocus[1]).toBe('evidence');
    expect(result.soul.artifactFocus[2]).toBe('next steps');
  });

  it('falls back to space-type defaults when purpose has no keyword matches', () => {
    const result = synthesizeCoopFromPurpose({
      coopName: 'Generic Coop',
      purpose: 'A nice group doing nice things together.',
      spaceType: 'friends',
      captureMode: 'manual',
    });

    // No focus rule keywords match, so falls back to friends defaults
    expect(result.soul.artifactFocus).toEqual(
      expect.arrayContaining(['plans', 'recommendations', 'next steps']),
    );
  });

  it('falls back to a default purpose when purpose is empty', () => {
    const result = synthesizeCoopFromPurpose({
      coopName: 'Empty Purpose',
      purpose: '',
      captureMode: 'manual',
    });

    expect(result.soul.purposeStatement).toContain('useful context');
  });

  it('builds existence statement with "to" prefix for imperative purposes', () => {
    const result = synthesizeCoopFromPurpose({
      coopName: 'Tracker',
      purpose: 'to monitor grants and proposals.',
      captureMode: 'manual',
    });

    // "to monitor" should use "exists to monitor"
    expect(result.soul.whyThisCoopExists).toMatch(/Tracker exists to monitor/i);
  });

  it('builds existence statement with article-prefix purposes', () => {
    const result = synthesizeCoopFromPurpose({
      coopName: 'Library',
      purpose: 'A shared resource for tracking knowledge.',
      captureMode: 'manual',
    });

    // "A shared..." should use "exists as a shared..."
    expect(result.soul.whyThisCoopExists).toMatch(/Library exists as a shared/i);
  });

  it('adjusts capture posture for auto capture mode', () => {
    const manual = synthesizeCoopFromPurpose({
      coopName: 'A',
      purpose: 'Fund tracking.',
      captureMode: 'manual',
    });
    const auto = synthesizeCoopFromPurpose({
      coopName: 'B',
      purpose: 'Fund tracking.',
      captureMode: '5-min',
    });

    expect(manual.rituals[0]?.defaultCapturePosture).toContain('Manual round-up');
    expect(auto.rituals[0]?.defaultCapturePosture).not.toContain('Manual round-up');
  });

  it('includes tone refinements for evidence-heavy purposes', () => {
    const result = synthesizeCoopFromPurpose({
      coopName: 'Evidence Coop',
      purpose: 'Track impact evidence and outcome metrics.',
      captureMode: 'manual',
    });

    expect(result.soul.toneAndWorkingStyle).toContain('evidence-first');
  });

  it('includes tone refinements for funding-heavy purposes', () => {
    const result = synthesizeCoopFromPurpose({
      coopName: 'Funding Coop',
      purpose: 'Surface grant opportunities and capital sources.',
      captureMode: 'manual',
    });

    expect(result.soul.toneAndWorkingStyle).toContain('concrete opportunities');
  });

  it('limits artifact focus to at most 4 items', () => {
    const result = synthesizeCoopFromPurpose({
      coopName: 'Max Focus',
      purpose:
        'Track funding grants, gather evidence impact metrics, coordinate governance decisions, research knowledge notes, support member community volunteer.',
      captureMode: 'manual',
    });

    expect(result.soul.artifactFocus.length).toBeLessThanOrEqual(4);
  });

  it('builds named ritual moments that include the primary focus rule moment', () => {
    const result = synthesizeCoopFromPurpose({
      coopName: 'Fund Coop',
      purpose: 'Surface grant funding leads.',
      captureMode: 'manual',
    });

    expect(result.rituals[0]?.namedMoments).toContain('Funding scan');
  });

  it('builds facilitator expectation for personal space type', () => {
    const result = synthesizeCoopFromPurpose({
      coopName: 'My Journal',
      purpose: 'Track research and reflections.',
      spaceType: 'personal',
      captureMode: 'manual',
    });

    expect(result.rituals[0]?.facilitatorExpectation).toContain('You review');
  });
});

describe('synthesizeTranscriptsToPurpose', () => {
  it('combines all four transcript lenses into a purpose string', () => {
    const result = synthesizeTranscriptsToPurpose({
      capital: 'grant applications and budgets',
      impact: 'field reports and metrics',
      governance: 'weekly call decisions',
      knowledge: 'research tabs and reference docs',
    });

    expect(result).toContain('Keep');
    expect(result).toContain('track');
    expect(result).toContain('coordinate');
    expect(result).toContain('measure');
    expect(result).toContain('so nothing useful gets lost');
  });

  it('returns empty string when all inputs are empty', () => {
    const result = synthesizeTranscriptsToPurpose({
      capital: '',
      impact: '',
      governance: '',
      knowledge: '',
    });

    expect(result).toBe('');
  });

  it('handles partial inputs with only some lenses filled', () => {
    const result = synthesizeTranscriptsToPurpose({
      capital: 'grant tracking',
      impact: '',
      governance: '',
      knowledge: 'research notes',
    });

    expect(result).toContain('Keep');
    expect(result).toContain('track');
    expect(result).not.toContain('coordinate');
    expect(result).not.toContain('measure');
  });

  it('capitalizes the first letter of the output', () => {
    const result = synthesizeTranscriptsToPurpose({
      capital: '',
      impact: '',
      governance: '',
      knowledge: 'something',
    });

    expect(result[0]).toMatch(/[A-Z]/);
  });

  it('truncates long transcript inputs to 18 words', () => {
    const longText =
      'word one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty';
    const result = synthesizeTranscriptsToPurpose({
      capital: longText,
      impact: '',
      governance: '',
      knowledge: '',
    });

    // The "track" prefix + truncated text should not be excessively long
    expect(result.length).toBeLessThan(longText.length + 40);
  });
});

describe('createDefaultSeedContribution', () => {
  it('generates a seed contribution referencing the coop name', () => {
    const result = createDefaultSeedContribution('River Coop');
    expect(result).toContain('River Coop');
    expect(result).toContain('useful context');
  });

  it('uses a fallback when coop name is empty', () => {
    const result = createDefaultSeedContribution('');
    expect(result).toContain('this coop');
    expect(result).toContain('useful context');
  });

  it('trims whitespace from the coop name', () => {
    const result = createDefaultSeedContribution('  Spaced  Name  ');
    expect(result).toContain('Spaced Name');
    expect(result).not.toContain('  ');
  });
});

describe('summarizeSoulArtifact', () => {
  it('combines existence statement and signal definition into a truncated summary', () => {
    const soul = synthesizeCoopFromPurpose({
      coopName: 'Test Coop',
      purpose: 'Track evidence and funding leads.',
      captureMode: 'manual',
    }).soul;

    const summary = summarizeSoulArtifact(soul);
    expect(summary.length).toBeGreaterThan(0);
    expect(summary.split(/\s+/).length).toBeLessThanOrEqual(30);
  });
});

describe('summarizeRitualArtifact', () => {
  it('produces a truncated ritual summary', () => {
    const rituals = synthesizeCoopFromPurpose({
      coopName: 'Test Coop',
      purpose: 'Track evidence and funding leads.',
      captureMode: 'manual',
    }).rituals;
    const firstRitual = rituals[0];
    if (!firstRitual) {
      throw new Error('Expected at least one synthesized ritual.');
    }

    const summary = summarizeRitualArtifact(firstRitual);
    expect(summary.length).toBeGreaterThan(0);
    expect(summary).toContain('centers');
    expect(summary.split(/\s+/).length).toBeLessThanOrEqual(30);
  });
});

import { describe, expect, it } from 'vitest';
import { coopSoulSchema } from '../schema';

describe('coopSoulSchema', () => {
  const baseSoul = {
    purposeStatement: 'Coordinate forest stewardship.',
    toneAndWorkingStyle: 'Warm and observant.',
    usefulSignalDefinition: 'Artifacts that tighten shared context.',
    artifactFocus: ['insights', 'funding leads'],
    whyThisCoopExists: 'To turn loose tabs into shared intelligence.',
  };

  it('parses a legacy soul object without the new optional fields', () => {
    const result = coopSoulSchema.parse(baseSoul);
    expect(result.purposeStatement).toBe(baseSoul.purposeStatement);
    expect(result.agentPersona).toBeUndefined();
    expect(result.vocabularyTerms).toEqual([]);
    expect(result.prohibitedTopics).toEqual([]);
    expect(result.confidenceThreshold).toBe(0.72);
  });

  it('accepts all new fields when explicitly provided', () => {
    const soul = {
      ...baseSoul,
      agentPersona: 'A careful steward of shared context.',
      vocabularyTerms: ['bioregion', 'watershed', 'commons'],
      prohibitedTopics: ['partisan politics'],
      confidenceThreshold: 0.85,
    };
    const result = coopSoulSchema.parse(soul);
    expect(result.agentPersona).toBe('A careful steward of shared context.');
    expect(result.vocabularyTerms).toEqual(['bioregion', 'watershed', 'commons']);
    expect(result.prohibitedTopics).toEqual(['partisan politics']);
    expect(result.confidenceThreshold).toBe(0.85);
  });

  it('rejects confidenceThreshold outside [0, 1]', () => {
    expect(() => coopSoulSchema.parse({ ...baseSoul, confidenceThreshold: 1.5 })).toThrow();
    expect(() => coopSoulSchema.parse({ ...baseSoul, confidenceThreshold: -0.1 })).toThrow();
  });

  it('clamps confidenceThreshold at boundary values', () => {
    expect(coopSoulSchema.parse({ ...baseSoul, confidenceThreshold: 0 }).confidenceThreshold).toBe(
      0,
    );
    expect(coopSoulSchema.parse({ ...baseSoul, confidenceThreshold: 1 }).confidenceThreshold).toBe(
      1,
    );
  });
});

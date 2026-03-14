import { describe, expect, it } from 'vitest';
import { hasArchiveConfig, initialCreateForm } from '../setup-insights';
import type { CreateFormState } from '../setup-insights';

describe('archive config fields in coop creation form state', () => {
  it('initialCreateForm includes empty archive config fields', () => {
    expect(initialCreateForm.archiveSpaceDid).toBe('');
    expect(initialCreateForm.archiveAgentPrivateKey).toBe('');
    expect(initialCreateForm.archiveSpaceDelegation).toBe('');
    expect(initialCreateForm.archiveGatewayUrl).toBe('');
  });

  it('archive fields can be set in form state', () => {
    const form: CreateFormState = {
      ...initialCreateForm,
      archiveSpaceDid: 'did:key:z1234abc',
      archiveAgentPrivateKey: 'base64-private-key',
      archiveSpaceDelegation: 'base64-delegation',
      archiveGatewayUrl: 'https://custom-gateway.example.com',
    };

    expect(form.archiveSpaceDid).toBe('did:key:z1234abc');
    expect(form.archiveAgentPrivateKey).toBe('base64-private-key');
    expect(form.archiveSpaceDelegation).toBe('base64-delegation');
    expect(form.archiveGatewayUrl).toBe('https://custom-gateway.example.com');
  });

  it('hasArchiveConfig returns false when no archive fields are provided', () => {
    expect(hasArchiveConfig(initialCreateForm)).toBe(false);
  });

  it('hasArchiveConfig returns false when only spaceDid is provided', () => {
    expect(
      hasArchiveConfig({
        ...initialCreateForm,
        archiveSpaceDid: 'did:key:z1234',
      }),
    ).toBe(false);
  });

  it('hasArchiveConfig returns true when spaceDid and spaceDelegation are both provided', () => {
    expect(
      hasArchiveConfig({
        ...initialCreateForm,
        archiveSpaceDid: 'did:key:z1234',
        archiveSpaceDelegation: 'base64-delegation',
      }),
    ).toBe(true);
  });

  it('hasArchiveConfig returns false when only spaceDelegation is provided', () => {
    expect(
      hasArchiveConfig({
        ...initialCreateForm,
        archiveSpaceDelegation: 'base64-delegation',
      }),
    ).toBe(false);
  });
});

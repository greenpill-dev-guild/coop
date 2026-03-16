import { describe, expect, it } from 'vitest';
import {
  coopArchiveConfigSchema,
  coopArchiveSecretsSchema,
  trustedNodeArchiveConfigSchema,
} from '../../../contracts/schema';
import { mergeCoopArchiveConfig } from '../archive';

describe('coopArchiveConfigSchema', () => {
  it('validates a complete public archive config', () => {
    const result = coopArchiveConfigSchema.safeParse({
      spaceDid: 'did:key:z1234',
      delegationIssuer: 'did:key:zIssuer',
      gatewayBaseUrl: 'https://storacha.link',
      allowsFilecoinInfo: true,
      expirationSeconds: 300,
    });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      spaceDid: 'did:key:z1234',
      delegationIssuer: 'did:key:zIssuer',
      gatewayBaseUrl: 'https://storacha.link',
      allowsFilecoinInfo: true,
      expirationSeconds: 300,
    });
  });

  it('applies defaults for optional fields', () => {
    const result = coopArchiveConfigSchema.safeParse({
      spaceDid: 'did:key:z1234',
      delegationIssuer: 'did:key:zIssuer',
    });
    expect(result.success).toBe(true);
    expect(result.data?.gatewayBaseUrl).toBe('https://storacha.link');
    expect(result.data?.allowsFilecoinInfo).toBe(false);
    expect(result.data?.expirationSeconds).toBe(600);
  });

  it('rejects empty spaceDid', () => {
    const result = coopArchiveConfigSchema.safeParse({
      spaceDid: '',
      delegationIssuer: 'did:key:zIssuer',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid gatewayBaseUrl', () => {
    const result = coopArchiveConfigSchema.safeParse({
      spaceDid: 'did:key:z1234',
      delegationIssuer: 'did:key:zIssuer',
      gatewayBaseUrl: 'not-a-url',
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-positive expirationSeconds', () => {
    const result = coopArchiveConfigSchema.safeParse({
      spaceDid: 'did:key:z1234',
      delegationIssuer: 'did:key:zIssuer',
      expirationSeconds: 0,
    });
    expect(result.success).toBe(false);
  });
});

describe('coopArchiveSecretsSchema', () => {
  it('validates a complete secrets object', () => {
    const result = coopArchiveSecretsSchema.safeParse({
      coopId: 'coop-abc',
      agentPrivateKey: 'MgCY...key',
      spaceDelegation: 'delegation-proof-abc',
      proofs: ['proof-1'],
    });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      coopId: 'coop-abc',
      agentPrivateKey: 'MgCY...key',
      spaceDelegation: 'delegation-proof-abc',
      proofs: ['proof-1'],
    });
  });

  it('allows omitted agentPrivateKey', () => {
    const result = coopArchiveSecretsSchema.safeParse({
      coopId: 'coop-abc',
      spaceDelegation: 'delegation-proof-abc',
    });
    expect(result.success).toBe(true);
    expect(result.data?.agentPrivateKey).toBeUndefined();
  });

  it('defaults proofs to empty array', () => {
    const result = coopArchiveSecretsSchema.safeParse({
      coopId: 'coop-abc',
      spaceDelegation: 'delegation-proof-abc',
    });
    expect(result.success).toBe(true);
    expect(result.data?.proofs).toEqual([]);
  });

  it('rejects empty coopId', () => {
    const result = coopArchiveSecretsSchema.safeParse({
      coopId: '',
      spaceDelegation: 'delegation-proof-abc',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty spaceDelegation', () => {
    const result = coopArchiveSecretsSchema.safeParse({
      coopId: 'coop-abc',
      spaceDelegation: '',
    });
    expect(result.success).toBe(false);
  });
});

describe('mergeCoopArchiveConfig', () => {
  it('merges public config with secrets into a valid TrustedNodeArchiveConfig', () => {
    const publicConfig = coopArchiveConfigSchema.parse({
      spaceDid: 'did:key:z1234',
      delegationIssuer: 'did:key:zIssuer',
      gatewayBaseUrl: 'https://storacha.link',
      allowsFilecoinInfo: true,
      expirationSeconds: 300,
    });

    const secrets = coopArchiveSecretsSchema.parse({
      coopId: 'coop-abc',
      agentPrivateKey: 'MgCY...key',
      spaceDelegation: 'delegation-proof-abc',
      proofs: ['proof-1'],
    });

    const merged = mergeCoopArchiveConfig(publicConfig, secrets);

    // Should be a valid TrustedNodeArchiveConfig
    const validation = trustedNodeArchiveConfigSchema.safeParse(merged);
    expect(validation.success).toBe(true);

    // Verify all fields mapped correctly
    expect(merged.spaceDid).toBe('did:key:z1234');
    expect(merged.delegationIssuer).toBe('did:key:zIssuer');
    expect(merged.gatewayBaseUrl).toBe('https://storacha.link');
    expect(merged.allowsFilecoinInfo).toBe(true);
    expect(merged.expirationSeconds).toBe(300);
    expect(merged.agentPrivateKey).toBe('MgCY...key');
    expect(merged.spaceDelegation).toBe('delegation-proof-abc');
    expect(merged.proofs).toEqual(['proof-1']);
  });

  it('works with minimal secrets (no agentPrivateKey)', () => {
    const publicConfig = coopArchiveConfigSchema.parse({
      spaceDid: 'did:key:z5678',
      delegationIssuer: 'did:key:zIssuer2',
    });

    const secrets = coopArchiveSecretsSchema.parse({
      coopId: 'coop-xyz',
      spaceDelegation: 'delegation-xyz',
    });

    const merged = mergeCoopArchiveConfig(publicConfig, secrets);
    const validation = trustedNodeArchiveConfigSchema.safeParse(merged);
    expect(validation.success).toBe(true);
    expect(merged.agentPrivateKey).toBeUndefined();
    expect(merged.proofs).toEqual([]);
  });
});

// @vitest-environment node

import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { loadConfig } from '../src/config';

const baseEnv = {
  ISSUER_PORT: '4999',
  ISSUER_SERVICE_URL: 'https://issuer.example',
  ISSUER_AUTH_TOKEN: 'issuer-token',
  ISSUER_DELEGATION_SPACE_DID: 'did:test:space',
  ISSUER_DELEGATION_ISSUER: 'did:test:issuer',
  ISSUER_DELEGATION_SPACE_DELEGATION: 'space-delegation-proof',
  ISSUER_DELEGATION_PROOFS: JSON.stringify(['proof-a', 'proof-b']),
  ISSUER_DELEGATION_GATEWAY_URL: 'https://storacha.link',
  ISSUER_DELEGATION_ALLOWS_FILECOIN_INFO: 'true',
};

const config = loadConfig(baseEnv);
const app = createApp(config);

describe('issuer app', () => {
  it('exposes health', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('rejects malformed delegation requests', async () => {
    const response = await request(app)
      .post('/delegate')
      .set('authorization', 'Bearer issuer-token')
      .send({
        coopId: 'coop',
        scope: 'artifact',
        safeAddress: '0x1234567890abcdef1234567890abcdef12345678',
        actorAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        chainKey: 'sepolia',
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(response.body).toHaveProperty('details');
  });

  it('rejects unauthorized delegation requests when a bearer token is configured', async () => {
    const response = await request(app).post('/delegate').send({
      audienceDid: 'did:key:z5h9testaudience',
      coopId: 'coop-1',
      scope: 'artifact',
      actorAddress: '0x1111111111111111111111111111111111111111',
      safeAddress: '0x2222222222222222222222222222222222222222',
      chainKey: 'sepolia',
    });

    expect(response.status).toBe(401);
  });

  it('returns delegation material for valid requests', async () => {
    const payload = {
      audienceDid: 'did:key:z5h9testaudience',
      coopId: 'coop-1',
      scope: 'artifact',
      artifactIds: ['artifact-1'],
      actorAddress: '0x1111111111111111111111111111111111111111',
      safeAddress: '0x2222222222222222222222222222222222222222',
      chainKey: 'sepolia',
    };

    const response = await request(app)
      .post('/delegate')
      .set('authorization', 'Bearer issuer-token')
      .send(payload);
    expect(response.status).toBe(200);
    expect(response.body.spaceDid).toBe(config.ISSUER_DELEGATION_SPACE_DID);
    expect(response.body.delegationIssuer).toBe(config.ISSUER_DELEGATION_ISSUER);
    expect(response.body.proofs).toEqual(['proof-a', 'proof-b']);
    expect(response.body.gatewayBaseUrl).toBe(config.ISSUER_DELEGATION_GATEWAY_URL);
    expect(response.body.allowsFilecoinInfo).toBe(true);
  });
});

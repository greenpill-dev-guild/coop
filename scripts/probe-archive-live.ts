#!/usr/bin/env bun

import { resolveTrustedNodeArchiveBootstrapConfig } from '../packages/extension/src/runtime/config';
import { issueArchiveDelegation } from '../packages/shared/src/modules/archive/storacha';
import { loadRootEnv } from './load-root-env';

loadRootEnv();

const defaultProbeAudienceDid = 'did:key:z5h9testaudience';
const allowFallback = process.env.COOP_ALLOW_ARCHIVE_PROBE_FALLBACK === 'true';

const trustedNodeArchiveConfig =
  resolveTrustedNodeArchiveBootstrapConfig(process.env) ??
  (() => {
    if (!allowFallback) {
      throw new Error(
        '[archive-live] Trusted-node archive env is missing. Set the VITE_COOP_TRUSTED_NODE_ARCHIVE_* values in the operator-only root .env.local before claiming live archive readiness.',
      );
    }

    console.log(
      '[archive-live] Trusted-node archive env missing. Using an explicit in-process fallback wiring check because COOP_ALLOW_ARCHIVE_PROBE_FALLBACK=true.',
    );
    return {
      spaceDid: 'did:test:space',
      delegationIssuer: 'did:test:issuer',
      gatewayBaseUrl: 'https://storacha.link',
      spaceDelegation: 'space-delegation-placeholder',
      proofs: ['proof-a', 'proof-b'],
      allowsFilecoinInfo: true,
      expirationSeconds: 600,
    };
  })();

const delegation = await issueArchiveDelegation({
  request: {
    audienceDid: process.env.COOP_ARCHIVE_PROBE_AUDIENCE_DID ?? defaultProbeAudienceDid,
    coopId: 'archive-live-probe',
    scope: 'artifact',
    operation: 'upload',
    artifactIds: ['archive-live-probe-artifact'],
    actorAddress: '0x1111111111111111111111111111111111111111',
    safeAddress: '0x2222222222222222222222222222222222222222',
    chainKey: 'sepolia',
  },
  config: trustedNodeArchiveConfig,
});

if (!delegation.spaceDid || !delegation.spaceDelegation) {
  throw new Error('[archive-live] Trusted-node delegation probe returned incomplete material.');
}

console.log(
  `[archive-live] Trusted-node delegation probe returned material for ${delegation.delegationIssuer}.`,
);

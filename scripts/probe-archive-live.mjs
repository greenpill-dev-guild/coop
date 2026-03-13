#!/usr/bin/env node

const issuerUrlRaw = process.env.VITE_STORACHA_ISSUER_URL;

if (!issuerUrlRaw) {
  console.log('[archive-live] Skipping live probe: VITE_STORACHA_ISSUER_URL is not set.');
  process.exit(0);
}

const issuerUrl = new URL(issuerUrlRaw);
const healthUrl = new URL('/health', issuerUrl);
const delegationUrl = issuerUrl;
const token = process.env.VITE_STORACHA_ISSUER_TOKEN;
const probeAudienceDid = process.env.COOP_ARCHIVE_PROBE_AUDIENCE_DID;

const healthResponse = await fetch(healthUrl, {
  headers: token ? { authorization: `Bearer ${token}` } : undefined,
});

if (!healthResponse.ok) {
  throw new Error(`[archive-live] Issuer health check failed with ${healthResponse.status}.`);
}

console.log(`[archive-live] Issuer health OK at ${healthUrl.toString()}.`);

if (!probeAudienceDid) {
  console.log(
    '[archive-live] Skipping live delegation/upload probe: COOP_ARCHIVE_PROBE_AUDIENCE_DID is not set.',
  );
  process.exit(0);
}

const delegationResponse = await fetch(delegationUrl, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  },
  body: JSON.stringify({
    audienceDid: probeAudienceDid,
    coopId: 'archive-live-probe',
    scope: 'artifact',
    operation: 'upload',
    artifactIds: ['archive-live-probe-artifact'],
    actorAddress: '0x1111111111111111111111111111111111111111',
    safeAddress: '0x2222222222222222222222222222222222222222',
    chainKey: 'sepolia',
  }),
});

if (!delegationResponse.ok) {
  throw new Error(
    `[archive-live] Issuer delegation probe failed with ${delegationResponse.status}.`,
  );
}

const material = await delegationResponse.json();
if (!material?.spaceDelegation || !material?.spaceDid) {
  throw new Error('[archive-live] Issuer delegation probe returned incomplete material.');
}

console.log('[archive-live] Issuer delegation probe returned delegation material.');

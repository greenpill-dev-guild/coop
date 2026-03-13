import {
  type ArchiveDelegationRequest,
  archiveDelegationMaterialSchema,
} from '@coop/shared/contracts';
import * as StorachaClient from '@storacha/client';
import { parse as parseProof } from '@storacha/client/proof';
import * as Ed25519 from '@ucanto/principal/ed25519';
import express, { type Express } from 'express';
import { type IssuerConfig, config as defaultConfig } from './config';
import { delegateRequestSchema } from './types';

type IssuerAbility =
  | 'filecoin/info'
  | 'filecoin/offer'
  | 'space/blob/add'
  | 'space/index/add'
  | 'upload/add';

function decodeAgentSigner(value: string) {
  const normalized = value.trim();
  const candidates = [
    () => Buffer.from(normalized, 'base64url'),
    () => Buffer.from(normalized, 'base64'),
    () => Buffer.from(normalized, 'hex'),
  ];

  for (const candidate of candidates) {
    try {
      const bytes = candidate();
      if (bytes.byteLength > 0) {
        return Ed25519.decode(new Uint8Array(bytes));
      }
    } catch {}
  }

  throw new Error('Invalid ISSUER_AGENT_PRIVATE_KEY.');
}

function resolveAbilities(request: ArchiveDelegationRequest, cfg: IssuerConfig): IssuerAbility[] {
  if (request.operation === 'follow-up') {
    return ['filecoin/info'];
  }

  const abilities: IssuerAbility[] = [
    'filecoin/offer',
    'space/blob/add',
    'space/index/add',
    'upload/add',
  ];
  if (cfg.ISSUER_DELEGATION_ALLOWS_FILECOIN_INFO) {
    abilities.push('filecoin/info');
  }
  return abilities;
}

async function encodeDelegation(delegation: { archive(): unknown }) {
  const archived = (await delegation.archive()) as
    | { ok: Uint8Array; error?: undefined }
    | { ok?: undefined; error: unknown };

  if (!('ok' in archived) || !archived.ok) {
    throw archived.error instanceof Error
      ? archived.error
      : new Error('Could not archive delegation material.');
  }

  return Buffer.from(archived.ok).toString('base64');
}

async function issueDelegationMaterial(request: ArchiveDelegationRequest, cfg: IssuerConfig) {
  if (!cfg.ISSUER_AGENT_PRIVATE_KEY) {
    return archiveDelegationMaterialSchema.parse({
      spaceDid: cfg.ISSUER_DELEGATION_SPACE_DID,
      delegationIssuer: cfg.ISSUER_DELEGATION_ISSUER,
      gatewayBaseUrl: cfg.ISSUER_DELEGATION_GATEWAY_URL,
      spaceDelegation: cfg.ISSUER_DELEGATION_SPACE_DELEGATION,
      proofs: cfg.ISSUER_DELEGATION_PROOFS,
      issuerUrl: `${cfg.serviceUrl}/delegate`,
      allowsFilecoinInfo: cfg.ISSUER_DELEGATION_ALLOWS_FILECOIN_INFO,
      expiresAt: new Date(
        Date.now() + cfg.ISSUER_DELEGATION_EXPIRATION_SECONDS * 1000,
      ).toISOString(),
    });
  }

  const signer = decodeAgentSigner(cfg.ISSUER_AGENT_PRIVATE_KEY);
  const client = await StorachaClient.create({ principal: signer });
  await client.addSpace(await parseProof(cfg.ISSUER_DELEGATION_SPACE_DELEGATION));
  for (const proof of cfg.ISSUER_DELEGATION_PROOFS) {
    await client.addProof(await parseProof(proof));
  }
  await client.setCurrentSpace(cfg.ISSUER_DELEGATION_SPACE_DID as `did:${string}:${string}`);

  const delegation = await client.createDelegation(
    Ed25519.Verifier.parse(request.audienceDid),
    resolveAbilities(request, cfg),
    {
      expiration: Math.floor(Date.now() / 1000) + cfg.ISSUER_DELEGATION_EXPIRATION_SECONDS,
    },
  );

  return archiveDelegationMaterialSchema.parse({
    spaceDid: cfg.ISSUER_DELEGATION_SPACE_DID,
    delegationIssuer: signer.did() ?? cfg.ISSUER_DELEGATION_ISSUER,
    gatewayBaseUrl: cfg.ISSUER_DELEGATION_GATEWAY_URL,
    spaceDelegation: await encodeDelegation(delegation),
    proofs: [],
    issuerUrl: `${cfg.serviceUrl}/delegate`,
    allowsFilecoinInfo:
      cfg.ISSUER_DELEGATION_ALLOWS_FILECOIN_INFO || request.operation === 'follow-up',
    expiresAt: new Date(Date.now() + cfg.ISSUER_DELEGATION_EXPIRATION_SECONDS * 1000).toISOString(),
  });
}

export function createApp(cfg: IssuerConfig = defaultConfig): Express {
  const app = express();
  app.use(express.json({ limit: '512kb' }));

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.post('/delegate', async (req, res) => {
    if (cfg.ISSUER_AUTH_TOKEN) {
      const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
      if (token !== cfg.ISSUER_AUTH_TOKEN) {
        return res.status(401).json({
          error: 'Unauthorized issuer request',
        });
      }
    }

    const parsed = delegateRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid delegation request',
        details: parsed.error.format(),
      });
    }

    try {
      const response = await issueDelegationMaterial(parsed.data, cfg);

      res.json(response);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Could not issue archive delegation.',
      });
    }
  });

  return app;
}

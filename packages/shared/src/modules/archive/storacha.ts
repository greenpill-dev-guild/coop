import * as StorachaClient from '@storacha/client';
import { parse as parseProof } from '@storacha/client/proof';
import * as Ed25519 from '@ucanto/principal/ed25519';
import { CID } from 'multiformats/cid';
import {
  type ArchiveBundle,
  type ArchiveDelegationMaterial,
  type ArchiveDelegationRequestInput,
  type ArchiveReceipt,
  type TrustedNodeArchiveConfig,
  archiveDelegationMaterialSchema,
  archiveDelegationRequestSchema,
  trustedNodeArchiveConfigSchema,
} from '../../contracts/schema';
import { summarizeArchiveFilecoinInfo } from './archive';

export interface ArchiveUploadResult {
  audienceDid: string;
  rootCid: string;
  shardCids: string[];
  pieceCids: string[];
  gatewayUrl: string;
}

export type StorachaArchiveClient = Awaited<ReturnType<typeof StorachaClient.create>>;
export type StorachaDelegationClient = Awaited<ReturnType<typeof StorachaClient.create>>;

type StorachaIssuerAbility =
  | 'filecoin/info'
  | 'filecoin/offer'
  | 'space/blob/add'
  | 'space/index/add'
  | 'upload/add';

export async function createStorachaArchiveClient(): Promise<StorachaArchiveClient> {
  return StorachaClient.create();
}

function bytesFromBase64(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');

  if (typeof globalThis.atob === 'function') {
    const decoded = globalThis.atob(padded);
    return Uint8Array.from(decoded, (char) => char.charCodeAt(0));
  }

  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(padded, 'base64'));
  }

  throw new Error('Base64 decoding is unavailable in this runtime.');
}

function bytesFromHex(value: string) {
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length % 2 !== 0) {
    throw new Error('Hex input must have an even number of characters.');
  }

  const bytes = new Uint8Array(normalized.length / 2);
  for (let index = 0; index < normalized.length; index += 2) {
    const next = Number.parseInt(normalized.slice(index, index + 2), 16);
    if (Number.isNaN(next)) {
      throw new Error('Hex input contains invalid characters.');
    }
    bytes[index / 2] = next;
  }
  return bytes;
}

function bytesToBase64(bytes: Uint8Array) {
  if (typeof globalThis.btoa === 'function') {
    let binary = '';
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    return globalThis.btoa(binary);
  }

  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }

  throw new Error('Base64 encoding is unavailable in this runtime.');
}

function decodeAgentSigner(value: string) {
  const normalized = value.trim();
  const candidates = [() => bytesFromBase64(normalized), () => bytesFromHex(normalized)];

  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      const bytes = candidate();
      if (bytes.byteLength > 0) {
        return Ed25519.decode(new Uint8Array(bytes));
      }
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error('Trusted-node archive agent private key is invalid.', { cause: lastError });
}

function resolveDelegationAbilities(
  request: ArchiveDelegationRequestInput,
  config: TrustedNodeArchiveConfig,
): StorachaIssuerAbility[] {
  if (request.operation === 'follow-up') {
    return ['filecoin/info'];
  }

  const abilities: StorachaIssuerAbility[] = [
    'filecoin/offer',
    'space/blob/add',
    'space/index/add',
    'upload/add',
  ];
  if (config.allowsFilecoinInfo) {
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

  return bytesToBase64(archived.ok);
}

export async function applyArchiveDelegationToClient(
  client: StorachaArchiveClient,
  delegation: ArchiveDelegationMaterial,
) {
  const spaceProof = await parseProof(delegation.spaceDelegation);

  await client.addSpace(spaceProof);
  for (const proof of delegation.proofs) {
    await client.addProof(await parseProof(proof));
  }
  await client.setCurrentSpace(delegation.spaceDid as `did:${string}:${string}`);
}

export async function issueArchiveDelegation(input: {
  request: ArchiveDelegationRequestInput;
  config: TrustedNodeArchiveConfig;
  createDelegationClient?: (
    signer: ReturnType<typeof decodeAgentSigner>,
  ) => Promise<StorachaDelegationClient>;
  decodeSigner?: typeof decodeAgentSigner;
}): Promise<ArchiveDelegationMaterial> {
  const request = archiveDelegationRequestSchema.parse(input.request);
  const config = trustedNodeArchiveConfigSchema.parse(input.config);
  const allowsFilecoinInfo = config.allowsFilecoinInfo || request.operation === 'follow-up';

  if (!config.agentPrivateKey) {
    if (request.operation === 'follow-up' && !config.allowsFilecoinInfo) {
      throw new Error('Static trusted-node archive config does not allow Filecoin info follow-up.');
    }

    return archiveDelegationMaterialSchema.parse({
      spaceDid: config.spaceDid,
      delegationIssuer: config.delegationIssuer,
      gatewayBaseUrl: config.gatewayBaseUrl,
      spaceDelegation: config.spaceDelegation,
      proofs: config.proofs,
      allowsFilecoinInfo: config.allowsFilecoinInfo,
      expiresAt: new Date(Date.now() + config.expirationSeconds * 1000).toISOString(),
    });
  }

  const decodeSigner = input.decodeSigner ?? decodeAgentSigner;
  const createDelegationClient =
    input.createDelegationClient ??
    (async (signer: ReturnType<typeof decodeAgentSigner>) =>
      StorachaClient.create({ principal: signer }));

  const signer = decodeSigner(config.agentPrivateKey);
  const client = await createDelegationClient(signer);
  await client.addSpace(await parseProof(config.spaceDelegation));
  for (const proof of config.proofs) {
    await client.addProof(await parseProof(proof));
  }
  await client.setCurrentSpace(config.spaceDid as `did:${string}:${string}`);

  const delegation = await client.createDelegation(
    Ed25519.Verifier.parse(request.audienceDid),
    resolveDelegationAbilities(request, config),
    {
      expiration: Math.floor(Date.now() / 1000) + config.expirationSeconds,
    },
  );

  return archiveDelegationMaterialSchema.parse({
    spaceDid: config.spaceDid,
    delegationIssuer: signer.did() ?? config.delegationIssuer,
    gatewayBaseUrl: config.gatewayBaseUrl,
    spaceDelegation: await encodeDelegation(delegation),
    proofs: [],
    allowsFilecoinInfo,
    expiresAt: new Date(Date.now() + config.expirationSeconds * 1000).toISOString(),
  });
}

export async function uploadArchiveBundleToStoracha(input: {
  bundle: ArchiveBundle;
  delegation: ArchiveDelegationMaterial;
  client?: StorachaArchiveClient;
}): Promise<ArchiveUploadResult> {
  const client = input.client ?? (await createStorachaArchiveClient());
  const audienceDid = client.did();
  await applyArchiveDelegationToClient(client, input.delegation);

  const shardCids: string[] = [];
  const pieceCids = new Set<string>();
  const blob = new Blob([JSON.stringify(input.bundle.payload, null, 2)], {
    type: 'application/json',
  });

  const root = await client.uploadFile(blob, {
    onShardStored(meta) {
      shardCids.push(meta.cid.toString());
      if (meta.piece) {
        pieceCids.add(meta.piece.toString());
      }
    },
  });

  return {
    audienceDid,
    rootCid: root.toString(),
    shardCids,
    pieceCids: [...pieceCids],
    gatewayUrl: `${input.delegation.gatewayBaseUrl}/ipfs/${root}`,
  };
}

export async function requestArchiveReceiptFilecoinInfo(input: {
  receipt: ArchiveReceipt;
  delegation: ArchiveDelegationMaterial;
  client?: StorachaArchiveClient;
}) {
  const pieceCid = input.receipt.filecoinInfo?.pieceCid ?? input.receipt.pieceCids[0];
  if (!pieceCid) {
    throw new Error('Archive receipt has no piece CID to refresh.');
  }

  if (!input.delegation.allowsFilecoinInfo) {
    throw new Error('Delegation does not allow Filecoin info follow-up.');
  }

  const client = input.client ?? (await createStorachaArchiveClient());
  await applyArchiveDelegationToClient(client, input.delegation);
  const response = await client.capability.filecoin.info(CID.parse(pieceCid) as never);

  if (response.out.error) {
    const cause =
      'name' in response.out.error && typeof response.out.error.name === 'string'
        ? response.out.error.name
        : 'Storacha filecoin/info failed.';
    throw new Error(cause);
  }

  const info = response.out.ok;
  if (!info) {
    throw new Error('Storacha filecoin/info returned no result.');
  }

  return summarizeArchiveFilecoinInfo(info);
}

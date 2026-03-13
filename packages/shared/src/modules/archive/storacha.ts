import * as StorachaClient from '@storacha/client';
import { parse as parseProof } from '@storacha/client/proof';
import { CID } from 'multiformats/cid';
import {
  type ArchiveBundle,
  type ArchiveDelegationMaterial,
  type ArchiveDelegationRequestInput,
  type ArchiveReceipt,
  archiveDelegationMaterialSchema,
  archiveDelegationRequestSchema,
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

export async function createStorachaArchiveClient(): Promise<StorachaArchiveClient> {
  return StorachaClient.create();
}

async function applyArchiveDelegationToClient(
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

export async function requestArchiveDelegation(
  input: ArchiveDelegationRequestInput & { issuerUrl: string; issuerToken?: string },
): Promise<ArchiveDelegationMaterial> {
  const payload = archiveDelegationRequestSchema.parse(input);
  let response: Response;
  try {
    response = await fetch(input.issuerUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(input.issuerToken ? { authorization: `Bearer ${input.issuerToken}` } : {}),
      },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error('Archive issuer is unavailable.');
  }

  if (!response.ok) {
    throw new Error(`Storacha delegation request failed with ${response.status}.`);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error('Issuer returned malformed delegation material.');
  }

  let material: ArchiveDelegationMaterial;
  try {
    material = archiveDelegationMaterialSchema.parse(body);
  } catch {
    throw new Error('Issuer returned malformed delegation material.');
  }
  return {
    ...material,
    issuerUrl: material.issuerUrl ?? input.issuerUrl,
  };
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

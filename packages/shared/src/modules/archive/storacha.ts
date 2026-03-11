import * as StorachaClient from '@storacha/client';
import { parse as parseProof } from '@storacha/client/proof';
import {
  type ArchiveBundle,
  type ArchiveDelegationMaterial,
  type ArchiveScope,
  type OnchainState,
  archiveDelegationMaterialSchema,
} from '../../contracts/schema';

export interface ArchiveDelegationRequest {
  issuerUrl: string;
  issuerToken?: string;
  audienceDid: string;
  coopId: string;
  scope: ArchiveScope;
  artifactIds?: string[];
  actorAddress?: string;
  safeAddress?: string;
  chainKey?: OnchainState['chainKey'];
}

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

export async function requestArchiveDelegation(
  input: ArchiveDelegationRequest,
): Promise<ArchiveDelegationMaterial> {
  const response = await fetch(input.issuerUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(input.issuerToken ? { authorization: `Bearer ${input.issuerToken}` } : {}),
    },
    body: JSON.stringify({
      audienceDid: input.audienceDid,
      coopId: input.coopId,
      scope: input.scope,
      artifactIds: input.artifactIds ?? [],
      actorAddress: input.actorAddress,
      safeAddress: input.safeAddress,
      chainKey: input.chainKey,
    }),
  });

  if (!response.ok) {
    throw new Error(`Storacha delegation request failed with ${response.status}.`);
  }

  const material = archiveDelegationMaterialSchema.parse(await response.json());
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
  const spaceProof = await parseProof(input.delegation.spaceDelegation);

  await client.addSpace(spaceProof);
  for (const proof of input.delegation.proofs) {
    await client.addProof(await parseProof(proof));
  }
  await client.setCurrentSpace(input.delegation.spaceDid as `did:${string}:${string}`);

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

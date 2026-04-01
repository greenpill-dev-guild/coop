import z from 'zod';
import { type FvmChainKey, localFvmSignerBindingSchema } from '../../contracts/schema';
import { type LocalFvmSignerMaterial, buildLocalFvmSignerBindingId } from '../fvm/fvm';
import {
  buildEncryptedLocalPayloadRecord,
  getEncryptedLocalPayloadRecord,
  loadEncryptedJsonPayload,
} from './db-encryption';
import type { CoopDexie } from './db-schema';

const localFvmSignerSecretSchema = z.object({
  privateKey: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
});

export function buildLocalFvmSignerSettingKey(
  chainKey: FvmChainKey,
  passkeyCredentialId: string,
) {
  return buildLocalFvmSignerBindingId({ chainKey, passkeyCredentialId });
}

export async function saveLocalFvmSigner(db: CoopDexie, signer: LocalFvmSignerMaterial) {
  const binding = localFvmSignerBindingSchema.parse(signer);
  const payload = await buildEncryptedLocalPayloadRecord({
    db,
    kind: 'fvm-signer',
    entityId: binding.id,
    bytes: new TextEncoder().encode(
      JSON.stringify(localFvmSignerSecretSchema.parse({ privateKey: signer.privateKey })),
    ),
  });

  await db.transaction('rw', db.settings, db.encryptedLocalPayloads, async () => {
    await db.settings.put({
      key: buildLocalFvmSignerSettingKey(binding.chainKey, binding.passkeyCredentialId),
      value: binding,
    });
    await db.encryptedLocalPayloads.put(payload);
  });
}

export async function getLocalFvmSignerBinding(
  db: CoopDexie,
  chainKey: FvmChainKey,
  passkeyCredentialId: string,
) {
  const record = await db.settings.get(buildLocalFvmSignerSettingKey(chainKey, passkeyCredentialId));
  if (!record?.value) {
    return null;
  }

  const parsed = localFvmSignerBindingSchema.safeParse(record.value);
  if (!parsed.success) {
    console.warn(
      `[storage] Ignoring invalid local FVM signer binding for ${chainKey}/${passkeyCredentialId}.`,
      parsed.error,
    );
    return null;
  }

  return parsed.data;
}

export async function getLocalFvmSigner(
  db: CoopDexie,
  chainKey: FvmChainKey,
  passkeyCredentialId: string,
) {
  const binding = await getLocalFvmSignerBinding(db, chainKey, passkeyCredentialId);
  if (!binding) {
    return null;
  }

  const payload = await getEncryptedLocalPayloadRecord(db, 'fvm-signer', binding.id);
  if (!payload) {
    return null;
  }

  const secret = await loadEncryptedJsonPayload(db, 'fvm-signer', binding.id, (value) =>
    localFvmSignerSecretSchema.parse(value),
  );
  if (!secret) {
    return null;
  }

  return {
    ...binding,
    privateKey: secret.privateKey as `0x${string}`,
  } satisfies LocalFvmSignerMaterial;
}

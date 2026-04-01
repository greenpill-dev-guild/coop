import { afterEach, describe, expect, it } from 'vitest';
import type { CoopDexie } from '../db';
import {
  createCoopDb,
  getEncryptedLocalPayloadRecord,
  getLocalFvmSigner,
  getLocalFvmSignerBinding,
  saveLocalFvmSigner,
} from '../db';
import { createLocalFvmSignerMaterial } from '../../fvm';

const databases: CoopDexie[] = [];

function freshDb() {
  const db = createCoopDb(`coop-fvm-${crypto.randomUUID()}`);
  databases.push(db);
  return db;
}

afterEach(async () => {
  for (const db of databases) {
    db.close();
    await db.delete();
  }
  databases.length = 0;
});

describe('local FVM signer storage', () => {
  it('stores public metadata in settings and the private key in encrypted local payloads', async () => {
    const db = freshDb();
    const signer = createLocalFvmSignerMaterial({
      chainKey: 'filecoin-calibration',
      passkeyCredentialId: 'passkey-1',
      createdAt: '2026-03-31T10:00:00.000Z',
    });

    await saveLocalFvmSigner(db, signer);

    const binding = await getLocalFvmSignerBinding(db, 'filecoin-calibration', 'passkey-1');
    expect(binding).toEqual({
      id: signer.id,
      chainKey: signer.chainKey,
      accountAddress: signer.accountAddress,
      passkeyCredentialId: signer.passkeyCredentialId,
      createdAt: signer.createdAt,
      lastUsedAt: signer.lastUsedAt,
    });

    const payload = await getEncryptedLocalPayloadRecord(db, 'fvm-signer', signer.id);
    expect(payload?.entityId).toBe(signer.id);

    const rawSetting = await db.settings.get(signer.id);
    expect(rawSetting?.value).toEqual(binding);
    expect(rawSetting?.value).not.toHaveProperty('privateKey');

    const restored = await getLocalFvmSigner(db, 'filecoin-calibration', 'passkey-1');
    expect(restored).toEqual(signer);
  });
});

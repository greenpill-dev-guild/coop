import { afterEach, describe, expect, it } from 'vitest';
import {
  type CoopDexie,
  createCoopDb,
  getPrivacyIdentity,
  getStealthKeyPair,
} from '../../storage/db';
import { initializeCoopPrivacy, initializeMemberPrivacy } from '../lifecycle';

const databases: CoopDexie[] = [];

function freshDb(): CoopDexie {
  const db = createCoopDb(`coop-lifecycle-${crypto.randomUUID()}`);
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

describe('initializeCoopPrivacy', () => {
  it('creates a privacy identity for the creator', async () => {
    const db = freshDb();
    await initializeCoopPrivacy(db, { coopId: 'coop-1', memberId: 'member-1' });
    const identity = await getPrivacyIdentity(db, 'coop-1', 'member-1');
    expect(identity).toBeDefined();
    expect(identity?.coopId).toBe('coop-1');
    expect(identity?.memberId).toBe('member-1');
    expect(identity?.commitment).toBeTruthy();
    expect(identity?.publicKey).toHaveLength(2);
    expect(identity?.exportedPrivateKey).toBeTruthy();
    expect(identity?.id).toMatch(/^privacy-id-/);
  });

  it('creates stealth keys for the coop', async () => {
    const db = freshDb();
    await initializeCoopPrivacy(db, { coopId: 'coop-1', memberId: 'member-1' });
    const keyPair = await getStealthKeyPair(db, 'coop-1');
    expect(keyPair).toBeDefined();
    expect(keyPair?.coopId).toBe('coop-1');
    expect(keyPair?.spendingKey).toBeTruthy();
    expect(keyPair?.viewingKey).toBeTruthy();
    expect(keyPair?.spendingPublicKey).toBeTruthy();
    expect(keyPair?.viewingPublicKey).toBeTruthy();
    expect(keyPair?.metaAddress).toBeTruthy();
    expect(keyPair?.id).toMatch(/^stealth-kp-/);
  });

  it('returns both identity and stealth key data', async () => {
    const db = freshDb();
    const result = await initializeCoopPrivacy(db, { coopId: 'coop-1', memberId: 'member-1' });
    expect(result.identity).toBeDefined();
    expect(result.identity.commitment).toBeTruthy();
    expect(result.stealthKeys).toBeDefined();
    expect(result.metaAddress).toBeTruthy();
  });
});

describe('initializeMemberPrivacy', () => {
  it('creates a privacy identity for a joining member', async () => {
    const db = freshDb();
    const result = await initializeMemberPrivacy(db, { coopId: 'coop-1', memberId: 'member-2' });
    expect(result).toBeDefined();
    expect(result.coopId).toBe('coop-1');
    expect(result.memberId).toBe('member-2');
    expect(result.commitment).toBeTruthy();
  });

  it('is idempotent — returns existing record on second call', async () => {
    const db = freshDb();
    const first = await initializeMemberPrivacy(db, { coopId: 'coop-1', memberId: 'member-2' });
    const second = await initializeMemberPrivacy(db, { coopId: 'coop-1', memberId: 'member-2' });
    expect(second.id).toBe(first.id);
    expect(second.commitment).toBe(first.commitment);
  });

  it('creates distinct identities for different members in the same coop', async () => {
    const db = freshDb();
    const a = await initializeMemberPrivacy(db, { coopId: 'coop-1', memberId: 'member-a' });
    const b = await initializeMemberPrivacy(db, { coopId: 'coop-1', memberId: 'member-b' });
    expect(a.id).not.toBe(b.id);
    expect(a.commitment).not.toBe(b.commitment);
  });
});

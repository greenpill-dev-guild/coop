import Dexie, { type EntityTable } from 'dexie';
import type {
  AuthSession,
  CoopSharedState,
  LocalPasskeyIdentity,
  ReadablePageExtract,
  ReviewDraft,
  SoundPreferences,
  TabCandidate,
} from '../../contracts/schema';
import { createCoopDoc, encodeCoopDoc, hydrateCoopDoc, readCoopState } from '../coop/sync';

export interface CoopDocRecord {
  id: string;
  encodedState: Uint8Array;
  updatedAt: string;
}

export interface CaptureRunRecord {
  id: string;
  state: 'idle' | 'running' | 'failed' | 'completed';
  capturedAt: string;
  candidateCount: number;
}

export interface LocalSetting {
  key: string;
  value: unknown;
}

export class CoopDexie extends Dexie {
  tabCandidates!: EntityTable<TabCandidate, 'id'>;
  pageExtracts!: EntityTable<ReadablePageExtract, 'id'>;
  reviewDrafts!: EntityTable<ReviewDraft, 'id'>;
  coopDocs!: EntityTable<CoopDocRecord, 'id'>;
  captureRuns!: EntityTable<CaptureRunRecord, 'id'>;
  settings!: EntityTable<LocalSetting, 'key'>;
  identities!: EntityTable<LocalPasskeyIdentity, 'id'>;

  constructor(name = 'coop-v1') {
    super(name);
    this.version(1).stores({
      tabCandidates: 'id, canonicalUrl, domain, capturedAt',
      pageExtracts: 'id, canonicalUrl, domain, createdAt',
      reviewDrafts: 'id, category, createdAt',
      coopDocs: 'id, updatedAt',
      captureRuns: 'id, state, capturedAt',
      settings: 'key',
    });
    this.version(2).stores({
      tabCandidates: 'id, canonicalUrl, domain, capturedAt',
      pageExtracts: 'id, canonicalUrl, domain, createdAt',
      reviewDrafts: 'id, category, createdAt',
      coopDocs: 'id, updatedAt',
      captureRuns: 'id, state, capturedAt',
      settings: 'key',
      identities: 'id, ownerAddress, displayName, createdAt, lastUsedAt',
    });
  }
}

export function createCoopDb(name?: string) {
  return new CoopDexie(name);
}

export async function saveCoopState(db: CoopDexie, state: CoopSharedState) {
  const doc = createCoopDoc(state);
  await db.coopDocs.put({
    id: state.profile.id,
    encodedState: encodeCoopDoc(doc),
    updatedAt: new Date().toISOString(),
  });
}

export async function loadCoopState(db: CoopDexie, coopId: string) {
  const record = await db.coopDocs.get(coopId);
  if (!record) {
    return null;
  }
  const doc = hydrateCoopDoc(record.encodedState);
  return readCoopState(doc);
}

export async function setSoundPreferences(db: CoopDexie, value: SoundPreferences) {
  await db.settings.put({
    key: 'sound-preferences',
    value,
  });
}

export async function getSoundPreferences(db: CoopDexie): Promise<SoundPreferences | null> {
  const record = await db.settings.get('sound-preferences');
  return (record?.value as SoundPreferences | undefined) ?? null;
}

export async function setAuthSession(db: CoopDexie, value: AuthSession | null) {
  if (!value) {
    await db.settings.delete('auth-session');
    return;
  }
  await db.settings.put({
    key: 'auth-session',
    value,
  });
}

export async function getAuthSession(db: CoopDexie): Promise<AuthSession | null> {
  const record = await db.settings.get('auth-session');
  return (record?.value as AuthSession | undefined) ?? null;
}

export async function upsertLocalIdentity(db: CoopDexie, identity: LocalPasskeyIdentity) {
  await db.identities.put(identity);
}

export async function listLocalIdentities(db: CoopDexie) {
  return db.identities.orderBy('lastUsedAt').reverse().toArray();
}

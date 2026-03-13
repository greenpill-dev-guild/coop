import type { SessionCapability } from '@coop/shared';

/**
 * Structural comparison of session capability mutable fields.
 * Replaces JSON.stringify equality which is fragile and key-order dependent.
 */
export function sessionCapabilityChanged(
  a: Pick<
    SessionCapability,
    | 'status'
    | 'updatedAt'
    | 'usedCount'
    | 'lastValidationFailure'
    | 'statusDetail'
    | 'revokedAt'
    | 'lastUsedAt'
    | 'moduleInstalledAt'
    | 'enableSignature'
    | 'permissionId'
  >,
  b: Pick<
    SessionCapability,
    | 'status'
    | 'updatedAt'
    | 'usedCount'
    | 'lastValidationFailure'
    | 'statusDetail'
    | 'revokedAt'
    | 'lastUsedAt'
    | 'moduleInstalledAt'
    | 'enableSignature'
    | 'permissionId'
  >,
): boolean {
  // Normalize optional fields: Zod .optional() produces undefined for absent
  // fields, but Dexie/IndexedDB may store null. Coerce both to null so that
  // undefined !== null does not falsely report a change.
  return (
    a.status !== b.status ||
    a.updatedAt !== b.updatedAt ||
    a.usedCount !== b.usedCount ||
    (a.lastValidationFailure ?? null) !== (b.lastValidationFailure ?? null) ||
    (a.statusDetail ?? null) !== (b.statusDetail ?? null) ||
    (a.revokedAt ?? null) !== (b.revokedAt ?? null) ||
    (a.lastUsedAt ?? null) !== (b.lastUsedAt ?? null) ||
    (a.moduleInstalledAt ?? null) !== (b.moduleInstalledAt ?? null) ||
    (a.enableSignature ?? null) !== (b.enableSignature ?? null) ||
    (a.permissionId ?? null) !== (b.permissionId ?? null)
  );
}

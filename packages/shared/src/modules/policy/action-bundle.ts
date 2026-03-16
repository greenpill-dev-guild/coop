import { hashTypedData, zeroAddress } from 'viem';
import type {
  ActionBundle,
  ActionBundleStatus,
  ActionPolicy,
  DelegatedActionClass,
  PolicyActionClass,
  TypedActionBundle,
} from '../../contracts/schema';
import { actionBundleSchema } from '../../contracts/schema';
import { createId, hashJson, nowIso } from '../../utils';
import { isPolicyExpired } from './policy';

const DEFAULT_BUNDLE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface TypedActionPayload {
  actionClass: PolicyActionClass;
  coopId: string;
  memberId: string;
  payload: Record<string, unknown>;
}

export type ScopedActionClass = PolicyActionClass | DelegatedActionClass;

export type ScopedActionPayloadResolution =
  | {
      ok: true;
      coopId?: string;
      normalizedPayload: Record<string, unknown>;
      targetIds: string[];
    }
  | {
      ok: false;
      reason: string;
    };

function readRequiredString(
  payload: Record<string, unknown>,
  key: string,
): { ok: true; value: string } | { ok: false; reason: string } {
  const value = payload[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    return { ok: false, reason: `Action payload is missing "${key}".` };
  }
  return { ok: true, value };
}

function readOptionalString(
  payload: Record<string, unknown>,
  key: string,
): { ok: true; value?: string } | { ok: false; reason: string } {
  const value = payload[key];
  if (value === undefined) {
    return { ok: true };
  }
  if (typeof value !== 'string' || value.trim().length === 0) {
    return { ok: false, reason: `Action payload has an invalid "${key}".` };
  }
  return { ok: true, value };
}

function readRequiredStringArray(
  payload: Record<string, unknown>,
  key: string,
): { ok: true; value: string[] } | { ok: false; reason: string } {
  const value = payload[key];
  if (!Array.isArray(value)) {
    return { ok: false, reason: `Action payload is missing "${key}".` };
  }
  const items = value.filter((item): item is string => typeof item === 'string' && item.length > 0);
  if (items.length === 0 || items.length !== value.length) {
    return { ok: false, reason: `Action payload has an invalid "${key}".` };
  }
  return {
    ok: true,
    value: Array.from(new Set(items)),
  };
}

function readOptionalStringArray(
  payload: Record<string, unknown>,
  key: string,
): { ok: true; value: string[] } | { ok: false; reason: string } {
  const value = payload[key];
  if (value === undefined) {
    return { ok: true, value: [] };
  }
  return readRequiredStringArray(payload, key);
}

function readOptionalBoolean(
  payload: Record<string, unknown>,
  key: string,
): { ok: true; value?: boolean } | { ok: false; reason: string } {
  const value = payload[key];
  if (value === undefined) {
    return { ok: true };
  }
  if (typeof value !== 'boolean') {
    return { ok: false, reason: `Action payload has an invalid "${key}".` };
  }
  return { ok: true, value };
}

function readRequiredBoolean(
  payload: Record<string, unknown>,
  key: string,
): { ok: true; value: boolean } | { ok: false; reason: string } {
  const value = payload[key];
  if (typeof value !== 'boolean') {
    return { ok: false, reason: `Action payload is missing "${key}".` };
  }
  return { ok: true, value };
}

function readOptionalNonNegativeInteger(
  payload: Record<string, unknown>,
  key: string,
): { ok: true; value?: number } | { ok: false; reason: string } {
  const value = payload[key];
  if (value === undefined) {
    return { ok: true };
  }
  if (!Number.isInteger(value) || typeof value !== 'number' || value < 0) {
    return { ok: false, reason: `Action payload has an invalid "${key}".` };
  }
  return { ok: true, value };
}

function readRequiredNonNegativeInteger(
  payload: Record<string, unknown>,
  key: string,
): { ok: true; value: number } | { ok: false; reason: string } {
  const value = payload[key];
  if (!Number.isInteger(value) || typeof value !== 'number' || value < 0) {
    return { ok: false, reason: `Action payload is missing "${key}".` };
  }
  return { ok: true, value };
}

function readRequiredByte(
  payload: Record<string, unknown>,
  key: string,
): { ok: true; value: number } | { ok: false; reason: string } {
  const result = readRequiredNonNegativeInteger(payload, key);
  if (!result.ok) {
    return result;
  }
  if (result.value > 255) {
    return { ok: false, reason: `Action payload has an invalid "${key}".` };
  }
  return result;
}

function readGreenGoodsDomains(
  payload: Record<string, unknown>,
  key: string,
): { ok: true; value: string[] } | { ok: false; reason: string } {
  const result = readRequiredStringArray(payload, key);
  if (!result.ok) {
    return result;
  }
  if (result.value.some((value) => !['solar', 'agro', 'edu', 'waste'].includes(value))) {
    return { ok: false, reason: `Action payload has an invalid "${key}".` };
  }
  return result;
}

function readOptionalAddressArray(
  payload: Record<string, unknown>,
  key: string,
): { ok: true; value: string[] } | { ok: false; reason: string } {
  const result = readOptionalStringArray(payload, key);
  if (!result.ok) {
    return result;
  }
  if (result.value.some((value) => !/^0x[a-fA-F0-9]{40}$/.test(value))) {
    return { ok: false, reason: `Action payload has an invalid "${key}".` };
  }
  return result;
}

function readRequiredAddress(
  payload: Record<string, unknown>,
  key: string,
): { ok: true; value: string } | { ok: false; reason: string } {
  const value = readRequiredString(payload, key);
  if (!value.ok) {
    return value;
  }
  if (!/^0x[a-fA-F0-9]{40}$/.test(value.value)) {
    return { ok: false, reason: `Action payload has an invalid "${key}".` };
  }
  return value;
}

function readRequiredBytes32(
  payload: Record<string, unknown>,
  key: string,
): { ok: true; value: string } | { ok: false; reason: string } {
  const value = readRequiredString(payload, key);
  if (!value.ok) {
    return value;
  }
  if (!/^0x[a-fA-F0-9]{64}$/.test(value.value)) {
    return { ok: false, reason: `Action payload has an invalid "${key}".` };
  }
  return value;
}

function validateExpectedCoopId(actualCoopId: string, expectedCoopId?: string) {
  if (!expectedCoopId || actualCoopId === expectedCoopId) {
    return { ok: true as const };
  }

  return {
    ok: false as const,
    reason: `Action payload coop "${actualCoopId}" does not match scoped coop "${expectedCoopId}".`,
  };
}

export function resolveScopedActionPayload(input: {
  actionClass: ScopedActionClass;
  payload: Record<string, unknown>;
  expectedCoopId?: string;
}): ScopedActionPayloadResolution {
  switch (input.actionClass) {
    case 'archive-artifact': {
      const coopId = readRequiredString(input.payload, 'coopId');
      if (!coopId.ok) {
        return coopId;
      }
      const scopeValidation = validateExpectedCoopId(coopId.value, input.expectedCoopId);
      if (!scopeValidation.ok) {
        return scopeValidation;
      }
      const artifactId = readRequiredString(input.payload, 'artifactId');
      if (!artifactId.ok) {
        return artifactId;
      }
      return {
        ok: true,
        coopId: coopId.value,
        normalizedPayload: {
          coopId: coopId.value,
          artifactId: artifactId.value,
        },
        targetIds: [artifactId.value],
      };
    }
    case 'archive-snapshot': {
      const coopId = readRequiredString(input.payload, 'coopId');
      if (!coopId.ok) {
        return coopId;
      }
      const scopeValidation = validateExpectedCoopId(coopId.value, input.expectedCoopId);
      if (!scopeValidation.ok) {
        return scopeValidation;
      }
      return {
        ok: true,
        coopId: coopId.value,
        normalizedPayload: {
          coopId: coopId.value,
        },
        targetIds: [],
      };
    }
    case 'refresh-archive-status': {
      const coopId = readRequiredString(input.payload, 'coopId');
      if (!coopId.ok) {
        return coopId;
      }
      const scopeValidation = validateExpectedCoopId(coopId.value, input.expectedCoopId);
      if (!scopeValidation.ok) {
        return scopeValidation;
      }
      const receiptId = readOptionalString(input.payload, 'receiptId');
      if (!receiptId.ok) {
        return receiptId;
      }
      return {
        ok: true,
        coopId: coopId.value,
        normalizedPayload: {
          coopId: coopId.value,
          receiptId: receiptId.value,
        },
        targetIds: receiptId.value ? [receiptId.value] : [],
      };
    }
    case 'publish-ready-draft': {
      const draftId = readRequiredString(input.payload, 'draftId');
      if (!draftId.ok) {
        return draftId;
      }
      const targetCoopIds = readRequiredStringArray(input.payload, 'targetCoopIds');
      if (!targetCoopIds.ok) {
        return targetCoopIds;
      }
      if (input.expectedCoopId && !targetCoopIds.value.includes(input.expectedCoopId)) {
        return {
          ok: false,
          reason: `Publish targets must include the scoped coop "${input.expectedCoopId}".`,
        };
      }
      return {
        ok: true,
        coopId: input.expectedCoopId,
        normalizedPayload: {
          draftId: draftId.value,
          targetCoopIds: targetCoopIds.value,
        },
        targetIds: [draftId.value, ...targetCoopIds.value],
      };
    }
    case 'safe-deployment': {
      const coopSeed = readRequiredString(input.payload, 'coopSeed');
      if (!coopSeed.ok) {
        return coopSeed;
      }
      return {
        ok: true,
        normalizedPayload: {
          coopSeed: coopSeed.value,
        },
        targetIds: [coopSeed.value],
      };
    }
    case 'green-goods-create-garden': {
      const coopId = readRequiredString(input.payload, 'coopId');
      if (!coopId.ok) {
        return coopId;
      }
      const scopeValidation = validateExpectedCoopId(coopId.value, input.expectedCoopId);
      if (!scopeValidation.ok) {
        return scopeValidation;
      }
      const name = readRequiredString(input.payload, 'name');
      if (!name.ok) {
        return name;
      }
      const description = readRequiredString(input.payload, 'description');
      if (!description.ok) {
        return description;
      }
      const weightScheme = readRequiredString(input.payload, 'weightScheme');
      if (!weightScheme.ok) {
        return weightScheme;
      }
      if (!['linear', 'exponential', 'power'].includes(weightScheme.value)) {
        return {
          ok: false,
          reason: 'Action payload has an invalid "weightScheme".',
        };
      }
      const domains = readGreenGoodsDomains(input.payload, 'domains');
      if (!domains.ok) {
        return domains;
      }
      const slug = readOptionalString(input.payload, 'slug');
      if (!slug.ok) {
        return slug;
      }
      const location = readOptionalString(input.payload, 'location');
      if (!location.ok) {
        return location;
      }
      const bannerImage = readOptionalString(input.payload, 'bannerImage');
      if (!bannerImage.ok) {
        return bannerImage;
      }
      const metadata = readOptionalString(input.payload, 'metadata');
      if (!metadata.ok) {
        return metadata;
      }
      const openJoining = readOptionalBoolean(input.payload, 'openJoining');
      if (!openJoining.ok) {
        return openJoining;
      }
      const maxGardeners = readOptionalNonNegativeInteger(input.payload, 'maxGardeners');
      if (!maxGardeners.ok) {
        return maxGardeners;
      }
      const operatorAddresses = readOptionalAddressArray(input.payload, 'operatorAddresses');
      if (!operatorAddresses.ok) {
        return operatorAddresses;
      }
      const gardenerAddresses = readOptionalAddressArray(input.payload, 'gardenerAddresses');
      if (!gardenerAddresses.ok) {
        return gardenerAddresses;
      }
      return {
        ok: true,
        coopId: coopId.value,
        normalizedPayload: {
          coopId: coopId.value,
          name: name.value,
          slug: slug.value,
          description: description.value,
          location: location.value ?? '',
          bannerImage: bannerImage.value ?? '',
          metadata: metadata.value ?? '',
          openJoining: openJoining.value ?? false,
          maxGardeners: maxGardeners.value ?? 0,
          weightScheme: weightScheme.value,
          domains: domains.value,
          operatorAddresses: operatorAddresses.value,
          gardenerAddresses: gardenerAddresses.value,
        },
        targetIds: [name.value, ...domains.value],
      };
    }
    case 'green-goods-sync-garden-profile': {
      const coopId = readRequiredString(input.payload, 'coopId');
      if (!coopId.ok) {
        return coopId;
      }
      const scopeValidation = validateExpectedCoopId(coopId.value, input.expectedCoopId);
      if (!scopeValidation.ok) {
        return scopeValidation;
      }
      const gardenAddress = readRequiredAddress(input.payload, 'gardenAddress');
      if (!gardenAddress.ok) {
        return gardenAddress;
      }
      const name = readRequiredString(input.payload, 'name');
      if (!name.ok) {
        return name;
      }
      const description = readRequiredString(input.payload, 'description');
      if (!description.ok) {
        return description;
      }
      const location = readOptionalString(input.payload, 'location');
      if (!location.ok) {
        return location;
      }
      const bannerImage = readOptionalString(input.payload, 'bannerImage');
      if (!bannerImage.ok) {
        return bannerImage;
      }
      const metadata = readOptionalString(input.payload, 'metadata');
      if (!metadata.ok) {
        return metadata;
      }
      const openJoining = readOptionalBoolean(input.payload, 'openJoining');
      if (!openJoining.ok) {
        return openJoining;
      }
      const maxGardeners = readOptionalNonNegativeInteger(input.payload, 'maxGardeners');
      if (!maxGardeners.ok) {
        return maxGardeners;
      }
      return {
        ok: true,
        coopId: coopId.value,
        normalizedPayload: {
          coopId: coopId.value,
          gardenAddress: gardenAddress.value,
          name: name.value,
          description: description.value,
          location: location.value ?? '',
          bannerImage: bannerImage.value ?? '',
          metadata: metadata.value ?? '',
          openJoining: openJoining.value ?? false,
          maxGardeners: maxGardeners.value ?? 0,
        },
        targetIds: [gardenAddress.value],
      };
    }
    case 'green-goods-set-garden-domains': {
      const coopId = readRequiredString(input.payload, 'coopId');
      if (!coopId.ok) {
        return coopId;
      }
      const scopeValidation = validateExpectedCoopId(coopId.value, input.expectedCoopId);
      if (!scopeValidation.ok) {
        return scopeValidation;
      }
      const gardenAddress = readRequiredAddress(input.payload, 'gardenAddress');
      if (!gardenAddress.ok) {
        return gardenAddress;
      }
      const domains = readGreenGoodsDomains(input.payload, 'domains');
      if (!domains.ok) {
        return domains;
      }
      return {
        ok: true,
        coopId: coopId.value,
        normalizedPayload: {
          coopId: coopId.value,
          gardenAddress: gardenAddress.value,
          domains: domains.value,
        },
        targetIds: [gardenAddress.value, ...domains.value],
      };
    }
    case 'green-goods-create-garden-pools': {
      const coopId = readRequiredString(input.payload, 'coopId');
      if (!coopId.ok) {
        return coopId;
      }
      const scopeValidation = validateExpectedCoopId(coopId.value, input.expectedCoopId);
      if (!scopeValidation.ok) {
        return scopeValidation;
      }
      const gardenAddress = readRequiredAddress(input.payload, 'gardenAddress');
      if (!gardenAddress.ok) {
        return gardenAddress;
      }
      return {
        ok: true,
        coopId: coopId.value,
        normalizedPayload: {
          coopId: coopId.value,
          gardenAddress: gardenAddress.value,
        },
        targetIds: [gardenAddress.value],
      };
    }
    case 'green-goods-submit-work-approval': {
      const coopId = readRequiredString(input.payload, 'coopId');
      if (!coopId.ok) {
        return coopId;
      }
      const scopeValidation = validateExpectedCoopId(coopId.value, input.expectedCoopId);
      if (!scopeValidation.ok) {
        return scopeValidation;
      }
      const gardenAddress = readRequiredAddress(input.payload, 'gardenAddress');
      if (!gardenAddress.ok) {
        return gardenAddress;
      }
      const actionUid = readRequiredNonNegativeInteger(input.payload, 'actionUid');
      if (!actionUid.ok) {
        return actionUid;
      }
      const workUid = readRequiredBytes32(input.payload, 'workUid');
      if (!workUid.ok) {
        return workUid;
      }
      const approved = readRequiredBoolean(input.payload, 'approved');
      if (!approved.ok) {
        return approved;
      }
      const feedback = readOptionalString(input.payload, 'feedback');
      if (!feedback.ok) {
        return feedback;
      }
      const confidence = readRequiredByte(input.payload, 'confidence');
      if (!confidence.ok) {
        return confidence;
      }
      const verificationMethod = readRequiredByte(input.payload, 'verificationMethod');
      if (!verificationMethod.ok) {
        return verificationMethod;
      }
      const reviewNotesCid = readOptionalString(input.payload, 'reviewNotesCid');
      if (!reviewNotesCid.ok) {
        return reviewNotesCid;
      }
      return {
        ok: true,
        coopId: coopId.value,
        normalizedPayload: {
          coopId: coopId.value,
          gardenAddress: gardenAddress.value,
          actionUid: actionUid.value,
          workUid: workUid.value,
          approved: approved.value,
          feedback: feedback.value ?? '',
          confidence: confidence.value,
          verificationMethod: verificationMethod.value,
          reviewNotesCid: reviewNotesCid.value ?? '',
        },
        targetIds: [gardenAddress.value, workUid.value],
      };
    }
    case 'green-goods-create-assessment': {
      const coopId = readRequiredString(input.payload, 'coopId');
      if (!coopId.ok) {
        return coopId;
      }
      const scopeValidation = validateExpectedCoopId(coopId.value, input.expectedCoopId);
      if (!scopeValidation.ok) {
        return scopeValidation;
      }
      const gardenAddress = readRequiredAddress(input.payload, 'gardenAddress');
      if (!gardenAddress.ok) {
        return gardenAddress;
      }
      const title = readRequiredString(input.payload, 'title');
      if (!title.ok) {
        return title;
      }
      const description = readRequiredString(input.payload, 'description');
      if (!description.ok) {
        return description;
      }
      const assessmentConfigCid = readRequiredString(input.payload, 'assessmentConfigCid');
      if (!assessmentConfigCid.ok) {
        return assessmentConfigCid;
      }
      const domain = readRequiredString(input.payload, 'domain');
      if (!domain.ok) {
        return domain;
      }
      if (!['solar', 'agro', 'edu', 'waste'].includes(domain.value)) {
        return { ok: false, reason: 'Action payload has an invalid "domain".' };
      }
      const startDate = readRequiredNonNegativeInteger(input.payload, 'startDate');
      if (!startDate.ok) {
        return startDate;
      }
      const endDate = readRequiredNonNegativeInteger(input.payload, 'endDate');
      if (!endDate.ok) {
        return endDate;
      }
      if (endDate.value < startDate.value) {
        return { ok: false, reason: 'Action payload has an invalid "endDate".' };
      }
      const location = readOptionalString(input.payload, 'location');
      if (!location.ok) {
        return location;
      }
      return {
        ok: true,
        coopId: coopId.value,
        normalizedPayload: {
          coopId: coopId.value,
          gardenAddress: gardenAddress.value,
          title: title.value,
          description: description.value,
          assessmentConfigCid: assessmentConfigCid.value,
          domain: domain.value,
          startDate: startDate.value,
          endDate: endDate.value,
          location: location.value ?? '',
        },
        targetIds: [gardenAddress.value, title.value, assessmentConfigCid.value],
      };
    }
    case 'green-goods-sync-gap-admins': {
      const coopId = readRequiredString(input.payload, 'coopId');
      if (!coopId.ok) {
        return coopId;
      }
      const scopeValidation = validateExpectedCoopId(coopId.value, input.expectedCoopId);
      if (!scopeValidation.ok) {
        return scopeValidation;
      }
      const gardenAddress = readRequiredAddress(input.payload, 'gardenAddress');
      if (!gardenAddress.ok) {
        return gardenAddress;
      }
      const addAdmins = readOptionalAddressArray(input.payload, 'addAdmins');
      if (!addAdmins.ok) {
        return addAdmins;
      }
      const removeAdmins = readOptionalAddressArray(input.payload, 'removeAdmins');
      if (!removeAdmins.ok) {
        return removeAdmins;
      }
      return {
        ok: true,
        coopId: coopId.value,
        normalizedPayload: {
          coopId: coopId.value,
          gardenAddress: gardenAddress.value,
          addAdmins: addAdmins.value,
          removeAdmins: removeAdmins.value,
        },
        targetIds: [gardenAddress.value, ...addAdmins.value, ...removeAdmins.value],
      };
    }
    case 'erc8004-register-agent': {
      const coopId = readRequiredString(input.payload, 'coopId');
      if (!coopId.ok) return coopId;
      const scopeValidation = validateExpectedCoopId(coopId.value, input.expectedCoopId);
      if (!scopeValidation.ok) return scopeValidation;
      return {
        ok: true,
        coopId: coopId.value,
        normalizedPayload: { ...input.payload, coopId: coopId.value },
        targetIds: [],
      };
    }
    case 'erc8004-give-feedback': {
      const coopId = readRequiredString(input.payload, 'coopId');
      if (!coopId.ok) return coopId;
      const scopeValidation = validateExpectedCoopId(coopId.value, input.expectedCoopId);
      if (!scopeValidation.ok) return scopeValidation;
      return {
        ok: true,
        coopId: coopId.value,
        normalizedPayload: { ...input.payload, coopId: coopId.value },
        targetIds: [],
      };
    }
  }
}

export function buildTypedActionBundle(input: {
  actionClass: PolicyActionClass;
  coopId: string;
  memberId: string;
  replayId: string;
  payload: Record<string, unknown>;
  createdAt: string;
  expiresAt: string;
  chainId?: number;
  chainKey?: 'arbitrum' | 'sepolia';
  safeAddress?: `0x${string}`;
}): TypedActionBundle {
  const typedData = {
    domain: {
      name: 'Coop Action Bundle',
      version: '1',
      chainId: input.chainId ?? 11155111,
      verifyingContract: input.safeAddress ?? zeroAddress,
    },
    types: {
      CoopActionBundle: [
        { name: 'actionClass', type: 'string' },
        { name: 'coopId', type: 'string' },
        { name: 'memberId', type: 'string' },
        { name: 'replayId', type: 'string' },
        { name: 'payloadHash', type: 'bytes32' },
        { name: 'createdAt', type: 'string' },
        { name: 'expiresAt', type: 'string' },
        { name: 'chainKey', type: 'string' },
        { name: 'safeAddress', type: 'address' },
      ],
    },
    primaryType: 'CoopActionBundle' as const,
    message: {
      actionClass: input.actionClass,
      coopId: input.coopId,
      memberId: input.memberId,
      replayId: input.replayId,
      payloadHash: hashJson(input.payload),
      createdAt: input.createdAt,
      expiresAt: input.expiresAt,
      chainKey: input.chainKey ?? 'sepolia',
      safeAddress: input.safeAddress ?? zeroAddress,
    },
  };
  return {
    ...typedData,
    digest: hashTypedData(typedData),
  };
}

/**
 * Real EIP-712 typed digest for action bundles.
 */
export function computeTypedDigest(input: {
  actionClass: PolicyActionClass;
  coopId: string;
  memberId: string;
  replayId: string;
  payload: Record<string, unknown>;
  createdAt: string;
  expiresAt: string;
  chainId?: number;
  chainKey?: 'arbitrum' | 'sepolia';
  safeAddress?: `0x${string}`;
}): string {
  return buildTypedActionBundle(input).digest;
}

export function createActionBundle(input: {
  actionClass: PolicyActionClass;
  coopId: string;
  memberId: string;
  payload: Record<string, unknown>;
  policy: ActionPolicy;
  expiresAt?: string;
  createdAt?: string;
  chainId?: number;
  chainKey?: 'arbitrum' | 'sepolia';
  safeAddress?: `0x${string}`;
}): ActionBundle {
  const createdAt = input.createdAt ?? nowIso();
  const expiresAt =
    input.expiresAt ??
    new Date(new Date(createdAt).getTime() + DEFAULT_BUNDLE_TTL_MS).toISOString();
  const replayId = createId('replay');

  const initialStatus: ActionBundleStatus = input.policy.approvalRequired ? 'proposed' : 'approved';

  const typedAuthorization = buildTypedActionBundle({
    actionClass: input.actionClass,
    coopId: input.coopId,
    memberId: input.memberId,
    replayId,
    payload: input.payload,
    createdAt,
    expiresAt,
    chainId: input.chainId,
    chainKey: input.chainKey,
    safeAddress: input.safeAddress,
  });

  return actionBundleSchema.parse({
    id: createId('bundle'),
    replayId,
    actionClass: input.actionClass,
    coopId: input.coopId,
    memberId: input.memberId,
    payload: input.payload,
    createdAt,
    expiresAt,
    policyId: input.policy.id,
    status: initialStatus,
    digest: typedAuthorization.digest,
    typedAuthorization,
    approvedAt: initialStatus === 'approved' ? createdAt : undefined,
  });
}

export function isBundleExpired(bundle: ActionBundle, now?: string): boolean {
  const reference = now ?? nowIso();
  return bundle.expiresAt <= reference;
}

export function validateActionBundle(
  bundle: ActionBundle,
  policy: ActionPolicy,
  now?: string,
): { ok: true } | { ok: false; reason: string } {
  if (isBundleExpired(bundle, now)) {
    return { ok: false, reason: 'Action bundle has expired.' };
  }

  if (isPolicyExpired(policy, now)) {
    return { ok: false, reason: 'Policy has expired.' };
  }

  if (bundle.actionClass !== policy.actionClass) {
    return { ok: false, reason: 'Action class does not match policy.' };
  }

  if (policy.coopId && policy.coopId !== bundle.coopId) {
    return { ok: false, reason: 'Bundle coop does not match policy constraint.' };
  }

  if (policy.memberId && policy.memberId !== bundle.memberId) {
    return { ok: false, reason: 'Bundle member does not match policy constraint.' };
  }

  const expectedDigest = computeTypedDigest({
    actionClass: bundle.actionClass,
    coopId: bundle.coopId,
    memberId: bundle.memberId,
    replayId: bundle.replayId,
    payload: bundle.payload,
    createdAt: bundle.createdAt,
    expiresAt: bundle.expiresAt,
    chainId: bundle.typedAuthorization?.domain.chainId,
    chainKey: bundle.typedAuthorization?.message.chainKey,
    safeAddress: bundle.typedAuthorization?.message.safeAddress as `0x${string}` | undefined,
  });

  if (bundle.digest !== expectedDigest) {
    return { ok: false, reason: 'Bundle digest verification failed.' };
  }

  if (bundle.typedAuthorization) {
    const expectedTypedAuthorization = buildTypedActionBundle({
      actionClass: bundle.actionClass,
      coopId: bundle.coopId,
      memberId: bundle.memberId,
      replayId: bundle.replayId,
      payload: bundle.payload,
      createdAt: bundle.createdAt,
      expiresAt: bundle.expiresAt,
      chainId: bundle.typedAuthorization.domain.chainId,
      chainKey: bundle.typedAuthorization.message.chainKey,
      safeAddress: bundle.typedAuthorization.message.safeAddress as `0x${string}`,
    });

    const verifyingContractMatches =
      bundle.typedAuthorization.domain.verifyingContract.toLowerCase() ===
      expectedTypedAuthorization.domain.verifyingContract.toLowerCase();
    const safeAddressMatches =
      bundle.typedAuthorization.message.safeAddress.toLowerCase() ===
      expectedTypedAuthorization.message.safeAddress.toLowerCase();

    if (
      bundle.typedAuthorization.domain.name !== expectedTypedAuthorization.domain.name ||
      bundle.typedAuthorization.domain.version !== expectedTypedAuthorization.domain.version ||
      bundle.typedAuthorization.domain.chainId !== expectedTypedAuthorization.domain.chainId ||
      !verifyingContractMatches ||
      bundle.typedAuthorization.primaryType !== expectedTypedAuthorization.primaryType ||
      hashJson(bundle.typedAuthorization.types) !== hashJson(expectedTypedAuthorization.types) ||
      bundle.typedAuthorization.message.actionClass !==
        expectedTypedAuthorization.message.actionClass ||
      bundle.typedAuthorization.message.coopId !== expectedTypedAuthorization.message.coopId ||
      bundle.typedAuthorization.message.memberId !== expectedTypedAuthorization.message.memberId ||
      bundle.typedAuthorization.message.replayId !== expectedTypedAuthorization.message.replayId ||
      bundle.typedAuthorization.message.payloadHash !==
        expectedTypedAuthorization.message.payloadHash ||
      bundle.typedAuthorization.message.createdAt !==
        expectedTypedAuthorization.message.createdAt ||
      bundle.typedAuthorization.message.expiresAt !==
        expectedTypedAuthorization.message.expiresAt ||
      bundle.typedAuthorization.message.chainKey !== expectedTypedAuthorization.message.chainKey ||
      !safeAddressMatches ||
      bundle.typedAuthorization.digest !== expectedTypedAuthorization.digest
    ) {
      return { ok: false, reason: 'Typed authorization verification failed.' };
    }
  }

  const payloadResolution = resolveScopedActionPayload({
    actionClass: bundle.actionClass,
    payload: bundle.payload,
    expectedCoopId: bundle.coopId,
  });
  if (!payloadResolution.ok) {
    return { ok: false, reason: payloadResolution.reason };
  }

  return { ok: true };
}

export function buildArchiveArtifactPayload(input: {
  coopId: string;
  artifactId: string;
}): Record<string, unknown> {
  return { coopId: input.coopId, artifactId: input.artifactId };
}

export function buildArchiveSnapshotPayload(input: {
  coopId: string;
}): Record<string, unknown> {
  return { coopId: input.coopId };
}

export function buildRefreshArchiveStatusPayload(input: {
  coopId: string;
  receiptId?: string;
}): Record<string, unknown> {
  return { coopId: input.coopId, receiptId: input.receiptId };
}

export function buildPublishReadyDraftPayload(input: {
  draftId: string;
  targetCoopIds: string[];
}): Record<string, unknown> {
  return { draftId: input.draftId, targetCoopIds: input.targetCoopIds };
}

export function buildSafeDeploymentPayload(input: {
  coopSeed: string;
}): Record<string, unknown> {
  return { coopSeed: input.coopSeed };
}

export function buildGreenGoodsCreateGardenPayload(input: {
  coopId: string;
  name: string;
  slug?: string;
  description: string;
  location?: string;
  bannerImage?: string;
  metadata?: string;
  openJoining?: boolean;
  maxGardeners?: number;
  weightScheme: 'linear' | 'exponential' | 'power';
  domains: string[];
  operatorAddresses?: string[];
  gardenerAddresses?: string[];
}): Record<string, unknown> {
  return {
    coopId: input.coopId,
    name: input.name,
    slug: input.slug,
    description: input.description,
    location: input.location,
    bannerImage: input.bannerImage,
    metadata: input.metadata,
    openJoining: input.openJoining ?? false,
    maxGardeners: input.maxGardeners ?? 0,
    weightScheme: input.weightScheme,
    domains: input.domains,
    operatorAddresses: input.operatorAddresses ?? [],
    gardenerAddresses: input.gardenerAddresses ?? [],
  };
}

export function buildGreenGoodsSyncGardenProfilePayload(input: {
  coopId: string;
  gardenAddress: string;
  name: string;
  description: string;
  location?: string;
  bannerImage?: string;
  metadata?: string;
  openJoining?: boolean;
  maxGardeners?: number;
}): Record<string, unknown> {
  return {
    coopId: input.coopId,
    gardenAddress: input.gardenAddress,
    name: input.name,
    description: input.description,
    location: input.location,
    bannerImage: input.bannerImage,
    metadata: input.metadata,
    openJoining: input.openJoining ?? false,
    maxGardeners: input.maxGardeners ?? 0,
  };
}

export function buildGreenGoodsSetGardenDomainsPayload(input: {
  coopId: string;
  gardenAddress: string;
  domains: string[];
}): Record<string, unknown> {
  return {
    coopId: input.coopId,
    gardenAddress: input.gardenAddress,
    domains: input.domains,
  };
}

export function buildGreenGoodsCreateGardenPoolsPayload(input: {
  coopId: string;
  gardenAddress: string;
}): Record<string, unknown> {
  return {
    coopId: input.coopId,
    gardenAddress: input.gardenAddress,
  };
}

export function buildGreenGoodsSubmitWorkApprovalPayload(input: {
  coopId: string;
  gardenAddress: string;
  actionUid: number;
  workUid: string;
  approved: boolean;
  feedback?: string;
  confidence: number;
  verificationMethod: number;
  reviewNotesCid?: string;
}): Record<string, unknown> {
  return {
    coopId: input.coopId,
    gardenAddress: input.gardenAddress,
    actionUid: input.actionUid,
    workUid: input.workUid,
    approved: input.approved,
    feedback: input.feedback ?? '',
    confidence: input.confidence,
    verificationMethod: input.verificationMethod,
    reviewNotesCid: input.reviewNotesCid ?? '',
  };
}

export function buildGreenGoodsCreateAssessmentPayload(input: {
  coopId: string;
  gardenAddress: string;
  title: string;
  description: string;
  assessmentConfigCid: string;
  domain: 'solar' | 'agro' | 'edu' | 'waste';
  startDate: number;
  endDate: number;
  location?: string;
}): Record<string, unknown> {
  return {
    coopId: input.coopId,
    gardenAddress: input.gardenAddress,
    title: input.title,
    description: input.description,
    assessmentConfigCid: input.assessmentConfigCid,
    domain: input.domain,
    startDate: input.startDate,
    endDate: input.endDate,
    location: input.location ?? '',
  };
}

export function buildGreenGoodsSyncGapAdminsPayload(input: {
  coopId: string;
  gardenAddress: string;
  addAdmins?: string[];
  removeAdmins?: string[];
}): Record<string, unknown> {
  return {
    coopId: input.coopId,
    gardenAddress: input.gardenAddress,
    addAdmins: input.addAdmins ?? [],
    removeAdmins: input.removeAdmins ?? [],
  };
}

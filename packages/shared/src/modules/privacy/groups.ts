import { ApiSdk, type SupportedUrl } from '@bandada/api-sdk';

let _sdk: ApiSdk | undefined;

function getSdk(url?: SupportedUrl | string): ApiSdk {
  if (!_sdk) {
    _sdk = new ApiSdk(url);
  }
  return _sdk;
}

/**
 * Resets the internal SDK instance. Useful for testing or
 * switching environments at runtime.
 */
export function resetBandadaSdk(): void {
  _sdk = undefined;
}

/**
 * Creates a Bandada group via the API.
 */
export async function createBandadaGroup(config: {
  name: string;
  description: string;
  treeDepth: number;
  fingerprintDuration: number;
  apiKey: string;
  apiUrl?: SupportedUrl | string;
}) {
  if (!config.name) {
    throw new Error('name is required');
  }
  if (!config.apiKey) {
    throw new Error('apiKey is required');
  }

  const sdk = getSdk(config.apiUrl);
  return sdk.createGroup(
    {
      name: config.name,
      description: config.description,
      treeDepth: config.treeDepth,
      fingerprintDuration: config.fingerprintDuration,
    },
    config.apiKey,
  );
}

/**
 * Adds a member commitment to a Bandada group.
 */
export async function addGroupMember(params: {
  groupId: string;
  commitment: string;
  apiKey: string;
  apiUrl?: SupportedUrl | string;
}): Promise<void> {
  if (!params.groupId) {
    throw new Error('groupId is required');
  }
  if (!params.commitment) {
    throw new Error('commitment is required');
  }

  const sdk = getSdk(params.apiUrl);
  await sdk.addMemberByApiKey(params.groupId, params.commitment, params.apiKey);
}

/**
 * Removes a member commitment from a Bandada group.
 */
export async function removeGroupMember(params: {
  groupId: string;
  commitment: string;
  apiKey: string;
  apiUrl?: SupportedUrl | string;
}): Promise<void> {
  if (!params.groupId) {
    throw new Error('groupId is required');
  }
  if (!params.commitment) {
    throw new Error('commitment is required');
  }

  const sdk = getSdk(params.apiUrl);
  await sdk.removeMemberByApiKey(params.groupId, params.commitment, params.apiKey);
}

/**
 * Returns the list of member commitments for a Bandada group.
 */
export async function getGroupMembers(
  groupId: string,
  apiUrl?: SupportedUrl | string,
): Promise<string[]> {
  if (!groupId) {
    throw new Error('groupId is required');
  }

  const sdk = getSdk(apiUrl);
  const group = await sdk.getGroup(groupId);
  return group.members;
}

/**
 * Checks whether a commitment is a member of a Bandada group.
 */
export async function isGroupMember(
  groupId: string,
  commitment: string,
  apiUrl?: SupportedUrl | string,
): Promise<boolean> {
  if (!groupId) {
    throw new Error('groupId is required');
  }
  if (!commitment) {
    throw new Error('commitment is required');
  }

  const sdk = getSdk(apiUrl);
  return sdk.isGroupMember(groupId, commitment);
}

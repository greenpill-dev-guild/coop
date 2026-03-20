import {
  type AnchorCapability,
  type AuthSession,
  type IntegrationMode,
  describeAnchorCapabilityStatus,
  isAnchorCapabilityActive,
} from '@coop/shared';

export type PrivilegedFeature =
  | 'live archive uploads'
  | 'live Safe deployments'
  | 'archive follow-up jobs'
  | 'archive CID anchoring'
  | 'erc8004 identity registration'
  | 'Filecoin registry registration';

export function requireAnchorModeForFeature(input: {
  capability: AnchorCapability | null | undefined;
  authSession?: Pick<AuthSession, 'primaryAddress'> | null;
  feature: PrivilegedFeature;
}) {
  if (isAnchorCapabilityActive(input.capability, input.authSession)) {
    return;
  }

  const status = describeAnchorCapabilityStatus({
    capability: input.capability,
    authSession: input.authSession,
  });

  if (!status.enabled) {
    throw new Error(`Anchor mode is off. Enable it before ${input.feature}.`);
  }

  throw new Error(`Anchor mode is inactive for this member. Re-enable it before ${input.feature}.`);
}

export function describePrivilegedFeatureAvailability(input: {
  mode: IntegrationMode;
  capability: AnchorCapability | null | undefined;
  authSession?: Pick<AuthSession, 'primaryAddress'> | null;
  liveLabel: string;
}) {
  if (input.mode === 'mock') {
    return {
      available: true,
      detail: `Mock ${input.liveLabel} stays available without anchor mode.`,
    };
  }

  const status = describeAnchorCapabilityStatus({
    capability: input.capability,
    authSession: input.authSession,
  });

  return {
    available: status.active,
    detail: status.active
      ? `Live ${input.liveLabel} is ready from this anchor node.`
      : `Live ${input.liveLabel} is unavailable because anchor mode is off for this member context.`,
  };
}

export function describeArchiveLiveFailure(error: unknown) {
  const message = error instanceof Error ? error.message : 'Archive upload failed.';
  const lower = message.toLowerCase();

  if (lower.includes('anchor mode')) {
    return message;
  }

  if (lower.includes('trusted-node archive') && lower.includes('config')) {
    return message;
  }

  if (lower.includes('malformed delegation')) {
    return 'Trusted-node archive delegation material is malformed.';
  }

  if (lower.includes('trusted-node') || lower.includes('delegation')) {
    return 'Trusted-node archive delegation could not be issued.';
  }

  if (lower.includes('upload')) {
    return 'Archive upload failed after delegation was issued.';
  }

  return message;
}

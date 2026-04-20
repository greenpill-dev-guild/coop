/**
 * Shared test factories for popup integration tests.
 *
 * Extracted from PopupApp.test.tsx to enable reuse across view tests.
 * Pattern: message-passing mocks + dashboard factory + snapshot hydration.
 */
import type { Artifact, ReviewDraft } from '@coop/shared';
import {
  makeArtifact as makeSharedArtifact,
  makeReviewDraft as makeSharedReviewDraft,
} from '@coop/shared/testing';
import type { vi } from 'vitest';
import { makeCoopState, makeDashboardResponse } from '../../__tests__/fixtures';
import type { DashboardResponse } from '../../runtime/messages';

// ---------------------------------------------------------------------------
// Data factories
// ---------------------------------------------------------------------------

export function makeDraft(overrides: Partial<ReviewDraft> = {}): ReviewDraft {
  return makeSharedReviewDraft({
    title: 'River restoration lead',
    summary: 'A rounded-up draft that still needs quick review.',
    whyItMatters: 'Important context.',
    suggestedNextStep: 'Review and share.',
    category: 'opportunity',
    confidence: 0.62,
    rationale: 'Captured from a relevant tab.',
    tags: [],
    workflowStage: 'candidate',
    suggestedTargetCoopIds: ['coop-1'],
    provenance: {
      type: 'tab',
      interpretationId: 'interp-1',
      extractId: 'extract-1',
      sourceCandidateId: 'candidate-1',
    },
    ...overrides,
  });
}

export function makeArtifact(overrides: Partial<Artifact> = {}): Artifact {
  return makeSharedArtifact({
    title: 'Shared watershed note',
    summary: 'A published artifact in the feed.',
    category: 'resource',
    ...overrides,
  });
}

function makeInviteCode(
  coopId: string,
  coopName: string,
  inviteType: 'member' | 'trusted',
  createdBy: string,
  code: string,
): DashboardResponse['coops'][number]['invites'][number] {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  return {
    id: `${inviteType}-invite-${code}`,
    type: inviteType,
    status: 'active',
    code,
    expiresAt,
    createdAt: new Date().toISOString(),
    createdBy,
    usedByMemberIds: [],
    bootstrap: {
      coopId,
      coopDisplayName: coopName,
      inviteId: `${inviteType}-invite-${code}`,
      inviteType,
      expiresAt,
      roomId: `room-${coopId}`,
      signalingUrls: [],
      inviteProof: `proof-${code}`,
    },
  };
}

export function makeDashboard(overrides: Partial<DashboardResponse> = {}): DashboardResponse {
  return makeDashboardResponse({
    coops: [
      makeCoopState({
        artifacts: [makeArtifact()],
        invites: [],
      }),
    ],
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Runtime handler installer
// ---------------------------------------------------------------------------

/**
 * Install a mock `sendRuntimeMessage` implementation that handles the standard
 * popup message types (get-dashboard, sidepanel state, capture, coop switching,
 * preferences). Returns a mutable dashboard that updates on set-active-coop and
 * set-*-preferences messages.
 */
export function installDefaultRuntimeHandlers(
  mockSendRuntimeMessage: ReturnType<typeof vi.fn>,
  dashboard = makeDashboard(),
) {
  let currentDashboard: DashboardResponse = dashboard;
  let coopIndex = currentDashboard.coops.length + 1;
  let inviteIndex = 1;

  mockSendRuntimeMessage.mockImplementation(
    async (message: { type: string; payload?: unknown }) => {
      if (message.type === 'get-dashboard') {
        return { ok: true, data: currentDashboard };
      }
      if (message.type === 'get-sidepanel-state') {
        return { ok: true, data: { open: false, canClose: true } };
      }
      if (message.type === 'manual-capture') {
        return { ok: true, data: 2 };
      }
      if (message.type === 'capture-active-tab') {
        return { ok: true, data: 1 };
      }
      if (message.type === 'prepare-visible-screenshot') {
        return {
          ok: true,
          data: {
            kind: 'photo',
            dataBase64: btoa('image-data'),
            mimeType: 'image/png',
            fileName: 'coop-screenshot.png',
            title: 'Page screenshot',
            note: 'Captured from https://example.com via Extension Browser.',
            sourceUrl: 'https://example.com',
          },
        };
      }
      if (message.type === 'save-popup-capture') {
        return { ok: true, data: { id: 'capture-1' } };
      }
      if (message.type === 'toggle-sidepanel') {
        return { ok: true, data: { open: true, canClose: true } };
      }
      if (message.type === 'set-active-coop') {
        currentDashboard = {
          ...currentDashboard,
          activeCoopId: (message.payload as { coopId: string }).coopId,
        };
        return { ok: true };
      }
      if (message.type === 'set-ui-preferences') {
        currentDashboard = {
          ...currentDashboard,
          uiPreferences: {
            ...currentDashboard.uiPreferences,
            ...(message.payload as object),
          },
        };
        return { ok: true, data: currentDashboard.uiPreferences };
      }
      if (message.type === 'set-sound-preferences') {
        currentDashboard = {
          ...currentDashboard,
          soundPreferences: {
            ...currentDashboard.soundPreferences,
            ...(message.payload as object),
          },
        };
        return { ok: true, data: undefined };
      }
      if (message.type === 'resolve-onchain-state') {
        return {
          ok: true,
          data: {
            safeAddress: '0x1111111111111111111111111111111111111111',
            chainKey: 'sepolia',
            statusNote: 'Ready',
            mode: 'mock',
          },
        };
      }
      if (message.type === 'create-coop') {
        const payload = message.payload as {
          coopName: string;
          purpose: string;
          captureMode: DashboardResponse['coops'][number]['profile']['captureMode'];
          creator: {
            id: string;
            displayName: string;
            role: 'creator';
            address: string;
            authMode?: DashboardResponse['coops'][number]['members'][number]['authMode'];
            joinedAt?: string;
          };
          onchainState: {
            safeAddress: string;
            chainKey: 'sepolia' | 'arbitrum';
            statusNote: string;
            mode: 'mock' | 'live';
          };
        };
        const coopId = `coop-${coopIndex}`;
        coopIndex += 1;
        const nextCoop: DashboardResponse['coops'][number] = makeCoopState({
          profile: {
            id: coopId,
            name: payload.coopName,
            purpose: payload.purpose,
            captureMode: payload.captureMode,
          },
          members: [
            {
              ...makeCoopState().members[0],
              ...payload.creator,
              authMode: payload.creator.authMode ?? 'passkey',
              joinedAt: payload.creator.joinedAt ?? new Date().toISOString(),
            },
          ],
          artifacts: [],
          invites: [
            makeInviteCode(
              coopId,
              payload.coopName,
              'member',
              payload.creator.id,
              `COOP-MEMBER-${inviteIndex++}`,
            ),
            makeInviteCode(
              coopId,
              payload.coopName,
              'trusted',
              payload.creator.id,
              `COOP-TRUSTED-${inviteIndex++}`,
            ),
          ],
          onchainState: {
            safeAddress: payload.onchainState.safeAddress,
            chainKey: payload.onchainState.chainKey,
            statusNote: payload.onchainState.statusNote,
          },
        });
        currentDashboard = {
          ...currentDashboard,
          coops: [...currentDashboard.coops, nextCoop],
          activeCoopId: coopId,
          summary: {
            ...currentDashboard.summary,
            activeCoopId: coopId,
            coopCount: currentDashboard.coops.length + 1,
          },
        };
        return { ok: true, data: nextCoop };
      }
      if (message.type === 'ensure-invite-codes') {
        const payload = message.payload as {
          coopId: string;
          createdBy: string;
          inviteTypes?: Array<'member' | 'trusted'>;
        };
        const inviteTypes = payload.inviteTypes ?? ['member', 'trusted'];
        currentDashboard = {
          ...currentDashboard,
          coops: currentDashboard.coops.map((coop) => {
            if (coop.profile.id !== payload.coopId) {
              return coop;
            }
            const nextInvites = [...(coop.invites ?? [])];
            for (const inviteType of inviteTypes) {
              const hasHistory = nextInvites.some((invite) => invite.type === inviteType);
              if (!hasHistory) {
                nextInvites.push(
                  makeInviteCode(
                    coop.profile.id,
                    coop.profile.name,
                    inviteType,
                    payload.createdBy,
                    `COOP-${inviteType.toUpperCase()}-${inviteIndex++}`,
                  ),
                );
              }
            }
            return {
              ...coop,
              invites: nextInvites,
            };
          }),
        };
        return { ok: true };
      }
      if (message.type === 'regenerate-invite-code') {
        const payload = message.payload as {
          coopId: string;
          inviteType: 'member' | 'trusted';
          createdBy: string;
        };
        let regenerated: DashboardResponse['coops'][number]['invites'][number] | null = null;
        currentDashboard = {
          ...currentDashboard,
          coops: currentDashboard.coops.map((coop) => {
            if (coop.profile.id !== payload.coopId) {
              return coop;
            }
            regenerated = makeInviteCode(
              coop.profile.id,
              coop.profile.name,
              payload.inviteType,
              payload.createdBy,
              `COOP-${payload.inviteType.toUpperCase()}-${inviteIndex++}`,
            );
            return {
              ...coop,
              invites: [
                ...(coop.invites ?? []).map((invite) =>
                  invite.type === payload.inviteType && invite.status !== 'revoked'
                    ? {
                        ...invite,
                        status: 'revoked' as const,
                        revokedBy: payload.createdBy,
                        revokedAt: new Date().toISOString(),
                      }
                    : invite,
                ),
                regenerated,
              ],
            };
          }),
        };
        return { ok: true, data: regenerated };
      }
      if (message.type === 'revoke-invite-type') {
        const payload = message.payload as {
          coopId: string;
          inviteType: 'member' | 'trusted';
          revokedBy: string;
        };
        currentDashboard = {
          ...currentDashboard,
          coops: currentDashboard.coops.map((coop) =>
            coop.profile.id === payload.coopId
              ? {
                  ...coop,
                  invites: (coop.invites ?? []).map((invite) =>
                    invite.type === payload.inviteType && invite.status !== 'revoked'
                      ? {
                          ...invite,
                          status: 'revoked' as const,
                          revokedBy: payload.revokedBy,
                          revokedAt: new Date().toISOString(),
                        }
                      : invite,
                  ),
                }
              : coop,
          ),
        };
        return { ok: true, data: null };
      }
      return { ok: true };
    },
  );
}

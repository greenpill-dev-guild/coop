import z from 'zod';
import type {
  ArchiveReceipt,
  CoopSharedState,
  Member,
  ReceiverCapture,
  ReviewDraft,
} from '../../contracts/schema';
import {
  coopSharedStateSchema,
  receiverCaptureSchema,
  reviewDraftSchema,
} from '../../contracts/schema';
import { decodeBase64Url, encodeBase64Url, nowIso, truncateWords } from '../../utils';
import { describeArchiveReceipt, isArchiveWorthy } from '../archive/story';

const laneX = {
  member: 40,
  capture: 320,
  draft: 620,
  coop: 920,
  artifact: 1180,
  archive: 1480,
} as const;
const laneTop = 48;
const laneGap = 178;

export const coopBoardSnapshotSchema = z
  .object({
    version: z.literal(1),
    coopId: z.string().min(1),
    createdAt: z.string().datetime(),
    coopState: coopSharedStateSchema,
    receiverCaptures: z.array(receiverCaptureSchema).default([]),
    drafts: z.array(reviewDraftSchema).default([]),
    activeMemberId: z.string().min(1).optional(),
    activeMemberDisplayName: z.string().min(1).optional(),
  })
  .superRefine((value, context) => {
    if (value.coopState.profile.id !== value.coopId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Board snapshot coop id must match the embedded coop state.',
        path: ['coopId'],
      });
    }
  });

export type CoopBoardSnapshot = z.infer<typeof coopBoardSnapshotSchema>;

export type CoopBoardNodeKind = 'coop' | 'member' | 'capture' | 'draft' | 'artifact' | 'archive';
export type CoopBoardEdgeKind =
  | 'captured-by'
  | 'draft-seeded-from-capture'
  | 'routed-to-coop'
  | 'published-to-coop'
  | 'archived-in';

export interface CoopBoardNode {
  id: string;
  kind: CoopBoardNodeKind;
  title: string;
  subtitle: string;
  detail: string;
  badge: string;
  archiveWorthy: boolean;
  createdAt?: string;
  position: { x: number; y: number };
  [key: string]: unknown;
}

export interface CoopBoardEdge {
  id: string;
  kind: CoopBoardEdgeKind;
  source: string;
  target: string;
  label: string;
}

export interface CoopBoardMetadata {
  coopId: string;
  coopName: string;
  generatedAt: string;
  visibleMemberId?: string;
  counts: {
    members: number;
    captures: number;
    drafts: number;
    artifacts: number;
    archives: number;
    archiveWorthy: number;
  };
  story: string;
}

export interface CoopBoardGraph {
  snapshot: CoopBoardSnapshot;
  metadata: CoopBoardMetadata;
  nodes: CoopBoardNode[];
  edges: CoopBoardEdge[];
}

function memberNodeId(memberId: string) {
  return `member:${memberId}`;
}

function captureNodeId(captureId: string) {
  return `capture:${captureId}`;
}

function draftNodeId(draftId: string) {
  return `draft:${draftId}`;
}

function coopNodeId(coopId: string) {
  return `coop:${coopId}`;
}

function artifactNodeId(artifactId: string) {
  return `artifact:${artifactId}`;
}

function archiveNodeId(receiptId: string) {
  return `archive:${receiptId}`;
}

function sortByTime<T extends { createdAt?: string; uploadedAt?: string; joinedAt?: string }>(
  items: T[],
) {
  return [...items].sort((left, right) => {
    const leftValue = left.createdAt ?? left.uploadedAt ?? left.joinedAt ?? '';
    const rightValue = right.createdAt ?? right.uploadedAt ?? right.joinedAt ?? '';
    return leftValue.localeCompare(rightValue);
  });
}

function relevantDrafts(snapshot: CoopBoardSnapshot) {
  return snapshot.drafts.filter((draft) => {
    if (draft.suggestedTargetCoopIds.includes(snapshot.coopId)) {
      return true;
    }

    return draft.provenance.type === 'receiver' && draft.provenance.coopId === snapshot.coopId;
  });
}

function relevantCaptures(snapshot: CoopBoardSnapshot) {
  return snapshot.receiverCaptures.filter((capture) => capture.coopId === snapshot.coopId);
}

function lanePosition(index: number, lane: keyof typeof laneX) {
  return {
    x: laneX[lane],
    y: laneTop + index * laneGap,
  };
}

function coopPosition(snapshot: CoopBoardSnapshot, laneCount: number) {
  const centeredY = laneTop + Math.max(0, laneCount - 1) * laneGap * 0.5;
  return {
    x: laneX.coop,
    y: centeredY,
  };
}

function captureDetail(capture: ReceiverCapture) {
  const detailBits = [capture.sourceUrl, capture.fileName, capture.note, capture.mimeType].filter(
    Boolean,
  );
  return truncateWords(detailBits.join(' · ') || `${capture.byteSize} bytes`, 12);
}

function draftDetail(draft: ReviewDraft) {
  return truncateWords(draft.summary, 16);
}

function memberSubtitle(member: Member) {
  return `${member.role} · ${truncateWords(member.address, 4)}`;
}

function artifactDetail(snapshot: CoopBoardSnapshot, artifactId: string) {
  const artifact = snapshot.coopState.artifacts.find((item) => item.id === artifactId);
  if (!artifact) {
    return 'Published artifact';
  }

  return truncateWords(artifact.summary, 16);
}

function receiptEdgeTargets(receipt: ArchiveReceipt, snapshot: CoopBoardSnapshot) {
  if (receipt.scope === 'snapshot' || receipt.artifactIds.length === 0) {
    return [coopNodeId(snapshot.coopId)];
  }

  return receipt.artifactIds.map((artifactId) => artifactNodeId(artifactId));
}

export function createCoopBoardSnapshot(input: {
  state: CoopSharedState;
  receiverCaptures: ReceiverCapture[];
  drafts: ReviewDraft[];
  activeMemberId?: string;
  activeMemberDisplayName?: string;
  createdAt?: string;
}) {
  return coopBoardSnapshotSchema.parse({
    version: 1,
    coopId: input.state.profile.id,
    createdAt: input.createdAt ?? nowIso(),
    coopState: input.state,
    receiverCaptures: input.receiverCaptures.filter(
      (capture) => capture.coopId === input.state.profile.id,
    ),
    drafts: input.drafts.filter((draft) => {
      if (draft.suggestedTargetCoopIds.includes(input.state.profile.id)) {
        return true;
      }

      return (
        draft.provenance.type === 'receiver' && draft.provenance.coopId === input.state.profile.id
      );
    }),
    activeMemberId: input.activeMemberId,
    activeMemberDisplayName: input.activeMemberDisplayName,
  });
}

export function encodeCoopBoardSnapshot(snapshot: CoopBoardSnapshot) {
  return encodeBase64Url(JSON.stringify(snapshot));
}

export function decodeCoopBoardSnapshot(value: string) {
  return coopBoardSnapshotSchema.parse(JSON.parse(decodeBase64Url(value)));
}

export function buildCoopBoardDeepLink(appUrl: string, snapshot: CoopBoardSnapshot) {
  const url = new URL(`/board/${snapshot.coopId}`, appUrl);
  url.hash = `snapshot=${encodeCoopBoardSnapshot(snapshot)}`;
  return url.toString();
}

export function buildCoopBoardGraph(snapshot: CoopBoardSnapshot): CoopBoardGraph {
  const captures = sortByTime(relevantCaptures(snapshot));
  const drafts = sortByTime(relevantDrafts(snapshot));
  const members = sortByTime(snapshot.coopState.members);
  const artifacts = sortByTime(snapshot.coopState.artifacts);
  const receipts = sortByTime(snapshot.coopState.archiveReceipts);
  const maxLaneCount = Math.max(
    members.length,
    captures.length,
    drafts.length,
    artifacts.length,
    receipts.length,
    1,
  );

  const nodes: CoopBoardNode[] = [
    {
      id: coopNodeId(snapshot.coopId),
      kind: 'coop',
      title: snapshot.coopState.profile.name,
      subtitle: 'Shared coop memory',
      detail: truncateWords(snapshot.coopState.profile.purpose, 18),
      badge: `${snapshot.coopState.artifacts.length} artifacts`,
      archiveWorthy: false,
      createdAt: snapshot.coopState.profile.createdAt,
      position: coopPosition(snapshot, maxLaneCount),
    },
    ...members.map((member, index) => ({
      id: memberNodeId(member.id),
      kind: 'member' as const,
      title: member.displayName,
      subtitle: memberSubtitle(member),
      detail: member.identityWarning,
      badge: member.role,
      archiveWorthy: false,
      createdAt: member.joinedAt,
      position: lanePosition(index, 'member'),
    })),
    ...captures.map((capture, index) => ({
      id: captureNodeId(capture.id),
      kind: 'capture' as const,
      title: capture.title,
      subtitle: `${capture.kind} · ${capture.intakeStatus}`,
      detail: captureDetail(capture),
      badge: capture.syncState,
      archiveWorthy: isArchiveWorthy(capture),
      createdAt: capture.createdAt,
      position: lanePosition(index, 'capture'),
    })),
    ...drafts.map((draft, index) => ({
      id: draftNodeId(draft.id),
      kind: 'draft' as const,
      title: draft.title,
      subtitle: `${draft.category} · ${draft.workflowStage}`,
      detail: draftDetail(draft),
      badge: `${draft.suggestedTargetCoopIds.length} target${draft.suggestedTargetCoopIds.length === 1 ? '' : 's'}`,
      archiveWorthy: isArchiveWorthy(draft),
      createdAt: draft.createdAt,
      position: lanePosition(index, 'draft'),
    })),
    ...artifacts.map((artifact, index) => ({
      id: artifactNodeId(artifact.id),
      kind: 'artifact' as const,
      title: artifact.title,
      subtitle: `${artifact.category} · ${artifact.archiveStatus}`,
      detail: artifactDetail(snapshot, artifact.id),
      badge: artifact.reviewStatus,
      archiveWorthy: isArchiveWorthy(artifact),
      createdAt: artifact.createdAt,
      position: lanePosition(index, 'artifact'),
    })),
    ...receipts.map((receipt, index) => {
      const details = describeArchiveReceipt({
        receipt,
        state: snapshot.coopState,
      });
      return {
        id: archiveNodeId(receipt.id),
        kind: 'archive' as const,
        title: details.title,
        subtitle: `${details.purpose} · ${receipt.filecoinStatus}`,
        detail: truncateWords(details.summary, 16),
        badge: receipt.scope,
        archiveWorthy: false,
        createdAt: receipt.uploadedAt,
        position: lanePosition(index, 'archive'),
      };
    }),
  ];

  const edges: CoopBoardEdge[] = [
    ...captures.flatMap((capture) => {
      if (!capture.memberId) {
        return [];
      }

      return [
        {
          id: `edge:member:${capture.memberId}:capture:${capture.id}`,
          kind: 'captured-by' as const,
          source: memberNodeId(capture.memberId),
          target: captureNodeId(capture.id),
          label: 'captured by',
        },
      ];
    }),
    ...drafts.flatMap((draft) => {
      if (draft.provenance.type !== 'receiver') {
        return [];
      }

      return [
        {
          id: `edge:capture:${draft.provenance.captureId}:draft:${draft.id}`,
          kind: 'draft-seeded-from-capture' as const,
          source: captureNodeId(draft.provenance.captureId),
          target: draftNodeId(draft.id),
          label: 'draft seeded from capture',
        },
      ];
    }),
    ...drafts.map((draft) => ({
      id: `edge:draft:${draft.id}:coop:${snapshot.coopId}`,
      kind: 'routed-to-coop' as const,
      source: draftNodeId(draft.id),
      target: coopNodeId(snapshot.coopId),
      label: 'routed to coop',
    })),
    ...artifacts.map((artifact) => ({
      id: `edge:coop:${snapshot.coopId}:artifact:${artifact.id}`,
      kind: 'published-to-coop' as const,
      source: coopNodeId(snapshot.coopId),
      target: artifactNodeId(artifact.id),
      label: 'published to coop',
    })),
    ...receipts.flatMap((receipt) =>
      receiptEdgeTargets(receipt, snapshot).map((source) => ({
        id: `edge:${source}:archive:${receipt.id}`,
        kind: 'archived-in' as const,
        source,
        target: archiveNodeId(receipt.id),
        label: 'archived in',
      })),
    ),
  ];

  const archiveWorthyCount = nodes.filter((node) => node.archiveWorthy).length;

  return {
    snapshot,
    metadata: {
      coopId: snapshot.coopId,
      coopName: snapshot.coopState.profile.name,
      generatedAt: snapshot.createdAt,
      visibleMemberId: snapshot.activeMemberId,
      counts: {
        members: members.length,
        captures: captures.length,
        drafts: drafts.length,
        artifacts: artifacts.length,
        archives: receipts.length,
        archiveWorthy: archiveWorthyCount,
      },
      story: `${captures.length} finds moved from loose chickens through ${drafts.length} drafts into ${artifacts.length} shared finds, with ${receipts.length} saved proof items keeping the trail visible.`,
    },
    nodes,
    edges,
  };
}

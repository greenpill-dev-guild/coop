import {
  type CoopBoardNode,
  type CoopBoardSnapshot,
  buildCoopArchiveStory,
  buildCoopBoardGraph,
  describeArchiveReceipt,
} from '@coop/shared';
import {
  Background,
  Controls,
  type Edge,
  MarkerType,
  MiniMap,
  type Node,
  type NodeProps,
  Position,
  ReactFlow,
} from '@xyflow/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isSafeExternalUrl } from '../../url-safety';
import '@xyflow/react/dist/style.css';

type FlowNodeData = CoopBoardNode;

const nodeTypes = {
  coopBoardNode: CoopBoardNodeCard,
};

function formatSavedProofScope(scope: 'artifact' | 'snapshot') {
  return scope === 'snapshot' ? 'Coop snapshot' : 'Shared find';
}

function formatSavedProofStatus(status: 'pending' | 'offered' | 'indexed' | 'sealed') {
  switch (status) {
    case 'pending':
      return 'Waiting';
    case 'offered':
      return 'Saved';
    case 'indexed':
      return 'Tracked';
    case 'sealed':
      return 'Deep saved';
  }
}

function edgeStyle(kind: string) {
  switch (kind) {
    case 'captured-by':
      return { stroke: '#83543b', strokeWidth: 1.8 };
    case 'draft-seeded-from-capture':
      return { stroke: '#2a6f65', strokeWidth: 2 };
    case 'routed-to-coop':
      return { stroke: '#3e7f59', strokeDasharray: '6 4', strokeWidth: 2 };
    case 'published-to-coop':
      return { stroke: '#214f3a', strokeWidth: 2.4 };
    case 'archived-in':
      return { stroke: '#b4671f', strokeWidth: 2.2 };
    default:
      return { stroke: '#5f5f5f', strokeWidth: 1.8 };
  }
}

function CoopBoardNodeCard({ data }: NodeProps<Node<FlowNodeData>>) {
  return (
    <article
      className={`coop-board-node kind-${data.kind}${data.archiveWorthy ? ' is-archive-worthy' : ''}`}
      data-testid={`board-node-${data.kind}`}
    >
      <div className="coop-board-node-topline">
        <span className="coop-board-chip">{data.kind}</span>
        {data.archiveWorthy ? (
          <span className="coop-board-chip is-archive">archive-worthy</span>
        ) : null}
      </div>
      <strong>{data.title}</strong>
      <div className="coop-board-subtitle">{data.subtitle}</div>
      <p>{data.detail}</p>
      <div className="coop-board-footnote">{data.badge}</div>
    </article>
  );
}

function mapNodes(snapshot: CoopBoardSnapshot) {
  const graph = buildCoopBoardGraph(snapshot);

  const nodes: Node<FlowNodeData>[] = graph.nodes.map((node) => ({
    id: node.id,
    type: 'coopBoardNode',
    position: node.position,
    data: node,
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    draggable: false,
    selectable: false,
    connectable: false,
  }));

  const edges: Edge[] = graph.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.label,
    type: 'smoothstep',
    animated: edge.kind === 'routed-to-coop',
    markerEnd: {
      type: MarkerType.ArrowClosed,
    },
    style: edgeStyle(edge.kind),
    labelStyle: {
      fill: '#251910',
      fontSize: 11,
      fontWeight: 700,
    },
    labelBgStyle: {
      fill: '#fbf6e9',
      fillOpacity: 0.96,
    },
    labelBgPadding: [8, 4],
    labelBgBorderRadius: 8,
  }));

  return {
    graph,
    nodes,
    edges,
  };
}

export function BoardView({
  coopId,
  snapshot,
}: { coopId: string; snapshot: CoopBoardSnapshot | null }) {
  const [shareLabel, setShareLabel] = useState('Share snapshot');
  const shareResetTimerRef = useRef<number | null>(null);

  const scheduleShareLabelReset = useCallback(() => {
    if (shareResetTimerRef.current !== null) {
      window.clearTimeout(shareResetTimerRef.current);
    }

    shareResetTimerRef.current = window.setTimeout(() => {
      shareResetTimerRef.current = null;
      setShareLabel('Share snapshot');
    }, 2000);
  }, []);

  useEffect(() => {
    return () => {
      if (shareResetTimerRef.current !== null) {
        window.clearTimeout(shareResetTimerRef.current);
      }
    };
  }, []);

  const handleShareSnapshot = useCallback(async () => {
    if (!navigator.clipboard?.writeText) {
      setShareLabel('Clipboard unavailable');
      scheduleShareLabelReset();
      return;
    }
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareLabel('Copied!');
      scheduleShareLabelReset();
    } catch {
      setShareLabel('Copy failed');
      scheduleShareLabelReset();
    }
  }, [scheduleShareLabelReset]);

  const invalidSnapshot = snapshot ? snapshot.coopId !== coopId : false;
  const board = useMemo(
    () => (snapshot && !invalidSnapshot ? mapNodes(snapshot) : null),
    [invalidSnapshot, snapshot],
  );
  const archiveStory = useMemo(
    () => (snapshot && !invalidSnapshot ? buildCoopArchiveStory(snapshot.coopState) : null),
    [invalidSnapshot, snapshot],
  );
  const receiptDetails = useMemo(
    () =>
      snapshot && !invalidSnapshot
        ? [...snapshot.coopState.archiveReceipts]
            .reverse()
            .map((receipt) => describeArchiveReceipt({ receipt, state: snapshot.coopState }))
        : [],
    [invalidSnapshot, snapshot],
  );
  const edgeTrail = useMemo(() => {
    if (!board) {
      return [];
    }

    const nodeTitles = new Map(board.graph.nodes.map((node) => [node.id, node.title]));

    return board.graph.edges.map((edge) => ({
      id: edge.id,
      label: edge.label,
      sourceTitle: nodeTitles.get(edge.source) ?? edge.source,
      targetTitle: nodeTitles.get(edge.target) ?? edge.target,
    }));
  }, [board]);

  if (!snapshot || invalidSnapshot || !board || !archiveStory) {
    return (
      <div className="page-shell board-shell">
        <div className="backdrop" />
        <main className="board-shell-main">
          <section className="board-hero-card">
            <p className="eyebrow">Read-only board</p>
            <h1>The board needs a coop snapshot</h1>
            <p className="board-lede">
              Open the board from the extension sidepanel so it can hand off a member-scoped
              snapshot.
            </p>
            <div className="board-empty-nest" data-testid="board-empty-nest" />
            <a className="button button-secondary" href="/landing">
              Back to landing
            </a>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="page-shell board-shell">
      <div className="backdrop" />
      <header className="board-topbar">
        <div>
          <p className="eyebrow">Desktop board</p>
          <h1>{board.graph.metadata.coopName}</h1>
          <p className="board-lede">{board.graph.metadata.story}</p>
        </div>
        <div className="board-topbar-actions">
          <div className="state-pill">Read-only snapshot</div>
          <a className="button button-secondary button-small" href="/landing">
            Landing
          </a>
        </div>
      </header>

      <div className="board-toolbar">
        <button className="button button-secondary" onClick={handleShareSnapshot} type="button">
          {shareLabel}
        </button>
        <button
          className="button button-secondary"
          disabled
          title="Image export coming soon"
          type="button"
        >
          Export as image
        </button>
      </div>

      <main className="board-layout">
        <section className="board-stage-card" data-testid="coop-board-surface">
          <div className="board-summary-row">
            <div className="summary-card">
              <span>Members</span>
              <strong>{board.graph.metadata.counts.members}</strong>
            </div>
            <div className="summary-card">
              <span>Captures</span>
              <strong>{board.graph.metadata.counts.captures}</strong>
            </div>
            <div className="summary-card">
              <span>Drafts</span>
              <strong>{board.graph.metadata.counts.drafts}</strong>
            </div>
            <div className="summary-card">
              <span>Artifacts</span>
              <strong>{board.graph.metadata.counts.artifacts}</strong>
            </div>
            <div className="summary-card">
              <span>Archive-worthy</span>
              <strong>{board.graph.metadata.counts.archiveWorthy}</strong>
            </div>
          </div>
          <div className="board-canvas">
            <ReactFlow
              edges={board.edges}
              fitView
              nodes={board.nodes}
              nodeTypes={nodeTypes}
              nodesConnectable={false}
              nodesDraggable={false}
              panOnDrag
              proOptions={{ hideAttribution: true }}
              zoomOnDoubleClick={false}
            >
              <Background color="#d7ccb4" gap={24} size={1.2} />
              <MiniMap pannable zoomable />
              <Controls showInteractive={false} />
            </ReactFlow>
          </div>
          <section className="board-relationship-card" aria-label="Relationship trail">
            <div className="board-relationship-header">
              <p className="eyebrow">Coop trail</p>
              <span>{edgeTrail.length} links</span>
            </div>
            <div className="board-relationship-list">
              {edgeTrail.map((edge) => (
                <article className="board-relationship-item" key={edge.id}>
                  <span className="board-relationship-label">{edge.label}</span>
                  <strong>{edge.sourceTitle}</strong>
                  <span className="board-relationship-arrow" aria-hidden="true">
                    →
                  </span>
                  <span>{edge.targetTitle}</span>
                </article>
              ))}
            </div>
          </section>
        </section>

        <aside className="board-sidebar">
          <section className="board-sidebar-card">
            <p className="eyebrow">Saved trail</p>
            <h2>Saved proof trail</h2>
            <p>{archiveStory.snapshotSummary}</p>
            <div className="board-story-stats">
              <div>
                <strong>{archiveStory.archivedArtifactCount}</strong>
                <span>saved finds</span>
              </div>
              <div>
                <strong>{archiveStory.archiveWorthyArtifactCount}</strong>
                <span>marked worth saving</span>
              </div>
            </div>
            {archiveStory.latestSnapshotReceipt ? (
              <div className="board-story-highlight">
                <strong>Latest snapshot</strong>
                <p>{archiveStory.latestSnapshotReceipt.summary}</p>
                {isSafeExternalUrl(archiveStory.latestSnapshotReceipt.gatewayUrl) ? (
                  <a
                    className="source-link"
                    href={archiveStory.latestSnapshotReceipt.gatewayUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Open saved snapshot
                  </a>
                ) : (
                  <span className="source-link">
                    {archiveStory.latestSnapshotReceipt.gatewayUrl}
                  </span>
                )}
              </div>
            ) : (
              <div className="empty-state">
                No coop snapshot proof yet. Save one from the extension.
              </div>
            )}
          </section>

          <section className="board-sidebar-card">
            <p className="eyebrow">Saved proof</p>
            <h2>What the coop kept</h2>
            <div className="board-receipt-list">
              {receiptDetails.map((detail) => (
                <article className="board-receipt-card" key={detail.id}>
                  <div className="badge-row">
                    <span className="badge">{formatSavedProofScope(detail.scope)}</span>
                    <span className="badge">{formatSavedProofStatus(detail.filecoinStatus)}</span>
                  </div>
                  <strong>{detail.title}</strong>
                  <div className="coop-board-subtitle">{detail.purpose}</div>
                  <p>{detail.summary}</p>
                  <dl className="board-receipt-grid">
                    <div>
                      <dt>Open</dt>
                      <dd>
                        {isSafeExternalUrl(detail.gatewayUrl) ? (
                          <a
                            className="source-link"
                            href={detail.gatewayUrl}
                            rel="noreferrer"
                            target="_blank"
                          >
                            Open saved bundle
                          </a>
                        ) : (
                          <span className="source-link">{detail.gatewayUrl}</span>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>Save ID</dt>
                      <dd>{detail.rootCid}</dd>
                    </div>
                    <div>
                      <dt>Saved</dt>
                      <dd>{new Date(detail.uploadedAt).toLocaleString()}</dd>
                    </div>
                    <div>
                      <dt>Items</dt>
                      <dd>{detail.itemCount}</dd>
                    </div>
                  </dl>
                </article>
              ))}
              {receiptDetails.length === 0 ? (
                <div className="empty-state">
                  Saved proof appears here once the extension keeps a find or snapshot.
                </div>
              ) : null}
            </div>
          </section>
        </aside>
      </main>
    </div>
  );
}

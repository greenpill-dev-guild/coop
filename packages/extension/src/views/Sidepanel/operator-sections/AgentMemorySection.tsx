import type { AgentMemory } from '@coop/shared';
import { useState } from 'react';

function formatTypeLabel(type: AgentMemory['type'] | 'all') {
  switch (type) {
    case 'all':
      return 'All';
    case 'observation-outcome':
      return 'Outcomes';
    case 'skill-pattern':
      return 'Patterns';
    case 'domain-pattern':
      return 'Domains';
    case 'coop-context':
      return 'Context';
    case 'user-feedback':
      return 'Feedback';
  }
}

export function AgentMemorySection({ memories }: { memories: AgentMemory[] }) {
  const [typeFilter, setTypeFilter] = useState<AgentMemory['type'] | 'all'>('all');

  const filtered = typeFilter === 'all' ? memories : memories.filter((m) => m.type === typeFilter);

  const types: Array<AgentMemory['type'] | 'all'> = [
    'all',
    'observation-outcome',
    'skill-pattern',
    'domain-pattern',
    'coop-context',
    'user-feedback',
  ];

  return (
    <details className="panel-card collapsible-card">
      <summary>
        <h3>Agent Memory ({memories.length})</h3>
      </summary>
      <div className="collapsible-card__content">
        <div className="badge-row">
          {types.map((type) => (
            <button
              key={type}
              className={`inline-button${typeFilter === type ? ' is-active' : ''}`}
              onClick={() => setTypeFilter(type)}
              type="button"
            >
              {formatTypeLabel(type)}
            </button>
          ))}
        </div>
        {filtered.length === 0 ? (
          <p className="empty-state">No memories recorded yet.</p>
        ) : (
          <ul className="list-reset operator-log-list">
            {filtered.map((memory) => (
              <li key={memory.id} className="operator-log-entry">
                <div className="badge-row">
                  <span className="badge">{formatTypeLabel(memory.type)}</span>
                  <span className="badge">{memory.domain}</span>
                  <span className="badge">{(memory.confidence * 100).toFixed(0)}%</span>
                </div>
                <p className="helper-text" style={{ marginTop: '0.4rem' }}>
                  {memory.content}
                </p>
                <span className="meta-text" style={{ fontSize: '0.78rem' }}>
                  {new Date(memory.createdAt).toLocaleString()}
                  {memory.expiresAt
                    ? ` · expires ${new Date(memory.expiresAt).toLocaleDateString()}`
                    : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}

export default AgentMemorySection;

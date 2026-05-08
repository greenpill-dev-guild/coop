import type { AgentMemory } from '@coop/shared';

function fallbackProvenance(memory: AgentMemory): NonNullable<AgentMemory['provenanceLabel']> {
  if (memory.type === 'user-feedback') return 'user-confirmed';
  return 'inferred';
}

function fallbackConfirmation(memory: AgentMemory): NonNullable<AgentMemory['confirmationStatus']> {
  if ((memory.provenanceLabel ?? fallbackProvenance(memory)) === 'user-confirmed') {
    return 'confirmed';
  }
  return 'unconfirmed';
}

export function describeMemoryUse(memory: AgentMemory): string {
  const provenance = memory.provenanceLabel ?? fallbackProvenance(memory);
  const confirmation = memory.confirmationStatus ?? fallbackConfirmation(memory);

  if (provenance === 'stale' || confirmation === 'stale') {
    return `${provenance}/${confirmation}; stale context only`;
  }
  if (confirmation === 'rejected') {
    return `${provenance}/${confirmation}; rejected context only`;
  }
  if (confirmation === 'confirmed' || provenance === 'user-confirmed') {
    return `${provenance}/${confirmation}; member-confirmed guidance`;
  }
  if (provenance === 'observed') {
    return `${provenance}/${confirmation}; observed source context`;
  }
  if (provenance === 'imported') {
    return `${provenance}/${confirmation}; imported context only`;
  }
  return `${provenance}/${confirmation}; context only`;
}

export function formatAgentMemoryPromptLabel(memory: AgentMemory): string {
  return `${memory.scope}:${memory.type}; ${describeMemoryUse(memory)}`;
}

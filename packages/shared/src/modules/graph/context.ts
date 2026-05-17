import type { RetrievalResult } from './retrieval';

const CHARS_PER_TOKEN = 4;
const OBSERVED_SOURCE_PREFIXES = new Set([
  'github',
  'npm',
  'reddit',
  'rss',
  'web',
  'wikipedia',
  'youtube',
]);

function contextLabelForSourceRef(sourceRef: string, stale?: boolean) {
  if (stale) {
    return 'stale';
  }
  if (
    sourceRef.startsWith('source:') ||
    sourceRef.startsWith('source-content:') ||
    sourceRef.startsWith('extract:') ||
    sourceRef.startsWith('capture:')
  ) {
    return 'observed/unconfirmed';
  }
  const sourceType = sourceRef.split(':', 1)[0];
  if (sourceType && OBSERVED_SOURCE_PREFIXES.has(sourceType)) {
    return 'observed/unconfirmed';
  }
  if (sourceRef.startsWith('validated-insight:') || sourceRef.startsWith('artifact:')) {
    return 'confirmed';
  }
  if (sourceRef.startsWith('import:')) {
    return 'imported/unconfirmed';
  }
  return 'inferred/unconfirmed';
}

/**
 * Format retrieval results into a context string for skill prompts.
 * Prioritizes by relevance score and respects the token budget.
 */
export function assembleGraphContext(results: RetrievalResult[], tokenBudget: number): string {
  if (results.length === 0) return '';

  // Sort by score descending (highest relevance first)
  const sorted = [...results].sort((a, b) => b.score - a.score);

  const maxChars = tokenBudget * CHARS_PER_TOKEN;
  const lines: string[] = [];
  let totalChars = 0;

  for (const r of sorted) {
    const label = contextLabelForSourceRef(r.entity.sourceRef, r.entity.stale);
    const sourceLabel = `source: ${r.entity.sourceRef}; label: ${label}`;
    const line = `- ${r.entity.name} (${r.entity.type}): ${r.entity.description} [${sourceLabel}]`;

    if (totalChars + line.length > maxChars) break;

    lines.push(line);
    totalChars += line.length;
  }

  return lines.join('\n');
}

import type { RetrievalResult } from './retrieval';

const CHARS_PER_TOKEN = 4;

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
    const sourceLabel = r.entity.stale
      ? `source: ${r.entity.sourceRef}; stale`
      : `source: ${r.entity.sourceRef}`;
    const line = `- ${r.entity.name} (${r.entity.type}): ${r.entity.description} [${sourceLabel}]`;

    if (totalChars + line.length > maxChars) break;

    lines.push(line);
    totalChars += line.length;
  }

  return lines.join('\n');
}

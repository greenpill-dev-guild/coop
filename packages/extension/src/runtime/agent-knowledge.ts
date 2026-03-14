import type { AgentObservation, CoopKnowledgeSkillOverride, KnowledgeSkill } from '@coop/shared';
import {
  createCoopDb,
  createId,
  getKnowledgeSkill,
  hashJson,
  listCoopKnowledgeSkillOverrides,
  listKnowledgeSkills,
  nowIso,
  saveKnowledgeSkill,
} from '@coop/shared';

const db = createCoopDb('coop-extension');

// ---------------------------------------------------------------------------
// 1. Parse SKILL.md format (YAML frontmatter + markdown body)
// ---------------------------------------------------------------------------

export function parseSkillMd(raw: string): {
  frontmatter: { name: string; description: string };
  body: string;
} {
  const trimmed = raw.trim();

  if (!trimmed.startsWith('---')) {
    return {
      frontmatter: { name: '', description: '' },
      body: trimmed,
    };
  }

  const closingIndex = trimmed.indexOf('---', 3);
  if (closingIndex === -1) {
    // Opening delimiter but no closing delimiter — treat entire content as body
    return {
      frontmatter: { name: '', description: '' },
      body: trimmed,
    };
  }

  const frontmatterBlock = trimmed.slice(3, closingIndex).trim();
  const body = trimmed.slice(closingIndex + 3).trim();

  let name = '';
  let description = '';

  for (const line of frontmatterBlock.split('\n')) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim();
    const value = line.slice(colonIndex + 1).trim();

    if (key === 'name') {
      name = value;
    } else if (key === 'description') {
      description = value;
    }
  }

  return {
    frontmatter: { name, description },
    body,
  };
}

// ---------------------------------------------------------------------------
// 2. Fetch and parse a SKILL.md URL
// ---------------------------------------------------------------------------

export async function fetchKnowledgeSkill(url: string): Promise<{
  name: string;
  description: string;
  content: string;
}> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch (error) {
    throw new Error(
      `Failed to fetch knowledge skill from ${url}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch knowledge skill from ${url}: HTTP ${response.status}`);
  }

  const raw = await response.text();
  const { frontmatter, body } = parseSkillMd(raw);

  return {
    name: frontmatter.name,
    description: frontmatter.description,
    content: body,
  };
}

// ---------------------------------------------------------------------------
// 3. Import a knowledge skill (fetch + save to Dexie)
// ---------------------------------------------------------------------------

export async function importKnowledgeSkill(url: string): Promise<KnowledgeSkill> {
  const { name, description, content } = await fetchKnowledgeSkill(url);

  const skill: KnowledgeSkill = {
    id: createId('knowledge-skill'),
    url,
    name: name || deriveNameFromUrl(url),
    description,
    domain: 'general',
    content,
    contentHash: hashJson(content),
    fetchedAt: nowIso(),
    enabled: true,
    triggerPatterns: [],
  };

  await saveKnowledgeSkill(db, skill);
  return skill;
}

// ---------------------------------------------------------------------------
// 4. Refresh a knowledge skill's content
// ---------------------------------------------------------------------------

export async function refreshKnowledgeSkill(skillId: string): Promise<KnowledgeSkill | null> {
  const existing = await getKnowledgeSkill(db, skillId);
  if (!existing) return null;

  const { content } = await fetchKnowledgeSkill(existing.url);
  const newHash = hashJson(content);

  if (newHash === existing.contentHash) {
    return existing;
  }

  const updated: KnowledgeSkill = {
    ...existing,
    content,
    contentHash: newHash,
    fetchedAt: nowIso(),
  };

  await saveKnowledgeSkill(db, updated);
  return updated;
}

// ---------------------------------------------------------------------------
// 5. Discover sub-skills from a root SKILL.md index
// ---------------------------------------------------------------------------

export async function discoverSkillIndex(
  rootUrl: string,
): Promise<Array<{ name: string; url: string; description: string }>> {
  const { content } = await fetchKnowledgeSkill(rootUrl);

  // Match markdown links: [Label](path/SKILL.md) or [Label](./path/SKILL.md)
  const linkPattern = /\[([^\]]+)\]\(([^)]*SKILL\.md)\)/g;
  const results: Array<{ name: string; url: string; description: string }> = [];

  for (const match of content.matchAll(linkPattern)) {
    const linkName = match[1];
    const linkPath = match[2];
    const resolvedUrl = new URL(linkPath, rootUrl).href;

    results.push({
      name: linkName,
      url: resolvedUrl,
      description: '',
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// 6. Select relevant knowledge skills for an observation
// ---------------------------------------------------------------------------

export async function selectKnowledgeSkills(
  observation: AgentObservation,
  coopId?: string,
  dbOverride?: ReturnType<typeof createCoopDb>,
): Promise<KnowledgeSkill[]> {
  const store = dbOverride ?? db;
  const allSkills = await listKnowledgeSkills(store);

  if (allSkills.length === 0) return [];

  // Load per-coop overrides if coopId provided
  let overrides: CoopKnowledgeSkillOverride[] = [];
  if (coopId) {
    overrides = await listCoopKnowledgeSkillOverrides(store, coopId);
  }

  const overrideMap = new Map(overrides.map((o) => [o.knowledgeSkillId, o.enabled]));

  // Resolve effective enabled state and score each skill
  const searchText = `${observation.title} ${observation.summary}`.toLowerCase();

  const scored = allSkills
    .filter((skill) => {
      // Override takes precedence over global default
      const overrideEnabled = overrideMap.get(skill.id);
      return overrideEnabled !== undefined ? overrideEnabled : skill.enabled;
    })
    .map((skill) => {
      const score = scoreSkillRelevance(skill, searchText);
      return { skill, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  // Return top-3 most relevant enabled skills
  return scored.slice(0, 3).map((entry) => entry.skill);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function scoreSkillRelevance(skill: KnowledgeSkill, searchText: string): number {
  let score = 0;

  for (const pattern of skill.triggerPatterns) {
    const lowerPattern = pattern.toLowerCase();
    if (searchText.includes(lowerPattern)) {
      score += 1;
    }
  }

  // Also match against skill name and description
  if (searchText.includes(skill.name.toLowerCase())) {
    score += 0.5;
  }
  if (skill.description && searchText.includes(skill.description.toLowerCase())) {
    score += 0.25;
  }

  return score;
}

function deriveNameFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    // Take the directory name before SKILL.md, or the last path segment
    const segments = pathname.split('/').filter(Boolean);
    const skillIndex = segments.findIndex((s) => s.toUpperCase() === 'SKILL.MD');
    if (skillIndex > 0) {
      return segments[skillIndex - 1];
    }
    // Fall back to the last non-SKILL.md segment
    const nonSkill = segments.filter((s) => s.toUpperCase() !== 'SKILL.MD');
    return nonSkill.length > 0 ? nonSkill[nonSkill.length - 1] : 'unknown-skill';
  } catch {
    return 'unknown-skill';
  }
}

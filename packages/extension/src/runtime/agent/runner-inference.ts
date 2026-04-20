import type {
  AgentObservation,
  CoopSharedState,
  EcosystemEntityExtractorOutput,
  EntityExtractionOutput,
  GrantFitScore,
  OpportunityCandidate,
  PoleEntityType,
  ReadablePageExtract,
  ReviewDraft,
  TabRouterOutput,
  ThemeClustererOutput,
} from '@coop/shared';
import { interpretExtractForCoop } from '@coop/shared';
import { resolveObservationEligibleCoopIds } from './runner-observations';
import { compact } from './runner-state';

type HeuristicGraphEntity = EntityExtractionOutput['entities'][number];
type HeuristicGraphRelationship = EntityExtractionOutput['relationships'][number];

const HEURISTIC_ENTITY_LIMIT = 12;
const ENTITY_PHRASE_PATTERN =
  /\b(?:[A-Z][\w.'/-]*|[A-Z]{2,}(?:-[0-9]+)?)(?:\s+(?:[A-Z][\w.'/-]*|[A-Z]{2,}(?:-[0-9]+)?|of|for|and|the)){0,4}/g;
const STRUCTURED_CONTEXT_LABELS = new Set([
  'observation title',
  'observation summary',
  'observation payload',
  'draft title',
  'draft summary',
  'capture title',
  'capture note',
  'archive root cid',
  'coop name',
  'coop purpose',
  'useful signal',
  'artifact focus',
  'why this coop exists',
  'tone and working style',
  'agent persona',
  'vocabulary',
  'prohibited topics',
  'captured extracts',
  'opportunity candidates',
  'grant fit scores',
  'knowledge graph context',
  'recent routed items',
  'recent related drafts',
  'recent related artifacts',
]);
const GENERIC_ENTITY_TERMS = new Set([
  'agent',
  'artifact',
  'artifacts',
  'candidate',
  'candidates',
  'capture',
  'captured',
  'confidence',
  'context',
  'current',
  'digest',
  'draft',
  'extract',
  'extracts',
  'funding',
  'grant',
  'highlights',
  'insight',
  'json',
  'knowledge',
  'local',
  'manifest',
  'memory',
  'none',
  'observation',
  'opportunity',
  'output',
  'payload',
  'potential',
  'recent',
  'return',
  'review',
  'routed',
  'scores',
  'signal',
  'source',
  'summary',
  'tags',
  'theme',
  'title',
]);
const ORGANIZATION_KEYWORDS = [
  'alliance',
  'association',
  'collective',
  'community',
  'company',
  'coop',
  'cooperative',
  'council',
  'dao',
  'foundation',
  'fund',
  'group',
  'guild',
  'institute',
  'lab',
  'labs',
  'network',
  'society',
  'team',
  'university',
];
const EVENT_KEYWORDS = [
  'conference',
  'festival',
  'forum',
  'gathering',
  'hackathon',
  'launch',
  'meetup',
  'retreat',
  'session',
  'sprint',
  'summit',
  'workshop',
];
const LOCATION_KEYWORDS = [
  'basin',
  'bay',
  'city',
  'coast',
  'county',
  'forest',
  'harbor',
  'island',
  'lake',
  'mountain',
  'mountains',
  'region',
  'river',
  'town',
  'valley',
  'village',
  'watershed',
];
const OBJECT_KEYWORDS = [
  'api',
  'app',
  'browser',
  'client',
  'code',
  'extension',
  'framework',
  'model',
  'platform',
  'policy',
  'program',
  'project',
  'protocol',
  'sdk',
  'server',
  'spec',
  'specification',
  'standard',
  'system',
  'tool',
  'toolkit',
  'worker',
  'workers',
  'workflow',
];
const KNOWN_LOCATIONS = new Set([
  'berkeley',
  'california',
  'london',
  'los angeles',
  'new york',
  'oakland',
  'paris',
  'portland',
  'san francisco',
  'seattle',
]);
const SPECIAL_SINGLE_TOKEN_TYPES: Partial<Record<string, PoleEntityType>> = {
  arbitrum: 'organization',
  bun: 'object',
  chrome: 'object',
  dexie: 'object',
  ethereum: 'organization',
  filecoin: 'organization',
  safe: 'object',
  storacha: 'organization',
  viem: 'object',
  yjs: 'object',
};

export function computeGrantFitScores(
  candidates: OpportunityCandidate[],
  coop?: CoopSharedState,
): GrantFitScore[] {
  const purpose = coop?.profile.purpose.toLowerCase() ?? '';
  const topTags = new Set(
    coop?.memoryProfile.topTags.map((tag) => tag.tag.toLowerCase()).slice(0, 12) ?? [],
  );

  return candidates
    .map((candidate) => {
      const haystack = [
        candidate.title,
        candidate.summary,
        candidate.rationale,
        ...candidate.regionTags,
        ...candidate.ecologyTags,
        ...candidate.fundingSignals,
      ]
        .join(' ')
        .toLowerCase();
      const purposeOverlap = purpose
        .split(/\W+/)
        .filter((term) => term.length > 3)
        .some((term) => haystack.includes(term));
      const tagOverlap = [...topTags].filter((tag) => haystack.includes(tag)).length;
      const fundingBoost =
        candidate.fundingSignals.length > 0 ||
        /grant|fund|capital|finance|investment|opportunity/.test(haystack);
      const score = Math.max(
        0.2,
        Math.min(
          0.98,
          candidate.priority * 0.55 +
            (purposeOverlap ? 0.2 : 0) +
            Math.min(0.15, tagOverlap * 0.05) +
            (fundingBoost ? 0.12 : 0),
        ),
      );

      return {
        candidateId: candidate.id,
        candidateTitle: candidate.title,
        score,
        reasons: compact([
          purposeOverlap ? 'Matches coop purpose language.' : undefined,
          tagOverlap > 0 ? 'Matches archived coop themes.' : undefined,
          fundingBoost ? 'Shows clear funding or capital-formation signals.' : undefined,
        ]),
        recommendedTargetCoopId: coop?.profile.id,
      } satisfies GrantFitScore;
    })
    .sort((left, right) => right.score - left.score);
}

export function inferEntitiesFromText(text: string): EcosystemEntityExtractorOutput {
  const tokens = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}\b/g) ?? [];
  const uniqueTokens = [...new Set(tokens)].slice(0, 8);
  return {
    entities: uniqueTokens.map((name) => ({
      name,
      kind: /River|Watershed|Basin/i.test(name)
        ? 'watershed'
        : /Network|Alliance|Collective/i.test(name)
          ? 'network'
          : /Council|Fund|Program|Initiative/i.test(name)
            ? 'program'
            : /Valley|Bay|Forest|Region/i.test(name)
              ? 'bioregion'
              : 'organization',
      relevance: 0.55,
    })),
  };
}

function slugEntityName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchesCue(sentence: string, name: string, pattern: string) {
  return new RegExp(`\\b${escapeRegex(name)}\\b\\s+(?:${pattern})\\b`, 'i').test(sentence);
}

function hasExplicitLocationCue(sentence: string, entityName: string, locationName: string) {
  return (
    new RegExp(
      `\\b${escapeRegex(entityName)}\\b\\s+(?:in|at|from|near|around)\\s+${escapeRegex(locationName)}\\b`,
      'i',
    ).test(sentence) ||
    new RegExp(
      `\\b${escapeRegex(entityName)}\\b.*\\b(?:based|located|headquartered|operates|works|lives)\\b.*\\b(?:in|at|from|near|around)\\s+${escapeRegex(locationName)}\\b`,
      'i',
    ).test(sentence)
  );
}

function hasEventLocationCue(sentence: string, eventName: string, locationName: string) {
  return new RegExp(
    `\\b${escapeRegex(eventName)}\\b.*\\b(?:in|at|near|around)\\s+${escapeRegex(locationName)}\\b`,
    'i',
  ).test(sentence);
}

function normalizeStructuredContext(rawContext: string) {
  return rawContext
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return '';
      }

      const labelled = trimmed.match(/^([A-Za-z][A-Za-z ]+):\s*(.+)$/);
      if (labelled && STRUCTURED_CONTEXT_LABELS.has(labelled[1].toLowerCase())) {
        return labelled[2];
      }

      const extracted = trimmed.match(/^-+\s*[A-Za-z0-9_-]+:\s*(.+?)(?:\s+\([^)]+\))?$/);
      if (extracted) {
        return extracted[1];
      }

      return trimmed;
    })
    .filter(Boolean)
    .join('\n');
}

function cleanEntityPhrase(rawValue: string) {
  let cleaned = rawValue.trim().replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '');
  cleaned = cleaned.replace(/\s+/g, ' ');
  cleaned = cleaned.replace(/\b(?:of|for|and|the|to|on|in)$/i, '').trim();
  return cleaned;
}

function isEntityCandidate(name: string, sentence: string) {
  if (!name || !/[A-Z]/.test(name)) {
    return false;
  }

  const words = name.split(/\s+/);
  if (words.length > 5) {
    return false;
  }

  const lower = name.toLowerCase();
  if (GENERIC_ENTITY_TERMS.has(lower)) {
    return false;
  }

  if (words.length === 1) {
    const token = words[0];
    if (GENERIC_ENTITY_TERMS.has(token.toLowerCase())) {
      return false;
    }

    if (KNOWN_LOCATIONS.has(lower) || SPECIAL_SINGLE_TOKEN_TYPES[lower]) {
      return true;
    }

    if (/[0-9-]/.test(token) || token === token.toUpperCase()) {
      return true;
    }

    if (token.length <= 3) {
      return false;
    }

    if (/[a-z][A-Z]/.test(token) || /[A-Z]{2,}[a-z]/.test(token)) {
      return true;
    }

    return matchesCue(
      sentence,
      name,
      'released|announced|published|launched|maintains?|built|created|founded|supports?|backed|funded|partnered|joined|met',
    );
  }

  return true;
}

function extractSourceRef(rawContext: string) {
  const archiveMatch = rawContext.match(/Archive root CID:\s*([a-z0-9]+)/i);
  if (archiveMatch) {
    return `archive:${archiveMatch[1]}`;
  }

  const extractMatch = rawContext.match(/Captured extracts:\s*\n-\s*([A-Za-z0-9_-]+):/m);
  if (extractMatch) {
    return `extract:${extractMatch[1]}`;
  }

  const titleMatch = rawContext.match(
    /(?:Observation title|Capture title|Draft title):\s*([^\n]+)/i,
  );
  if (titleMatch) {
    const slug = slugEntityName(titleMatch[1]);
    if (slug) {
      return `observation:${slug}`;
    }
  }

  return 'heuristic:entity-extraction';
}

function extractTemporalAnchor(rawContext: string) {
  const isoMatch = rawContext.match(/\b\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z)?\b/);
  if (isoMatch) {
    const normalized = isoMatch[0].includes('T') ? isoMatch[0] : `${isoMatch[0]}T00:00:00.000Z`;
    const parsed = new Date(normalized);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return new Date().toISOString();
}

function includesEntity(sentence: string, name: string) {
  return new RegExp(`\\b${escapeRegex(name)}\\b`, 'i').test(sentence);
}

function classifyPoleEntity(name: string, sentence: string): PoleEntityType {
  const lower = name.toLowerCase();
  const words = lower.split(/\s+/);

  const specialType = SPECIAL_SINGLE_TOKEN_TYPES[lower];
  if (specialType) {
    return specialType;
  }

  if (EVENT_KEYWORDS.some((keyword) => words.includes(keyword))) {
    return 'event';
  }

  if (OBJECT_KEYWORDS.some((keyword) => words.includes(keyword))) {
    return 'object';
  }

  if (ORGANIZATION_KEYWORDS.some((keyword) => words.includes(keyword))) {
    return 'organization';
  }

  if (
    KNOWN_LOCATIONS.has(lower) ||
    LOCATION_KEYWORDS.some((keyword) => words.includes(keyword)) ||
    new RegExp(`\\b(?:in|at|from|near|around)\\s+${escapeRegex(name)}\\b`, 'i').test(sentence)
  ) {
    return 'location';
  }

  if (words.length === 1) {
    if (
      matchesCue(
        sentence,
        name,
        'released|announced|published|launched|maintains?|built|created|supports?|backed|funded|partnered',
      )
    ) {
      return 'organization';
    }

    if (matchesCue(sentence, name, 'said|wrote|spoke|joined|met|founded')) {
      return 'person';
    }
  }

  if (
    words.length >= 2 &&
    words.length <= 3 &&
    words.every((word, index) => index === 0 || !['of', 'for', 'the', 'and'].includes(word))
  ) {
    return 'person';
  }

  return 'object';
}

function describePoleEntity(type: PoleEntityType) {
  switch (type) {
    case 'person':
      return 'Named person explicitly mentioned in the source context.';
    case 'organization':
      return 'Organization explicitly mentioned in the source context.';
    case 'location':
      return 'Location explicitly mentioned in the source context.';
    case 'event':
      return 'Event explicitly mentioned in the source context.';
    case 'object':
      return 'Object explicitly mentioned in the source context.';
  }
}

function collectPoleEntityCandidates(rawContext: string) {
  const normalizedContext = normalizeStructuredContext(rawContext);
  const sentences = normalizedContext
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const matches = normalizedContext.match(ENTITY_PHRASE_PATTERN) ?? [];
  const seen = new Set<string>();
  const candidates: Array<{ name: string; sentence: string }> = [];

  for (const match of matches) {
    const name = cleanEntityPhrase(match);
    const sentence = sentences.find((entry) => includesEntity(entry, name)) ?? normalizedContext;
    if (!isEntityCandidate(name, sentence)) {
      continue;
    }

    const key = name.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    candidates.push({ name, sentence });

    if (candidates.length >= HEURISTIC_ENTITY_LIMIT) {
      break;
    }
  }

  return {
    sentences,
    candidates,
  };
}

function inferPoleRelationships(input: {
  sentences: string[];
  entities: HeuristicGraphEntity[];
  sourceRef: string;
  tValid: string;
}) {
  const relationships: HeuristicGraphRelationship[] = [];
  const seen = new Set<string>();
  const addRelationship = (from: string, to: string, type: string, confidence: number) => {
    if (from === to) {
      return;
    }

    const key = `${from}|${to}|${type}`;
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    relationships.push({
      from,
      to,
      type,
      confidence,
      t_valid: input.tValid,
      t_invalid: null,
      provenance: input.sourceRef,
    });
  };

  for (const sentence of input.sentences) {
    const sentenceEntities = input.entities.filter((entity) =>
      includesEntity(sentence, entity.name),
    );
    if (sentenceEntities.length < 2) {
      continue;
    }

    const persons = sentenceEntities.filter((entity) => entity.type === 'person');
    const organizations = sentenceEntities.filter((entity) => entity.type === 'organization');
    const events = sentenceEntities.filter((entity) => entity.type === 'event');
    const locations = sentenceEntities.filter((entity) => entity.type === 'location');
    const objects = sentenceEntities.filter((entity) => entity.type === 'object');

    for (const person of persons) {
      for (const organization of organizations) {
        if (
          new RegExp(
            `\\b${escapeRegex(person.name)}\\b.*\\b(?:from|of|at|with)\\s+${escapeRegex(organization.name)}\\b`,
            'i',
          ).test(sentence)
        ) {
          addRelationship(person.id, organization.id, 'affiliated-with', 0.82);
        }
      }
    }

    for (const event of events) {
      if (
        !new RegExp(`\\b(?:at|during|for)\\s+${escapeRegex(event.name)}\\b`, 'i').test(sentence)
      ) {
        continue;
      }

      for (const entity of sentenceEntities) {
        if (entity.id !== event.id && entity.type !== 'location') {
          addRelationship(entity.id, event.id, 'participated-in', 0.76);
        }
      }
    }

    for (const location of locations) {
      if (
        !new RegExp(`\\b(?:in|at|from|near|around)\\s+${escapeRegex(location.name)}\\b`, 'i').test(
          sentence,
        )
      ) {
        continue;
      }

      for (const entity of sentenceEntities) {
        if (entity.id === location.id || entity.type === 'object') {
          continue;
        }

        if (entity.type === 'event') {
          if (hasEventLocationCue(sentence, entity.name, location.name)) {
            addRelationship(entity.id, location.id, 'hosted-in', 0.74);
          }
          continue;
        }

        if (
          (entity.type === 'person' || entity.type === 'organization') &&
          hasExplicitLocationCue(sentence, entity.name, location.name)
        ) {
          addRelationship(entity.id, location.id, 'located-in', 0.78);
        }
      }
    }

    for (const object of objects) {
      if (
        !new RegExp(
          `\\b(?:using|uses|used|built on|powered by|via|with)\\s+${escapeRegex(object.name)}\\b`,
          'i',
        ).test(sentence)
      ) {
        continue;
      }

      const subject = sentenceEntities.find(
        (entity) => entity.id !== object.id && entity.type !== 'location',
      );
      if (subject) {
        addRelationship(subject.id, object.id, 'uses', 0.72);
      }
    }

    if (/\b(?:released|announced|published|launched)\b/i.test(sentence)) {
      const source = sentenceEntities.find((entity) => entity.type === 'organization');
      const target = sentenceEntities.find(
        (entity) =>
          entity.id !== source?.id && (entity.type === 'object' || entity.type === 'event'),
      );
      if (source && target) {
        addRelationship(source.id, target.id, 'published', 0.78);
      }
    }

    if (/\b(?:fund(?:s|ed|ing)?|support(?:s|ed|ing)?|back(?:s|ed|ing)?)\b/i.test(sentence)) {
      const source = sentenceEntities.find(
        (entity) => entity.type === 'organization' || entity.type === 'person',
      );
      const target = sentenceEntities.find(
        (entity) =>
          entity.id !== source?.id &&
          (entity.type === 'organization' || entity.type === 'event' || entity.type === 'object'),
      );
      if (source && target) {
        addRelationship(source.id, target.id, 'supports', 0.7);
      }
    }

    if (sentenceEntities.length === 2 && /\bwith\b/i.test(sentence)) {
      addRelationship(sentenceEntities[0].id, sentenceEntities[1].id, 'collaborates-with', 0.64);
    }
  }

  return relationships;
}

export function inferPoleEntitiesFromText(rawContext: string): EntityExtractionOutput {
  const { sentences, candidates } = collectPoleEntityCandidates(rawContext);
  if (candidates.length === 0) {
    return { entities: [], relationships: [] };
  }

  const sourceRef = extractSourceRef(rawContext);
  const tValid = extractTemporalAnchor(rawContext);
  const entities = candidates.map(({ name, sentence }) => {
    const type = classifyPoleEntity(name, sentence);
    return {
      id: `ent-${slugEntityName(name) || 'entity'}`,
      name,
      type,
      description: describePoleEntity(type),
      sourceRef,
    } satisfies HeuristicGraphEntity;
  });

  return {
    entities,
    relationships: inferPoleRelationships({
      sentences,
      entities,
      sourceRef,
      tValid,
    }),
  };
}

export function inferThemes(input: {
  relatedDrafts: ReviewDraft[];
  relatedArtifacts: CoopSharedState['artifacts'];
  observation: AgentObservation;
}): ThemeClustererOutput {
  const titles = [
    ...input.relatedDrafts.map((draft) => draft.title),
    ...input.relatedArtifacts.map((artifact) => artifact.title),
  ];
  const grouped = new Map<string, string[]>();
  for (const title of titles) {
    const key = title.split(/\s+/).slice(0, 2).join(' ').toLowerCase() || 'general';
    grouped.set(key, [...(grouped.get(key) ?? []), title]);
  }
  return {
    themes: [...grouped.entries()].slice(0, 4).map(([label, sourceIds]) => ({
      label,
      summary: `Cluster around ${label} with ${sourceIds.length} recent signals.`,
      sourceIds,
    })),
  };
}

export function inferTabRoutingsHeuristically(input: {
  observation: AgentObservation;
  extracts: ReadablePageExtract[];
  coops: CoopSharedState[];
}): TabRouterOutput {
  const eligibleCoopIds = new Set(
    resolveObservationEligibleCoopIds(input.observation, input.coops),
  );
  return {
    routings: input.extracts.flatMap((extract) =>
      input.coops
        .filter((coop) => eligibleCoopIds.has(coop.profile.id))
        .map((coop) => {
          const interpretation = interpretExtractForCoop(extract, coop);
          return {
            sourceCandidateId: extract.sourceCandidateId,
            extractId: extract.id,
            coopId: coop.profile.id,
            relevanceScore: interpretation.relevanceScore,
            matchedRitualLenses: interpretation.matchedRitualLenses,
            category: interpretation.categoryCandidates[0],
            tags: interpretation.tagCandidates,
            rationale: interpretation.rationale,
            suggestedNextStep: interpretation.suggestedNextStep,
            archiveWorthinessHint: interpretation.archiveWorthinessHint,
          };
        }),
    ),
  };
}

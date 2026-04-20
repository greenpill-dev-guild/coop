/**
 * Generates meaningful prompt variants for autoresearch experiments.
 *
 * Instead of appending placeholder text, this module applies structured
 * mutations to SKILL.md prompt templates — rephrasing instructions,
 * adjusting emphasis, varying output guidance, and adding/removing constraints.
 */

// ---------------------------------------------------------------------------
// Mutation strategies
// ---------------------------------------------------------------------------

type MutationStrategy = {
  name: string;
  apply: (prompt: string) => string;
};

const EMPHASIS_PAIRS: Array<[RegExp, string]> = [
  [/concise/gi, 'focused and specific'],
  [/focused and specific/gi, 'concise'],
  [/short/gi, 'compact yet thorough'],
  [/compact yet thorough/gi, 'short'],
  [/relevant/gi, 'high-signal'],
  [/high-signal/gi, 'relevant'],
  [/recent/gi, 'newest and most actionable'],
  [/newest and most actionable/gi, 'recent'],
];

const OUTPUT_GUIDANCE_ADDITIONS = [
  '\n\nPrioritize actionability: every output field should suggest a clear next step.',
  '\n\nFavor depth over breadth: fewer items with richer detail beat many thin entries.',
  '\n\nEmphasize the "why it matters" dimension — decision-makers need context, not just facts.',
  '\n\nKeep tags precise and domain-specific rather than generic.',
  '\n\nWhen synthesizing multiple sources, explicitly note which sources support each claim.',
  '\n\nPrefer concrete numbers, dates, and names over vague references.',
];

const CONSTRAINT_ADDITIONS = [
  '\n\nConstraint: Never include more than 5 tags — force ranking by relevance.',
  '\n\nConstraint: The summary must be readable in under 15 seconds.',
  '\n\nConstraint: Every suggested next step must be achievable within one week.',
  '\n\nConstraint: Avoid jargon — write as if explaining to a non-expert coop member.',
];

const STRUCTURAL_MUTATIONS = [
  '\n\nStructure: Lead with the strongest signal, not chronological order.',
  '\n\nStructure: Open with the most surprising or counterintuitive finding.',
  "\n\nStructure: Group related items before presenting them — don't list in arbitrary order.",
];

function expectStrategyPart<T>(value: T | undefined, label: string): T {
  if (value === undefined) {
    throw new Error(`Missing ${label} for variant generation.`);
  }
  return value;
}

// ---------------------------------------------------------------------------
// Strategy implementations
// ---------------------------------------------------------------------------

function createEmphasisSwap(index: number): MutationStrategy {
  const pair = expectStrategyPart(EMPHASIS_PAIRS[index % EMPHASIS_PAIRS.length], 'emphasis pair');
  return {
    name: `emphasis-swap-${index}`,
    apply: (prompt) => prompt.replace(pair[0], pair[1]),
  };
}

function createOutputGuidance(index: number): MutationStrategy {
  const addition = expectStrategyPart(
    OUTPUT_GUIDANCE_ADDITIONS[index % OUTPUT_GUIDANCE_ADDITIONS.length],
    'output guidance',
  );
  return {
    name: `output-guidance-${index}`,
    apply: (prompt) => prompt.trimEnd() + addition,
  };
}

function createConstraintAddition(index: number): MutationStrategy {
  const addition = expectStrategyPart(
    CONSTRAINT_ADDITIONS[index % CONSTRAINT_ADDITIONS.length],
    'constraint addition',
  );
  return {
    name: `constraint-${index}`,
    apply: (prompt) => prompt.trimEnd() + addition,
  };
}

function createStructuralMutation(index: number): MutationStrategy {
  const addition = expectStrategyPart(
    STRUCTURAL_MUTATIONS[index % STRUCTURAL_MUTATIONS.length],
    'structural mutation',
  );
  return {
    name: `structural-${index}`,
    apply: (prompt) => prompt.trimEnd() + addition,
  };
}

function createCompoundMutation(a: MutationStrategy, b: MutationStrategy): MutationStrategy {
  return {
    name: `${a.name}+${b.name}`,
    apply: (prompt) => b.apply(a.apply(prompt)),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const STRATEGY_FACTORIES = [
  createOutputGuidance,
  createConstraintAddition,
  createStructuralMutation,
  createEmphasisSwap,
];

/**
 * Generate a prompt variant for a given experiment index.
 * Each index produces a deterministic, distinct mutation of the baseline prompt.
 * Compound mutations are used for higher indices to explore the space more broadly.
 */
export function generateVariantPrompt(baselinePrompt: string, experimentIndex: number): string {
  const factoryIndex = experimentIndex % STRATEGY_FACTORIES.length;
  const subIndex = Math.floor(experimentIndex / STRATEGY_FACTORIES.length);
  const factory = expectStrategyPart(STRATEGY_FACTORIES[factoryIndex], 'strategy factory');
  const strategy = factory(subIndex);

  // For indices >= total single strategies, create compound mutations
  const totalSingle =
    EMPHASIS_PAIRS.length +
    OUTPUT_GUIDANCE_ADDITIONS.length +
    CONSTRAINT_ADDITIONS.length +
    STRUCTURAL_MUTATIONS.length;

  if (experimentIndex >= totalSingle) {
    const compoundIndex = experimentIndex - totalSingle;
    const aFactory = expectStrategyPart(
      STRATEGY_FACTORIES[compoundIndex % STRATEGY_FACTORIES.length],
      'compound strategy factory A',
    );
    const bFactory = expectStrategyPart(
      STRATEGY_FACTORIES[(compoundIndex + 1) % STRATEGY_FACTORIES.length],
      'compound strategy factory B',
    );
    const compound = createCompoundMutation(
      aFactory(Math.floor(compoundIndex / 2)),
      bFactory(Math.floor(compoundIndex / 3)),
    );
    return compound.apply(baselinePrompt);
  }

  return strategy.apply(baselinePrompt);
}

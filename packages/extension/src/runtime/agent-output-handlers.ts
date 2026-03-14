import type { AgentProvider, SkillManifest } from '@coop/shared';

export type SkillOutputHandlerInput = {
  output: unknown;
  manifest: SkillManifest;
  skillId: string;
  provider: AgentProvider;
  durationMs: number;
};

export type SkillOutputHandlerResult = {
  createdDraftIds: string[];
  autoExecutedActionCount: number;
  errors: string[];
};

/** Type for output handlers -- will be populated when agent-runner.ts is refactored. */
export type SkillOutputHandler = (
  input: SkillOutputHandlerInput,
) => Promise<SkillOutputHandlerResult>;

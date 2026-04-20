import type { SkillOutputSchemaRef } from '@coop/shared';
import { coreHandlers } from './output-handlers-core';
import { erc8004Handlers } from './output-handlers-erc8004';
import { greenGoodsHandlers } from './output-handlers-greengoods';
import type {
  SkillOutputHandler,
  SkillOutputHandlerInput,
  SkillOutputHandlerResult,
} from './output-handlers-helpers';
import { synthesisHandlers } from './output-handlers-synthesis';

export * from './output-handlers-helpers';
export * from './output-handlers-core';
export * from './output-handlers-synthesis';
export * from './output-handlers-greengoods';
export * from './output-handlers-erc8004';

const skillOutputHandlers: Partial<Record<SkillOutputSchemaRef, SkillOutputHandler>> = {
  ...coreHandlers,
  ...synthesisHandlers,
  ...greenGoodsHandlers,
  ...erc8004Handlers,
};

export async function applySkillOutput(
  input: SkillOutputHandlerInput,
): Promise<SkillOutputHandlerResult> {
  const handler = skillOutputHandlers[input.manifest.outputSchemaRef];
  if (!handler) {
    return {
      plan: input.plan,
      context: input.context,
      output: input.output,
      createdDraftIds: [],
      autoExecutedActionCount: 0,
      errors: [],
      contextEntityIds: [],
    };
  }

  return handler(input);
}

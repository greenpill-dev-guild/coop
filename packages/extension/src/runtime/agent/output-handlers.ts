import type { SkillOutputSchemaRef } from '@coop/shared';
import { coreHandlers } from './output-handlers-core';
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

const eagerHandlers: Partial<Record<SkillOutputSchemaRef, SkillOutputHandler>> = {
  ...coreHandlers,
  ...synthesisHandlers,
};

// Schema refs the back-half (erc8004 + green-goods) skills produce. The demo
// arc never touches them, so the modules stay out of the SW cold-start
// bundle and load lazily on first applySkillOutput call for that schema.
const ERC8004_SCHEMA_REFS = new Set<SkillOutputSchemaRef>([
  'erc8004-registration-output',
  'erc8004-feedback-output',
]);

const GREEN_GOODS_SCHEMA_REFS = new Set<SkillOutputSchemaRef>([
  'green-goods-garden-bootstrap-output',
  'green-goods-garden-sync-output',
  'green-goods-work-approval-output',
  'green-goods-assessment-output',
  'green-goods-gap-admin-sync-output',
]);

let cachedErc8004: Promise<Partial<Record<SkillOutputSchemaRef, SkillOutputHandler>>> | null = null;
let cachedGreenGoods: Promise<Partial<Record<SkillOutputSchemaRef, SkillOutputHandler>>> | null =
  null;

async function loadErc8004Handlers() {
  if (!cachedErc8004) {
    cachedErc8004 = import('./output-handlers-erc8004').then((mod) => mod.erc8004Handlers);
  }
  return cachedErc8004;
}

async function loadGreenGoodsHandlers() {
  if (!cachedGreenGoods) {
    cachedGreenGoods = import('./output-handlers-greengoods').then((mod) => mod.greenGoodsHandlers);
  }
  return cachedGreenGoods;
}

export async function applySkillOutput(
  input: SkillOutputHandlerInput,
): Promise<SkillOutputHandlerResult> {
  const ref = input.manifest.outputSchemaRef;
  let handler = eagerHandlers[ref];

  if (!handler && ERC8004_SCHEMA_REFS.has(ref)) {
    handler = (await loadErc8004Handlers())[ref];
  } else if (!handler && GREEN_GOODS_SCHEMA_REFS.has(ref)) {
    handler = (await loadGreenGoodsHandlers())[ref];
  }

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

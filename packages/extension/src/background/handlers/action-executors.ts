import type {
  ActionBundle,
  CoopSharedState,
  PolicyActionClass,
  getAuthSession,
} from '@coop/shared';
import { buildArchiveExecutors } from './executors/archive';
import { buildErc8004Executors } from './executors/erc8004';
import { buildGreenGoodsExecutors } from './executors/green-goods';
import { buildOnchainExecutors } from './executors/onchain';
import { buildReviewExecutors } from './executors/review';

/** Context passed from handleExecuteAction into each executor. */
export interface ActionExecutorContext {
  bundle: ActionBundle;
  trustedNodeContext: {
    ok: true;
    coop: CoopSharedState;
    member: { id: string; displayName: string };
    authSession: NonNullable<Awaited<ReturnType<typeof getAuthSession>>>;
  };
}

export type ExecutorResult = Promise<{ ok: boolean; error?: string; data?: unknown }>;

/**
 * Build the action executor map used by `handleExecuteAction`.
 */
export async function buildActionExecutors(
  ctx: ActionExecutorContext,
): Promise<
  Partial<Record<PolicyActionClass, (payload: Record<string, unknown>) => ExecutorResult>>
> {
  return {
    ...buildArchiveExecutors(ctx),
    ...buildReviewExecutors(ctx),
    ...buildGreenGoodsExecutors(ctx),
    ...buildErc8004Executors(ctx),
    ...buildOnchainExecutors(ctx),
  };
}

import type {
  ActionBundle,
  CoopSharedState,
  PolicyActionClass,
  getAuthSession,
} from '@coop/shared';

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
 *
 * Each executor module is loaded on first call rather than eagerly with the
 * background bundle. The simple-mode demo only fires a small slice of action
 * classes (capture/publish); deferring erc8004, green-goods, and onchain
 * executors keeps them out of the SW cold-start path.
 */
export async function buildActionExecutors(
  ctx: ActionExecutorContext,
): Promise<
  Partial<Record<PolicyActionClass, (payload: Record<string, unknown>) => ExecutorResult>>
> {
  const [
    { buildArchiveExecutors },
    { buildReviewExecutors },
    { buildGreenGoodsExecutors },
    { buildErc8004Executors },
    { buildOnchainExecutors },
  ] = await Promise.all([
    import('./executors/archive'),
    import('./executors/review'),
    import('./executors/green-goods'),
    import('./executors/erc8004'),
    import('./executors/onchain'),
  ]);

  return {
    ...buildArchiveExecutors(ctx),
    ...buildReviewExecutors(ctx),
    ...buildGreenGoodsExecutors(ctx),
    ...buildErc8004Executors(ctx),
    ...buildOnchainExecutors(ctx),
  };
}

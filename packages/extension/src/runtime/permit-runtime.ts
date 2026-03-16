import {
  type AuthSession,
  type DelegatedActionClass,
  authSessionToLocalIdentity,
  resolveScopedActionPayload,
} from '@coop/shared';

export const runtimePermitExecutorLabel = 'operator-console';

export function createRuntimePermitExecutor(authSession: AuthSession | null | undefined) {
  const identity = authSession ? authSessionToLocalIdentity(authSession) : null;

  return {
    label: runtimePermitExecutorLabel,
    localIdentityId: identity?.id,
  };
}

export function resolveDelegatedActionExecution(input: {
  actionClass: DelegatedActionClass;
  coopId: string;
  actionPayload: Record<string, unknown>;
}) {
  return resolveScopedActionPayload({
    actionClass: input.actionClass,
    payload: input.actionPayload,
    expectedCoopId: input.coopId,
  });
}

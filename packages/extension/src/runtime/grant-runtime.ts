import {
  type AuthSession,
  type DelegatedActionClass,
  authSessionToLocalIdentity,
  resolveScopedActionPayload,
} from '@coop/shared';

export const runtimeGrantExecutorLabel = 'operator-console';

export function createRuntimeGrantExecutor(authSession: AuthSession | null | undefined) {
  const identity = authSession ? authSessionToLocalIdentity(authSession) : null;

  return {
    label: runtimeGrantExecutorLabel,
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

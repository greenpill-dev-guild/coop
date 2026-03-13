import {
  type ArchiveDelegationRequest,
  archiveDelegationRequestSchema,
} from '@coop/shared/contracts';

export { archiveDelegationRequestSchema as delegateRequestSchema };
export type DelegateRequest = ArchiveDelegationRequest;

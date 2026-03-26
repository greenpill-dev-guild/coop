import z from 'zod';

export const signatureValidationResultSchema = z.object({
  isValid: z.boolean(),
});
export type SignatureValidationResult = z.infer<typeof signatureValidationResultSchema>;

export const membershipProofSchema = z.object({
  merkleTreeDepth: z.number().int().nonnegative(),
  merkleTreeRoot: z.string().min(1),
  nullifier: z.string().min(1),
  message: z.string().min(1),
  scope: z.string().min(1),
  points: z.array(z.string()),
});
export type MembershipProof = z.infer<typeof membershipProofSchema>;

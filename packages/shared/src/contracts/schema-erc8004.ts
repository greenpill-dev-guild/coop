import z from 'zod';

export const erc8004AgentStateSchema = z.object({
  enabled: z.boolean().default(false),
  agentId: z.number().int().positive().optional(),
  agentURI: z.string().optional(),
  agentURICid: z.string().optional(),
  registrationTxHash: z.string().regex(/^0x/).optional(),
  registeredAt: z.string().datetime().optional(),
  reputationScore: z.number().optional(),
  lastFeedbackAt: z.string().datetime().optional(),
  feedbackCount: z.number().int().nonnegative().default(0),
  status: z.enum(['disabled', 'pending', 'registered', 'error']),
  statusNote: z.string().optional(),
});

export const erc8004RegistrationOutputSchema = z.object({
  agentURI: z.string(),
  metadata: z.array(z.object({ key: z.string(), value: z.string() })),
  rationale: z.string(),
});

export const erc8004FeedbackOutputSchema = z.object({
  targetAgentId: z.number().int().positive(),
  value: z.number().int().min(-128).max(127),
  tag1: z.string(),
  tag2: z.string(),
  rationale: z.string(),
});

export type Erc8004AgentState = z.infer<typeof erc8004AgentStateSchema>;
export type Erc8004RegistrationOutput = z.infer<typeof erc8004RegistrationOutputSchema>;
export type Erc8004FeedbackOutput = z.infer<typeof erc8004FeedbackOutputSchema>;

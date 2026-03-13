import { z } from 'zod';

const proofArraySchema = z.array(z.string().min(1));

const envSchema = z.object({
  ISSUER_PORT: z
    .preprocess(
      (value) => (typeof value === 'string' ? Number(value) : value),
      z.number().int().positive(),
    )
    .default(4100),
  ISSUER_SERVICE_URL: z.string().url().optional(),
  ISSUER_AUTH_TOKEN: z.string().min(1).optional(),
  ISSUER_AGENT_PRIVATE_KEY: z.string().min(1).optional(),
  ISSUER_DELEGATION_SPACE_DID: z.string().min(1).default('did:coop:issuer-space'),
  ISSUER_DELEGATION_ISSUER: z.string().min(1).default('did:coop:issuer'),
  ISSUER_DELEGATION_SPACE_DELEGATION: z.string().min(1).default('space-delegation-placeholder'),
  ISSUER_DELEGATION_PROOFS: z
    .any()
    .transform((value) => {
      if (!value) {
        return [];
      }
      if (Array.isArray(value)) {
        return proofArraySchema.parse(value);
      }
      if (typeof value === 'string') {
        try {
          return proofArraySchema.parse(JSON.parse(value));
        } catch {
          return proofArraySchema.parse([value]);
        }
      }
      return [];
    })
    .default([]),
  ISSUER_DELEGATION_GATEWAY_URL: z.string().url().default('https://storacha.link'),
  ISSUER_DELEGATION_ALLOWS_FILECOIN_INFO: z
    .preprocess((value) => {
      if (typeof value === 'string') {
        return value.toLowerCase() === 'true';
      }
      return value;
    }, z.boolean())
    .default(false),
  ISSUER_DELEGATION_EXPIRATION_SECONDS: z
    .preprocess(
      (value) => (typeof value === 'string' ? Number(value) : value),
      z.number().int().positive(),
    )
    .default(600),
});

export type IssuerConfig = z.infer<typeof envSchema> & {
  port: number;
  serviceUrl: string;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): IssuerConfig {
  const parsed = envSchema.parse({
    ...env,
    ISSUER_DELEGATION_PROOFS: env.ISSUER_DELEGATION_PROOFS,
    ISSUER_DELEGATION_ALLOWS_FILECOIN_INFO: env.ISSUER_DELEGATION_ALLOWS_FILECOIN_INFO,
  });

  return {
    port: parsed.ISSUER_PORT,
    serviceUrl: parsed.ISSUER_SERVICE_URL ?? `http://localhost:${parsed.ISSUER_PORT}`,
    ...parsed,
  };
}

export const config = loadConfig();

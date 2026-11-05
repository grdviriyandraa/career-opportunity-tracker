import { z } from "zod";
export const agentScopes = [
  "opportunities:read",
  "agenda:read",
  "drafts:create",
] as const;
export const grantInput = z.strictObject({
  label: z.string().trim().min(1).max(80),
  scopes: z
    .array(z.enum(agentScopes))
    .min(1)
    .max(3)
    .refine((v) => new Set(v).size === v.length),
  expires_in_days: z.number().int().min(1).max(30),
});
export const grantMetadata = z.object({
  id: z.uuid(),
  label: z.string().max(80),
  prefix: z.string().max(8),
  scopes: z.array(z.enum(agentScopes)),
  created_at: z.string(),
  expires_at: z.string(),
  revoked_at: z.string().nullable(),
  last_used_at: z.string().nullable(),
});
export type GrantMetadata = z.infer<typeof grantMetadata>;

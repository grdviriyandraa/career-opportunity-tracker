import { z } from "zod";

function localHost(url: URL) {
  return ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
}
const originUrl = z.url().refine((value) => {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "https:" ||
        (url.protocol === "http:" && localHost(url))) &&
      !url.username &&
      !url.password &&
      url.pathname === "/" &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}, "Gunakan origin HTTPS; HTTP hanya untuk loopback lokal.");

export function isPublicSupabaseKey(value: string) {
  if (value.startsWith("sb_publishable_") && value.length >= 30) return true;
  if (value.split(".").length !== 3) return false;
  try {
    const payload = JSON.parse(
      Buffer.from(value.split(".")[1], "base64url").toString("utf8"),
    );
    return payload.role === "anon";
  } catch {
    return false;
  }
}
function safeRuntimeKey(value: string) {
  if (value.startsWith("sb_secret_")) return false;
  // Synthetic development transports remain usable. JWT-shaped values must
  // be anon keys; a service_role/user/admin credential never belongs here.
  return value.split(".").length === 3 ? isPublicSupabaseKey(value) : true;
}
export const configurationSchema = z.object({
  APP_URL: originUrl,
  NEXT_PUBLIC_SUPABASE_URL: originUrl,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .trim()
    .min(1)
    .refine(safeRuntimeKey),
  OWNER_AUTH_USER_ID: z.uuid(),
  OWNER_EMAIL: z.email(),
});

// Returns field/cause identifiers only, never configuration values.
export function deploymentConfigIssues(
  input: Record<string, string | undefined>,
) {
  const parsed = configurationSchema.safeParse(input);
  const issues = parsed.success
    ? []
    : [
        ...new Set(
          parsed.error.issues.map(
            (issue) => "INVALID_" + String(issue.path[0]),
          ),
        ),
      ];
  for (const key of ["APP_URL", "NEXT_PUBLIC_SUPABASE_URL"] as const) {
    try {
      const url = new URL(input[key]!);
      if (
        url.protocol !== "https:" ||
        localHost(url) ||
        url.hostname.endsWith(".localhost")
      )
        issues.push(key + "_PUBLIC_HTTPS_REQUIRED");
    } catch {
      /* The schema already reports malformed URLs. */
    }
  }
  if (
    input.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
    !isPublicSupabaseKey(input.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
  )
    issues.push("PUBLISHABLE_OR_LEGACY_ANON_KEY_REQUIRED");
  if (
    input.INTEGRATION_WRITES_ENABLED &&
    input.INTEGRATION_WRITES_ENABLED !== "false"
  )
    issues.push("INTEGRATION_WRITES_MUST_REMAIN_DISABLED");
  if (input.AI_PROVIDER && input.AI_PROVIDER !== "disabled")
    issues.push("AI_MUST_REMAIN_DISABLED");
  return issues;
}

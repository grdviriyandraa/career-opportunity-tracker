// The explicit extension lets the Node 24 CLI use this same module directly.
import {
  configurationSchema,
  deploymentConfigIssues,
} from "./config-schema.ts";

export async function deploymentPreflight(
  input: Record<string, string | undefined>,
  fetcher: typeof fetch = fetch,
  configOnly = false,
) {
  const issues = deploymentConfigIssues(input);
  let authCheck = "not_checked";
  const parsed = configurationSchema.safeParse(input);
  if (!configOnly && !issues.length && parsed.success) {
    try {
      const response = await fetcher(
        new URL("/auth/v1/settings", parsed.data.NEXT_PUBLIC_SUPABASE_URL),
        {
          headers: { apikey: parsed.data.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY },
          signal: AbortSignal.timeout(15_000),
          redirect: "error",
          cache: "no-store",
        },
      );
      if (!response.ok) throw new Error("Unavailable");
      const settings: unknown = await response.json();
      if (!settings || typeof settings !== "object")
        throw new Error("Invalid settings");
      const s = settings as {
        disable_signup?: unknown;
        mailer_autoconfirm?: unknown;
        external?: { email?: unknown; anonymous_users?: unknown };
      };
      if (s.disable_signup !== true) issues.push("PUBLIC_SIGNUP_NOT_DISABLED");
      if (s.external?.email !== true) issues.push("EMAIL_AUTH_NOT_ENABLED");
      if (s.mailer_autoconfirm !== false)
        issues.push("EMAIL_CONFIRMATION_NOT_REQUIRED");
      if (s.external?.anonymous_users !== false)
        issues.push("ANONYMOUS_AUTH_NOT_DISABLED");
      authCheck = "checked";
    } catch {
      issues.push("AUTH_SETTINGS_UNAVAILABLE");
      authCheck = "unavailable";
    }
  }
  return {
    automated_checks: issues.length ? "blocked" : "passed",
    scope: configOnly
      ? "configuration_only"
      : "configuration_and_public_auth_settings",
    auth_settings: authCheck,
    issues,
    release_decision: "manual_acceptance_required",
    manual_checks_required: [
      "MIGRATION_HISTORY_AND_OWNER_PROFILE",
      "OWNER_OTP_DELIVERY_AND_SESSION",
      "OWNER_CRUD_EXPORT_LOGOUT_SMOKE",
      "BACKUP_AND_RESTORE_PLAN",
    ],
  };
}

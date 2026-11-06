import { describe, expect, it, vi } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import {
  deploymentConfigIssues,
  isPublicSupabaseKey,
} from "../lib/config-schema";
import { deploymentPreflight } from "../lib/deploy-preflight";

const config = {
  APP_URL: "https://tracker.example.test",
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    "sb_publishable_synthetic_public_key_only",
  OWNER_AUTH_USER_ID: "00000000-0000-4000-8000-000000000001",
  OWNER_EMAIL: "owner@example.test",
  AI_PROVIDER: "disabled",
  INTEGRATION_WRITES_ENABLED: "false",
};
const settings = {
  disable_signup: true,
  mailer_autoconfirm: false,
  external: { email: true, anonymous_users: false },
};
describe("deployment preflight", () => {
  it("accepts public HTTPS configuration but still requires live owner acceptance", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json(settings));
    const report = await deploymentPreflight(config, fetcher);
    expect(report).toMatchObject({
      automated_checks: "passed",
      auth_settings: "checked",
      release_decision: "manual_acceptance_required",
    });
    expect(report.manual_checks_required).toContain(
      "OWNER_OTP_DELIVERY_AND_SESSION",
    );
    expect(fetcher.mock.calls[0][1]).toMatchObject({
      redirect: "error",
      cache: "no-store",
    });
  });
  it("blocks signup, anonymous auth, missing email provider and autoconfirm", async () => {
    const report = await deploymentPreflight(config, async () =>
      Response.json({
        disable_signup: false,
        mailer_autoconfirm: true,
        external: { email: false, anonymous_users: true },
      }),
    );
    expect(report.issues).toEqual([
      "PUBLIC_SIGNUP_NOT_DISABLED",
      "EMAIL_AUTH_NOT_ENABLED",
      "EMAIL_CONFIRMATION_NOT_REQUIRED",
      "ANONYMOUS_AUTH_NOT_DISABLED",
    ]);
    expect(report.automated_checks).toBe("blocked");
  });
  it("fails closed on HTTP errors, invalid JSON, missing settings and network failure without logging details", async () => {
    const fetchers: (typeof fetch)[] = [
      async () => new Response("private-provider-detail", { status: 503 }),
      async () => new Response("not json"),
      async () => Response.json(null),
      async () => {
        throw new Error("private-provider-detail");
      },
    ];
    for (const fetcher of fetchers) {
      const report = await deploymentPreflight(config, fetcher);
      expect(report.issues).toContain("AUTH_SETTINGS_UNAVAILABLE");
      expect(JSON.stringify(report)).not.toContain("private-provider-detail");
    }
    const report = await deploymentPreflight(config, async () =>
      Response.json({}),
    );
    expect(report.automated_checks).toBe("blocked");
  });
  it("rejects loopback, unsafe origins, secret keys and enabled unfinished providers", () => {
    for (const origin of [
      "http://localhost:3000",
      "https://127.0.0.1",
      "http://example.test",
      "https://tracker.example.test/path",
    ]) {
      expect(
        deploymentConfigIssues({ ...config, APP_URL: origin }).length,
      ).toBeGreaterThan(0);
    }
    for (const key of [
      "sb_secret_synthetic_private",
      "unknown-key",
      "eyJ.invalid.signature",
    ]) {
      expect(
        deploymentConfigIssues({
          ...config,
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key,
        }).length,
      ).toBeGreaterThan(0);
    }
    expect(
      deploymentConfigIssues({
        ...config,
        INTEGRATION_WRITES_ENABLED: "true",
        AI_PROVIDER: "cloud",
      }),
    ).toEqual([
      "INTEGRATION_WRITES_MUST_REMAIN_DISABLED",
      "AI_MUST_REMAIN_DISABLED",
    ]);
    const jwt = (role: string) =>
      "eyJhbGciOiJIUzI1NiJ9." +
      Buffer.from(JSON.stringify({ role })).toString("base64url") +
      ".synthetic";
    expect(isPublicSupabaseKey(jwt("anon"))).toBe(true);
    expect(isPublicSupabaseKey(jwt("service_role"))).toBe(false);
  });
  it("never requests the network with invalid configuration or config-only mode", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const missing = await deploymentPreflight({}, fetcher);
    expect(missing.automated_checks).toBe("blocked");
    const staticReport = await deploymentPreflight(config, fetcher, true);
    expect(staticReport).toMatchObject({
      automated_checks: "passed",
      auth_settings: "not_checked",
      scope: "configuration_only",
    });
    expect(fetcher).not.toHaveBeenCalled();
    expect(JSON.stringify(staticReport)).not.toContain(config.OWNER_EMAIL);
    expect(JSON.stringify(staticReport)).not.toContain(
      config.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    );
  });
  it("runs the actual Node CLI with redacted output and nonzero status for invalid input", () => {
    const env = {
      PATH: process.env.PATH,
      NODE_ENV: "test" as const,
      ...config,
    };
    const output = execFileSync(
      process.execPath,
      ["scripts/deploy-check.mjs", "--config-only"],
      { env, encoding: "utf8" },
    );
    expect(JSON.parse(output).automated_checks).toBe("passed");
    expect(output).not.toContain(config.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
    const blocked = spawnSync(
      process.execPath,
      ["scripts/deploy-check.mjs", "--config-only"],
      { env: { ...env, APP_URL: "http://localhost:3000" }, encoding: "utf8" },
    );
    expect(blocked.status).toBe(1);
    expect(JSON.parse(blocked.stdout).issues).toContain(
      "APP_URL_PUBLIC_HTTPS_REQUIRED",
    );
    const unknown = spawnSync(
      process.execPath,
      ["scripts/deploy-check.mjs", "--unknown"],
      { env, encoding: "utf8" },
    );
    expect(unknown.status).toBe(2);
  });
});

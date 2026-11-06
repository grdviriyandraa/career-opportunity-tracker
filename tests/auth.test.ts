import { afterEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  logoutError: null as null | { message: string },
}));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ getAll: () => [], set: vi.fn() }),
}));
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { signOut: async () => ({ error: state.logoutError }) },
  }),
}));
import { POST } from "../app/api/auth/[action]/route";
afterEach(() => {
  vi.unstubAllEnvs();
  state.logoutError = null;
});
function setup() {
  for (const [key, value] of Object.entries({
    APP_URL: "https://tracker.example.test",
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      "sb_publishable_synthetic_public_only",
    OWNER_AUTH_USER_ID: "00000000-0000-4000-8000-000000000001",
    OWNER_EMAIL: "owner@example.test",
  }))
    vi.stubEnv(key, value);
  return new Request("https://tracker.example.test/api/auth/logout", {
    method: "POST",
    headers: { Origin: "https://tracker.example.test" },
  });
}
describe("logout acceptance", () => {
  it("reports unavailable rather than claiming success when the provider refuses logout", async () => {
    state.logoutError = { message: "private-provider-error" };
    const response = await POST(setup(), {
      params: Promise.resolve({ action: "logout" }),
    });
    expect(response.status).toBe(503);
    const result = await response.json();
    expect(result.code).toBe("LOGOUT_UNAVAILABLE");
    expect(result.retryable).toBe(true);
    expect(JSON.stringify(result)).not.toContain("private-provider-error");
  });
  it("reports success only after the provider accepts local sign-out", async () => {
    const response = await POST(setup(), {
      params: Promise.resolve({ action: "logout" }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });
});

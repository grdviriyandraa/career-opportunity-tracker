import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { configuration, setupIssues } from "../lib/config";
const valid = {
  APP_URL: "http://localhost:3000",
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "synthetic-public-key",
  OWNER_AUTH_USER_ID: "00000000-0000-4000-8000-000000000001",
  OWNER_EMAIL: "owner@example.test",
};
function set(overrides: Partial<typeof valid> = {}) {
  for (const [k, v] of Object.entries({ ...valid, ...overrides }))
    vi.stubEnv(k, v);
}
afterEach(() => vi.unstubAllEnvs());
describe("environment boundary", () => {
  it("accepts complete development configuration", () => {
    set();
    expect(configuration()?.OWNER_AUTH_USER_ID).toBe(valid.OWNER_AUTH_USER_ID);
    expect(setupIssues()).toEqual([]);
  });
  it("rejects paths, credentials and non-HTTP app origins", () => {
    for (const url of [
      "https://example.com/path",
      "https://u:p@example.com",
      "ftp://example.com",
    ]) {
      set({ APP_URL: url });
      expect(configuration()).toBeNull();
      expect(setupIssues()).toContain("APP_URL");
    }
  });
  it("treats empty or malformed URLs as setup issues without throwing", () => {
    for (const url of ["", "not-a-url"]) {
      set({ NEXT_PUBLIC_SUPABASE_URL: url });
      expect(configuration()).toBeNull();
      expect(setupIssues()).toContain("NEXT_PUBLIC_SUPABASE_URL");
    }
  });
  it("reports missing field names without echoing configuration values", () => {
    set({ OWNER_AUTH_USER_ID: "", OWNER_EMAIL: "not-an-email" });
    expect(configuration()).toBeNull();
    expect(setupIssues().sort()).toEqual(["OWNER_AUTH_USER_ID", "OWNER_EMAIL"]);
  });
});

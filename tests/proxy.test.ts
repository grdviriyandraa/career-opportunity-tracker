import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { CookieMethodsServer } from "@supabase/ssr";
const state = vi.hoisted(() => ({ refresh: false, getUser: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@supabase/ssr", () => ({
  createServerClient: (
    _url: string,
    _key: string,
    options: { cookies: CookieMethodsServer },
  ) => ({
    auth: {
      getUser: async () => {
        state.getUser();
        if (state.refresh) {
          await options.cookies.setAll!(
            [
              {
                name: "synthetic-session.0",
                value: "first",
                options: { path: "/" },
              },
            ],
            {
              "Cache-Control": "private, no-store",
              Expires: "0",
              Pragma: "no-cache",
            },
          );
          await options.cookies.setAll!(
            [
              {
                name: "synthetic-session.1",
                value: "second",
                options: { path: "/" },
              },
            ],
            {},
          );
        }
        return { data: { user: null }, error: null };
      },
    },
  }),
}));
import { proxy } from "../proxy";
function configured() {
  for (const [key, value] of Object.entries({
    APP_URL: "https://tracker.example.test",
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      "sb_publishable_synthetic_public_only",
    OWNER_AUTH_USER_ID: "00000000-0000-4000-8000-000000000001",
    OWNER_EMAIL: "owner@example.test",
  }))
    vi.stubEnv(key, value);
}
afterEach(() => {
  vi.unstubAllEnvs();
  state.refresh = false;
  state.getUser.mockClear();
});
describe("private session proxy", () => {
  it("preserves cookie chunks and no-cache headers across a second SDK write with empty headers", async () => {
    configured();
    state.refresh = true;
    const request = new NextRequest("https://tracker.example.test/settings");
    const response = await proxy(request);
    expect(response.cookies.getAll().map((cookie) => cookie.name)).toEqual([
      "synthetic-session.0",
      "synthetic-session.1",
    ]);
    expect(request.cookies.get("synthetic-session.1")?.value).toBe("second");
    for (const cookie of response.cookies.getAll()) {
      expect(cookie).toMatchObject({
        httpOnly: true,
        secure: true,
        sameSite: "lax",
      });
    }
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("pragma")).toBe("no-cache");
    expect(response.headers.get("expires")).toBe("0");
    state.refresh = false;
    const next = await proxy(
      new NextRequest("https://tracker.example.test/settings"),
    );
    expect(next.cookies.getAll()).toEqual([]);
    expect(next.headers.get("cache-control")).toContain("no-store");
  });
  it("keeps public health and agent requests private without refreshing the website session", async () => {
    configured();
    for (const path of ["/api/health", "/api/agent/opportunities"]) {
      const response = await proxy(
        new NextRequest("https://tracker.example.test" + path),
      );
      expect(response.headers.get("cache-control")).toContain("no-store");
    }
    expect(state.getUser).not.toHaveBeenCalled();
  });
});

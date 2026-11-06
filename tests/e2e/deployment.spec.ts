import { test, expect } from "@playwright/test";

test("deployment health is redacted and login/logout responses remain private", async ({
  page,
  request,
}) => {
  const health = await request.get("/api/health");
  expect(health.status()).toBe(200);
  expect(await health.json()).toEqual({
    status: "ok",
    scope: "process_and_configuration_only",
  });
  expect(health.headers()["x-content-type-options"]).toBe("nosniff");
  expect(health.headers()["x-frame-options"]).toBe("DENY");
  expect(health.headers()["referrer-policy"]).toBe("no-referrer");
  const initial = await page.goto("/settings");
  expect(initial?.headers()["cache-control"]).toContain("no-store");
  await page.getByLabel("Email", { exact: true }).fill("owner@example.test");
  await page.getByRole("button", { name: "Kirim kode masuk" }).click();
  await page.getByLabel("Kode email").fill("123456");
  const verifyResponse = page.waitForResponse(
    (r) => new URL(r.url()).pathname === "/api/auth/verify",
  );
  await page.getByRole("button", { name: "Verifikasi dan masuk" }).click();
  const verified = await verifyResponse;
  expect(verified.status()).toBe(200);
  expect(verified.headers()["cache-control"]).toContain("no-store");
  expect(verified.headers()["pragma"]).toBe("no-cache");
  await expect(
    page.getByRole("heading", { name: "Settings", exact: true }),
  ).toBeVisible();
  const cookies = (await page.context().cookies()).filter((cookie) =>
    cookie.name.includes("auth-token"),
  );
  expect(cookies.length).toBeGreaterThan(0);
  expect(
    cookies.every((cookie) => cookie.httpOnly && cookie.sameSite === "Lax"),
  ).toBe(true);
  const logoutResponse = page.waitForResponse(
    (r) => new URL(r.url()).pathname === "/api/auth/logout",
  );
  await page.getByRole("button", { name: "Keluar", exact: true }).click();
  expect((await logoutResponse).headers()["cache-control"]).toContain(
    "no-store",
  );
  await expect(
    page.getByRole("heading", { name: "Masuk ke tracker" }),
  ).toBeVisible();
  expect((await page.request.get("/api/opportunities")).status()).toBe(401);
});

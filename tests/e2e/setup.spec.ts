import { test, expect } from "@playwright/test";
test("all seven menus show honest setup state without credentials", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Siapkan ruang peluang Anda" }),
  ).toBeVisible();
  for (const label of [
    "Inbox",
    "Jobs",
    "Bootcamps",
    "Competitions",
    "Agenda",
    "Settings",
  ]) {
    await page
      .getByRole("navigation")
      .getByRole("link", { name: label, exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Siapkan ruang peluang Anda" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await expect(
    page.getByText("Belum ada penyimpanan yang aktif.", { exact: false }),
  ).toBeVisible();
});
test("public and spoofed requests cannot read or save data", async ({
  request,
}) => {
  const health = await request.get("/api/health");
  expect(health.status()).toBe(503);
  expect(await health.json()).toEqual({
    status: "setup_required",
    scope: "process_and_configuration_only",
  });
  expect(health.headers()["x-frame-options"]).toBe("DENY");
  expect(health.headers()["cache-control"]).toContain("no-store");
  const r = await request.get("/api/opportunities", {
    headers: { "oai-authenticated-user-id": "forged-owner" },
  });
  expect(r.status()).toBe(503);
  expect((await r.json()).code).toBe("SETUP_REQUIRED");
  const save = await request.post("/api/opportunities/drafts", {
    headers: {
      Origin: "https://attacker.example",
      "Idempotency-Key": crypto.randomUUID(),
    },
    data: { title: "Must not persist", owner_id: "forged" },
  });
  expect(save.status()).toBe(503);
  expect((await save.json()).code).toBe("SETUP_REQUIRED");
});
test("missing routes are safe and setup contains no private operational data", async ({
  page,
}) => {
  await page.goto("/unknown-section");
  await expect(
    page.getByRole("heading", { name: "Halaman tidak ditemukan" }),
  ).toBeVisible();
  await page.goto("/");
  await expect(page.locator("body")).not.toContainText("spreadsheets/d/");
  await page.screenshot({
    path: "test-results/setup-" + test.info().project.name + ".png",
    fullPage: true,
  });
});

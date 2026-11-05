import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { exportHash, exportTables } from "../../lib/owner-export";

test("owner downloads full available data; bearer, spoofed and cross-origin exports are denied", async ({
  page,
  request,
}) => {
  const origin = "http://127.0.0.1:3001";
  const unauth = await request.post("/api/export", {
    headers: { Origin: origin, "oai-authenticated-user-id": "forged-owner" },
  });
  expect(unauth.status()).toBe(401);
  expect(unauth.headers()["cache-control"]).toBe("private, no-store");
  expect(unauth.headers()["content-disposition"]).toBeUndefined();
  expect((await request.get("/api/export")).status()).toBe(405);

  await page.goto("/settings");
  await page.getByLabel("Email", { exact: true }).fill("owner@example.test");
  await page.getByRole("button", { name: "Kirim kode masuk" }).click();
  await page.getByLabel("Kode email").fill("123456");
  await page.getByRole("button", { name: "Verifikasi dan masuk" }).click();
  await expect(
    page.getByRole("heading", { name: "Ekspor data pribadi" }),
  ).toBeVisible();

  const deniedHeaders: Record<string, string>[] = [
    { Origin: "https://attacker.example" },
    { Origin: origin, Authorization: "Bearer synthetic-agent-token" },
  ];
  for (const headers of deniedHeaders) {
    const denied = await page.request.post("/api/export", { headers });
    expect(denied.status()).toBe(403);
    expect(denied.headers()["content-disposition"]).toBeUndefined();
  }
  const downloadPromise = page.waitForEvent("download");
  const responsePromise = page.waitForResponse(
    (r) => new URL(r.url()).pathname === "/api/export",
  );
  await page.getByRole("button", { name: "Unduh JSON pribadi" }).click();
  const [download, response] = await Promise.all([
    downloadPromise,
    responsePromise.then((result) => {
      expect(result.status()).toBe(200);
      return result;
    }),
  ]);
  expect(response.headers()["cache-control"]).toBe("private, no-store");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(download.suggestedFilename()).toMatch(/^career-tracker-.*\.json$/);
  await download.saveAs(
    "test-results/export-" + test.info().project.name + ".synthetic.json",
  );
  const result = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(Object.keys(result.data)).toEqual(exportTables);
  const history = result.data.change_history.filter(
    (row: { operation: string }) =>
      row.operation === "synthetic_export_history",
  );
  expect(history).toHaveLength(355);
  expect(history.at(-1).after_value.notes).toBe("after 355");
  expect(result.data.milestones.length).toBeGreaterThanOrEqual(5001);
  expect(
    result.data.milestones.some(
      (row: { cancelled_at: string | null }) => row.cancelled_at !== null,
    ),
  ).toBe(true);
  expect(
    result.data.opportunities.some(
      (row: { archived_at: string | null }) => row.archived_at !== null,
    ),
  ).toBe(true);
  expect(result.data.research_identities.length).toBeGreaterThan(0);
  expect(result.integrity.payload_sha256).toBe(
    exportHash({ manifest: result.manifest, data: result.data }),
  );
  expect(result.manifest.restore_supported).toBe(false);
  await expect(
    page.getByText("File siap diunduh.", { exact: false }),
  ).toBeVisible();

  await page.route("**/api/export", (route) =>
    route.fulfill({
      status: 503,
      json: { message: "Database sementara tidak tersedia." },
    }),
  );
  await page.getByRole("button", { name: "Unduh JSON pribadi" }).click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Database sementara tidak tersedia." }),
  ).toHaveText("Database sementara tidak tersedia.");
  await expect(
    page.getByRole("button", { name: "Unduh JSON pribadi" }),
  ).toBeEnabled();
  await expect(
    page.getByText("File siap diunduh.", { exact: false }),
  ).not.toBeVisible();
  await page.unroute("**/api/export");
  const retry = page.waitForEvent("download");
  await page.getByRole("button", { name: "Unduh JSON pribadi" }).focus();
  await page.keyboard.press("Enter");
  expect((await retry).suggestedFilename()).toMatch(/\.json$/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/export-" + test.info().project.name + ".png",
    fullPage: true,
  });
});

import { test, expect } from "@playwright/test";
import { adaptRun, fixture } from "../helpers/research";
test("R01–R04 Inbox keeps two source snapshots and replay is a no-op", async ({
  page,
}) => {
  const f = await fixture();
  const suffix = test.info().project.name;
  const runs = f.runs.map((r) => ({
    ...adaptRun(r),
    run_id: r.run_id + "-" + suffix,
  }));
  // Use an independent source namespace per viewport. The second viewport has no imported legacy membership yet;
  // the fixture seeds both namespaces with the same two pre-existing personal opportunities.
  for (const r of runs)
    r.source_system = "synthetic_research_history_" + suffix;
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill("owner@example.test");
  await page.getByRole("button", { name: "Kirim kode masuk" }).click();
  await page.getByLabel("Kode email").fill("123456");
  await page.getByRole("button", { name: "Verifikasi dan masuk" }).click();
  await expect(
    page.getByRole("heading", { name: "Langkah berikutnya dimulai di sini" }),
  ).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Inbox", exact: true })
    .click();
  await page.getByText("Impor snapshot riset (JSON)", { exact: true }).click();
  const paste = page.getByLabel("Payload snapshot riset");
  await paste.fill(JSON.stringify(runs[0]));
  await page.getByRole("button", { name: "Buat preview impor" }).click();
  await expect(
    page.getByRole("heading", { name: "Review sebelum menerapkan" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Terapkan impor yang ditinjau" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Ringkasan run " + runs[0].run_id }),
  ).toBeVisible();
  await paste.fill(JSON.stringify(runs[1]));
  await page.getByRole("button", { name: "Buat preview impor" }).click();
  await expect(
    page.getByText("4 baru, 4 lama diperiksa, 12 memakai hasil lama.", {
      exact: false,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Terapkan impor yang ditinjau" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Ringkasan run " + runs[1].run_id }),
  ).toBeVisible();
  await expect(
    page.locator(".research-metrics").getByText("8", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Tidak — menggunakan hasil lama", { exact: true }),
  ).toHaveCount(12);
  await expect(page.locator(".snapshot-item")).toHaveCount(20);
  const activeUrl = page.url();
  await page.getByRole("link", { name: new RegExp(runs[0].run_id) }).click();
  await expect(page.locator(".snapshot-item")).toHaveCount(16);
  await expect(
    page.getByRole("heading", { name: "Ringkasan run " + runs[0].run_id }),
  ).toBeVisible();
  await page.goto(activeUrl);
  await page.getByText("Impor snapshot riset (JSON)", { exact: true }).click();
  await paste.fill(JSON.stringify(runs[1]));
  await page.getByRole("button", { name: "Buat preview impor" }).click();
  await expect(
    page.getByText("Run sudah pernah diimpor.", { exact: false }),
  ).toBeVisible();
  await paste.fill(
    JSON.stringify({ ...runs[1], coverage: "Updated source note" }),
  );
  await page.getByRole("button", { name: "Buat preview impor" }).click();
  await expect(
    page.getByText("Run ID sama memiliki payload berbeda.", { exact: false }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Koreksi run menunggu review" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  // Review a source proposal only after inspecting the current personal record.
  await page
    .locator(".snapshot-item")
    .filter({ hasText: "SYN-JOB-001" })
    .getByRole("link", { name: "Market Analyst", exact: true })
    .click();
  await expect(page.locator(".page-heading p")).toContainText(/^Revisi /);
  const previous = Number(
    (await page.locator(".page-heading p").textContent())?.match(
      /Revisi (\d+)/,
    )?.[1],
  );
  await page.getByLabel("Tahap pribadi").selectOption("applied");
  await page
    .getByLabel("Tanggal aktual melamar / mendaftar")
    .fill("2026-11-05");
  await page
    .getByLabel("Catatan pribadi")
    .fill("Keep synthetic personal progress " + suffix);
  await page
    .getByRole("button", { name: "Simpan perubahan", exact: true })
    .click();
  await expect(
    page.getByText("Revisi " + (previous + 1) + " ·", { exact: false }),
  ).toBeVisible();
  const review = page.locator(".proposal-review").first();
  await review
    .getByRole("checkbox", {
      name: suffix === "desktop" ? /^Judul/ : /^Organisasi/,
    })
    .check();
  await review.getByRole("button", { name: "Terapkan field terpilih" }).click();
  await expect(
    page.getByText("Revisi " + (previous + 2) + " ·", { exact: false }),
  ).toBeVisible();
  await expect(page.getByLabel("Catatan pribadi")).toHaveValue(
    "Keep synthetic personal progress " + suffix,
  );
  await expect(page.getByLabel("Tahap pribadi")).toHaveValue("applied");
  await page.goto(activeUrl);
  await expect(
    page.getByRole("heading", { name: "Ringkasan run " + runs[1].run_id }),
  ).toBeVisible();
  await expect(page.locator(".snapshot-item")).toHaveCount(20);
  await page
    .locator(".research-summary")
    .screenshot({ path: "test-results/research-summary-" + suffix + ".png" });
  await page.screenshot({
    path: "test-results/research-" + suffix + ".png",
    fullPage: true,
  });
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Overview", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Snapshot riset terakhir diimpor" }),
  ).toBeVisible();
  await expect(
    page.locator(".research-metrics").getByText("8", { exact: true }),
  ).toBeVisible();
});

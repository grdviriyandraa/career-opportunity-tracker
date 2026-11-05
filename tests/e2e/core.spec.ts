import { test, expect } from "@playwright/test";
test("owner captures, reviews, records actual action, schedules and preserves private progress", async ({
  page,
  request,
}) => {
  const unauth = await request.get("/api/opportunities", {
    headers: {
      "oai-authenticated-user-id": "00000000-0000-4000-8000-000000000001",
    },
  });
  expect(unauth.status()).toBe(401);
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
  await page
    .getByLabel("Link, nama, atau teks sumber")
    .fill(
      "https://example.com/jobs?id=" +
        test.info().project.name +
        "&utm_source=test",
    );
  await page
    .getByLabel("Judul (opsional)")
    .fill("Synthetic analyst " + test.info().project.name);
  await page.getByRole("button", { name: "Simpan ke Inbox" }).click();
  await expect(
    page.getByRole("heading", { name: "Review & progres" }),
  ).toBeVisible();
  const detail = page.url();
  await page
    .getByRole("combobox", { name: "Kategori", exact: true })
    .selectOption("job");
  await page.getByLabel("Tahap pribadi").selectOption("applied");
  await page
    .getByLabel("Tanggal aktual melamar / mendaftar")
    .fill("2026-11-05");
  await page.getByLabel("Catatan pribadi").fill("Private synthetic progress");
  await page
    .getByRole("button", { name: "Simpan perubahan", exact: true })
    .click();
  await expect(page.getByText("Revisi 2 ·", { exact: false })).toBeVisible();
  await page.getByLabel("Status posting").selectOption("closed");
  await page
    .getByRole("button", { name: "Simpan perubahan", exact: true })
    .click();
  await expect(page.getByText("Revisi 3 ·", { exact: false })).toBeVisible();
  await expect(page.getByLabel("Tahap pribadi")).toHaveValue("applied");
  await page.getByLabel("Nama milestone").fill("Synthetic submission");
  await page.getByLabel("Tanggal", { exact: true }).fill("2026-11-20");
  await page
    .getByRole("button", { name: "Tambah milestone", exact: true })
    .click();
  await expect(page.getByText("Revisi 4 ·", { exact: false })).toBeVisible();
  await expect(
    page.getByText("Jam belum diketahui", { exact: true }),
  ).toBeVisible();
  const invalidOrigin = await page.request.patch(
    new URL(
      "/api/opportunities/" + detail.split("/").at(-1),
      detail,
    ).toString(),
    {
      headers: { Origin: "https://attacker.example" },
      data: { expected_revision: 4, notes: "forged" },
    },
  );
  expect(invalidOrigin.status()).toBe(403);
  const stale = await page.request.patch(
    new URL(
      "/api/opportunities/" + detail.split("/").at(-1),
      detail,
    ).toString(),
    {
      headers: { Origin: "http://127.0.0.1:3001" },
      data: { expected_revision: 1, notes: "lost update" },
    },
  );
  expect(stale.status()).toBe(409);
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Inbox", exact: true })
    .click();
  await page
    .getByLabel("Link, nama, atau teks sumber")
    .fill("https://example.com/jobs?id=" + test.info().project.name);
  await page.getByRole("button", { name: "Simpan ke Inbox" }).click();
  await expect(page).toHaveURL(detail);
  await expect(page.getByLabel("Catatan pribadi")).toHaveValue(
    "Private synthetic progress",
  );
  await expect(page.getByLabel("Tahap pribadi")).toHaveValue("applied");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/core-" + test.info().project.name + ".png",
    fullPage: true,
  });
});

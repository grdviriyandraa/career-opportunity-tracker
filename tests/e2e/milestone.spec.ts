import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
test("owner edits, cancels and restores a milestone with stale-write protection and active-only Agenda", async ({
  page,
  request,
}) => {
  test.setTimeout(90000);
  const origin = "http://127.0.0.1:3001";
  const suffix = test.info().project.name;
  const denied = await request.patch(
    `/api/opportunities/${randomUUID()}/milestones/${randomUUID()}`,
    {
      headers: { Origin: origin },
      data: {
        expected_revision: 1,
        expected_milestone_revision: 1,
        cancelled: true,
      },
    },
  );
  expect(denied.status()).toBe(401);
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill("owner@example.test");
  await page.getByRole("button", { name: "Kirim kode masuk" }).click();
  await page.getByLabel("Kode email").fill("123456");
  await page.getByRole("button", { name: "Verifikasi dan masuk" }).click();
  await expect(
    page.getByRole("heading", { name: "Langkah berikutnya dimulai di sini" }),
  ).toBeVisible();
  const capture = await page.request.post("/api/opportunities/drafts", {
    headers: { Origin: origin, "Idempotency-Key": randomUUID() },
    data: {
      title: "Synthetic lifecycle " + suffix,
      category: "job",
      source_url: "https://example.test/lifecycle?id=" + suffix,
    },
  });
  expect(capture.status()).toBe(201);
  const receipt = await capture.json();
  const detail = "/opportunities/" + receipt.opportunity_id;
  await page.goto(detail);
  await page.getByLabel("Tahap pribadi").selectOption("applied");
  await page
    .getByLabel("Tanggal aktual melamar / mendaftar")
    .fill("2026-11-05");
  await page
    .getByLabel("Catatan pribadi")
    .fill("Private synthetic lifecycle progress");
  await page
    .getByRole("button", { name: "Simpan perubahan", exact: true })
    .click();
  await expect(page.getByText("Revisi 2 ·", { exact: false })).toBeVisible();
  const title = "Lifecycle deadline " + suffix;
  await page.getByLabel("Nama milestone", { exact: true }).fill(title);
  await page.getByLabel("Tanggal", { exact: true }).fill("2026-11-12");
  const added = page.waitForResponse(
    (r) => r.url().endsWith("/milestones") && r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Tambah milestone", exact: true })
    .click();
  const milestone = await (await added).json();
  await expect(page.getByText("Revisi 3 ·", { exact: false })).toBeVisible();
  const endpoint = `/api/opportunities/${receipt.opportunity_id}/milestones/${milestone.id}`;
  const controls = page.getByRole("group", {
    name: "Kelola milestone: " + title,
    exact: true,
  });
  await controls.locator("summary").click();
  await controls.getByLabel("Edit nama milestone").fill(title + " edited");
  await controls.getByLabel("Edit tanggal", { exact: true }).fill("2026-11-20");
  await controls
    .getByRole("button", { name: "Simpan perubahan milestone" })
    .click();
  await expect(page.getByText("Revisi 4 ·", { exact: false })).toBeVisible();
  const edited = page.getByRole("group", {
    name: "Kelola milestone: " + title + " edited",
    exact: true,
  });
  const stale = await page.request.patch(endpoint, {
    headers: { Origin: origin },
    data: {
      expected_revision: 3,
      expected_milestone_revision: 1,
      cancelled: true,
    },
  });
  expect(stale.status()).toBe(409);
  const injected = await page.request.patch(endpoint, {
    headers: { Origin: origin },
    data: {
      expected_revision: 4,
      expected_milestone_revision: 2,
      cancelled: true,
      owner_id: randomUUID(),
    },
  });
  expect(injected.status()).toBe(400);
  const wrongChannel = await page.request.patch(endpoint, {
    headers: { Origin: origin, Authorization: "Bearer " + "X".repeat(43) },
    data: {
      expected_revision: 4,
      expected_milestone_revision: 2,
      cancelled: true,
    },
  });
  expect(wrongChannel.status()).toBe(403);
  const before = await (
    await page.request.get("/api/agenda?start=2026-11-20&days=1")
  ).json();
  expect(before.items.map((m: { id: string }) => m.id)).toContain(milestone.id);
  const cancelResponse = page.waitForResponse(
    (r) => r.url().endsWith(endpoint) && r.request().method() === "PATCH",
  );
  await edited
    .getByRole("button", { name: "Batalkan milestone", exact: true })
    .click();
  const cancelled = await (await cancelResponse).json();
  expect(cancelled.cancelled_at).not.toBeNull();
  expect(cancelled.revision).toBe(3);
  await expect(page.getByText("Revisi 5 ·", { exact: false })).toBeVisible();
  await expect(
    edited.getByRole("button", { name: "Pulihkan milestone" }),
  ).toBeVisible();
  await expect(edited.locator("summary")).toHaveCount(0);
  const after = await (
    await page.request.get("/api/agenda?start=2026-11-20&days=1")
  ).json();
  expect(after.items.map((m: { id: string }) => m.id)).not.toContain(
    milestone.id,
  );
  expect(after.source_read.total_at_start).toBe(
    before.source_read.total_at_start - 1,
  );
  await expect(page.getByLabel("Catatan pribadi")).toHaveValue(
    "Private synthetic lifecycle progress",
  );
  await expect(page.getByLabel("Tahap pribadi")).toHaveValue("applied");
  await edited.getByRole("button", { name: "Pulihkan milestone" }).click();
  await expect(page.getByText("Revisi 6 ·", { exact: false })).toBeVisible();
  const restored = await (
    await page.request.get("/api/agenda?start=2026-11-20&days=1")
  ).json();
  expect(restored.items.map((m: { id: string }) => m.id)).toContain(
    milestone.id,
  );
  expect(restored.source_read.total_at_start).toBe(
    before.source_read.total_at_start,
  );
  const noOp = await page.request.patch(endpoint, {
    headers: { Origin: origin },
    data: {
      expected_revision: 6,
      expected_milestone_revision: 4,
      cancelled: false,
    },
  });
  expect(noOp.status()).toBe(200);
  expect((await noOp.json()).revision).toBe(4);
  await expect(
    page.getByText("Milestone diperbarui", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Milestone dibatalkan", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Milestone dipulihkan", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path: path.join(tmpdir(), "tracker-milestone-" + suffix + ".png"),
    fullPage: true,
  });
});

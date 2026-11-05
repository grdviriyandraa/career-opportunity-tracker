import { test, expect } from "@playwright/test";
test("Agenda checks confirmed, date-only and buffered intervals without claiming external availability", async ({
  page,
  request,
}) => {
  const denied = await request.get("/api/agenda", {
    headers: {
      "oai-authenticated-user-id": "00000000-0000-4000-8000-000000000001",
    },
  });
  expect(denied.status()).toBe(401);
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill("owner@example.test");
  await page.getByRole("button", { name: "Kirim kode masuk" }).click();
  await page.getByLabel("Kode email").fill("123456");
  await page.getByRole("button", { name: "Verifikasi dan masuk" }).click();
  await expect(
    page.getByRole("heading", { name: "Langkah berikutnya dimulai di sini" }),
  ).toBeVisible();
  const origin = "http://127.0.0.1:3001";
  const suffix = test.info().project.name;
  const capture = await page.request.post("/api/opportunities/drafts", {
    headers: { Origin: origin, "Idempotency-Key": crypto.randomUUID() },
    data: {
      title: "Synthetic agenda " + suffix,
      category: "competition",
      source_url: "https://example.org/agenda?case=" + suffix,
    },
  });
  expect(capture.status()).toBe(201);
  const receipt = await capture.json();
  const inputs = [
    {
      title: "Interview " + suffix,
      kind: "event",
      precision: "instant",
      start_at: "2026-11-12T10:00:00+07:00",
      end_at: "2026-11-12T11:00:00+07:00",
      attendance: "confirmed",
    },
    {
      title: "Class " + suffix,
      kind: "event",
      precision: "instant",
      start_at: "2026-11-12T10:30:00+07:00",
      end_at: "2026-11-12T12:00:00+07:00",
      attendance: "confirmed",
    },
    {
      title: "Follow-up " + suffix,
      kind: "event",
      precision: "instant",
      start_at: "2026-11-12T12:00:00+07:00",
      end_at: "2026-11-12T13:00:00+07:00",
      attendance: "confirmed",
    },
    {
      title: "Conditional final " + suffix,
      kind: "event",
      precision: "date",
      date: "2026-11-12",
      attendance: "conditional",
    },
    {
      title: "Submission one " + suffix,
      kind: "deadline",
      precision: "date",
      date: "2026-11-12",
      attendance: "unknown",
    },
    {
      title: "Submission two " + suffix,
      kind: "deadline",
      precision: "instant",
      start_at: "2026-11-13T09:00:00+07:00",
      attendance: "unknown",
    },
  ];
  const ids: string[] = [];
  for (const [index, input] of inputs.entries()) {
    const r = await page.request.post(
      "/api/opportunities/" + receipt.opportunity_id + "/milestones",
      {
        headers: { Origin: origin },
        data: {
          ...input,
          timezone: "Asia/Jakarta",
          expected_revision: receipt.revision + index,
        },
      },
    );
    expect(r.status()).toBe(201);
    ids.push((await r.json()).id);
  }
  const invalid = await page.request.get("/api/agenda?owner_id=forged");
  expect(invalid.status()).toBe(400);
  const duplicate = await page.request.get("/api/agenda?days=2&days=3");
  expect(duplicate.status()).toBe(400);
  const r = await page.request.get("/api/agenda?start=2026-11-12&days=2");
  expect(r.status()).toBe(200);
  expect(r.headers()["cache-control"]).toContain("no-store");
  const data = await r.json();
  expect(data.external.state).toBe("not_connected");
  expect(data.partial).toBe(true);
  const pair = (a: string, b: string) =>
    data.conflicts.find(
      (c: { first_id: string; second_id: string }) =>
        [c.first_id, c.second_id].includes(a) &&
        [c.first_id, c.second_id].includes(b),
    );
  expect(pair(ids[0], ids[1]).kind).toBe("confirmed_overlap");
  expect(pair(ids[1], ids[2])).toBeUndefined();
  expect(pair(ids[0], ids[3]).kind).toBe("potential_overlap");
  expect(
    data.conflicts.some((c: { first_id: string; second_id: string }) =>
      ids.slice(4).some((id) => c.first_id === id || c.second_id === id),
    ),
  ).toBe(false);
  expect(data.items.find((m: { id: string }) => m.id === ids[3])).toMatchObject(
    { date: "2026-11-12", start_at: null, end_at: null },
  );
  await page.goto("/agenda?start=2026-11-12&days=2");
  await expect(
    page.getByRole("heading", { name: "Cakupan pemeriksaan" }),
  ).toBeVisible();
  await expect(
    page.getByText("Kesibukan eksternal belum dapat dipastikan", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Bentrok acara internal" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("link", { name: "Interview " + suffix, exact: true })
      .first(),
  ).toBeVisible();
  await page.getByLabel("Buffer sebelum (menit)").fill("15");
  await page.getByLabel("Buffer sesudah (menit)").fill("15");
  await page
    .getByRole("button", { name: "Periksa jadwal", exact: true })
    .click();
  await expect(
    page.getByText("Buffer beririsan", { exact: true }).first(),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .locator(".agenda-coverage")
    .screenshot({ path: "test-results/agenda-coverage-" + suffix + ".png" });
  const buffered = await page.request.get(
    "/api/agenda?start=2026-11-12&days=2&buffer_before=15&buffer_after=15",
  );
  const output = await buffered.json();
  expect(
    output.conflicts.find(
      (c: { first_id: string; second_id: string }) =>
        [c.first_id, c.second_id].includes(ids[1]) &&
        [c.first_id, c.second_id].includes(ids[2]),
    ).kind,
  ).toBe("buffer_warning");
});

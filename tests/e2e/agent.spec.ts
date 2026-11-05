import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

test("owner mints/revokes credentials and real MCP bridge reads/captures through agent API", async ({
  page,
  request,
}) => {
  test.setTimeout(90000);
  expect((await request.get("/api/agent/opportunities")).status()).toBe(401);
  await page.goto("/settings");
  await page.getByLabel("Email", { exact: true }).fill("owner@example.test");
  await page.getByRole("button", { name: "Kirim kode masuk" }).click();
  await page.getByLabel("Kode email").fill("123456");
  await page.getByRole("button", { name: "Verifikasi dan masuk" }).click();
  await expect(
    page.getByRole("heading", { name: "Settings", exact: true }),
  ).toBeVisible();
  const label = "Synthetic Hermes " + test.info().project.name;
  await page.getByLabel("Label credential").fill(label);
  await page
    .getByRole("button", { name: "Buat credential", exact: true })
    .click();
  await expect(page.getByLabel("Token sekali tampil")).toBeVisible();
  const token = await page.getByLabel("Token sekali tampil").inputValue();
  expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  const headers = { Authorization: "Bearer " + token };
  const list = await page.request.get("/api/integrations/hermes");
  expect(list.ok()).toBe(true);
  expect(await list.text()).not.toContain(token);
  expect(await list.text()).not.toContain("token_hash");
  // Website session cookies do not authorize the agent channel; bearer does not authorize website writes.
  expect((await page.request.get("/api/agent/opportunities")).status()).toBe(
    401,
  );
  expect(
    (await page.request.get("/api/opportunities", { headers })).status(),
  ).toBe(403);
  expect(
    (
      await request.get("/api/agent/opportunities?owner_id=forged", { headers })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.get("/api/agent/opportunities?limit=1&limit=2", { headers })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post("/api/agent/drafts", {
        headers: { ...headers, "Idempotency-Key": randomUUID() },
        data: { title: "forged", personal_stage: "applied" },
      })
    ).status(),
  ).toBe(400);
  const dir = await mkdtemp(path.join(tmpdir(), "tracker-agent-e2e-"));
  const client = new Client({ name: "synthetic-agent-e2e", version: "1.0.0" });
  const file = path.join(dir, "credential.txt");
  await writeFile(file, token, { mode: 0o600 });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.resolve("tools/tracker-mcp/dist/index.js")],
    env: {
      ...Object.fromEntries(
        Object.entries(process.env).filter(
          (entry): entry is [string, string] => entry[1] !== undefined,
        ),
      ),
      TRACKER_ORIGIN: "http://127.0.0.1:3001",
      TRACKER_ALLOW_LOOPBACK_HTTP: "1",
      TRACKER_TOKEN_FILE: file,
      TRACKER_LEDGER_FILE: path.join(dir, "ledger.sqlite"),
    },
    stderr: "pipe",
  });
  try {
    await client.connect(transport);
    expect((await client.listTools()).tools.map((t) => t.name).sort()).toEqual([
      "create_draft",
      "get_opportunity",
      "get_upcoming_deadlines",
      "search_opportunities",
    ]);
    const url =
      "https://example.test/jobs?id=AGENT-" + test.info().project.name;
    const result = await client.callTool({
      name: "create_draft",
      arguments: {
        title: "Agent synthetic " + test.info().project.name,
        source_url: url,
      },
    });
    expect(result.isError).not.toBe(true);
    const receipt = JSON.parse((result.content as { text: string }[])[0].text);
    expect(receipt.outcome).toBe("created");
    const detail = await client.callTool({
      name: "get_opportunity",
      arguments: { opportunity_id: receipt.opportunity_id },
    });
    expect(detail.isError).not.toBe(true);
    const projection = JSON.parse(
      (detail.content as { text: string }[])[0].text,
    );
    expect(projection.item.personal_stage).toBe("saved");
    expect(projection.item.category).toBeNull();
    expect(projection.item).not.toHaveProperty("notes");
    expect(projection.item).not.toHaveProperty("owner_id");
    expect(projection.warnings.length).toBeGreaterThan(0);
    const searched = await client.callTool({
      name: "search_opportunities",
      arguments: { query: "Agent synthetic", limit: 1 },
    });
    expect(searched.isError).not.toBe(true);
    expect(
      (
        await client.callTool({
          name: "get_upcoming_deadlines",
          arguments: { start_date: "2026-11-05", end_date: "2026-11-10" },
        })
      ).isError,
    ).not.toBe(true);
    const key = randomUUID();
    const payload = { source_url: url, title: "Duplicate must preserve stage" };
    const first = await request.post("/api/agent/drafts", {
      headers: { ...headers, "Idempotency-Key": key },
      data: payload,
    });
    expect(first.status()).toBe(200);
    expect((await first.json()).opportunity_id).toBe(receipt.opportunity_id);
    const replay = await request.post("/api/agent/drafts", {
      headers: { ...headers, "Idempotency-Key": key },
      data: payload,
    });
    expect(replay.status()).toBe(200);
    expect(await replay.json()).toEqual(await first.json());
    const conflict = await request.post("/api/agent/drafts", {
      headers: { ...headers, "Idempotency-Key": key },
      data: { title: "different" },
    });
    expect(conflict.status()).toBe(409);
    await page
      .getByRole("button", { name: "Cabut " + label, exact: true })
      .click();
    await expect(
      page
        .getByRole("heading", { name: label, exact: true })
        .locator("..")
        .getByText(/Dicabut/),
    ).toBeVisible();
    expect(
      (await request.get("/api/agent/opportunities", { headers })).status(),
    ).toBe(401);
    expect(
      (await client.callTool({ name: "search_opportunities", arguments: {} }))
        .isError,
    ).toBe(true);
    await page.reload();
    await expect(page.getByLabel("Token sekali tampil")).toHaveCount(0);
    expect((await page.request.get("/api/opportunities")).ok()).toBe(true);
  } finally {
    await client.close();
    await transport.close();
    await rm(dir, { recursive: true, force: true });
  }
});

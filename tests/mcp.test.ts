import { spawn } from "node:child_process";
import { once } from "node:events";
import { afterEach, describe, expect, it } from "vitest";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { mkdtemp, writeFile, rm, readFile, chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import {
  validateOrigin,
  loadConfig,
  readToken,
  prepareLedgerFile,
  type BridgeConfig,
} from "../tools/tracker-mcp/config";
import { IntentLedger } from "../tools/tracker-mcp/ledger";
import { TrackerClient } from "../tools/tracker-mcp/client";
import { inputs } from "../tools/tracker-mcp/schemas";
const cleanups: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const c of cleanups.splice(0).reverse()) await c();
});
const token = "synthetic_test_only_" + "a".repeat(45);
const record = "00000000-0000-4000-8000-000000000101";
const rawSource = "https://jobs.example.test/role?id=TEST";
async function fixture(
  handler: (
    req: IncomingMessage,
    res: ServerResponse,
    body: unknown,
  ) => void | Promise<void>,
) {
  const dir = await mkdtemp(path.join(tmpdir(), "tracker-mcp-test-"));
  cleanups.push(() => rm(dir, { recursive: true, force: true }));
  const tokenFile = path.join(dir, "credential");
  await writeFile(tokenFile, token, { mode: 0o600 });
  const server = createServer(async (req, res) => {
    let raw = "";
    for await (const part of req) raw += part;
    await handler(req, res, raw ? JSON.parse(raw) : null);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  cleanups.push(
    () =>
      new Promise<void>((resolve, reject) => {
        server.closeAllConnections();
        server.close((e) => (e ? reject(e) : resolve()));
      }),
  );
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Fixture failed");
  const config: BridgeConfig = {
    origin: "http://127.0.0.1:" + address.port,
    tokenFile,
    ledgerFile: path.join(dir, "ledger.sqlite"),
  };
  // Match CLI startup: SQLite's own file creation inherits the caller's umask.
  await prepareLedgerFile(config.ledgerFile);
  const ledger = new IntentLedger(config.ledgerFile);
  let closed = false;
  const closeLedger = () => {
    if (!closed) {
      closed = true;
      ledger.close();
    }
  };
  cleanups.push(async () => closeLedger());
  return {
    dir,
    config,
    ledger,
    closeLedger,
    client: new TrackerClient(config, ledger, {
      timeoutMs: 5000,
      sleep: async () => {},
    }),
  };
}
function reply(res: ServerResponse, data: unknown, status = 200, extra = {}) {
  res.writeHead(status, { "Content-Type": "application/json", ...extra });
  res.end(JSON.stringify(data));
}
function opportunity(origin: string) {
  return {
    id: record,
    category: "job",
    title: "Synthetic role",
    organization: "Example",
    personal_stage: "saved",
    posting_status: "unknown",
    eligibility: "pending",
    employer_hours: null,
    revision: 1,
    app_url: origin + "/opportunities/" + record,
    evidence: [{ source_url: rawSource, source_checked_at: null }],
  };
}
function envelope(origin: string) {
  return {
    schema_version: 1,
    request_id: "synthetic-request",
    data_as_of: "2026-11-05T02:00:00Z",
    timezone: "Asia/Jakarta",
    items: [opportunity(origin)],
    next_cursor: null,
    warnings: [],
    partial: true,
  };
}
function receipt(origin: string) {
  return {
    outcome: "created",
    opportunity_id: record,
    revision: 1,
    saved_at: "2026-11-05T02:00:00Z",
    app_url: origin + "/opportunities/" + record,
    extraction_status: "manual_required",
  };
}
describe("strict model boundary and trusted configuration", () => {
  it("rejects extra owner/header/URL/idempotency fields, coercion and malformed dates/Unicode", () => {
    for (const value of [
      { owner_id: record },
      { query: "ok", headers: {} },
      { limit: "2" },
      { limit: 21 },
      { query: "\ud800" },
      { base_url: "https://other.example" },
    ])
      expect(inputs.search_opportunities.safeParse(value).success).toBe(false);
    for (const value of [
      { title: "save", idempotency_key: record },
      { source_url: "file:///secret" },
      { source_url: "https://user:password@example.test" },
      { title: " " },
      {},
    ])
      expect(inputs.create_draft.safeParse(value).success).toBe(false);
    expect(
      inputs.get_upcoming_deadlines.safeParse({
        start_date: "2026-02-30",
        end_date: "2026-03-01",
      }).success,
    ).toBe(false);
    expect(
      inputs.get_upcoming_deadlines.safeParse({
        start_date: "2026-11-01",
        end_date: "2026-12-01",
      }).success,
    ).toBe(true);
    expect(
      inputs.get_upcoming_deadlines.safeParse({
        start_date: "2026-11-01",
        end_date: "2026-12-02",
      }).success,
    ).toBe(false);
  });
  it("permits HTTPS origins and only explicitly enabled loopback HTTP", () => {
    expect(validateOrigin("https://tracker.example.test")).toBe(
      "https://tracker.example.test",
    );
    expect(validateOrigin("http://127.0.0.1:3000", true)).toBe(
      "http://127.0.0.1:3000",
    );
    expect(validateOrigin("http://[::1]:3000", true)).toBe("http://[::1]:3000");
    for (const value of [
      "http://127.0.0.1:3000",
      "http://127.0.0.1.evil.test",
      "https://user:pass@example.test",
      "https://example.test/path",
      "https://example.test?key=secret",
      "file:///x",
    ])
      expect(() => validateOrigin(value)).toThrow("INVALID_CONFIGURATION");
    expect(() => validateOrigin("http://192.168.1.1", true)).toThrow();
  });
  it("requires private credential and ledger paths outside the repository", async () => {
    const f = await fixture((_req, res) => reply(res, {}));
    const env = {
      TRACKER_ORIGIN: f.config.origin,
      TRACKER_ALLOW_LOOPBACK_HTTP: "1",
      TRACKER_TOKEN_FILE: f.config.tokenFile,
      TRACKER_LEDGER_FILE: f.config.ledgerFile,
    };
    expect((await loadConfig(env, process.cwd())).origin).toBe(f.config.origin);
    if (process.platform !== "win32") {
      await chmod(f.config.ledgerFile, 0o644);
      await expect(loadConfig(env, process.cwd())).rejects.toThrow(
        "PRIVATE_FILE_PERMISSIONS",
      );
      await expect(prepareLedgerFile(f.config.ledgerFile)).rejects.toThrow(
        "PRIVATE_FILE_PERMISSIONS",
      );
      await chmod(f.config.ledgerFile, 0o600);
    }
    await expect(
      loadConfig(
        { ...env, TRACKER_TOKEN_FILE: path.join(process.cwd(), ".env.local") },
        process.cwd(),
      ),
    ).rejects.toThrow("PRIVATE_FILE_IN_REPOSITORY");
    await chmod(f.config.tokenFile, 0o644);
    if (process.platform !== "win32")
      await expect(readToken(f.config.tokenFile)).rejects.toThrow(
        "CREDENTIAL_UNAVAILABLE",
      );
    await chmod(f.config.tokenFile, 0o600);
    await writeFile(f.config.tokenFile, "sb_secret_" + "a".repeat(50), {
      mode: 0o600,
    });
    await expect(readToken(f.config.tokenFile)).rejects.toThrow(
      "CREDENTIAL_UNAVAILABLE",
    );
  });
});
describe("isolated HTTP adapter and durable capture intent", () => {
  it("uses only fixed agent routes, strips private response fields and preserves null/freshness/pagination", async () => {
    const requests: { path: string; auth: string | undefined }[] = [];
    let origin = "";
    const f = await fixture((req, res) => {
      requests.push({ path: req.url!, auth: req.headers.authorization });
      const data = envelope(origin);
      reply(res, {
        ...data,
        token: "private",
        items: [
          {
            ...data.items[0],
            notes: "private notes",
            hr_contact: "private contact",
          },
        ],
        next_cursor: "more-results",
      });
    });
    origin = f.config.origin;
    const output = await f.client.call("search_opportunities", {
      query: "synthetic",
      include_unknown_hours: true,
      limit: 2,
    });
    expect(requests).toEqual([
      {
        path: "/api/agent/opportunities?query=synthetic&include_unknown_hours=true&limit=2",
        auth: "Bearer " + token,
      },
    ]);
    expect(output).toMatchObject({
      partial: true,
      next_cursor: "more-results",
      items: [
        { employer_hours: null, evidence: [{ source_checked_at: null }] },
      ],
    });
    expect(JSON.stringify(output)).not.toMatch(
      /private notes|private contact|"token"/,
    );
  });
  it("routes detail and deadline reads with validated projections", async () => {
    const paths: string[] = [];
    let origin = "";
    const f = await fixture((req, res) => {
      paths.push(req.url!);
      const data = envelope(origin);
      if (req.url?.startsWith("/api/agent/deadlines"))
        reply(res, {
          ...data,
          items: [
            {
              id: record,
              opportunity_id: record,
              title: "Synthetic deadline",
              precision: "date",
              date: "2026-11-20",
              start_at: null,
              timezone: "Asia/Jakarta",
              revision: 1,
              app_url: origin + "/opportunities/" + record,
            },
          ],
        });
      else reply(res, { ...data, item: opportunity(origin), items: undefined });
    });
    origin = f.config.origin;
    expect(
      await f.client.call("get_opportunity", { opportunity_id: record }),
    ).toMatchObject({ item: { id: record, employer_hours: null } });
    expect(
      await f.client.call("get_upcoming_deadlines", {
        start_date: "2026-11-01",
        end_date: "2026-11-30",
        limit: 50,
      }),
    ).toMatchObject({ items: [{ date: "2026-11-20", start_at: null }] });
    expect(paths).toEqual([
      "/api/agent/opportunities/" + record,
      "/api/agent/deadlines?start_date=2026-11-01&end_date=2026-11-30&limit=50",
    ]);
  });
  it("normalizes missing credentials without retry and rejects reflected token in an allowlisted response", async () => {
    let calls = 0,
      origin = "";
    const f = await fixture((_req, res) => {
      calls++;
      const data = envelope(origin);
      reply(res, { ...data, items: [{ ...data.items[0], title: token }] });
    });
    origin = f.config.origin;
    await expect(f.client.call("search_opportunities", {})).rejects.toThrow(
      "INVALID_BACKEND_RESPONSE",
    );
    expect(calls).toBe(1);
    await rm(f.config.tokenFile);
    await expect(f.client.call("search_opportunities", {})).rejects.toThrow(
      "CREDENTIAL_UNAVAILABLE",
    );
    expect(calls).toBe(1);
  });
  it("bounds timeout retries and aborts an active call on close", async () => {
    let calls = 0;
    const f = await fixture(() => {
      calls++;
    });
    const timed = new TrackerClient(f.config, f.ledger, {
      timeoutMs: 100,
      sleep: async () => {},
    });
    await expect(timed.call("search_opportunities", {})).rejects.toThrow(
      "BACKEND_UNAVAILABLE",
    );
    expect(calls).toBe(3);
    const client = new TrackerClient(f.config, f.ledger, {
      timeoutMs: 15000,
      sleep: async () => {},
    });
    const waiting = client.call("create_draft", {
      title: "Synthetic pending shutdown",
    });
    const rejected = expect(waiting).rejects.toThrow("BRIDGE_CLOSED");
    await new Promise((resolve) => setTimeout(resolve, 10));
    client.close();
    await rejected;
    await expect(client.call("search_opportunities", {})).rejects.toThrow(
      "BRIDGE_CLOSED",
    );
  });
  it("retains the same capture key after ambiguous commit failures and ledger reopen", async () => {
    const keys: string[] = [];
    let fail = true;
    let origin = "";
    const f = await fixture((req, res, body) => {
      expect(body).toEqual({ source_url: rawSource });
      keys.push(String(req.headers["idempotency-key"]));
      if (fail) req.socket.destroy();
      else reply(res, receipt(origin), 201);
    });
    origin = f.config.origin;
    await expect(
      f.client.call("create_draft", { source_url: rawSource }),
    ).rejects.toThrow("BACKEND_UNAVAILABLE");
    expect(keys).toHaveLength(3);
    expect(new Set(keys).size).toBe(1);
    f.closeLedger();
    const dbBytes = await readFile(f.config.ledgerFile);
    expect(dbBytes.includes(Buffer.from(token))).toBe(false);
    expect(dbBytes.includes(Buffer.from(rawSource))).toBe(false);
    const reopened = new IntentLedger(f.config.ledgerFile);
    cleanups.push(async () => reopened.close());
    fail = false;
    const replay = new TrackerClient(f.config, reopened, {
      sleep: async () => {},
    });
    expect(
      await replay.call("create_draft", { source_url: rawSource }),
    ).toMatchObject({ opportunity_id: record });
    expect(keys[3]).toBe(keys[0]);
  });
  it("coalesces simultaneous identical capture calls", async () => {
    let origin = "",
      requests = 0;
    const f = await fixture(async (_req, res) => {
      requests++;
      await new Promise((resolve) => setTimeout(resolve, 15));
      reply(res, receipt(origin), 201);
    });
    origin = f.config.origin;
    const payload = { title: "Synthetic save" };
    const [a, b] = await Promise.all([
      f.client.call("create_draft", payload),
      f.client.call("create_draft", payload),
    ]);
    expect(a).toEqual(b);
    expect(requests).toBe(1);
  });
  it("does not retry auth/key conflicts or redirects and never returns a backend error body", async () => {
    for (const status of [400, 401, 403, 409, 302]) {
      let calls = 0;
      const f = await fixture((_req, res) => {
        calls++;
        reply(res, { message: token, notes: "private" }, status, {
          Location: "https://other.example.test",
        });
      });
      await expect(f.client.call("search_opportunities", {})).rejects.toThrow(
        status === 401 || status === 403
          ? "CREDENTIAL_REJECTED"
          : status === 409
            ? "RECONCILIATION_REQUIRED"
            : status === 302
              ? "REDIRECT_DENIED"
              : "BACKEND_REJECTED",
      );
      expect(calls).toBe(1);
    }
  });
  it("bounds body bytes, response bytes and retries while respecting Retry-After", async () => {
    let calls = 0;
    const huge = await fixture((_req, res) => {
      calls++;
      reply(res, { content: "x".repeat(65536) });
    });
    await expect(huge.client.call("search_opportunities", {})).rejects.toThrow(
      "RESPONSE_TOO_LARGE",
    );
    expect(calls).toBe(1);
    await expect(
      huge.client.call("create_draft", { source_text: "\u0000".repeat(12000) }),
    ).rejects.toThrow("INVALID_INPUT");
    expect(calls).toBe(1);
    const sleeps: number[] = [];
    let origin = "",
      n = 0;
    const retry = await fixture((_req, res) => {
      n++;
      if (n < 3) reply(res, {}, 429, { "Retry-After": "2" });
      else reply(res, envelope(origin));
    });
    origin = retry.config.origin;
    const client = new TrackerClient(retry.config, retry.ledger, {
      sleep: async (ms) => {
        sleeps.push(ms);
      },
    });
    await client.call("search_opportunities", {});
    expect(n).toBe(3);
    expect(sleeps).toEqual([2000, 2000]);
  });
  it("leaves malformed/foreign-link receipt pending rather than claiming capture success", async () => {
    const keys: string[] = [];
    let origin = "",
      valid = false;
    const f = await fixture((req, res) => {
      keys.push(String(req.headers["idempotency-key"]));
      reply(
        res,
        valid
          ? receipt(origin)
          : {
              ...receipt(origin),
              app_url: "https://other.example.test/opportunities/" + record,
            },
        201,
      );
    });
    origin = f.config.origin;
    await expect(
      f.client.call("create_draft", { title: "Synthetic" }),
    ).rejects.toThrow("INVALID_BACKEND_RESPONSE");
    valid = true;
    await f.client.call("create_draft", { title: "Synthetic" });
    expect(keys[0]).toBe(keys[1]);
  });
});
describe("actual SDK stdio contract", () => {
  it("discovers exactly four strict tools and returns only protocol-safe projected data/errors", async () => {
    let origin = "";
    const f = await fixture((_req, res) => reply(res, envelope(origin)));
    origin = f.config.origin;
    f.closeLedger();
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [path.join(process.cwd(), "tools/tracker-mcp/dist/index.js")],
      cwd: process.cwd(),
      stderr: "pipe",
      env: {
        TRACKER_ORIGIN: origin,
        TRACKER_ALLOW_LOOPBACK_HTTP: "1",
        TRACKER_TOKEN_FILE: f.config.tokenFile,
        TRACKER_LEDGER_FILE: f.config.ledgerFile,
      },
    });
    let stderr = "";
    transport.stderr?.on("data", (part) => {
      stderr += String(part);
    });
    const client = new Client({
      name: "synthetic-contract-test",
      version: "1.0.0",
    });
    cleanups.push(() => client.close());
    await client.connect(transport);
    const found = await client.listTools();
    expect(found.tools.map((t) => t.name).sort()).toEqual(
      Object.keys(inputs).sort(),
    );
    for (const tool of found.tools)
      expect(tool.inputSchema.additionalProperties).toBe(false);
    const success = await client.callTool({
      name: "search_opportunities",
      arguments: { limit: 2 },
    });
    expect(success.isError).not.toBe(true);
    expect(JSON.stringify(success)).toContain("Synthetic role");
    const denial = await client.callTool({
      name: "create_draft",
      arguments: { title: "private user text", owner_id: record },
    });
    expect(denial.isError).toBe(true);
    expect(JSON.stringify(denial)).toContain("INVALID_INPUT");
    expect(JSON.stringify(denial)).not.toContain("private user text");
    const forbidden = await client.callTool({
      name: "update_opportunity",
      arguments: {},
    });
    expect(forbidden.isError).toBe(true);
    expect(JSON.stringify(forbidden)).toContain("TOOL_NOT_ALLOWED");
    expect(stderr).not.toContain(token);
  });
});

describe("CLI lifecycle", () => {
  it("closes idempotently on stdin EOF and SIGTERM with no secret diagnostics", async () => {
    const f = await fixture((_req, res) => reply(res, {}));
    f.closeLedger();
    for (const mode of ["eof", "signal"]) {
      const child = spawn(
        process.execPath,
        [path.join(process.cwd(), "tools/tracker-mcp/dist/index.js")],
        {
          cwd: process.cwd(),
          env: {
            NODE_ENV: "test",
            TRACKER_ORIGIN: f.config.origin,
            TRACKER_ALLOW_LOOPBACK_HTTP: "1",
            TRACKER_TOKEN_FILE: f.config.tokenFile,
            TRACKER_LEDGER_FILE: f.config.ledgerFile,
          },
          stdio: ["pipe", "pipe", "pipe"],
        },
      );
      let stderr = "",
        stdout = "";
      child.stderr.on("data", (c) => (stderr += String(c)));
      child.stdout.on("data", (c) => (stdout += String(c)));
      const exited = once(child, "exit");
      if (mode === "eof") child.stdin.end();
      else {
        child.stdin.write(
          JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "initialize",
            params: {
              protocolVersion: "2025-03-26",
              capabilities: {},
              clientInfo: { name: "synthetic", version: "1" },
            },
          }) + "\n",
        );
        await once(child.stdout, "data");
        child.kill("SIGTERM");
      }
      const [code] = await exited;
      expect(code).toBe(0);
      expect(stderr).not.toContain(token);
      expect(stderr).not.toMatch(/Error:|INVALID_STATE/);
      if (mode === "eof") expect(stdout).toBe("");
    }
  });
});

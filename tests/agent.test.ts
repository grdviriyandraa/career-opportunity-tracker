import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { testDatabase, OWNER, STRANGER } from "./helpers/research";
import {
  agentQuery,
  cursorFilter,
  decodeAgentCursor,
  encodeAgentCursor,
  grantInput,
} from "../lib/agent-protocol";
let db: PGlite;
async function rpc<T = Record<string, unknown>>(
  name: string,
  args: unknown[] = [],
) {
  return (
    await db.query<{ result: T }>(
      `select public.${name}(${args.map((_, i) => "$" + (i + 1)).join(",")}) result`,
      args,
    )
  ).rows[0].result;
}
async function mint(
  scopes = ["opportunities:read", "agenda:read", "drafts:create"],
) {
  const token = randomBytes(32).toString("base64url");
  const meta = await rpc("mint_agent_grant", [
    token,
    "Synthetic integration",
    scopes,
    30,
  ]);
  return { token, meta };
}
async function count(table: string) {
  return Number(
    (await db.query<{ n: number }>(`select count(*)::int n from ${table}`))
      .rows[0].n,
  );
}
async function capture(
  token: string,
  payload: object,
  key = randomUUID(),
  canonical: string | null = null,
) {
  return rpc<{ receipt: Record<string, unknown>; replayed: boolean }>(
    "agent_capture",
    [token, payload, key, canonical],
  );
}
beforeAll(async () => {
  db = await testDatabase();
}, 30000);
beforeEach(async () => {
  await db.exec(
    "reset role;delete from tracker_private.agent_receipts;delete from tracker_private.agent_grants;",
  );
  await db.exec("update auth.users set deleted_at=null,banned_until=null");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    OWNER,
  ]);
});
afterAll(async () => {
  await db?.close();
});

describe("agent PostgreSQL boundary", () => {
  it("rejects a credential when its Auth owner is banned or soft-deleted", async () => {
    const { token } = await mint();
    await db.query(
      "update auth.users set banned_until=now()+interval '1 day' where id=$1",
      [OWNER],
    );
    await expect(
      rpc("agent_read", [token, "search_opportunities", {}]),
    ).rejects.toMatchObject({ code: "28000" });
    await db.query(
      "update auth.users set banned_until=null,deleted_at=now() where id=$1",
      [OWNER],
    );
    await expect(
      capture(token, { title: "Blocked owner" }),
    ).rejects.toMatchObject({ code: "28000" });
  });
  it("stores a hash only and exposes only safe owner metadata", async () => {
    const { token, meta } = await mint();
    expect(meta.prefix).toBe(token.slice(0, 8));
    expect(meta).not.toHaveProperty("token_hash");
    expect(JSON.stringify(await rpc("list_agent_grants"))).not.toContain(token);
    const row = (
      await db.query<{ token_hash: string }>(
        "select token_hash from tracker_private.agent_grants",
      )
    ).rows[0];
    expect(row.token_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(row.token_hash).not.toBe(token);
    await expect(
      rpc("agent_read", [row.token_hash, "search_opportunities", {}]),
    ).rejects.toMatchObject({ code: "28000" });
  });
  it("denies mint/list/revoke to a user without an owner profile", async () => {
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      STRANGER,
    ]);
    await expect(mint()).rejects.toMatchObject({ code: "42501" });
    await expect(rpc("list_agent_grants")).rejects.toMatchObject({
      code: "42501",
    });
    await expect(
      rpc("revoke_agent_grant", [randomUUID()]),
    ).rejects.toMatchObject({ code: "42501" });
  });
  it("rejects unknown/duplicate scopes, invalid lifetime and noncredential tokens", async () => {
    for (const args of [
      ["X".repeat(43), "test", ["admin"], 30],
      ["X".repeat(43), "test", [], 30],
      ["X".repeat(43), "test", ["agenda:read", "agenda:read"], 30],
      ["X".repeat(43), "test", ["agenda:read"], 31],
      ["short", "test", ["agenda:read"], 30],
    ])
      await expect(rpc("mint_agent_grant", args)).rejects.toMatchObject({
        code: "22023",
      });
  });
  it("enforces scope for every read and capture, including direct RPC calls", async () => {
    const { token } = await mint(["agenda:read"]);
    await expect(
      rpc("agent_read", [token, "search_opportunities", {}]),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(capture(token, { title: "forbidden" })).rejects.toMatchObject({
      code: "42501",
    });
    await expect(
      rpc("agent_read", [token, "arbitrary_sql", {}]),
    ).rejects.toMatchObject({ code: "42501" });
  });
  it("rejects revoked and expired credentials even on receipt replay", async () => {
    const g = await mint();
    const key = randomUUID();
    await capture(g.token, { title: "Before revoke" }, key);
    await rpc("revoke_agent_grant", [g.meta.id]);
    await expect(
      capture(g.token, { title: "Before revoke" }, key),
    ).rejects.toMatchObject({ code: "28000" });
    const next = await mint();
    await db.query(
      "update tracker_private.agent_grants set expires_at=now()-interval '1 second' where id=$1",
      [next.meta.id],
    );
    await expect(
      rpc("agent_read", [next.token, "search_opportunities", {}]),
    ).rejects.toMatchObject({ code: "28000" });
  });
  it("keeps agent tables private and grants anonymous access only to narrow token RPCs", async () => {
    const { token } = await mint();
    await db.exec("set role anon");
    await expect(
      db.query("select * from tracker_private.agent_grants"),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(rpc("list_agent_grants")).rejects.toMatchObject({
      code: "42501",
    });
    await expect(
      rpc("capture_draft", [{ title: "bad" }, randomUUID(), null]),
    ).rejects.toMatchObject({ code: "42501" });
    expect(
      (await rpc("agent_read", [token, "search_opportunities", {}])).items,
    ).toBeInstanceOf(Array);
    await db.exec("reset role;set role authenticated");
    await expect(
      rpc("agent_read", [token, "search_opportunities", {}]),
    ).rejects.toMatchObject({ code: "42501" });
    await db.exec("reset role");
  });
  it("limits reads to 30 per credential per minute and resets the next window", async () => {
    const { token, meta } = await mint();
    for (let i = 0; i < 30; i++)
      await rpc("agent_read", [token, "search_opportunities", { limit: 1 }]);
    await expect(
      rpc("agent_read", [token, "search_opportunities", {}]),
    ).rejects.toMatchObject({ code: "PT429" });
    await db.query(
      "update tracker_private.agent_grants set read_window=now()-interval '2 minutes' where id=$1",
      [meta.id],
    );
    await expect(
      rpc("agent_read", [token, "search_opportunities", {}]),
    ).resolves.toHaveProperty("items");
  });
  it("limits drafts independently to 10 per minute", async () => {
    const { token } = await mint();
    for (let i = 0; i < 10; i++)
      await capture(token, { title: "Bounded draft " + i });
    await expect(capture(token, { title: "Over limit" })).rejects.toMatchObject(
      { code: "PT429" },
    );
    await expect(
      rpc("agent_read", [token, "search_opportunities", {}]),
    ).resolves.toHaveProperty("items");
  });
  it("replays one receipt, detects changed payload and namespaces keys by integration", async () => {
    const a = await mint(),
      b = await mint();
    const key = randomUUID();
    const payload = { title: "Replay-safe" };
    const first = await capture(a.token, payload, key);
    const history = await count("change_history");
    expect(await capture(a.token, payload, key)).toEqual({
      ...first,
      replayed: true,
    });
    expect(await count("change_history")).toBe(history);
    await expect(
      rpc("agent_capture", [a.token, null, key, null]),
    ).rejects.toMatchObject({ code: "22023" });
    await expect(
      capture(a.token, { title: "Changed" }, key),
    ).rejects.toMatchObject({ code: "40001" });
    expect(
      (await capture(b.token, payload, key)).receipt.opportunity_id,
    ).not.toBe(first.receipt.opportunity_id);
  });
  it("shares exact URL identity with web capture and preserves personal progress", async () => {
    const { token } = await mint();
    const url = "https://example.test/jobs?id=shared";
    const first = await rpc("capture_draft", [
      { title: "Original", source_url: url },
      randomUUID(),
      url,
    ]);
    await db.query(
      "update opportunities set notes='PRIVATE',personal_stage='applied',actual_date='2026-11-05',revision=2 where id=$1",
      [first.opportunity_id],
    );
    const h = await count("change_history"),
      outbox = await count("tracker_private.outbox");
    const result = await capture(
      token,
      { title: "Duplicate", source_url: url },
      randomUUID(),
      url,
    );
    expect(result.receipt).toMatchObject({
      outcome: "existing",
      opportunity_id: first.opportunity_id,
      revision: 2,
    });
    const row = (
      await db.query(
        "select notes,personal_stage from opportunities where id=$1",
        [first.opportunity_id],
      )
    ).rows[0];
    expect(row).toEqual({ notes: "PRIVATE", personal_stage: "applied" });
    expect(await count("change_history")).toBe(h);
    expect(await count("tracker_private.outbox")).toBe(outbox);
  });
  it("rolls back draft, receipt, audit and usage together when audit fails", async () => {
    const g = await mint();
    const before = await count("opportunities");
    await db.exec(
      "create function public.test_agent_fail() returns trigger language plpgsql as $$ begin raise exception 'synthetic audit failure';end $$;create trigger test_agent_fail before insert on public.change_history for each row execute function public.test_agent_fail();",
    );
    try {
      await expect(
        capture(g.token, { title: "Must rollback" }),
      ).rejects.toThrow();
    } finally {
      await db.exec(
        "drop trigger test_agent_fail on public.change_history;drop function public.test_agent_fail();",
      );
    }
    expect(await count("opportunities")).toBe(before);
    expect(await count("tracker_private.agent_receipts")).toBe(0);
    expect(
      (
        await db.query(
          "select last_used_at,draft_count from tracker_private.agent_grants where id=$1",
          [g.meta.id],
        )
      ).rows[0],
    ).toEqual({ last_used_at: null, draft_count: 0 });
  });
  it("projects no notes, raw source text, owner ID or file/contact data", async () => {
    const { token } = await mint();
    const result = await capture(token, {
      title: "Private projection",
      source_text: "PRIVATE RAW SOURCE",
    });
    await db.query(
      "update opportunities set notes='PRIVATE NOTES' where id=$1",
      [result.receipt.opportunity_id],
    );
    const item = (
      await rpc("agent_read", [
        token,
        "get_opportunity",
        { opportunity_id: result.receipt.opportunity_id },
      ])
    ).item;
    expect(JSON.stringify(item)).not.toMatch(
      /PRIVATE|owner_id|source_text|notes|token/,
    );
    expect(
      (
        await db.query<{ actor: string }>(
          "select actor from change_history where opportunity_id=$1",
          [result.receipt.opportunity_id],
        )
      ).rows[0].actor,
    ).toBe("hermes_integration");
  });
  it("filters known hours separately from unknown and preserves null arrangement", async () => {
    const { token } = await mint();
    const a = await capture(token, { title: "Hours fixture A" }),
      b = await capture(token, { title: "Hours fixture B" });
    await db.query(
      "update opportunities set employer_hours=10,arrangement='remote' where id=$1",
      [a.receipt.opportunity_id],
    );
    const known = await rpc<{ items: { id: string }[] }>("agent_read", [
      token,
      "search_opportunities",
      { query: "Hours fixture", max_employer_hours: 20 },
    ]);
    expect(known.items.map((x) => x.id)).toEqual([a.receipt.opportunity_id]);
    const unknown = await rpc<{ items: { id: string; arrangement: null }[] }>(
      "agent_read",
      [
        token,
        "search_opportunities",
        {
          query: "Hours fixture",
          arrangement: "unknown",
          max_employer_hours: 20,
          include_unknown_hours: true,
        },
      ],
    );
    expect(unknown.items).toHaveLength(1);
    expect(unknown.items[0]).toMatchObject({
      id: b.receipt.opportunity_id,
      arrangement: null,
    });
  });
  it("paginates without leaking archived rows or inventing a total", async () => {
    const { token } = await mint();
    const ids = [];
    for (let i = 0; i < 3; i++)
      ids.push(
        (await capture(token, { title: "Page fixture " + i })).receipt
          .opportunity_id,
      );
    await db.query("update opportunities set archived_at=now() where id=$1", [
      ids[0],
    ]);
    const a = await rpc<{ items: { id: string }[]; after: string }>(
      "agent_read",
      [token, "search_opportunities", { query: "Page fixture", limit: 1 }],
    );
    const b = await rpc<{ items: { id: string }[]; after: null }>(
      "agent_read",
      [
        token,
        "search_opportunities",
        { query: "Page fixture", limit: 1, after: a.after },
      ],
    );
    expect(a.items).toHaveLength(1);
    expect(b.items).toHaveLength(1);
    expect(a.items[0].id).not.toBe(b.items[0].id);
    expect(b.after).toBeNull();
  });
  it("returns date-only and instant deadlines within an inclusive Jakarta range", async () => {
    const { token } = await mint();
    const draft = await capture(token, { title: "Deadline fixture" });
    for (const payload of [
      {
        title: "Date only",
        kind: "deadline",
        precision: "date",
        date: "2026-11-06",
        timezone: "Asia/Jakarta",
        expected_revision: 1,
      },
      {
        title: "Instant crossing day",
        kind: "deadline",
        precision: "instant",
        start_at: "2026-11-05T18:00:00Z",
        timezone: "Asia/Jakarta",
        expected_revision: 2,
      },
    ])
      await rpc("add_milestone", [draft.receipt.opportunity_id, payload]);
    const data = await rpc<{
      items: {
        precision: string;
        date: string | null;
        start_at: string | null;
      }[];
    }>("agent_read", [
      token,
      "get_upcoming_deadlines",
      { start_date: "2026-11-06", end_date: "2026-11-06" },
    ]);
    expect(data.items).toHaveLength(2);
    expect(data.items.find((x) => x.precision === "date")).toMatchObject({
      date: "2026-11-06",
      start_at: null,
    });
    await expect(
      rpc("agent_read", [
        token,
        "get_upcoming_deadlines",
        { start_date: "2026-11-01", end_date: "2026-12-15" },
      ]),
    ).rejects.toMatchObject({ code: "22023" });
  });
  it("rejects direct owner/progress injection, unknown read fields and invalid URLs", async () => {
    const { token } = await mint();
    for (const payload of [
      { title: "x", owner_id: OWNER },
      { title: "x", notes: "bad" },
      { title: "x", personal_stage: "applied" },
      { source_url: "javascript:alert(1)" },
      { title: 42 },
    ])
      await expect(capture(token, payload)).rejects.toMatchObject({
        code: "22023",
      });
    await expect(
      rpc("agent_read", [
        token,
        "search_opportunities",
        { owner_id: STRANGER },
      ]),
    ).rejects.toMatchObject({ code: "22023" });
    await expect(
      rpc("agent_read", [token, "search_opportunities", { limit: 21 }]),
    ).rejects.toMatchObject({ code: "22023" });
  });
});

describe("agent HTTP input contract", () => {
  it("rejects duplicate, unknown, nonnumeric, malformed Unicode and invalid-date input", () => {
    for (const query of [
      "limit=1&limit=2",
      "owner_id=x",
      "limit=nan",
      "include_unknown_hours=yes",
    ])
      expect(() =>
        agentQuery(
          new URL("https://tracker.test/?" + query),
          "search_opportunities",
        ),
      ).toThrow();
    expect(() =>
      agentQuery(
        new URL(
          "https://tracker.test/?start_date=2026-02-30&end_date=2026-03-01",
        ),
        "get_upcoming_deadlines",
      ),
    ).toThrow();
    expect(
      grantInput.safeParse({
        label: "x",
        scopes: ["admin"],
        expires_in_days: 30,
      }).success,
    ).toBe(false);
  });
  it("binds a bounded opaque cursor to its filters and preserves UUIDs", () => {
    const hash = cursorFilter("search", { limit: 2 }),
      id = randomUUID(),
      cursor = encodeAgentCursor(id, hash);
    expect(decodeAgentCursor(cursor, hash)).toBe(id);
    expect(() =>
      decodeAgentCursor(cursor, cursorFilter("search", { limit: 3 })),
    ).toThrow();
    expect(() => decodeAgentCursor("not-json", hash)).toThrow();
  });
});

import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
const owner = "00000000-0000-4000-8000-000000000001";
const stranger = "00000000-0000-4000-8000-000000000002";
let db: PGlite;
async function rpc(name: string, args: unknown[]) {
  const placeholders = args.map((_, i) => "$" + (i + 1)).join(",");
  const result = await db.query<{ result: unknown }>(
    `select to_jsonb(public.${name}(${placeholders})) as result`,
    args,
  );
  return result.rows[0].result as Record<string, unknown>;
}
async function identity(id: string) {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
}
async function count(table: string) {
  return Number(
    (await db.query<{ n: number }>(`select count(*)::int n from ${table}`))
      .rows[0].n,
  );
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`,
  );
  await db.exec(
    await readFile("supabase/migrations/20261105143738_core.sql", "utf8"),
  );
  await db.query("insert into auth.users values($1),($2)", [owner, stranger]);
  await db.query("insert into public.profiles(owner_id) values($1)", [owner]);
  await identity(owner);
});
afterAll(async () => {
  await db.close();
});
describe("real PostgreSQL migration and transactional RPCs (PGlite)", () => {
  let id: string;
  let receipt: Record<string, unknown>;
  it("captures once with audit and durable outbox", async () => {
    receipt = await rpc("capture_draft", [
      {
        title: "Synthetic analyst",
        source_url: "https://example.com/jobs?id=1",
      },
      "10000000-0000-4000-8000-000000000001",
      "https://example.com/jobs?id=1",
    ]);
    id = receipt.opportunity_id as string;
    expect(receipt.outcome).toBe("created");
    expect(await count("public.opportunities")).toBe(1);
    expect(await count("public.change_history")).toBe(1);
    expect(await count("tracker_private.outbox")).toBe(1);
  });
  it("replays same receipt and rejects changed payload for same key", async () => {
    expect(
      await rpc("capture_draft", [
        {
          title: "Synthetic analyst",
          source_url: "https://example.com/jobs?id=1",
        },
        "10000000-0000-4000-8000-000000000001",
        "https://example.com/jobs?id=1",
      ]),
    ).toEqual(receipt);
    await expect(
      rpc("capture_draft", [
        { title: "Changed" },
        "10000000-0000-4000-8000-000000000001",
        null,
      ]),
    ).rejects.toMatchObject({ code: "40001" });
    expect(await count("public.change_history")).toBe(1);
  });
  it("preserves progress and notes across cross-channel duplicate capture", async () => {
    await rpc("update_opportunity", [
      id,
      {
        expected_revision: 1,
        personal_stage: "applied",
        actual_date: "2026-11-05",
        notes: "Private synthetic note",
      },
    ]);
    const dup = await rpc("capture_draft", [
      { title: "Overwrite attempt" },
      "10000000-0000-4000-8000-000000000002",
      "https://example.com/jobs?id=1",
    ]);
    expect(dup.outcome).toBe("existing");
    const { rows } = await db.query<{ notes: string; personal_stage: string }>(
      "select notes,personal_stage from opportunities where id=$1",
      [id],
    );
    expect(rows[0]).toEqual({
      notes: "Private synthetic note",
      personal_stage: "applied",
    });
  });
  it("stale revision has no partial domain/history/outbox writes", async () => {
    const before = [
      await count("change_history"),
      await count("tracker_private.outbox"),
    ];
    await expect(
      rpc("update_opportunity", [
        id,
        { expected_revision: 1, notes: "Lost write" },
      ]),
    ).rejects.toMatchObject({ code: "40001" });
    expect([
      await count("change_history"),
      await count("tracker_private.outbox"),
    ]).toEqual(before);
  });
  it("closed is separate from rejected and sparse changes preserve notes", async () => {
    const changed = await rpc("update_opportunity", [
      id,
      { expected_revision: 2, posting_status: "closed" },
    ]);
    expect(changed.personal_stage).toBe("applied");
    expect(changed.notes).toBe("Private synthetic note");
  });
  it("date-only milestone persists as DATE and increments parent revision", async () => {
    const m = await rpc("add_milestone", [
      id,
      {
        expected_revision: 3,
        title: "Submission",
        kind: "deadline",
        precision: "date",
        date: "2026-11-10",
        timezone: "Asia/Jakarta",
        attendance: "conditional",
      },
    ]);
    expect(m.date).toBe("2026-11-10");
    expect(m.start_at).toBe(null);
    expect(m.end_at).toBe(null);
  });
  it("failed milestone constraint rolls back revision and audit", async () => {
    const before = await count("change_history");
    await expect(
      rpc("add_milestone", [
        id,
        {
          expected_revision: 4,
          title: "Bad",
          kind: "event",
          precision: "instant",
          start_at: "2026-11-10T11:00Z",
          end_at: "2026-11-10T10:00Z",
          timezone: "UTC",
        },
      ]),
    ).rejects.toMatchObject({ code: "23514" });
    expect(await count("change_history")).toBe(before);
    expect(
      (
        await db.query<{ revision: number }>(
          "select revision from opportunities where id=$1",
          [id],
        )
      ).rows[0].revision,
    ).toBe(4);
  });
  it("rejects an event without an end time at the database boundary", async () => {
    await expect(
      rpc("add_milestone", [
        id,
        {
          expected_revision: 4,
          title: "Missing end",
          kind: "event",
          precision: "instant",
          start_at: "2026-11-10T11:00:00Z",
          timezone: "UTC",
        },
      ]),
    ).rejects.toMatchObject({ code: "23514" });
  });
  it("authenticated owner can read but cannot bypass transactional writes", async () => {
    await db.exec("set role authenticated");
    expect(await count("opportunities")).toBe(1);
    await expect(
      db.query("update opportunities set notes='bypass'"),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      db.query("select * from tracker_private.capture_receipts"),
    ).rejects.toMatchObject({ code: "42501" });
    await db.exec("reset role");
  });
  it("stranger RLS reads nothing and RPC cannot spoof ownership", async () => {
    await identity(stranger);
    await db.exec("set role authenticated");
    expect(await count("opportunities")).toBe(0);
    await expect(
      rpc("capture_draft", [
        { title: "Unauthorized" },
        "10000000-0000-4000-8000-000000000003",
        null,
      ]),
    ).rejects.toMatchObject({ code: "42501" });
    await db.exec("reset role");
    await identity(owner);
  });
  it("anonymous cannot read data or execute mutation", async () => {
    await identity("");
    await db.exec("set role anon");
    await expect(db.query("select * from opportunities")).rejects.toMatchObject(
      { code: "42501" },
    );
    await expect(
      rpc("update_opportunity", [
        id,
        { expected_revision: 4, notes: "Unauthorized" },
      ]),
    ).rejects.toMatchObject({ code: "42501" });
    await db.exec("reset role");
    await identity(owner);
  });
  it("audit failure rolls back domain mutation", async () => {
    await db.exec(
      "create function tracker_private.fail_audit() returns trigger language plpgsql as $$ begin raise exception 'Injected audit failure';end $$; create trigger fail_audit before insert on change_history for each row execute function tracker_private.fail_audit();",
    );
    await expect(
      rpc("update_opportunity", [
        id,
        { expected_revision: 4, notes: "Must rollback" },
      ]),
    ).rejects.toThrow("Injected audit failure");
    expect(
      (
        await db.query<{ revision: number; notes: string }>(
          "select revision,notes from opportunities where id=$1",
          [id],
        )
      ).rows[0],
    ).toEqual({ revision: 4, notes: "Private synthetic note" });
    await db.exec("drop trigger fail_audit on change_history");
  });
});

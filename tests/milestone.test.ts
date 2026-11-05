import { randomUUID } from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { testDatabase, OWNER, STRANGER } from "./helpers/research";
import { milestoneUpdateSchema, type Milestone } from "../lib/domain";
import { analyseAgenda } from "../lib/agenda";
let db: PGlite;
let opportunity: string;
let milestone: string;
type Stored = Milestone & { revision: number; cancelled_at: string | null };
async function rpc<T = Record<string, unknown>>(
  name: string,
  args: unknown[] = [],
) {
  return (
    await db.query<{ result: T }>(
      `select to_jsonb(public.${name}(${args.map((_, i) => "$" + (i + 1)).join(",")})) result`,
      args,
    )
  ).rows[0].result;
}
const fields = {
  title: "Synthetic deadline",
  kind: "deadline",
  precision: "date",
  date: "2026-11-12",
  timezone: "Asia/Jakarta",
  attendance: "confirmed",
};
const patch = (extra: Record<string, unknown> = {}) => ({
  expected_revision: 2,
  expected_milestone_revision: 1,
  ...fields,
  ...extra,
});
async function update(body: Record<string, unknown>) {
  return rpc<Stored>("update_milestone", [opportunity, milestone, body]);
}
async function parent() {
  return (
    await db.query<{ revision: number; personal_stage: string; notes: string }>(
      "select revision,personal_stage,notes from public.opportunities where id=$1",
      [opportunity],
    )
  ).rows[0];
}
async function stored() {
  return (
    await db.query<Stored>("select * from public.milestones where id=$1", [
      milestone,
    ])
  ).rows[0];
}
async function counts() {
  return (
    await db.query(
      "select (select count(*)::int from public.change_history where opportunity_id=$1) history,(select count(*)::int from tracker_private.outbox where opportunity_id=$1) outbox",
      [opportunity],
    )
  ).rows[0];
}
beforeAll(async () => {
  db = await testDatabase();
}, 30000);
beforeEach(async () => {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    OWNER,
  ]);
  opportunity = String(
    (
      await rpc("capture_draft", [
        { title: "Lifecycle " + randomUUID() },
        randomUUID(),
        null,
      ])
    ).opportunity_id,
  );
  milestone = String(
    (
      await rpc("add_milestone", [
        opportunity,
        { expected_revision: 1, ...fields },
      ])
    ).id,
  );
});
afterAll(async () => {
  await db?.close();
});

describe("milestone lifecycle transaction", () => {
  it("edits with two revision guards and preserves personal progress", async () => {
    await db.query(
      "update public.opportunities set personal_stage='applied',notes='PRIVATE',actual_date='2026-11-05' where id=$1",
      [opportunity],
    );
    const result = await update(
      patch({ title: "Edited deadline", date: "2026-11-20" }),
    );
    expect(result).toMatchObject({
      title: "Edited deadline",
      date: "2026-11-20",
      revision: 2,
      cancelled_at: null,
      start_at: null,
      end_at: null,
    });
    expect(await parent()).toEqual({
      revision: 3,
      personal_stage: "applied",
      notes: "PRIVATE",
    });
    const history = (
      await db.query<{
        operation: string;
        before_value: Stored;
        after_value: Stored;
      }>(
        "select operation,before_value,after_value from change_history where opportunity_id=$1 and operation='milestone_updated'",
        [opportunity],
      )
    ).rows[0];
    expect(history.before_value).toMatchObject({
      revision: 1,
      date: "2026-11-12",
    });
    expect(history.after_value).toMatchObject({
      revision: 2,
      date: "2026-11-20",
    });
  });
  it("rejects stale parent and stale milestone revisions without extra writes", async () => {
    const before = await counts();
    await expect(update(patch({ expected_revision: 1 }))).rejects.toMatchObject(
      { code: "40001" },
    );
    await expect(
      update(patch({ expected_milestone_revision: 2 })),
    ).rejects.toMatchObject({ code: "40001" });
    expect(await counts()).toEqual(before);
    expect((await stored()).revision).toBe(1);
  });
  it("treats an unchanged full edit as a no-op", async () => {
    const before = await counts();
    const result = await update(patch());
    expect(result.revision).toBe(1);
    expect((await parent()).revision).toBe(2);
    expect(await counts()).toEqual(before);
  });
  it("cancels without deletion and restores the same ID and date", async () => {
    const result = await update({
      expected_revision: 2,
      expected_milestone_revision: 1,
      cancelled: true,
    });
    expect(result.id).toBe(milestone);
    expect(result.revision).toBe(2);
    expect(result.cancelled_at).not.toBeNull();
    const out = (
      await db.query<{ operation: string; status: string }>(
        "select operation,status from tracker_private.outbox where event_key=$1",
        [milestone + ":2:milestone_cancelled"],
      )
    ).rows[0];
    expect(out).toEqual({
      operation: "calendar_cleanup_review",
      status: "blocked",
    });
    const restored = await update({
      expected_revision: 3,
      expected_milestone_revision: 2,
      cancelled: false,
    });
    expect(restored).toMatchObject({
      id: milestone,
      date: "2026-11-12",
      cancelled_at: null,
      revision: 3,
    });
    expect((await parent()).revision).toBe(4);
  });
  it("does not duplicate history/outbox for an already-active or cancelled state", async () => {
    const first = await counts();
    await update({
      expected_revision: 2,
      expected_milestone_revision: 1,
      cancelled: false,
    });
    expect(await counts()).toEqual(first);
    await update({
      expected_revision: 2,
      expected_milestone_revision: 1,
      cancelled: true,
    });
    const second = await counts();
    await update({
      expected_revision: 3,
      expected_milestone_revision: 2,
      cancelled: true,
    });
    expect(await counts()).toEqual(second);
    expect((await parent()).revision).toBe(3);
  });
  it("requires restoration before changing cancelled schedule fields", async () => {
    await update({
      expected_revision: 2,
      expected_milestone_revision: 1,
      cancelled: true,
    });
    await expect(
      update(
        patch({
          expected_revision: 3,
          expected_milestone_revision: 2,
          title: "Must not change",
        }),
      ),
    ).rejects.toMatchObject({ code: "22023" });
    expect((await stored()).title).toBe(fields.title);
  });
  it("switches date-only to explicit-offset instant and back without invented midnight", async () => {
    const instant = await update({
      expected_revision: 2,
      expected_milestone_revision: 1,
      title: "DST event",
      kind: "event",
      precision: "instant",
      start_at: "2026-11-01T01:15:00-04:00",
      end_at: "2026-11-01T01:45:00-05:00",
      timezone: "America/New_York",
      attendance: "conditional",
    });
    expect(instant.date).toBeNull();
    expect(Date.parse(instant.end_at!) - Date.parse(instant.start_at!)).toBe(
      90 * 60000,
    );
    const date = await update(
      patch({ expected_revision: 3, expected_milestone_revision: 2 }),
    );
    expect(date).toMatchObject({
      precision: "date",
      date: "2026-11-12",
      start_at: null,
      end_at: null,
    });
  });
  it("validates calendar dates, explicit offsets, zones and event intervals", async () => {
    const cases = [
      patch({ date: "2026-02-30" }),
      patch({ timezone: "Not/AZone" }),
      patch({ start_at: "2026-11-12T01:00:00Z" }),
      {
        expected_revision: 2,
        expected_milestone_revision: 1,
        title: "No offset",
        kind: "deadline",
        precision: "instant",
        start_at: "2026-11-12T01:00:00",
        timezone: "Asia/Jakarta",
        attendance: "confirmed",
      },
      {
        expected_revision: 2,
        expected_milestone_revision: 1,
        title: "Backwards",
        kind: "event",
        precision: "instant",
        start_at: "2026-11-12T10:00:00Z",
        end_at: "2026-11-12T09:00:00Z",
        timezone: "UTC",
        attendance: "confirmed",
      },
    ];
    for (const bad of cases) await expect(update(bad)).rejects.toThrow();
    expect((await parent()).revision).toBe(2);
    expect((await stored()).revision).toBe(1);
  });
  it("rejects injected owner/personal fields and mixed cancellation edits", async () => {
    for (const bad of [
      patch({ owner_id: STRANGER }),
      patch({ notes: "injected" }),
      {
        expected_revision: 2,
        expected_milestone_revision: 1,
        cancelled: true,
        title: "mixed",
      },
      patch({ expected_revision: "2" }),
    ])
      await expect(update(bad)).rejects.toMatchObject({ code: "22023" });
  });
  it("isolates opportunity/milestone IDs and denies nonowner/anonymous access", async () => {
    await expect(
      rpc("update_milestone", [randomUUID(), milestone, patch()]),
    ).rejects.toMatchObject({ code: "P0002" });
    await expect(
      rpc("update_milestone", [opportunity, randomUUID(), patch()]),
    ).rejects.toMatchObject({ code: "P0002" });
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      STRANGER,
    ]);
    await expect(update(patch())).rejects.toMatchObject({ code: "42501" });
    await db.exec("set role anon");
    await expect(update(patch())).rejects.toMatchObject({ code: "42501" });
    await db.exec("reset role");
  });
  it("rolls back schedule, parent revision and audit/outbox when outbox fails", async () => {
    const before = await counts();
    const row = await stored();
    await db.exec(
      "create function public.test_milestone_fail() returns trigger language plpgsql as $$ begin raise exception 'synthetic outbox failure';end $$;create trigger test_milestone_fail before insert on tracker_private.outbox for each row execute function public.test_milestone_fail();",
    );
    try {
      await expect(
        update({
          expected_revision: 2,
          expected_milestone_revision: 1,
          cancelled: true,
        }),
      ).rejects.toThrow();
    } finally {
      await db.exec(
        "drop trigger test_milestone_fail on tracker_private.outbox;drop function public.test_milestone_fail();",
      );
    }
    expect(await stored()).toEqual(row);
    expect((await parent()).revision).toBe(2);
    expect(await counts()).toEqual(before);
  });
  it("omits cancelled deadlines from token-guarded agent reads and restores visibility", async () => {
    const token = "M".repeat(43);
    await rpc("mint_agent_grant", [
      token,
      "Synthetic lifecycle",
      ["agenda:read"],
      1,
    ]);
    const args = { start_date: "2026-11-12", end_date: "2026-11-12" };
    const ids = async () =>
      (
        await rpc<{ items: { id: string }[] }>("agent_read", [
          token,
          "get_upcoming_deadlines",
          args,
        ])
      ).items.map((x) => x.id);
    expect(await ids()).toContain(milestone);
    await update({
      expected_revision: 2,
      expected_milestone_revision: 1,
      cancelled: true,
    });
    expect(await ids()).not.toContain(milestone);
    await update({
      expected_revision: 3,
      expected_milestone_revision: 2,
      cancelled: false,
    });
    expect(await ids()).toContain(milestone);
  });
});
describe("milestone API/domain contract", () => {
  it("rejects sparse/mixed edits, owner injection and fake revision types", () => {
    for (const bad of [
      { expected_revision: 2, expected_milestone_revision: 1, title: "sparse" },
      patch({ cancelled: true }),
      patch({ owner_id: OWNER }),
      patch({ expected_milestone_revision: "1" }),
      patch({ attendance: undefined }),
      patch({
        precision: "instant",
        date: undefined,
        start_at: "2026-11-12T09:00:00",
      }),
    ])
      expect(milestoneUpdateSchema.safeParse(bad).success).toBe(false);
    expect(milestoneUpdateSchema.safeParse(patch()).success).toBe(true);
    expect(
      milestoneUpdateSchema.safeParse({
        expected_revision: 2,
        expected_milestone_revision: 1,
        cancelled: false,
      }).success,
    ).toBe(true);
  });
  it("excludes cancelled records from pure conflict/deadline analysis", () => {
    const active: Milestone = {
      id: "active",
      opportunity_id: "fixture",
      ...fields,
      kind: "event",
      precision: "instant",
      date: null,
      start_at: "2026-11-12T10:00:00Z",
      end_at: "2026-11-12T11:00:00Z",
    };
    const cancelled = {
      ...active,
      id: "cancelled",
      cancelled_at: "2026-11-05T10:00:00Z",
    };
    const report = analyseAgenda([active, cancelled], {
      start: "2026-11-12",
      days: 1,
      timezone: "UTC",
    });
    expect(report.items.map((x) => x.id)).toEqual(["active"]);
    expect(report.conflicts).toHaveLength(0);
    expect(report.limitations).not.toContain(
      "cancellation_state_not_supported",
    );
  });
});

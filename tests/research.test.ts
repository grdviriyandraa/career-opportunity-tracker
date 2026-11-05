import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { normalizeResearchBatch, researchBatchSchema } from "../lib/research";
import {
  adaptRun,
  fixture,
  OWNER,
  STRANGER,
  seedExisting,
  testDatabase,
  type HistoryFixture,
} from "./helpers/research";
let db: PGlite;
let f: HistoryFixture;
let firstRun: string;
let secondRun: string;
async function rpc(name: string, args: unknown[]) {
  return (
    await db.query<{ result: Record<string, unknown> }>(
      `select public.${name}(${args.map((_, i) => "$" + (i + 1)).join(",")}) result`,
      args,
    )
  ).rows[0].result;
}
async function prepare(input: unknown) {
  return rpc("prepare_research", [normalizeResearchBatch(input)]);
}
async function apply(preview: Record<string, unknown>) {
  return rpc("apply_research", [preview.preview_id, preview.payload_hash]);
}
async function count(table: string) {
  return Number(
    (await db.query<{ n: number }>(`select count(*)::int n from ${table}`))
      .rows[0].n,
  );
}
beforeAll(async () => {
  db = await testDatabase();
  f = await fixture();
  await seedExisting(db);
});
afterAll(async () => db.close());
describe("strict research boundary", () => {
  it("rejects personal payloads, duplicate IDs, wrong sums, invalid source time and nested fields", () => {
    const b = adaptRun(f.runs[0]);
    expect(
      researchBatchSchema.safeParse({ ...b, owner_id: OWNER }).success,
    ).toBe(false);
    for (const fields of [
      { notes: "private" },
      { source_url: "not-a-url" },
      { personal_stage: "applied" },
      { source_checked_at: "2030-01-01T00:00:00Z" },
      { first_seen_at: "2030-01-01" },
    ])
      expect(
        researchBatchSchema.safeParse({
          ...b,
          items: [{ ...b.items[0], ...fields }],
        }).success,
      ).toBe(false);
    expect(
      researchBatchSchema.safeParse({ ...b, items: [b.items[0], b.items[0]] })
        .success,
    ).toBe(false);
    expect(
      researchBatchSchema.safeParse({ ...b, inventory_total: 17 }).success,
    ).toBe(false);
  });
});
describe("R01–R04 PostgreSQL research history", () => {
  it("R01 previews first snapshot without changing domain state", async () => {
    const p = await prepare(adaptRun(f.runs[0]));
    expect(p.status).toBe("preview");
    expect(p).toMatchObject({
      inventory_total: 16,
      sources_checked: 16,
      new_count: 14,
      enriched_count: 2,
      carry_forward: 0,
    });
    expect(await count("opportunities")).toBe(2);
    const result = await apply(p);
    firstRun = String(result.research_run_id);
    expect(result).toMatchObject({ status: "applied", domain_created: 14 });
    expect(await count("opportunities")).toBe(16);
  });
  it("R02 imports four new + four checked and carries twelve older timestamps", async () => {
    const id = (
      await db.query<{ opportunity_id: string }>(
        "select opportunity_id from research_identities where external_id=$1",
        ["SYN-JOB-001"],
      )
    ).rows[0].opportunity_id;
    await rpc("update_opportunity", [
      id,
      {
        expected_revision: 1,
        personal_stage: "applied",
        actual_date: "2026-11-04",
        notes: "Private synthetic progress",
      },
    ]);
    const result = await apply(await prepare(adaptRun(f.runs[1])));
    secondRun = String(result.research_run_id);
    expect(result).toMatchObject({
      inventory_total: 20,
      sources_checked: 8,
      new_count: 4,
      enriched_count: 4,
      carry_forward: 12,
      domain_created: 4,
    });
    expect(result.snapshot).toEqual({
      confirmed: 0,
      conditional: 3,
      pending: 2,
      ineligible: 7,
      closed: 8,
    });
    const { rows } = await db.query<{ checked: number; carry: number }>(
      "select count(*) filter(where checked_at is not null)::int checked,count(*) filter(where action='carry_forward' and checked_at is null)::int carry from research_items where research_run_id=$1",
      [secondRun],
    );
    expect(rows[0]).toEqual({ checked: 8, carry: 12 });
    expect(
      (
        await db.query<Record<string, unknown>>(
          "select personal_stage,notes,actual_date::text,title from opportunities where id=$1",
          [id],
        )
      ).rows[0],
    ).toEqual({
      personal_stage: "applied",
      notes: "Private synthetic progress",
      actual_date: "2026-11-04",
      title: "Owner title 0",
    });
    expect(
      (
        await db.query<Record<string, unknown>>(
          "select first_seen_at::text from research_identities where external_id=$1",
          ["SYN-JOB-001"],
        )
      ).rows[0].first_seen_at,
    ).toBe("2026-11-03");
    expect(
      (
        await db.query<Record<string, unknown>>(
          "select last_source_checked_at from research_items where research_run_id=$1 and external_id=$2",
          [secondRun, "SYN-JOB-004"],
        )
      ).rows[0].last_source_checked_at,
    ).toBe(f.runs[0].as_of);
  });
  it("R01 keeps old snapshot immutable after second run", async () => {
    expect(
      (
        await db.query<Record<string, unknown>>(
          "select inventory_total,snapshot from research_runs where id=$1",
          [firstRun],
        )
      ).rows[0],
    ).toEqual({ inventory_total: 16, snapshot: f.runs[0].snapshot });
    expect(await count("research_runs")).toBe(2);
    expect(
      (
        await db.query<Record<string, unknown>>(
          "select count(*)::int n from research_items where research_run_id=$1",
          [firstRun],
        )
      ).rows[0].n,
    ).toBe(16);
  });
  it("R03 replay adds no domain/history/outbox rows; changed hash becomes correction", async () => {
    const before = [
      await count("opportunities"),
      await count("change_history"),
      await count("tracker_private.outbox"),
    ];
    expect((await prepare(adaptRun(f.runs[1]))).status).toBe("replay");
    const reordered = adaptRun(f.runs[1]);
    reordered.items.reverse();
    expect((await prepare(reordered)).status).toBe("replay");
    const changed = await prepare({
      ...adaptRun(f.runs[1]),
      coverage: "Updated source note",
    });
    expect(changed.status).toBe("correction_required");
    expect(await count("research_corrections")).toBe(1);
    expect([
      await count("opportunities"),
      await count("change_history"),
      await count("tracker_private.outbox"),
    ]).toEqual(before);
    expect(
      (
        await db.query<Record<string, unknown>>(
          "select coverage from research_runs where id=$1",
          [secondRun],
        )
      ).rows[0].coverage,
    ).toBeNull();
  });
  it("R04 unknown published date and deadline create no milestone or applied action", async () => {
    expect(await count("milestones")).toBe(0);
    expect(
      (
        await db.query<Record<string, unknown>>(
          "select personal_stage,actual_date,eligibility,posting_status from opportunities where canonical_url=$1",
          ["https://jobs.example.org/role?id=17"],
        )
      ).rows[0],
    ).toEqual({
      personal_stage: "saved",
      actual_date: null,
      eligibility: "conditional",
      posting_status: "unknown",
    });
    expect(
      (
        await db.query<Record<string, unknown>>(
          "select public_snapshot from research_items where research_run_id=$1 and external_id=$2",
          [secondRun, "SYN-JOB-017"],
        )
      ).rows[0].public_snapshot,
    ).toMatchObject({ published_at: null, official_deadline: null });
  });
  it("rejects direct SQL RPC personal-field injection even without API validation", async () => {
    const raw = normalizeResearchBatch({
      ...adaptRun(f.runs[1]),
      run_id: "EVIL",
    });
    const unsafe = { ...raw, items: [{ ...raw.items[0], notes: "overwrite" }] };
    await expect(rpc("prepare_research", [unsafe])).rejects.toMatchObject({
      code: "22023",
    });
  });
  it("rejects stale and tampered preview, and preview expiry", async () => {
    const b = {
      ...adaptRun(f.runs[1]),
      run_id: "SYN-RUN-3",
      reported_new: 0,
      reported_enriched: 0,
      source_as_of: "2026-11-06T08:00:00+07:00",
      items: [],
      inventory_total: 20,
    };
    const p = await prepare(b);
    await expect(
      rpc("apply_research", [p.preview_id, "0".repeat(64)]),
    ).rejects.toMatchObject({ code: "40001" });
    await db.query<Record<string, unknown>>(
      "update tracker_private.research_previews set expires_at=now()-interval '1 second' where id=$1",
      [p.preview_id],
    );
    await expect(apply(p)).rejects.toMatchObject({ code: "40001" });
    const stale = await prepare(b);
    const id = (
      await db.query<Record<string, unknown>>(
        "select id,revision from opportunities limit 1",
      )
    ).rows[0];
    await rpc("update_opportunity", [
      id.id,
      { expected_revision: id.revision, notes: "Changed after preview" },
    ]);
    await expect(apply(stale)).rejects.toMatchObject({ code: "40001" });
    expect(await count("research_runs")).toBe(2);
  });
  it("rejects inconsistent counts, source time regression and out-of-order runs", async () => {
    await expect(
      prepare({
        ...adaptRun(f.runs[1]),
        run_id: "BAD-COUNTS",
        inventory_total: 21,
        snapshot: { ...f.runs[1].snapshot, pending: 3 },
        reported_new: 0,
        reported_enriched: 0,
        items: [],
      }),
    ).rejects.toMatchObject({ code: "22023" });
    await expect(
      prepare({ ...adaptRun(f.runs[0]), run_id: "OLDER" }),
    ).rejects.toMatchObject({ code: "40001" });
  });
  it("reviews only selected public fields with stale/replay protection and preserves personal progress", async () => {
    const proposal = (
      await db.query<{ id: string; opportunity_id: string }>(
        "select id,opportunity_id from research_proposals where research_run_id=$1 and proposed_public_snapshot->>'title'='Market Analyst'",
        [firstRun],
      )
    ).rows[0];
    const before = (
      await db.query<Record<string, unknown>>(
        "select * from opportunities where id=$1",
        [proposal.opportunity_id],
      )
    ).rows[0];
    await expect(
      rpc("resolve_research_proposal", [
        proposal.id,
        Number(before.revision) - 1,
        "accept",
        ["title"],
      ]),
    ).rejects.toMatchObject({ code: "40001" });
    await expect(
      rpc("resolve_research_proposal", [
        proposal.id,
        before.revision,
        "accept",
        ["notes"],
      ]),
    ).rejects.toMatchObject({ code: "22023" });
    const result = await rpc("resolve_research_proposal", [
      proposal.id,
      before.revision,
      "accept",
      ["title", "eligibility"],
    ]);
    expect(result.status).toBe("accepted");
    const after = (
      await db.query<Record<string, unknown>>(
        "select * from opportunities where id=$1",
        [proposal.opportunity_id],
      )
    ).rows[0];
    expect(after).toMatchObject({
      title: "Market Analyst",
      eligibility: "conditional",
      notes: before.notes,
      personal_stage: before.personal_stage,
      actual_date: before.actual_date,
      canonical_url: before.canonical_url,
    });
    const counts = [
      await count("change_history"),
      await count("tracker_private.outbox"),
    ];
    expect(
      (
        await rpc("resolve_research_proposal", [
          proposal.id,
          before.revision,
          "accept",
          ["eligibility", "title"],
        ])
      ).status,
    ).toBe("replay");
    expect([
      await count("change_history"),
      await count("tracker_private.outbox"),
    ]).toEqual(counts);
    await expect(
      rpc("resolve_research_proposal", [
        proposal.id,
        after.revision,
        "dismiss",
        [],
      ]),
    ).rejects.toMatchObject({ code: "40001" });
  });
  it("cannot clear a reviewed value from unknown evidence, and can dismiss without domain changes", async () => {
    const p = (
      await db.query<{ id: string; opportunity_id: string }>(
        "select id,opportunity_id from research_proposals where research_run_id=$1 and proposed_public_snapshot->>'title'='Report Writer'",
        [firstRun],
      )
    ).rows[0];
    const o = (
      await db.query<{ revision: number }>(
        "select revision from opportunities where id=$1",
        [p.opportunity_id],
      )
    ).rows[0];
    await expect(
      rpc("resolve_research_proposal", [
        p.id,
        o.revision,
        "accept",
        ["posting_status"],
      ]),
    ).rejects.toMatchObject({ code: "22023" });
    const history = await count("change_history");
    expect(
      (
        await rpc("resolve_research_proposal", [
          p.id,
          o.revision,
          "dismiss",
          [],
        ])
      ).status,
    ).toBe("dismissed");
    expect(await count("change_history")).toBe(history);
  });
  it("supports more than 251 source rows and rolls back a failed import completely", async () => {
    const input = {
      ...adaptRun(f.runs[1]),
      source_system: "synthetic_bulk",
      run_id: "SYN-BULK",
      source_as_of: "2026-11-07T08:00:00+07:00",
      inventory_total: 300,
      reported_new: 300,
      reported_enriched: 0,
      high_priority_active: null,
      snapshot: {
        confirmed: 0,
        conditional: 0,
        pending: 300,
        ineligible: 0,
        closed: 0,
      },
      items: Array.from({ length: 300 }, (_, i) => ({
        external_id: "BULK-" + i,
        action: "new",
        category: "job",
        title: "Synthetic bulk " + i,
        classification: "pending",
        source_url: "https://jobs.example.org/bulk?id=" + i,
        source_checked_at: "2026-11-07T08:00:00+07:00",
        first_seen_at: null,
      })),
    };
    const p = await prepare(input);
    expect(p.inventory_total).toBe(300);
    const before = [
      await count("research_runs"),
      await count("opportunities"),
      await count("change_history"),
      await count("tracker_private.outbox"),
    ];
    await db.exec(
      "create function tracker_private.fail_research_outbox() returns trigger language plpgsql as $$ begin raise exception 'Injected outbox failure';end $$;create trigger fail_research before insert on tracker_private.outbox for each row execute function tracker_private.fail_research_outbox();",
    );
    await expect(apply(p)).rejects.toThrow("Injected outbox failure");
    expect([
      await count("research_runs"),
      await count("opportunities"),
      await count("change_history"),
      await count("tracker_private.outbox"),
    ]).toEqual(before);
    await db.exec("drop trigger fail_research on tracker_private.outbox");
    const result = await apply(p);
    expect(result).toMatchObject({ inventory_total: 300, domain_created: 300 });
    expect(
      (
        await db.query<{ n: number }>(
          "select count(*)::int n from research_items where research_run_id=$1",
          [result.research_run_id],
        )
      ).rows[0].n,
    ).toBe(300);
    expect((await apply(p)).status).toBe("replay");
  });
  it("stranger cannot read source snapshots or apply owner preview", async () => {
    await db.query<Record<string, unknown>>(
      "select set_config('request.jwt.claim.sub',$1,false)",
      [STRANGER],
    );
    await db.exec("set role authenticated");
    expect(await count("research_runs")).toBe(0);
    expect(await count("research_items")).toBe(0);
    await expect(
      rpc("prepare_research", [normalizeResearchBatch(adaptRun(f.runs[1]))]),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      db.query<Record<string, unknown>>(
        "select * from tracker_private.research_previews",
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await db.exec("reset role");
    await db.query<Record<string, unknown>>(
      "select set_config('request.jwt.claim.sub',$1,false)",
      [OWNER],
    );
  });
});

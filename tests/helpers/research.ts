import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { normalizeResearchBatch } from "../../lib/research";
export const OWNER = "00000000-0000-4000-8000-000000000001";
export const STRANGER = "00000000-0000-4000-8000-000000000002";
export type HistoryFixture = {
  initial_personal_records: { external_id: string; first_seen_at: string }[];
  runs: {
    run_id: string;
    as_of: string;
    records_reviewed: number;
    added: number;
    existing_enriched: number;
    high_priority_active: number;
    snapshot: {
      confirmed: number;
      conditional: number;
      pending: number;
      ineligible: number;
      closed: number;
    };
    items: {
      external_id: string;
      action: "new" | "enriched";
      title: string;
      organization: string;
      eligibility: string;
      evidence_url: string;
      source_checked_at: string;
      first_seen_at: string;
      published_at: null;
      official_deadline: null;
      posting_status: string;
    }[];
  }[];
};
export async function fixture() {
  return JSON.parse(
    await readFile("examples/research_history.synthetic.json", "utf8"),
  ) as HistoryFixture;
}
export function adaptRun(run: HistoryFixture["runs"][number]) {
  return {
    schema_version: 1,
    source_system: "synthetic_research_history",
    run_id: run.run_id,
    source_as_of: run.as_of,
    source_timezone: "Asia/Jakarta",
    inventory_total: run.records_reviewed,
    reported_new: run.added,
    reported_enriched: run.existing_enriched,
    high_priority_active: run.high_priority_active,
    snapshot: run.snapshot,
    coverage: null,
    limitations: null,
    items: run.items.map((i) => ({
      external_id: i.external_id,
      action: i.action,
      category: "job",
      title: i.title,
      organization: i.organization,
      classification: i.eligibility,
      source_url: i.evidence_url,
      source_checked_at: i.source_checked_at,
      first_seen_at: i.first_seen_at,
      published_at: i.published_at,
      official_deadline: i.official_deadline,
      raw_posting_status: i.posting_status,
    })),
  };
}
export async function testDatabase() {
  const db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,deleted_at timestamptz,banned_until timestamptz);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`,
  );
  for (const f of (await readdir("supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await db.exec(await readFile("supabase/migrations/" + f, "utf8"));
  await db.query("insert into auth.users values($1),($2)", [OWNER, STRANGER]);
  await db.query("insert into profiles(owner_id) values($1)", [OWNER]);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    OWNER,
  ]);
  return db;
}
export async function seedExisting(db: PGlite) {
  const f = await fixture();
  for (const [index, record] of f.initial_personal_records.entries()) {
    const input = f.runs[0].items.find(
      (i) => i.external_id === record.external_id,
    )!;
    const item = normalizeResearchBatch(adaptRun(f.runs[0])).items.find(
      (i) => i.external_id === record.external_id,
    )!;
    const { rows } = await db.query<{ result: { opportunity_id: string } }>(
      "select public.capture_draft($1,$2,$3) result",
      [
        { title: "Owner title " + index, source_url: input.evidence_url },
        "10000000-0000-4000-8000-00000000000" + (index + 1),
        item.canonical_url,
      ],
    );
    await db.query(
      "insert into research_identities(owner_id,source_system,external_id,opportunity_id,first_seen_at,source_checked_at,public_snapshot) values($1,$2,$3,$4,$5,null,$6)",
      [
        OWNER,
        "synthetic_research_history",
        record.external_id,
        rows[0].result.opportunity_id,
        record.first_seen_at,
        {},
      ],
    );
  }
}

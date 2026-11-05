import { createHash, randomUUID } from "node:crypto";

// An explicit projection keeps future credential/operational columns out of exports.
export const exportColumns = {
  profiles: "owner_id,singleton,timezone,max_work_hours,total_capacity",
  opportunities:
    "id,owner_id,category,title,organization,source_url,source_text,canonical_url,personal_stage,posting_status,eligibility,notes,employer_hours,actual_date,archived_at,revision,created_at,updated_at,arrangement,remote_eligibility",
  milestones:
    "id,owner_id,opportunity_id,title,kind,precision,date,start_at,end_at,timezone,attendance,revision,cancelled_at",
  change_history:
    "id,owner_id,opportunity_id,actor,operation,before_value,after_value,created_at",
  research_runs:
    "id,owner_id,source_system,run_id,payload_hash,source_as_of,source_timezone,imported_at,inventory_total,sources_checked,new_count,enriched_count,carry_forward,reported_new,reported_enriched,high_priority_active,snapshot,coverage,limitations",
  research_identities:
    "owner_id,source_system,external_id,opportunity_id,first_seen_at,source_checked_at,public_snapshot",
  research_items:
    "id,owner_id,research_run_id,opportunity_id,external_id,action,checked_at,last_source_checked_at,first_seen_at,public_snapshot",
  research_proposals:
    "id,owner_id,research_run_id,opportunity_id,expected_revision,proposed_public_snapshot,base_public_snapshot,receipt,status",
  research_corrections:
    "id,owner_id,research_run_id,payload_hash,proposed_summary,status,created_at",
} as const;
export type ExportTable = keyof typeof exportColumns;
export const exportTables = Object.keys(exportColumns) as ExportTable[];
export type ExportRow = Record<string, unknown>;
export type ExportData = Record<ExportTable, ExportRow[]>;
export const EXPORT_PAGE_SIZE = 500;
export const EXPORT_TABLE_LIMIT = 50_000;
export const EXPORT_BYTE_LIMIT = 16 * 1024 * 1024;
const REQUEST_LIMIT = 300;

export class ExportError extends Error {
  constructor(
    public code: "EXPORT_INCOMPLETE" | "EXPORT_LIMIT" | "EXPORT_INVALID",
  ) {
    super(code);
  }
}
export type ExportReader = {
  count: (table: ExportTable) => Promise<number | null>;
  page: (
    table: ExportTable,
    input: {
      after?: string;
      offset: number;
      limit: number;
    },
  ) => Promise<ExportRow[]>;
};

// Keys sorted recursively; arrays retain database order. UTF-8 JSON without whitespace.
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    const result = JSON.stringify(value);
    if (result === undefined) throw new ExportError("EXPORT_INVALID");
    return result;
  }
  if (Array.isArray(value))
    return "[" + value.map(canonicalJson).join(",") + "]";
  const object = value as Record<string, unknown>;
  return (
    "{" +
    Object.keys(object)
      .sort()
      .map((key) => JSON.stringify(key) + ":" + canonicalJson(object[key]))
      .join(",") +
    "}"
  );
}
export function exportHash(value: unknown) {
  return createHash("sha256")
    .update(canonicalJson(value), "utf8")
    .digest("hex");
}

function validateRelations(data: ExportData, ownerId: string) {
  if (data.profiles.length !== 1) throw new ExportError("EXPORT_INVALID");
  const opportunities = new Set(data.opportunities.map((row) => row.id));
  const runs = new Set(data.research_runs.map((row) => row.id));
  for (const table of exportTables)
    for (const row of data[table]) {
      if (row.owner_id !== ownerId) throw new ExportError("EXPORT_INVALID");
      if ("opportunity_id" in row && !opportunities.has(row.opportunity_id))
        throw new ExportError("EXPORT_INCOMPLETE");
      if ("research_run_id" in row && !runs.has(row.research_run_id))
        throw new ExportError("EXPORT_INCOMPLETE");
    }
}

export async function createOwnerExport(reader: ExportReader, ownerId: string) {
  const startedAt = new Date().toISOString();
  const data = Object.fromEntries(
    exportTables.map((table) => [table, [] as ExportRow[]]),
  ) as ExportData;
  const counts = {} as Record<ExportTable, number>;
  let requests = 0;
  // Bracket the whole export, not just each individual table.
  for (const table of exportTables) {
    const count = await reader.count(table);
    if (count === null || !Number.isSafeInteger(count) || count < 0)
      throw new ExportError("EXPORT_INCOMPLETE");
    if (count > EXPORT_TABLE_LIMIT) throw new ExportError("EXPORT_LIMIT");
    counts[table] = count;
  }
  let bytes = 0;
  for (const table of exportTables) {
    let after: string | undefined;
    const seen = new Set<string>();
    for (;;) {
      if (++requests > REQUEST_LIMIT) throw new ExportError("EXPORT_LIMIT");
      const page = await reader.page(table, {
        after,
        offset: data[table].length,
        limit: EXPORT_PAGE_SIZE,
      });
      if (page.length > EXPORT_PAGE_SIZE)
        throw new ExportError("EXPORT_INVALID");
      if (!page.length) break;
      // A short page may be a provider-imposed cap, so always ask for the tail.
      for (const raw of page) {
        const row: ExportRow = {};
        for (const column of exportColumns[table].split(",")) {
          if (!Object.hasOwn(raw, column))
            throw new ExportError("EXPORT_INVALID");
          row[column] = raw[column];
        }
        const key =
          table === "research_identities"
            ? JSON.stringify([row.source_system, row.external_id])
            : table === "profiles"
              ? row.owner_id
              : row.id;
        if (typeof key !== "string" || !key || seen.has(key))
          throw new ExportError("EXPORT_INCOMPLETE");
        if (
          table !== "research_identities" &&
          after !== undefined &&
          key <= after
        )
          throw new ExportError("EXPORT_INCOMPLETE");
        seen.add(key);
        after = key;
        bytes += Buffer.byteLength(canonicalJson(row), "utf8") + 1;
        if (
          bytes > EXPORT_BYTE_LIMIT ||
          data[table].length === EXPORT_TABLE_LIMIT
        )
          throw new ExportError("EXPORT_LIMIT");
        data[table].push(row);
        if (data[table].length > counts[table])
          throw new ExportError("EXPORT_INCOMPLETE");
      }
    }
    if (data[table].length !== counts[table])
      throw new ExportError("EXPORT_INCOMPLETE");
  }
  for (const table of exportTables)
    if ((await reader.count(table)) !== counts[table])
      throw new ExportError("EXPORT_INCOMPLETE");
  validateRelations(data, ownerId);
  const manifest = {
    format: "career-opportunity-tracker-owner-export",
    schema_version: 1,
    export_id: randomUUID(),
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    consistency: {
      mode: "sequential",
      atomic_snapshot: false,
      counts_verified: true,
      warning:
        "Pembacaan bertahap; perubahan isi dengan jumlah baris tetap mungkin tidak terdeteksi. Hindari mengedit selama ekspor.",
    },
    tables: Object.fromEntries(
      exportTables.map((table) => [
        table,
        {
          row_count: data[table].length,
          sha256: exportHash(data[table]),
        },
      ]),
    ),
    files: { status: "not_implemented", inventory: [], bytes_included: false },
    omitted: [
      "auth_users_sessions_and_credentials",
      "agent_grants_and_receipts",
      "outbox_and_capture_receipts",
      "temporary_research_previews",
      "private_research_correction_payloads",
    ],
    unavailable_entities: [
      "organizations",
      "sources",
      "actions",
      "documents",
      "calendar_mappings",
      "recurrence_exceptions",
    ],
    restore_supported: false,
  };
  const payload = { manifest, data };
  const result = {
    ...payload,
    integrity: {
      algorithm: "SHA-256",
      encoding: "sorted-keys-json-utf8",
      payload_sha256: exportHash(payload),
    },
  };
  const json = JSON.stringify(result);
  if (Buffer.byteLength(json, "utf8") > EXPORT_BYTE_LIMIT)
    throw new ExportError("EXPORT_LIMIT");
  return json;
}

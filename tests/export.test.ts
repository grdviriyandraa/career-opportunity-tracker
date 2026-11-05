import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import {
  createOwnerExport,
  canonicalJson,
  exportColumns,
  exportHash,
  exportTables,
  EXPORT_BYTE_LIMIT,
  EXPORT_TABLE_LIMIT,
  type ExportData,
  type ExportReader,
  type ExportRow,
  type ExportTable,
} from "../lib/owner-export";

const OWNER = "00000000-0000-4000-8000-000000000001";
const id = (n: number) =>
  "10000000-0000-4000-8000-" + String(n).padStart(12, "0");
function row(table: ExportTable, fields: ExportRow): ExportRow {
  return Object.assign(
    Object.fromEntries(
      exportColumns[table].split(",").map((key) => [key, null]),
    ),
    { owner_id: OWNER },
    fields,
  );
}
function fixture(historyCount = 0, clamp = 500) {
  const data = Object.fromEntries(
    exportTables.map((table) => [table, [] as ExportRow[]]),
  ) as ExportData;
  data.profiles = [row("profiles", { timezone: "Asia/Jakarta" })];
  data.opportunities = [
    row("opportunities", {
      id: id(1),
      archived_at: "2026-01-01",
      notes: "Private synthetic note",
      actual_date: "2026-02-01",
    }),
  ];
  data.milestones = [
    row("milestones", {
      id: id(2),
      opportunity_id: id(1),
      cancelled_at: "2026-01-02",
      precision: "date",
      date: "2026-02-01",
      start_at: null,
    }),
  ];
  data.change_history = Array.from({ length: historyCount }, (_, i) =>
    row("change_history", {
      id: id(i + 10),
      opportunity_id: id(1),
      before_value: { notes: "before " + i },
      after_value: { notes: "after " + i },
    }),
  );
  data.research_runs = [
    row("research_runs", { id: id(3), payload_hash: "synthetic-hash" }),
  ];
  data.research_identities = [
    row("research_identities", {
      source_system: 'source,("example")',
      external_id: "Y/100",
      opportunity_id: id(1),
    }),
  ];
  data.research_items = [
    row("research_items", {
      id: id(4),
      research_run_id: id(3),
      opportunity_id: id(1),
      public_snapshot: { official_deadline: null },
    }),
  ];
  data.research_proposals = [
    row("research_proposals", {
      id: id(5),
      research_run_id: id(3),
      opportunity_id: id(1),
    }),
  ];
  data.research_corrections = [
    row("research_corrections", { id: id(6), research_run_id: id(3) }),
  ];
  const calls: { table: ExportTable; offset: number }[] = [];
  const reader: ExportReader = {
    count: async (table) => data[table].length,
    page: async (table, input) => {
      calls.push({ table, offset: input.offset });
      return data[table].slice(
        input.offset,
        input.offset + Math.min(input.limit, clamp),
      );
    },
  };
  return { data, reader, calls };
}

describe("owner data export", () => {
  it("exports 1,205 history rows across clamped pages, archives, cancellations, null dates and research links", async () => {
    const { reader, calls } = fixture(1205, 113);
    const result = JSON.parse(await createOwnerExport(reader, OWNER));
    expect(result.data.change_history).toHaveLength(1205);
    expect(result.data.change_history.at(-1).after_value.notes).toBe(
      "after 1204",
    );
    expect(calls.filter((c) => c.table === "change_history")).toHaveLength(12);
    expect(result.data.opportunities[0]).toMatchObject({
      archived_at: "2026-01-01",
      notes: "Private synthetic note",
      actual_date: "2026-02-01",
    });
    expect(result.data.milestones[0]).toMatchObject({
      cancelled_at: "2026-01-02",
      start_at: null,
    });
    expect(
      result.data.research_items[0].public_snapshot.official_deadline,
    ).toBeNull();
    expect(result.manifest).toMatchObject({
      schema_version: 1,
      restore_supported: false,
      consistency: { atomic_snapshot: false, counts_verified: true },
      files: { status: "not_implemented" },
    });
    expect(result.manifest.tables.change_history.row_count).toBe(1205);
    expect(result.integrity.payload_sha256).toBe(
      exportHash({ manifest: result.manifest, data: result.data }),
    );
    result.data.change_history[0].after_value.notes = "tampered";
    expect(result.integrity.payload_sha256).not.toBe(
      exportHash({ manifest: result.manifest, data: result.data }),
    );
  });

  it("canonicalizes object keys but keeps array order and UTF-8 text", () => {
    const expected = '{"a":[{"x":null,"z":"私密"}],"b":1}';
    const value = { b: 1, a: [{ z: "私密", x: null }] };
    expect(canonicalJson(value)).toBe(expected);
    expect(exportHash(value)).toBe(
      createHash("sha256").update(expected).digest("hex"),
    );
    expect(exportHash([1, 2])).not.toBe(exportHash([2, 1]));
  });

  it("does not include unselected credential columns from a future schema", async () => {
    const { data, reader } = fixture();
    data.profiles[0].refresh_token = "must-not-export";
    data.opportunities[0].credential_hash = "must-not-export";
    const result = await createOwnerExport(reader, OWNER);
    expect(result).not.toContain("must-not-export");
    expect(JSON.parse(result).manifest.omitted).toContain(
      "agent_grants_and_receipts",
    );
  });

  it("fails instead of producing a file when a count is missing or changes", async () => {
    for (const finalCount of [null, 5]) {
      const { reader } = fixture();
      const original = reader.count;
      let profileCalls = 0;
      reader.count = async (table) =>
        table === "profiles" && ++profileCalls > 1
          ? finalCount
          : original(table);
      await expect(createOwnerExport(reader, OWNER)).rejects.toMatchObject({
        code: "EXPORT_INCOMPLETE",
      });
    }
    const { reader } = fixture();
    reader.count = async () => null;
    await expect(createOwnerExport(reader, OWNER)).rejects.toMatchObject({
      code: "EXPORT_INCOMPLETE",
    });
  });

  it("rejects a truncated tail, duplicate pages and database failure", async () => {
    for (const mode of ["tail", "duplicate", "failure"]) {
      const { reader } = fixture(600);
      const original = reader.page;
      reader.page = async (table, input) => {
        if (table !== "change_history" || input.offset === 0)
          return original(table, input);
        if (mode === "failure") throw new Error("provider unavailable");
        return mode === "tail" ? [] : original(table, { ...input, offset: 0 });
      };
      await expect(createOwnerExport(reader, OWNER)).rejects.toThrow();
    }
  });

  it("rejects other-owner rows, missing profile, missing columns and broken relations", async () => {
    for (const mode of ["owner", "profile", "column", "opportunity", "run"]) {
      const { data, reader } = fixture();
      if (mode === "owner") data.milestones[0].owner_id = id(99);
      if (mode === "profile") data.profiles = [];
      if (mode === "column") delete data.opportunities[0].notes;
      if (mode === "opportunity")
        data.research_items[0].opportunity_id = id(99);
      if (mode === "run") data.research_corrections[0].research_run_id = id(99);
      await expect(createOwnerExport(reader, OWNER)).rejects.toThrow();
    }
  });

  it("fails closed above row/byte budgets and when the request budget is exhausted", async () => {
    const a = fixture();
    a.reader.count = async () => EXPORT_TABLE_LIMIT + 1;
    await expect(createOwnerExport(a.reader, OWNER)).rejects.toMatchObject({
      code: "EXPORT_LIMIT",
    });
    const b = fixture();
    b.data.opportunities[0].source_text = "x".repeat(EXPORT_BYTE_LIMIT);
    await expect(createOwnerExport(b.reader, OWNER)).rejects.toMatchObject({
      code: "EXPORT_LIMIT",
    });
    const c = fixture(400, 1);
    await expect(createOwnerExport(c.reader, OWNER)).rejects.toMatchObject({
      code: "EXPORT_LIMIT",
    });
  });
});

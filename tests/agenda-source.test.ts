import { describe, it, expect } from "vitest";
import { readAgendaSource, type MilestoneReader } from "../lib/agenda-source";
import { analyseAgenda } from "../lib/agenda";
import type { Milestone } from "../lib/domain";
const rows = (count: number): Milestone[] =>
  Array.from({ length: count }, (_, i) => ({
    id: "00000000-0000-4000-8000-" + String(i + 1).padStart(12, "0"),
    opportunity_id: "00000000-0000-4000-8000-999999999999",
    title: "Synthetic " + i,
    kind: "deadline",
    precision: "date",
    date: "2024-01-01",
    start_at: null,
    end_at: null,
    timezone: "Asia/Jakarta",
    attendance: "unknown",
  }));
function reader(data: Milestone[], clamp = 500) {
  const calls: Parameters<MilestoneReader>[0][] = [];
  const read: MilestoneReader = async (input) => {
    calls.push(input);
    return {
      rows: data
        .filter((r) => !input.after || r.id > input.after)
        .slice(0, Math.min(input.limit, clamp)),
      count: input.count ? data.length : null,
    };
  };
  return { read, calls };
}
describe("bounded complete Agenda source reads", () => {
  it("treats a verified empty inventory as complete", async () => {
    const r = reader([]);
    const result = await readAgendaSource(r.read, async () => 0);
    expect(result.source).toMatchObject({
      complete: true,
      exhausted: true,
      total_at_start: 0,
      total_at_end: 0,
      page_count: 1,
    });
    expect(result.rows).toEqual([]);
  });
  it("reads 5,000 records and detects a conflict beyond the first 1,000", async () => {
    const data = rows(5000);
    for (const index of [4998, 4999])
      data[index] = {
        ...data[index],
        kind: "event",
        precision: "instant",
        date: null,
        start_at: "2026-11-12T10:00:00+07:00",
        end_at: "2026-11-12T11:00:00+07:00",
        attendance: "confirmed",
      };
    const r = reader(data);
    const result = await readAgendaSource(r.read, async () => data.length);
    expect(result.source.complete).toBe(true);
    expect(result.rows).toHaveLength(5000);
    expect(new Set(result.rows.map((r) => r.id)).size).toBe(5000);
    expect(r.calls[1].after).toBe(data[499].id);
    expect(
      analyseAgenda(result.rows, { start: "2026-11-12", days: 1 }).conflicts,
    ).toEqual([
      {
        first_id: data[4998].id,
        second_id: data[4999].id,
        kind: "confirmed_overlap",
      },
    ]);
  });
  it("continues short pages when the provider clamps its maximum", async () => {
    const data = rows(1001);
    const r = reader(data, 113);
    const result = await readAgendaSource(r.read, async () => data.length);
    expect(result.rows).toEqual(data);
    expect(result.source.complete).toBe(true);
    expect(r.calls.length).toBe(10);
  });
  it("distinguishes exactly 10,000 rows from a truncated tail", async () => {
    const exact = reader(rows(10000));
    const complete = await readAgendaSource(exact.read, async () => 10000);
    expect(complete.source.complete).toBe(true);
    expect(exact.calls.at(-1)?.limit).toBe(1);
    const extra = reader(rows(10001));
    const partial = await readAgendaSource(extra.read, async () => 10001);
    expect(partial.rows).toHaveLength(10000);
    expect(partial.source.complete).toBe(false);
    expect(partial.source.issues).toContain("row_limit");
  });
  it("bounds requests even if the provider returns one row per page", async () => {
    const r = reader(rows(101), 1);
    const result = await readAgendaSource(r.read, async () => 101);
    expect(r.calls).toHaveLength(100);
    expect(result.source.issues).toContain("request_limit");
    expect(result.source.complete).toBe(false);
  });
  it("marks changed or unverifiable counts incomplete", async () => {
    const r = reader(rows(2));
    const changed = await readAgendaSource(r.read, async () => 3);
    expect(changed.source.issues).toContain("count_changed");
    expect(changed.source.complete).toBe(false);
    const missing = await readAgendaSource(
      async (input) => ({ ...(await r.read(input)), count: null }),
      async () => null,
    );
    expect(missing.source.issues).toContain("count_unavailable");
    expect(missing.source.complete).toBe(false);
  });
  it("does not call an early empty page complete when inventory still contains rows", async () => {
    const result = await readAgendaSource(
      async () => ({ rows: [], count: 10 }),
      async () => 10,
    );
    expect(result.source.issues).toContain("count_mismatch");
    expect(result.source.complete).toBe(false);
  });
  it("rejects duplicate, reversed or non-advancing pages without silently dropping records", async () => {
    const data = rows(2);
    for (const page of [[data[0], data[0]], [...data].reverse()]) {
      const result = await readAgendaSource(
        async () => ({ rows: page, count: 2 }),
        async () => 2,
      );
      expect(result.source.issues).toContain("non_advancing_page");
      expect(result.source.complete).toBe(false);
    }
    const result = await readAgendaSource(
      async () => ({ rows: data, count: 2 }),
      async () => 2,
    );
    expect(result.rows).toHaveLength(2);
    expect(result.source.issues).toContain("non_advancing_page");
  });
  it("fails closed on a provider page/count error instead of returning successful partial data", async () => {
    const data = rows(600);
    const r = reader(data);
    await expect(
      readAgendaSource(
        async (input) => {
          if (input.after) throw new Error("Provider unavailable");
          return r.read(input);
        },
        async () => 600,
      ),
    ).rejects.toThrow("Provider unavailable");
    await expect(
      readAgendaSource(reader([]).read, async () => {
        throw new Error("Count unavailable");
      }),
    ).rejects.toThrow("Count unavailable");
  });
  it("propagates incomplete source coverage independently of alert caps", () => {
    const result = analyseAgenda([], { sourceIncomplete: true });
    expect(result.source_truncated).toBe(false);
    expect(result.internal_data_complete).toBe(false);
    expect(result.partial).toBe(true);
  });
});

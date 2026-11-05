import { describe, it, expect } from "vitest";
import {
  analyseAgenda,
  agendaQuerySchema,
  localDayBounds,
  type BusyCache,
} from "../lib/agenda";
import type { Milestone } from "../lib/domain";
const now = "2026-11-05T08:00:00Z";
const base = { now, start: "2026-11-12", days: 2, timezone: "Asia/Jakarta" };
it("keeps identical local dates in different source zones distinct in repeated inventories", () => {
  const sample = (id: string, timezone: string): Milestone => ({
    id,
    opportunity_id: "synthetic",
    title: id,
    kind: "event",
    precision: "date",
    date: "2026-11-12",
    start_at: null,
    end_at: null,
    timezone,
    attendance: "unknown",
  });
  const rows = [
    sample("jakarta", "Asia/Jakarta"),
    sample("los-angeles", "America/Los_Angeles"),
    sample("jakarta-again", "Asia/Jakarta"),
    event("evening", "2026-11-12T20:00:00Z", "2026-11-12T21:00:00Z"),
  ];
  const report = analyseAgenda(rows, {
    start: "2026-11-12",
    days: 2,
    timezone: "UTC",
    now,
  });
  const paired = report.conflicts
    .filter((c) => [c.first_id, c.second_id].includes("evening"))
    .map((c) => [c.first_id, c.second_id].find((id) => id !== "evening"));
  expect(paired).toEqual(["los-angeles"]);
});
function event(
  id: string,
  start: string,
  end: string,
  extra: Partial<Milestone> = {},
): Milestone {
  return {
    id,
    opportunity_id: "owner-opportunity",
    title: id,
    kind: "event",
    precision: "instant",
    date: null,
    start_at: start,
    end_at: end,
    timezone: "Asia/Jakarta",
    attendance: "confirmed",
    ...extra,
  };
}
function date(
  id: string,
  day = "2026-11-12",
  extra: Partial<Milestone> = {},
): Milestone {
  return {
    id,
    opportunity_id: "owner-opportunity",
    title: id,
    kind: "event",
    precision: "date",
    date: day,
    start_at: null,
    end_at: null,
    timezone: "Asia/Jakarta",
    attendance: "unknown",
    ...extra,
  };
}
const a = () =>
  event("A", "2026-11-12T10:00:00+07:00", "2026-11-12T11:00:00+07:00");
const cache = (extra: Partial<BusyCache> = {}): BusyCache => ({
  checked_at: now,
  coverage_start: "2026-11-10T00:00:00Z",
  coverage_end: "2026-11-15T00:00:00Z",
  selected_calendar_ids: ["personal", "app"],
  successful_calendar_ids: ["personal"],
  failed_calendar_ids: [],
  app_calendar_id: "app",
  intervals: [],
  ...extra,
});
describe("agenda interval and date semantics", () => {
  it("FR11 confirms overlapping attendance; endpoint adjacency is not a collision", () => {
    const b = event(
      "B",
      "2026-11-12T10:30:00+07:00",
      "2026-11-12T12:00:00+07:00",
    );
    expect(analyseAgenda([a(), b], base).conflicts[0].kind).toBe(
      "confirmed_overlap",
    );
    const adjacent = event(
      "C",
      "2026-11-12T11:00:00+07:00",
      "2026-11-12T12:00:00+07:00",
    );
    expect(analyseAgenda([a(), adjacent], base).conflicts).toHaveLength(0);
  });
  it("FR12 warns for a chosen buffer without calling it an actual overlap", () => {
    const b = event(
      "B",
      "2026-11-12T11:00:00+07:00",
      "2026-11-12T12:00:00+07:00",
    );
    expect(
      analyseAgenda([a(), b], { ...base, buffer_before: 15, buffer_after: 15 })
        .conflicts[0].kind,
    ).toBe("buffer_warning");
  });
  it("FR10 keeps date-only and conditional attendance potential and unmodified", () => {
    const unknown = date("final");
    const result = analyseAgenda([a(), unknown], base);
    expect(result.conflicts[0].kind).toBe("potential_overlap");
    expect(result.items.find((i) => i.id === "final")).toMatchObject({
      date: "2026-11-12",
      start_at: null,
      end_at: null,
    });
    const conditional = event("C", a().start_at!, a().end_at!, {
      attendance: "conditional",
    });
    expect(analyseAgenda([a(), conditional], base).conflicts[0].kind).toBe(
      "potential_overlap",
    );
  });
  it("FR13 deadlines never create a busy interval; unknown deadline proximity stays potential", () => {
    const deadline = date("submit", "2026-11-12", { kind: "deadline" });
    const next = event("submit2", "2026-11-13T09:00:00+07:00", "", {
      kind: "deadline",
      end_at: null,
    });
    const result = analyseAgenda([a(), deadline, next], base);
    expect(result.conflicts).toHaveLength(0);
    expect(result.deadline_clusters[0].kind).toBe("potential_deadline_cluster");
    expect(result.items.find((m) => m.id === "submit")?.start_at).toBeNull();
  });
  it("deadline threshold includes exactly 48 hours and excludes later instants", () => {
    const first = event("D1", "2026-11-12T00:00:00Z", "", {
      kind: "deadline",
      end_at: null,
    });
    const next = event("D2", "2026-11-14T00:00:00Z", "", {
      kind: "deadline",
      end_at: null,
    });
    expect(
      analyseAgenda([first, next], { ...base, days: 5 }).deadline_clusters,
    ).toHaveLength(1);
    expect(
      analyseAgenda(
        [first, { ...next, start_at: "2026-11-14T00:00:00.000000001Z" }],
        { ...base, days: 5 },
      ).deadline_clusters,
    ).toHaveLength(0);
  });
  it("includes events crossing midnight/window start and excludes end-exclusive non-overlap", () => {
    const overnight = event(
      "overnight",
      "2026-11-11T23:00:00+07:00",
      "2026-11-12T01:00:00+07:00",
    );
    const early = event(
      "early",
      "2026-11-12T00:30:00+07:00",
      "2026-11-12T02:00:00+07:00",
    );
    const ended = event(
      "ended",
      "2026-11-11T22:00:00+07:00",
      "2026-11-12T00:00:00+07:00",
    );
    const result = analyseAgenda([overnight, early, ended], base);
    expect(result.items.map((i) => i.id)).not.toContain("ended");
    expect(result.conflicts).toHaveLength(1);
  });
  it("handles 23/25-hour calendar dates and opposite sides of Australian DST", () => {
    const spring = localDayBounds("2026-03-08", "America/New_York");
    const fall = localDayBounds("2026-11-01", "America/New_York");
    expect(
      (Date.parse(spring.end_at) - Date.parse(spring.start_at)) / 3600000,
    ).toBe(23);
    expect(
      (Date.parse(fall.end_at) - Date.parse(fall.start_at)) / 3600000,
    ).toBe(25);
    const aus = localDayBounds("2026-10-04", "Australia/Sydney");
    expect((Date.parse(aus.end_at) - Date.parse(aus.start_at)) / 3600000).toBe(
      23,
    );
    const repeated = event(
      "repeat",
      "2026-11-01T01:00:00-04:00",
      "2026-11-01T02:00:00-05:00",
      { timezone: "America/New_York" },
    );
    const second = event(
      "second",
      "2026-11-01T01:30:00-05:00",
      "2026-11-01T01:45:00-05:00",
      { timezone: "America/New_York" },
    );
    expect(
      analyseAgenda([repeated, second], {
        now,
        start: "2026-11-01",
        days: 1,
        timezone: "America/New_York",
      }).conflicts[0].kind,
    ).toBe("confirmed_overlap");
  });
  it("evaluates date-only in its source zone rather than assuming display-zone midnight", () => {
    const sydney = date("sydney", "2026-11-12", {
      timezone: "Australia/Sydney",
    });
    const inUTC = event("UTC", "2026-11-11T13:30:00Z", "2026-11-11T14:00:00Z", {
      timezone: "UTC",
    });
    const result = analyseAgenda([sydney, inUTC], {
      now,
      start: "2026-11-11",
      days: 1,
      timezone: "UTC",
    });
    expect(result.conflicts[0].kind).toBe("potential_overlap");
  });
  it("processes beyond fifty records and reports caps/malformed inputs honestly", () => {
    const many = Array.from({ length: 60 }, (_, i) =>
      event(
        "event" + i,
        "2026-11-12T10:00:00+07:00",
        "2026-11-12T11:00:00+07:00",
      ),
    );
    const result = analyseAgenda(many, { ...base, maxAlerts: 10 });
    expect(result.items).toHaveLength(60);
    expect(result.conflicts).toHaveLength(10);
    expect(result.alerts_truncated).toBe(true);
    expect(result.internal_data_complete).toBe(false);
    const bad = analyseAgenda([{ ...a(), end_at: null }], base);
    expect(bad.invalid_milestone_ids).toEqual(["A"]);
    expect(bad.partial).toBe(true);
    expect(
      analyseAgenda([a()], { ...base, sourceTruncated: true })
        .internal_data_complete,
    ).toBe(false);
  });
  it("rejects unknown query fields, impossible dates and excessive windows/buffers", () => {
    for (const input of [
      { owner_id: "forged" },
      { start: "2026-02-30" },
      { days: 181 },
      { buffer_before: -1 },
      { buffer_after: 121 },
    ])
      expect(agendaQuerySchema.safeParse(input).success).toBe(false);
  });
});
describe("coverage-aware FreeBusy boundary (pure fixtures, not live Google)", () => {
  it("never treats missing calendars as a complete check", () => {
    const result = analyseAgenda([a()], base);
    expect(result.external.state).toBe("not_connected");
    expect(result.partial).toBe(true);
    expect(
      analyseAgenda([a()], {
        ...base,
        busyCache: cache({ selected_calendar_ids: ["app"] }),
      }).external.state,
    ).toBe("not_connected");
  });
  it("marks stale, failed or incomplete coverage without claiming safety", () => {
    expect(
      analyseAgenda([], {
        ...base,
        busyCache: cache({ checked_at: "2026-11-05T07:44:59Z" }),
      }).external.state,
    ).toBe("stale");
    expect(
      analyseAgenda([], {
        ...base,
        busyCache: cache({ failed_calendar_ids: ["other"] }),
      }).external.state,
    ).toBe("partial");
    expect(
      analyseAgenda([], {
        ...base,
        busyCache: cache({ coverage_end: "2026-11-12T00:00:00Z" }),
      }).external.state,
    ).toBe("partial");
    expect(
      analyseAgenda([], {
        ...base,
        busyCache: cache({ checked_at: "2026-11-05T08:01:00Z" }),
      }).external.state,
    ).toBe("error");
  });
  it("excludes the app calendar and deduplicates repeated personal busy intervals", () => {
    const interval = {
      calendar_id: "personal",
      start_at: a().start_at!,
      end_at: a().end_at!,
    };
    const result = analyseAgenda([a()], {
      ...base,
      busyCache: cache({
        intervals: [interval, interval, { ...interval, calendar_id: "app" }],
      }),
    });
    expect(result.external_conflicts).toHaveLength(1);
    expect(result.external_conflicts[0].certainty).toBe("confirmed");
  });
  it("uses potential severity when busy cache is stale or attendance conditional", () => {
    const busy = {
      calendar_id: "personal",
      start_at: a().start_at!,
      end_at: a().end_at!,
    };
    expect(
      analyseAgenda([a()], {
        ...base,
        busyCache: cache({
          checked_at: "2026-11-05T07:00:00Z",
          intervals: [busy],
        }),
      }).external_conflicts[0].certainty,
    ).toBe("potential");
    expect(
      analyseAgenda([{ ...a(), attendance: "conditional" }], {
        ...base,
        busyCache: cache({ intervals: [busy] }),
      }).external_conflicts[0].certainty,
    ).toBe("potential");
  });
  it("requires cache coverage for buffers and ignores busy outside the checked window", () => {
    const check = analyseAgenda([], {
      ...base,
      buffer_before: 15,
      buffer_after: 15,
      busyCache: cache({
        coverage_start: "2026-11-11T17:00:00Z",
        coverage_end: "2026-11-13T17:00:00Z",
      }),
    });
    expect(check.external.state).toBe("partial");
    const oldBusy = {
      calendar_id: "personal",
      start_at: "2026-11-01T00:00:00Z",
      end_at: "2026-11-02T00:00:00Z",
    };
    expect(
      analyseAgenda([a()], {
        ...base,
        busyCache: cache({ intervals: [oldBusy] }),
      }).external_conflicts,
    ).toHaveLength(0);
  });
});

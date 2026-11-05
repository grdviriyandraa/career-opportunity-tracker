import { describe, it, expect } from "vitest";
import {
  canonicalUrl,
  captureSchema,
  updateSchema,
  milestoneSchema,
  overlaps,
} from "../lib/domain";
describe("identity and capture", () => {
  it("retains query-based job identity and removes only tracking", () => {
    expect(
      canonicalUrl("https://example.com/jobs?id=2&utm_source=x#apply"),
    ).toBe("https://example.com/jobs?id=2");
    expect(canonicalUrl("https://example.com/jobs?id=1")).not.toBe(
      canonicalUrl("https://example.com/jobs?id=2"),
    );
  });
  it("rejects owner spoofing, empty input and credentials", () => {
    expect(
      captureSchema.safeParse({ title: "A", owner_id: "spoof" }).success,
    ).toBe(false);
    expect(captureSchema.safeParse({}).success).toBe(false);
    for (const url of ["", "not-a-url", "https://"])
      expect(captureSchema.safeParse({ source_url: url }).success).toBe(false);
    expect(
      captureSchema.safeParse({ source_url: "https://user:pass@example.com" })
        .success,
    ).toBe(false);
  });
  it("does not assign a category or overwrite absent personal fields", () => {
    expect(captureSchema.parse({ title: "Test" })).toEqual({ title: "Test" });
    expect(
      updateSchema.parse({ expected_revision: 1, posting_status: "closed" }),
    ).not.toHaveProperty("personal_stage");
  });
  it("requires actual date for applied and rejects impossible dates", () => {
    expect(
      updateSchema.safeParse({
        expected_revision: 1,
        personal_stage: "applied",
      }).success,
    ).toBe(false);
    expect(
      updateSchema.safeParse({
        expected_revision: 1,
        personal_stage: "applied",
        actual_date: "2026-02-30",
      }).success,
    ).toBe(false);
  });
});
describe("milestone semantics", () => {
  it("keeps date-only without invented time", () => {
    expect(
      milestoneSchema.parse({
        expected_revision: 1,
        title: "Deadline",
        kind: "deadline",
        precision: "date",
        date: "2026-11-20",
        timezone: "Asia/Jakarta",
      }),
    ).not.toHaveProperty("start_at");
  });
  it("rejects invalid zones, intervals and timed date-only hybrid", () => {
    const base = {
      expected_revision: 1,
      title: "Class",
      kind: "event",
      precision: "instant",
      timezone: "Bad/Zone",
      start_at: "2026-11-20T10:00:00Z",
      end_at: "2026-11-20T09:00:00Z",
    };
    expect(milestoneSchema.safeParse(base).success).toBe(false);
    expect(
      milestoneSchema.safeParse({ ...base, timezone: "UTC" }).success,
    ).toBe(false);
  });
  it("uses half-open intervals, handles midnight and explicit DST offsets", () => {
    expect(
      overlaps(
        {
          start_at: "2026-11-01T01:00:00-04:00",
          end_at: "2026-11-01T02:00:00-05:00",
        },
        { start_at: "2026-11-01T06:30:00Z", end_at: "2026-11-01T07:00:00Z" },
      ),
    ).toBe(true);
    expect(
      overlaps(
        { start_at: "2026-11-01T10:00:00Z", end_at: "2026-11-01T11:00:00Z" },
        { start_at: "2026-11-01T11:00:00Z", end_at: "2026-11-01T12:00:00Z" },
      ),
    ).toBe(false);
  });
});

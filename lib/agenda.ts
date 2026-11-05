import { Temporal } from "@js-temporal/polyfill";
import { z } from "zod";
import type { Milestone } from "./domain";

export const agendaQuerySchema = z.strictObject({
  start: z.iso.date().optional(),
  days: z.coerce.number().int().min(1).max(180).default(180),
  buffer_before: z.coerce.number().int().min(0).max(120).default(0),
  buffer_after: z.coerce.number().int().min(0).max(120).default(0),
});
export type AgendaQuery = z.infer<typeof agendaQuerySchema>;
export type BusyCache = {
  checked_at: string;
  coverage_start: string;
  coverage_end: string;
  selected_calendar_ids: string[];
  successful_calendar_ids: string[];
  failed_calendar_ids: string[];
  app_calendar_id?: string;
  intervals: { calendar_id: string; start_at: string; end_at: string }[];
};
export type AgendaAlert = {
  first_id: string;
  second_id: string;
  kind:
    | "confirmed_overlap"
    | "potential_overlap"
    | "buffer_warning"
    | "deadline_cluster"
    | "potential_deadline_cluster";
};
export type ExternalAlert = {
  milestone_id: string;
  calendar_id: string;
  certainty: "confirmed" | "potential";
};
type Range = { start: bigint; end: bigint };
type Entry = { item: Milestone; range: Range; buffered: Range; timed: boolean };
const MINUTE = 60_000_000_000n;
const FRESHNESS = 15n * MINUTE;
const DEADLINE_WINDOW = 48n * 60n * MINUTE;
const intersects = (a: Range, b: Range) => a.start < b.end && b.start < a.end;
const instant = (value: string) =>
  Temporal.Instant.from(value).epochNanoseconds;
function validZone(zone: string) {
  if (/^[+-]/.test(zone)) throw new Error("Named IANA zone required");
  new Intl.DateTimeFormat("en", { timeZone: zone });
  return zone;
}
export function localDayBounds(date: string, timezone: string) {
  const day = Temporal.PlainDate.from(date);
  const start = day.toZonedDateTime(validZone(timezone));
  if (!start.toPlainDate().equals(day))
    throw new Error("Local calendar date does not exist");
  return {
    start_at: start.toInstant().toString(),
    end_at: day
      .add({ days: 1 })
      .toZonedDateTime(timezone)
      .toInstant()
      .toString(),
  };
}
function sourceRange(item: Milestone): Range {
  if (
    !["date", "instant"].includes(item.precision) ||
    !["deadline", "event"].includes(item.kind) ||
    !["confirmed", "conditional", "unknown"].includes(item.attendance)
  )
    throw new Error("Invalid milestone");
  validZone(item.timezone);
  if (item.precision === "date") {
    if (!item.date || item.start_at || item.end_at)
      throw new Error("Invalid date-only milestone");
    const day = localDayBounds(item.date, item.timezone);
    return { start: instant(day.start_at), end: instant(day.end_at) };
  }
  if (!item.start_at || item.date) throw new Error("Missing instant");
  const start = instant(item.start_at);
  if (item.kind === "deadline") {
    if (item.end_at) throw new Error("Deadline has no duration");
    return { start, end: start + 1n };
  }
  if (!item.end_at) throw new Error("Missing end");
  const end = instant(item.end_at);
  if (end <= start) throw new Error("Invalid event interval");
  return { start, end };
}
function externalState(
  cache: BusyCache | undefined,
  window: Range,
  now: bigint,
) {
  if (!cache) return "not_connected" as const;
  const selected = new Set(
    cache.selected_calendar_ids.filter((id) => id !== cache.app_calendar_id),
  );
  if (!selected.size) return "not_connected" as const;
  try {
    const checked = instant(cache.checked_at);
    if (checked > now) return "error" as const;
    if (now - checked > FRESHNESS) return "stale" as const;
    if (
      instant(cache.coverage_start) > window.start ||
      instant(cache.coverage_end) < window.end ||
      instant(cache.coverage_start) >= instant(cache.coverage_end) ||
      cache.failed_calendar_ids.length ||
      [...selected].some((id) => !cache.successful_calendar_ids.includes(id))
    )
      return "partial" as const;
    return "fresh" as const;
  } catch {
    return "error" as const;
  }
}

export function analyseAgenda(
  items: Milestone[],
  options: Partial<AgendaQuery> & {
    timezone?: string;
    now?: string;
    sourceTruncated?: boolean;
    busyCache?: BusyCache;
    maxAlerts?: number;
  } = {},
) {
  const query = agendaQuerySchema.parse({
    start: options.start,
    days: options.days,
    buffer_before: options.buffer_before,
    buffer_after: options.buffer_after,
  });
  const timezone = validZone(options.timezone ?? "Asia/Jakarta");
  const now = options.now ?? new Date().toISOString();
  const nowInstant = Temporal.Instant.from(now);
  const startDate =
    query.start ??
    nowInstant.toZonedDateTimeISO(timezone).toPlainDate().toString();
  const endDate = Temporal.PlainDate.from(startDate)
    .add({ days: query.days })
    .toString();
  const window = {
    start: instant(localDayBounds(startDate, timezone).start_at),
    end: instant(localDayBounds(endDate, timezone).start_at),
  };
  const before = BigInt(query.buffer_before) * MINUTE,
    after = BigInt(query.buffer_after) * MINUTE;
  const maxAlerts = Math.max(1, Math.min(options.maxAlerts ?? 100, 100));
  const seen = new Set<string>();
  const invalidIds: string[] = [];
  const entries: Entry[] = [];
  for (const item of items) {
    if (seen.has(item.id)) {
      invalidIds.push(item.id);
      continue;
    }
    seen.add(item.id);
    try {
      const range = sourceRange(item);
      const buffered =
        item.kind === "event"
          ? { start: range.start - before, end: range.end + after }
          : range;
      if (intersects(buffered, window))
        entries.push({
          item,
          range,
          buffered,
          timed: item.precision === "instant",
        });
    } catch {
      invalidIds.push(item.id);
    }
  }
  const ordered = (rows: Entry[], buffered = false) =>
    [...rows].sort((a, b) => {
      const x = buffered ? a.buffered.start : a.range.start,
        y = buffered ? b.buffered.start : b.range.start;
      return x < y ? -1 : x > y ? 1 : a.item.id.localeCompare(b.item.id);
    });
  const events = ordered(
    entries.filter((e) => e.item.kind === "event"),
    true,
  );
  const deadlines = ordered(entries.filter((e) => e.item.kind === "deadline"));
  const conflicts: AgendaAlert[] = [];
  let conflictsTruncated = false;
  eventsLoop: for (let i = 0; i < events.length; i++)
    for (let j = i + 1; j < events.length; j++) {
      const a = events[i],
        b = events[j];
      if (b.buffered.start >= a.buffered.end) break;
      if (!intersects(a.buffered, b.buffered)) continue;
      if (conflicts.length >= maxAlerts) {
        conflictsTruncated = true;
        break eventsLoop;
      }
      const actual = intersects(a.range, b.range);
      conflicts.push({
        first_id: a.item.id,
        second_id: b.item.id,
        kind: !actual
          ? "buffer_warning"
          : a.timed &&
              b.timed &&
              a.item.attendance === "confirmed" &&
              b.item.attendance === "confirmed"
            ? "confirmed_overlap"
            : "potential_overlap",
      });
    }
  const deadlineClusters: AgendaAlert[] = [];
  let deadlinesTruncated = false;
  deadlinesLoop: for (let i = 0; i < deadlines.length; i++)
    for (let j = i + 1; j < deadlines.length; j++) {
      const a = deadlines[i],
        b = deadlines[j];
      if (b.range.start - a.range.end >= DEADLINE_WINDOW) break;
      const gap =
        b.range.start >= a.range.end ? b.range.start - a.range.end + 1n : 0n;
      if (gap > DEADLINE_WINDOW) continue;
      if (deadlineClusters.length >= maxAlerts) {
        deadlinesTruncated = true;
        break deadlinesLoop;
      }
      deadlineClusters.push({
        first_id: a.item.id,
        second_id: b.item.id,
        kind:
          a.timed && b.timed
            ? "deadline_cluster"
            : "potential_deadline_cluster",
      });
    }
  const cache = options.busyCache;
  let cacheState = externalState(
    cache,
    { start: window.start - before - after, end: window.end + before + after },
    nowInstant.epochNanoseconds,
  );
  const externalConflicts: ExternalAlert[] = [];
  let externalTruncated = false;
  let invalidBusy = 0;
  if (cache && cacheState !== "not_connected" && cacheState !== "error") {
    const selected = new Set(
      cache.selected_calendar_ids.filter((id) => id !== cache.app_calendar_id),
    );
    const busySeen = new Set<string>();
    const busy: { calendar_id: string; range: Range; buffered: Range }[] = [];
    for (const row of cache.intervals) {
      if (
        !selected.has(row.calendar_id) ||
        row.calendar_id === cache.app_calendar_id
      )
        continue;
      try {
        const range = {
          start: instant(row.start_at),
          end: instant(row.end_at),
        };
        if (range.end <= range.start) throw new Error("Invalid busy range");
        const key = row.calendar_id + ":" + range.start + ":" + range.end;
        if (busySeen.has(key)) continue;
        busySeen.add(key);
        const buffered = {
          start: range.start - before,
          end: range.end + after,
        };
        if (intersects(buffered, window))
          busy.push({ calendar_id: row.calendar_id, range, buffered });
      } catch {
        invalidBusy++;
      }
    }
    if (invalidBusy) cacheState = "partial";
    externalLoop: for (const e of events)
      for (const row of busy) {
        if (!intersects(e.buffered, row.buffered)) continue;
        if (externalConflicts.length >= maxAlerts) {
          externalTruncated = true;
          break externalLoop;
        }
        externalConflicts.push({
          milestone_id: e.item.id,
          calendar_id: row.calendar_id,
          certainty:
            cacheState === "fresh" &&
            e.timed &&
            e.item.attendance === "confirmed" &&
            intersects(e.range, row.range)
              ? "confirmed"
              : "potential",
        });
      }
  }
  const internalComplete =
    !options.sourceTruncated &&
    !invalidIds.length &&
    !conflictsTruncated &&
    !deadlinesTruncated;
  return {
    schema_version: 1,
    checked_at: now,
    timezone,
    window_start_date: startDate,
    window_end_date_exclusive: endDate,
    coverage_start: Temporal.Instant.fromEpochNanoseconds(
      window.start,
    ).toString(),
    coverage_end: Temporal.Instant.fromEpochNanoseconds(window.end).toString(),
    buffer_before: query.buffer_before,
    buffer_after: query.buffer_after,
    loaded_count: items.length,
    items: ordered(entries).map((e) => e.item),
    conflicts,
    deadline_clusters: deadlineClusters,
    external_conflicts: externalConflicts,
    internal_data_complete: internalComplete,
    source_truncated: !!options.sourceTruncated,
    alerts_truncated:
      conflictsTruncated || deadlinesTruncated || externalTruncated,
    invalid_milestone_ids: invalidIds,
    external: {
      state: cacheState,
      checked_at: cache?.checked_at ?? null,
      coverage_start: cache?.coverage_start ?? null,
      coverage_end: cache?.coverage_end ?? null,
    },
    partial: !internalComplete || cacheState !== "fresh" || externalTruncated,
    limitations: [
      "recurrence_not_supported",
      "cancellation_state_not_supported",
    ],
  };
}
export type AgendaReport = ReturnType<typeof analyseAgenda>;

import type { Milestone } from "./domain";

export const AGENDA_PAGE_SIZE = 500;
export const AGENDA_ROW_LIMIT = 10_000;
const REQUEST_LIMIT = 100;
export type SourceIssue =
  | "row_limit"
  | "request_limit"
  | "count_unavailable"
  | "count_changed"
  | "count_mismatch"
  | "non_advancing_page";
export type MilestonePage = { rows: Milestone[]; count: number | null };
export type MilestoneReader = (input: {
  after?: string;
  limit: number;
  count: boolean;
}) => Promise<MilestonePage>;

// Keyset reads avoid offset shifts. Counts detect changed cardinality, not every
// concurrent edit: this is explicitly a sequential read, not a DB snapshot.
export async function readAgendaSource(
  read: MilestoneReader,
  finalCount: () => Promise<number | null>,
) {
  const rows: Milestone[] = [];
  const issues = new Set<SourceIssue>();
  let totalStart: number | null = null;
  let after: string | undefined;
  let pages = 0;
  let exhausted = false;
  while (pages < REQUEST_LIMIT) {
    // A one-row probe distinguishes exactly the limit from an omitted tail.
    const limit =
      Math.min(AGENDA_PAGE_SIZE, AGENDA_ROW_LIMIT - rows.length) || 1;
    const page = await read({ after, limit, count: pages === 0 });
    if (pages++ === 0) totalStart = page.count;
    if (page.rows.length > limit) throw new Error("Invalid source page size");
    let previous = after;
    for (const row of page.rows) {
      if (!row.id || (previous !== undefined && row.id <= previous)) {
        issues.add("non_advancing_page");
        break;
      }
      previous = row.id;
    }
    if (issues.has("non_advancing_page")) break;
    if (!page.rows.length) {
      exhausted = true;
      break;
    }
    if (rows.length === AGENDA_ROW_LIMIT) {
      issues.add("row_limit");
      break;
    }
    rows.push(...page.rows);
    after = previous;
    // Never infer exhaustion from a short page: the provider can clamp limits.
  }
  if (!exhausted && pages === REQUEST_LIMIT && !issues.size)
    issues.add("request_limit");
  const totalEnd = await finalCount();
  if (totalStart === null || totalEnd === null) issues.add("count_unavailable");
  if (totalStart !== null && totalEnd !== null && totalStart !== totalEnd)
    issues.add("count_changed");
  if (
    (totalStart !== null && rows.length !== totalStart) ||
    (totalEnd !== null && rows.length !== totalEnd)
  )
    issues.add("count_mismatch");
  return {
    rows,
    source: {
      mode: "sequential" as const,
      page_count: pages,
      row_limit: AGENDA_ROW_LIMIT,
      total_at_start: totalStart,
      total_at_end: totalEnd,
      exhausted,
      complete: exhausted && !issues.size,
      issues: [...issues],
    },
  };
}

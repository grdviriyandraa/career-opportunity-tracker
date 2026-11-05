import { z } from "zod";
import { canonicalUrl, categories, dateSchema, publicUrl } from "./domain";
const count = z.number().int().min(0).max(1000000);
const iana = z
  .string()
  .max(100)
  .refine((v) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: v });
      return true;
    } catch {
      return false;
    }
  }, "Zona IANA tidak valid.");
export const classifications = [
  "confirmed",
  "conditional",
  "pending",
  "ineligible",
  "closed",
] as const;
export const classificationLabels: Record<string, string> = {
  confirmed: "Memenuhi terverifikasi",
  conditional: "Bersyarat",
  pending: "Perlu verifikasi",
  ineligible: "Tidak memenuhi",
  closed: "Ditutup / kedaluwarsa",
};
const itemSchema = z.strictObject({
  external_id: z.string().trim().min(1).max(200),
  action: z.enum(["new", "enriched"]),
  category: z.enum(categories).nullable().default(null),
  title: z.string().trim().min(1).max(300).optional(),
  organization: z.string().trim().max(300).nullable().optional(),
  classification: z.enum(classifications),
  source_url: publicUrl,
  source_checked_at: z.iso.datetime({ offset: true }),
  first_seen_at: dateSchema.nullable().default(null),
  published_at: dateSchema.nullable().optional(),
  official_deadline: dateSchema.nullable().optional(),
  raw_posting_status: z.string().max(200).nullable().optional(),
});
export const researchBatchSchema = z
  .strictObject({
    schema_version: z.literal(1),
    source_system: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/),
    run_id: z.string().trim().min(1).max(200),
    source_as_of: z.iso.datetime({ offset: true }),
    source_timezone: iana,
    inventory_total: count,
    reported_new: count.nullable().default(null),
    reported_enriched: count.nullable().default(null),
    high_priority_active: count.nullable().default(null),
    snapshot: z.strictObject({
      confirmed: count,
      conditional: count,
      pending: count,
      ineligible: count,
      closed: count,
    }),
    coverage: z.string().max(2000).nullable().default(null),
    limitations: z.array(z.string().max(1000)).max(20).nullable().default(null),
    items: z.array(itemSchema).max(1000),
  })
  .superRefine((v, ctx) => {
    if (new Set(v.items.map((i) => i.external_id)).size !== v.items.length)
      ctx.addIssue({
        code: "custom",
        message: "External ID ganda dalam satu run.",
      });
    if (
      Object.values(v.snapshot).reduce((a, b) => a + b, 0) !== v.inventory_total
    )
      ctx.addIssue({
        code: "custom",
        message: "Total klasifikasi tidak cocok dengan inventaris.",
      });
    if (
      v.high_priority_active !== null &&
      v.high_priority_active > v.inventory_total
    )
      ctx.addIssue({
        code: "custom",
        message: "High Priority melebihi inventaris.",
      });
    let sourceDay: string | undefined;
    try {
      sourceDay = new Intl.DateTimeFormat("en-CA", {
        timeZone: v.source_timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(v.source_as_of));
    } catch {
      /* Invalid field already has a schema issue. */
    }
    for (const item of v.items) {
      if (item.first_seen_at && sourceDay && item.first_seen_at > sourceDay)
        ctx.addIssue({
          code: "custom",
          message: "Tanggal pertama ditemukan melewati waktu run.",
        });
      if (Date.parse(item.source_checked_at) > Date.parse(v.source_as_of))
        ctx.addIssue({
          code: "custom",
          message: "Waktu pemeriksaan melewati waktu run.",
        });
    }
  });
export type ResearchBatch = z.infer<typeof researchBatchSchema>;
export function normalizeResearchBatch(input: unknown) {
  const parsed = researchBatchSchema.parse(input);
  return {
    ...parsed,
    items: parsed.items
      .map((i) => ({ ...i, canonical_url: canonicalUrl(i.source_url) }))
      .sort((a, b) =>
        a.external_id < b.external_id
          ? -1
          : a.external_id > b.external_id
            ? 1
            : 0,
      ),
  };
}
export type ResearchSnapshot = Record<(typeof classifications)[number], number>;
export type ResearchRun = {
  id: string;
  source_system: string;
  run_id: string;
  source_as_of: string;
  source_timezone: string;
  imported_at: string;
  inventory_total: number;
  sources_checked: number;
  new_count: number;
  enriched_count: number;
  carry_forward: number;
  reported_new: number | null;
  reported_enriched: number | null;
  high_priority_active: number | null;
  snapshot: ResearchSnapshot;
  coverage: string | null;
  limitations: string[] | null;
  payload_hash: string;
};
export type ResearchItem = {
  id: string;
  research_run_id: string;
  opportunity_id: string;
  external_id: string;
  action: "new" | "enriched" | "carry_forward";
  checked_at: string | null;
  last_source_checked_at: string | null;
  first_seen_at: string | null;
  public_snapshot: {
    title?: string;
    organization?: string | null;
    classification: string;
    source_url: string;
    published_at?: string | null;
    official_deadline?: string | null;
    raw_posting_status?: string | null;
  };
};
export type ResearchResult = {
  status: "preview" | "applied" | "replay" | "correction_required";
  preview_id?: string;
  payload_hash?: string;
  run_id?: string;
  research_run_id?: string;
  correction_id?: string;
  inventory_total?: number;
  sources_checked?: number;
  new_count?: number;
  enriched_count?: number;
  carry_forward?: number;
  snapshot?: ResearchSnapshot;
  domain_created?: number;
  public_proposals?: number;
};

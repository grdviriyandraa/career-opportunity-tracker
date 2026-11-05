import { z } from "zod";
const text = (max: number) =>
  z
    .string()
    .max(max)
    .refine((s) => s.isWellFormed());
const nonempty = (max: number) => text(max).refine((s) => s.trim().length > 0);
export const category = z.enum(["job", "bootcamp", "competition"]);
const stage = z.enum([
  "saved",
  "preparing",
  "applied",
  "interview",
  "accepted",
  "rejected",
  "withdrawn",
]);
const sourceUrl = text(2048).refine((value) => {
  try {
    const u = new URL(value);
    return (
      ["http:", "https:"].includes(u.protocol) && !u.username && !u.password
    );
  } catch {
    return false;
  }
});
export const inputs = {
  search_opportunities: z.strictObject({
    query: text(200).optional(),
    category: category.optional(),
    stage: stage.optional(),
    arrangement: z.enum(["remote", "hybrid", "onsite", "unknown"]).optional(),
    max_employer_hours: z.number().min(0).max(168).optional(),
    include_unknown_hours: z.boolean().optional(),
    cursor: nonempty(1024).optional(),
    limit: z.number().int().min(1).max(20).optional(),
  }),
  get_opportunity: z.strictObject({ opportunity_id: z.uuid() }),
  get_upcoming_deadlines: z
    .strictObject({
      start_date: z.iso.date(),
      end_date: z.iso.date(),
      category: category.optional(),
      cursor: nonempty(1024).optional(),
      limit: z.number().int().min(1).max(50).optional(),
    })
    .refine((v) => {
      const days =
        (Date.parse(v.end_date) - Date.parse(v.start_date)) / 86400000;
      return days >= 0 && days <= 30;
    }),
  create_draft: z
    .strictObject({
      source_url: sourceUrl.optional(),
      source_text: nonempty(20000).optional(),
      title: nonempty(300).optional(),
      category: category.optional(),
    })
    .refine((v) => !!(v.source_url || v.source_text || v.title)),
};
export type ToolName = keyof typeof inputs;
export const descriptions: Record<ToolName, string> = {
  search_opportunities:
    "Cari peluang tersimpan. Hasil berhalaman; jam unknown tetap unknown.",
  get_opportunity:
    "Baca satu peluang tersimpan dengan ID yang diberikan tracker.",
  get_upcoming_deadlines:
    "Baca tenggat dalam rentang tanggal inklusif maksimal 31 hari. Bukan pemeriksaan kalender kosong.",
  create_draft:
    "Simpan draf ke Inbox hanya setelah pengguna jelas meminta menyimpan. Tidak melamar atau mengubah progres.",
};
const id = z.uuid();
const evidence = z.object({
  source_url: sourceUrl,
  source_checked_at: z.iso.datetime({ offset: true }).nullable(),
});
const opportunity = z.object({
  id,
  category: category.nullable(),
  title: text(300).nullable(),
  organization: text(500).nullable(),
  personal_stage: stage,
  posting_status: z.enum(["unknown", "open", "closed", "expired"]),
  eligibility: text(64),
  employer_hours: z.number().min(0).max(168).nullable(),
  arrangement: text(64).nullable().optional(),
  remote_eligibility: text(500).nullable().optional(),
  revision: z.number().int().positive(),
  app_url: z.url().max(2048),
  evidence: z.array(evidence).max(10).optional(),
  requirements: text(2000).nullable().optional(),
  compensation: text(1000).nullable().optional(),
});
const deadline = z
  .object({
    id,
    opportunity_id: id,
    title: text(300),
    precision: z.enum(["date", "instant"]),
    date: z.iso.date().nullable(),
    start_at: z.iso.datetime({ offset: true }).nullable(),
    timezone: text(100),
    revision: z.number().int().positive(),
    app_url: z.url().max(2048),
  })
  .refine((v) =>
    v.precision === "date"
      ? !!v.date && v.start_at === null
      : v.date === null && !!v.start_at,
  );
const envelope = {
  schema_version: z.literal(1),
  request_id: z.string().regex(/^[A-Za-z0-9_-]{1,120}$/),
  data_as_of: z.iso.datetime(),
  timezone: text(100),
  next_cursor: text(1024).nullable(),
  warnings: z.array(text(500)).max(30),
  partial: z.boolean(),
};
export const outputs = {
  search_opportunities: z.object({
    ...envelope,
    items: z.array(opportunity).max(20),
  }),
  get_opportunity: z.object({ ...envelope, item: opportunity }),
  get_upcoming_deadlines: z.object({
    ...envelope,
    items: z.array(deadline).max(50),
  }),
  create_draft: z.object({
    outcome: z.enum(["created", "existing", "review_required"]),
    opportunity_id: id,
    revision: z.number().int().positive(),
    saved_at: z.iso.datetime({ offset: true }),
    app_url: z.url().max(2048),
    extraction_status: text(64),
  }),
};

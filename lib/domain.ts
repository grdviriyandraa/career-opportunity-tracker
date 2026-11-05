import { z } from "zod";
export const categories = ["job", "bootcamp", "competition"] as const;
export const stages = [
  "saved",
  "preparing",
  "applied",
  "interview",
  "accepted",
  "rejected",
  "withdrawn",
] as const;
export const stageLabels: Record<string, string> = {
  saved: "Disimpan",
  preparing: "Persiapan",
  applied: "Sudah melamar / mendaftar",
  interview: "Wawancara / seleksi",
  accepted: "Diterima",
  rejected: "Tidak lolos",
  withdrawn: "Mengundurkan diri",
};
export const categoryLabels: Record<string, string> = {
  job: "Jobs",
  bootcamp: "Bootcamps",
  competition: "Competitions",
};
const text = z.string().trim().min(1);
export const publicUrl = z
  .url()
  .max(2048)
  .refine((v) => {
    let u: URL;
    try {
      u = new URL(v);
    } catch {
      return false;
    }
    return (
      ["http:", "https:"].includes(u.protocol) && !u.username && !u.password
    );
  }, "Gunakan URL HTTP/HTTPS tanpa credential.");
export function canonicalUrl(value: string) {
  const u = new URL(publicUrl.parse(value));
  u.hash = "";
  for (const key of [...u.searchParams.keys()])
    if (
      /^utm_/i.test(key) ||
      ["fbclid", "gclid", "msclkid"].includes(key.toLowerCase())
    )
      u.searchParams.delete(key);
  u.searchParams.sort();
  return u.toString();
}
export const captureSchema = z
  .strictObject({
    source_url: publicUrl.optional(),
    source_text: text.max(20000).optional(),
    title: text.max(300).optional(),
    category: z.enum(categories).optional(),
  })
  .refine((v) => v.source_url || v.source_text || v.title, {
    message: "Isi judul, link, atau teks sumber.",
  });
export const dateSchema = z.iso.date();
export const updateSchema = z
  .strictObject({
    expected_revision: z.number().int().positive(),
    title: text.max(300).optional(),
    category: z.enum(categories).nullable().optional(),
    organization: z.string().trim().max(300).nullable().optional(),
    personal_stage: z.enum(stages).optional(),
    posting_status: z.enum(["unknown", "open", "closed", "expired"]).optional(),
    eligibility: z
      .enum(["unknown", "pending", "eligible", "conditional", "ineligible"])
      .optional(),
    notes: z.string().max(20000).optional(),
    employer_hours: z.number().min(0).max(168).nullable().optional(),
    archived: z.boolean().optional(),
    actual_date: dateSchema.optional(),
  })
  .superRefine((v, ctx) => {
    if (v.personal_stage === "applied" && !v.actual_date)
      ctx.addIssue({
        code: "custom",
        message: "Konfirmasi tanggal tindakan aktual.",
        path: ["actual_date"],
      });
  });
export const milestoneSchema = z
  .strictObject({
    expected_revision: z.number().int().positive(),
    title: text.max(300),
    kind: z.enum(["deadline", "event"]),
    precision: z.enum(["date", "instant"]),
    date: dateSchema.optional(),
    start_at: z.iso.datetime({ offset: true }).optional(),
    end_at: z.iso.datetime({ offset: true }).optional(),
    timezone: text.refine((v) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: v });
        return true;
      } catch {
        return false;
      }
    }, "Zona waktu IANA tidak valid."),
    attendance: z
      .enum(["confirmed", "conditional", "unknown"])
      .default("unknown"),
  })
  .superRefine((v, ctx) => {
    if (v.precision === "date" && (!v.date || v.start_at || v.end_at))
      ctx.addIssue({
        code: "custom",
        message: "Tanggal saja tidak memiliki jam.",
      });
    if (
      v.precision === "instant" &&
      (!v.start_at ||
        v.date ||
        (v.kind === "event" &&
          (!v.end_at || Date.parse(v.end_at) <= Date.parse(v.start_at))))
    )
      ctx.addIssue({
        code: "custom",
        message: "Isi interval waktu yang valid.",
      });
    if (v.kind === "deadline" && v.end_at)
      ctx.addIssue({
        code: "custom",
        message: "Deadline adalah satu waktu, bukan durasi.",
      });
  });
export type Opportunity = {
  id: string;
  category: (typeof categories)[number] | null;
  title: string | null;
  organization: string | null;
  source_url: string | null;
  source_text: string | null;
  personal_stage: string;
  posting_status: string;
  eligibility: string;
  notes: string;
  employer_hours: number | null;
  archived_at: string | null;
  actual_date: string | null;
  revision: number;
  created_at: string;
  updated_at: string;
};
export type Milestone = {
  id: string;
  opportunity_id: string;
  title: string;
  kind: "deadline" | "event";
  precision: "date" | "instant";
  date: string | null;
  start_at: string | null;
  end_at: string | null;
  timezone: string;
  attendance: string;
};
export function overlaps(
  a: { start_at: string; end_at: string },
  b: { start_at: string; end_at: string },
  bufferMinutes = 0,
) {
  const bms = bufferMinutes * 60000;
  return (
    Date.parse(a.start_at) - bms < Date.parse(b.end_at) + bms &&
    Date.parse(b.start_at) - bms < Date.parse(a.end_at) + bms
  );
}

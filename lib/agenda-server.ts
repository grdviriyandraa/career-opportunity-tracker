import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { agendaQuerySchema, analyseAgenda } from "./agenda";
import { dbError, HttpError } from "./server";
import { readAgendaSource } from "./agenda-source";
export async function loadAgenda(
  db: SupabaseClient<Database>,
  input: Record<string, unknown>,
) {
  const query = agendaQuerySchema.safeParse(input);
  if (!query.success)
    throw new HttpError(
      400,
      "INVALID_INPUT",
      "Rentang atau buffer tidak valid. Gunakan tanggal ISO, 1–180 hari dan buffer 0–120 menit.",
    );
  const now = new Date().toISOString();
  const [loaded, profile] = await Promise.all([
    readAgendaSource(
      async ({ after, limit, count }) => {
        let request = db
          .from("milestones")
          .select("*", count ? { count: "exact" } : {})
          .is("cancelled_at", null)
          .order("id")
          .limit(limit);
        if (after) request = request.gt("id", after);
        const page = await request;
        dbError(page.error);
        return { rows: page.data ?? [], count: page.count };
      },
      async () => {
        const result = await db
          .from("milestones")
          .select("*", { count: "exact", head: true })
          .is("cancelled_at", null);
        dbError(result.error);
        return result.count;
      },
    ),
    db.from("profiles").select("*").maybeSingle(),
  ]);
  dbError(profile.error);
  if (!profile.data)
    throw new HttpError(
      503,
      "OWNER_PROFILE_REQUIRED",
      "Profile owner belum tersedia. Selesaikan provisioning Supabase.",
    );
  const rows = loaded.rows;
  try {
    return {
      ...analyseAgenda(rows, {
        ...query.data,
        timezone: profile.data.timezone,
        now,
        sourceTruncated: loaded.source.issues.some(
          (issue) => issue === "row_limit" || issue === "request_limit",
        ),
        sourceIncomplete: !loaded.source.complete,
      }),
      source_read: loaded.source,
    };
  } catch {
    throw new HttpError(
      503,
      "AGENDA_CONFIGURATION_ERROR",
      "Konfigurasi zona waktu atau jadwal belum valid. Periksa profile dan milestone.",
    );
  }
}

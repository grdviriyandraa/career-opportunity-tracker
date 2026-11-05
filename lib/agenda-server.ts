import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { agendaQuerySchema, analyseAgenda } from "./agenda";
import { dbError, HttpError } from "./server";
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
  const [milestones, profile] = await Promise.all([
    db.from("milestones").select("*").order("id").limit(1000),
    db.from("profiles").select("*").maybeSingle(),
  ]);
  dbError(milestones.error);
  dbError(profile.error);
  if (!profile.data)
    throw new HttpError(
      503,
      "OWNER_PROFILE_REQUIRED",
      "Profile owner belum tersedia. Selesaikan provisioning Supabase.",
    );
  const rows = milestones.data ?? [];
  try {
    return analyseAgenda(rows, {
      ...query.data,
      timezone: profile.data.timezone,
      now,
      sourceTruncated: rows.length >= 1000,
    });
  } catch {
    throw new HttpError(
      503,
      "AGENDA_CONFIGURATION_ERROR",
      "Konfigurasi zona waktu atau jadwal belum valid. Periksa profile dan milestone.",
    );
  }
}

import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { configuration } from "./config";
import type { Database } from "./database.types";
export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export async function supabase() {
  const c = configuration();
  if (!c)
    throw new HttpError(
      503,
      "SETUP_REQUIRED",
      "Konfigurasi Supabase dan owner belum lengkap.",
    );
  const jar = await cookies();
  return createServerClient<Database>(
    c.NEXT_PUBLIC_SUPABASE_URL,
    c.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (values) => {
          try {
            for (const v of values)
              jar.set(v.name, v.value, {
                ...v.options,
                httpOnly: true,
                sameSite: "lax",
                secure: new URL(c.APP_URL).protocol === "https:",
              });
          } catch {
            /* Server Components cannot refresh cookies; API handlers can. */
          }
        },
      },
    },
  );
}
export async function owner() {
  const c = configuration();
  const db = await supabase();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user)
    throw new HttpError(401, "LOGIN_REQUIRED", "Silakan masuk kembali.");
  if (user.id !== c!.OWNER_AUTH_USER_ID)
    throw new HttpError(403, "OWNER_ONLY", "Akses hanya untuk owner.");
  return { db, user };
}
export function checkOrigin(req: Request) {
  const c = configuration();
  if (!c)
    throw new HttpError(
      503,
      "SETUP_REQUIRED",
      "Selesaikan konfigurasi dahulu.",
    );
  if (req.headers.get("origin") !== new URL(c.APP_URL).origin)
    throw new HttpError(403, "ORIGIN_DENIED", "Origin tidak diizinkan.");
}
export async function body(req: Request, maxBytes = 65536) {
  const reader = req.body?.getReader();
  if (!reader) throw new HttpError(400, "INVALID_INPUT", "Body JSON wajib.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new HttpError(
        413,
        "BODY_TOO_LARGE",
        "Ukuran payload melebihi batas.",
      );
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "INVALID_JSON", "JSON tidak valid.");
  }
}
export function dbError(error: { code?: string; message?: string } | null) {
  if (!error) return;
  if (error.code === "40001" || error.code === "23505")
    throw new HttpError(
      409,
      "REVISION_CONFLICT",
      "Data berubah. Muat ulang dan tinjau perubahan sebelum menyimpan.",
    );
  if (
    error.code &&
    ["22023", "22007", "22008", "22P02", "23514"].includes(error.code)
  )
    throw new HttpError(
      400,
      "INVALID_INPUT",
      "Data riset tidak valid atau belum cocok dengan inventaris. Periksa format, identitas dan total snapshot.",
    );
  if (error.code === "42501")
    throw new HttpError(403, "FORBIDDEN", "Akses ditolak.");
  if (error.code === "P0002")
    throw new HttpError(404, "NOT_FOUND", "Peluang tidak ditemukan.");
  throw new HttpError(
    503,
    "DATABASE_UNAVAILABLE",
    "Database belum siap atau sementara tidak tersedia.",
  );
}
export async function respond(fn: () => Promise<Response>) {
  try {
    return await fn();
  } catch (e) {
    const id = crypto.randomUUID();
    if (e instanceof HttpError)
      return Response.json(
        {
          code: e.code,
          message: e.message,
          correlation_id: id,
          retryable: e.status >= 500,
        },
        { status: e.status },
      );
    return Response.json(
      {
        code: "INTERNAL_ERROR",
        message: "Permintaan gagal. Coba lagi.",
        correlation_id: id,
        retryable: true,
      },
      { status: 500 },
    );
  }
}

import { z } from "zod";
import { configuration } from "@/lib/config";
import { body, checkOrigin, HttpError, respond, supabase } from "@/lib/server";
export async function POST(
  req: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  return respond(async () => {
    checkOrigin(req);
    const c = configuration()!;
    const db = await supabase();
    const { action } = await params;
    if (action === "logout") {
      const { error } = await db.auth.signOut({ scope: "local" });
      if (error)
        throw new HttpError(
          503,
          "LOGOUT_UNAVAILABLE",
          "Sesi belum dapat diakhiri. Coba kembali.",
        );
      return Response.json({ ok: true });
    }
    const input = z
      .strictObject({
        email: z.email(),
        token: z
          .string()
          .regex(/^\d{6,10}$/)
          .optional(),
      })
      .safeParse(await body(req));
    if (!input.success)
      throw new HttpError(400, "INVALID_INPUT", "Email atau kode tidak valid.");
    if (input.data.email.toLowerCase() !== c.OWNER_EMAIL.toLowerCase())
      throw new HttpError(403, "OWNER_ONLY", "Email tidak diizinkan.");
    if (action === "login") {
      const { error } = await db.auth.signInWithOtp({
        email: c.OWNER_EMAIL,
        options: { shouldCreateUser: false },
      });
      if (error)
        throw new HttpError(
          429,
          "AUTH_UNAVAILABLE",
          "Kode belum dapat dikirim. Tunggu sebentar lalu coba kembali.",
        );
      return Response.json({ ok: true });
    }
    if (action === "verify" && input.data.token) {
      const { data, error } = await db.auth.verifyOtp({
        email: c.OWNER_EMAIL,
        token: input.data.token,
        type: "email",
      });
      if (error || data.user?.id !== c.OWNER_AUTH_USER_ID) {
        await db.auth.signOut({ scope: "local" });
        throw new HttpError(
          401,
          "INVALID_CODE",
          "Kode tidak valid atau kedaluwarsa.",
        );
      }
      return Response.json({ ok: true });
    }
    throw new HttpError(404, "NOT_FOUND", "Endpoint tidak tersedia.");
  });
}

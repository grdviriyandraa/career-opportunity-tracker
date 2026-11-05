import { z } from "zod";
import { canonicalUrl, captureSchema } from "@/lib/domain";
import {
  body,
  checkOrigin,
  dbError,
  HttpError,
  owner,
  respond,
} from "@/lib/server";
export async function POST(req: Request) {
  return respond(async () => {
    checkOrigin(req);
    const { db } = await owner();
    const payload = captureSchema.safeParse(await body(req));
    const key = z.uuid().safeParse(req.headers.get("Idempotency-Key"));
    if (!payload.success || !key.success)
      throw new HttpError(
        400,
        "INVALID_INPUT",
        payload.success
          ? "Idempotency-Key UUID wajib."
          : payload.error.issues[0].message,
      );
    const { data, error } = await db.rpc("capture_draft", {
      p_payload: payload.data,
      p_key: key.data,
      p_canonical: payload.data.source_url
        ? canonicalUrl(payload.data.source_url)
        : null,
    });
    dbError(error);
    if (!data)
      throw new HttpError(
        503,
        "DATABASE_UNAVAILABLE",
        "Receipt belum tersedia.",
      );
    return Response.json(data, {
      status: data.outcome === "created" ? 201 : 200,
    });
  });
}

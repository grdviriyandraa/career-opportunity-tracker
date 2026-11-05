import { normalizeResearchBatch, researchBatchSchema } from "@/lib/research";
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
    const payload = researchBatchSchema.safeParse(await body(req, 524288));
    if (!payload.success)
      throw new HttpError(
        400,
        "INVALID_INPUT",
        payload.error.issues[0].message,
      );
    const { data, error } = await db.rpc("prepare_research", {
      p_batch: normalizeResearchBatch(payload.data),
    });
    dbError(error);
    if (!data)
      throw new HttpError(
        503,
        "DATABASE_UNAVAILABLE",
        "Preview belum tersedia.",
      );
    return Response.json(data, {
      status: data.status === "correction_required" ? 202 : 200,
      headers: { "Cache-Control": "no-store" },
    });
  });
}

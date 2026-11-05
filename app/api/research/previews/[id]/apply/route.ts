import { z } from "zod";
import {
  body,
  checkOrigin,
  dbError,
  HttpError,
  owner,
  respond,
} from "@/lib/server";
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return respond(async () => {
    checkOrigin(req);
    const { db } = await owner();
    const id = z.uuid().safeParse((await params).id);
    const payload = z
      .strictObject({ payload_hash: z.string().regex(/^[0-9a-f]{64}$/) })
      .safeParse(await body(req));
    if (!id.success || !payload.success)
      throw new HttpError(
        400,
        "INVALID_INPUT",
        "Preview atau hash tidak valid.",
      );
    const { data, error } = await db.rpc("apply_research", {
      p_preview: id.data,
      p_hash: payload.data.payload_hash,
    });
    dbError(error);
    return Response.json(data, { headers: { "Cache-Control": "no-store" } });
  });
}

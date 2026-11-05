import { z } from "zod";
import { milestoneUpdateSchema } from "@/lib/domain";
import {
  body,
  checkOrigin,
  dbError,
  HttpError,
  owner,
  respond,
} from "@/lib/server";
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; milestoneId: string }> },
) {
  return respond(async () => {
    checkOrigin(req);
    const { db } = await owner();
    const ids = z
      .object({ id: z.uuid(), milestoneId: z.uuid() })
      .safeParse(await params);
    const payload = milestoneUpdateSchema.safeParse(await body(req));
    if (!ids.success || !payload.success)
      throw new HttpError(
        400,
        "INVALID_INPUT",
        "ID atau perubahan milestone tidak valid. Gunakan tanggal tanpa jam atau ISO dengan offset.",
      );
    const { data, error } = await db.rpc("update_milestone", {
      p_id: ids.data.id,
      p_milestone: ids.data.milestoneId,
      p_patch: payload.data,
    });
    dbError(error);
    return Response.json(data, {
      headers: { "Cache-Control": "private, no-store" },
    });
  });
}

import { z } from "zod";
import { updateSchema } from "@/lib/domain";
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
  { params }: { params: Promise<{ id: string }> },
) {
  return respond(async () => {
    checkOrigin(req);
    const { db } = await owner();
    const id = z.uuid().safeParse((await params).id);
    const patch = updateSchema.safeParse(await body(req));
    if (!id.success || !patch.success)
      throw new HttpError(
        400,
        "INVALID_INPUT",
        patch.success ? "ID tidak valid." : patch.error.issues[0].message,
      );
    const { data, error } = await db.rpc("update_opportunity", {
      p_id: id.data,
      p_patch: patch.data,
    });
    dbError(error);
    return Response.json(data);
  });
}

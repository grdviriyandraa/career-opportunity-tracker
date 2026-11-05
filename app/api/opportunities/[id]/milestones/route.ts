import { z } from "zod";
import { milestoneSchema } from "@/lib/domain";
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
    const payload = milestoneSchema.safeParse(await body(req));
    if (!id.success || !payload.success)
      throw new HttpError(
        400,
        "INVALID_INPUT",
        payload.success ? "ID tidak valid." : payload.error.issues[0].message,
      );
    const { data, error } = await db.rpc("add_milestone", {
      p_id: id.data,
      p_payload: payload.data,
    });
    dbError(error);
    return Response.json(data, { status: 201 });
  });
}

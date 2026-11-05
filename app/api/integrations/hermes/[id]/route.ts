import { z } from "zod";
import { checkOrigin, dbError, HttpError, owner, respond } from "@/lib/server";
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const response = await respond(async () => {
    checkOrigin(req);
    const { db } = await owner();
    const id = z.uuid().safeParse((await params).id);
    if (!id.success)
      throw new HttpError(400, "INVALID_INPUT", "ID credential tidak valid.");
    const { data, error } = await db.rpc("revoke_agent_grant", {
      p_id: id.data,
    });
    dbError(error);
    return Response.json({ ok: data });
  });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

import { z } from "zod";
import {
  body,
  checkOrigin,
  dbError,
  HttpError,
  owner,
  respond,
} from "@/lib/server";
const schema = z
  .strictObject({
    expected_revision: z.number().int().positive(),
    action: z.enum(["accept", "dismiss"]),
    fields: z
      .array(z.enum(["title", "organization", "eligibility", "posting_status"]))
      .max(4),
  })
  .refine(
    (v) =>
      new Set(v.fields).size === v.fields.length &&
      (v.action === "accept" ? v.fields.length > 0 : v.fields.length === 0),
    "Pilih field publik yang valid.",
  );
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return respond(async () => {
    checkOrigin(req);
    const { db } = await owner();
    const id = z.uuid().safeParse((await params).id);
    const payload = schema.safeParse(await body(req));
    if (!id.success || !payload.success)
      throw new HttpError(400, "INVALID_INPUT", "Review usulan tidak valid.");
    const { data, error } = await db.rpc("resolve_research_proposal", {
      p_id: id.data,
      p_expected: payload.data.expected_revision,
      p_action: payload.data.action,
      p_fields: payload.data.fields,
    });
    dbError(error);
    return Response.json(data);
  });
}

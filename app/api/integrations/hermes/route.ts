import { randomBytes } from "node:crypto";
import { grantInput } from "@/lib/agent-protocol";
import {
  body,
  checkOrigin,
  dbError,
  HttpError,
  owner,
  respond,
} from "@/lib/server";
export async function GET() {
  const response = await respond(async () => {
    const { db } = await owner();
    const { data, error } = await db.rpc("list_agent_grants");
    dbError(error);
    return Response.json({ items: data });
  });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export async function POST(req: Request) {
  const response = await respond(async () => {
    checkOrigin(req);
    const { db } = await owner();
    const parsed = grantInput.safeParse(await body(req));
    if (!parsed.success)
      throw new HttpError(
        400,
        "INVALID_INPUT",
        "Periksa label, scope dan masa berlaku 1–30 hari.",
      );
    let token: string;
    do {
      token = randomBytes(32).toString("base64url");
    } while (token.startsWith("sb_"));
    const { data, error } = await db.rpc("mint_agent_grant", {
      p_token: token,
      p_label: parsed.data.label,
      p_scopes: parsed.data.scopes,
      p_days: parsed.data.expires_in_days,
    });
    dbError(error);
    return Response.json({ item: data, token }, { status: 201 });
  });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

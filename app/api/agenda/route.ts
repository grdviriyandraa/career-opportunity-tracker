import { loadAgenda } from "@/lib/agenda-server";
import { owner, respond, HttpError } from "@/lib/server";
export async function GET(req: Request) {
  return respond(async () => {
    const { db } = await owner();
    const params = new URL(req.url).searchParams;
    if ([...new Set(params.keys())].some((k) => params.getAll(k).length > 1))
      throw new HttpError(
        400,
        "INVALID_INPUT",
        "Parameter tidak boleh berulang.",
      );
    const report = await loadAgenda(db, Object.fromEntries(params));
    return Response.json(report, {
      headers: { "Cache-Control": "private, no-store" },
    });
  });
}

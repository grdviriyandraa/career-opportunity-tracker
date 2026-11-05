import { owner, respond, dbError } from "@/lib/server";
export async function GET() {
  return respond(async () => {
    const { db } = await owner();
    const { data, error } = await db
      .from("opportunities")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    dbError(error);
    const items = data ?? [];
    return Response.json(
      {
        items,
        partial: items.length === 50,
        warnings:
          items.length === 50
            ? [
                "Hasil dibatasi 50 item. Gunakan halaman website untuk pencarian.",
              ]
            : [],
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  });
}

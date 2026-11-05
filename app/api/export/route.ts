import { loadOwnerExport } from "@/lib/owner-export-server";
import { ExportError } from "@/lib/owner-export";
import { checkOrigin, HttpError, owner, respond } from "@/lib/server";

export async function POST(req: Request) {
  const response = await respond(async () => {
    checkOrigin(req);
    const { db, user } = await owner();
    let json: string;
    try {
      json = await loadOwnerExport(db, user.id);
    } catch (error) {
      if (!(error instanceof ExportError)) throw error;
      throw new HttpError(
        error.code === "EXPORT_LIMIT" ? 413 : 409,
        error.code,
        error.code === "EXPORT_LIMIT"
          ? "Data melebihi batas ekspor. Tidak ada file parsial yang dibuat."
          : "Ekspor belum lengkap atau data berubah. Hentikan pengeditan dan coba lagi.",
      );
    }
    return new Response(json, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="career-tracker-${new Date().toISOString().replace(/[:.]/g, "-")}.json"`,
      },
    });
  });
  // Error responses are private too; no data export is written on the server.
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
}

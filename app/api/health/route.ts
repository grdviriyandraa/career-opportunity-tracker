import { configuration } from "@/lib/config";

export function GET() {
  const configured = configuration() !== null;
  return Response.json(
    {
      status: configured ? "ok" : "setup_required",
      scope: "process_and_configuration_only",
    },
    {
      status: configured ? 200 : 503,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}

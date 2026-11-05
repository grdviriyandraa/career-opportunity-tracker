import { agentResponse } from "@/lib/agent-server";
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return agentResponse(req, "get_opportunity", (await params).id);
}

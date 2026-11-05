import { agentResponse } from "@/lib/agent-server";
export function GET(req: Request) {
  return agentResponse(req, "search_opportunities");
}

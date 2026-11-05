import { agentResponse } from "@/lib/agent-server";
export function POST(req: Request) {
  return agentResponse(req, "create_draft");
}

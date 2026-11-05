import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { BridgeError } from "./config.js";
import { descriptions, inputs, type ToolName } from "./schemas.js";
import type { TrackerClient } from "./client.js";
export function createBridge(client: TrackerClient) {
  const server = new Server(
    { name: "career-tracker", version: "0.1.0" },
    {
      capabilities: { tools: {} },
      instructions:
        "Read/draft-only tracker. No progress/calendar mutations. Save only on explicit user intent. Unknown/partial source data is not a fresh verification.",
    },
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: (Object.keys(inputs) as ToolName[]).map((name) => ({
      name,
      description: descriptions[name],
      inputSchema: z.toJSONSchema(inputs[name], { unrepresentable: "any" }) as {
        type: "object";
      },
      annotations: {
        readOnlyHint: name !== "create_draft",
        destructiveHint: false,
        openWorldHint: false,
      },
    })),
  }));
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (!Object.hasOwn(inputs, request.params.name))
      return {
        content: [
          { type: "text", text: JSON.stringify({ code: "TOOL_NOT_ALLOWED" }) },
        ],
        isError: true,
      };
    try {
      const value = await client.call(
        request.params.name as ToolName,
        request.params.arguments ?? {},
      );
      return { content: [{ type: "text", text: JSON.stringify(value) }] };
    } catch (error) {
      const code =
        error instanceof BridgeError ? error.code : "BRIDGE_UNAVAILABLE";
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              code,
              retryable: error instanceof BridgeError && error.retryable,
              ...(request.params.name === "create_draft"
                ? { capture_status: "unconfirmed" }
                : {}),
            }),
          },
        ],
        isError: true,
      };
    }
  });
  return server;
}

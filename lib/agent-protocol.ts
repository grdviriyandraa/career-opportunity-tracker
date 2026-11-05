import { createHash } from "node:crypto";
import { z } from "zod";
import { inputs } from "../tools/tracker-mcp/schemas";

export {
  agentScopes,
  grantInput,
  grantMetadata,
  type GrantMetadata,
} from "./agent-credentials";

// GET query strings have one explicit conversion boundary; duplicate/unknown keys fail.
export function agentQuery(
  url: URL,
  kind: "search_opportunities" | "get_upcoming_deadlines",
) {
  const raw: Record<string, unknown> = {};
  for (const [key, value] of url.searchParams) {
    if (Object.hasOwn(raw, key)) throw new Error("INVALID_INPUT");
    if (["limit", "max_employer_hours"].includes(key)) {
      if (!/^\d+(\.\d+)?$/.test(value)) throw new Error("INVALID_INPUT");
      raw[key] = Number(value);
    } else if (key === "include_unknown_hours") {
      if (!["true", "false"].includes(value)) throw new Error("INVALID_INPUT");
      raw[key] = value === "true";
    } else raw[key] = value;
  }
  return inputs[kind].parse(raw);
}
const cursorSchema = z.strictObject({
  after: z.uuid(),
  filter: z.string().regex(/^[a-f0-9]{64}$/),
});
export function cursorFilter(kind: string, filter: object) {
  return createHash("sha256")
    .update(JSON.stringify([kind, filter]))
    .digest("hex");
}
export function decodeAgentCursor(cursor: string | undefined, filter: string) {
  if (!cursor) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(cursor)) throw new Error("INVALID_CURSOR");
  const decoded = cursorSchema.parse(
    JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")),
  );
  if (decoded.filter !== filter) throw new Error("INVALID_CURSOR");
  return decoded.after;
}
export function encodeAgentCursor(after: string, filter: string) {
  return Buffer.from(
    JSON.stringify(cursorSchema.parse({ after, filter })),
  ).toString("base64url");
}

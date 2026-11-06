import "server-only";
import { configurationSchema as schema } from "./config-schema";
export function configuration() {
  const result = schema.safeParse(process.env);
  return result.success ? result.data : null;
}
export function setupIssues() {
  const result = schema.safeParse(process.env);
  return result.success
    ? []
    : [...new Set(result.error.issues.map((i) => String(i.path[0])))];
}

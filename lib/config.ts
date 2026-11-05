import "server-only";
import { z } from "zod";
const originUrl = z.url().refine((value) => {
  let u: URL;
  try {
    u = new URL(value);
  } catch {
    return false;
  }
  return (
    ["http:", "https:"].includes(u.protocol) &&
    !u.username &&
    !u.password &&
    u.pathname === "/" &&
    !u.search &&
    !u.hash
  );
}, "Gunakan origin HTTP/HTTPS tanpa path atau credential.");
const schema = z.object({
  APP_URL: originUrl,
  NEXT_PUBLIC_SUPABASE_URL: originUrl,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  OWNER_AUTH_USER_ID: z.uuid(),
  OWNER_EMAIL: z.email(),
});
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

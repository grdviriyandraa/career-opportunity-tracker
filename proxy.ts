import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { configuration } from "./lib/config";
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const cacheHeaders = new Headers({
    "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
    Expires: "0",
    Pragma: "no-cache",
  });
  function privateResponse() {
    cacheHeaders.forEach((value, key) => response.headers.set(key, value));
    return response;
  }
  if (
    request.nextUrl.pathname.startsWith("/api/agent/") ||
    request.nextUrl.pathname === "/api/health"
  )
    return privateResponse();
  const settings = configuration();
  if (!settings) return privateResponse();
  const db = createServerClient(
    settings.NEXT_PUBLIC_SUPABASE_URL,
    settings.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (values, headers) => {
          for (const v of values) request.cookies.set(v.name, v.value);
          const previousCookies = response.cookies.getAll();
          response = NextResponse.next({ request });
          for (const cookie of previousCookies) response.cookies.set(cookie);
          Object.entries(headers).forEach(([key, value]) =>
            cacheHeaders.set(key, value),
          );
          for (const v of values)
            response.cookies.set(v.name, v.value, {
              ...v.options,
              httpOnly: true,
              sameSite: "lax",
              secure: new URL(settings.APP_URL).protocol === "https:",
            });
        },
      },
    },
  );
  await db.auth.getUser();
  return privateResponse();
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

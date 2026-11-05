import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { configuration } from "./lib/config";
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const settings = configuration();
  if (!settings) return response;
  const db = createServerClient(
    settings.NEXT_PUBLIC_SUPABASE_URL,
    settings.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (values) => {
          for (const v of values) request.cookies.set(v.name, v.value);
          response = NextResponse.next({ request });
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
  return response;
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

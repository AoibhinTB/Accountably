import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Explicit cookie attributes for the auth session cookies. @supabase/ssr
// merges these with its defaults (maxAge stays at 400 days; that's hard-coded
// in the library). The Secure flag matters for iOS PWAs in particular —
// without it, Safari can drop the cookies on PWA close.
const cookieOptions = {
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions,
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // setAll called from a Server Component — safe to ignore if
            // middleware is refreshing user sessions.
          }
        },
      },
    },
  );
}

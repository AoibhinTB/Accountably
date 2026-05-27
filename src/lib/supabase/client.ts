import { createBrowserClient } from "@supabase/ssr";

// Mirror the server-side cookie attributes so the browser client refreshes
// the session into cookies with the same Secure / SameSite / Path. iOS PWAs
// drop cookies without an explicit Secure flag on PWA close.
const cookieOptions = {
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookieOptions },
  );
}

import { createClient } from "@supabase/supabase-js";

// Service-role Supabase client for server-only operations that must bypass
// RLS — currently just reading other users' push_subscriptions so we can
// deliver pushes from server actions. Never import this from a route or
// component that runs on the client.
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

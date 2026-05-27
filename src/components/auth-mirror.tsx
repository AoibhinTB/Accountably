"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

// localStorage key for the session backup. Anything in this slot is treated
// as the access + refresh token pair for the current user, used by the
// /login session-restore step when cookies have been wiped.
export const AUTH_BACKUP_KEY = "ay.auth.backup";

// iOS PWAs aggressively drop auth cookies when the app card is swiped
// closed — even with explicit Secure / Lax / Path attributes. localStorage
// in the PWA scope survives that purge, so we mirror the session here on
// every auth state change and restore from it on /login if cookies are
// missing on next launch.
export function AuthMirror() {
  useEffect(() => {
    const supabase = createClient();

    const persist = (
      session: { access_token: string; refresh_token: string } | null,
    ) => {
      try {
        if (session) {
          localStorage.setItem(
            AUTH_BACKUP_KEY,
            JSON.stringify({
              access_token: session.access_token,
              refresh_token: session.refresh_token,
            }),
          );
        } else {
          localStorage.removeItem(AUTH_BACKUP_KEY);
        }
      } catch {
        // localStorage can throw in private mode; nothing useful to do.
      }
    };

    // Capture the current session immediately in case we mount after the
    // initial INITIAL_SESSION event has already fired.
    supabase.auth.getSession().then(({ data }) => persist(data.session));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      persist(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  return null;
}

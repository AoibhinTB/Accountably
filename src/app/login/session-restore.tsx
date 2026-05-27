"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AUTH_BACKUP_KEY } from "@/components/auth-mirror";

// On /login mount, if AuthMirror left a session backup in localStorage but
// the auth cookies have been purged (the iOS PWA close case), restore the
// session client-side and bounce to where the user was going. The overlay
// covers the login form briefly so users don't see a flash of the form
// when their session is actually still valid.
export function SessionRestore() {
  const [state, setState] = useState<"checking" | "done">("checking");
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let backup: { access_token: string; refresh_token: string } | null = null;
      try {
        const raw = localStorage.getItem(AUTH_BACKUP_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (
            parsed &&
            typeof parsed.access_token === "string" &&
            typeof parsed.refresh_token === "string"
          ) {
            backup = parsed;
          }
        }
      } catch {
        // Ignore parse / access errors and fall through to the login form.
      }

      if (!backup) {
        if (!cancelled) setState("done");
        return;
      }

      const supabase = createClient();
      const { error } = await supabase.auth.setSession(backup);
      if (cancelled) return;

      if (error) {
        // Backup tokens are stale (refresh token revoked, etc.). Clear them
        // so we don't loop on next visit and show the normal login form.
        try {
          localStorage.removeItem(AUTH_BACKUP_KEY);
        } catch {
          // ignore
        }
        setState("done");
        return;
      }

      const next = searchParams.get("next");
      const safeNext =
        next && next.startsWith("/") && !next.startsWith("//") ? next : "/feed";
      router.replace(safeNext);
      router.refresh();
    })();

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  if (state === "done") return null;

  return (
    <div
      aria-hidden
      className="fixed inset-0 z-40 flex items-center justify-center"
      style={{ background: "var(--bg)" }}
    >
      <span
        className="label"
        style={{ fontSize: 11, color: "var(--ink-soft)" }}
      >
        restoring session…
      </span>
    </div>
  );
}

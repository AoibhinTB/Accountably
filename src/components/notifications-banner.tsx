"use client";

import { useEffect, useState } from "react";
import { subscribeToPush } from "@/lib/push/client";

const STORAGE_KEY = "ay.push.banner.dismissed";

const isStandalone = () => {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  const navAny = window.navigator as Navigator & { standalone?: boolean };
  return !!navAny.standalone;
};

const isIOS = () =>
  typeof window !== "undefined" &&
  /iPhone|iPad|iPod/.test(window.navigator.userAgent);

// Dismissible prompt to discover the notifications toggle. Shown on /feed for
// users who could enable push but haven't. Tapping "not now" only hides the
// banner — it does not touch the browser permission, so they can still flip
// the toggle on /you later. "Block" on the native permission dialog is sticky;
// in that case we mark the banner dismissed so we never re-ask in-app either.
export function NotificationsBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    (async () => {
      if (typeof window === "undefined") return;
      try {
        if (localStorage.getItem(STORAGE_KEY)) return;
      } catch {
        // localStorage can throw in private mode; treat as not-dismissed.
      }
      if (
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        return;
      }
      if (isIOS() && !isStandalone()) return;
      if (Notification.permission === "denied") return;
      try {
        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        if (existing && Notification.permission === "granted") return;
      } catch {
        // If readiness check fails we just don't show — the /you toggle still
        // works as the canonical entry point.
        return;
      }
      setShow(true);
    })();
  }, []);

  if (!show) return null;

  const persistDismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Ignore; worst case banner reappears next session.
    }
  };

  const dismiss = () => {
    persistDismiss();
    setShow(false);
  };

  // Once the user has expressed any intent (yes or no), hide the banner and
  // mark it dismissed. The browser permission popup appears on top of the
  // (now-hidden) banner; if they later want to retry, they go via /you.
  const turnOn = () => {
    persistDismiss();
    setShow(false);
    void subscribeToPush();
  };

  return (
    <div
      className="mb-5 p-4"
      style={{
        background: "var(--card)",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontStyle: "italic",
            fontSize: 19,
            lineHeight: 1.2,
            color: "var(--ink)",
          }}
        >
          get notified when your group nudges you
        </div>
        <div className="label mt-1" style={{ fontSize: 11 }}>
          you can change this anytime in you
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={turnOn}
          className="press"
          style={{
            flex: 1,
            minHeight: 36,
            borderRadius: 999,
            background: "var(--accent)",
            color: "var(--card)",
            border: "1px solid var(--accent)",
            fontFamily: "var(--font-stat-mono)",
            fontSize: 11,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          turn on
        </button>
        <button
          type="button"
          onClick={dismiss}
          className="press"
          style={{
            minHeight: 36,
            padding: "0 16px",
            borderRadius: 999,
            background: "transparent",
            color: "var(--ink-soft)",
            border: "1.5px dashed var(--line-strong)",
            fontFamily: "var(--font-stat-mono)",
            fontSize: 11,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          not now
        </button>
      </div>
    </div>
  );
}

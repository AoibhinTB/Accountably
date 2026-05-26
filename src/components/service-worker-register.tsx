"use client";

import { useEffect } from "react";

// Registers /sw.js once on first mount. Safe to mount on every page —
// register() is idempotent (returns the existing registration after first
// install). No-op when the browser doesn't support service workers
// (older iOS Safari versions without the PWA installed).
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("[sw] registration failed", err);
    });
  }, []);
  return null;
}

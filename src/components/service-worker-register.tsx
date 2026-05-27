"use client";

import { useEffect } from "react";

// Registers /sw.js once on first mount. Safe to mount on every page —
// register() is idempotent (returns the existing registration after first
// install). No-op when the browser doesn't support service workers
// (older iOS Safari versions without the PWA installed).
//
// We also listen for controllerchange — fires when a newly installed SW
// takes over an already-controlled page (i.e. after a deploy that ships a
// new sw.js). Reloading lets the user see the fresh HTML / JS bundle
// without having to delete-and-reinstall the PWA. We skip the very first
// controllerchange on a page that started uncontrolled (fresh install) so
// new visitors don't get an unnecessary reload.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("[sw] registration failed", err);
    });

    const hadControllerAtLoad = !!navigator.serviceWorker.controller;
    let reloading = false;
    const onControllerChange = () => {
      if (!hadControllerAtLoad) return;
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      onControllerChange,
    );
    return () => {
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange,
      );
    };
  }, []);
  return null;
}

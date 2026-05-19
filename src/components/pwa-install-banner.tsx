"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const STORAGE_KEY = "accountably:pwa-banner-dismissed";

const isStandalone = (): boolean => {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  // iOS Safari exposes a non-standard property when launched from Home Screen
  const navAny = window.navigator as Navigator & { standalone?: boolean };
  if (navAny.standalone) return true;
  return false;
};

const detectPlatform = (): "ios" | "android" | "other" => {
  if (typeof window === "undefined") return "other";
  const ua = window.navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "other";
};

type BannerState =
  | { kind: "hidden" }
  | { kind: "visible"; platform: "ios" | "android" | "other" };

export function PWAInstallBanner() {
  // Render nothing on the server and on first client render to avoid
  // hydration mismatch. After mount, read browser state once and pick the
  // banner state in a single setState — keeps the lint rule happy.
  const [state, setState] = useState<BannerState | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect --
     One-time read of non-reactive browser state (display-mode, localStorage,
     UA) on mount. SSR can't determine these, and we want to avoid hydration
     mismatch, so the banner renders nothing until this effect resolves. */
  useEffect(() => {
    if (isStandalone()) {
      setState({ kind: "hidden" });
      return;
    }
    if (window.localStorage.getItem(STORAGE_KEY) === "1") {
      setState({ kind: "hidden" });
      return;
    }
    setState({ kind: "visible", platform: detectPlatform() });
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const dismiss = () => {
    window.localStorage.setItem(STORAGE_KEY, "1");
    setState({ kind: "hidden" });
  };

  if (!state || state.kind === "hidden") return null;

  const instructions =
    state.platform === "ios"
      ? "Tap the share button, then 'Add to Home Screen'."
      : state.platform === "android"
        ? "Tap the menu, then 'Add to Home screen' or 'Install app'."
        : "Add this page to your home screen from your browser menu.";

  return (
    <div
      role="dialog"
      aria-label="Add Accountably to your home screen"
      className="fixed inset-x-3 z-50"
      style={{
        top: "calc(env(safe-area-inset-top, 0px) + 10px)",
      }}
    >
      <div
        className="mx-auto flex items-start gap-3 px-4 py-3"
        style={{
          maxWidth: "calc(42rem - 24px)",
          background: "var(--card)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius)",
          boxShadow: "0 8px 24px rgba(42, 31, 24, 0.18)",
        }}
      >
        <Image
          src="/icons/icon-192.png"
          alt=""
          width={40}
          height={40}
          style={{ borderRadius: 10, flexShrink: 0 }}
        />
        <div className="flex-1 min-w-0">
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontStyle: "italic",
              fontSize: 17,
              color: "var(--ink)",
              lineHeight: 1.15,
            }}
          >
            add accountably to your home screen
          </div>
          <p
            className="mt-1"
            style={{ fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.35 }}
          >
            {instructions}
          </p>
        </div>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={dismiss}
          className="press"
          style={{
            flexShrink: 0,
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: "transparent",
            color: "var(--mute)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 20,
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
}

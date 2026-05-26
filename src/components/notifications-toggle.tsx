"use client";

import { useEffect, useState, useTransition } from "react";
import { deleteSubscription } from "@/app/you/notifications-actions";
import { subscribeToPush } from "@/lib/push/client";

const isStandalone = () => {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  const navAny = window.navigator as Navigator & { standalone?: boolean };
  return !!navAny.standalone;
};

const isIOS = () =>
  typeof window !== "undefined" &&
  /iPhone|iPad|iPod/.test(window.navigator.userAgent);

type State =
  | { kind: "loading" }
  | { kind: "unsupported" }
  | { kind: "ios-needs-install" }
  | { kind: "blocked" }
  | { kind: "off" }
  | { kind: "on"; endpoint: string };

export function NotificationsToggle() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    (async () => {
      if (typeof window === "undefined") return;
      const hasSW = "serviceWorker" in navigator;
      const hasPush = "PushManager" in window;
      const hasNotif = "Notification" in window;
      if (!hasSW || !hasPush || !hasNotif) {
        setState({ kind: "unsupported" });
        return;
      }
      // iOS Safari only allows web push from an installed PWA (16.4+).
      if (isIOS() && !isStandalone()) {
        setState({ kind: "ios-needs-install" });
        return;
      }
      if (Notification.permission === "denied") {
        setState({ kind: "blocked" });
        return;
      }
      try {
        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        if (existing && Notification.permission === "granted") {
          setState({ kind: "on", endpoint: existing.endpoint });
        } else {
          setState({ kind: "off" });
        }
      } catch {
        setState({ kind: "off" });
      }
    })();
  }, []);

  const enable = () => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await subscribeToPush();
        if (!result.ok) {
          if (result.permissionDenied) {
            setState({ kind: "blocked" });
          } else {
            setError(result.error);
          }
          return;
        }
        setState({ kind: "on", endpoint: result.endpoint });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not enable");
      }
    });
  };

  const disable = (endpoint: string) => {
    setError(null);
    startTransition(async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) await sub.unsubscribe();
        const result = await deleteSubscription(endpoint);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setState({ kind: "off" });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not disable");
      }
    });
  };

  if (state.kind === "loading") {
    return <Row label="notifications" hint="…" />;
  }

  if (state.kind === "unsupported") {
    return (
      <Row
        label="notifications"
        hint="not supported in this browser"
        muted
      />
    );
  }

  if (state.kind === "ios-needs-install") {
    return (
      <Row
        label="notifications"
        hint="add to home screen first"
        muted
      />
    );
  }

  if (state.kind === "blocked") {
    return (
      <Row
        label="notifications"
        hint="blocked — enable in browser settings"
        muted
      />
    );
  }

  const isOn = state.kind === "on";
  return (
    <Row
      label="notifications"
      hint={error ?? (isOn ? "on" : "off")}
      hintTone={error ? "error" : undefined}
    >
      <button
        type="button"
        onClick={() => (isOn ? disable(state.endpoint) : enable())}
        disabled={pending}
        aria-pressed={isOn}
        className="press"
        style={{
          minHeight: 32,
          padding: "0 14px",
          borderRadius: 999,
          background: isOn ? "var(--accent)" : "transparent",
          color: isOn ? "var(--card)" : "var(--ink-soft)",
          border: isOn ? "1px solid var(--accent)" : "1.5px dashed var(--line-strong)",
          fontFamily: "var(--font-stat-mono)",
          fontSize: 11,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          opacity: pending ? 0.6 : 1,
        }}
      >
        {pending ? "…" : isOn ? "on" : "turn on"}
      </button>
    </Row>
  );
}

function Row({
  label,
  hint,
  hintTone,
  muted,
  children,
}: {
  label: string;
  hint?: string;
  hintTone?: "error";
  muted?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <li
      className="flex items-center justify-between p-4 gap-3"
      style={{
        borderBottom: "1px solid var(--line)",
        color: muted ? "var(--ink-soft)" : "var(--ink)",
      }}
    >
      <div className="min-w-0">
        <div style={{ fontSize: 15 }}>{label}</div>
        {hint && (
          <div
            className="label mt-0.5"
            style={{
              fontSize: 10,
              color: hintTone === "error" ? "var(--accent)" : "var(--mute)",
            }}
          >
            {hint}
          </div>
        )}
      </div>
      {children}
    </li>
  );
}

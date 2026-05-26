import { saveSubscription } from "@/app/you/notifications-actions";

// VAPID public keys are url-safe base64. PushManager.subscribe wants a raw
// Uint8Array — the BufferSource type makes TS unhappy with plain ArrayBuffer
// returns from .buffer, so we pass the typed array directly.
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const buffer = new ArrayBuffer(raw.length);
  const out = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export type SubscribeResult =
  | { ok: true; endpoint: string }
  | { ok: false; error: string; permissionDenied?: boolean };

// Runs the full browser permission → push subscribe → persist-to-server flow.
// The caller is responsible for first verifying that push is supported in this
// environment (serviceWorker + PushManager + Notification, not iOS-without-PWA).
export async function subscribeToPush(): Promise<SubscribeResult> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { ok: false, error: "permission denied", permissionDenied: true };
  }
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) return { ok: false, error: "Push not configured" };

  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  });
  const json = sub.toJSON() as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    return { ok: false, error: "Subscription incomplete" };
  }
  const result = await saveSubscription(
    {
      endpoint: json.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    },
    navigator.userAgent,
  );
  if (!result.ok) {
    await sub.unsubscribe();
    return { ok: false, error: result.error };
  }
  return { ok: true, endpoint: json.endpoint };
}

// Accountably service worker — handles incoming web pushes and routes clicks
// back to the right page. Payload shape (set by the server send helper):
//   { title: string, body: string, url?: string, tag?: string }
// `tag` collapses duplicates (e.g. multiple nudges for the same period).
//
// SW_VERSION exists purely to force the browser to detect /sw.js as changed
// when we deploy. Bump it on any deploy where you want PWAs to refresh; the
// install / activate handlers then skip-waiting and claim-clients so the new
// version takes effect on the next PWA launch, and the page-side listener
// in service-worker-register.tsx reloads the page so users do not see stale
// HTML.
const SW_VERSION = "2026-05-27-1";

self.addEventListener("install", (event) => {
  // Don not sit in "waiting" — activate immediately so update reloads can
  // happen on the next launch.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  // Take control of any pages that loaded before this SW activated.
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "Accountably", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "Accountably";
  const options = {
    body: payload.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: payload.tag,
    data: { url: payload.url || "/feed" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/feed";

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      // If a window for this app is already open, focus it and navigate there.
      for (const client of allClients) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) {
            try {
              await client.navigate(targetUrl);
            } catch {
              // navigate() can throw across origins/scopes; fall through to open.
            }
          }
          return;
        }
      }
      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }
    })(),
  );
});

// Minimal service worker whose only job is Web Push (see lib/push.ts) —
// no offline caching. A push payload is always plain JSON text this app
// itself generated (see lib/push.ts's PushPayload) — never rendered as
// HTML, just plain notification text, so there's no injection surface
// even though it ultimately comes from another user's action (e.g. a new
// rapportage).
self.addEventListener("push", (event) => {
  let payload = { title: "Vezrap", body: "Er is een nieuwe melding." };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    // Malformed/non-JSON payload — fall back to the generic text above
    // rather than showing nothing.
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icons/icon.svg",
      badge: "/icons/icon.svg",
      data: { url: payload.url || "/dashboard" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/dashboard";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (new URL(client.url).pathname === new URL(targetUrl, self.location.origin).pathname && "focus" in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});

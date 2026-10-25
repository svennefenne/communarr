/* The service worker: push notifications (shown even with the site closed), opening the right
   page when one is tapped, and the number on the app icon. It doesn't cache pages: the site is live. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  // (every push names its site; one that doesn't shows the site's address)
  const title = data.title || new URL(self.registration.scope).host;
  const options = {
    body: data.body || "",
    icon: data.icon || "/icons/icon-192.png",
    badge: "/icons/badge-96.png",
    tag: data.tag || undefined,
    renotify: !!data.tag,
    data: { url: data.url || "/" },
    timestamp: Date.now(),
  };
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      data.badge && self.navigator.setAppBadge ? self.navigator.setAppBadge(data.badge).catch(() => {}) : Promise.resolve(),
    ]),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // an open tab of the site: bring it forward and go there
      for (const w of wins) {
        if (new URL(w.url).origin === self.location.origin) {
          await w.focus();
          if ("navigate" in w) return w.navigate(url).catch(() => w.postMessage({ type: "open", url }));
          return w.postMessage({ type: "open", url });
        }
      }
      return self.clients.openWindow(url);
    })(),
  );
});

// the browser replaced the subscription: hand the new one to the site
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      const res = await fetch("/api/push", { credentials: "include" });
      if (!res.ok) return;
      const { key } = await res.json();
      const sub = await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      await fetch("/api/push", { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ subscription: sub.toJSON() }) });
    })(),
  );
});

self.addEventListener("push", (event) => {
    let payload = {};
    try {
        payload = event.data ? event.data.json() : {};
    } catch {}

    const title = payload.title || "qweillo";
    event.waitUntil(
        self.registration.showNotification(title, {
            body: payload.body || "Nouvelle activité",
            icon: "/favicon.svg",
            tag: payload.tag || "qweillo",
            data: { url: payload.url || "/" },
        })
    );
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const target = event.notification.data?.url || "/";

    event.waitUntil(
        self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
            for (const client of clients) {
                if (client.url.includes(self.location.origin) && "focus" in client) {
                    client.navigate(target);
                    return client.focus();
                }
            }
            return self.clients.openWindow(target);
        })
    );
});

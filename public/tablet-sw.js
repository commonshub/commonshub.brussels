// The community tablet as an app (/tablet, installed on the hub's Android tablet):
// this service worker only makes it installable. It caches nothing; every
// request goes to the network as usual.
self.addEventListener("install", () => self.skipWaiting())
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()))
self.addEventListener("fetch", () => {})

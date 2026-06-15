self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener("fetch", (event) => {
  // O mínimo necessário para o Chrome considerar a PWA instalável.
  // Pode ser expandido para cache offline no futuro.
  event.respondWith(fetch(event.request));
});

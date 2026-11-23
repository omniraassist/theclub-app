// Guarda la app en el móvil para que se abra (y enseñe el QR) aunque no haya cobertura.
// Los datos del socio no pasan por aquí: los pide la app a Supabase y guarda solo los suyos en el teléfono.
const VERSION = 'theclub-app-v15';
const BASE = ['./', 'index.html', 'qr.js', 'entreno.js', 'gestion.js', 'clases.js', 'notificaciones.js', 'config.js', 'logo.svg', 'isotipo.svg', 'manifest.webmanifest', 'icono-180.png', 'icono-192.png', 'icono-512.png'];
const EXTERNOS = [
  'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js',
  'https://unpkg.com/htm@3.1.1/preact/standalone.module.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then(async (c) => { await c.addAll(BASE); await Promise.all(EXTERNOS.map((u) => c.add(u).catch(() => {}))); }));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.hostname.endsWith('supabase.co')) return;   // los datos siempre frescos
  // primero la red (para tener siempre la última versión); si no hay, lo guardado
  e.respondWith(fetch(u.origin === location.origin ? new Request(e.request, { cache: 'no-store' }) : e.request).then((r) => {
    if (r.ok && (u.origin === location.origin || EXTERNOS.includes(e.request.url) || u.hostname.includes('fonts.g'))) {
      const copia = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copia));
    }
    return r;
  }).catch(() => caches.match(e.request).then((r) => r || caches.match('index.html'))));
});

// Notificaciones
self.addEventListener('push', (e) => {
  let d = {}; try { d = e.data.json(); } catch {}
  e.waitUntil(self.registration.showNotification(d.titulo || 'The Club Fitness', { body: d.texto || '', icon: 'icono-192.png', badge: 'icono-192.png', tag: 'tc-' + (d.id || Date.now()), data: { ir: d.destino || 'acceso' } }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close(); const ir = e.notification.data?.ir || 'acceso';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (cs) => {
    const c = cs.find((x) => x.url.startsWith(self.registration.scope));
    if (c) { await c.focus(); c.postMessage({ ir }); } else await self.clients.openWindow(self.registration.scope + '?ir=' + ir);
  }));
});

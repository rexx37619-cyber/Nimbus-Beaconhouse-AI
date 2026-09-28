const CACHE='nimtron-shell-v1';
const ASSETS=['/nimtron.html','/nimtron-manifest.json','/nimtron-icon-192.png','/nimtron-icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(clients.claim())});
self.addEventListener('fetch',e=>{e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request).catch(()=>cached)))});
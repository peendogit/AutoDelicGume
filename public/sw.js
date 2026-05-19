const CACHE = 'autodelic-v1';
const OFFLINE_URLS = [
  '/',
  '/index.html',
  'https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.2/babel.min.js',
];

// Install — cache app shell
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(OFFLINE_URLS)).then(()=>self.skipWaiting())
  );
});

// Activate — clean old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

// Background sync queue for offline mutations
const offlineQueue = [];

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  
  // API calls — network first, queue if offline
  if(url.pathname.startsWith('/api/')) {
    if(e.request.method !== 'GET') {
      // POST/PUT/DELETE — try network, queue if offline
      e.respondWith(
        fetch(e.request.clone()).catch(async () => {
          // Store in IndexedDB via postMessage
          const body = await e.request.text().catch(()=>'');
          self.clients.matchAll().then(clients=>{
            clients.forEach(c=>c.postMessage({
              type:'OFFLINE_QUEUE',
              url:e.request.url,
              method:e.request.method,
              body,
              headers:Object.fromEntries(e.request.headers.entries()),
              timestamp:Date.now()
            }));
          });
          return new Response(JSON.stringify({_offline:true,error:'Nema konekcije — zahtjev je u redu čekanja'}),
            {headers:{'Content-Type':'application/json'},status:202});
        })
      );
      return;
    }
    // GET API — network first
    e.respondWith(
      fetch(e.request).then(res=>{
        const clone=res.clone();
        caches.open(CACHE).then(c=>c.put(e.request,clone));
        return res;
      }).catch(()=>caches.match(e.request))
    );
    return;
  }

  // Static assets — cache first
  e.respondWith(
    caches.match(e.request).then(cached=>{
      const network=fetch(e.request).then(res=>{
        const clone=res.clone();
        caches.open(CACHE).then(c=>c.put(e.request,clone));
        return res;
      });
      return cached||network;
    })
  );
});

// When back online — replay queued requests
self.addEventListener('message', e => {
  if(e.data?.type==='REPLAY_QUEUE' && e.data.queue?.length) {
    e.data.queue.forEach(req=>{
      fetch(req.url,{method:req.method,headers:req.headers,body:req.body||undefined})
        .then(()=>self.clients.matchAll().then(cs=>cs.forEach(c=>c.postMessage({type:'QUEUE_REPLAYED',url:req.url}))))
        .catch(()=>{});
    });
  }
});

// sw.js - TaskPro Ultimate (sem imagens)

const CACHE_NAME = 'taskpro-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', event => {
  console.log('[SW] Install');
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS_TO_CACHE))
      .catch(err => console.warn('[SW] Cache parcial:', err))
  );
});

self.addEventListener('activate', event => {
  console.log('[SW] Activate');
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(key => key !== CACHE_NAME ? caches.delete(key) : null)
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(cached => {
      const fetchPromise = fetch(event.request).then(networkResponse => {
        if (networkResponse && networkResponse.status === 200) {
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, networkResponse.clone()));
        }
        return networkResponse;
      }).catch(() => null);
      
      return cached || fetchPromise;
    })
  );
});

// Comunicação com a página
let reminderInterval = null;

function showTaskReminder(pendentesCount) {
  if (pendentesCount > 0) {
    return self.registration.showNotification('📋 TaskPro Premium', {
      body: `Você tem ${pendentesCount} tarefa(s) pendente(s).`,
      // Sem ícone nem badge (usa emoji no título)
      vibrate: [200, 100, 200],
      tag: 'task-reminder',
      renotify: true,
      requireInteraction: true,
      actions: [
        { action: 'view', title: 'Ver tarefas' },
        { action: 'dismiss', title: 'Fechar' }
      ],
      data: { url: '/' }
    });
  }
  return Promise.resolve();
}

self.addEventListener('message', event => {
  const data = event.data;
  if (!data) return;

  if (data.type === 'START_REMINDERS') {
    if (reminderInterval) clearInterval(reminderInterval);
    reminderInterval = setInterval(() => {
      self.clients.matchAll({ type: 'window' }).then(clients => {
        if (clients.length > 0) {
          clients[0].postMessage({ type: 'GET_TASKS_COUNT' });
        }
      });
    }, 60000);
  } else if (data.type === 'STOP_REMINDERS') {
    if (reminderInterval) {
      clearInterval(reminderInterval);
      reminderInterval = null;
    }
  } else if (data.type === 'TASKS_COUNT_RESPONSE') {
    showTaskReminder(data.pendentes);
  }
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'view' || !event.action) {
    const url = event.notification.data?.url || '/';
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then(windowClients => {
          for (let client of windowClients) {
            if (client.url.includes(url) && 'focus' in client) return client.focus();
          }
          return clients.openWindow(url);
        })
    );
  }
});

console.log('[SW] TaskPro Service Worker ativo (sem imagens)');

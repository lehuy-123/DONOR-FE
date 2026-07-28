// public/firebase-messaging-sw.js

// Nhập các thư viện Firebase bản compat để dùng trong Service Worker
// Lắng nghe tín hiệu Push từ Web-Push Node.js
self.addEventListener('push', e => {
    let payload = { title: 'Thông báo', body: 'Có thông báo mới' };
    
    if (e.data) {
        try {
            payload = e.data.json();
        } catch(err) {
            payload = { title: 'Thông báo', body: e.data.text() };
        }
    }

    const options = {
        body: payload.body,
        icon: payload.icon || '/vite.svg',
        badge: payload.badge || '/vite.svg',
        vibrate: payload.vibrate || [500, 250, 500, 250, 500],
        requireInteraction: true, // Buộc tương tác
        silent: false, // Hủy chế độ im lặng
        renotify: true, // Báo lại mỗi lần gọi
        tag: 'emergency-alert', // Nhóm chung để renotify có tác dụng
        priority: 'high', // Ưu tiên cho một số OS hỗ trợ
    };

    e.waitUntil(
        self.registration.showNotification(payload.title, options)
    );
});

self.addEventListener('notificationclick', e => {
    e.notification.close();
    e.waitUntil(
        clients.openWindow('/')
    );
});

import { useState } from 'react';
import { updateDonorProfile } from '../utils/firestore';

export const useWebPush = () => {
  const [fcmToken, setFcmToken] = useState(null);
  const [permission, setPermission] = useState('default');

  const requestPermissionAndGetToken = async (userId) => {
    try {
      if (typeof window !== 'undefined' && 'Notification' in window) {
         const perm = await Notification.requestPermission();
         setPermission(perm);
         if (perm !== 'granted') return null;
      }

      // Đăng ký Service Worker & lấy VAPID key
      const res = await fetch('http://localhost:5000/api/vapid-key');
      const { publicKey } = await res.json();

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      
      if (!subscription) {
          subscription = await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(publicKey)
          });
      }

      const pushSubscriptionObj = subscription.toJSON();
      setFcmToken("active"); // Dummy token for UI

      if (userId) {
         await updateDonorProfile(userId, { pushSubscription: pushSubscriptionObj });
         const savedMe = localStorage.getItem('me_donor');
         if (savedMe) {
            const parsedMe = JSON.parse(savedMe);
            localStorage.setItem('me_donor', JSON.stringify({...parsedMe, fcmToken: "active"}));
         }
      }
      return pushSubscriptionObj;
    } catch (error) {
       console.error("Lỗi đăng ký Push:", error);
       return null;
    }
  };

  return { fcmToken, permission, requestPermissionAndGetToken };
};

// Helper chuyển đổi key
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

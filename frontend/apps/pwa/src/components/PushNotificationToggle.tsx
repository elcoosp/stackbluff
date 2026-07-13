import { useState, useEffect } from 'react';
import { subscribeUserToPush, unsubscribeUserFromPush } from '../lib/push';

export function PushNotificationToggle() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.ready.then(async (reg) => {
        const sub = await reg.pushManager.getSubscription();
        setEnabled(!!sub);
      });
    }
  }, []);

  const handleToggle = async () => {
    setLoading(true);
    try {
      if (enabled) {
        await unsubscribeUserFromPush();
        setEnabled(false);
      } else {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          await subscribeUserToPush();
          setEnabled(true);
        } else {
          alert('Notification permission denied');
        }
      }
    } catch (error) {
      console.error('Error toggling push notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return <p>Push notifications are not supported in this browser.</p>;
  }

  return (
    <button onClick={handleToggle} disabled={loading}>
      {loading ? 'Processing...' : enabled ? 'Disable Notifications' : 'Enable Notifications'}
    </button>
  );
}

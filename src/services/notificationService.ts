// Winter Arc - Production Web Push & Multi-Device Notification Service
import { supabase } from '../lib/supabaseClient';
import { getPacts, getAllUsers, getValuePosts } from './db';

export interface NotificationPayload {
  title: string;
  body: string;
  tag?: string;
  icon?: string;
  url?: string;
}

const NOTIFICATIONS_ENABLED_KEY = 'winterarc_notifications_enabled';
const LAST_MIDDAY_NOTIFICATION_KEY = 'winterarc_last_midday_notif';
const LAST_STREAK_NOTIFICATION_KEY = 'winterarc_last_streak_notif';

// Official VAPID Public Key for Web Push (Apple APNs / Google FCM)
export const VAPID_PUBLIC_KEY = 'BIgjqDX8pJuAgkQe6wb5hK_seEJJOUlUcP2wiHSvFjMxglNhiK9aqN0OgYQOq35340F3dpi0xskEygCNYSt8r-w';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function isPushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
}

export function isIOSDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
         (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function isStandalonePWA(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches || 
         (window.navigator as any).standalone === true;
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

export function areNotificationsEnabled(): boolean {
  if (!isNotificationSupported()) return false;
  return Notification.permission === 'granted' && localStorage.getItem(NOTIFICATIONS_ENABLED_KEY) === 'true';
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    return registration;
  } catch (err) {
    console.warn('Service worker registration notice:', err);
    return null;
  }
}

/**
 * Register device with Apple/Google push servers and sync token to Supabase
 */
export async function subscribeToWebPush(userId?: string): Promise<boolean> {
  if (!isPushSupported()) return false;

  try {
    await registerServiceWorker();
    const registration = await navigator.serviceWorker.ready;
    if (!registration || !registration.pushManager) {
      return false;
    }

    let subscription = await registration.pushManager.getSubscription();

    // If no subscription yet, create a new one using VAPID public key
    if (!subscription) {
      const convertedVapidKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey as unknown as BufferSource
      });
    }

    if (subscription) {
      const rawSub = subscription.toJSON();
      const endpoint = subscription.endpoint;
      const p256dh = rawSub.keys?.p256dh;
      const auth = rawSub.keys?.auth;

      if (endpoint && p256dh && auth) {
        const currentId = userId || localStorage.getItem('metis_current_user_id') || null;
        
        const payload: Record<string, any> = {
          endpoint,
          p256dh,
          auth,
          user_agent: navigator.userAgent.slice(0, 255),
          updated_at: new Date().toISOString()
        };
        if (currentId) {
          payload.user_id = currentId;
        }

        const { error } = await supabase
          .from('push_subscriptions')
          .upsert([payload], { onConflict: 'endpoint' });

        if (error) {
          console.warn('Push subscription sync notice:', error.message);
        }
        return true;
      }
    }
    return false;
  } catch (err) {
    console.error('Error establishing Web Push subscription:', err);
    return false;
  }
}

/**
 * Unsubscribe device from Web Push and remove token from Supabase
 */
export async function unsubscribeFromWebPush(): Promise<void> {
  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      if (registration.pushManager) {
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          const endpoint = subscription.endpoint;
          await subscription.unsubscribe();
          await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
        }
      }
    }
  } catch (err) {
    console.warn('Error during push unsubscription:', err);
  }
}

export async function requestNotificationPermission(userId?: string): Promise<boolean> {
  if (!isNotificationSupported()) return false;

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      localStorage.setItem(NOTIFICATIONS_ENABLED_KEY, 'true');
      
      // Subscribe to real server web push
      await subscribeToWebPush(userId);

      // Send immediate welcoming local confirmation
      sendLocalNotification({
        title: 'WINTER ARC • Notificaciones Activas ⚔️',
        body: 'El estándar está fijado. Recibirás avisos de disciplina a las 14:00 y a las 17:30 para proteger tu racha.',
        tag: 'welcome-notification'
      });

      return true;
    } else {
      localStorage.setItem(NOTIFICATIONS_ENABLED_KEY, 'false');
      return false;
    }
  } catch (err) {
    console.error('Error requesting notification permission:', err);
    return false;
  }
}

export function disableNotifications(): void {
  localStorage.setItem(NOTIFICATIONS_ENABLED_KEY, 'false');
  unsubscribeFromWebPush().catch(() => {});
}

export async function sendLocalNotification(payload: NotificationPayload): Promise<boolean> {
  if (!isNotificationSupported() || Notification.permission !== 'granted') {
    return false;
  }

  const options: NotificationOptions = {
    body: payload.body,
    icon: payload.icon || '/icon-192.png',
    badge: '/favicon.png',
    tag: payload.tag || 'winterarc-general',
    data: { url: payload.url || '/' }
  };

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && reg.showNotification) {
        await reg.showNotification(payload.title, options);
        return true;
      }
    }
    new Notification(payload.title, options);
    return true;
  } catch (err) {
    try {
      new Notification(payload.title, options);
      return true;
    } catch (e) {
      return false;
    }
  }
}

/**
 * Trigger an actual live server push to verify real background delivery
 */
export async function sendServerTestNotification(): Promise<boolean> {
  try {
    let endpoint: string | undefined;
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      if (registration.pushManager) {
        const sub = await registration.pushManager.getSubscription();
        if (sub) {
          endpoint = sub.endpoint;
        }
      }
    }

    const response = await fetch('/api/send-test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint })
    });

    return response.ok;
  } catch (err) {
    console.warn('Server test push trigger error:', err);
    // Fallback to local notification test if API fails
    return sendLocalNotification({
      title: 'WINTER ARC • Prueba de Notificación ⚔️',
      body: 'Todo listo. El sistema de avisos de disciplina y pactos está activo.',
      tag: 'test-notification'
    });
  }
}

// 1. Recordatorio de Disciplina - Mitad de Jornada (~14:00 local time)
export function triggerMiddayDisciplineNotification(): void {
  sendLocalNotification({
    title: 'WINTER ARC • Mitad de jornada ⚔️',
    body: 'La mitad del día ya ha pasado. Mientras otros pierden el foco, tú mantienes el estándar. Revisa tus hábitos de hoy.',
    tag: 'midday-discipline'
  });
}

// 2. Alerta de Peligro de Racha - Media Tarde (~17:30 local time)
export function triggerStreakSafeguardNotification(): void {
  sendLocalNotification({
    title: 'ALERTA DE RACHA • Cero excusas 🛡️',
    body: 'La tarde se agota. La disciplina se demuestra cuando no hay ganas. Entra y protege tu racha del Winter Arc antes de que termine el día.',
    tag: 'streak-safeguard'
  });
}

// 3. Alerta de Pacto en Vivo (Cuando el compañero completa su hábito)
export function triggerPactCompletedNotification(partnerName: string, habitName: string): void {
  sendLocalNotification({
    title: 'PACTO ACTIVO • Tu compañero ha cumplido 🔥',
    body: `@${partnerName} acaba de completar "${habitName}". El estándar está fijado: no lo dejes solo en la batalla.`,
    tag: `pact-${partnerName}-${Date.now()}`
  });
}

// 4. Interacción Social (Cuando alguien responde en el Tablón de Valor)
export function triggerSocialReflectionNotification(authorName: string): void {
  sendLocalNotification({
    title: 'TABLÓN DE VALOR • Nueva reflexión ✦',
    body: `@${authorName} ha respondido a tu reflexión diaria. Entra a leer su aportación.`,
    tag: `comment-${authorName}-${Date.now()}`
  });
}

// Foreground local fallback scheduler
export function initNotificationScheduler(): () => void {
  if (!isNotificationSupported()) return () => {};

  registerServiceWorker().catch(() => {});

  // Resync push subscription if active
  if (areNotificationsEnabled()) {
    subscribeToWebPush().catch(() => {});
  }

  const checkSchedule = () => {
    if (!areNotificationsEnabled()) return;

    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    // Midday Discipline trigger: between 14:00 and 14:15
    if (hours === 14 && minutes <= 15) {
      const lastSent = localStorage.getItem(LAST_MIDDAY_NOTIFICATION_KEY);
      if (lastSent !== todayStr) {
        localStorage.setItem(LAST_MIDDAY_NOTIFICATION_KEY, todayStr);
        triggerMiddayDisciplineNotification();
      }
    }

    // Streak Safeguard trigger: between 17:30 and 17:45
    if (hours === 17 && minutes >= 30 && minutes <= 45) {
      const lastSent = localStorage.getItem(LAST_STREAK_NOTIFICATION_KEY);
      if (lastSent !== todayStr) {
        localStorage.setItem(LAST_STREAK_NOTIFICATION_KEY, todayStr);
        triggerStreakSafeguardNotification();
      }
    }
  };

  checkSchedule();
  const interval = setInterval(checkSchedule, 60000);
  window.addEventListener('focus', checkSchedule);
  document.addEventListener('visibilitychange', checkSchedule);

  return () => {
    clearInterval(interval);
    window.removeEventListener('focus', checkSchedule);
    document.removeEventListener('visibilitychange', checkSchedule);
  };
}

// Real-time notification listener for pact completions and social interactions
export function setupRealtimeNotifications(currentUserId: string): () => void {
  if (!currentUserId || !isNotificationSupported()) return () => {};

  // Ensure subscription is synced with user id
  if (areNotificationsEnabled()) {
    subscribeToWebPush(currentUserId).catch(() => {});
  }

  // Subscribe to completions (for partner pact habit notifications)
  const completionsChannel = supabase
    .channel(`pact-notifications-${currentUserId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'completions'
      },
      (payload) => {
        try {
          if (!areNotificationsEnabled()) return;
          const newCompletion = payload.new as { user_id?: string; habit_id?: string };
          if (!newCompletion || !newCompletion.user_id || newCompletion.user_id === currentUserId) return;

          const pacts = getPacts();
          const activePact = pacts.find(p => 
            p.status === 'active' && 
            ((p.creator_id === currentUserId && p.partner_id === newCompletion.user_id) ||
             (p.partner_id === currentUserId && p.creator_id === newCompletion.user_id))
          );

          if (activePact) {
            const allUsers = getAllUsers();
            const partnerUser = allUsers.find(u => u.id === newCompletion.user_id);
            const partnerName = partnerUser?.username || partnerUser?.name || 'Compañero';
            triggerPactCompletedNotification(partnerName, activePact.habit_name);
          }
        } catch (err) {
          console.error('Error handling realtime completion notification:', err);
        }
      }
    )
    .subscribe();

  // Subscribe to value_comments (for social reflection comments on user's posts)
  const commentsChannel = supabase
    .channel(`comment-notifications-${currentUserId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'value_comments'
      },
      (payload) => {
        try {
          if (!areNotificationsEnabled()) return;
          const newComment = payload.new as { post_id?: string; user_id?: string; author_name?: string };
          if (!newComment || !newComment.user_id || newComment.user_id === currentUserId) return;

          const posts = getValuePosts();
          const userPost = posts.find(p => p.id === newComment.post_id && p.user_id === currentUserId);
          if (userPost) {
            const authorName = newComment.author_name || 'Un miembro del Winter Arc';
            triggerSocialReflectionNotification(authorName);
          }
        } catch (err) {
          console.error('Error handling realtime comment notification:', err);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(completionsChannel);
    supabase.removeChannel(commentsChannel);
  };
}

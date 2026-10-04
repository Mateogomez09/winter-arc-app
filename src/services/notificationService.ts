// Winter Arc - Strategic Web Push & Notification Service
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

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
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
    console.warn('Service worker registration failed:', err);
    return null;
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNotificationSupported()) return false;

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      localStorage.setItem(NOTIFICATIONS_ENABLED_KEY, 'true');
      await registerServiceWorker();

      // Send a welcoming test notification
      sendLocalNotification({
        title: 'WINTER ARC • Notificaciones Activas ⚔️',
        body: 'El estándar está fijado. Recibirás recordatorios estratégicos en tu hora local para proteger tu racha.',
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
    // Fallback to standard window Notification
    new Notification(payload.title, options);
    return true;
  } catch (err) {
    try {
      new Notification(payload.title, options);
      return true;
    } catch (e) {
      console.error('Error displaying notification:', e);
      return false;
    }
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

// Schedule local notifications based on user's device clock
export function initNotificationScheduler(): () => void {
  if (!isNotificationSupported()) return () => {};

  registerServiceWorker().catch(() => {});

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

  // Run initial check
  checkSchedule();

  // Periodic check every 60 seconds
  const interval = setInterval(checkSchedule, 60000);

  // Check on focus
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

          // Check if this user is a partner in an active pact
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

          // Check if the comment is on a post created by current user
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

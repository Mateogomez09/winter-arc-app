import type { VercelRequest, VercelResponse } from '@vercel/node';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://ojcehzoxsfsyqpngjypt.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_4s5epQlEihI2Xxovi4la-w_Xowe5rc6';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BIgjqDX8pJuAgkQe6wb5hK_seEJJOUlUcP2wiHSvFjMxglNhiK9aqN0OgYQOq35340F3dpi0xskEygCNYSt8r-w';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'wai5UkeZKAp3DLVe7uiLoDV65vuJ1kliCqletFDm6oM';
const VAPID_SUBJECT = 'mailto:retowinterarc@dazed.es';

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { type } = req.query;

    // Determine notification content based on schedule type
    let title = 'WINTER ARC • Mitad de jornada ⚔️';
    let body = 'La mitad del día ya ha pasado. Mientras otros pierden el foco, tú mantienes el estándar. Revisa tus hábitos de hoy.';
    let tag = 'winterarc-midday';

    if (type === 'streak') {
      title = 'ALERTA DE RACHA • Cero excusas 🛡️';
      body = 'La tarde se agota. La disciplina se demuestra cuando no hay ganas. Protege tu racha del Winter Arc antes de que termine el día.';
      tag = 'winterarc-streak';
    }

    const payload = JSON.stringify({
      title,
      body,
      tag,
      icon: '/icon-192.png',
      badge: '/favicon.png',
      data: { url: '/' }
    });

    // 1. Fetch all active push subscriptions from Supabase
    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth');

    if (error) {
      console.error('Error fetching subscriptions from Supabase:', error);
      return res.status(500).json({ error: 'Could not fetch subscriptions', details: error.message });
    }

    if (!subscriptions || subscriptions.length === 0) {
      return res.status(200).json({ message: 'No push subscriptions found', sent: 0 });
    }

    let sentCount = 0;
    const expiredIds: string[] = [];

    // 2. Send push to each subscriber
    const sendPromises = subscriptions.map(async (sub) => {
      const pushConfig = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth
        }
      };

      try {
        await webpush.sendNotification(pushConfig, payload);
        sentCount++;
      } catch (err: any) {
        // Status 410 (Gone) or 404 (Not Found) means user uninstalled or revoked permissions
        if (err.statusCode === 410 || err.statusCode === 404) {
          expiredIds.push(sub.id);
        } else {
          console.warn(`Failed to send push to ${sub.endpoint.slice(0, 30)}...:`, err.message);
        }
      }
    });

    await Promise.all(sendPromises);

    // 3. Clean up expired subscriptions from database
    if (expiredIds.length > 0) {
      await supabase.from('push_subscriptions').delete().in('id', expiredIds);
    }

    return res.status(200).json({
      success: true,
      total_subscribers: subscriptions.length,
      sent: sentCount,
      cleaned_expired: expiredIds.length,
      type: type || 'midday'
    });
  } catch (err: any) {
    console.error('Fatal cron push error:', err);
    return res.status(500).json({ error: 'Push server error', details: err.message });
  }
}

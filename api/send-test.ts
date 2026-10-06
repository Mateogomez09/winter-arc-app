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
    const { endpoint } = req.body || req.query || {};

    const payload = JSON.stringify({
      title: 'WINTER ARC • Prueba de Push Real ⚔️',
      body: '¡Conexión completada! Tu móvil recibirá las alertas de disciplina a las 14:00 y a las 17:30 incluso con la app cerrada.',
      tag: 'winterarc-test-' + Date.now(),
      icon: '/icon-192.png',
      badge: '/favicon.png',
      data: { url: '/' }
    });

    let query = supabase.from('push_subscriptions').select('id, endpoint, p256dh, auth');
    if (endpoint) {
      query = query.eq('endpoint', endpoint);
    }

    const { data: subscriptions, error } = await query;

    if (error) {
      return res.status(500).json({ error: 'Database error', details: error.message });
    }

    if (!subscriptions || subscriptions.length === 0) {
      return res.status(404).json({ error: 'No active push subscriptions found to test' });
    }

    let sent = 0;
    const expiredIds: string[] = [];

    const sendPromises = subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification({
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth }
        }, payload);
        sent++;
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          expiredIds.push(sub.id);
        }
      }
    });

    await Promise.all(sendPromises);

    if (expiredIds.length > 0) {
      await supabase.from('push_subscriptions').delete().in('id', expiredIds);
    }

    return res.status(200).json({
      success: true,
      message: 'Test push notification sent successfully',
      sent,
      subscribers_tested: subscriptions.length
    });
  } catch (err: any) {
    console.error('Test push error:', err);
    return res.status(500).json({ error: 'Server error', details: err.message });
  }
}

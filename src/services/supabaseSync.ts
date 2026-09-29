import { supabase } from '../lib/supabaseClient';

const KEY_TO_TABLE: Record<string, string> = {
  'metis_users': 'users',
  'metis_habits': 'habits',
  'metis_completions': 'completions',
  'winterarc_value_posts': 'value_posts',
  'winterarc_value_likes': 'value_likes',
  'winterarc_value_comments': 'value_comments'
};

const TABLE_ALLOWED_FIELDS: Record<string, string[]> = {
  'users': ['id', 'name', 'username', 'avatar_url', 'level', 'xp', 'created_at'],
  'habits': ['id', 'user_id', 'name', 'frequency', 'current_streak', 'best_streak', 'wildcard_available', 'archived', 'category', 'goal_id', 'created_at'],
  'completions': ['id', 'user_id', 'habit_id', 'date', 'is_fully_completed', 'created_at'],
  'value_posts': ['id', 'user_id', 'author_name', 'author_avatar', 'author_level', 'content', 'likes_count', 'created_at'],
  'value_likes': ['id', 'post_id', 'user_id', 'created_at'],
  'value_comments': ['id', 'post_id', 'user_id', 'parent_id', 'reply_to_user_name', 'author_name', 'author_avatar', 'author_level', 'content', 'created_at']
};

export function sanitizeItems(table: string, items: any[]): any[] {
  const allowed = TABLE_ALLOWED_FIELDS[table];
  if (!allowed) return items;
  return items.map(item => {
    const clean: Record<string, any> = {};
    allowed.forEach(f => {
      if (item[f] !== undefined) clean[f] = item[f];
    });
    return clean;
  });
}

export async function syncTableToSupabase(key: string, localItems: any[]) {
  const table = KEY_TO_TABLE[key];
  if (!table || !Array.isArray(localItems) || localItems.length === 0) return;

  try {
    let itemsToSync = localItems;
    if (table === 'users') {
      const currentUserId = localStorage.getItem('metis_current_user_id');
      if (currentUserId) {
        itemsToSync = localItems.filter(u => u.id === currentUserId);
      }
    }
    const sanitized = sanitizeItems(table, itemsToSync);
    if (sanitized.length > 0) {
      const { error: upsertError } = await supabase.from(table).upsert(sanitized);
      if (upsertError) {
        console.error(`Error upserting ${table}:`, upsertError);
      }
    }
  } catch (err) {
    console.error(`Unexpected sync error for ${table}:`, err);
  }
}

export async function pullAllFromSupabase(targetUserId?: string) {
  const currentUserId = targetUserId || localStorage.getItem('metis_current_user_id') || '';
  console.log(`Starting Supabase sync for user "${currentUserId || 'all'}"...`);

  // 1. Sync Current User and Top 50 Global Ranking
  try {
    const userQueries = [];
    if (currentUserId) {
      userQueries.push(supabase.from('users').select('*').eq('id', currentUserId));
    }
    userQueries.push(supabase.from('users').select('*').order('xp', { ascending: false }).limit(50));
    
    const results = await Promise.all(userQueries);
    const remoteUsers: any[] = [];
    results.forEach(res => {
      if (!res.error && res.data && Array.isArray(res.data)) {
        remoteUsers.push(...res.data);
      }
    });

    if (remoteUsers.length > 0) {
      const userMap = new Map<string, any>();
      remoteUsers.forEach(ru => {
        if (ru && ru.id) {
          userMap.set(ru.id, ru);
        }
      });
      // Merge current user local fields if any
      const localUsers = JSON.parse(localStorage.getItem('metis_users') || '[]');
      const localCurr = localUsers.find((u: any) => u.id === currentUserId);
      if (localCurr && userMap.has(currentUserId)) {
        const remote = userMap.get(currentUserId);
        userMap.set(currentUserId, {
          ...remote,
          ...localCurr,
          xp: Math.max(localCurr.xp || 0, remote.xp || 0),
          level: Math.max(localCurr.level || 1, remote.level || 1),
          avatar_url: localCurr.avatar_url || remote.avatar_url,
          avatar_frame: localCurr.avatar_frame || remote.avatar_frame || 'default',
          name_color: localCurr.name_color || remote.name_color || 'default',
          title: localCurr.title || remote.title || 'Iniciado del Frío'
        });
      }
      const finalUsers = Array.from(userMap.values()).sort((a, b) => (b.xp || 0) - (a.xp || 0));
      localStorage.setItem('metis_users', JSON.stringify(finalUsers));
      localStorage.setItem('winterarc_cached_ranking', JSON.stringify(finalUsers));
    }
  } catch (e) {
    console.error('Error syncing users from Supabase:', e);
  }

  // 2. Sync Habits (strictly user-isolated)
  try {
    let habitQuery = supabase.from('habits').select('*');
    if (currentUserId) {
      habitQuery = habitQuery.eq('user_id', currentUserId);
    }
    const { data: remoteHabits, error: habitErr } = await habitQuery;

    if (!habitErr && remoteHabits) {
      const allLocalHabits: any[] = JSON.parse(localStorage.getItem('metis_habits') || '[]');
      const otherUsersHabits = currentUserId 
        ? allLocalHabits.filter(h => h.user_id !== currentUserId)
        : [];
      const userLocalHabits = currentUserId
        ? allLocalHabits.filter(h => h.user_id === currentUserId)
        : allLocalHabits;

      const remoteMap = new Map<string, any>(remoteHabits.map(r => [r.id, r]));
      const localMap = new Map<string, any>(userLocalHabits.map(l => [l.id, l]));

      const mergedUserHabits: any[] = [];
      remoteMap.forEach(remoteItem => {
        const local = localMap.get(remoteItem.id);
        mergedUserHabits.push({ ...local, ...remoteItem });
      });

      // Local-only habits for current user
      const localOnlyHabits: any[] = [];
      localMap.forEach((localItem, id) => {
        if (!remoteMap.has(id)) {
          mergedUserHabits.push(localItem);
          localOnlyHabits.push(localItem);
        }
      });

      // Deduplicate by normalized habit name to eliminate any duplicate copies
      const seenHabitNames = new Set<string>();
      const deduplicatedUserHabits: any[] = [];
      const duplicateIdsToDelete: string[] = [];

      mergedUserHabits.forEach(h => {
        const norm = (h.name || '').trim().toLowerCase();
        if (norm && !norm.includes('Ã') && !norm.includes('FÃ')) {
          if (!seenHabitNames.has(norm)) {
            seenHabitNames.add(norm);
            deduplicatedUserHabits.push(h);
          } else {
            duplicateIdsToDelete.push(h.id);
          }
        } else {
          duplicateIdsToDelete.push(h.id);
        }
      });

      localStorage.setItem('metis_habits', JSON.stringify([...otherUsersHabits, ...deduplicatedUserHabits]));

      // Clean up duplicates from Supabase
      if (duplicateIdsToDelete.length > 0) {
        supabase.from('habits').delete().in('id', duplicateIdsToDelete).then();
      }

      // Push local-only habits to Supabase sanitized
      if (localOnlyHabits.length > 0) {
        const sanitized = sanitizeItems('habits', localOnlyHabits);
        await supabase.from('habits').upsert(sanitized);
      }
    }
  } catch (e) {
    console.error('Error syncing habits from Supabase:', e);
  }

  // 3. Sync Completions (strictly user-isolated, never pull other users' completions!)
  try {
    if (currentUserId) {
      const { data: remoteComps, error: compErr } = await supabase
        .from('completions')
        .select('*')
        .eq('user_id', currentUserId);

      if (!compErr && remoteComps) {
        const allLocalComps: any[] = JSON.parse(localStorage.getItem('metis_completions') || '[]');
        const otherUsersComps = allLocalComps.filter(c => c.user_id !== currentUserId);
        const userLocalComps = allLocalComps.filter(c => c.user_id === currentUserId);

        const remoteMap = new Map<string, any>(remoteComps.map(r => [r.id, r]));
        const localMap = new Map<string, any>(userLocalComps.map(l => [l.id, l]));

        const mergedUserComps: any[] = [];
        remoteMap.forEach(remoteItem => {
          const local = localMap.get(remoteItem.id);
          mergedUserComps.push({ ...local, ...remoteItem });
        });

        // Add local-only completions
        const localOnlyComps: any[] = [];
        localMap.forEach((localItem, id) => {
          if (!remoteMap.has(id)) {
            mergedUserComps.push(localItem);
            localOnlyComps.push(localItem);
          }
        });

        localStorage.setItem('metis_completions', JSON.stringify([...otherUsersComps, ...mergedUserComps]));

        if (localOnlyComps.length > 0) {
          const sanitized = sanitizeItems('completions', localOnlyComps);
          await supabase.from('completions').upsert(sanitized);
        }
      }
    }
  } catch (e) {
    console.error('Error syncing completions from Supabase:', e);
  }

  console.log('Supabase essential user sync complete!');
}

// Realtime sync cleanup
export function setupRealtimeSync(onUpdate?: () => void) {
  return () => {};
}

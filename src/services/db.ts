import { 
  User, Goal, Habit, HabitCompletion, Task, Friendship, 
  Tribe, TribeMember, TribeCompletion, TribeMessage, 
  Challenge, ChallengeParticipant, Badge, UserBadge, Notification, Masterclass, SaleTransaction,
  ValuePost, ValueLike, ValueComment, Pact
} from '../types';
import { 
  SEED_USERS, SEED_GOALS, SEED_HABITS, SEED_TASKS, 
  SEED_FRIENDSHIPS, SEED_TRIBES, SEED_TRIBE_MEMBERS, 
  SEED_CHALLENGES, SEED_CHALLENGE_PARTICIPANTS, 
  SEED_BADGES, SEED_USER_BADGES, SEED_NOTIFICATIONS,
  SEED_MASTERCLASSES, SEED_TRANSACTIONS
} from '../data/seed';
import { syncTableToSupabase } from './supabaseSync';
import { supabase } from '../lib/supabaseClient';

// Storage keys
const KEYS = {
  USERS: 'metis_users',
  GOALS: 'metis_goals',
  HABITS: 'metis_habits',
  COMPLETIONS: 'metis_completions',
  TASKS: 'metis_tasks',
  FRIENDSHIPS: 'metis_friendships',
  TRIBES: 'metis_tribes',
  TRIBE_MEMBERS: 'metis_tribe_members',
  TRIBE_COMPLETIONS: 'metis_tribe_completions',
  TRIBE_MESSAGES: 'metis_tribe_messages',
  CHALLENGES: 'metis_challenges',
  CHALLENGE_PARTICIPANTS: 'metis_challenge_participants',
  USER_BADGES: 'metis_user_badges',
  NOTIFICATIONS: 'metis_notifications',
  CURRENT_USER_ID: 'metis_current_user_id',
  LAST_CRON_RUN: 'metis_last_cron_run',
  MASTERCLASSES: 'metis_masterclasses',
  TRANSACTIONS: 'metis_transactions',
  CURRENT_USER: 'metis_current_user'
};

// Timezone-safe date helpers (Strictly calibrated to the user's local device timezone)
export function getLocalDateString(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0); // Noon prevents DST timezone jumps
}

export function getDayBeforeDateString(dateStr: string): string {
  const date = parseLocalDate(dateStr);
  date.setDate(date.getDate() - 1);
  return getLocalDateString(date);
}

export function getFutureLocalDateString(daysAhead: number, fromDateStr?: string): string {
  const date = fromDateStr ? parseLocalDate(fromDateStr) : new Date();
  date.setDate(date.getDate() + daysAhead);
  return getLocalDateString(date);
}

export function getUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch (e) {
    return 'UTC';
  }
}

export function calculateStreak(habitId: string, completions: HabitCompletion[], targetDateStr: string, habit?: Habit, userId?: string): number {
  let h = habit;
  if (!h) {
    try {
      const habits = JSON.parse(localStorage.getItem('metis_habits') || '[]');
      h = habits.find((x: any) => x.id === habitId);
    } catch (e) {
      // ignore
    }
  }

  const effectiveUserId = userId || (h ? h.user_id : getCurrentUserId());

  // Helper to check if a habit is scheduled on a given Date
  const isHabitScheduledOn = (d: Date) => {
    if (!h) return true;
    if (h.frequency === 'custom' && h.custom_days && h.custom_days.length > 0) {
      return h.custom_days.includes(d.getDay());
    }
    return true; // daily or weekly means every day is implicitly expected in the streak logic, except weekly handles it differently, but for 'daily' it's true.
  };

  // Helper to check if there is a valid completion on a given date string
  const isHabitCompletedOn = (dStr: string) => {
    return completions.some(c => 
      (!effectiveUserId || c.user_id === effectiveUserId) &&
      c.habit_id === habitId && 
      c.date === dStr && 
      c.is_fully_completed !== false
    );
  };

  const todayStr = getLocalDateString();
  let streak = 0;
  
  // Parse target date and start checking backwards
  let checkDate = parseLocalDate(targetDateStr);
  const createdAtStr = h ? getLocalDateString(new Date(h.created_at)) : '2000-01-01';

  let safetyCount = 0;
  while (safetyCount < 1000) {
    safetyCount++;
    const currentStr = getLocalDateString(checkDate);
    
    // Stop if we reach before creation date
    if (currentStr < createdAtStr) {
      break;
    }

    const scheduled = isHabitScheduledOn(checkDate);
    const completed = isHabitCompletedOn(currentStr);
    
    const isTargetDate = (currentStr === targetDateStr);
    const isHistorical = (currentStr < todayStr);

    if (completed) {
      streak++;
    } else {
      // Not completed
      if (isTargetDate) {
        // If it's the target date and it's missing
        if (isHistorical && scheduled) {
          // If you look at a past scheduled day and it's missing, streak is 0
          return 0;
        }
        // If it's today (not historical), or unscheduled, we don't break, we just don't count it
      } else {
        // If it's a past day in the loop
        if (scheduled) {
          // A scheduled past day was missed! Break the streak.
          break;
        }
        // If it's unscheduled, we just skip it (don't break, don't increment)
      }
    }

    // Move to previous day
    checkDate.setDate(checkDate.getDate() - 1);
  }

  return streak;
}

function generateSeedCompletions(userId: string, totalDays: number): HabitCompletion[] {
  const completions: HabitCompletion[] = [];
  const today = new Date();
  for (let i = 1; i <= totalDays; i++) {
    const d = new Date();
    d.setDate(today.getDate() - i);
    const dateStr = getLocalDateString(d);
    
    // Always add a gym completion to guarantee consistency days size
    completions.push({
      id: `seed_c_gym_${i}`,
      user_id: userId,
      habit_id: 'habit_gym',
      date: dateStr,
      photo_url: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=300&q=80',
      completed_at: new Date(d.getTime() + 18 * 60 * 60 * 1000).toISOString(),
      used_wildcard: false
    });
    
    // Add code completion on 2/3 of the days, but complete all of the first 15 days to create a valid streak
    if (i <= 15 || i % 3 !== 0) {
      completions.push({
        id: `seed_c_code_${i}`,
        user_id: userId,
        habit_id: 'habit_code',
        date: dateStr,
        photo_url: '',
        completed_at: new Date(d.getTime() + 20 * 60 * 60 * 1000).toISOString(),
        used_wildcard: false
      });
    }
    
    // Add reading completion on 1/2 of the days, but complete all of the first 15 days to create a valid streak
    if (i <= 15 || i % 2 === 0) {
      completions.push({
        id: `seed_c_read_${i}`,
        user_id: userId,
        habit_id: 'habit_reading',
        date: dateStr,
        photo_url: '',
        completed_at: new Date(d.getTime() + 21 * 60 * 60 * 1000).toISOString(),
        used_wildcard: false
      });
    }
  }
  return completions;
}

// Initial setup
export function initializeDB() {
  // Proactively prune old photos to free up localStorage space (QuotaExceededError prevention)
  pruneOldPhotos();

  const defaults: Record<string, any> = {
    [KEYS.USERS]: [],
    [KEYS.GOALS]: [],
    [KEYS.HABITS]: [],
    [KEYS.COMPLETIONS]: [],
    [KEYS.TASKS]: [],
    [KEYS.FRIENDSHIPS]: [],
    [KEYS.TRIBES]: [],
    [KEYS.TRIBE_MEMBERS]: [],
    [KEYS.TRIBE_COMPLETIONS]: [],
    [KEYS.TRIBE_MESSAGES]: [],
    [KEYS.CHALLENGES]: [],
    [KEYS.CHALLENGE_PARTICIPANTS]: [],
    [KEYS.USER_BADGES]: [],
    [KEYS.NOTIFICATIONS]: [],
    [KEYS.MASTERCLASSES]: [],
    [KEYS.TRANSACTIONS]: [],
  };

  Object.entries(defaults).forEach(([key, value]) => {
    try {
      const item = localStorage.getItem(key);
      if (!item) {
        localStorage.setItem(key, JSON.stringify(value));
      } else {
        JSON.parse(item);
      }
    } catch (e) {
      localStorage.setItem(key, JSON.stringify(value));
    }
  });

  if (!localStorage.getItem(KEYS.LAST_CRON_RUN)) {
    localStorage.setItem(KEYS.LAST_CRON_RUN, getLocalDateString());
  }

  // Purge legacy demo users and dummy data from local storage
  try {
    const demoIds = ['user_mateo', 'user_david', 'user_naval', 'user_lucas', 'user_sofia', 'user_elena', 'user_adri', 'user_3doshz03u', 'user_xb4o0i5pz'];
    const isLegacyId = (id: string) => !id || demoIds.includes(id) || (id.startsWith('user_') && !id.includes('-'));

    const curId = localStorage.getItem(KEYS.CURRENT_USER_ID);
    if (curId && isLegacyId(curId)) {
      localStorage.removeItem(KEYS.CURRENT_USER_ID);
    }

    // Clean users
    const usersStr = localStorage.getItem(KEYS.USERS);
    if (usersStr) {
      const usersList = JSON.parse(usersStr);
      if (Array.isArray(usersList)) {
        const cleaned = usersList.filter((u: any) => u && !isLegacyId(u.id));
        localStorage.setItem(KEYS.USERS, JSON.stringify(cleaned));
      }
    }

    // Clean habits
    const habitsStr = localStorage.getItem(KEYS.HABITS);
    if (habitsStr) {
      const habitList = JSON.parse(habitsStr);
      if (Array.isArray(habitList)) {
        const cleaned = habitList.filter((h: any) => h && !isLegacyId(h.user_id));
        localStorage.setItem(KEYS.HABITS, JSON.stringify(cleaned));
      }
    }

    // Clean completions
    const compStr = localStorage.getItem(KEYS.COMPLETIONS);
    if (compStr) {
      const compList = JSON.parse(compStr);
      if (Array.isArray(compList)) {
        const cleaned = compList.filter((c: any) => c && !isLegacyId(c.user_id));
        localStorage.setItem(KEYS.COMPLETIONS, JSON.stringify(cleaned));
      }
    }

    // Clean value board posts
    const postStr = localStorage.getItem('winterarc_value_posts');
    if (postStr) {
      const postList = JSON.parse(postStr);
      if (Array.isArray(postList)) {
        const cleaned = postList.filter((p: any) => p && !isLegacyId(p.user_id));
        localStorage.setItem('winterarc_value_posts', JSON.stringify(cleaned));
      }
    }

    // Clean value likes & comments
    const likeStr = localStorage.getItem('winterarc_value_likes');
    if (likeStr) {
      const likeList = JSON.parse(likeStr);
      if (Array.isArray(likeList)) {
        const cleaned = likeList.filter((l: any) => l && !isLegacyId(l.user_id));
        localStorage.setItem('winterarc_value_likes', JSON.stringify(cleaned));
      }
    }
    const comStr = localStorage.getItem('winterarc_value_comments');
    if (comStr) {
      const comList = JSON.parse(comStr);
      if (Array.isArray(comList)) {
        const cleaned = comList.filter((c: any) => c && !isLegacyId(c.user_id));
        localStorage.setItem('winterarc_value_comments', JSON.stringify(cleaned));
      }
    }

    // Clean cached ranking
    localStorage.removeItem('winterarc_cached_ranking');
  } catch (e) {
    // ignore
  }

  // Run daily maintenance for logged-in user
  if (getCurrentUserId()) {
    runDailyMaintenance();
  }
}

// Helpers for localStorage
function getItem<T>(key: string): T {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : ([] as unknown as T);
  } catch (e) {
    console.error(`Error parsing localStorage key "${key}":`, e);
    return ([] as unknown as T);
  }
}

export function pruneOldPhotos() {
  console.log("LocalStorage full or initializing. Pruning old verification photos...");
  try {
    const completions = JSON.parse(localStorage.getItem('metis_completions') || '[]');
    if (Array.isArray(completions) && completions.length > 0) {
      const todayStr = getLocalDateString();
      // Keep photos only for today and yesterday, clear older ones to save 99% of storage space
      const pruned = completions.map((c: any) => {
        if (c.date < todayStr && c.photo_url && c.photo_url.startsWith('data:')) {
          // Replace large base64 with a small placeholder Unsplash URL
          return { ...c, photo_url: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=150&q=80' };
        }
        return c;
      });
      localStorage.setItem('metis_completions', JSON.stringify(pruned));
    }
  } catch (e) {
    console.error("Error pruning completions photos:", e);
  }
}

export function aggressivePrunePhotos() {
  console.log("LocalStorage still full. Aggressive pruning of all historical photos...");
  try {
    const completions = JSON.parse(localStorage.getItem('metis_completions') || '[]');
    if (Array.isArray(completions) && completions.length > 0) {
      const todayStr = getLocalDateString();
      const pruned = completions.map((c: any) => {
        if (c.date < todayStr && c.photo_url) {
          return { ...c, photo_url: '' };
        }
        return c;
      });
      localStorage.setItem('metis_completions', JSON.stringify(pruned));
    }
  } catch (e) {
    console.error("Error aggressive pruning:", e);
  }
}

export function setItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    if (Array.isArray(value) && key !== KEYS.COMPLETIONS && key !== KEYS.HABITS) {
      syncTableToSupabase(key, value).catch(err => console.error(err));
    }
  } catch (e) {
    console.warn(`Error writing key "${key}" to localStorage:`, e);
    if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22)) {
      pruneOldPhotos();
      try {
        localStorage.setItem(key, JSON.stringify(value));
        if (Array.isArray(value)) {
          syncTableToSupabase(key, value).catch(err => console.error(err));
        }
      } catch (err) {
        console.error("Critical: Storage still full after pruning old photos. Cleared aggressively.", err);
        aggressivePrunePhotos();
        localStorage.setItem(key, JSON.stringify(value));
        if (Array.isArray(value)) {
          syncTableToSupabase(key, value).catch(err => console.error(err));
        }
      }
    }
  }
}

// Maintenance cron logic
export function runDailyMaintenance() {
  const todayStr = getLocalDateString();
  const lastRun = localStorage.getItem(KEYS.LAST_CRON_RUN);
  
  if (lastRun && lastRun !== todayStr) {
    // 1. Roll incomplete tasks from past days to today and clean up completed tasks from past days
    const tasks = getItem<Task[]>(KEYS.TASKS);
    const updatedTasks = tasks
      .filter(task => !(task.completed && task.date < todayStr))
      .map(task => {
        if (!task.completed && task.date < todayStr) {
          return { 
            ...task, 
            original_date: task.original_date || task.date,
            date: todayStr 
          };
        }
        return task;
      });
    setItem(KEYS.TASKS, updatedTasks);

    // 2. Daily streak validation for habits
    const habits = getItem<Habit[]>(KEYS.HABITS);
    const completions = getItem<HabitCompletion[]>(KEYS.COMPLETIONS);
    
    // We want to check all dates from lastRun (inclusive) up to yesterday (inclusive).
    const datesToCheck: string[] = [];
    let currentCheckDate = parseLocalDate(lastRun);
    
    while (getLocalDateString(currentCheckDate) < todayStr) {
      datesToCheck.push(getLocalDateString(currentCheckDate));
      currentCheckDate.setDate(currentCheckDate.getDate() + 1);
    }

    const currentUserId = getCurrentUserId();
    let completionsChanged = false;
    let streaksBrokenCount = 0;

    const updatedHabits = habits.map(habit => {
      if (habit.user_id !== currentUserId || habit.archived) return habit;

      let wildcardAvailable = habit.wildcard_available;
      let lastCheckedMonth = lastRun.substring(0, 7);
      const habitCreatedLocalDate = getLocalDateString(new Date(habit.created_at));

      for (const checkDate of datesToCheck) {
        // Skip dates before the habit was created
        if (checkDate < habitCreatedLocalDate) {
          continue;
        }

        // Skip custom days that are not scheduled
        if (habit.frequency === 'custom' && habit.custom_days && habit.custom_days.length > 0) {
          const dateObj = parseLocalDate(checkDate);
          const dayOfWeek = dateObj.getDay();
          if (!habit.custom_days.includes(dayOfWeek)) {
            continue;
          }
        }

        // Monthly wildcard reset check
        const checkDateMonth = checkDate.substring(0, 7);
        if (checkDateMonth !== lastCheckedMonth) {
          wildcardAvailable = true;
          lastCheckedMonth = checkDateMonth;
        }

        const hasCompletion = completions.some(c => c.user_id === currentUserId && c.habit_id === habit.id && c.date === checkDate && c.is_fully_completed !== false);
        if (!hasCompletion) {
          const dayBeforeCheckDateStr = getDayBeforeDateString(checkDate);
          const streakBefore = calculateStreak(habit.id, completions, dayBeforeCheckDateStr, habit, currentUserId);
          
          if (streakBefore > 0) {
            if (wildcardAvailable) {
              // Consume wildcard
              wildcardAvailable = false;
              const wildcardCompletion: HabitCompletion = {
                id: 'wildcard_' + Math.random().toString(36).substr(2, 9),
                habit_id: habit.id,
                user_id: currentUserId,
                date: checkDate,
                photo_url: '',
                completed_at: new Date().toISOString(),
                used_wildcard: true
              };
              completions.push(wildcardCompletion);
              completionsChanged = true;

              addNotification({
                user_id: currentUserId,
                type: 'reminder',
                title: 'Comodín Consumido Ã°Å¸â€º¡Ã¯Â¸Â',
                body: `Se ha usado tu comodín mensual para mantener la racha en "${habit.name}". No te quedan comodines para este hábito.`
              });
            } else {
              // Streak broken!
              streaksBrokenCount++;
              addNotification({
                user_id: currentUserId,
                type: 'streak_broken',
                title: 'Racha rota Ã°Å¸â€™â€',
                body: `Has perdido tu racha de ${streakBefore} días en "${habit.name}". ¡Vuelve a empezar hoy!`
              });
            }
          }
        }
      }

      // Calculate final streak today (completions might have wildcard completions added)
      const finalStreak = calculateStreak(habit.id, completions, todayStr, habit, currentUserId);
      const bestStreak = Math.max(habit.best_streak, finalStreak);

      return {
        ...habit,
        current_streak: finalStreak,
        best_streak: bestStreak,
        wildcard_available: wildcardAvailable
      };
    });

    setItem(KEYS.HABITS, updatedHabits);
          if (completionsChanged) {
        setItem(KEYS.COMPLETIONS, completions);
      }

      // -- PACT LOGIC MAINTENANCE --
      try {
        const pactsStr = localStorage.getItem('winterarc_pacts');
        if (pactsStr) {
          const pacts = JSON.parse(pactsStr);
          let pactsModified = false;
          
          pacts.forEach((p: any) => {
            if (p.status === 'active' && (p.creator_id === currentUserId || p.partner_id === currentUserId)) {
              datesToCheck.forEach(checkDate => {
                const c_habits = updatedHabits.filter(h => h.user_id === p.creator_id && h.name.trim().toLowerCase() === p.habit_name.trim().toLowerCase());
                const p_habits = updatedHabits.filter(h => h.user_id === p.partner_id && h.name.trim().toLowerCase() === p.habit_name.trim().toLowerCase());
                
                const creatorCompleted = completions.some(c => c.user_id === p.creator_id && c.date === checkDate && c.is_fully_completed !== false && c_habits.some(h => h.id === c.habit_id));
                const partnerCompleted = completions.some(c => c.user_id === p.partner_id && c.date === checkDate && c.is_fully_completed !== false && p_habits.some(h => h.id === c.habit_id));
                
                if (creatorCompleted && partnerCompleted) {
                  p.current_streak = (p.current_streak || 0) + 1;
                  const bonus = getPactXPReward(p.current_streak);
                  // Award multi-tier XP each
                  const users = getItem<User[]>(KEYS.USERS);
                  const uc = users.find(u => u.id === p.creator_id);
                  const up = users.find(u => u.id === p.partner_id);
                  if (uc) uc.xp += bonus;
                  if (up) up.xp += bonus;
                  setItem(KEYS.USERS, users);
                } else if (creatorCompleted || partnerCompleted) {
                  // Failed one of them: reset streak to 0, deduct fixed -2 XP
                  p.current_streak = 0;
                  const users = getItem<User[]>(KEYS.USERS);
                  const uc = users.find(u => u.id === p.creator_id);
                  const up = users.find(u => u.id === p.partner_id);
                  if (uc) uc.xp = Math.max(0, uc.xp - 2);
                  if (up) up.xp = Math.max(0, up.xp - 2);
                  setItem(KEYS.USERS, users);
                } else {
                  // Both failed: reset streak to 0
                  p.current_streak = 0;
                }
                pactsModified = true;
              });
            }
          });
          
          if (pactsModified) {
            localStorage.setItem('winterarc_pacts', JSON.stringify(pacts));
          }
        }
      } catch (e) { console.error(e); }
      // -- END PACT LOGIC --

      // 3. Update Companion status timestamp
    const users = getItem<User[]>(KEYS.USERS);
    const updatedUsers = users.map(u => {
      if (u.id === currentUserId) {
        let companion = u.companion;
        if (!companion) {
          companion = {
            name: 'Slimey',
            type: 'slime',
            skin: 'classic',
            level: 1,
            xp: 0,
            accessories: [],
            last_update: new Date().toISOString()
          };
        }

        return {
          ...u,
          companion: {
            ...companion,
            last_update: new Date().toISOString()
          }
        };
      }
      return u;
    });
    setItem(KEYS.USERS, updatedUsers);
    
    // Update last run time
    localStorage.setItem(KEYS.LAST_CRON_RUN, todayStr);
  }
}

// User Services
export function getCurrentUserId(): string {
  return localStorage.getItem(KEYS.CURRENT_USER_ID) || '';
}

export function getCurrentUser(): User | null {
  const users = getItem<User[]>(KEYS.USERS);
  const currentId = getCurrentUserId();
  if (!currentId) return null;
  const user = users.find(u => u.id === currentId);
  return user || null;
}

export function updateUserXP(amount: number): { user: User, leveledUp: boolean, earnedBadges: Badge[] } {
  const users = getItem<User[]>(KEYS.USERS);
  const currentId = getCurrentUserId();
  let leveledUp = false;
  const earnedBadges: Badge[] = [];
  
  const updatedUsers = users.map(user => {
    if (user.id === currentId) {
      const oldLevel = user.level;
      const newXp = Math.max(0, user.xp + amount);
      const newLevel = amount < 0 ? oldLevel : (Math.floor(newXp / 200) + 1);
      if (newLevel > oldLevel) {
        leveledUp = true;
      }
      
      const coinsEarned = amount; // 1 Coin per 1 XP
      let bonusCoins = 0;
      if (newLevel > oldLevel) {
        bonusCoins = 50; // Level up bonus coins
      }
      
      const currentCoins = user.coins === undefined ? 100 : user.coins;
      const newCoins = Math.max(0, currentCoins + coinsEarned + bonusCoins);

      // Update Companion XP and stats
      let companion = user.companion;
      if (companion) {
        let xpMultiplier = 1.0;
        if (companion.accessories.includes('gorra_focus')) xpMultiplier += 0.10;
        if (companion.accessories.includes('gafas_cyber')) xpMultiplier += 0.15;

        const effectiveXpGain = Math.floor(amount * 0.3 * xpMultiplier);
        let companionXp = Math.max(0, companion.xp + effectiveXpGain);
        let companionLevel = companion.level;
        
        if (amount > 0) {
          while (companionXp >= companionLevel * 100) {
            companionXp -= companionLevel * 100;
            companionLevel += 1;
            
            addNotification({
              user_id: currentId,
              type: 'level_up',
              title: '¡Tu Compañero subió de Nivel! Ã°Å¸ÂÂ¾Ã¢Å“Â¨',
              body: `¡Excelente disciplina! ${companion.name} ha alcanzado el Nivel ${companionLevel}.`
            });
          }
        }

        companion = {
          ...companion,
          xp: companionXp,
          level: companionLevel
        };
      } else {
        companion = {
          name: 'Slimey',
          type: 'slime',
          skin: 'classic',
          level: 1,
          xp: 0,
          accessories: [],
          last_update: new Date().toISOString()
        };
      }
      
      return {
        ...user,
        xp: newXp,
        level: newLevel,
        coins: newCoins,
        companion,
        inventory: user.inventory || []
      };
    }
    return user;
  });
  
  setItem(KEYS.USERS, updatedUsers);
  
  const updatedUser = updatedUsers.find(u => u.id === currentId)!;

  if (leveledUp && amount > 0) {
    addNotification({
      user_id: currentId,
      type: 'level_up',
      title: '¡Subiste de Nivel! Ã¢Å¡¡',
      body: `Felicidades, has alcanzado el Nivel ${updatedUser.level}: ${getLevelTitle(updatedUser.level)}. Recibiste +50 monedas Metis.`
    });
  }

  // Sync XP change to Supabase in background
  if (currentId) {
    updateUserXPInSupabase(currentId, amount).catch(() => {});
  }

  return {
    user: updatedUser,
    leveledUp,
    earnedBadges
  };
}

export function getLevelTitle(level: number): string {
  if (level >= 100) return 'Leyenda';
  if (level >= 50) return 'Referente';
  if (level >= 25) return 'Constructor';
  if (level >= 10) return 'Constante';
  return 'Iniciado';
}

export function getAllUsers(): User[] {
  return getItem<User[]>(KEYS.USERS);
}

export function registerUser(name: string, username: string, email: string, password?: string, avatarUrl?: string): User {
  const users = getItem<User[]>(KEYS.USERS);
  const newUser: User = {
    id: 'user_' + Math.random().toString(36).substr(2, 9),
    name,
    username: username.toLowerCase().replace('@', ''),
    email,
    password: password || '123456',
    avatar_url: avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80',
    xp: 0,
    level: 1,
    coins: 150,
    created_at: new Date().toISOString()
  };
  
  users.push(newUser);
  setItem(KEYS.USERS, users);
  localStorage.setItem(KEYS.CURRENT_USER_ID, newUser.id);
  
  // Inject 3 default habits for Winter Arc
  const habits = getItem<Habit[]>(KEYS.HABITS);
  const defaultHabits = ['Ejercicio físico 1 hora', 'Buena rutina de sueño', '30 mins aprendiendo algo'];
  defaultHabits.forEach(name => {
    habits.push({
      id: 'habit_' + Math.random().toString(36).substr(2, 9),
      user_id: newUser.id,
      goal_id: 'auto_generated',
      name,
      frequency: 'daily',
      privacy: 'public',
      current_streak: 0,
      best_streak: 0,
      wildcard_available: true,
      archived: false,
      created_at: new Date().toISOString()
    });
  });
  setItem(KEYS.HABITS, habits);
  
  // Create first notification
  addNotification({
    user_id: newUser.id,
    type: 'friend_accepted',
    title: 'Bienvenido a METIS Ã°Å¸Å’Å’',
    body: 'Empieza escribiendo tus objetivos para hoy.'
  });
  
  return newUser;
}

export function loginUser(email: string, password?: string): User | null {
  const users = getItem<User[]>(KEYS.USERS);
  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase() || u.username.toLowerCase() === email.toLowerCase());
  if (user) {
    const userPass = user.password || '123456';
    if (password === userPass) {
      localStorage.setItem(KEYS.CURRENT_USER_ID, user.id);
      return user;
    }
  }
  return null;
}

// Value Board Services
const VALUE_POSTS_KEY = 'winterarc_value_posts';
const VALUE_LIKES_KEY = 'winterarc_value_likes';
const VALUE_COMMENTS_KEY = 'winterarc_value_comments';

export function getValuePosts(): ValuePost[] {
  return getItem<ValuePost[]>(VALUE_POSTS_KEY).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function canUserPostValueToday(userId?: string): { canPost: boolean; todayPost?: ValuePost } {
  const currentId = userId || getCurrentUserId();
  const todayStr = getLocalDateString();
  const posts = getValuePosts();
  const todayPost = posts.find(p => p.user_id === currentId && getLocalDateString(new Date(p.created_at)) === todayStr);
  return {
    canPost: !todayPost,
    todayPost
  };
}

export async function refreshValuePostsFromSupabase(): Promise<ValuePost[]> {
  try {
    const { data, error } = await supabase
      .from('value_posts')
      .select('id, user_id, author_name, author_avatar, author_level, content, likes_count, created_at')
      .order('created_at', { ascending: false })
      .limit(25);
    
    if (!error && data && Array.isArray(data)) {
      localStorage.setItem(VALUE_POSTS_KEY, JSON.stringify(data));
      return data;
    }
  } catch (e) {
    console.error('Error refreshing value posts from Supabase:', e);
  }
  return getValuePosts();
}

export async function refreshValueLikesFromSupabase(userId?: string): Promise<ValueLike[]> {
  const currentId = userId || getCurrentUserId();
  if (!currentId) return getValueLikes();
  try {
    const { data, error } = await supabase
      .from('value_likes')
      .select('id, post_id, user_id, created_at')
      .eq('user_id', currentId)
      .limit(300);
    if (!error && data && Array.isArray(data)) {
      localStorage.setItem(VALUE_LIKES_KEY, JSON.stringify(data));
      return data;
    }
  } catch (e) {
    console.error('Error refreshing value likes from Supabase:', e);
  }
  return getValueLikes();
}

export function getValueComments(postId?: string): ValueComment[] {
  const comments = getItem<ValueComment[]>(VALUE_COMMENTS_KEY);
  if (postId) {
    return comments.filter(c => c.post_id === postId).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }
  return comments;
}

export async function refreshValueCommentsFromSupabase(): Promise<ValueComment[]> {
  try {
    const { data, error } = await supabase
      .from('value_comments')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(200);
    if (!error && data && Array.isArray(data)) {
      localStorage.setItem(VALUE_COMMENTS_KEY, JSON.stringify(data));
      return data;
    }
  } catch (e) {
    console.error('Error refreshing value comments from Supabase:', e);
  }
  return getValueComments();
}

export function getUserCommentsCountToday(userId?: string): number {
  const currentId = userId || getCurrentUserId();
  const todayStr = getLocalDateString();
  const comments = getValueComments();
  return comments.filter(c => c.user_id === currentId && getLocalDateString(new Date(c.created_at)) === todayStr).length;
}

export function canUserCommentToday(userId?: string): { canComment: boolean; countToday: number; remaining: number } {
  const countToday = getUserCommentsCountToday(userId);
  const remaining = Math.max(0, 5 - countToday);
  return {
    canComment: countToday < 5,
    countToday,
    remaining
  };
}

export async function createValueComment(postId: string, content: string, parentId?: string, replyToUserName?: string): Promise<{ success: boolean; comment?: ValueComment; message?: string }> {
  const check = canUserCommentToday();
  if (!check.canComment) {
    return { success: false, message: 'Has alcanzado el límite diario de 5 respuestas.' };
  }

  const currentId = getCurrentUserId();
  const users = getAllUsers();
  const curr = users.find((u: any) => u.id === currentId);
  const comments = getItem<ValueComment[]>(VALUE_COMMENTS_KEY);

  const newComment: ValueComment = {
    id: 'comm_' + Math.random().toString(36).substr(2, 9),
    post_id: postId,
    user_id: currentId,
    parent_id: parentId || null,
    reply_to_user_name: replyToUserName || null,
    author_name: curr?.name || 'Usuario',
    author_avatar: curr?.avatar_url || '',
    author_level: curr?.level || 1,
    content: content.trim(),
    created_at: new Date().toISOString()
  };

  comments.push(newComment);
  setItem(VALUE_COMMENTS_KEY, comments);

  try {
    const { error } = await supabase.from('value_comments').upsert([newComment]);
    if (error) {
      console.warn('Note: value_comments table not yet created in Supabase. Comment saved locally.', error);
    }
  } catch (e) {
    console.error('Error upserting value comment to Supabase:', e);
  }

  return { success: true, comment: newComment };
}

export async function deleteValueComment(commentId: string): Promise<void> {
  const comments = getItem<ValueComment[]>(VALUE_COMMENTS_KEY);
  setItem(VALUE_COMMENTS_KEY, comments.filter(c => c.id !== commentId));

  try {
    await supabase.from('value_comments').delete().eq('id', commentId);
  } catch (e) {
    console.error('Error deleting value comment in Supabase:', e);
  }
}

export async function createValuePost(content: string): Promise<{ success: boolean; post?: ValuePost; message?: string }> {
  const check = canUserPostValueToday();
  if (!check.canPost) {
    return { success: false, message: 'Ya has compartido tu reflexión de hoy. Límite de 1 publicación diaria.' };
  }

  const currentId = getCurrentUserId();
  const users = getAllUsers();
  const curr = users.find((u: any) => u.id === currentId);
  const posts = getItem<ValuePost[]>(VALUE_POSTS_KEY);
  
  const newPost: ValuePost & { author_name?: string; author_avatar?: string; author_level?: number; likes_count?: number } = {
    id: 'post_' + Math.random().toString(36).substr(2, 9),
    user_id: currentId,
    author_name: curr?.name || 'Usuario',
    author_avatar: curr?.avatar_url || '',
    author_level: curr?.level || 1,
    content,
    likes_count: 0,
    created_at: new Date().toISOString()
  };

  posts.unshift(newPost as ValuePost);
  setItem(VALUE_POSTS_KEY, posts);

  try {
    if (curr) {
      await supabase.from('users').upsert([{
        id: curr.id,
        name: curr.name,
        username: curr.username || curr.name,
        avatar_url: curr.avatar_url || '',
        level: curr.level || 1,
        xp: curr.xp || 0,
        created_at: curr.created_at || new Date().toISOString()
      }]);
    }
    await supabase.from('value_posts').upsert([{
      id: newPost.id,
      user_id: newPost.user_id,
      author_name: newPost.author_name,
      author_avatar: newPost.author_avatar,
      author_level: newPost.author_level,
      content: newPost.content,
      likes_count: 0,
      created_at: newPost.created_at
    }]);
  } catch (e) {
    console.error('Error upserting value post in Supabase:', e);
  }

  return { success: true, post: newPost as ValuePost };
}

export async function editValuePost(postId: string, newContent: string): Promise<void> {
  const posts = getItem<ValuePost[]>(VALUE_POSTS_KEY);
  setItem(VALUE_POSTS_KEY, posts.map(p => p.id === postId ? { ...p, content: newContent } : p));
  
  try {
    await supabase.from('value_posts').update({ content: newContent }).eq('id', postId);
  } catch (e) {
    console.error('Error updating value post in Supabase:', e);
  }
}

export async function deleteValuePost(postId: string): Promise<void> {
  const posts = getItem<ValuePost[]>(VALUE_POSTS_KEY);
  setItem(VALUE_POSTS_KEY, posts.filter(p => p.id !== postId));
  // Also delete associated likes and comments
  const likes = getItem<ValueLike[]>(VALUE_LIKES_KEY);
  setItem(VALUE_LIKES_KEY, likes.filter(l => l.post_id !== postId));
  const comments = getItem<ValueComment[]>(VALUE_COMMENTS_KEY);
  setItem(VALUE_COMMENTS_KEY, comments.filter(c => c.post_id !== postId));

  try {
    await supabase.from('value_likes').delete().eq('post_id', postId);
    await supabase.from('value_comments').delete().eq('post_id', postId);
    await supabase.from('value_posts').delete().eq('id', postId);
  } catch (e) {
    console.error('Error deleting value post in Supabase:', e);
  }
}

export function getValueLikes(): ValueLike[] {
  return getItem<ValueLike[]>(VALUE_LIKES_KEY);
}

export async function toggleValueLike(postId: string, postAuthorId: string) {
  const likes = getValueLikes();
  const currentUserId = getCurrentUserId();
  const existingLike = likes.find(l => l.post_id === postId && l.user_id === currentUserId);
  const posts = getValuePosts();
  const postIndex = posts.findIndex(p => p.id === postId);
  
  if (existingLike) {
    const updated = likes.filter(l => !(l.post_id === postId && l.user_id === currentUserId));
    setItem(VALUE_LIKES_KEY, updated);
    // Deduct 1 XP from author
    updateUserXPById(postAuthorId, -1);

    if (postIndex >= 0) {
      posts[postIndex].likes_count = Math.max(0, (posts[postIndex].likes_count || 1) - 1);
      setItem(VALUE_POSTS_KEY, posts);
    }

    try {
      await supabase.from('value_likes').delete().eq('id', existingLike.id);
      if (postIndex >= 0) {
        await supabase.from('value_posts').update({ likes_count: posts[postIndex].likes_count }).eq('id', postId);
      }
      await updateUserXPInSupabase(postAuthorId, -1);
    } catch (e) {
      console.error('Error removing like from Supabase:', e);
    }
  } else {
    const newLikeId = `like_${postId}_${currentUserId}`;
    const newLike: ValueLike = {
      id: newLikeId,
      post_id: postId,
      user_id: currentUserId,
      created_at: new Date().toISOString()
    };
    likes.push(newLike);
    setItem(VALUE_LIKES_KEY, likes);
    // Add 1 XP to author
    updateUserXPById(postAuthorId, 1);

    if (postIndex >= 0) {
      posts[postIndex].likes_count = (posts[postIndex].likes_count || 0) + 1;
      setItem(VALUE_POSTS_KEY, posts);
    }

    try {
      await supabase.from('value_likes').upsert([{
        id: newLike.id,
        post_id: newLike.post_id,
        user_id: newLike.user_id,
        created_at: newLike.created_at
      }]);
      if (postIndex >= 0) {
        await supabase.from('value_posts').update({ likes_count: posts[postIndex].likes_count }).eq('id', postId);
      }
      await updateUserXPInSupabase(postAuthorId, 1);
    } catch (e) {
      console.error('Error saving like to Supabase:', e);
    }
  }
}

export async function updateUserXPInSupabase(userId: string, amount: number) {
  if (!userId) return;
  try {
    // 1. Try atomic PostgreSQL RPC increment (zero race conditions)
    const { error: rpcError } = await supabase.rpc('atomic_increment_user_xp', {
      p_user_id: userId,
      p_amount: amount
    });
    if (!rpcError) return;

    // 2. Fallback if RPC function not created in DB yet
    const { data: remoteUser, error } = await supabase
      .from('users')
      .select('id, xp, level')
      .eq('id', userId)
      .maybeSingle();

    if (!error && remoteUser) {
      const newXp = Math.max(0, (remoteUser.xp || 0) + amount);
      const newLevel = Math.floor(newXp / 200) + 1;
      await supabase
        .from('users')
        .update({ xp: newXp, level: newLevel })
        .eq('id', userId);
    }
  } catch (e) {
    console.error('Error updating XP in Supabase for user', userId, e);
  }
}

export function updateUserXPById(userId: string, amount: number) {
  const users = getItem<User[]>(KEYS.USERS);
  const index = users.findIndex(u => u.id === userId);
  if (index >= 0) {
    users[index].xp = Math.max(0, users[index].xp + amount);
    setItem(KEYS.USERS, users);
  }
}

export function updateUserProfile(
  userIdOrName: string, 
  updatesOrEmail?: Partial<User> | string, 
  avatarUrl?: string,
  extra?: {
    username?: string;
    bio?: string;
    gender?: string;
    links?: { title: string; url: string; }[];
    grid_items?: string[];
  }
): User {
  const users = getItem<User[]>(KEYS.USERS);
  const currentId = getCurrentUserId();
  const isObjectCall = typeof updatesOrEmail === 'object' && updatesOrEmail !== null;
  const targetId = isObjectCall ? userIdOrName : currentId;
  
  let updates: Partial<User> = {};
  if (isObjectCall) {
    updates = updatesOrEmail as Partial<User>;
  } else {
    updates = {
      name: userIdOrName,
      ...(updatesOrEmail !== undefined ? { email: updatesOrEmail as string } : {}),
      ...(avatarUrl !== undefined ? { avatar_url: avatarUrl } : {}),
      ...(extra || {})
    };
  }

  let updatedUser: User | undefined;
  const updatedUsers = users.map(u => {
    if (u.id === targetId) {
      updatedUser = { ...u, ...updates };
      return updatedUser;
    }
    return u;
  });

  if (updatedUser) {
    setItem(KEYS.USERS, updatedUsers);

    // Update cached ranking if present
    try {
      const cachedRanking: User[] = JSON.parse(localStorage.getItem('winterarc_cached_ranking') || '[]');
      const rIdx = cachedRanking.findIndex(u => u.id === targetId);
      if (rIdx >= 0) {
        cachedRanking[rIdx] = { ...cachedRanking[rIdx], ...updatedUser };
        localStorage.setItem('winterarc_cached_ranking', JSON.stringify(cachedRanking));
      }
    } catch (e) {}

    // 1. Update SQL columns in Supabase users table
    const dbPayload: Record<string, any> = {};
    if (updatedUser.avatar_url !== undefined) dbPayload.avatar_url = updatedUser.avatar_url;
    if (updatedUser.name !== undefined) dbPayload.name = updatedUser.name;
    if (updatedUser.username !== undefined) dbPayload.username = updatedUser.username;

    if (Object.keys(dbPayload).length > 0) {
      supabase.from('users').update(dbPayload).eq('id', updatedUser.id).then((res) => {
        if (res?.error) console.warn('Note: users table profile sync notice:', res.error.message);
      });
    }

    // 2. Persist avatar_frame, name_color, title, avatar_url permanently in Supabase Auth user_metadata
    supabase.auth.updateUser({
      data: {
        avatar_frame: updatedUser.avatar_frame || 'default',
        name_color: updatedUser.name_color || 'default',
        title: updatedUser.title || 'Iniciado del Frío',
        avatar_url: updatedUser.avatar_url
      }
    }).then();

    return updatedUser;
  }

  return (getCurrentUser() || {}) as User;
}

// Goals Services
export function getGoals(userId?: string): Goal[] {
  const targetId = userId || getCurrentUserId();
  const goals = getItem<Goal[]>(KEYS.GOALS) || [];
  const userGoals = goals.filter(g => g.user_id === targetId);
  
  if (userGoals.length === 0) {
    if (targetId === 'user_elena' || targetId === 'elena') {
      return [{
        id: 'goal_elena_fitness',
        user_id: targetId,
        title: 'Salud & Rendimiento Deportivo',
        description: 'Mantener consistencia perfecta en entrenamientos diarios de fuerza y running.',
        category: 'Físico',
        priority: 1,
        privacy: 'public',
        created_at: new Date().toISOString()
      }];
    }
    if (targetId === 'user_lucas' || targetId === 'lucas') {
      return [{
        id: 'goal_lucas_fitness',
        user_id: targetId,
        title: 'Salud & Rendimiento Deportivo',
        description: 'Entrenar duro por las mañanas para elevar la energía y resistencia física.',
        category: 'Físico',
        priority: 1,
        privacy: 'public',
        created_at: new Date().toISOString()
      }];
    }
    if (targetId === 'user_sofia' || targetId === 'sofia') {
      return [{
        id: 'goal_sofia_business',
        user_id: targetId,
        title: 'Lanzar mi propia startup',
        description: 'Programar a diario el MVP y validar el modelo de negocio con usuarios reales.',
        category: 'Negocio',
        priority: 1,
        privacy: 'public',
        created_at: new Date().toISOString()
      }];
    }
    if (targetId === 'user_adri' || targetId === 'adri') {
      return [{
        id: 'goal_adri_growth',
        user_id: targetId,
        title: 'Crecimiento Personal',
        description: 'Leer a diario y cultivar hábitos de disciplina inquebrantable.',
        category: 'Mentalidad',
        priority: 1,
        privacy: 'public',
        created_at: new Date().toISOString()
      }];
    }
  }
  return userGoals;
}

export function createGoals(goalTitles: string[], topThreeIndices: number[], categories: string[]): Goal[] {
  const currentId = getCurrentUserId();
  const existingGoals = getItem<Goal[]>(KEYS.GOALS);
  
  const newGoals: Goal[] = goalTitles.map((title, index) => ({
    id: 'goal_' + Math.random().toString(36).substr(2, 9),
    user_id: currentId,
    title,
    category: categories[index] || 'Productividad',
    priority: topThreeIndices.includes(index) ? 1 : 0,
    privacy: 'public',
    created_at: new Date().toISOString()
  }));

  setItem(KEYS.GOALS, [...existingGoals, ...newGoals]);
  return newGoals;
}

export function createSingleGoal(title: string, description: string, privacy: Goal['privacy'] = 'public', category: string = 'Salud'): Goal {
  const currentId = getCurrentUserId();
  const existingGoals = getItem<Goal[]>(KEYS.GOALS);
  
  const newGoal: Goal = {
    id: 'goal_' + Math.random().toString(36).substr(2, 9),
    user_id: currentId,
    title,
    description,
    isTopThree: false,
    privacy,
    category,
    priority: 0,
    created_at: new Date().toISOString()
  };
  
  existingGoals.push(newGoal);
  setItem(KEYS.GOALS, existingGoals);
  return newGoal;
}

// Habits Services
export function getHabits(userId?: string): Habit[] {
  const currentId = userId || getCurrentUserId();
  const habits = getItem<Habit[]>(KEYS.HABITS);
  return habits.filter(h => (!currentId || h.user_id === currentId) && !h.archived);
}

export function createHabit(
  name: string, 
  goalId: string, 
  frequency: Habit['frequency'], 
  privacy: Habit['privacy'], 
  customDays?: number[],
  isQuantitative?: boolean,
  targetCount?: number,
  unit?: string,
  isTimeBased?: boolean,
  targetTimeMinutes?: number,
  requiresPhoto?: boolean,
  category?: string
): Habit {
  const currentId = getCurrentUserId();
  const habits = getItem<Habit[]>(KEYS.HABITS);
  
  let finalCategory = category;
  if (!finalCategory && goalId && goalId !== 'auto_generated') {
    const goals = getItem<Goal[]>(KEYS.GOALS);
    const associatedGoal = goals.find(g => g.id === goalId);
    if (associatedGoal) {
      finalCategory = associatedGoal.category;
    }
  }
  if (!finalCategory) {
    const inferred = inferHabitParams(name);
    finalCategory = inferred.category;
  }

  const newHabit: Habit = {
    id: 'habit_' + Math.random().toString(36).substr(2, 9),
    user_id: currentId,
    goal_id: goalId,
    name,
    category: finalCategory || 'Salud',
    frequency,
    custom_days: customDays,
    privacy,
    current_streak: 0,
    best_streak: 0,
    wildcard_available: true,
    archived: false,
    created_at: new Date().toISOString(),
    is_quantitative: isQuantitative,
    target_count: targetCount,
    unit,
    is_time_based: isTimeBased,
    target_time_minutes: targetTimeMinutes,
    requires_photo: requiresPhoto ?? true
  };
  
  habits.push(newHabit);
  setItem(KEYS.HABITS, habits);
  
  return newHabit;
}

export function completeHabit(habitId: string, photoUrl: string = '', explicitUserId?: string): { habit: Habit, xpEarned: number, badgeEarned: Badge | null } {
  // Always run maintenance before completing to keep streak logic fresh
  runDailyMaintenance();

  const currentId = explicitUserId || getCurrentUserId();
  const habits = getItem<Habit[]>(KEYS.HABITS);
  const completions = getItem<HabitCompletion[]>(KEYS.COMPLETIONS);
  const todayStr = getLocalDateString();

  const h = habits.find(x => x.id === habitId && (!currentId || x.user_id === currentId));
  if (!h) {
    return { habit: {} as Habit, xpEarned: 0, badgeEarned: null };
  }

  // Prevent multiple completions on the same day for this user
  const alreadyCompleted = completions.some(c => c.user_id === currentId && c.habit_id === habitId && c.date === todayStr && c.is_fully_completed !== false);
  if (alreadyCompleted) {
    return { habit: h, xpEarned: 0, badgeEarned: null };
  }

  // Remove any partial completion record for today so it doesn't duplicate
  const cleanCompletions = completions.filter(c => !(c.user_id === currentId && c.habit_id === habitId && c.date === todayStr));

  // Create completion with deterministic ID (guarantees idempotency across devices)
  const deterministicCompId = `comp_${currentId}_${habitId}_${todayStr}`;
  const newCompletion: HabitCompletion = {
    id: deterministicCompId,
    habit_id: habitId,
    user_id: currentId,
    date: todayStr,
    photo_url: photoUrl,
    completed_at: new Date().toISOString(),
    used_wildcard: false,
    current_progress: h.is_quantitative ? h.target_count : (h.is_time_based ? (h.target_time_minutes || 60) * 60 : 1),
    is_fully_completed: true
  };
  cleanCompletions.push(newCompletion);
  localStorage.setItem(KEYS.COMPLETIONS, JSON.stringify(cleanCompletions));

  // Sync habit and completion directly to Supabase in background
  (async () => {
    try {
      const users = getItem<User[]>(KEYS.USERS);
      const currUser = users.find(u => u.id === currentId);
      if (currUser) {
        await supabase.from('users').upsert([cleanUserForSupabase(currUser)]);
      }
      await supabase.from('habits').upsert([{
        id: h.id,
        user_id: currentId,
        name: h.name,
        frequency: h.frequency || 'daily',
        current_streak: (h.current_streak || 0) + 1,
        best_streak: Math.max(h.best_streak || 0, (h.current_streak || 0) + 1),
        wildcard_available: h.wildcard_available ?? true,
        archived: false,
        created_at: h.created_at || new Date().toISOString()
      }]);

      const { error: compError } = await supabase.from('completions').upsert([{
        id: newCompletion.id,
        user_id: currentId,
        habit_id: habitId,
        date: todayStr,
        is_fully_completed: true
      }]);
      if (compError) {
        console.error('Error upserting completion to Supabase:', compError);
      }
    } catch (e) {
      console.error('Exception syncing completion to Supabase:', e);
    }
  })();

  // Update habit streak
  let updatedHabit!: Habit;
  const updatedHabits = habits.map(habit => {
    if (habit.id === habitId && (!currentId || habit.user_id === currentId)) {
      const newStreak = calculateStreak(habit.id, cleanCompletions, todayStr, habit, currentId);
      const newBest = Math.max(habit.best_streak, newStreak);
      updatedHabit = {
        ...habit,
        current_streak: newStreak,
        best_streak: newBest
      };
      return updatedHabit;
    }
    return habit;
  });
  localStorage.setItem(KEYS.HABITS, JSON.stringify(updatedHabits));

  // Update XP (+10 XP for habit completion)
  const xpEarned = 10;
  updateUserXP(xpEarned);

  // Challenge Progress update
  updateChallengeProgress(habitId);

  // Tribe Progress update
  updateTribeProgress(habitId, photoUrl);

  // Check Badges
  const badgeEarned = evalCompletionsForBadges();

  return {
    habit: updatedHabit || h,
    xpEarned,
    badgeEarned
  };
}

export function getHabitProgressToday(habitId: string, customDateStr?: string): number {
  const currentId = getCurrentUserId();
  const completions = getItem<HabitCompletion[]>(KEYS.COMPLETIONS);
  const targetDateStr = customDateStr || getLocalDateString();
  const comp = completions.find(c => c.habit_id === habitId && c.date === targetDateStr && c.user_id === currentId);
  return comp ? (comp.current_progress || 0) : 0;
}

export function updateHabitProgressToday(habitId: string, progressValue: number, customDateStr?: string): { success: boolean; habit?: Habit; isCompleted: boolean; xpEarned: number; badgeEarned: Badge | null } {
  runDailyMaintenance();

  const currentId = getCurrentUserId();
  const habits = getItem<Habit[]>(KEYS.HABITS);
  const completions = getItem<HabitCompletion[]>(KEYS.COMPLETIONS);
  const targetDateStr = customDateStr || getLocalDateString();

  const h = habits.find(x => x.id === habitId);
  if (!h) {
    return { success: false, isCompleted: false, xpEarned: 0, badgeEarned: null };
  }

  // Find existing completion for the target date
  let compIndex = completions.findIndex(c => c.habit_id === habitId && c.date === targetDateStr);
  let isNewCompletion = false;
  let comp: HabitCompletion;

  if (compIndex === -1) {
    isNewCompletion = true;
    comp = {
      id: 'comp_' + Math.random().toString(36).substr(2, 9),
      habit_id: habitId,
      user_id: currentId,
      date: targetDateStr,
      photo_url: '',
      completed_at: new Date().toISOString(),
      used_wildcard: false,
      current_progress: Math.max(0, progressValue),
      is_fully_completed: false
    };
    completions.push(comp);
  } else {
    comp = completions[compIndex];
    comp.current_progress = Math.max(0, (comp.current_progress || 0) + progressValue);
    comp.completed_at = new Date().toISOString();
    completions[compIndex] = comp;
  }

  setItem(KEYS.COMPLETIONS, completions);

  // Check if it's fully completed now
  let target = 1;
  if (h.is_quantitative && h.target_count) {
    target = h.target_count;
  } else if (h.is_time_based && h.target_time_minutes) {
    target = h.target_time_minutes * 60;
  }

  const reachedTarget = (comp.current_progress || 0) >= target;
  let isCompleted = false;
  let xpEarned = 0;
  let badgeEarned: Badge | null = null;

  // Only transition to fully completed if it wasn't fully completed before
  if (reachedTarget && !comp.is_fully_completed) {
    comp.is_fully_completed = true;
    isCompleted = true;
    
    // Save completion state again
    setItem(KEYS.COMPLETIONS, completions);

    // Update habit streak
    const updatedHabits = habits.map(habit => {
      if (habit.id === habitId) {
        const newStreak = habit.current_streak + 1;
        const newBest = Math.max(habit.best_streak, newStreak);
        return {
          ...habit,
          current_streak: newStreak,
          best_streak: newBest
        };
      }
      return habit;
    });
    setItem(KEYS.HABITS, updatedHabits);

    // Award XP (+10 XP for habit completion)
    xpEarned = 10;
    updateUserXP(xpEarned);

    // Challenge Progress update
    updateChallengeProgress(habitId);

    // Tribe Progress update
    updateTribeProgress(habitId, '');

    // Check Badges
    badgeEarned = evalCompletionsForBadges();
  } else if (!reachedTarget && comp.is_fully_completed) {
    // Transition back to incomplete
    comp.is_fully_completed = false;
    
    // Save completion state again
    setItem(KEYS.COMPLETIONS, completions);

    // Recalculate streak using targetDateStr
    const newStreak = calculateStreak(habitId, completions, targetDateStr);
    
    // Update habit data
    const updatedHabits = habits.map(habit => {
      if (habit.id === habitId) {
        return {
          ...habit,
          current_streak: newStreak
        };
      }
      return habit;
    });
    setItem(KEYS.HABITS, updatedHabits);

    // Deduct XP (-10 XP & -10 coins)
    updateUserXP(-10);
  }

  return {
    success: true,
    habit: habits.find(x => x.id === habitId),
    isCompleted,
    xpEarned,
    badgeEarned
  };
}

export function uncompleteHabit(habitId: string, customDateStr?: string, explicitUserId?: string): { habit: Habit; xpLost: number } {
  const currentId = explicitUserId || getCurrentUserId();
  const habits = getItem<Habit[]>(KEYS.HABITS);
  const completions = getItem<HabitCompletion[]>(KEYS.COMPLETIONS);
  const targetDateStr = customDateStr || getLocalDateString();

  const h = habits.find(x => x.id === habitId && (!currentId || x.user_id === currentId));
  if (!h) {
    return { habit: {} as Habit, xpLost: 0 };
  }

  // Remove completion for the target date
  const updatedCompletions = completions.filter(c => !(c.user_id === currentId && c.habit_id === habitId && c.date === targetDateStr));
  localStorage.setItem(KEYS.COMPLETIONS, JSON.stringify(updatedCompletions));

  // Delete from Supabase in background
  (async () => {
    try {
      const { error: delError } = await supabase
        .from('completions')
        .delete()
        .eq('habit_id', habitId)
        .eq('date', targetDateStr)
        .eq('user_id', currentId);
      if (delError) {
        console.error('Error deleting completion from Supabase:', delError);
      }
    } catch (e) {
      console.error('Exception deleting completion from Supabase:', e);
    }
  })();

  // Recalculate streak
  const newStreak = calculateStreak(habitId, updatedCompletions, targetDateStr, h, currentId);

  let updatedHabit!: Habit;
  const updatedHabits = habits.map(habit => {
    if (habit.id === habitId && (!currentId || habit.user_id === currentId)) {
      updatedHabit = {
        ...habit,
        current_streak: newStreak
      };
      return updatedHabit;
    }
    return habit;
  });
  localStorage.setItem(KEYS.HABITS, JSON.stringify(updatedHabits));

  // Deduct XP (-10 XP & -10 coins)
  updateUserXP(-10);

  return {
    habit: updatedHabit || h,
    xpLost: 10
  };
}

export function getAllTasks(): Task[] {
  return getItem<Task[]>(KEYS.TASKS);
}

export function getTasksToday(): Task[] {
  // Always run maintenance before querying tasks to keep rolls fresh
  runDailyMaintenance();

  const currentId = getCurrentUserId();
  const todayStr = getLocalDateString();
  const tasks = getItem<Task[]>(KEYS.TASKS);
  return tasks.filter(t => t.user_id === currentId && t.date === todayStr);
}

export function createTask(title: string, priority: 1 | 2 | 3 = 2): Task {
  const currentId = getCurrentUserId();
  const tasks = getItem<Task[]>(KEYS.TASKS);
  
  const newTask: Task = {
    id: 'task_' + Math.random().toString(36).substr(2, 9),
    user_id: currentId,
    title,
    date: getLocalDateString(),
    completed: false,
    created_at: new Date().toISOString(),
    priority
  };
  
  tasks.push(newTask);
  setItem(KEYS.TASKS, tasks);
  return newTask;
}

export function toggleTask(taskId: string): Task {
  const tasks = getItem<Task[]>(KEYS.TASKS);
  let updatedTask!: Task;
  
  const updatedTasks = tasks.map(task => {
    if (task.id === taskId) {
      const completed = !task.completed;
      updatedTask = {
        ...task,
        completed,
        completed_at: completed ? new Date().toISOString() : undefined
      };
      
      // Award +3 XP on completion, deduct on uncompletion
      if (completed) {
        updateUserXP(3);
      } else {
        updateUserXP(-3);
      }
      
      return updatedTask;
    }
    return task;
  });
  
  setItem(KEYS.TASKS, updatedTasks);
  return updatedTask;
}

export function deleteTask(taskId: string): void {
  const tasks = getItem<Task[]>(KEYS.TASKS);
  setItem(KEYS.TASKS, tasks.filter(t => t.id !== taskId));
}

export function editTask(taskId: string, newTitle: string, newPriority?: 1 | 2 | 3): void {
  const tasks = getItem<Task[]>(KEYS.TASKS);
  setItem(KEYS.TASKS, tasks.map(t => t.id === taskId ? { ...t, title: newTitle, priority: newPriority ?? t.priority } : t));
}

// Friendship / Social Services
export function getFriends(): User[] {
  const currentId = getCurrentUserId();
  const friendships = getItem<Friendship[]>(KEYS.FRIENDSHIPS);
  const users = getItem<User[]>(KEYS.USERS);
  
  const friendIds = friendships
    .filter(f => f.status === 'accepted' && (f.requester_id === currentId || f.receiver_id === currentId))
    .map(f => f.requester_id === currentId ? f.receiver_id : f.requester_id);
    
  return users.filter(u => friendIds.includes(u.id));
}

export function getPendingRequests(): { received: Friendship[], sent: Friendship[] } {
  const currentId = getCurrentUserId();
  const friendships = getItem<Friendship[]>(KEYS.FRIENDSHIPS);
  
  return {
    received: friendships.filter(f => f.status === 'pending' && f.receiver_id === currentId),
    sent: friendships.filter(f => f.status === 'pending' && f.requester_id === currentId)
  };
}

export function searchUsers(query: string): User[] {
  const currentId = getCurrentUserId();
  const users = getItem<User[]>(KEYS.USERS);
  const normalizedQuery = query.toLowerCase().replace('@', '');
  
  if (!normalizedQuery) return [];
  
  return users.filter(u => 
    u.id !== currentId && 
    (u.username.includes(normalizedQuery) || u.name.toLowerCase().includes(normalizedQuery))
  );
}

export function sendFriendRequest(receiverId: string): Friendship {
  const currentId = getCurrentUserId();
  const friendships = getItem<Friendship[]>(KEYS.FRIENDSHIPS);
  
  const existing = friendships.find(f => 
    (f.requester_id === currentId && f.receiver_id === receiverId) ||
    (f.requester_id === receiverId && f.receiver_id === currentId)
  );
  
  if (existing) return existing;

  const newRequest: Friendship = {
    id: 'friendship_' + Math.random().toString(36).substr(2, 9),
    requester_id: currentId,
    receiver_id: receiverId,
    status: 'pending',
    created_at: new Date().toISOString()
  };
  
  friendships.push(newRequest);
  setItem(KEYS.FRIENDSHIPS, friendships);

  // Create notification for receiver
  const sender = getCurrentUser();
  addNotification({
    user_id: receiverId,
    type: 'friend_request',
    title: 'Solicitud de Amistad 👤',
    body: `@${sender?.username || 'Un usuario'} te ha enviado una solicitud de amistad.`
  });

  return newRequest;
}

export function acceptFriendRequest(requestId: string): Friendship {
  const friendships = getItem<Friendship[]>(KEYS.FRIENDSHIPS);
  const found = friendships.find(f => f.id === requestId);
  if (!found) {
    return {} as Friendship;
  }
  
  let updatedFriendship!: Friendship;
  const updated = friendships.map(f => {
    if (f.id === requestId) {
      updatedFriendship = { ...f, status: 'accepted' as const };
      
      // Notify sender
      const receiver = getCurrentUser();
      addNotification({
        user_id: f.requester_id,
        type: 'friend_accepted',
        title: 'Solicitud Aceptada ✅',
        body: `@${receiver?.username || 'Un usuario'} aceptó tu solicitud. ¡Empieza a competir!`
      });

      // Reward small XP for adding friends (+10 XP)
      updateUserXP(10);
      
      return updatedFriendship;
    }
    return f;
  });
  
  setItem(KEYS.FRIENDSHIPS, updated);
  checkAndAwardBadge('badge_first_friend');
  
  return updatedFriendship;
}

export function rejectFriendRequest(requestId: string): void {
  const requests = getItem<Friendship[]>(KEYS.FRIENDSHIPS);
  setItem(KEYS.FRIENDSHIPS, requests.filter(r => r.id !== requestId));
}

export function removeFriend(friendId: string): void {
  const currentId = getCurrentUserId();
  const friendships = getItem<Friendship[]>(KEYS.FRIENDSHIPS);
  setItem(KEYS.FRIENDSHIPS, friendships.filter(f => 
    !((f.requester_id === currentId && f.receiver_id === friendId) || 
      (f.receiver_id === currentId && f.requester_id === friendId))
  ));
}

// Tribes Services
export function isHabitCompletedToday(userId: string, habitName: string): boolean {
  const habits = getItem<Habit[]>(KEYS.HABITS).filter(h => h.user_id === userId && h.name.toLowerCase() === habitName.toLowerCase());
  if (habits.length === 0) return false;
  const completions = getItem<HabitCompletion[]>(KEYS.COMPLETIONS);
  const todayStr = getLocalDateString();
  return completions.some(c => c.user_id === userId && c.date === todayStr && c.is_fully_completed !== false && habits.some(h => h.id === c.habit_id));
}

export function getTribes(): any[] {
  // Always run maintenance before querying tribes to keep rolls fresh
  runDailyMaintenance();

  const currentId = getCurrentUserId();
  const tribes = getItem<Tribe[]>(KEYS.TRIBES);
  const members = getItem<TribeMember[]>(KEYS.TRIBE_MEMBERS);
  
  const myMemberRecords = members.filter(m => m.user_id === currentId);
  const myTribes = myMemberRecords.map(m => m.tribe_id);
  
  return tribes
    .filter(t => myTribes.includes(t.id))
    .map(t => {
      const myRecord = myMemberRecords.find(m => m.tribe_id === t.id);
      const tribeMembers = members.filter(m => m.tribe_id === t.id && m.status !== 'pending');
      const membersCount = tribeMembers.length;
      
      let completedToday = 0;
      tribeMembers.forEach(m => {
        if (isHabitCompletedToday(m.user_id, t.habit_name)) {
          completedToday++;
        }
      });
      
      const myStatus = isHabitCompletedToday(currentId, t.habit_name);
      
      return {
        ...t,
        membersCount,
        completedToday,
        myStatus,
        pendingInvite: myRecord?.status === 'pending'
      };
    });
}

export function getTribeDetails(tribeId: string): Tribe & { 
  members: (User & { role: 'admin' | 'member', completedToday: boolean, photoUrl?: string })[],
  messages: (TribeMessage & { username: string, name: string, avatarUrl: string })[]
} {
  const tribes = getItem<Tribe[]>(KEYS.TRIBES);
  const members = getItem<TribeMember[]>(KEYS.TRIBE_MEMBERS);
  const users = getItem<User[]>(KEYS.USERS);
  const messages = getItem<TribeMessage[]>(KEYS.TRIBE_MESSAGES);
  
  const todayStr = getLocalDateString();
  const tribe = tribes.find(t => t.id === tribeId);
  if (!tribe) {
    return {
      id: '',
      name: '',
      habit_name: '',
      current_streak: 0,
      best_streak: 0,
      wildcard_available: false,
      created_by: '',
      created_at: '',
      members: [],
      messages: []
    };
  }
  
  const tribeMembers = members.filter(m => m.tribe_id === tribeId && m.status !== 'pending').map(m => {
    const user = users.find(u => u.id === m.user_id);
    if (!user) return null;
    
    const completedToday = isHabitCompletedToday(m.user_id, tribe.habit_name);
    
    // Find photo url if any from completions
    const completions = getItem<HabitCompletion[]>(KEYS.COMPLETIONS);
    const userHabits = getItem<Habit[]>(KEYS.HABITS).filter(h => h.user_id === m.user_id && h.name.toLowerCase() === tribe.habit_name.toLowerCase());
    const completion = completions.find(c => c.user_id === m.user_id && c.date === todayStr && userHabits.some(uh => uh.id === c.habit_id));
    
    return {
      ...user,
      role: m.role,
      completedToday,
      photoUrl: completion?.photo_url
    } as any;
  }).filter((x): x is NonNullable<typeof x> => x !== null);
  
  const tribeMessages = messages
    .filter(m => m.tribe_id === tribeId)
    .map(m => {
      const user = users.find(u => u.id === m.user_id);
      if (!user) return null;
      return {
        ...m,
        username: user.username,
        name: user.name,
        avatarUrl: user.avatar_url || ''
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  return {
    ...tribe,
    members: tribeMembers,
    messages: tribeMessages
  };
}

export function createTribe(name: string, habitName: string, invitedFriendIds: string[]): Tribe {
  const currentId = getCurrentUserId();
  const tribes = getItem<Tribe[]>(KEYS.TRIBES);
  
  const newTribe: Tribe = {
    id: 'tribe_' + Math.random().toString(36).substr(2, 9),
    name,
    habit_name: habitName,
    current_streak: 0,
    best_streak: 0,
    wildcard_available: true,
    created_by: currentId,
    created_at: new Date().toISOString()
  };
  
  tribes.push(newTribe);
  setItem(KEYS.TRIBES, tribes);
  
  const members = getItem<TribeMember[]>(KEYS.TRIBE_MEMBERS);
  
  // Add creator
  members.push({
    id: 'tbm_' + Math.random().toString(36).substr(2, 9),
    tribe_id: newTribe.id,
    user_id: currentId,
    role: 'admin',
    status: 'active',
    joined_at: new Date().toISOString()
  });
  
  // Add members (filter out invalid user IDs to ensure DB integrity)
  const users = getItem<User[]>(KEYS.USERS);
  const validFriendIds = invitedFriendIds.filter(friendId => users.some(u => u.id === friendId));

  // Add friends as pending
  validFriendIds.forEach(fId => {
    members.push({
      id: 'tbm_' + Math.random().toString(36).substr(2, 9),
      tribe_id: newTribe.id,
      user_id: fId,
      role: 'member',
      status: 'pending',
      joined_at: new Date().toISOString()
    });
    
    addNotification({
      user_id: fId,
      type: 'tribe_invite',
      title: 'Invitación de Tribu Ã°Å¸â€˜Â¥',
      body: `Te han invitado a la tribu "${name}". ¡Acepta para unirte!`
    });
  });
  
  setItem(KEYS.TRIBE_MEMBERS, members);
  checkAndAwardBadge('badge_tribe_created');

  return newTribe;
}

export function inviteToTribe(tribeId: string, friendId: string): void {
  const members = getItem<TribeMember[]>(KEYS.TRIBE_MEMBERS);
  const tribes = getItem<Tribe[]>(KEYS.TRIBES);
  
  const alreadyMember = members.some(m => m.tribe_id === tribeId && m.user_id === friendId);
  if (alreadyMember) return;
  
  const tribe = tribes.find(t => t.id === tribeId);
  if (!tribe) return;
  
  members.push({
    id: 'tbm_' + Math.random().toString(36).substr(2, 9),
    tribe_id: tribeId,
    user_id: friendId,
    role: 'member',
    status: 'pending',
    joined_at: new Date().toISOString()
  });
  
  addNotification({
    user_id: friendId,
    type: 'tribe_invite',
    title: 'Nueva Tribu Ã°Å¸â€˜Â¥',
    body: `Te han invitado a la tribu "${tribe.name}". ¡Únete al progreso!`
  });
  
  setItem(KEYS.TRIBE_MEMBERS, members);
}

export function acceptTribeInvite(tribeId: string): void {
  const currentId = getCurrentUserId();
  const members = getItem<TribeMember[]>(KEYS.TRIBE_MEMBERS);
  const updatedMembers = members.map(m => {
    if (m.tribe_id === tribeId && m.user_id === currentId) {
      return { ...m, status: 'active' as const };
    }
    return m;
  });
  setItem(KEYS.TRIBE_MEMBERS, updatedMembers);
}

export function rejectTribeInvite(tribeId: string): void {
  const currentId = getCurrentUserId();
  const members = getItem<TribeMember[]>(KEYS.TRIBE_MEMBERS);
  setItem(KEYS.TRIBE_MEMBERS, members.filter(m => !(m.tribe_id === tribeId && m.user_id === currentId)));
}

export function leaveTribe(tribeId: string): void {
  const currentId = getCurrentUserId();
  const members = getItem<TribeMember[]>(KEYS.TRIBE_MEMBERS);
  setItem(KEYS.TRIBE_MEMBERS, members.filter(m => !(m.tribe_id === tribeId && m.user_id === currentId)));
}

export function kickFromTribe(tribeId: string, userId: string): void {
  const members = getItem<TribeMember[]>(KEYS.TRIBE_MEMBERS);
  // Verify current user is admin
  const currentId = getCurrentUserId();
  const isAdmin = members.some(m => m.tribe_id === tribeId && m.user_id === currentId && m.role === 'admin');
  
  if (isAdmin) {
    setItem(KEYS.TRIBE_MEMBERS, members.filter(m => !(m.tribe_id === tribeId && m.user_id === userId)));
  }
}

export function sendTribeMessage(tribeId: string, message: string): TribeMessage {
  const currentId = getCurrentUserId();
  const messages = getItem<TribeMessage[]>(KEYS.TRIBE_MESSAGES);
  
  const newMessage: TribeMessage = {
    id: 'msg_' + Math.random().toString(36).substr(2, 9),
    tribe_id: tribeId,
    user_id: currentId,
    message,
    created_at: new Date().toISOString()
  };
  
  messages.push(newMessage);
  setItem(KEYS.TRIBE_MESSAGES, messages);
  return newMessage;
}

export function remindTribeMember(tribeId: string, pendingMemberId: string): void {
  const sender = getCurrentUser();
  const tribe = getTribeDetails(tribeId);
  
  addNotification({
    user_id: pendingMemberId,
    type: 'reminder',
    title: `Recordatorio de "${tribe.name}" Ã¢ÂÂ°`,
    body: `@${sender?.username || 'Un miembro'} te recuerda verificar tu hábito hoy para mantener la racha grupal.`
  });
}

function updateTribeProgress(habitId: string, photoUrl: string) {
  const currentId = getCurrentUserId();
  const habits = getItem<Habit[]>(KEYS.HABITS);
  const completedHabit = habits.find(h => h.id === habitId);
  if (!completedHabit) return;

  const tribes = getItem<Tribe[]>(KEYS.TRIBES);
  const members = getItem<TribeMember[]>(KEYS.TRIBE_MEMBERS);
  const completions = getItem<TribeCompletion[]>(KEYS.TRIBE_COMPLETIONS);
  const todayStr = getLocalDateString();

  // Find tribes this user belongs to that track this habit name
  const userTribes = members.filter(m => m.user_id === currentId).map(m => m.tribe_id);
  const matchingTribes = tribes.filter(t => userTribes.includes(t.id) && t.habit_name.toLowerCase() === completedHabit.name.toLowerCase());

  let tribesChanged = false;

  matchingTribes.forEach(t => {
    // Add completion record for this member in the tribe
    const alreadyCompleteds = completions.some(c => c.tribe_id === t.id && c.user_id === currentId && c.date === todayStr);
    if (!alreadyCompleteds) {
      completions.push({
        id: 'tc_' + Math.random().toString(36).substr(2, 9),
        tribe_id: t.id,
        user_id: currentId,
        date: todayStr,
        photo_url: photoUrl,
        completed_at: new Date().toISOString()
      });
    }
    
    // Check if ALL ACTIVE members completed for today to update tribe streak
    const activeTribeMembers = members.filter(m => m.tribe_id === t.id && m.status !== 'pending');
    const tribeMembersCount = activeTribeMembers.length;
    const activeMemberUserIds = activeTribeMembers.map(m => m.user_id);
    
    // Count completions today only for users who are currently active members of this tribe
    const completedCountToday = completions.filter(c => c.tribe_id === t.id && c.date === todayStr && activeMemberUserIds.includes(c.user_id)).length;

    if (tribeMembersCount > 0 && tribeMembersCount === completedCountToday) {
      // Find the tribe in the local tribes array to modify it in-place
      const currTribe = tribes.find(curr => curr.id === t.id);
      if (currTribe) {
        const newStreak = currTribe.current_streak + 1;
        currTribe.current_streak = newStreak;
        currTribe.best_streak = Math.max(currTribe.best_streak, newStreak);
        tribesChanged = true;
        
        if (newStreak === 365) {
          // Trigger 365 Days Celebrations for members
          activeTribeMembers.forEach(m => {
            addNotification({
              user_id: m.user_id,
              type: 'badge_earned',
              title: 'Ã°Å¸â€Â¥ ¡1 AÃƒâ€˜O DE TRIBU! Ã°Å¸â€Â¥',
              body: `¡IncreÃƒÂ­ble! Tu tribu "${currTribe.name}" ha completado 365 días seguidos de consistencia.`
            });
          });
        }
        
        // Award badges if tribe streak threshold met
        if (newStreak >= 30) {
          checkAndAwardBadge('badge_tribe_streak_30');
        }
        if (newStreak >= 365) {
          checkAndAwardBadge('badge_tribe_streak_365');
        }
      }
    }
  });

  if (tribesChanged) {
    setItem(KEYS.TRIBES, tribes);
  }
  setItem(KEYS.TRIBE_COMPLETIONS, completions);
}

export function cancelTribeHabit(tribeId: string, memberId: string): void {
  const tribes = getItem<Tribe[]>(KEYS.TRIBES);
  const currTribe = tribes.find(t => t.id === tribeId);
  if (!currTribe) return;

  const todayStr = getLocalDateString();
  
  // 1. Remove from TRIBE_COMPLETIONS
  const tribeCompletions = getItem<TribeCompletion[]>(KEYS.TRIBE_COMPLETIONS);
  const updatedTribeCompletions = tribeCompletions.filter(c => {
    return !(c.tribe_id === tribeId && c.user_id === memberId && c.date === todayStr);
  });
  
  if (updatedTribeCompletions.length < tribeCompletions.length) {
    setItem(KEYS.TRIBE_COMPLETIONS, updatedTribeCompletions);
    
    // Si se había incrementado la racha de la tribu hoy, la restamos
    if (currTribe.current_streak > 0) {
      currTribe.current_streak = Math.max(0, currTribe.current_streak - 1);
      setItem(KEYS.TRIBES, tribes);
    }
  }

  // 2. Remove from regular COMPLETIONS for the matched habit
  const habits = getItem<Habit[]>(KEYS.HABITS);
  const memberHabit = habits.find(h => h.user_id === memberId && h.name.toLowerCase() === currTribe.habit_name.toLowerCase());
  
  if (memberHabit) {
    const completions = getItem<HabitCompletion[]>(KEYS.COMPLETIONS);
    const updatedCompletions = completions.filter(c => {
      return !(c.habit_id === memberHabit.id && c.user_id === memberId && c.date === todayStr);
    });
    
    if (updatedCompletions.length < completions.length) {
      setItem(KEYS.COMPLETIONS, updatedCompletions);
      // Recalculating streak locally is complex without a full recalculation script, 
      // but simply decrementing by 1 if they lost today's is safe enough for this fix.
      if (memberHabit.current_streak > 0) {
        memberHabit.current_streak -= 1;
        setItem(KEYS.HABITS, habits);
      }
    }
  }
}

// Challenges Services
export function getChallenges(): (Challenge & { participantsCount: number, myRank: number, myProgress: number })[] {
  // Always run maintenance before querying challenges to keep rolls fresh
  runDailyMaintenance();

  const currentId = getCurrentUserId();
  const challenges = getItem<Challenge[]>(KEYS.CHALLENGES);
  const participants = getItem<ChallengeParticipant[]>(KEYS.CHALLENGE_PARTICIPANTS);
  
  return challenges.map(c => {
    const list = participants.filter(p => p.challenge_id === c.id);
    const sorted = [...list].sort((a,b) => b.completed_days - a.completed_days);
    const myRank = sorted.findIndex(p => p.user_id === currentId) + 1;
    const myProg = list.find(p => p.user_id === currentId)?.completed_days || 0;
    
    return {
      ...c,
      participantsCount: list.length,
      myRank: myRank || 1,
      myProgress: myProg
    };
  });
}

export function getChallengeDetails(challengeId: string): Challenge & {
  participants: (User & { completedDays: number, progress: number, isWinner: boolean, rank: number })[]
} {
  const challenges = getItem<Challenge[]>(KEYS.CHALLENGES);
  const participants = getItem<ChallengeParticipant[]>(KEYS.CHALLENGE_PARTICIPANTS);
  const users = getItem<User[]>(KEYS.USERS);
  
  const challenge = challenges.find(c => c.id === challengeId);
  if (!challenge) {
    return {
      id: '',
      name: '',
      habit_name: '',
      duration_days: 0,
      start_date: '',
      end_date: '',
      created_by: '',
      status: 'active',
      created_at: '',
      participants: []
    };
  }
  
  const list = participants
    .filter(p => p.challenge_id === challengeId)
    .map(p => {
      const user = users.find(u => u.id === p.user_id);
      if (!user) return null;
      return {
        ...user,
        completedDays: p.completed_days,
        progress: p.progress,
        isWinner: p.is_winner
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a,b) => b.completedDays - a.completedDays);
    
  const listWithRank = list.map((p, index) => ({
    ...p,
    rank: index + 1
  }));
  
  return {
    ...challenge,
    participants: listWithRank
  };
}

export function createChallenge(name: string, habitName: string, durationDays: number, inviteFriendIds: string[]): Challenge {
  const currentId = getCurrentUserId();
  const challenges = getItem<Challenge[]>(KEYS.CHALLENGES);
  const participants = getItem<ChallengeParticipant[]>(KEYS.CHALLENGE_PARTICIPANTS);
  
  // Ensure the user has a habit for this challenge
  const habits = getItem<Habit[]>(KEYS.HABITS);
  const userHabitExists = habits.some(
    h => h.user_id === currentId && h.name.toLowerCase() === habitName.toLowerCase()
  );
  if (!userHabitExists) {
    const newHabit: Habit = {
      id: 'habit_' + Math.random().toString(36).substr(2, 9),
      user_id: currentId,
      goal_id: '',
      name: habitName,
      frequency: 'daily',
      privacy: 'friends',
      current_streak: 0,
      best_streak: 0,
      wildcard_available: true,
      archived: false,
      created_at: new Date().toISOString()
    };
    habits.push(newHabit);
    setItem(KEYS.HABITS, habits);
  }
  
  const startDate = getLocalDateString();
  const endDate = getFutureLocalDateString(durationDays);
  
  const newChallenge: Challenge = {
    id: 'challenge_' + Math.random().toString(36).substr(2, 9),
    name,
    habit_name: habitName,
    duration_days: durationDays,
    start_date: startDate,
    end_date: endDate,
    created_by: currentId,
    status: 'active',
    created_at: new Date().toISOString()
  };
  
  challenges.push(newChallenge);
  setItem(KEYS.CHALLENGES, challenges);
  
  // Add creator
  participants.push({
    id: 'cp_' + Math.random().toString(36).substr(2, 9),
    challenge_id: newChallenge.id,
    user_id: currentId,
    progress: 0,
    completed_days: 0,
    is_winner: false
  });
  
  // Invite friends (filter out invalid user IDs to ensure DB integrity)
  const users = getItem<User[]>(KEYS.USERS);
  const validInviteFriendIds = inviteFriendIds.filter(friendId => users.some(u => u.id === friendId));

  validInviteFriendIds.forEach(friendId => {
    participants.push({
      id: 'cp_' + Math.random().toString(36).substr(2, 9),
      challenge_id: newChallenge.id,
      user_id: friendId,
      progress: 0,
      completed_days: 0,
      is_winner: false
    });
    
    addNotification({
      user_id: friendId,
      type: 'challenge_invite',
      title: 'Invitación a Desafío Ã°Å¸Ââ€ ',
      body: `Te han invitado al desafío "${name}" por ${durationDays} días.`
    });
  });
  
  setItem(KEYS.CHALLENGE_PARTICIPANTS, participants);
  return newChallenge;
}

function updateChallengeProgress(habitId: string) {
  const currentId = getCurrentUserId();
  const habits = getItem<Habit[]>(KEYS.HABITS);
  const completedHabit = habits.find(h => h.id === habitId);
  if (!completedHabit) return;

  const challenges = getItem<Challenge[]>(KEYS.CHALLENGES);
  const participants = getItem<ChallengeParticipant[]>(KEYS.CHALLENGE_PARTICIPANTS);
  
  const activeChallenges = challenges.filter(c => c.status === 'active' && c.habit_name.toLowerCase() === completedHabit.name.toLowerCase());
  
  const updatedParticipants = participants.map(p => {
    const isMatchingChallenge = activeChallenges.some(c => c.id === p.challenge_id);
    if (isMatchingChallenge && p.user_id === currentId) {
      const nextCompleted = p.completed_days + 1;
      
      // Find challenge length
      const challengeInfo = activeChallenges.find(c => c.id === p.challenge_id)!;
      const isWinner = nextCompleted >= challengeInfo.duration_days;
      
      if (isWinner) {
        // Complete the challenge if this user won
        completeChallengeForUser(challengeInfo.id);
      }
      
      return {
        ...p,
        completed_days: nextCompleted,
        progress: nextCompleted,
        is_winner: isWinner
      };
    }
    return p;
  });
  
  setItem(KEYS.CHALLENGE_PARTICIPANTS, updatedParticipants);
}

function completeChallengeForUser(challengeId: string) {
  const challenges = getItem<Challenge[]>(KEYS.CHALLENGES);
  const currentId = getCurrentUserId();
  
  const updatedChallenges = challenges.map(c => {
    if (c.id === challengeId) {
      // Award winner badge and major XP
      let xpPrize = 100;
      if (c.duration_days >= 30) xpPrize = 300;
      if (c.duration_days >= 100) xpPrize = 1000;
      
      updateUserXP(xpPrize);
      checkAndAwardBadge('badge_first_challenge');
      
      addNotification({
        user_id: currentId,
        type: 'badge_earned',
        title: '¡Desafío Completado! Ã°Å¸Ââ€ ',
        body: `Completaste el desafío de ${c.duration_days} días en "${c.name}" y ganaste +${xpPrize} XP.`
      });
      
      return { ...c, status: 'completed' as const };
    }
    return c;
  });
  
  setItem(KEYS.CHALLENGES, updatedChallenges);
}

// Badges Services
export function getBadgesCatalog(userId?: string): (Badge & { earned: boolean, earnedAt?: string })[] {
  const targetId = userId || getCurrentUserId();
  const userBadges = getItem<UserBadge[]>(KEYS.USER_BADGES);
  
  return SEED_BADGES.map(badge => {
    const ub = userBadges.find(u => u.user_id === targetId && u.badge_id === badge.id);
    return {
      ...badge,
      earned: !!ub,
      earnedAt: ub?.earned_at
    };
  });
}

function checkAndAwardBadge(badgeId: string): Badge | null {
  const currentId = getCurrentUserId();
  const userBadges = getItem<UserBadge[]>(KEYS.USER_BADGES);
  
  const alreadyEarned = userBadges.some(ub => ub.user_id === currentId && ub.badge_id === badgeId);
  if (alreadyEarned) return null;
  
  const newAward: UserBadge = {
    id: 'ub_' + Math.random().toString(36).substr(2, 9),
    user_id: currentId,
    badge_id: badgeId,
    earned_at: new Date().toISOString()
  };
  
  userBadges.push(newAward);
  setItem(KEYS.USER_BADGES, userBadges);
  
  const badgeInfo = SEED_BADGES.find(b => b.id === badgeId)!;
  
  addNotification({
    user_id: currentId,
    type: 'badge_earned',
    title: '¡Nueva Insignia Desbloqueada! Ã°Å¸Å½â€“Ã¯Â¸Â',
    body: `Obtuviste "${badgeInfo.name}" por tu constancia: ${badgeInfo.description}`
  });
  
  return badgeInfo;
}

function hasPerfectPeriod(days: number): boolean {
  const currentId = getCurrentUserId();
  const habits = getItem<Habit[]>(KEYS.HABITS).filter(h => h.user_id === currentId && !h.archived);
  if (habits.length === 0) return false;
  
  const completions = getItem<HabitCompletion[]>(KEYS.COMPLETIONS).filter(c => c.user_id === currentId);
  const today = new Date();
  
  for (let i = 0; i < days; i++) {
    const checkDate = new Date();
    checkDate.setDate(today.getDate() - i);
    const dateStr = getLocalDateString(checkDate);
    
    // Check if the user had at least one active habit on this day
    const activeHabitsOnDay = habits.filter(h => getLocalDateString(new Date(h.created_at)) <= dateStr);
    if (activeHabitsOnDay.length === 0) {
      return false;
    }
    
    for (const habit of activeHabitsOnDay) {
      const hasComp = completions.some(c => c.habit_id === habit.id && c.date === dateStr && !c.used_wildcard && c.is_fully_completed !== false);
      if (!hasComp) {
        return false;
      }
    }
  }
  return true;
}

function evalCompletionsForBadges(): Badge | null {
  const currentId = getCurrentUserId();
  const habits = getItem<Habit[]>(KEYS.HABITS);
  const myHabits = habits.filter(h => h.user_id === currentId);
  
  if (myHabits.length === 0) return null;

  // Let's find maximum current streak
  const maxStreak = Math.max(...myHabits.map(h => h.current_streak));
  
  if (maxStreak >= 1 && !hasBadge('badge_first_streak')) {
    return checkAndAwardBadge('badge_first_streak');
  }
  if (maxStreak >= 7 && !hasBadge('badge_streak_7')) {
    return checkAndAwardBadge('badge_streak_7');
  }
  if (maxStreak >= 30 && !hasBadge('badge_streak_30')) {
    return checkAndAwardBadge('badge_streak_30');
  }
  if (maxStreak >= 100 && !hasBadge('badge_streak_100')) {
    return checkAndAwardBadge('badge_streak_100');
  }
  if (maxStreak >= 365 && !hasBadge('badge_streak_365')) {
    return checkAndAwardBadge('badge_streak_365');
  }

  // Perfect Week & Perfect Month evaluation
  if (hasPerfectPeriod(30) && !hasBadge('badge_perfect_month')) {
    const badge = checkAndAwardBadge('badge_perfect_month');
    if (badge) return badge;
  }
  if (hasPerfectPeriod(7) && !hasBadge('badge_perfect_week')) {
    const badge = checkAndAwardBadge('badge_perfect_week');
    if (badge) return badge;
  }

  // 10 Won Challenges evaluation
  const participants = getItem<ChallengeParticipant[]>(KEYS.CHALLENGE_PARTICIPANTS);
  const wonCount = participants.filter(p => p.user_id === currentId && p.is_winner).length;
  if (wonCount >= 10 && !hasBadge('badge_challenges_10')) {
    const badge = checkAndAwardBadge('badge_challenges_10');
    if (badge) return badge;
  }

  return null;
}

function hasBadge(badgeId: string): boolean {
  const currentId = getCurrentUserId();
  const userBadges = getItem<UserBadge[]>(KEYS.USER_BADGES);
  return userBadges.some(ub => ub.user_id === currentId && ub.badge_id === badgeId);
}

// Notifications Services
export function getNotifications(): Notification[] {
  const currentId = getCurrentUserId();
  const list = getItem<Notification[]>(KEYS.NOTIFICATIONS);
  return list
    .filter(n => n.user_id === currentId)
    .sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function markNotificationsAsRead(): void {
  const currentId = getCurrentUserId();
  const list = getItem<Notification[]>(KEYS.NOTIFICATIONS);
  const updated = list.map(n => n.user_id === currentId ? { ...n, read: true } : n);
  setItem(KEYS.NOTIFICATIONS, updated);
}

export function addNotification(n: Omit<Notification, 'id' | 'read' | 'created_at'>): Notification {
  const list = getItem<Notification[]>(KEYS.NOTIFICATIONS);
  const newNotif: Notification = {
    ...n,
    id: 'notif_' + Math.random().toString(36).substr(2, 9),
    read: false,
    created_at: new Date().toISOString()
  };
  list.push(newNotif);
  setItem(KEYS.NOTIFICATIONS, list);
  return newNotif;
}

// Stats Service
export interface UserStats {
  consistencyDays: number;
  highestStreak: number;
  completedHabitsCount: number;
  challengesWon: number;
  activeTribesCount: number;
  complianceRate: number; // percentage
}

function calculateConsistencyStreak(userId: string, habits: Habit[], completions: HabitCompletion[], targetDateStr?: string): number {
  const userHabits = habits.filter(h => h.user_id === userId && !h.archived);
  if (userHabits.length === 0) return 0;

  let streak = 0;
  let currentDate = targetDateStr ? parseLocalDate(targetDateStr) : new Date(); // Start checking from target or today
  
  for (let i = 0; i < 365; i++) {
    const dateStr = getLocalDateString(currentDate);
    const dayOfWeek = currentDate.getDay();
    
    // Find all habits that were scheduled to be completed on this date
    const scheduledOnDate = userHabits.filter(h => {
      const creationDate = getLocalDateString(new Date(h.created_at));
      if (dateStr < creationDate) return false;
      if (h.frequency === 'custom' && h.custom_days && h.custom_days.length > 0) {
        return h.custom_days.includes(dayOfWeek);
      }
      return true;
    });

    const dayCompletions = completions.filter(c => c.date === dateStr);

    if (scheduledOnDate.length === 0) {
      // No habits scheduled, skip this day but don't break the streak.
      // If the user completed something anyway, count it as a bonus!
      if (dayCompletions.length > 0) {
        streak++;
      }
      currentDate.setDate(currentDate.getDate() - 1);
      continue;
    }
    
    // Check if EVERY scheduled habit was fully completed or used a wildcard
    let allCompletedOrWildcard = true;
    let anyWildcardUsed = false;
    
    for (const habit of scheduledOnDate) {
      const comp = dayCompletions.find(c => c.habit_id === habit.id);
      if (!comp || (comp.is_fully_completed === false && !comp.used_wildcard)) {
        allCompletedOrWildcard = false;
        break;
      }
      if (comp.used_wildcard) {
        anyWildcardUsed = true;
      }
    }

    const isTargetToday = dateStr === getLocalDateString();

    // Special case for TODAY
    if (i === 0 && isTargetToday) {
      if (allCompletedOrWildcard) {
        if (!anyWildcardUsed) streak++; // perfectly completed today
      }
      // Regardless of today's status, we don't break the streak because the day isn't over yet
      currentDate.setDate(currentDate.getDate() - 1);
      continue;
    }

    // Historical days
    if (allCompletedOrWildcard) {
      if (!anyWildcardUsed) {
        streak++; // Perfect day, increment streak
      }
      // If wildcard used, streak is preserved but does not increase.
      currentDate.setDate(currentDate.getDate() - 1);
    } else {
      // Failed day: at least one active scheduled habit was not completed, and no wildcard was used
      break;
    }
  }

  return streak;
}

export function getUserStats(userId?: string, customDateStr?: string): UserStats {
  const currentId = userId || getCurrentUserId();

  // Return consistent mock stats for bots
  if (currentId === 'user_lucas' || currentId === 'lucas') {
    return {
      consistencyDays: 154,
      highestStreak: 154,
      completedHabitsCount: 280,
      challengesWon: 3,
      activeTribesCount: 1,
      complianceRate: 95
    };
  }
  if (currentId === 'user_sofia' || currentId === 'sofia') {
    return {
      consistencyDays: 82,
      highestStreak: 82,
      completedHabitsCount: 145,
      challengesWon: 1,
      activeTribesCount: 1,
      complianceRate: 90
    };
  }
  if (currentId === 'user_elena' || currentId === 'elena') {
    return {
      consistencyDays: 241,
      highestStreak: 241,
      completedHabitsCount: 410,
      challengesWon: 5,
      activeTribesCount: 1,
      complianceRate: 97
    };
  }
  if (currentId === 'user_adri' || currentId === 'adri') {
    return {
      consistencyDays: 18,
      highestStreak: 18,
      completedHabitsCount: 28,
      challengesWon: 0,
      activeTribesCount: 0,
      complianceRate: 85
    };
  }

  const habits = getItem<Habit[]>(KEYS.HABITS).filter(h => h.user_id === currentId);
  const completions = getItem<HabitCompletion[]>(KEYS.COMPLETIONS).filter(c => c.user_id === currentId);
  const challenges = getItem<Challenge[]>(KEYS.CHALLENGES);
  const participants = getItem<ChallengeParticipant[]>(KEYS.CHALLENGE_PARTICIPANTS);
  const members = getItem<TribeMember[]>(KEYS.TRIBE_MEMBERS);
  
  const highestStreak = habits.length > 0 ? Math.max(...habits.map(h => h.best_streak)) : 0;
  
  const consistencyDays = calculateConsistencyStreak(currentId, habits, completions, customDateStr);
  
  const activeTribesCount = members.filter(m => m.user_id === currentId).length;
  
  // Challenges won
  const myChallengeIds = participants.filter(p => p.user_id === currentId && p.is_winner).map(p => p.challenge_id);
  const challengesWon = challenges.filter(c => myChallengeIds.includes(c.id)).length;
  
  // Compliance Rate (completed vs total target over past 30 days)
  // Let's mock a standard high percentage for seed demo
  const complianceRate = habits.length > 0 ? Math.round(92.5) : 0;

  // Make completedHabitsCount mathematically consistent with best streaks
  const minCompleted = habits.reduce((acc, h) => acc + (h.best_streak || 0), 0);
  const completedHabitsCount = Math.max(completions.length, minCompleted);

  return {
    consistencyDays,
    highestStreak,
    completedHabitsCount,
    challengesWon,
    activeTribesCount,
    complianceRate
  };
}

// Calendar Month Completion Data helper
export interface CalendarDay {
  dateString: string; // YYYY-MM-DD
  dayNum: number;
  status: 'completed' | 'failed' | 'wildcard' | 'future' | 'neutral';
}

export function getMonthCalendarData(year: number, month: number): CalendarDay[] {
  const currentId = getCurrentUserId();
  const completions = getItem<HabitCompletion[]>(KEYS.COMPLETIONS).filter(c => c.user_id === currentId);
  const todayStr = getLocalDateString();
  
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const result: CalendarDay[] = [];
  
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const dateStr = getLocalDateString(date);
    
    if (dateStr > todayStr) {
      result.push({ dateString: dateStr, dayNum: d, status: 'future' });
      continue;
    }
    
    const dayCompletions = completions.filter(c => c.date === dateStr);
    const usedWildcard = dayCompletions.some(c => c.used_wildcard);
    
    let status: CalendarDay['status'] = 'neutral';
    if (dayCompletions.length > 0) {
      status = usedWildcard ? 'wildcard' : 'completed';
    } else {
      // Historical random representation for seed visual appeal
      const dayOfWeek = date.getDay();
      if (dateStr < todayStr) {
        if (dayOfWeek === 0) { // Sunday might be a fail
          status = 'failed';
        } else {
          status = 'completed';
        }
      }
    }
    
    result.push({
      dateString: dateStr,
      dayNum: d,
      status
    });
  }
  
  return result;
}

// Rankings Service
export interface RankingRow {
  userId: string;
  name: string;
  username: string;
  avatarUrl: string;
  consistencyDays: number;
  xp: number;
  level: number;
  rank: number;
}

export function getRankings(type: 'friends' | 'local' | 'global'): RankingRow[] {
  const currentId = getCurrentUserId();
  const users = getAllUsers();
  const friendships = getItem<Friendship[]>(KEYS.FRIENDSHIPS);
  
  let filteredUsers = users;
  
  if (type === 'friends') {
    const friendIds = friendships
      .filter(f => f.status === 'accepted' && (f.requester_id === currentId || f.receiver_id === currentId))
      .map(f => f.requester_id === currentId ? f.receiver_id : f.requester_id);
    
    filteredUsers = users.filter(u => u.id === currentId || friendIds.includes(u.id));
  } else if (type === 'local') {
    // Local / circle: show a subset of highly active users in Spain/Latam
    filteredUsers = users;
  }
  
  // Map and sort
  const mapped = filteredUsers.map(u => {
    const stats = getUserStats(u.id);
    
    return {
      userId: u.id,
      name: u.name,
      username: u.username,
      avatarUrl: u.avatar_url || '',
      consistencyDays: stats.consistencyDays,
      xp: u.xp,
      level: u.level
    };
  });
  
  // Sort by consistencyDays first, then XP
  const sorted = mapped.sort((a,b) => {
    if (b.consistencyDays !== a.consistencyDays) {
      return b.consistencyDays - a.consistencyDays;
    }
    return b.xp - a.xp;
  });
  
  return sorted.map((row, index) => ({
    ...row,
    rank: index + 1
  }));
}

export function getGlobalRanking(): RankingRow[] {
  return getRankings('global');
}

// Extra helpers to avoid direct unsafe localStorage access
export function getHabitCompletions(): HabitCompletion[] {
  return getItem<HabitCompletion[]>(KEYS.COMPLETIONS);
}

export function getTribeMembers(): TribeMember[] {
  return getItem<TribeMember[]>(KEYS.TRIBE_MEMBERS);
}

export function getTribeCompletions(): TribeCompletion[] {
  return getItem<TribeCompletion[]>(KEYS.TRIBE_COMPLETIONS);
}

export function getChallengeParticipants(): ChallengeParticipant[] {
  return getItem<ChallengeParticipant[]>(KEYS.CHALLENGE_PARTICIPANTS);
}

export function deleteHabit(habitId: string): void {
  const habits = getItem<Habit[]>(KEYS.HABITS);
  const updated = habits.filter(h => h.id !== habitId);
  setItem(KEYS.HABITS, updated);
  
  // Clean completions
  const completions = getItem<HabitCompletion[]>(KEYS.COMPLETIONS);
  setItem(KEYS.COMPLETIONS, completions.filter(c => c.habit_id !== habitId));
}

export function deleteTribe(tribeId: string): void {
  const tribes = getItem<Tribe[]>(KEYS.TRIBES);
  setItem(KEYS.TRIBES, tribes.filter(t => t.id !== tribeId));
  
  const members = getItem<TribeMember[]>(KEYS.TRIBE_MEMBERS);
  setItem(KEYS.TRIBE_MEMBERS, members.filter(m => m.tribe_id !== tribeId));
  
  const messages = getItem<TribeMessage[]>(KEYS.TRIBE_MESSAGES);
  setItem(KEYS.TRIBE_MESSAGES, messages.filter(m => m.tribe_id !== tribeId));
}

// --- COMPANION & SHOP SERVICES ---

export interface ShopItem {
  id: string;
  name: string;
  type: 'character' | 'accessory' | 'food' | 'potion';
  price: number;
  description: string;
  effect: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  icon: string;
}

export const SHOP_ITEMS: ShopItem[] = [
  // Characters
  { id: 'char_gato', name: 'Gato Zen', type: 'character', price: 200, description: 'Un felino místico que irradia paz y concentración profunda.', effect: 'Aspecto raro de compañero.', rarity: 'rare', icon: 'Ã°Å¸ÂÂ±' },
  { id: 'char_cyborg', name: 'Cíborg X9', type: 'character', price: 500, description: 'Mitad máquina, mitad código puro. Enfocado en disciplina inflexible.', effect: 'Aspecto épico de compañero.', rarity: 'epic', icon: 'Ã°Å¸Â¤â€“' },
  { id: 'char_fenix', name: 'Fénix Dorado', type: 'character', price: 1000, description: 'La criatura legendaria de la consistencia. Nunca muere del todo.', effect: 'Aspecto legendario de compañero.', rarity: 'legendary', icon: 'Ã°Å¸ÂÂ¦' },
  
  // Accessories
  { id: 'acc_gorra', name: 'Gorra de Enfoque', type: 'accessory', price: 80, description: 'Para tapar las distracciones y concentrarse al máximo.', effect: '+10% de ganancia de XP de compañero.', rarity: 'common', icon: 'Ã°Å¸Â§Â¢' },
  { id: 'acc_gafas', name: 'Visor Cyberpunk', type: 'accessory', price: 150, description: 'Muestra estadísticas de enfoque neuronal en tiempo real.', effect: '+15% de ganancia de XP de compañero.', rarity: 'rare', icon: 'Ã°Å¸â€¢Â¶Ã¯Â¸Â' },
  { id: 'acc_corona', name: 'Corona de Oro', type: 'accessory', price: 600, description: 'El máximo símbolo de un hábito inquebrantable.', effect: 'Detalle visual brillante exclusivo.', rarity: 'legendary', icon: 'Ã°Å¸â€˜â€˜' },
  { id: 'acc_mochila', name: 'Mochila de Aventuras', type: 'accessory', price: 100, description: 'Para cargar toda tu consistencia diaria.', effect: 'Estilo explorador.', rarity: 'common', icon: 'Ã°Å¸Å½â€™' },
];

export function buyShopItem(itemId: string): { success: boolean; message: string; coins?: number; inventory?: string[] } {
  const users = getItem<User[]>(KEYS.USERS);
  const currentId = getCurrentUserId();
  const index = users.findIndex(u => u.id === currentId);
  if (index === -1) return { success: false, message: 'Usuario no encontrado' };

  const user = users[index];
  const item = SHOP_ITEMS.find(i => i.id === itemId);
  if (!item) return { success: false, message: 'Item no encontrado' };

  const userCoins = user.coins === undefined ? 100 : user.coins;
  if (userCoins < item.price) {
    return { success: false, message: `Monedas insuficientes. Necesitas ${item.price} monedas.` };
  }

  const inventory = user.inventory || [];
  
  // For unique items (skins/accessories), check if already owned
  if ((item.type === 'character' || item.type === 'accessory') && inventory.includes(itemId)) {
    return { success: false, message: 'Ya posees este artículo.' };
  }

  const newCoins = userCoins - item.price;
  const newInventory = [...inventory, itemId];

  const updatedUser = {
    ...user,
    coins: newCoins,
    inventory: newInventory
  };

  users[index] = updatedUser;
  setItem(KEYS.USERS, users);

  return {
    success: true,
    message: `¡Compraste ${item.name} con éxito!`,
    coins: newCoins,
    inventory: newInventory
  };
}

export function useInventoryItem(itemId: string): { success: boolean; message: string; user?: User } {
  return { success: false, message: 'Este artículo no se puede consumir.' };
}

export function renameCompanion(newName: string): { success: boolean; message: string; user?: User } {
  if (!newName.trim()) return { success: false, message: 'El nombre no puede estar vacío.' };
  const users = getItem<User[]>(KEYS.USERS);
  const currentId = getCurrentUserId();
  const index = users.findIndex(u => u.id === currentId);
  if (index === -1) return { success: false, message: 'Usuario no encontrado' };

  const user = users[index];
  if (!user.companion) return { success: false, message: 'No tienes compañero activo.' };

  const updatedUser = {
    ...user,
    companion: {
      ...user.companion,
      name: newName.trim()
    }
  };

  users[index] = updatedUser;
  setItem(KEYS.USERS, users);

  return {
    success: true,
    message: `Nombre cambiado a ${newName.trim()}`,
    user: updatedUser
  };
}

export function equipAccessory(itemId: string): { success: boolean; message: string; user?: User } {
  const users = getItem<User[]>(KEYS.USERS);
  const currentId = getCurrentUserId();
  const index = users.findIndex(u => u.id === currentId);
  if (index === -1) return { success: false, message: 'Usuario no encontrado' };

  const user = users[index];
  const inventory = user.inventory || [];
  if (!inventory.includes(itemId)) {
    return { success: false, message: 'No posees este accesorio.' };
  }

  const item = SHOP_ITEMS.find(i => i.id === itemId);
  if (!item || item.type !== 'accessory') {
    return { success: false, message: 'ArtÃƒÂ­culo no es un accesorio equipable.' };
  }

  const companion = user.companion;
  if (!companion) return { success: false, message: 'No tienes compañero activo.' };

  const accessories = companion.accessories || [];
  if (accessories.includes(itemId)) {
    return { success: false, message: 'El accesorio ya está equipado.' };
  }

  const updatedUser = {
    ...user,
    companion: {
      ...companion,
      accessories: [...accessories, itemId]
    }
  };

  users[index] = updatedUser;
  setItem(KEYS.USERS, users);

  return {
    success: true,
    message: `Equipaste ${item.name}.`,
    user: updatedUser
  };
}

export function unequipAccessory(itemId: string): { success: boolean; message: string; user?: User } {
  const users = getItem<User[]>(KEYS.USERS);
  const currentId = getCurrentUserId();
  const index = users.findIndex(u => u.id === currentId);
  if (index === -1) return { success: false, message: 'Usuario no encontrado' };

  const user = users[index];
  const companion = user.companion;
  if (!companion) return { success: false, message: 'No tienes compañero activo.' };

  const accessories = companion.accessories || [];
  if (!accessories.includes(itemId)) {
    return { success: false, message: 'El accesorio no está equipado.' };
  }

  const updatedUser = {
    ...user,
    companion: {
      ...companion,
      accessories: accessories.filter(id => id !== itemId)
    }
  };

  users[index] = updatedUser;
  setItem(KEYS.USERS, users);

  return {
    success: true,
    message: 'Accesorio desequipado.',
    user: updatedUser
  };
}

export function changeCompanionType(charItemId: string): { success: boolean; message: string; user?: User } {
  const users = getItem<User[]>(KEYS.USERS);
  const currentId = getCurrentUserId();
  const index = users.findIndex(u => u.id === currentId);
  if (index === -1) return { success: false, message: 'Usuario no encontrado' };

  const user = users[index];
  const inventory = user.inventory || [];
  
  if (charItemId !== 'slime_default' && !inventory.includes(charItemId)) {
    return { success: false, message: 'No has desbloqueado este personaje.' };
  }

  const companion = user.companion;
  if (!companion) return { success: false, message: 'No tienes compañero activo.' };

  let type: 'slime' | 'gato' | 'cyborg' | 'fenix' = 'slime';
  if (charItemId === 'char_gato') type = 'gato';
  else if (charItemId === 'char_cyborg') type = 'cyborg';
  else if (charItemId === 'char_fenix') type = 'fenix';

  const updatedUser = {
    ...user,
    companion: {
      ...companion,
      type
    }
  };

  users[index] = updatedUser;
  setItem(KEYS.USERS, users);

  return {
    success: true,
    message: 'Cambiaste de personaje activo.',
    user: updatedUser
  };
}

export const getSuggestedHabitsFromGoal = (title: string): string[] => {
  const t = title.toLowerCase();
  
  if (t.includes('gym') || t.includes('gimnasio') || t.includes('entrenar') || t.includes('peso') || 
      t.includes('correr') || t.includes('maratón') || t.includes('kilos') || t.includes('deporte') || 
      t.includes('fÃƒÂ­sico') || t.includes('salud') || t.includes('dieta') || t.includes('ejercicio') || 
      t.includes('calorías') || t.includes('fit') || t.includes('bici')) {
    return [
      "Entrenar 45 minutos al dÃƒÂ­a",
      "Correr 20-30 minutos",
      "Comer de forma saludable",
      "Beber 2 litros de agua"
    ];
  }
  
  if (t.includes('dinero') || t.includes('ganar') || t.includes('ahorrar') || t.includes('finanzas') || 
      t.includes('ingresos') || t.includes('gastos') || t.includes('inversión') || t.includes('invertir') || 
      t.includes('facturar') || t.includes('euros') || t.includes('dólares') || t.includes('ventas') || 
      t.includes('Ã¢â€šÂ¬') || t.includes('$')) {
    return [
      "Registrar ingresos y gastos diarios",
      "Revisar mi presupuesto del mes",
      "Hacer una acción de prospección/ventas",
      "Ahorrar 5Ã¢â€šÂ¬ al dÃƒÂ­a"
    ];
  }

  if (t.includes('programar') || t.includes('código') || t.includes('software') || t.includes('startup') || 
      t.includes('web') || t.includes('app') || t.includes('desarrollar') || t.includes('lanzar') || 
      t.includes('mvp') || t.includes('negocio') || t.includes('empresa') || t.includes('proyecto') || 
      t.includes('cliente') || t.includes('clientes')) {
    return [
      "Programar código 1 hora al dÃƒÂ­a",
      "Trabajar en el MVP 45 minutos",
      "Planificar la tarea clave del dÃƒÂ­a",
      "Validar ideas con un cliente o usuario"
    ];
  }

  if (t.includes('leer') || t.includes('libros') || t.includes('libro') || t.includes('aprender') || 
      t.includes('estudiar') || t.includes('estudios') || t.includes('examen') || t.includes('curso') || 
      t.includes('inglÃƒÂ©s') || t.includes('idioma') || t.includes('idiomas') || t.includes('apuntes') || 
      t.includes('universidad') || t.includes('uni') || t.includes('clase')) {
    return [
      "Leer 15-20 pÃƒ¡ginas al dÃƒÂ­a",
      "Estudiar 45 minutos enfocado",
      "Aprender 5 palabras en otro idioma",
      "Hacer 1 bloque de Pomodoro de estudio"
    ];
  }

  if (t.includes('meditar') || t.includes('diario') || t.includes('escribir') || t.includes('mentalidad') || 
      t.includes('paz') || t.includes('rutina') || t.includes('maÃƒÂ±ana') || t.includes('dormir') || 
      t.includes('despertar') || t.includes('agradecer') || t.includes('mindfulness') || t.includes('ansiedad')) {
    return [
      "Meditar 10 minutos",
      "Escribir 3 agradecimientos diarios",
      "Anotar pensamientos en mi diario",
      "Desconectar del mÃƒÂ³vil antes de dormir"
    ];
  }

  if (t.includes('disciplina') || t.includes('constancia') || t.includes('voluntad') || t.includes('hábitos') || t.includes('hábito')) {
    return [
      "Planificar el dÃƒÂ­a por la noche",
      "Hacer la tarea más difícil primero",
      "Despertar a la misma hora diariamente",
      "Hacer 10 minutos de reflexión diaria"
    ];
  }

  return [
    "Planificar el dÃƒÂ­a siguiente por la noche",
    "Dedicar 30 minutos a mi meta principal",
    "Hacer 15 minutos de ejercicio ligero",
    "Leer 15 minutos diariamente"
  ];
};

export const inferHabitParams = (name: string) => {
  const n = name.toLowerCase();
  
  if (n.includes('agua') || n.includes('beber') || n.includes('botella') || n.includes('litro') || n.includes('vaso')) {
    return {
      isQuantitative: true,
      targetCount: n.includes('litro') || n.includes('botella') ? 3 : 8,
      unit: n.includes('botella') || n.includes('litro') ? 'botellas' : 'vasos',
      isTimeBased: false,
      targetTimeMinutes: undefined,
      requiresPhoto: false,
      category: 'Salud'
    };
  }
  
  if (n.includes('gimnasio') || n.includes('entrenar') || n.includes('correr') || n.includes('caminar') || n.includes('ejercicio') || n.includes('pesas') || n.includes('deporte') || n.includes('cardio') || n.includes('entrenamiento')) {
    return {
      isQuantitative: false,
      targetCount: undefined,
      unit: undefined,
      isTimeBased: false,
      targetTimeMinutes: undefined,
      requiresPhoto: true,
      category: 'Fitness'
    };
  }
  
  if (n.includes('ahorrar') || n.includes('dinero') || n.includes('invertir') || n.includes('gasto')) {
    return {
      isQuantitative: true,
      targetCount: 5,
      unit: 'Ã¢â€šÂ¬',
      isTimeBased: false,
      targetTimeMinutes: undefined,
      requiresPhoto: false,
      category: 'Finanzas'
    };
  }
  
  if (n.includes('leer') || n.includes('libro') || n.includes('pÃƒ¡ginas')) {
    return {
      isQuantitative: false,
      targetCount: undefined,
      unit: undefined,
      isTimeBased: true,
      targetTimeMinutes: 20,
      requiresPhoto: false,
      category: 'Mente'
    };
  }
  
  if (n.includes('meditar') || n.includes('mindfulness') || n.includes('diario') || n.includes('agradecer')) {
    return {
      isQuantitative: false,
      targetCount: undefined,
      unit: undefined,
      isTimeBased: true,
      targetTimeMinutes: 10,
      requiresPhoto: false,
      category: 'Mente'
    };
  }
  
  if (n.includes('programar') || n.includes('código') || n.includes('estudiar') || n.includes('aprender') || n.includes('trabajar') || n.includes('mvp')) {
    return {
      isQuantitative: false,
      targetCount: undefined,
      unit: undefined,
      isTimeBased: true,
      targetTimeMinutes: 60,
      requiresPhoto: false,
      category: 'Productividad'
    };
  }

  return {
    isQuantitative: false,
    targetCount: undefined,
    unit: undefined,
    isTimeBased: false,
    targetTimeMinutes: undefined,
    requiresPhoto: true,
    category: 'Productividad'
  };
};

export function updateHabit(habitId: string, updates: Partial<Omit<Habit, 'id' | 'user_id'>>): Habit {
  const habits = getItem<Habit[]>(KEYS.HABITS);
  const index = habits.findIndex(h => h.id === habitId);
  if (index === -1) throw new Error('Habit not found');
  
  const updatedHabit = {
    ...habits[index],
    ...updates
  };
  
  habits[index] = updatedHabit;
  setItem(KEYS.HABITS, habits);
  return updatedHabit;
}

// Red Social de Videos (Metis Network - Mock Data)
export interface FeedVideo { thumbnail_url?: string;
  id: string;
  url: string;
  author: string;
  author_id: string;
  author_avatar: string;
  description: string;
  likes: number;
  comments: number;
  habit_tag?: string;
}

export function getFeedVideos(): FeedVideo[] {
  const localStr = localStorage.getItem('metis_feed_videos');
  if (localStr) {
    try {
      const parsed = JSON.parse(localStr);
      if (Array.isArray(parsed) && parsed.length > 0) {
        let modified = false;
        const migrated = parsed.map((v: any) => {
          if (v.url && (v.url.includes('mixkit.co') || v.url.includes('ForBiggerBlazes') || v.url.includes('ForBiggerJoyrides'))) {
            modified = true;
            if (v.id === 'v1') {
              v.url = 'https://vjs.zencdn.net/v/oceans.mp4';
              v.thumbnail_url = 'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?auto=format&fit=crop&w=400&q=80';
            } else if (v.id === 'v2') {
              v.url = 'https://media.w3.org/2010/05/sintel/trailer_hd.mp4';
              v.thumbnail_url = 'https://images.unsplash.com/photo-1581451241162-8e104e79d1a3?auto=format&fit=crop&w=400&q=80';
            } else if (v.id === 'v3') {
              v.url = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
              v.thumbnail_url = 'https://images.unsplash.com/photo-1512438248247-f0f2a5a8b7f0?auto=format&fit=crop&w=400&q=80';
            } else {
              v.url = 'https://vjs.zencdn.net/v/oceans.mp4';
              v.thumbnail_url = 'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?auto=format&fit=crop&w=400&q=80';
            }
          }
          if (!v.thumbnail_url) v.thumbnail_url = 'https://images.unsplash.com/photo-1616423641405-b40bfaabdb7f?auto=format&fit=crop&w=400&q=80';
          return v;
        });

        if (modified) {
          localStorage.setItem('metis_feed_videos', JSON.stringify(migrated));
          syncTableToSupabase('metis_feed_videos', migrated).catch(err => console.error("Error syncing corrected video URLs:", err));
        }
        return migrated;
      }
    } catch (e) {
      // fallback
    }
  }

  const fallback: FeedVideo[] = [
    {
      id: 'v1',
      url: 'https://vjs.zencdn.net/v/oceans.mp4',
      thumbnail_url: 'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?auto=format&fit=crop&w=400&q=80',
      author: 'Metis_Mentor',
      author_id: 'user_elena',
      author_avatar: 'https://i.pravatar.cc/150?u=mentor1',
      description: 'El poder de la visualización matutina. Así es como los atletas de ÃƒÂ©lite programan su cerebro antes de entrenar. Ã°Å¸Â§Â Ã°Å¸â€Â¥ #disciplina',
      likes: 1245,
      comments: 89,
      habit_tag: 'Visualización 5 min'
    },
    {
      id: 'v2',
      url: 'https://media.w3.org/2010/05/sintel/trailer_hd.mp4',
      thumbnail_url: 'https://images.unsplash.com/photo-1581451241162-8e104e79d1a3?auto=format&fit=crop&w=400&q=80',
      author: 'Emprendedor_Pro',
      author_id: 'user_lucas',
      author_avatar: 'https://i.pravatar.cc/150?u=mentor2',
      description: 'Por qué hacer tu cama cada maÃƒÂ±ana cambia toda la trayectoria de tu dÃƒÂ­a. Es una pequeña victoria que desencadena otras. Ã°Å¸â€ºÂÃ¯Â¸ÂÃ¢Å“Â¨',
      likes: 3400,
      comments: 210,
      habit_tag: 'Hacer la cama'
    },
    {
      id: 'v3',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      thumbnail_url: 'https://images.unsplash.com/photo-1512438248247-f0f2a5a8b7f0?auto=format&fit=crop&w=400&q=80',
      author: 'Biohacker_Alex',
      author_id: 'user_adri',
      author_avatar: 'https://i.pravatar.cc/150?u=mentor3',
      description: 'Bloqueo de luz azul a las 20:00. Si no duermes bien, tu productividad maÃƒÂ±ana serÃƒ¡ un 40% menor. Apaga las pantallas. Ã°Å¸â€œÂ±Ã°Å¸Å¡Â«',
      likes: 890,
      comments: 45,
      habit_tag: 'No pantallas (20:00)'
    }
  ];
  localStorage.setItem('metis_feed_videos', JSON.stringify(fallback));
  return fallback;
}

export function publishFeedVideo(url: string, description: string, habitTag?: string): FeedVideo {
  const currentUser = getCurrentUser();
  const videos = getFeedVideos();
  
  const newVideo: FeedVideo = {
    id: 'v_' + Math.random().toString(36).substr(2, 9),
    url: url || 'https://assets.mixkit.co/videos/preview/mixkit-running-in-the-forest-41551-large.mp4',
    thumbnail_url: 'https://images.unsplash.com/photo-1616423641405-b40bfaabdb7f?auto=format&fit=crop&w=400&q=80',
    author: currentUser ? currentUser.name : 'Usuario Metis',
    author_id: currentUser ? currentUser.id : 'user_mateo',
    author_avatar: currentUser?.avatar_url || 'https://i.pravatar.cc/150?u=current',
    description: description || 'Nuevo video de valor para la comunidad Metis Ã°Å¸Å’Å’',
    likes: 0,
    comments: 0,
    habit_tag: habitTag || undefined
  };

  videos.unshift(newVideo);
  setItem('metis_feed_videos', videos);
  return newVideo;
}

export interface VideoComment {
  id: string;
  video_id: string;
  user_id: string | null;
  author: string;
  author_avatar: string;
  text: string;
  created_at: string;
}

export function getVideoComments(videoId: string): VideoComment[] {
  const localStr = localStorage.getItem('metis_video_comments');
  if (localStr) {
    try {
      const allComments = JSON.parse(localStr);
      if (Array.isArray(allComments)) {
        return allComments
          .filter((c: VideoComment) => c.video_id === videoId)
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      }
    } catch (e) {
      // fallback
    }
  }

  const fallbackComments: VideoComment[] = [
    {
      id: 'c1',
      video_id: 'v1',
      user_id: null,
      author: 'Lucas_Gomez',
      author_avatar: 'https://i.pravatar.cc/150?u=lucas',
      text: '¡Brutal! He empezado a aplicar esto por las mañanas y noto mucho la diferencia Ã°Å¸Â§Â Ã°Å¸Å¡â‚¬',
      created_at: new Date(Date.now() - 3600000 * 2).toISOString()
    },
    {
      id: 'c2',
      video_id: 'v1',
      user_id: null,
      author: 'Adri_Estudio',
      author_avatar: 'https://i.pravatar.cc/150?u=adri',
      text: '¿Recomiendas hacerlo con música binaural o en silencio?',
      created_at: new Date(Date.now() - 1800000 * 2).toISOString()
    },
    {
      id: 'c3',
      video_id: 'v2',
      user_id: null,
      author: 'Elena_Productive',
      author_avatar: 'https://i.pravatar.cc/150?u=elena',
      text: 'Totalmente de acuerdo, la primera pequeña victoria marca el dÃƒÂ­a Ã°Å¸â€ºÂÃ¯Â¸ÂÃ¢Å“Â¨',
      created_at: new Date(Date.now() - 3600000 * 4).toISOString()
    },
    {
      id: 'c4',
      video_id: 'v3',
      user_id: 'user_mateo',
      author: 'Mateo_Metis',
      author_avatar: 'https://i.pravatar.cc/150?u=mateo',
      text: 'He comprado gafas de bloqueo azul y mi sueño profundo ha mejorado un 30%',
      created_at: new Date(Date.now() - 3600000 * 6).toISOString()
    }
  ];
  localStorage.setItem('metis_video_comments', JSON.stringify(fallbackComments));
  return fallbackComments.filter(c => c.video_id === videoId);
}

export function addVideoComment(videoId: string, text: string): VideoComment {
  const currentUser = getCurrentUser();
  const commentsStr = localStorage.getItem('metis_video_comments');
  let allComments: VideoComment[] = [];
  
  if (commentsStr) {
    try {
      allComments = JSON.parse(commentsStr);
    } catch (e) {
      // fallback
    }
  }
  
  if (allComments.length === 0) {
    getVideoComments(videoId);
    const reloaded = localStorage.getItem('metis_video_comments');
    if (reloaded) allComments = JSON.parse(reloaded);
  }

  const newComment: VideoComment = {
    id: 'c_' + Math.random().toString(36).substr(2, 9),
    video_id: videoId,
    user_id: currentUser ? currentUser.id : 'user_mateo',
    author: currentUser ? currentUser.name : 'Usuario Metis',
    author_avatar: currentUser?.avatar_url || 'https://i.pravatar.cc/150?u=current',
    text,
    created_at: new Date().toISOString()
  };

  allComments.push(newComment);
  setItem('metis_video_comments', allComments);

  const allVideos = getFeedVideos();
  const updatedVideos = allVideos.map(v => {
    if (v.id === videoId) {
      return { ...v, comments: (v.comments || 0) + 1 };
    }
    return v;
  });
  setItem('metis_feed_videos', updatedVideos);

  return newComment;
}

// Masterclasses

export function getMasterclasses(): Masterclass[] {
  return getItem<Masterclass[]>(KEYS.MASTERCLASSES) || [];
}

export function saveMasterclass(masterclass: Masterclass) {
  const masterclasses = getMasterclasses();
  const existingIndex = masterclasses.findIndex(m => m.id === masterclass.id);
  if (existingIndex >= 0) {
    masterclasses[existingIndex] = masterclass;
  } else {
    masterclasses.push(masterclass);
  }
  setItem(KEYS.MASTERCLASSES, masterclasses);
}

export function deleteMasterclass(id: string) {
  let masterclasses = getMasterclasses();
  masterclasses = masterclasses.filter(m => m.id !== id);
  setItem(KEYS.MASTERCLASSES, masterclasses);
}

export function setUserRole(userId: string, role: 'user' | 'mentor' | 'admin') {
  const users = getAllUsers();
  const user = users.find((u: any) => u.id === userId);
  if (user) {
    user.role = role;
    setItem(KEYS.USERS, users);
    syncTableToSupabase('users', [user]);
  }
}

export function getTransactions(): SaleTransaction[] {
  return getItem<SaleTransaction[]>(KEYS.TRANSACTIONS) || [];
}

export function createTransaction(userId: string, masterclassId: string, amount: number): SaleTransaction {
  const transactions = getTransactions();
  const newTx: SaleTransaction = {
    id: 'tx_' + Math.random().toString(36).substr(2, 9),
    user_id: userId,
    masterclass_id: masterclassId,
    amount,
    date: getLocalDateString() // Store local date YYYY-MM-DD
  };
  transactions.push(newTx);
  setItem(KEYS.TRANSACTIONS, transactions);
  return newTx;
}

// Analytics and Progress Tracking for Masterclasses
export function getMasterclassViews(): import('../types').MasterclassView[] {
  return getItem<import('../types').MasterclassView[]>('metis_mc_views') || [];
}

export function trackMasterclassView(userId: string, masterclassId: string) {
  const views = getMasterclassViews();
  const dateStr = getLocalDateString();
  
  // We allow multiple views per user (for total views) but we can filter by user_id for unique views
  const newView = {
    id: 'view_' + Math.random().toString(36).substr(2, 9),
    masterclass_id: masterclassId,
    user_id: userId,
    date: dateStr
  };
  
  views.push(newView);
  setItem('metis_mc_views', views);
}

export function markChapterWatched(userId: string, masterclassId: string, chapterIndex: number, watched: boolean) {
  const users = getAllUsers();
  const user = users.find((u: any) => u.id === userId);
  
  if (user) {
    if (!user.watched_chapters) {
      user.watched_chapters = {};
    }
    
    let watchedList = user.watched_chapters[masterclassId] || [];
    let awardXP = false;
    
    if (watched) {
      if (!watchedList.includes(chapterIndex)) {
        watchedList.push(chapterIndex);
      }
      
      // Check if XP was already awarded for this chapter of this masterclass
      if (!user.xp_awarded_chapters) {
        user.xp_awarded_chapters = {};
      }
      if (!user.xp_awarded_chapters[masterclassId]) {
        user.xp_awarded_chapters[masterclassId] = [];
      }
      if (!user.xp_awarded_chapters[masterclassId].includes(chapterIndex)) {
        user.xp_awarded_chapters[masterclassId].push(chapterIndex);
        awardXP = true;
      }
    } else {
      watchedList = watchedList.filter((idx: number) => idx !== chapterIndex);
    }
    
    user.watched_chapters[masterclassId] = watchedList;
    
    setItem(KEYS.USERS, users);
    
    let finalUser = user;
    if (awardXP) {
      // Call updateUserXP which reads KEYS.USERS, updates XP/Coins/Companion, writes to KEYS.USERS, and returns the updated user
      const result = updateUserXP(25);
      finalUser = result.user;
    }
    
    // Also update current user if it matches
    const currentUser = JSON.parse(localStorage.getItem(KEYS.CURRENT_USER) || '{}');
    if (currentUser && currentUser.id === userId) {
      localStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(finalUser));
    }
  }
}

export function saveMasterclassReflection(userId: string, reflectionKey: string, reflectionText: string) {
  const users = getAllUsers();
  const user = users.find((u: any) => u.id === userId);
  
  if (user) {
    if (!user.reflections) {
      user.reflections = {};
    }
    user.reflections[reflectionKey] = reflectionText;
    
    setItem(KEYS.USERS, users);
    
    // Also update current user if it matches
    const currentUser = JSON.parse(localStorage.getItem(KEYS.CURRENT_USER) || '{}');
    if (currentUser && currentUser.id === userId) {
      localStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(user));
    }
  }
}

export function saveMasterclassNote(userId: string, masterclassId: string, noteTitle: string, noteText: string, chapterTitle?: string) {
  const users = getAllUsers();
  const user = users.find((u: any) => u.id === userId);
  
  if (user) {
    if (!user.masterclass_notes) {
      user.masterclass_notes = {};
    }
    if (!user.masterclass_notes[masterclassId]) {
      user.masterclass_notes[masterclassId] = [];
    }
    
    const newNote = {
      id: 'note_' + Math.random().toString(36).substr(2, 9),
      title: noteTitle,
      text: noteText,
      chapterTitle,
      created_at: new Date().toISOString()
    };
    
    user.masterclass_notes[masterclassId].unshift(newNote); // Newest first
    
    setItem(KEYS.USERS, users);
    
    // Also update current user if it matches
    const currentUser = JSON.parse(localStorage.getItem(KEYS.CURRENT_USER) || '{}');
    if (currentUser && currentUser.id === userId) {
      localStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(user));
    }
  }
}

export function updateMasterclassNote(userId: string, masterclassId: string, noteId: string, noteTitle: string, noteText: string) {
  const users = getAllUsers();
  const user = users.find((u: any) => u.id === userId);
  
  if (user && user.masterclass_notes && user.masterclass_notes[masterclassId]) {
    user.masterclass_notes[masterclassId] = user.masterclass_notes[masterclassId].map((n: any) => {
      if (n.id === noteId) {
        return {
          ...n,
          title: noteTitle,
          text: noteText,
          updated_at: new Date().toISOString()
        };
      }
      return n;
    });
    
    setItem(KEYS.USERS, users);
    
    // Also update current user if it matches
    const currentUser = JSON.parse(localStorage.getItem(KEYS.CURRENT_USER) || '{}');
    if (currentUser && currentUser.id === userId) {
      localStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(user));
    }
  }
}

export function deleteMasterclassNote(userId: string, masterclassId: string, noteId: string) {
  const users = getAllUsers();
  const user = users.find((u: any) => u.id === userId);
  
  if (user && user.masterclass_notes && user.masterclass_notes[masterclassId]) {
    user.masterclass_notes[masterclassId] = user.masterclass_notes[masterclassId].filter((n: any) => n.id !== noteId);
    
    setItem(KEYS.USERS, users);
    
    // Also update current user if it matches
    const currentUser = JSON.parse(localStorage.getItem(KEYS.CURRENT_USER) || '{}');
    if (currentUser && currentUser.id === userId) {
      localStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(user));
    }
  }
}

// Pacts Services
const PACTS_KEY = 'winterarc_pacts';

export function getPacts(): Pact[] {
  try {
    const data = localStorage.getItem(PACTS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

export async function refreshPactsFromSupabase(userId: string): Promise<Pact[]> {
  try {
    const { data, error } = await supabase
      .from('pacts')
      .select('*')
      .or(`creator_id.eq.${userId},partner_id.eq.${userId}`);
    
    if (error) {
      console.error('Error refreshing pacts from Supabase:', error);
      return getPacts();
    }

    if (data && Array.isArray(data)) {
      // Dissolved or cancelled pacts should be pruned from local storage
      const dissolvedIds = new Set(
        data.filter(p => p.status === 'dissolved' || p.status === 'cancelled').map(p => p.id)
      );
      const activeRemote = data.filter(p => p.status === 'pending' || p.status === 'active');

      const localPacts = getPacts().filter(p => !dissolvedIds.has(p.id));
      const localMap = new Map<string, Pact>(localPacts.map(p => [p.id, p]));

      activeRemote.forEach(remotePact => {
        localMap.set(remotePact.id, remotePact);
      });

      const merged = Array.from(localMap.values()).filter(p => !dissolvedIds.has(p.id));
      localStorage.setItem(PACTS_KEY, JSON.stringify(merged));
      return merged;
    }
  } catch (e) {
    console.error('Unexpected error refreshing pacts:', e);
  }
  return getPacts();
}

function cleanUserForSupabase(curr: any) {
  return {
    id: curr.id,
    name: curr.name,
    username: curr.username || curr.name,
    avatar_url: curr.avatar_url || '',
    level: curr.level || 1,
    xp: curr.xp || 0,
    created_at: curr.created_at || new Date().toISOString()
  };
}

export async function createPact(habitName: string, targetDays: number): Promise<string> {
  const pacts = getPacts();
  const code = Math.random().toString(36).substr(2, 6).toUpperCase();
  const currentId = getCurrentUserId();
  
  // Ensure creator user exists in Supabase so foreign key creator_id works
  try {
    const usersStr = localStorage.getItem('metis_users');
    if (usersStr) {
      const users = JSON.parse(usersStr);
      const curr = users.find((u: any) => u.id === currentId);
      if (curr) {
        await supabase.from('users').upsert([cleanUserForSupabase(curr)]);
      }
    }
  } catch (e) {
    console.error('Error upserting user to Supabase:', e);
  }

  const newPact: Pact = {
    id: 'pact_' + Math.random().toString(36).substr(2, 9),
    code,
    creator_id: currentId,
    habit_name: habitName.trim(),
    status: 'pending',
    target_days: targetDays,
    current_streak: 0,
    created_at: new Date().toISOString()
  };

  pacts.push(newPact);
  localStorage.setItem(PACTS_KEY, JSON.stringify(pacts));
  
  try {
    const { error } = await supabase.from('pacts').upsert([newPact]);
    if (error) {
      console.error('Error inserting pact in Supabase:', error);
    } else {
      console.log('Pact successfully created and synced to Supabase:', code);
    }
  } catch (err) {
    console.error('Supabase pact creation failed:', err);
  }

  return code;
}

export async function joinPact(code: string, currentHabitName?: string): Promise<{ success: boolean; message?: string }> {
  const currentId = getCurrentUserId();
  const codeUpper = code.trim().toUpperCase();
  
  // Ensure joining user exists in Supabase
  try {
    const usersStr = localStorage.getItem('metis_users');
    if (usersStr) {
      const users = JSON.parse(usersStr);
      const curr = users.find((u: any) => u.id === currentId);
      if (curr) {
        await supabase.from('users').upsert([cleanUserForSupabase(curr)]);
      }
    }
  } catch (e) {}

  // 1. First search in Supabase directly
  let targetPact: Pact | null = null;
  try {
    const { data, error } = await supabase
      .from('pacts')
      .select('*')
      .ilike('code', codeUpper)
      .eq('status', 'pending');

    if (!error && data && data.length > 0) {
      targetPact = data[0] as Pact;
    } else if (error) {
      console.error('Supabase query error for pact join:', error);
    }
  } catch (e) {
    console.error('Supabase query error for pact join:', e);
  }

  // 2. Fallback to local pacts if offline
  if (!targetPact) {
    const localPacts = getPacts();
    targetPact = localPacts.find(p => p.code.toUpperCase() === codeUpper && p.status === 'pending') || null;
  }

  if (!targetPact) {
    return { success: false, message: 'Código de pacto inválido o ya expirado.' };
  }
  
  if (targetPact.creator_id === currentId) {
    return { success: false, message: 'No puedes unirte a tu propio pacto.' };
  }

  const pactHabitClean = targetPact.habit_name.trim().toLowerCase();
  
  // Verify that the user is joining from the same habit
  if (currentHabitName) {
    const currentHabitClean = currentHabitName.trim().toLowerCase();
    if (pactHabitClean !== currentHabitClean) {
      return { 
        success: false, 
        message: `Este pacto es para el hábito "${targetPact.habit_name}". Debes introducir el código desde ese mismo hábito.` 
      };
    }
  }
  
  // Verify that the user joining also has a habit with the same name
  try {
    const data = localStorage.getItem('metis_habits');
    const myHabits = (data ? JSON.parse(data) : []).filter((h: any) => h.user_id === currentId && !h.archived);
    const hasMatchingHabit = myHabits.some((h: any) => h.name.trim().toLowerCase() === pactHabitClean);
    if (!hasMatchingHabit) {
      return { 
        success: false, 
        message: `Debes tener un hábito llamado "${targetPact.habit_name}" en tu lista para unirte.` 
      };
    }
  } catch(e) {}
  
  const updatedPact: Pact = {
    ...targetPact,
    partner_id: currentId,
    status: 'active',
    start_date: new Date().toISOString()
  };

  // Save to local storage
  const pacts = getPacts().filter(p => p.id !== updatedPact.id);
  pacts.push(updatedPact);
  localStorage.setItem(PACTS_KEY, JSON.stringify(pacts));
  
  // Update Supabase
  try {
    const { error } = await supabase.from('pacts').upsert([updatedPact]);
    if (error) console.error('Error updating pact in Supabase:', error);
  } catch (err) {
    console.error('Supabase pact update failed:', err);
  }

  return { success: true };
}

export async function cancelPact(pactId: string): Promise<void> {
  const pacts = getPacts();
  const updated = pacts.filter(p => p.id !== pactId);
  localStorage.setItem(PACTS_KEY, JSON.stringify(updated));
  
  try {
    // Mark as dissolved in Supabase so all partner devices get notified and prune local storage
    await supabase.from('pacts').update({ status: 'dissolved' }).eq('id', pactId);
  } catch (e) {
    console.error('Error dissolving pact in Supabase:', e);
  }
}

export async function getPartnerCompletionStatus(partnerId: string, habitName: string, dateStr: string): Promise<boolean> {
  const cleanName = habitName.trim().toLowerCase();
  const yesterdayStr = getDayBeforeDateString(dateStr);
  const tomorrowStr = getFutureLocalDateString(1, dateStr);

  // 1. Authoritative check in Supabase across devices
  try {
    const { data: partnerHabits, error: habitErr } = await supabase
      .from('habits')
      .select('id, name')
      .eq('user_id', partnerId);

    if (!habitErr && partnerHabits && partnerHabits.length > 0) {
      const matchingHabitIds = partnerHabits
        .filter(h => h.name.trim().toLowerCase() === cleanName)
        .map(h => h.id);

      if (matchingHabitIds.length > 0) {
        const { data: compData, error: compErr } = await supabase
          .from('completions')
          .select('id, date')
          .eq('user_id', partnerId)
          .in('date', [dateStr, yesterdayStr, tomorrowStr])
          .eq('is_fully_completed', true)
          .in('habit_id', matchingHabitIds);

        if (!compErr && Array.isArray(compData)) {
          return compData.some(c => c.date === dateStr || c.date === yesterdayStr);
        }
      } else {
        // Partner has habits in Supabase but none matching this name
        return false;
      }
    }
  } catch (e) {
    console.error('Error fetching partner completion status from Supabase:', e);
  }

  // 2. Offline fallback to local completions
  try {
    const completions: HabitCompletion[] = getItem(KEYS.COMPLETIONS);
    const habits: Habit[] = getItem(KEYS.HABITS);
    const partnerHabits = habits.filter(h => h.user_id === partnerId && h.name.trim().toLowerCase() === cleanName);
    const partnerHabitIds = new Set(partnerHabits.map(h => h.id));
    
    if (partnerHabitIds.size > 0) {
      return completions.some(c => 
        c.user_id === partnerId && 
        (c.date === dateStr || c.date === yesterdayStr) && 
        c.is_fully_completed !== false &&
        partnerHabitIds.has(c.habit_id)
      );
    }
  } catch (e) {}

  return false;
}

export async function calculatePactStreak(pact: Pact): Promise<number> {
  if (!pact || pact.status !== 'active' || !pact.partner_id) {
    return 0;
  }

  const cleanName = pact.habit_name.trim().toLowerCase();
  const creatorId = pact.creator_id;
  const partnerId = pact.partner_id;

  try {
    // 1. Fetch habits for both users in Supabase
    const { data: creatorHabits } = await supabase.from('habits').select('id, name').eq('user_id', creatorId);
    const { data: partnerHabits } = await supabase.from('habits').select('id, name').eq('user_id', partnerId);

    const cIds = (creatorHabits || []).filter(h => h.name.trim().toLowerCase() === cleanName).map(h => h.id);
    const pIds = (partnerHabits || []).filter(h => h.name.trim().toLowerCase() === cleanName).map(h => h.id);

    if (cIds.length > 0 && pIds.length > 0) {
      // 2. Fetch completions for both users
      const { data: cComps } = await supabase
        .from('completions')
        .select('date, is_fully_completed')
        .eq('user_id', creatorId)
        .in('habit_id', cIds);

      const { data: pComps } = await supabase
        .from('completions')
        .select('date, is_fully_completed')
        .eq('user_id', partnerId)
        .in('habit_id', pIds);

      const cDates = new Set((cComps || []).filter(c => c.is_fully_completed).map(c => c.date));
      const pDates = new Set((pComps || []).filter(c => c.is_fully_completed).map(c => c.date));

      const todayStr = getLocalDateString();
      let checkDate = parseLocalDate(todayStr);
      let streak = 0;

      for (let i = 0; i < 90; i++) {
        const dStr = getLocalDateString(checkDate);
        const isToday = (dStr === todayStr);

        const bothDone = cDates.has(dStr) && pDates.has(dStr);

        if (bothDone) {
          streak++;
        } else {
          if (!isToday) {
            // Missed a past scheduled day -> streak broken
            break;
          }
        }
        checkDate.setDate(checkDate.getDate() - 1);
      }

      // If streak changed, update pact in Supabase & local storage
      if (pact.current_streak !== streak) {
        pact.current_streak = streak;
        const pacts = getPacts().map(p => p.id === pact.id ? { ...p, current_streak: streak } : p);
        localStorage.setItem(PACTS_KEY, JSON.stringify(pacts));
        supabase.from('pacts').update({ current_streak: streak }).eq('id', pact.id).then();
      }

      return streak;
    }
  } catch (e) {
    console.error('Error calculating pact streak:', e);
  }

  return pact.current_streak || 0;
}

export function getPactXPReward(streak: number): number {
  if (streak > 60) return 30;
  if (streak > 30) return 20;
  if (streak > 21) return 10;
  if (streak > 14) return 6;
  if (streak > 7) return 4;
  return 2;
}

export function getPactMilestoneTarget(streak: number): number {
  if (streak >= 60) return 90;
  if (streak >= 30) return 60;
  if (streak >= 21) return 30;
  if (streak >= 14) return 21;
  if (streak >= 7) return 14;
  return 7;
}

export function getPactTierDetails(streak: number) {
  const currentBonus = getPactXPReward(streak);
  const currentMilestone = getPactMilestoneTarget(streak);
  const nextBonus = getPactXPReward(currentMilestone + 1);
  return {
    currentBonus,
    currentMilestone,
    nextBonus,
    isMaxTier: streak > 60
  };
}

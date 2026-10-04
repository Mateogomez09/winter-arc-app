import { supabase } from '../lib/supabaseClient';
import { User, Habit } from '../types';
import { pullAllFromSupabase } from './supabaseSync';

import { PRESET_AVATARS } from '../utils/profileCustomization';

export interface AuthResult {
  success: boolean;
  user?: User;
  error?: string;
  needsEmailConfirmation?: boolean;
}

const DEFAULT_AVATAR = PRESET_AVATARS[1].url;

// Helper to translate Supabase Auth error messages to friendly Spanish
function mapAuthError(error: any): string {
  if (!error) return 'Error desconocido de autenticación.';
  const message = error.message || '';
  
  if (message.includes('User already registered') || message.includes('already exists')) {
    return 'Este correo electrónico ya está registrado. Por favor, inicia sesión.';
  }
  if (message.includes('Invalid login credentials') || message.includes('invalid_grant')) {
    return 'Correo electrónico o contraseña incorrectos.';
  }
  if (message.includes('Password should be at least 6 characters')) {
    return 'La contraseña debe tener al menos 6 caracteres.';
  }
  if (message.includes('Email not confirmed')) {
    return 'Debes confirmar tu correo electrónico antes de iniciar sesión.';
  }
  if (message.includes('rate limit') || message.includes('too many requests')) {
    return 'Demasiados intentos. Espera unos momentos e inténtalo de nuevo.';
  }
  if (message.includes('valid email')) {
    return 'Introduce un correo electrónico válido.';
  }
  return message || 'Ha ocurrido un error. Inténtalo de nuevo.';
}

/**
 * Register a new user with Supabase Auth (email & password)
 */
export async function signUpUser(
  email: string, 
  password: string, 
  name: string, 
  username: string
): Promise<AuthResult> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanUsername = username.trim().toLowerCase().replace(/[@\s]/g, '');
  const cleanName = name.trim();

  if (!cleanEmail || !password || !cleanName || !cleanUsername) {
    return { success: false, error: 'Todos los campos son obligatorios.' };
  }

  if (password.length < 6) {
    return { success: false, error: 'La contraseña debe tener al menos 6 caracteres.' };
  }

  try {
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          name: cleanName,
          username: cleanUsername
        }
      }
    });

    if (error) {
      return { success: false, error: mapAuthError(error) };
    }

    if (!data.user) {
      return { success: false, error: 'No se pudo crear el usuario. Inténtalo de nuevo.' };
    }

    const newUserProfile: User = {
      id: data.user.id,
      name: cleanName,
      username: cleanUsername,
      email: cleanEmail,
      avatar_url: DEFAULT_AVATAR,
      avatar_frame: 'default',
      name_color: 'default',
      title: 'Iniciado del Frío',
      bio: '',
      xp: 0,
      level: 1,
      coins: 100,
      created_at: new Date().toISOString()
    };

    // 1. Upsert public user profile into Supabase
    try {
      const { error: userErr } = await supabase.from('users').upsert([{
        id: newUserProfile.id,
        name: newUserProfile.name,
        username: newUserProfile.username,
        avatar_url: newUserProfile.avatar_url,
        level: newUserProfile.level,
        xp: newUserProfile.xp,
        created_at: newUserProfile.created_at
      }]);
      if (userErr) {
        console.warn('Note: Could not immediately upsert user row in Supabase:', userErr.message);
      }
    } catch (dbErr) {
      console.warn('Note: Could not immediately upsert user row in Supabase:', dbErr);
    }

    // 2. Initialize 3 default Winter Arc habits for this user
    const defaultHabitNames = ['Ejercicio físico 1 hora', 'Buena rutina de sueño', '30 mins aprendiendo algo'];
    const initialHabits: Habit[] = defaultHabitNames.map(hName => ({
      id: `habit_${data.user!.id.slice(0, 8)}_${Math.random().toString(36).substring(2, 7)}`,
      user_id: data.user!.id,
      goal_id: 'winter_arc_core',
      name: hName,
      frequency: 'daily',
      privacy: 'public',
      current_streak: 0,
      best_streak: 0,
      wildcard_available: true,
      archived: false,
      created_at: new Date().toISOString()
    }));

    try {
      await supabase.from('habits').upsert(initialHabits.map(h => ({
        id: h.id,
        user_id: h.user_id,
        name: h.name,
        frequency: h.frequency,
        current_streak: h.current_streak,
        best_streak: h.best_streak,
        wildcard_available: h.wildcard_available,
        archived: h.archived,
        created_at: h.created_at
      })));
    } catch (hErr) {
      console.warn('Note: Could not upsert initial habits:', hErr);
    }

    // 3. Save profile and habits to localStorage for offline / Local-First support
    const localUsers: User[] = JSON.parse(localStorage.getItem('metis_users') || '[]');
    const existingIndex = localUsers.findIndex(u => u.id === newUserProfile.id);
    if (existingIndex >= 0) {
      localUsers[existingIndex] = newUserProfile;
    } else {
      localUsers.push(newUserProfile);
    }
    localStorage.setItem('metis_users', JSON.stringify(localUsers));
    localStorage.setItem('metis_current_user_id', newUserProfile.id);

    const localHabits: Habit[] = JSON.parse(localStorage.getItem('metis_habits') || '[]');
    const otherHabits = localHabits.filter(h => h.user_id !== newUserProfile.id);
    localStorage.setItem('metis_habits', JSON.stringify([...otherHabits, ...initialHabits]));

    // Check if Supabase requires email confirmation
    const needsEmailConfirmation = !data.session;

    return { 
      success: true, 
      user: newUserProfile, 
      needsEmailConfirmation 
    };
  } catch (err: any) {
    console.error('Sign up error:', err);
    return { success: false, error: mapAuthError(err) };
  }
}

/**
 * Sign in existing user with email and password via Supabase Auth
 */
export async function signInUser(email: string, password: string): Promise<AuthResult> {
  const cleanEmail = email.trim().toLowerCase();

  if (!cleanEmail || !password) {
    return { success: false, error: 'Introduce tu correo y contraseña.' };
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password
    });

    if (error) {
      return { success: false, error: mapAuthError(error) };
    }

    if (!data.user) {
      return { success: false, error: 'No se pudo iniciar sesión.' };
    }

    const userId = data.user.id;

    // 1. Fetch user profile from Supabase
    let profileRow: any = null;
    try {
      const { data: pRow } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
      if (pRow) profileRow = pRow;
    } catch (e) {}

    const meta = data.user.user_metadata || {};
    const localUsers: User[] = JSON.parse(localStorage.getItem('metis_users') || '[]');
    const localUser = localUsers.find(u => u.id === userId);

    const userProfile: User = {
      ...(profileRow || {}),
      id: userId,
      name: profileRow?.name || meta.name || localUser?.name || cleanEmail.split('@')[0],
      username: profileRow?.username || meta.username || localUser?.username || cleanEmail.split('@')[0].toLowerCase(),
      email: cleanEmail,
      avatar_url: profileRow?.avatar_url || meta.avatar_url || localUser?.avatar_url || DEFAULT_AVATAR,
      avatar_frame: meta.avatar_frame || localUser?.avatar_frame || 'default',
      name_color: meta.name_color || localUser?.name_color || 'default',
      title: meta.title || localUser?.title || 'Iniciado del Frío',
      bio: profileRow?.bio || meta.bio || localUser?.bio || '',
      level: profileRow?.level || localUser?.level || 1,
      xp: profileRow?.xp || localUser?.xp || 0,
      coins: profileRow?.coins || localUser?.coins || 100,
      created_at: profileRow?.created_at || data.user.created_at || new Date().toISOString()
    };

    // If no row exists in users table, upsert minimal SQL columns
    if (!profileRow) {
      try {
        await supabase.from('users').upsert([{
          id: userId,
          name: userProfile.name,
          username: userProfile.username,
          avatar_url: userProfile.avatar_url,
          level: userProfile.level,
          xp: userProfile.xp,
          created_at: userProfile.created_at
        }]);
      } catch (e) {
        // ignore
      }
    }

    // 2. Set current user ID in localStorage
    localStorage.setItem('metis_current_user_id', userId);

    // 3. Save into local users array
    const uIdx = localUsers.findIndex(u => u.id === userId);
    if (uIdx >= 0) {
      localUsers[uIdx] = { ...localUsers[uIdx], ...userProfile };
    } else {
      localUsers.push(userProfile);
    }
    localStorage.setItem('metis_users', JSON.stringify(localUsers));

    // 4. Background pull of user habits, completions, pacts
    pullAllFromSupabase(userId).catch(err => console.error('Error in initial pull after login:', err));

    return { 
      success: true, 
      user: userProfile 
    };
  } catch (err: any) {
    console.error('Sign in error:', err);
    return { success: false, error: mapAuthError(err) };
  }
}

/**
 * Sign out user from Supabase and clear session
 */
export async function signOutUser(): Promise<void> {
  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.warn('Supabase signOut notice:', err);
  } finally {
    localStorage.removeItem('metis_current_user_id');
  }
}

/**
 * Send password reset email
 */
export async function resetUserPassword(email: string): Promise<{ success: boolean; message: string }> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) {
    return { success: false, message: 'Introduce un correo electrónico válido.' };
  }

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: window.location.origin
    });

    if (error) {
      return { success: false, message: mapAuthError(error) };
    }

    return { 
      success: true, 
      message: 'Te hemos enviado un correo con instrucciones para restablecer tu contraseña.' 
    };
  } catch (err: any) {
    return { success: false, message: mapAuthError(err) };
  }
}

/**
 * Get active session user on startup
 */
export async function getCurrentAuthUser(): Promise<User | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !session.user) {
      return null;
    }

    const userId = session.user.id;
    localStorage.setItem('metis_current_user_id', userId);

    const meta = session.user.user_metadata || {};
    const localUsers: User[] = JSON.parse(localStorage.getItem('metis_users') || '[]');
    const localUser = localUsers.find(u => u.id === userId);

    let user: User = {
      id: userId,
      name: localUser?.name || meta.name || session.user.email?.split('@')[0] || 'Guerrero',
      username: localUser?.username || meta.username || session.user.email?.split('@')[0].toLowerCase() || 'guerrero',
      email: session.user.email || '',
      avatar_url: localUser?.avatar_url || meta.avatar_url || DEFAULT_AVATAR,
      avatar_frame: meta.avatar_frame || localUser?.avatar_frame || 'default',
      name_color: meta.name_color || localUser?.name_color || 'default',
      title: meta.title || localUser?.title || 'Iniciado del Frío',
      bio: '',
      xp: localUser?.xp || 0,
      level: localUser?.level || 1,
      coins: localUser?.coins || 100,
      created_at: session.user.created_at || new Date().toISOString()
    };

    // Fetch latest profile from Supabase in background
    try {
      const { data: remoteUser, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (!error && remoteUser) {
        user = {
          ...user,
          ...remoteUser,
          avatar_url: remoteUser.avatar_url || user.avatar_url,
          avatar_frame: meta.avatar_frame || user.avatar_frame,
          name_color: meta.name_color || user.name_color,
          title: meta.title || user.title
        };
      }
    } catch (e) {
      // Local cache used
    }

    const uIdx = localUsers.findIndex(u => u.id === userId);
    if (uIdx >= 0) {
      localUsers[uIdx] = user;
    } else {
      localUsers.push(user);
    }
    localStorage.setItem('metis_users', JSON.stringify(localUsers));

    return user;
  } catch (err) {
    console.error('Error getting current auth user:', err);
    return null;
  }
}

/**
 * Permanently delete user account and all associated data across Supabase and LocalStorage (GDPR Compliant)
 */
export async function deleteUserAccount(userId: string): Promise<boolean> {
  if (!userId) return false;

  try {
    // 1. Delete user habits and completions from Supabase
    await supabase.from('completions').delete().eq('user_id', userId);
    await supabase.from('habits').delete().eq('user_id', userId);

    // 2. Delete social comments, likes, and posts from Supabase
    await supabase.from('value_comments').delete().eq('user_id', userId);
    await supabase.from('value_likes').delete().eq('user_id', userId);
    await supabase.from('value_posts').delete().eq('user_id', userId);

    // 3. Delete pacts associated with user
    await supabase.from('pacts').delete().or(`creator_id.eq.${userId},partner_id.eq.${userId}`);

    // 4. Delete user profile row from Supabase
    await supabase.from('users').delete().eq('id', userId);

    // 5. Try calling delete_user RPC if configured in Supabase
    try {
      await supabase.rpc('delete_user');
    } catch (e) {
      // Data in tables already wiped
    }

    // 6. Sign out from Supabase Auth
    await supabase.auth.signOut();

    // 7. Clear all local storage
    localStorage.clear();

    return true;
  } catch (err) {
    console.error('Error deleting user account:', err);
    try {
      await supabase.auth.signOut();
      localStorage.clear();
    } catch (e) {}
    return false;
  }
}

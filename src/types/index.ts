export interface Companion {
  name: string;
  type: 'slime' | 'gato' | 'cyborg' | 'fenix';
  skin: string;
  level: number;
  xp: number;
  accessories: string[];
  last_update: string;
}

export interface User {
  id: string;
  name: string;
  username: string;
  email: string;
  password?: string;
  avatar_url?: string;
  avatar_frame?: string;
  name_color?: string;
  title?: string;
  xp: number;
  level: number;
  created_at: string;
  coins: number;
  companion?: Companion;
  inventory?: string[];
  role?: string;
  saved_masterclasses?: string[];
  unlocked_masterclasses?: string[];
  watched_chapters?: Record<string, number[]>;
  xp_awarded_chapters?: Record<string, number[]>;
  reflections?: Record<string, string>;
  masterclass_notes?: Record<string, { id: string; title: string; text: string; chapterTitle?: string; created_at: string; }[]>;
  bio?: string;
  gender?: string;
  links?: { title: string; url: string; }[];
  grid_items?: string[];
  followers_count?: number | string;
  following_count?: number;
  posts_count?: number;
}

export interface MasterclassView {
  id: string;
  masterclass_id: string;
  user_id: string;
  date: string;
}

export interface Goal {
  id: string;
  user_id: string;
  title: string;
  category: string; // Físico, Negocio, Estudios, Salud, Relaciones, Finanzas, Mentalidad, Productividad, etc.
  priority: number; // 1 (Top 3) or 0 (normal)
  created_at: string;
  description?: string;
  isTopThree?: boolean;
  privacy?: 'public' | 'friends' | 'private';
}

export interface Habit {
  id: string;
  user_id: string;
  goal_id: string;
  name: string;
  category?: string;
  frequency: 'daily' | 'weekly' | 'custom';
  custom_days?: number[]; // Array of days, e.g., [1, 3, 5] for Mon, Wed, Fri
  privacy: 'friends' | 'public';
  current_streak: number;
  best_streak: number;
  wildcard_available: boolean; // 1 wildcard per month
  archived: boolean;
  created_at: string;
  is_quantitative?: boolean;
  target_count?: number;
  unit?: string;
  is_time_based?: boolean;
  target_time_minutes?: number;
  requires_photo?: boolean;
  target_type?: 'check' | 'quant' | 'time';
  target_unit?: string;
  target_time?: number;
  source_mc_id?: string;
  source_mc_title?: string;
}

export interface HabitCompletion {
  id: string;
  habit_id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  photo_url: string; // Simulation or dataURI of verification photo
  completed_at: string;
  used_wildcard: boolean;
  current_progress?: number;
  is_fully_completed?: boolean;
}

export interface Task {
  id: string;
  user_id: string;
  title: string;
  date: string; // YYYY-MM-DD
  completed: boolean;
  completed_at?: string;
  created_at: string;
  original_date?: string;
  priority?: 1 | 2 | 3; // 1: Alta, 2: Media, 3: Baja
}

export interface Friendship {
  id: string;
  requester_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
}

export interface Tribe {
  id: string;
  name: string;
  habit_name: string;
  current_streak: number;
  best_streak: number;
  wildcard_available: boolean;
  created_by: string;
  created_at: string;
}

export interface TribeMember {
  id: string;
  tribe_id: string;
  user_id: string;
  role: 'admin' | 'member';
  status?: 'pending' | 'active';
  joined_at: string;
}

export interface TribeCompletion {
  id: string;
  tribe_id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  photo_url: string;
  completed_at: string;
}

export interface TribeMessage {
  id: string;
  tribe_id: string;
  user_id: string;
  message: string;
  created_at: string;
}

export interface Challenge {
  id: string;
  name: string;
  habit_name: string;
  duration_days: number; // 7, 14, 30, 60, 100
  start_date: string;
  end_date: string;
  created_by: string;
  status: 'active' | 'completed';
  created_at: string;
}

export interface ChallengeParticipant {
  id: string;
  challenge_id: string;
  user_id: string;
  progress: number; // Current streak or completed days in challenge
  completed_days: number;
  is_winner: boolean;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string; // Lucide icon name or emoji representation
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

export interface UserBadge {
  id: string;
  user_id: string;
  badge_id: string;
  earned_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: 'streak_broken' | 'friend_request' | 'friend_accepted' | 'tribe_invite' | 'challenge_invite' | 'reminder' | 'tribe_risk' | 'time_warning' | 'xp_gain' | 'level_up' | 'badge_earned';
  title: string;
  body: string;
  read: boolean;
  created_at: string;
}

export interface Chapter {
  id: string;
  order: number;
  title: string;
  description: string;
  video_url: string;
  duration?: string;
  extractable_habits: Partial<Habit>[];
}

export interface Masterclass {
  id: string;
  title: string;
  author: string;
  author_id?: string;
  author_avatar: string;
  duration: string;
  category: string;
  thumbnail: string;
  trailer_url: string;
  description: string;
  price?: number;
  outcomes?: string[];
  chapters: Chapter[];
}

export interface SaleTransaction {
  id: string;
  user_id: string;
  masterclass_id: string;
  amount: number;
  date: string;
}

export interface ValuePost {
  id: string;
  user_id: string;
  author_name?: string;
  author_avatar?: string;
  author_level?: number;
  content: string;
  likes_count?: number;
  created_at: string;
}

export interface ValueLike {
  id: string;
  post_id: string;
  user_id: string;
  created_at: string;
}

export interface ValueComment {
  id: string;
  post_id: string;
  user_id: string;
  parent_id?: string | null;
  reply_to_user_name?: string | null;
  author_name: string;
  author_avatar: string;
  author_level?: number;
  content: string;
  created_at: string;
}

export interface Pact {
  id: string;
  code: string;
  creator_id: string;
  partner_id?: string;
  habit_name: string;
  status: 'pending' | 'active' | 'failed' | 'completed' | 'dissolved' | 'cancelled';
  target_days: number;
  current_streak: number;
  start_date?: string;
  created_at: string;
}

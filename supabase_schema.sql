-- =========================================================================
-- WINTER ARC APP — PRODUCTION SUPABASE SCHEMA (10,000+ USERS OPTIMIZED)
-- =========================================================================

-- 1. Users Table (Public Profile Data)
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  password TEXT,
  avatar_url TEXT,
  avatar_frame TEXT DEFAULT 'default',
  name_color TEXT DEFAULT 'default',
  title TEXT DEFAULT '',
  bio TEXT DEFAULT '',
  xp INTEGER DEFAULT 0 NOT NULL,
  level INTEGER DEFAULT 1 NOT NULL,
  coins INTEGER DEFAULT 0 NOT NULL,
  companion JSONB,
  inventory TEXT[],
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_frame TEXT DEFAULT 'default';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS name_color TEXT DEFAULT 'default';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS title TEXT DEFAULT '';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT '';
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_users_xp_desc ON public.users (xp DESC);
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users (username);

-- 2. Habits Table
CREATE TABLE IF NOT EXISTS public.habits (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  goal_id TEXT,
  name TEXT NOT NULL,
  category TEXT,
  frequency TEXT DEFAULT 'daily' NOT NULL,
  custom_days INTEGER[],
  privacy TEXT DEFAULT 'friends',
  current_streak INTEGER DEFAULT 0,
  best_streak INTEGER DEFAULT 0,
  wildcard_available BOOLEAN DEFAULT TRUE,
  archived BOOLEAN DEFAULT FALSE,
  is_quantitative BOOLEAN DEFAULT FALSE,
  target_count INTEGER,
  unit TEXT,
  is_time_based BOOLEAN DEFAULT FALSE,
  target_time_minutes INTEGER,
  requires_photo BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.habits DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_habits_user_id ON public.habits (user_id);
CREATE INDEX IF NOT EXISTS idx_habits_user_active ON public.habits (user_id) WHERE archived = false;

-- 3. Completions Table (with Deduplication Unique Constraint)
CREATE TABLE IF NOT EXISTS public.completions (
  id TEXT PRIMARY KEY,
  habit_id TEXT NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date TEXT NOT NULL, -- YYYY-MM-DD
  photo_url TEXT,
  completed_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  used_wildcard BOOLEAN DEFAULT FALSE,
  current_progress INTEGER,
  is_fully_completed BOOLEAN DEFAULT TRUE
);
ALTER TABLE public.completions DISABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS idx_completions_unique_daily ON public.completions (user_id, habit_id, date);
CREATE INDEX IF NOT EXISTS idx_completions_user_date ON public.completions (user_id, date);
CREATE INDEX IF NOT EXISTS idx_completions_habit_date ON public.completions (habit_id, date);

-- 4. Tasks Table
CREATE TABLE IF NOT EXISTS public.tasks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  date TEXT NOT NULL, -- YYYY-MM-DD
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  original_date TEXT,
  priority INTEGER DEFAULT 2,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.tasks DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_tasks_user_date ON public.tasks (user_id, date);

-- 5. Pacts Table (Partner Accountability System)
CREATE TABLE IF NOT EXISTS public.pacts (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  creator_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  partner_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  habit_name TEXT NOT NULL,
  status TEXT DEFAULT 'pending' NOT NULL, -- 'pending', 'active', 'dissolved', 'completed', 'failed'
  target_days INTEGER DEFAULT 7 NOT NULL,
  current_streak INTEGER DEFAULT 0 NOT NULL,
  start_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.pacts DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_pacts_code ON public.pacts (upper(code));
CREATE INDEX IF NOT EXISTS idx_pacts_creator_id ON public.pacts (creator_id);
CREATE INDEX IF NOT EXISTS idx_pacts_partner_id ON public.pacts (partner_id);
CREATE INDEX IF NOT EXISTS idx_pacts_status_active ON public.pacts (status) WHERE status IN ('pending', 'active');

-- 6. Value Board: Posts
CREATE TABLE IF NOT EXISTS public.value_posts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  author_avatar TEXT,
  author_level INTEGER DEFAULT 1,
  content TEXT NOT NULL,
  likes_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.value_posts DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_value_posts_created_at_desc ON public.value_posts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_value_posts_user_id ON public.value_posts (user_id);

-- 7. Value Board: Likes (with Deduplication Constraint)
CREATE TABLE IF NOT EXISTS public.value_likes (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES public.value_posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.value_likes DISABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS idx_value_likes_unique_user_post ON public.value_likes (post_id, user_id);
CREATE INDEX IF NOT EXISTS idx_value_likes_post_id ON public.value_likes (post_id);
CREATE INDEX IF NOT EXISTS idx_value_likes_user_id ON public.value_likes (user_id);

-- 8. Value Board: Comments (Threaded Replies)
CREATE TABLE IF NOT EXISTS public.value_comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES public.value_posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  parent_id TEXT REFERENCES public.value_comments(id) ON DELETE CASCADE,
  reply_to_user_name TEXT,
  author_name TEXT NOT NULL,
  author_avatar TEXT,
  author_level INTEGER DEFAULT 1,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.value_comments DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_value_comments_post_created ON public.value_comments (post_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_value_comments_user_created ON public.value_comments (user_id, created_at DESC);

-- 9. Atomic XP Increment Stored Procedure (Race Condition Protection)
CREATE OR REPLACE FUNCTION public.atomic_increment_user_xp(
  p_user_id TEXT,
  p_amount INTEGER
)
RETURNS TABLE (new_xp INTEGER, new_level INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_xp INTEGER;
  v_level INTEGER;
BEGIN
  UPDATE public.users
  SET 
    xp = GREATEST(0, xp + p_amount),
    level = (GREATEST(0, xp + p_amount) / 200) + 1
  WHERE id = p_user_id
  RETURNING xp, level INTO v_xp, v_level;

  RETURN QUERY SELECT v_xp, v_level;
END;
$$;

-- 10. Web Push Subscriptions for Native Background Notifications
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can manage push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Public can manage push subscriptions"
ON public.push_subscriptions
FOR ALL
USING (true)
WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_push_subs_user_id ON public.push_subscriptions (user_id);

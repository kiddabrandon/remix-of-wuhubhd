
-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.user_watchlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tmdb_id INTEGER NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('movie','tv')),
  title TEXT NOT NULL,
  poster_path TEXT,
  year TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, tmdb_id, media_type)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_watchlists TO authenticated;
GRANT ALL ON public.user_watchlists TO service_role;
ALTER TABLE public.user_watchlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own watchlist" ON public.user_watchlists FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_user_watchlists_user ON public.user_watchlists(user_id, created_at DESC);

CREATE TABLE public.user_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tmdb_id INTEGER NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('movie','tv')),
  title TEXT NOT NULL,
  poster_path TEXT,
  backdrop_path TEXT,
  season INTEGER,
  episode INTEGER,
  progress_pct NUMERIC(5,2) DEFAULT 0,
  watched_episodes JSONB DEFAULT '[]'::jsonb,
  position_seconds numeric NOT NULL DEFAULT 0,
  duration_seconds numeric NOT NULL DEFAULT 0,
  fully_watched boolean NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, tmdb_id, media_type)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_progress TO authenticated;
GRANT ALL ON public.user_progress TO service_role;
ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own progress" ON public.user_progress FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_user_progress_user ON public.user_progress(user_id, updated_at DESC);
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

CREATE TYPE public.app_role AS ENUM ('admin','user','super_admin');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role::text IN ('admin','super_admin'));
$$;

CREATE TABLE public.app_config (
  id text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT ON public.app_config TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.app_config TO authenticated;
GRANT ALL ON public.app_config TO service_role;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads config" ON public.app_config FOR SELECT USING (true);
CREATE POLICY "Admins insert config" ON public.app_config FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update config" ON public.app_config FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete config" ON public.app_config FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

INSERT INTO public.app_config (id, value)
VALUES ('site', '{"serverOrder":[],"animeProviders":["gogoanime","zoro","animepahe"]}'::jsonb)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE public.party_rooms (
  code text PRIMARY KEY,
  host_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_id integer NOT NULL,
  content_type text NOT NULL,
  title text NOT NULL,
  season_number integer,
  episode_number integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.party_rooms TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.party_rooms TO authenticated;
GRANT ALL ON public.party_rooms TO service_role;
ALTER TABLE public.party_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "party_rooms_read_all" ON public.party_rooms FOR SELECT USING (true);
CREATE POLICY "party_rooms_host_insert" ON public.party_rooms FOR INSERT TO authenticated WITH CHECK (auth.uid() = host_id);
CREATE POLICY "party_rooms_host_update" ON public.party_rooms FOR UPDATE TO authenticated USING (auth.uid() = host_id) WITH CHECK (auth.uid() = host_id);
CREATE POLICY "party_rooms_host_delete" ON public.party_rooms FOR DELETE TO authenticated USING (auth.uid() = host_id);

CREATE TABLE public.party_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code text NOT NULL REFERENCES public.party_rooms(code) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX party_messages_room_created_idx ON public.party_messages(room_code, created_at);
GRANT SELECT ON public.party_messages TO anon;
GRANT SELECT, INSERT ON public.party_messages TO authenticated;
GRANT ALL ON public.party_messages TO service_role;
ALTER TABLE public.party_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "party_messages_read_all" ON public.party_messages FOR SELECT USING (true);
CREATE POLICY "party_messages_auth_insert" ON public.party_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.server_health (
  server_name text PRIMARY KEY,
  category text NOT NULL DEFAULT 'stream',
  is_online boolean NOT NULL DEFAULT true,
  latency_ms integer,
  last_checked timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.server_health TO anon, authenticated;
GRANT ALL ON public.server_health TO service_role;
ALTER TABLE public.server_health ENABLE ROW LEVEL SECURITY;
CREATE POLICY "server_health_read_all" ON public.server_health FOR SELECT USING (true);
CREATE POLICY "server_health_admin_write" ON public.server_health FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message text NOT NULL,
  variant text NOT NULL DEFAULT 'info',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.announcements TO anon, authenticated;
GRANT ALL ON public.announcements TO service_role;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "announcements_read_all" ON public.announcements FOR SELECT USING (true);
CREATE POLICY "announcements_admin_write" ON public.announcements FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE public.hero_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id integer NOT NULL,
  content_type text NOT NULL,
  title text NOT NULL,
  tagline text,
  backdrop_path text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.hero_overrides TO anon, authenticated;
GRANT ALL ON public.hero_overrides TO service_role;
ALTER TABLE public.hero_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hero_overrides_read_all" ON public.hero_overrides FOR SELECT USING (true);
CREATE POLICY "hero_overrides_admin_write" ON public.hero_overrides FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE public.feature_flags (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.feature_flags TO anon, authenticated;
GRANT ALL ON public.feature_flags TO service_role;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feature_flags_read_all" ON public.feature_flags FOR SELECT USING (true);
CREATE POLICY "feature_flags_admin_write" ON public.feature_flags FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE public.error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message text NOT NULL,
  stack text,
  url text,
  user_agent text,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX error_logs_created_idx ON public.error_logs(created_at DESC);
GRANT SELECT, INSERT, DELETE ON public.error_logs TO authenticated;
GRANT ALL ON public.error_logs TO service_role;
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "error_logs_auth_insert" ON public.error_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "error_logs_admin_read" ON public.error_logs FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "error_logs_admin_delete" ON public.error_logs FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.user_progress_lww()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.position_seconds < OLD.position_seconds AND NEW.fully_watched = OLD.fully_watched THEN
      NEW.position_seconds := OLD.position_seconds;
    END IF;
    IF OLD.fully_watched AND NOT NEW.fully_watched THEN
      NEW.fully_watched := OLD.fully_watched;
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER user_progress_lww_trg BEFORE INSERT OR UPDATE ON public.user_progress
FOR EACH ROW EXECUTE FUNCTION public.user_progress_lww();

ALTER PUBLICATION supabase_realtime ADD TABLE public.party_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.party_messages;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferences jsonb NOT NULL DEFAULT '{}'::jsonb;

REVOKE EXECUTE ON FUNCTION public.user_progress_lww() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO service_role;

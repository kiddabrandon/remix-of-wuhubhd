-- Helper function for admin role check (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role::text IN ('admin','super_admin')
  );
$$;

-- Party rooms
CREATE TABLE IF NOT EXISTS public.party_rooms (
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
CREATE POLICY "party_rooms_host_insert" ON public.party_rooms FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = host_id);
CREATE POLICY "party_rooms_host_update" ON public.party_rooms FOR UPDATE TO authenticated
  USING (auth.uid() = host_id) WITH CHECK (auth.uid() = host_id);
CREATE POLICY "party_rooms_host_delete" ON public.party_rooms FOR DELETE TO authenticated
  USING (auth.uid() = host_id);

-- Party messages
CREATE TABLE IF NOT EXISTS public.party_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code text NOT NULL REFERENCES public.party_rooms(code) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS party_messages_room_created_idx
  ON public.party_messages(room_code, created_at);
GRANT SELECT ON public.party_messages TO anon;
GRANT SELECT, INSERT ON public.party_messages TO authenticated;
GRANT ALL ON public.party_messages TO service_role;
ALTER TABLE public.party_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "party_messages_read_all" ON public.party_messages FOR SELECT USING (true);
CREATE POLICY "party_messages_auth_insert" ON public.party_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Server health
CREATE TABLE IF NOT EXISTS public.server_health (
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
CREATE POLICY "server_health_admin_write" ON public.server_health FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Announcements
CREATE TABLE IF NOT EXISTS public.announcements (
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
CREATE POLICY "announcements_admin_write" ON public.announcements FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Hero overrides
CREATE TABLE IF NOT EXISTS public.hero_overrides (
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
CREATE POLICY "hero_overrides_admin_write" ON public.hero_overrides FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Feature flags
CREATE TABLE IF NOT EXISTS public.feature_flags (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.feature_flags TO anon, authenticated;
GRANT ALL ON public.feature_flags TO service_role;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feature_flags_read_all" ON public.feature_flags FOR SELECT USING (true);
CREATE POLICY "feature_flags_admin_write" ON public.feature_flags FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Error logs
CREATE TABLE IF NOT EXISTS public.error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message text NOT NULL,
  stack text,
  url text,
  user_agent text,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS error_logs_created_idx ON public.error_logs(created_at DESC);
GRANT INSERT ON public.error_logs TO anon, authenticated;
GRANT SELECT, DELETE ON public.error_logs TO authenticated;
GRANT ALL ON public.error_logs TO service_role;
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "error_logs_anyone_insert" ON public.error_logs FOR INSERT
  WITH CHECK (true);
CREATE POLICY "error_logs_admin_read" ON public.error_logs FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));
CREATE POLICY "error_logs_admin_delete" ON public.error_logs FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- LWW trigger on user_progress
CREATE OR REPLACE FUNCTION public.user_progress_lww()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.position_seconds < OLD.position_seconds
       AND NEW.fully_watched = OLD.fully_watched THEN
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
DROP TRIGGER IF EXISTS user_progress_lww_trg ON public.user_progress;
CREATE TRIGGER user_progress_lww_trg
BEFORE INSERT OR UPDATE ON public.user_progress
FOR EACH ROW EXECUTE FUNCTION public.user_progress_lww();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.party_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.party_messages;

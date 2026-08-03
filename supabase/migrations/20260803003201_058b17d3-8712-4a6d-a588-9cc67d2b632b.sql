ALTER TABLE public.party_rooms
  ADD COLUMN IF NOT EXISTS server_id text,
  ADD COLUMN IF NOT EXISTS start_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS sync_nonce integer NOT NULL DEFAULT 0;
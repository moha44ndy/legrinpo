-- Modération utilisateur (CGU + blocage) — à exécuter dans Supabase SQL Editor
-- Requis pour /api/user/terms et /api/user/blocked

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamp with time zone;

CREATE TABLE IF NOT EXISTS public.blocked_users (
  id BIGSERIAL PRIMARY KEY,
  user_id bigint NOT NULL,
  blocked_uid character varying(255) NOT NULL,
  blocked_username character varying(100),
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE (user_id, blocked_uid)
);

CREATE INDEX IF NOT EXISTS blocked_users_user_id_idx ON public.blocked_users (user_id);

-- ============================================================
-- Supabase : uniquement utilisateurs et auth (pas rooms, wallets, etc.)
-- À exécuter dans le nouveau projet : SQL Editor > New query > Coller > Run
-- ============================================================

-- Utilisateurs (comptes, login, profil)
CREATE TABLE IF NOT EXISTS public.users (
  id SERIAL PRIMARY KEY,
  uid character varying(255) NOT NULL,
  email character varying(255) NOT NULL,
  username character varying(100) NOT NULL,
  display_name character varying(255),
  password_hash character varying(255),
  avatar character varying(500),
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  is_admin smallint NOT NULL DEFAULT 0,
  is_disabled smallint NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_key ON public.users (email);
CREATE UNIQUE INDEX IF NOT EXISTS users_username_key ON public.users (username);
CREATE UNIQUE INDEX IF NOT EXISTS users_uid_key ON public.users (uid);

-- Réinitialisation mot de passe
CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  id BIGSERIAL PRIMARY KEY,
  email text NOT NULL,
  token text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Codes de connexion par email (valables 15 min)
CREATE TABLE IF NOT EXISTS public.login_codes (
  id BIGSERIAL PRIMARY KEY,
  email text NOT NULL,
  code character varying(10) NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS login_codes_email_expires_idx ON public.login_codes (email, expires_at);

-- Logs de connexion (optionnel)
CREATE TABLE IF NOT EXISTS public.login_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id bigint,
  email character varying(255),
  ip character varying(45),
  created_at timestamp with time zone DEFAULT now()
);

-- Logs des actions admin (optionnel)
CREATE TABLE IF NOT EXISTS public.admin_logs (
  id BIGSERIAL PRIMARY KEY,
  admin_user_id bigint NOT NULL,
  admin_email character varying(255),
  action character varying(100) NOT NULL,
  target_type character varying(50),
  target_id character varying(100),
  details text,
  created_at timestamp with time zone DEFAULT now()
);

-- Paramètres du site (admin)
CREATE TABLE IF NOT EXISTS public.settings (
  k character varying(100) NOT NULL PRIMARY KEY,
  v text
);

-- Demandes de retrait (si tu gardes ça en Supabase ; sinon à ignorer)
CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id BIGSERIAL PRIMARY KEY,
  user_id bigint NOT NULL,
  email character varying(255) NOT NULL,
  username character varying(255),
  amount numeric NOT NULL,
  method character varying(50) NOT NULL,
  country character varying(100),
  phone_or_iban character varying(255),
  full_name character varying(255),
  status character varying(20) NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone DEFAULT now(),
  processed_at timestamp with time zone,
  processed_by bigint,
  note text
);

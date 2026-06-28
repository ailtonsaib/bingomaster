-- ============================================================
-- BingoMaster - Script de criação das tabelas (Supabase)
-- Cole este script no SQL Editor do painel do Supabase e rode.
-- ============================================================

-- Tabela: bingo_games
CREATE TABLE IF NOT EXISTS public.bingo_games (
  id TEXT PRIMARY KEY,
  created_date TIMESTAMPTZ DEFAULT now(),
  updated_date TIMESTAMPTZ DEFAULT now(),
  created_by_id UUID,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','in_progress','finished')),
  drawn_numbers NUMERIC[] DEFAULT '{}',
  max_number NUMERIC DEFAULT 75,
  prizes JSONB DEFAULT '[]',
  event_location TEXT,
  event_address TEXT,
  event_date TEXT,
  event_price TEXT,
  card_image_url TEXT,
  card_bg_image_url TEXT
);

-- Tabela: sellers
CREATE TABLE IF NOT EXISTS public.sellers (
  id TEXT PRIMARY KEY,
  created_date TIMESTAMPTZ DEFAULT now(),
  updated_date TIMESTAMPTZ DEFAULT now(),
  created_by_id UUID,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true
);

-- Tabela: bingo_cards
CREATE TABLE IF NOT EXISTS public.bingo_cards (
  id TEXT PRIMARY KEY,
  created_date TIMESTAMPTZ DEFAULT now(),
  updated_date TIMESTAMPTZ DEFAULT now(),
  created_by_id UUID,
  game_id TEXT NOT NULL,
  card_identifier TEXT,
  card_number NUMERIC,
  player_name TEXT NOT NULL,
  player_phone TEXT,
  player_city TEXT,
  player_state TEXT,
  seller_id TEXT,
  seller_name TEXT,
  chances NUMERIC DEFAULT 1 CHECK (chances IN (1,2)),
  exported_date TEXT,
  payment_receipt_url TEXT,
  grid_1a NUMERIC[],
  grid_1b NUMERIC[],
  grid_1c NUMERIC[],
  grid_2a NUMERIC[],
  grid_2b NUMERIC[],
  grid_2c NUMERIC[],
  grid_1 NUMERIC[],
  grid_2 NUMERIC[],
  won_prizes JSONB DEFAULT '[]',
  is_winner BOOLEAN DEFAULT false
);

-- Tabela: seller_distributions
CREATE TABLE IF NOT EXISTS public.seller_distributions (
  id TEXT PRIMARY KEY,
  created_date TIMESTAMPTZ DEFAULT now(),
  updated_date TIMESTAMPTZ DEFAULT now(),
  created_by_id UUID,
  game_id TEXT NOT NULL,
  seller_id TEXT NOT NULL,
  seller_name TEXT,
  range_from NUMERIC NOT NULL,
  range_to NUMERIC NOT NULL
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_bingo_cards_game_id ON public.bingo_cards(game_id);
CREATE INDEX IF NOT EXISTS idx_bingo_cards_card_number ON public.bingo_cards(card_number);
CREATE INDEX IF NOT EXISTS idx_bingo_cards_seller_id ON public.bingo_cards(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_distributions_game_id ON public.seller_distributions(game_id);
CREATE INDEX IF NOT EXISTS idx_seller_distributions_seller_id ON public.seller_distributions(seller_id);

-- Habilita Row Level Security (opcional - ajuste conforme sua política)
ALTER TABLE public.bingo_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bingo_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_distributions ENABLE ROW LEVEL SECURITY;

-- Política permissiva para service_role (acesso total via chave service_role)
-- A chave service_role já bypassa RLS por padrão, então nenhuma política extra é necessária
-- para acesso via backend. Para acesso via anon key, adicione políticas conforme necessário.

-- ============================================================
-- FIM DO SCRIPT
-- ============================================================

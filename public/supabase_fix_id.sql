-- ============================================================
-- Script de correção - alterar tipo do campo id para TEXT
-- Rode no SQL Editor do Supabase (as tabelas já estão vazias)
-- ============================================================

ALTER TABLE public.bingo_games ALTER COLUMN id TYPE TEXT;
ALTER TABLE public.sellers ALTER COLUMN id TYPE TEXT;
ALTER TABLE public.bingo_cards ALTER COLUMN id TYPE TEXT;
ALTER TABLE public.seller_distributions ALTER COLUMN id TYPE TEXT;

-- ============================================================
-- FIM
-- ============================================================

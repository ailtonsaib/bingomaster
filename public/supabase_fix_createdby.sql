-- Corrigir tipo do created_by_id para TEXT
ALTER TABLE public.bingo_games ALTER COLUMN created_by_id TYPE TEXT;
ALTER TABLE public.sellers ALTER COLUMN created_by_id TYPE TEXT;
ALTER TABLE public.bingo_cards ALTER COLUMN created_by_id TYPE TEXT;
ALTER TABLE public.seller_distributions ALTER COLUMN created_by_id TYPE TEXT;

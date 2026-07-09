-- =====================================================
-- Portal SoftPremier - Tabelas de Usuários
-- Execute no SQL Editor do Supabase (opcional)
-- A função portalAuth (operation: "setup") cria estas
-- tabelas automaticamente.
-- =====================================================

CREATE TABLE IF NOT EXISTS portal_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  is_admin BOOLEAN DEFAULT false,
  can_access_bingo BOOLEAN DEFAULT true,
  can_access_finance BOOLEAN DEFAULT false,
  bingo_plan TEXT DEFAULT 'free',
  finance_transaction_limit INTEGER DEFAULT 10,
  finance_transactions_used INTEGER DEFAULT 0,
  finance_full_access BOOLEAN DEFAULT false,
  finance_release_requested BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS portal_finance_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  category TEXT,
  date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Usuário padrão de teste:
-- Email: teste@softpremier.com.br
-- Senha: teste123
-- Plano Bingo: FREE | Finanças: 10 movimentações limite

-- Usuário administrador:
-- Email: ailtonsaib@gmail.com
-- Senha: premier2026

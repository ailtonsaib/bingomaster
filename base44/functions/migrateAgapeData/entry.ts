import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const AGAPE_APP_URL = 'https://hospitable-financia-smart-flow.base44.app';
const AGAPE_APP_ID = '69b85ec1ed3dd0a29c5bf6ce';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { email, password } = await req.json();
    if (!email || !password) {
      return Response.json({ error: 'Email e senha do app Ágape são obrigatórios' }, { status: 400 });
    }

    // 1. Login no app Ágape (endpoint correto do Base44 SDK: /api/apps/{appId}/auth/login)
    const loginRes = await fetch(`${AGAPE_APP_URL}/api/apps/${AGAPE_APP_ID}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!loginRes.ok) {
      let msg = 'Email ou senha inválidos no app Ágape';
      try {
        const loginErr = await loginRes.json();
        msg = loginErr?.message || loginErr?.detail || loginErr?.error || msg;
      } catch {
        // mantém a mensagem padrão
      }
      return Response.json({ error: `Falha no login do Ágape: ${msg}` }, { status: 401 });
    }

    const loginData = await loginRes.json();
    const agapeToken = loginData.access_token || loginData.token;
    if (!agapeToken) {
      return Response.json({ error: 'Token de acesso não retornado pelo Ágape' }, { status: 500 });
    }

    const agapeHeaders = {
      'Authorization': `Bearer ${agapeToken}`,
      'Content-Type': 'application/json',
    };

    // 2. Buscar todas as transações do Ágape
    const allTransactions = [];
    let skip = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
      const txRes = await fetch(`${AGAPE_APP_URL}/api/apps/${AGAPE_APP_ID}/entities/Transaction?limit=${limit}&skip=${skip}&sort=-created_date`, {
        method: 'GET',
        headers: agapeHeaders,
      });

      if (!txRes.ok) {
        const errText = await txRes.text();
        return Response.json({ error: `Erro ao buscar transações: ${errText}` }, { status: txRes.status });
      }

      const txData = await txRes.json();
      const items = Array.isArray(txData) ? txData : (txData.items || txData.data || []);
      allTransactions.push(...items);
      hasMore = items.length === limit;
      skip += limit;
    }

    // 3. Buscar contatos do Ágape (para mapear nomes)
    const contactsRes = await fetch(`${AGAPE_APP_URL}/api/apps/${AGAPE_APP_ID}/entities/Contact?limit=500`, {
      method: 'GET',
      headers: agapeHeaders,
    });

    let contactsMap = {};
    if (contactsRes.ok) {
      const contactsData = await contactsRes.json();
      const contacts = Array.isArray(contactsData) ? contactsData : (contactsData.items || contactsData.data || []);
      for (const c of contacts) {
        contactsMap[c._id || c.id] = c;
      }
    }

    // 4. Buscar usuário atual do portal
    const portalUser = await base44.asServiceRole.entities.PortalUser.filter({ email: user.email });
    const userEmail = user.email;

    // 5. Mapear e importar transações
    const recordsToCreate = [];
    const skipped = [];

    for (const tx of allTransactions) {
      // Pular se já foi migrado (verificar por descrição + data + valor)
      const mapped = {
        user_email: userEmail,
        description: tx.description || 'Transação migrada do Ágape',
        amount: Number(tx.amount) || 0,
        type: tx.type === 'income' || tx.type === 'receita' ? 'income' : 'expense',
        category: tx.category || '',
        date: tx.date || tx.created_date || new Date().toISOString(),
        launch_date: tx.date || tx.created_date || new Date().toISOString(),
        contact_id: tx.contact_id || '',
        contact_name: tx.contact_id && contactsMap[tx.contact_id]
          ? (contactsMap[tx.contact_id].razao_social || contactsMap[tx.contact_id].name || contactsMap[tx.contact_id].nome || '')
          : '',
        status: 'pending',
      };

      recordsToCreate.push(mapped);
    }

    if (recordsToCreate.length === 0) {
      return Response.json({
        success: true,
        message: 'Nenhuma transação encontrada no app Ágape para migrar.',
        imported: 0,
        total: 0,
      });
    }

    // 6. Verificar duplicatas - buscar transações já migradas
    const existingTxs = await base44.asServiceRole.entities.PortalFinanceTransaction.filter({
      user_email: userEmail,
    }, '-created_date', 1000);

    const existingKeys = new Set();
    for (const et of existingTxs) {
      const key = `${et.description}|${et.amount}|${et.type}`;
      existingKeys.add(key);
    }

    const newRecords = recordsToCreate.filter(r => {
      const key = `${r.description}|${r.amount}|${r.type}`;
      return !existingKeys.has(key);
    });

    const duplicatesSkipped = recordsToCreate.length - newRecords.length;

    // 7. Inserir em lotes (máx 500 por vez)
    let imported = 0;
    for (let i = 0; i < newRecords.length; i += 400) {
      const batch = newRecords.slice(i, i + 400);
      const result = await base44.asServiceRole.entities.PortalFinanceTransaction.bulkCreate(batch);
      imported += batch.length;
    }

    return Response.json({
      success: true,
      message: `Migração concluída! ${imported} transações importadas, ${duplicatesSkipped} duplicatas ignoradas.`,
      imported,
      duplicates_skipped: duplicatesSkipped,
      total_agape_transactions: allTransactions.length,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
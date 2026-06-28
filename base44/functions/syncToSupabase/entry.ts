import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const table = body.table; // 'bingo_games' | 'sellers' | 'bingo_cards' | 'seller_distributions'

    // 1. Get OAuth access token
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('supabase');

    // 2. Get project ref
    const projectsRes = await fetch('https://api.supabase.com/v1/projects', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const projects = await projectsRes.json();
    const projectRef = projects[0]?.id;
    if (!projectRef) return Response.json({ error: 'Projeto Supabase não encontrado' }, { status: 404 });

    // 3. Get service_role key
    const keysRes = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/api-keys`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const keys = await keysRes.json();
    const serviceKey = keys.find((k) => k.name === 'service_role')?.api_key;
    if (!serviceKey) return Response.json({ error: 'service_role key não encontrada' }, { status: 500 });

    // 4. Read data from Base44 entities
    const entityMap = {
      bingo_games: 'BingoGame',
      sellers: 'Seller',
      bingo_cards: 'BingoCard',
      seller_distributions: 'SellerDistribution',
    };
    const entityName = entityMap[table];
    if (!entityName) return Response.json({ error: 'Tabela inválida' }, { status: 400 });

    const records = await base44.asServiceRole.entities[entityName].list('-created_date', 5000);

    // 5. Map Base44 records to Supabase columns
    const mapped = records.map((r) => {
      const base = {
        id: r.id,
        created_date: r.created_date,
        updated_date: r.updated_date,
        created_by_id: r.created_by_id || null,
      };
      if (table === 'bingo_games') {
        return {
          ...base,
          name: r.name,
          status: r.status,
          drawn_numbers: r.drawn_numbers || [],
          max_number: r.max_number,
          prizes: r.prizes || [],
          event_location: r.event_location,
          event_address: r.event_address,
          event_date: r.event_date,
          event_price: r.event_price,
          card_image_url: r.card_image_url,
          card_bg_image_url: r.card_bg_image_url,
        };
      }
      if (table === 'sellers') {
        return {
          ...base,
          name: r.name,
          phone: r.phone,
          address: r.address,
          city: r.city,
          state: r.state,
          notes: r.notes,
          is_active: r.is_active,
        };
      }
      if (table === 'bingo_cards') {
        return {
          ...base,
          game_id: r.game_id,
          card_identifier: r.card_identifier,
          card_number: r.card_number,
          player_name: r.player_name,
          player_phone: r.player_phone,
          player_city: r.player_city,
          player_state: r.player_state,
          seller_id: r.seller_id,
          seller_name: r.seller_name,
          chances: r.chances,
          exported_date: r.exported_date,
          payment_receipt_url: r.payment_receipt_url,
          grid_1a: r.grid_1a || [],
          grid_1b: r.grid_1b || [],
          grid_1c: r.grid_1c || [],
          grid_2a: r.grid_2a || [],
          grid_2b: r.grid_2b || [],
          grid_2c: r.grid_2c || [],
          grid_1: r.grid_1 || [],
          grid_2: r.grid_2 || [],
          won_prizes: r.won_prizes || [],
          is_winner: r.is_winner,
        };
      }
      if (table === 'seller_distributions') {
        return {
          ...base,
          game_id: r.game_id,
          seller_id: r.seller_id,
          seller_name: r.seller_name,
          range_from: r.range_from,
          range_to: r.range_to,
        };
      }
    });

    if (mapped.length === 0) {
      return Response.json({ table, inserted: 0, message: 'Nenhum registro para importar' });
    }

    // 6. Insert into Supabase via PostgREST (bulk upsert)
    const supabaseUrl = `https://${projectRef}.supabase.co/rest/v1/${table}`;
    const insertRes = await fetch(supabaseUrl, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(mapped),
    });

    if (!insertRes.ok) {
      const errText = await insertRes.text();
      return Response.json({ error: `Erro ao inserir: ${errText}`, status: insertRes.status }, { status: 500 });
    }

    return Response.json({ table, inserted: mapped.length, status: 'success' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
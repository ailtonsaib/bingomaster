import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { action } = body;

    switch (action) {
      case 'validateSeller': {
        const phoneDigits = (body.phone || '').replace(/\D/g, '');
        if (!phoneDigits) {
          return Response.json({ error: 'Telefone é obrigatório' }, { status: 400 });
        }
        const sellers = await base44.asServiceRole.entities.Seller.filter(
          { is_active: true },
          'name',
          10000
        );
        const match = sellers.find((s) => {
          const sDigits = (s.phone || '').replace(/\D/g, '');
          return sDigits && sDigits === phoneDigits;
        });
        if (!match) {
          return Response.json({ seller: null });
        }
        return Response.json({
          seller: {
            id: match.id,
            name: match.name,
            phone: match.phone,
          },
        });
      }

      case 'listGames': {
        const games = await base44.asServiceRole.entities.BingoGame.filter(
          {},
          '-created_date',
          10000
        );
        const active = games.filter((g) => g.status !== 'finished');
        return Response.json({ games: active });
      }

      case 'getGame': {
        if (!body.game_id) {
          return Response.json({ error: 'game_id é obrigatório' }, { status: 400 });
        }
        const games = await base44.asServiceRole.entities.BingoGame.filter({
          id: String(body.game_id),
        });
        return Response.json({ game: games[0] || null });
      }

      case 'getCards': {
        if (!body.game_id) {
          return Response.json({ error: 'game_id é obrigatório' }, { status: 400 });
        }
        const query = { game_id: String(body.game_id) };
        if (body.range_from !== undefined && body.range_to !== undefined) {
          query.card_number = {
            $gte: Number(body.range_from),
            $lte: Number(body.range_to),
          };
        }
        const cards = await base44.asServiceRole.entities.BingoCard.filter(
          query,
          'card_number',
          100000
        );
        return Response.json({ cards });
      }

      case 'getDistributions': {
        if (!body.game_id || !body.seller_id) {
          return Response.json({ distributions: [] });
        }
        const distributions = await base44.asServiceRole.entities.SellerDistribution.filter({
          game_id: String(body.game_id),
          seller_id: String(body.seller_id),
        });
        return Response.json({ distributions });
      }

      case 'sellCard': {
        if (!body.card_id) {
          return Response.json({ error: 'card_id é obrigatório' }, { status: 400 });
        }
        const updateData = {
          player_name: body.player_name,
          player_phone: body.player_phone,
          player_city: '',
          seller_id: body.seller_id || null,
          seller_name: body.seller_name || null,
          payment_status: body.payment_status === 'pending' ? 'pending' : 'paid',
        };

        // Upload receipt if provided as base64
        if (body.receipt_base64) {
          try {
            const base64Data = body.receipt_base64.split(',')[1] || body.receipt_base64;
            const byteChars = atob(base64Data);
            const bytes = new Uint8Array(byteChars.length);
            for (let i = 0; i < byteChars.length; i++) {
              bytes[i] = byteChars.charCodeAt(i);
            }
            const blob = new Blob([bytes], { type: body.receipt_mime || 'image/jpeg' });
            const file = new File([blob], 'receipt.jpg', { type: body.receipt_mime || 'image/jpeg' });
            const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ file });
            updateData.payment_receipt_url = file_url;
          } catch (e) {
            // continue without receipt if upload fails
          }
        } else if (body.clear_receipt) {
          updateData.payment_receipt_url = null;
        }

        await base44.asServiceRole.entities.BingoCard.update(String(body.card_id), updateData);
        return Response.json({ success: true });
      }

      case 'devolveUnsold': {
        // Devolve as cartelas não vendidas ao sistema: remove as distribuições
        // do vendedor e LIMPA o seller_id das cartelas não vendidas (para que
        // saiam da tela do vendedor e voltem ao pool de cartelas a validar).
        // As cartelas já vendidas (com comprador) permanecem com o vendedor.
        if (!body.game_id || !body.seller_id) {
          return Response.json({ error: 'game_id e seller_id são obrigatórios' }, { status: 400 });
        }
        const gameId = String(body.game_id);
        const sellerId = String(body.seller_id);
        const dists = await base44.asServiceRole.entities.SellerDistribution.filter({
          game_id: gameId,
          seller_id: sellerId,
        });
        // Intervalos a devolver: distribuições registradas, ou intervalo do link
        let ranges = dists.map((d) => ({ range_from: d.range_from, range_to: d.range_to }));
        if (ranges.length === 0 && body.range_from != null && body.range_to != null) {
          ranges = [{ range_from: Number(body.range_from), range_to: Number(body.range_to) }];
        }
        if (ranges.length === 0) {
          return Response.json({ success: true, devolved: 0, cleared: 0 });
        }
        const allCards = await base44.asServiceRole.entities.BingoCard.filter(
          { game_id: gameId },
          'card_number',
          100000
        );
        const unsoldIds = [];
        for (const r of ranges) {
          for (const c of allCards) {
            const n = c.card_number || 0;
            // Não devolver cartelas vendidas (com comprador) ou validadas
            const isUnsold = !c.player_phone && !c.player_city && !c.is_validated;
            const mine = !c.seller_id || c.seller_id === sellerId;
            if (n >= r.range_from && n <= r.range_to && isUnsold && mine) {
              unsoldIds.push(c.id);
            }
          }
        }
        if (unsoldIds.length > 0) {
          await base44.asServiceRole.entities.BingoCard.bulkUpdate(
            unsoldIds.map((id) => ({ id, seller_id: null, seller_name: null }))
          );
        }
        for (const d of dists) {
          await base44.asServiceRole.entities.SellerDistribution.delete(d.id);
        }
        return Response.json({ success: true, devolved: dists.length, cleared: unsoldIds.length });
      }

      case 'transferCards': {
        // Transfere as distribuições e as cartelas não vendidas para outro
        // vendedor. As cartelas já vendidas pelo vendedor original permanecem
        // com ele (continuam visíveis via seller_id).
        if (!body.game_id || !body.seller_id || !body.to_seller_id) {
          return Response.json({ error: 'game_id, seller_id e to_seller_id são obrigatórios' }, { status: 400 });
        }
        const gameId = String(body.game_id);
        const sellerId = String(body.seller_id);
        const toSellerId = String(body.to_seller_id);
        const toSellerName = body.to_seller_name || '';
        const dists = await base44.asServiceRole.entities.SellerDistribution.filter({
          game_id: gameId,
          seller_id: sellerId,
        });
        // Intervalos a transferir: distribuições registradas, ou intervalo do link
        let ranges = dists.map((d) => ({ range_from: d.range_from, range_to: d.range_to }));
        if (ranges.length === 0 && body.range_from != null && body.range_to != null) {
          ranges = [{ range_from: Number(body.range_from), range_to: Number(body.range_to) }];
        }
        if (ranges.length === 0) {
          return Response.json({ success: true, transferred: 0, moved: 0 });
        }
        const allCards = await base44.asServiceRole.entities.BingoCard.filter(
          { game_id: gameId },
          'card_number',
          100000
        );
        const unsoldIds = [];
        for (const r of ranges) {
          for (const c of allCards) {
            const n = c.card_number || 0;
            // Não transferir cartelas vendidas (com comprador) ou validadas
            const isUnsold = !c.player_phone && !c.player_city && !c.is_validated;
            const mine = !c.seller_id || c.seller_id === sellerId;
            if (n >= r.range_from && n <= r.range_to && isUnsold && mine) {
              unsoldIds.push(c.id);
            }
          }
        }
        if (unsoldIds.length > 0) {
          await base44.asServiceRole.entities.BingoCard.bulkUpdate(
            unsoldIds.map((id) => ({ id, seller_id: toSellerId, seller_name: toSellerName }))
          );
        }
        for (const d of dists) {
          await base44.asServiceRole.entities.SellerDistribution.update(d.id, {
            seller_id: toSellerId,
            seller_name: toSellerName || d.seller_name,
          });
        }
        return Response.json({ success: true, transferred: dists.length, moved: unsoldIds.length });
      }

      default:
        return Response.json({ error: 'Ação inválida' }, { status: 400 });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
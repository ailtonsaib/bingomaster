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

      default:
        return Response.json({ error: 'Ação inválida' }, { status: 400 });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
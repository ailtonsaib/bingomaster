import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { game_id } = body;

    if (!game_id) {
      return Response.json({ error: 'game_id é obrigatório' }, { status: 400 });
    }

    // Service role — no user auth needed, telão is a public display
    const games = await base44.asServiceRole.entities.BingoGame.filter({ id: String(game_id) });
    const game = games[0] || null;

    if (!game) {
      return Response.json({ error: 'Jogo não encontrado' }, { status: 404 });
    }

    const cards = await base44.asServiceRole.entities.BingoCard.filter({ game_id: String(game_id) });

    return Response.json({ game, cards });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
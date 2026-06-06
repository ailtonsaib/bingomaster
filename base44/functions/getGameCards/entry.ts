import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { game_id } = await req.json();

    if (!game_id) {
      return Response.json({ error: 'game_id is required' }, { status: 400 });
    }

    // Fetch all cards for the game with a high limit
    const cards = await base44.asServiceRole.entities.BingoCard.filter(
      { game_id: String(game_id) },
      'card_number',
      100000
    );

    return Response.json({ cards });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
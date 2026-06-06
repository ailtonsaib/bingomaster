import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { game_id, range_from, range_to } = await req.json();

    if (!game_id) {
      return Response.json({ error: 'game_id is required' }, { status: 400 });
    }

    let query = { game_id: String(game_id) };

    // If range is provided, filter by card_number range at DB level
    if (range_from !== undefined && range_to !== undefined) {
      query.card_number = {
        $gte: Number(range_from),
        $lte: Number(range_to),
      };
    }

    const cards = await base44.asServiceRole.entities.BingoCard.filter(
      query,
      'card_number',
      100000
    );

    return Response.json({ cards });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Fetch all winner cards (is_winner = true) using service role for global aggregation
    const winnerCards = await base44.asServiceRole.entities.BingoCard.filter({
      is_winner: true
    }, '-updated_date', 500);

    // Aggregate by player name
    const playerMap = {};

    for (const card of winnerCards) {
      const name = (card.player_name || 'Anônimo').trim();
      if (!name) continue;

      if (!playerMap[name]) {
        playerMap[name] = {
          name,
          phone: card.player_phone || '',
          city: card.player_city || '',
          state: card.player_state || '',
          wins: 0,
          prizes: [],
        };
      }

      // Count each prize won
      const prizesWon = card.won_prizes || [];
      playerMap[name].wins += prizesWon.length > 0 ? prizesWon.length : 1;

      // Collect prize names (deduplicated)
      for (const p of prizesWon) {
        if (p.prize_name && !playerMap[name].prizes.includes(p.prize_name)) {
          playerMap[name].prizes.push(p.prize_name);
        }
      }
    }

    // Convert to array, sort by wins descending, take top 20
    const ranking = Object.values(playerMap)
      .map((p) => ({
        name: p.name,
        phone: p.phone,
        city: p.city,
        state: p.state,
        wins: p.wins,
        prize_types: p.prizes,
      }))
      .sort((a, b) => b.wins - a.wins)
      .slice(0, 20);

    return Response.json({ ranking, total_winners: Object.keys(playerMap).length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
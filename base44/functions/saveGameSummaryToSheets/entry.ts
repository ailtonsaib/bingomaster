import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    // Entity automation payload: { event, data, old_data }
    const game = body.data;
    const gameId = body.event?.entity_id || game?.id;

    if (!gameId || !game) {
      return Response.json({ error: "Dados do jogo não encontrados" }, { status: 400 });
    }

    // Only process when game is finished
    if (game.status !== "finished") {
      return Response.json({ skipped: true, reason: "Jogo não está encerrado" });
    }

    // Fetch cards for this game
    const cards = await base44.asServiceRole.entities.BingoCard.filter({ game_id: gameId });

    // Calculate winners (20 points) and statistics
    const drawnNumbers = game.drawn_numbers || [];
    const drawnSet = new Set(drawnNumbers);

    const winners = [];
    let maxPoints = 0;
    const pointsDistribution = {};

    cards.forEach((card) => {
      const allNums = new Set([
        ...(card.grid_1 || []), ...(card.grid_2 || []),
        ...(card.grid_1a || []), ...(card.grid_1b || []), ...(card.grid_1c || []),
        ...(card.grid_2a || []), ...(card.grid_2b || []), ...(card.grid_2c || []),
      ].filter(n => n !== 0));

      const points = Array.from(allNums).filter(n => drawnSet.has(n)).length;
      maxPoints = Math.max(maxPoints, points);
      pointsDistribution[points] = (pointsDistribution[points] || 0) + 1;

      if (points >= 20) {
        winners.push({
          card_number: card.card_number,
          player_name: card.player_name,
          player_phone: card.player_phone,
          player_city: card.player_city,
        });
      }
    });

    // Get Google Sheets access token
    const { accessToken } = await base44.asServiceRole.connectors.getConnection("googlesheets");

    const spreadsheetId = Deno.env.get("GOOGLE_SHEETS_SPREADSHEET_ID");
    if (!spreadsheetId) {
      return Response.json({ error: "GOOGLE_SHEETS_SPREADSHEET_ID não configurado. Defina nas configurações do app." }, { status: 500 });
    }

    const sheetName = "Resumo dos Jogos";
    const headers = [
      "Data/Hora do Encerramento",
      "Nome do Jogo",
      "ID do Jogo",
      "Data do Evento",
      "Local do Evento",
      "Números Sorteados",
      "Número Máximo",
      "Total de Cartelas",
      "Qtd. Vencedores",
      "Vencedores (Nomes)",
      "Vencedores (Telefones)",
      "Vencedores (Cidades)",
      "Pontuação Máxima",
      "Distribuição de Pontos",
    ];

    // Ensure headers exist (check row 1)
    const headerUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName + "!A1:N1")}`;
    const headerResp = await fetch(headerUrl, {
      headers: { "Authorization": `Bearer ${accessToken}` },
    });

    if (headerResp.status === 400 || headerResp.status === 404) {
      // Sheet/tab doesn't exist — create it with a batchUpdate
      const createResp = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [{ addSheet: { properties: { title: sheetName } } }],
        }),
      });
      // If tab already exists, ignore the error
      await createResp.json().catch(() => {});
    }

    const headerData = await headerResp.json().catch(() => ({}));
    if (!headerData.values || headerData.values.length === 0) {
      // Write headers
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName + "!A1:N1")}?valueInputOption=RAW`, {
        method: "PUT",
        headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ values: [headers] }),
      });
    }

    // Prepare row data
    const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const winnerNames = winners.map(w => w.player_name || `Cartela #${w.card_number}`).join("; ");
    const winnerPhones = winners.map(w => w.player_phone || "").join("; ");
    const winnerCities = winners.map(w => w.player_city || "").join("; ");

    const rowData = [
      now,
      game.name || "",
      gameId,
      game.event_date ? new Date(game.event_date).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "",
      game.event_location || "",
      drawnNumbers.length,
      game.max_number || 75,
      cards.length,
      winners.length,
      winnerNames,
      winnerPhones,
      winnerCities,
      maxPoints,
      JSON.stringify(pointsDistribution),
    ];

    // Append row
    const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName + "!A:N")}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
    const appendResp = await fetch(appendUrl, {
      method: "POST",
      headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ values: [rowData] }),
    });

    if (!appendResp.ok) {
      const errorText = await appendResp.text();
      return Response.json({ error: `Erro ao salvar na planilha: ${errorText}` }, { status: 500 });
    }

    return Response.json({
      success: true,
      game: game.name,
      winners: winners.length,
      cards: cards.length,
      drawnNumbers: drawnNumbers.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const cardData = body.data;
    const oldData = body.old_data;

    // Detect which prize was newly awarded
    const newPrizes = cardData?.won_prizes || [];
    const oldPrizes = oldData?.won_prizes || [];

    if (newPrizes.length <= oldPrizes.length) {
      return Response.json({ skipped: true, reason: 'No new prize awarded' });
    }

    // Get the newly added prize
    const newPrize = newPrizes[newPrizes.length - 1];

    const playerName = cardData.player_name || 'Participante';
    const playerEmail = cardData.player_email || null;
    const cardIdentifier = cardData.card_identifier || `#${cardData.card_number}`;
    const prizeName = newPrize?.prize_name || 'Prêmio';

    if (!playerEmail) {
      return Response.json({ skipped: true, reason: 'No player email available' });
    }

    // Get Gmail access token
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');

    // Build RFC 2822 email
    const subject = `=?UTF-8?B?${btoa(unescape(encodeURIComponent(`🎉 Parabéns! Você ganhou: ${prizeName}`)))}?=`;
    const bodyText = `Olá, ${playerName}!\n\nParabéns! Sua cartela ${cardIdentifier} ganhou o prêmio: ${prizeName}.\n\nFique atento às próximas instruções para receber seu prêmio.\n\nAbraços,\nEquipe BingoMaster`;

    const message = [
      `To: ${playerEmail}`,
      `Subject: ${subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/plain; charset=UTF-8`,
      `Content-Transfer-Encoding: quoted-printable`,
      ``,
      bodyText
    ].join('\r\n');

    const encoded = btoa(unescape(encodeURIComponent(message)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: encoded }),
    });

    if (!res.ok) {
      const err = await res.text();
      return Response.json({ error: err }, { status: 500 });
    }

    return Response.json({ success: true, sentTo: playerEmail, prize: prizeName });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
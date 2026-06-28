import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    // Só processa se is_validated foi marcado como true
    if (!data || !data.is_validated) {
      return Response.json({ skipped: true });
    }

    // A cartela precisa ter um vendedor
    const sellerId = data.seller_id;
    if (!sellerId) {
      return Response.json({ skipped: true, reason: "no seller" });
    }

    // Busca dados do vendedor
    const sellers = await base44.asServiceRole.entities.Seller.filter({ id: sellerId });
    const seller = sellers[0];
    if (!seller || !seller.phone) {
      return Response.json({ skipped: true, reason: "seller not found or no phone" });
    }

    // Busca dados do jogo
    let gameName = "Bingo";
    if (data.game_id) {
      const games = await base44.asServiceRole.entities.BingoGame.filter({ id: data.game_id });
      if (games[0]) gameName = games[0].name;
    }

    const cardNumber = String(data.card_number || "").padStart(4, "0");
    const buyerName = data.player_name || "Comprador";

    const message = `🏆 *Cartela Aprovada!*\n\nOlá, ${seller.name}! A cartela *#${cardNumber}* do comprador *${buyerName}* foi aprovada e está *concorrendo aos prêmios* do evento *${gameName}*.\n\n✅ Pagamento confirmado pelo organizador.\n\nObrigado pela sua venda! 🎉`;

    const phone = seller.phone.replace(/\D/g, "");
    const whatsappUrl = `https://wa.me/55${phone}?text=${encodeURIComponent(message)}`;

    // Envia email como fallback/registro (WhatsApp é aberto pelo admin manualmente via link)
    // Mas aqui vamos apenas registrar o evento — o admin pode optar por abrir o link no futuro.
    // Por enquanto, enviamos um email de notificação ao admin com o link do WhatsApp.
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: (await base44.asServiceRole.entities.User.list())[0]?.email || "",
      subject: `Cartela #${cardNumber} aprovada — avise o vendedor ${seller.name}`,
      body: `A cartela #${cardNumber} (${buyerName}) foi marcada como "Concorrendo aos Prêmios" no evento ${gameName}.\n\nVendedor: ${seller.name}\nTelefone: ${seller.phone}\n\nClique para enviar aviso via WhatsApp:\n${whatsappUrl}`
    });

    return Response.json({ success: true, seller: seller.name, card: cardNumber, whatsappUrl });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
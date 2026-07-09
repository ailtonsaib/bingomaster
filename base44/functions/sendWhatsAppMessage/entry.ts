import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const WA_TOKEN = Deno.env.get("WHATSAPP_TOKEN");
const WA_PHONE_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
const WA_RECIPIENT = Deno.env.get("WHATSAPP_RECIPIENT_PHONE") || "5562996099697";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { message } = body;
    if (!message) return Response.json({ error: 'Message is required' }, { status: 400 });

    // Skip silently if WhatsApp secrets are not configured
    if (!WA_TOKEN || !WA_PHONE_ID) {
      return Response.json({ skipped: true, reason: 'WhatsApp secrets not configured' });
    }

    const url = `https://graph.facebook.com/v21.0/${WA_PHONE_ID}/messages`;
    const payload = {
      messaging_product: "whatsapp",
      to: WA_RECIPIENT,
      type: "text",
      text: { body: message },
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WA_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      return Response.json({ error: `WhatsApp API error: ${errText}` }, { status: 502 });
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
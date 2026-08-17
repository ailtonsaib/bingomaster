import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Função pública que permite ao fornecedor visualizar e responder uma Tomada de Preço
// via link (token), sem necessidade de login.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { action } = body;

    if (action === 'getByToken') {
      const token = String(body.token || '');
      if (!token) return Response.json({ error: 'Token inválido' }, { status: 400 });

      // Token formato: <quotationId>__<random>
      const sepIdx = token.indexOf('__');
      if (sepIdx <= 0) return Response.json({ error: 'Token inválido' }, { status: 400 });
      const quotationId = token.slice(0, sepIdx);

      let quotation;
      try {
        const list = await base44.asServiceRole.entities.ErpQuotation.filter({ id: quotationId });
        quotation = list[0];
      } catch (_) {
        return Response.json({ error: 'Link inválido ou expirado' }, { status: 404 });
      }
      if (!quotation) return Response.json({ error: 'Tomada não encontrada' }, { status: 404 });

      const sq = (quotation.supplier_quotes || []).find(q => q.quote_token === token);
      if (!sq) return Response.json({ error: 'Link inválido ou expirado' }, { status: 404 });

      // Dados públicos para o fornecedor responder
      return Response.json({
        quotation: {
          number: quotation.number,
          description: quotation.description,
          quotation_date: quotation.quotation_date,
          requisition_number: quotation.requisition_number,
          items: (quotation.items || []).map((it, idx) => ({
            idx,
            description: it.description || it.product_name || '',
            quantity: Number(it.quantity) || 0,
            unit: it.unit || 'UN',
          })),
        },
        supplier: { name: sq.supplier_name },
        quote_status: sq.quote_status || 'pendente',
        existing: sq.items || [],
      });
    }

    if (action === 'submit') {
      const token = String(body.token || '');
      if (!token) return Response.json({ error: 'Token inválido' }, { status: 400 });
      const sepIdx = token.indexOf('__');
      if (sepIdx <= 0) return Response.json({ error: 'Token inválido' }, { status: 400 });
      const quotationId = token.slice(0, sepIdx);

      let quotation;
      try {
        const list = await base44.asServiceRole.entities.ErpQuotation.filter({ id: quotationId });
        quotation = list[0];
      } catch (_) {
        return Response.json({ error: 'Link inválido ou expirado' }, { status: 404 });
      }
      if (!quotation) return Response.json({ error: 'Tomada não encontrada' }, { status: 404 });

      const sqIndex = (quotation.supplier_quotes || []).findIndex(q => q.quote_token === token);
      if (sqIndex < 0) return Response.json({ error: 'Link inválido ou expirado' }, { status: 404 });

      // Valida itens recebidos
      const items = Array.isArray(body.items) ? body.items : [];
      let total = 0;
      const normalizedItems = items.map((it) => {
        const unit_price = Number(it.unit_price) || 0;
        const quantity = Number(it.quantity) || 0;
        const itemTotal = unit_price * quantity;
        total += itemTotal;
        return {
          description: String(it.description || ''),
          quantity,
          unit: String(it.unit || 'UN'),
          unit_price,
          total: itemTotal,
        };
      });

      const supplierQuotes = [...(quotation.supplier_quotes || [])];
      supplierQuotes[sqIndex] = {
        ...supplierQuotes[sqIndex],
        items: normalizedItems,
        quoted_value: total,
        notes: body.notes != null ? String(body.notes || '') : supplierQuotes[sqIndex].notes,
        quote_status: 'respondida',
        responded_at: new Date().toISOString(),
      };

      await base44.asServiceRole.entities.ErpQuotation.update(quotationId, {
        supplier_quotes: supplierQuotes,
      });

      return Response.json({ success: true, total });
    }

    return Response.json({ error: 'Ação inválida' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
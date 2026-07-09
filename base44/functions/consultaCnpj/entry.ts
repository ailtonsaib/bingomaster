import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const cnpj = (body.cnpj || '').replace(/\D/g, '');

    if (cnpj.length !== 14) {
      return Response.json({ success: false, error: 'CNPJ inválido.' }, { status: 400 });
    }

    const apiUrl = `https://brasilapi.com.br/api/cnpj/v1/${cnpj}`;

    const resposta = await fetch(apiUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(10000)
    });

    if (!resposta.ok) {
      if (resposta.status === 404) {
        return Response.json({ success: false, error: 'CNPJ não localizado na base da Receita.' }, { status: 404 });
      }
      return Response.json({ success: false, error: 'Falha de comunicação com a Receita Federal.' }, { status: 502 });
    }

    const dados = await resposta.json();
    return Response.json({ success: true, dados });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});
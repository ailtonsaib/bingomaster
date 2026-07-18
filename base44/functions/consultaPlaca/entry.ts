import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const placa = (body.placa || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();

    if (placa.length < 7) {
      return Response.json({ success: false, error: 'Placa inválida. Deve ter 7 caracteres (formato antigo AAA0000 ou Mercosul AAA0A00).' });
    }

    const SECRET_KEY = Deno.env.get('APIBRASIL_SECRET_KEY');
    const PUBLIC_TOKEN = Deno.env.get('APIBRASIL_PUBLIC_TOKEN');

    if (!SECRET_KEY || !PUBLIC_TOKEN) {
      return Response.json({
        success: false,
        error: 'Tokens da APIBrasil não configurados. Cadastre-se gratuitamente em apibrasil.com.br, obtenha seu Secret Key e Public Token (menu Meus Dispositivos) e defina os secrets APIBRASIL_SECRET_KEY e APIBRASIL_PUBLIC_TOKEN nas configurações do app.'
      });
    }

    const resp = await fetch('https://apibrasil.com.br/api/v1/placa/consulta', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Secret-Key': SECRET_KEY,
        'Public-Token': PUBLIC_TOKEN,
      },
      body: JSON.stringify({ placa }),
      signal: AbortSignal.timeout(12000),
    });

    const data = await resp.json();

    if (data?.status === true && data?.data) {
      const d = data.data;
      return Response.json({
        success: true,
        encontrado: true,
        marca: d.MARCA || d.marca || '',
        modelo: d.MODELO || d.modelo || '',
        ano: d.ANO_MODELO || d.ano || d.ANO || '',
        cor: d.COR || d.cor || '',
        combustivel: d.COMBUSTIVEL || d.combustivel || '',
        chassi: d.CHASSI || d.chassi || '',
        municipio: d.MUNICIPIO || d.municipio || '',
        uf: d.UF || d.uf || '',
        renavam: d.RENAVAM || d.renavam || '',
      });
    }

    return Response.json({
      success: false,
      encontrado: false,
      error: data?.message || data?.error || 'Placa não encontrada na base de dados.'
    });
  } catch (error) {
    return Response.json({ success: false, error: error.message });
  }
});
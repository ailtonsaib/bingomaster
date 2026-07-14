import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Acesso negado' }, { status: 403 });

    // Busca todos os municípios da API do IBGE
    const resp = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/municipios');
    if (!resp.ok) {
      return Response.json({ error: 'Erro ao consultar API do IBGE: ' + resp.status }, { status: 502 });
    }
    const municipios = await resp.json();

    // Busca cidades já existentes para não duplicar
    const existing = await base44.asServiceRole.entities.PDVCity.list('-created_date', 10000);
    const existingCodes = new Set(existing.map((c: any) => c.ibge_code));

    const newCities = [];
    for (const m of municipios) {
      const ibge_code = String(m.id).padStart(7, '0');
      if (existingCodes.has(ibge_code)) continue;
      newCities.push({
        name: (m.nome || '').toUpperCase().trim(),
        uf: m.microrregiao?.mesorregiao?.UF?.sigla || '',
        ibge_code,
        is_active: true,
      });
    }

    if (newCities.length === 0) {
      return Response.json({ success: true, message: 'Todas as cidades já estão cadastradas.', total: existing.length });
    }

    // bulkCreate em lotes de 400
    let created = 0;
    for (let i = 0; i < newCities.length; i += 400) {
      const batch = newCities.slice(i, i + 400);
      await base44.asServiceRole.entities.PDVCity.bulkCreate(batch);
      created += batch.length;
    }

    return Response.json({
      success: true,
      message: `${created} cidades cadastradas com sucesso!`,
      total: existing.length + created,
      novas: created,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
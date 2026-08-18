import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Tabela oficial de CFOP (Ajuste SINIEF 07/01) em JSON — fonte gist pública
const CFOP_URL = "https://gist.githubusercontent.com/reinaldoacdc/b9ad02386c7fdb7a5c066769d224ac67/raw";
const BATCH = 400;
// CFOP de 4 dígitos
const RE_4 = /^\d{4}$/;

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Apenas administradores" }, { status: 403 });

    // Evita duplicação: se já populado, retorna
    const existing = await base44.asServiceRole.entities.ErpCfop.list("-created_date", 1);
    if (existing && existing.length > 0) {
      return Response.json({ status: "skip", message: "Tabela CFOP já populada", count: existing.length });
    }

    const resp = await fetch(CFOP_URL);
    if (!resp.ok) return Response.json({ error: "Falha ao baixar JSON CFOP: " + resp.status }, { status: 502 });
    const data = await resp.json();
    const list = Array.isArray(data?.list) ? data.list : [];
    const items = list
      .filter((c: any) => c && typeof c.codigo === "string" && RE_4.test(c.codigo) && c.descricao)
      .map((c: any) => ({ code: c.codigo, description: String(c.descricao).replace(/<[^>]+>/g, "").trim() }));

    let inserted = 0;
    for (let i = 0; i < items.length; i += BATCH) {
      const batch = items.slice(i, i + BATCH);
      try {
        await base44.asServiceRole.entities.ErpCfop.bulkCreate(batch);
        inserted += batch.length;
      } catch (e) {
        // continua próximo lote em caso de erro parcial
      }
    }

    return Response.json({ status: "ok", total: items.length, inserted });
  } catch (error) {
    return Response.json({ error: error.message || "Erro ao popular CFOP" }, { status: 500 });
  }
}
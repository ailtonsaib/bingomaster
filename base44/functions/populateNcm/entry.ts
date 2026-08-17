import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const NCM_URL = "https://raw.githubusercontent.com/leogregianin/siscomex-ncm/main/ncm.json";
const BATCH = 400;
// NCM de 8 dígitos no formato XXXX.XX.XX
const RE_8 = /^\d{4}\.\d{2}\.\d{2}$/;

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Apenas administradores" }, { status: 403 });

    // Evita duplicação: se já populado, retorna
    const existing = await base44.asServiceRole.entities.ErpNcm.list("-created_date", 1);
    if (existing && existing.length > 0) {
      return Response.json({ status: "skip", message: "Tabela NCM já populada", count: existing.length });
    }

    const resp = await fetch(NCM_URL);
    if (!resp.ok) return Response.json({ error: "Falha ao baixar JSON NCM: " + resp.status }, { status: 502 });
    const data = await resp.json();
    const noms = Array.isArray(data?.Nomenclaturas) ? data.Nomenclaturas : [];
    const items = noms
      .filter((n: any) => n && typeof n.Codigo === "string" && RE_8.test(n.Codigo) && n.Descricao)
      .map((n: any) => ({ code: n.Codigo, description: String(n.Descricao).replace(/<[^>]+>/g, "").trim() }));

    let inserted = 0;
    for (let i = 0; i < items.length; i += BATCH) {
      const batch = items.slice(i, i + BATCH);
      try {
        await base44.asServiceRole.entities.ErpNcm.bulkCreate(batch);
        inserted += batch.length;
      } catch (e) {
        // continua próximo lote em caso de erro parcial
      }
    }

    return Response.json({ status: "ok", total: items.length, inserted });
  } catch (error) {
    return Response.json({ error: error.message || "Erro ao popular NCM" }, { status: 500 });
  }
}
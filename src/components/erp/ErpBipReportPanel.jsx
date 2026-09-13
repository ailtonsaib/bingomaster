import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, Search, BarChart3 } from "lucide-react";
import { fmtDate } from "@/lib/erpUtils";

const r3 = (v) => Math.round((Number(v) || 0) * 1000) / 1000;

const TYPES = {
  producao: { label: "Produção (OP)", color: "bg-indigo-100 text-indigo-700" },
  carga: { label: "Separação de Carga", color: "bg-purple-100 text-purple-700" },
  requisicao: { label: "Requisição Almoxarifado", color: "bg-blue-100 text-blue-700" },
};

const STATUS_LABEL = {
  rascunho: "Rascunho", standby: "Aguardando", em_producao: "Em Produção", concluida: "Concluída", cancelada: "Cancelada",
  montada: "Montada", carregada: "Carregada", pendente: "Pendente", atendida: "Atendida",
};

// Relatório gerencial de bipagem: quantidade bipada x quantidade prevista de
// cada documento (OP, carga e requisição) com o usuário que bipou
export default function ErpBipReportPanel({ user }) {
  const [data, setData] = useState(null);
  const [typeFilter, setTypeFilter] = useState("todos");
  const [search, setSearch] = useState("");

  useEffect(() => {
    Promise.all([
      base44.entities.ErpWmsMove.filter({ user_email: user.email }, "-created_date", 500).catch(() => []),
      base44.entities.ErpProductionOrder.filter({ user_email: user.email }, "-created_date", 500).catch(() => []),
      base44.entities.ErpLoadAssembly.filter({ user_email: user.email }, "-created_date", 500).catch(() => []),
      base44.entities.ErpWarehouseRequisition.filter({ user_email: user.email }, "-created_date", 500).catch(() => []),
      base44.entities.ErpProduct.filter({ user_email: user.email }, "-created_date", 500).catch(() => []),
    ]).then(([moves, ops, cargas, reqs, products]) => setData({ moves, ops, cargas, reqs, products }));
  }, [user.email]);

  const rows = useMemo(() => {
    if (!data) return [];
    const { moves, ops, cargas, reqs, products } = data;
    const out = [];
    const sumMoves = (doc, productId, moveType) => {
      const mvs = moves.filter(m => m.move_type === moveType && m.document === doc && (!productId || m.product_id === productId));
      return {
        bipado: r3(mvs.reduce((s, m) => s + (Number(m.quantity) || 0), 0)),
        operators: [...new Set(mvs.map(m => m.operator_name).filter(Boolean))].join(", "),
        last: mvs.map(m => m.move_date || "").sort().pop() || "",
      };
    };

    // Produção: previsto = quantidade planejada da OP x entrada bipada no estoque
    ops.filter(o => o.status === "em_producao" || o.status === "concluida").forEach(o => {
      const s = sumMoves(`OP ${o.order_number}`, o.output_product_id, "entrada");
      const p = products.find(p => p.id === o.output_product_id);
      out.push({
        type: "producao", doc: `OP ${o.order_number}`, status: o.status,
        product: o.output_product_name, unit: p?.unit || "",
        previsto: r3(o.output_quantity), ...s,
      });
    });
    // Separação de carga: previsto = quantidade do item da carga x saída bipada
    cargas.filter(c => c.status === "montada" || c.status === "carregada").forEach(c => {
      (c.items || []).forEach(it => {
        const s = sumMoves(`Carga ${c.number}`, it.product_id, "saida");
        out.push({
          type: "carga", doc: `Carga ${c.number}`, status: c.status,
          product: it.product_name, unit: it.unit || "",
          previsto: r3(it.quantity), ...s,
        });
      });
    });
    // Requisição ao almoxarifado: previsto = quantidade do item x saída bipada
    reqs.filter(r => r.status !== "cancelada").forEach(r => {
      (r.items || []).forEach(it => {
        const s = sumMoves(`Requisição ${r.number}`, it.product_id, "saida");
        out.push({
          type: "requisicao", doc: `Requisição ${r.number}`, status: r.status,
          product: it.product_name, unit: it.unit || "",
          previsto: r3(it.quantity), ...s,
        });
      });
    });
    return out.sort((a, b) => String(b.last).localeCompare(String(a.last)));
  }, [data]);

  const filtered = rows.filter(r =>
    (typeFilter === "todos" || r.type === typeFilter) &&
    (`${r.doc} ${r.product} ${r.operators}`).toLowerCase().includes(search.toLowerCase())
  );
  const diff = (r) => r3(r.bipado - r.previsto);
  const totalPrevisto = r3(filtered.reduce((s, r) => s + r.previsto, 0));
  const totalBipado = r3(filtered.reduce((s, r) => s + r.bipado, 0));
  const divergencias = filtered.filter(r => Math.abs(diff(r)) > 0.001).length;

  return (
    <div className="space-y-3">
      <h2 className="font-semibold text-base flex items-center gap-2"><BarChart3 className="w-5 h-5 text-purple-600" /> Relatório Bipado x Previsto</h2>
      <p className="text-xs text-gray-500 -mt-1">Comparativo da quantidade bipada no coletor com a quantidade prevista de cada documento (OP de produção, separação de carga e requisição ao almoxarifado), com o usuário que realizou a bipagem.</p>

      {!data ? (
        <div className="p-8 text-center text-gray-400 flex items-center justify-center gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Carregando relatório...</div>
      ) : (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            {["todos", "producao", "carga", "requisicao"].map(t => (
              <button key={t} onClick={() => setTypeFilter(t)}
                className={`text-xs px-3 py-1.5 rounded-full border ${typeFilter === t ? "bg-purple-600 text-white border-purple-600" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
                {t === "todos" ? "Todos" : TYPES[t].label}
              </button>
            ))}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar documento, produto ou usuário..."
                className="w-full h-9 rounded-md border border-input bg-white pl-9 pr-3 text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-sm">
            <div className="bg-white rounded-xl border p-3"><p className="text-xs text-gray-500">Previsto</p><p className="font-bold">{totalPrevisto.toLocaleString("pt-BR")}</p></div>
            <div className="bg-white rounded-xl border p-3"><p className="text-xs text-gray-500">Bipado</p><p className="font-bold text-emerald-700">{totalBipado.toLocaleString("pt-BR")}</p></div>
            <div className="bg-white rounded-xl border p-3"><p className="text-xs text-gray-500">Divergências</p><p className={`font-bold ${divergencias > 0 ? "text-amber-600" : "text-emerald-700"}`}>{divergencias}</p></div>
          </div>

          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 text-gray-500 text-xs">
                  <tr>
                    <th className="p-2 text-left">Tipo</th>
                    <th className="p-2 text-left">Documento</th>
                    <th className="p-2 text-left">Produto</th>
                    <th className="p-2 text-left">Status</th>
                    <th className="p-2 text-right">Previsto</th>
                    <th className="p-2 text-right">Bipado</th>
                    <th className="p-2 text-right">Divergência</th>
                    <th className="p-2 text-left">Usuário que Bipou</th>
                    <th className="p-2 text-left">Última Bipagem</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={9} className="p-8 text-center text-gray-400">Nenhuma bipagem registrada.</td></tr>
                  ) : filtered.map((r, i) => {
                    const d = diff(r);
                    return (
                      <tr key={i} className="border-t hover:bg-gray-50">
                        <td className="p-2"><span className={`text-xs px-2 py-0.5 rounded-full ${TYPES[r.type].color}`}>{TYPES[r.type].label}</span></td>
                        <td className="p-2 font-mono text-xs">{r.doc}</td>
                        <td className="p-2">{r.product || "—"}</td>
                        <td className="p-2 text-xs text-gray-600">{STATUS_LABEL[r.status] || r.status}</td>
                        <td className="p-2 text-right">{r.previsto.toLocaleString("pt-BR")} {r.unit}</td>
                        <td className="p-2 text-right font-medium">{r.bipado.toLocaleString("pt-BR")}</td>
                        <td className={`p-2 text-right font-medium ${Math.abs(d) > 0.001 ? (d < 0 ? "text-red-600" : "text-blue-700") : "text-emerald-700"}`}>
                          {Math.abs(d) > 0.001 ? (d > 0 ? `+${d}` : d) : "—"}
                        </td>
                        <td className="p-2 text-xs">{r.operators || "—"}</td>
                        <td className="p-2 text-xs text-gray-500">{r.last ? fmtDate(r.last) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
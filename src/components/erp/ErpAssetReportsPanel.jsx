import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2, Search, Download } from "lucide-react";
import { fmtMoney, fmtDate } from "@/lib/erpUtils";

const num = (v) => Number(v) || 0;

export default function ErpAssetReportsPanel({ user }) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    try { setAssets(await base44.entities.ErpFixedAsset.filter({ user_email: user.email }, "code", 500)); }
    catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [user.email]);

  const depAcum = (a) => Math.max(0, num(a.acquisition_value) - num(a.current_value));
  const filtered = assets.filter(a => (`${a.name} ${a.code || ""} ${a.structure_name || ""} ${a.location || ""}`).toLowerCase().includes(search.toLowerCase()));
  const ativos = filtered.filter(a => a.status === "ativo");
  const totAq = ativos.reduce((s, a) => s + num(a.acquisition_value), 0);
  const totDep = ativos.reduce((s, a) => s + depAcum(a), 0);
  const totAtual = ativos.reduce((s, a) => s + num(a.current_value), 0);

  const exportCsv = () => {
    const header = ["Codigo", "Bem", "Estrutura", "Localizacao", "Data Aquisicao", "Vl Aquisicao", "Taxa % a.a.", "Dep Acumulada", "Vl Atual", "Status"];
    const lines = filtered.map(a => [
      a.code || "", a.name, a.structure_name || "", a.location || "", fmtDate(a.acquisition_date),
      num(a.acquisition_value).toFixed(2).replace(".", ","), num(a.depreciation_rate),
      depAcum(a).toFixed(2).replace(".", ","), num(a.current_value).toFixed(2).replace(".", ","), a.status,
    ].join(";"));
    const blob = new Blob([[header.join(";"), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio-patrimonial-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  if (loading) return <div className="flex items-center justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border p-3"><p className="text-xs text-gray-500">Bens ativos</p><p className="text-xl font-bold">{ativos.length}</p></div>
        <div className="bg-white rounded-xl border p-3"><p className="text-xs text-gray-500">Valor de Aquisição</p><p className="text-xl font-bold">{fmtMoney(totAq)}</p></div>
        <div className="bg-white rounded-xl border p-3"><p className="text-xs text-gray-500">Depreciação Acumulada</p><p className="text-xl font-bold text-amber-600">{fmtMoney(totDep)}</p></div>
        <div className="bg-white rounded-xl border p-3"><p className="text-xs text-gray-500">Valor Líquido</p><p className="text-xl font-bold text-emerald-600">{fmtMoney(totAtual)}</p></div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar bem..." className="w-full h-9 rounded-md border border-input bg-transparent pl-9 pr-3 text-sm" />
        </div>
        <Button size="sm" variant="outline" onClick={exportCsv} className="gap-1.5"><Download className="w-4 h-4" /> Exportar CSV</Button>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-gray-500 text-xs">
              <tr>
                <th className="p-2 text-left">Código</th><th className="p-2 text-left">Bem</th><th className="p-2 text-left">Estrutura</th>
                <th className="p-2 text-left">Localização</th><th className="p-2 text-left">Aquisição</th>
                <th className="p-2 text-right">Vl. Aquisição</th><th className="p-2 text-right">Taxa</th>
                <th className="p-2 text-right">Dep. Acumulada</th><th className="p-2 text-right">Vl. Atual</th>
                <th className="p-2 text-right">% Depreciado</th><th className="p-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? <tr><td colSpan={11} className="p-8 text-center text-gray-400">Nenhum bem cadastrado.</td></tr>
                : filtered.map(a => (
                  <tr key={a.id} className="border-t hover:bg-gray-50">
                    <td className="p-2 font-mono text-xs">{a.code || "—"}</td>
                    <td className="p-2 font-medium">{a.name}</td>
                    <td className="p-2 text-xs">{a.structure_name || "—"}</td>
                    <td className="p-2 text-xs">{a.location || "—"}</td>
                    <td className="p-2 text-xs">{fmtDate(a.acquisition_date)}</td>
                    <td className="p-2 text-right text-xs">{fmtMoney(a.acquisition_value)}</td>
                    <td className="p-2 text-right text-xs">{num(a.depreciation_rate) > 0 ? `${num(a.depreciation_rate)}%` : "—"}</td>
                    <td className="p-2 text-right text-xs text-amber-600">{fmtMoney(depAcum(a))}</td>
                    <td className="p-2 text-right text-xs">{fmtMoney(a.current_value)}</td>
                    <td className="p-2 text-right text-xs">{num(a.acquisition_value) > 0 ? `${(depAcum(a) / num(a.acquisition_value) * 100).toFixed(1)}%` : "—"}</td>
                    <td className="p-2"><span className={`text-xs px-2 py-0.5 rounded-full ${a.status === "ativo" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>{a.status === "ativo" ? "Ativo" : "Baixado"}</span></td>
                  </tr>
                ))}
            </tbody>
            {filtered.length > 0 && (
              <tfoot className="bg-gray-50 font-semibold border-t">
                <tr>
                  <td className="p-2" colSpan={5}>Totais ({ativos.length} bens ativos)</td>
                  <td className="p-2 text-right">{fmtMoney(totAq)}</td>
                  <td></td>
                  <td className="p-2 text-right text-amber-600">{fmtMoney(totDep)}</td>
                  <td className="p-2 text-right">{fmtMoney(totAtual)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
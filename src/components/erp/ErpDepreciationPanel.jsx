import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2, Calculator, Trash2 } from "lucide-react";
import { fmtMoney } from "@/lib/erpUtils";

const MONTHS = ["", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const num = (v) => Number(v) || 0;
const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

export default function ErpDepreciationPanel({ user }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [assets, setAssets] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [a, r] = await Promise.all([
        base44.entities.ErpFixedAsset.filter({ user_email: user.email }, "code", 500),
        base44.entities.ErpDepreciation.filter({ user_email: user.email }, "-created_date", 1000),
      ]);
      setAssets(a); setRecords(r);
    } catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [user.email]);

  const depAssets = assets.filter(a => a.status === "ativo" && num(a.depreciation_rate) > 0 && num(a.acquisition_value) > 0);
  const monthRecords = records.filter(r => num(r.month) === month && num(r.year) === year);
  const rows = depAssets.map(a => {
    const rec = monthRecords.find(r => r.asset_id === a.id);
    const monthly = Math.min(num(a.acquisition_value) * num(a.depreciation_rate) / 100 / 12, num(a.current_value));
    return { ...a, monthly: round2(monthly), processed: !!rec };
  }).filter(r => r.monthly > 0.004);
  const pending = rows.filter(r => !r.processed);
  const mesProcessado = monthRecords.reduce((s, r) => s + num(r.depreciation_value), 0);
  const anoAcumulado = records.filter(r => num(r.year) === year).reduce((s, r) => s + num(r.depreciation_value), 0);

  const processMonth = async () => {
    if (!pending.length) { alert("Todos os bens já foram depreciados neste mês."); return; }
    if (!confirm(`Processar a depreciação de ${MONTHS[month]}/${year} para ${pending.length} bem(ns)? O valor atual de cada bem será reduzido.`)) return;
    setBusy(true);
    try {
      await base44.entities.ErpDepreciation.bulkCreate(pending.map(a => ({
        user_email: user.email,
        asset_id: a.id, asset_name: a.name, asset_code: a.code || "",
        month, year,
        depreciation_value: a.monthly,
        accumulated_to_date: round2(num(a.acquisition_value) - num(a.current_value) + a.monthly),
        processed_date: new Date().toISOString(),
        notes: `Depreciação de ${MONTHS[month]}/${year} (${num(a.depreciation_rate)}% a.a.)`,
      })));
      await base44.entities.ErpFixedAsset.bulkUpdate(pending.map(a => ({ id: a.id, current_value: round2(num(a.current_value) - a.monthly) })));
      alert(`${pending.length} bem(ns) depreciado(s) — valor atual atualizado.`);
      load();
    } catch (e) { alert(e.message); }
    setBusy(false);
  };

  const removeRecord = async (rec) => {
    if (!confirm(`Excluir a depreciação de "${rec.asset_name}" em ${MONTHS[rec.month]}/${rec.year}? O valor atual do bem será restaurado.`)) return;
    try {
      const asset = assets.find(a => a.id === rec.asset_id);
      if (asset) await base44.entities.ErpFixedAsset.update(asset.id, { current_value: round2(num(asset.current_value) + num(rec.depreciation_value)) });
      await base44.entities.ErpDepreciation.delete(rec.id);
      load();
    } catch (e) { alert(e.message); }
  };

  if (loading) return <div className="flex items-center justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-500">Competência:</span>
        <select value={month} onChange={e => setMonth(Number(e.target.value))} className="h-9 rounded-md border border-input bg-white px-3 text-sm">
          {MONTHS.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
        </select>
        <input type="number" value={year} onChange={e => setYear(Number(e.target.value))} className="h-9 w-24 rounded-md border border-input px-2 text-sm" />
        <Button size="sm" onClick={processMonth} disabled={busy || !pending.length} className="gap-1.5 ml-auto bg-amber-600 hover:bg-amber-700">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />} Processar Depreciação do Mês ({pending.length})
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border p-3"><p className="text-xs text-gray-500">Depreciado em {MONTHS[month]}/{year}</p><p className="text-xl font-bold">{fmtMoney(mesProcessado)}</p></div>
        <div className="bg-white rounded-xl border p-3"><p className="text-xs text-gray-500">Acumulado em {year}</p><p className="text-xl font-bold text-amber-600">{fmtMoney(anoAcumulado)}</p></div>
        <div className="bg-white rounded-xl border p-3"><p className="text-xs text-gray-500">Bens depreciáveis</p><p className="text-xl font-bold">{depAssets.length}</p></div>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-gray-500 text-xs">
              <tr>
                <th className="p-2 text-left">Código</th><th className="p-2 text-left">Bem</th><th className="p-2 text-left">Estrutura</th>
                <th className="p-2 text-right">Vl. Aquisição</th><th className="p-2 text-right">Taxa (% a.a.)</th>
                <th className="p-2 text-right">Dep. do Mês</th><th className="p-2 text-right">Vl. Atual</th>
                <th className="p-2 text-left">Status</th><th className="p-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? <tr><td colSpan={9} className="p-8 text-center text-gray-400">Nenhum bem ativo com taxa de depreciação e valor de aquisição.</td></tr>
                : rows.map(r => (
                  <tr key={r.id} className="border-t hover:bg-gray-50">
                    <td className="p-2 font-mono text-xs">{r.code || "—"}</td>
                    <td className="p-2 font-medium">{r.name}</td>
                    <td className="p-2 text-xs">{r.structure_name || "—"}</td>
                    <td className="p-2 text-right text-xs">{fmtMoney(r.acquisition_value)}</td>
                    <td className="p-2 text-right text-xs">{num(r.depreciation_rate)}%</td>
                    <td className="p-2 text-right font-medium text-amber-600">{fmtMoney(r.monthly)}</td>
                    <td className="p-2 text-right text-xs">{fmtMoney(r.current_value)}</td>
                    <td className="p-2"><span className={`text-xs px-2 py-0.5 rounded-full ${r.processed ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{r.processed ? "Depreciado" : "Pendente"}</span></td>
                    <td className="p-2 text-right">
                      {r.processed && <button title="Excluir (restaura o valor do bem)" onClick={() => removeRecord(monthRecords.find(m => m.asset_id === r.id))} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs text-gray-400">Depreciação mensal = valor de aquisição × taxa anual ÷ 12, limitada ao valor atual do bem. Ao processar, o valor atual de cada bem é reduzido.</p>
    </div>
  );
}
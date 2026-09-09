import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2, BadgePercent, Trash2 } from "lucide-react";
import { fmtMoney } from "@/lib/erpUtils";

const MONTHS = ["", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const num = (v) => Number(v) || 0;
const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

// Número da parcela CIAP do bem na competência (1 = mês da aquisição; até 48)
const installmentOf = (asset, month, year) => {
  if (!asset.acquisition_date) return null;
  const d = new Date(asset.acquisition_date);
  if (isNaN(d.getTime())) return null;
  return (year - d.getFullYear()) * 12 + (month - (d.getMonth() + 1)) + 1;
};

export default function ErpCiapPanel({ user }) {
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
        base44.entities.ErpCiap.filter({ user_email: user.email }, "-created_date", 1000),
      ]);
      setAssets(a); setRecords(r);
    } catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [user.email]);

  const ciapAssets = assets.filter(a => a.status === "ativo" && num(a.icms_value) > 0);
  const monthRecords = records.filter(r => num(r.month) === month && num(r.year) === year);
  const rows = ciapAssets.map(a => {
    const n = installmentOf(a, month, year);
    const rec = monthRecords.find(r => r.asset_id === a.id);
    const eligible = n !== null && n >= 1 && n <= 48;
    return {
      ...a, installment: n, eligible,
      credit: round2(num(a.icms_value) / 48),
      done: !!rec,
    };
  });
  const pending = rows.filter(r => r.eligible && !r.done);
  const mesApropriado = monthRecords.reduce((s, r) => s + num(r.credit_value), 0);
  const anoApropriado = records.filter(r => num(r.year) === year).reduce((s, r) => s + num(r.credit_value), 0);

  const appropriate = async () => {
    if (!pending.length) { alert("Não há parcelas CIAP pendentes nesta competência."); return; }
    if (!confirm(`Apropriar o crédito CIAP de ${MONTHS[month]}/${year} para ${pending.length} bem(ns) (parcela de 1/48 do ICMS de cada bem)?`)) return;
    setBusy(true);
    try {
      await base44.entities.ErpCiap.bulkCreate(pending.map(a => ({
        user_email: user.email,
        asset_id: a.id, asset_name: a.name, asset_code: a.code || "",
        acquisition_date: a.acquisition_date, icms_value: num(a.icms_value),
        month, year, installment: a.installment, credit_value: a.credit,
        status: "apropriado", apropriation_date: new Date().toISOString(),
        notes: `CIAP parcela ${a.installment}/48 — ${MONTHS[month]}/${year}`,
      })));
      alert(`${pending.length} parcela(s) CIAP apropriada(s).`);
      load();
    } catch (e) { alert(e.message); }
    setBusy(false);
  };

  const removeRecord = async (rec) => {
    if (!confirm(`Excluir a apropriação CIAP de "${rec.asset_name}" em ${MONTHS[rec.month]}/${rec.year}?`)) return;
    try { await base44.entities.ErpCiap.delete(rec.id); load(); } catch (e) { alert(e.message); }
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
        <Button size="sm" onClick={appropriate} disabled={busy || !pending.length} className="gap-1.5 ml-auto bg-amber-600 hover:bg-amber-700">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <BadgePercent className="w-4 h-4" />} Apropriar Crédito do Mês ({pending.length})
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border p-3"><p className="text-xs text-gray-500">Apropriado em {MONTHS[month]}/{year}</p><p className="text-xl font-bold">{fmtMoney(mesApropriado)}</p></div>
        <div className="bg-white rounded-xl border p-3"><p className="text-xs text-gray-500">Apropriado em {year}</p><p className="text-xl font-bold text-amber-600">{fmtMoney(anoApropriado)}</p></div>
        <div className="bg-white rounded-xl border p-3"><p className="text-xs text-gray-500">Bens com ICMS (CIAP)</p><p className="text-xl font-bold">{ciapAssets.length}</p></div>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-gray-500 text-xs">
              <tr>
                <th className="p-2 text-left">Código</th><th className="p-2 text-left">Bem</th><th className="p-2 text-right">ICMS Aquisição</th>
                <th className="p-2 text-center">Parcela</th><th className="p-2 text-right">Crédito do Mês</th><th className="p-2 text-left">Status</th><th className="p-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? <tr><td colSpan={7} className="p-8 text-center text-gray-400">Nenhum bem ativo com ICMS informado. Preencha o campo "ICMS na Aquisição" no cadastro de bens.</td></tr>
                : rows.map(r => (
                  <tr key={r.id} className="border-t hover:bg-gray-50">
                    <td className="p-2 font-mono text-xs">{r.code || "—"}</td>
                    <td className="p-2 font-medium">{r.name}</td>
                    <td className="p-2 text-right text-xs">{fmtMoney(r.icms_value)}</td>
                    <td className="p-2 text-center text-xs">{r.installment ? `${r.installment}/48` : "—"}</td>
                    <td className="p-2 text-right font-medium text-amber-600">{r.eligible ? fmtMoney(r.credit) : "—"}</td>
                    <td className="p-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${r.done ? "bg-emerald-100 text-emerald-700" : r.eligible ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"}`}>
                        {r.done ? "Apropriado" : r.eligible ? "Pendente" : "Fora do prazo"}
                      </span>
                    </td>
                    <td className="p-2 text-right">
                      {r.done && <button title="Excluir apropriação" onClick={() => removeRecord(monthRecords.find(m => m.asset_id === r.id))} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs text-gray-400">CIAP — Controle de Crédito de ICMS do Ativo Permanente: o ICMS destacado na aquisição do bem é apropriado em 48 parcelas mensais (1/48), a partir do mês da aquisição.</p>
    </div>
  );
}
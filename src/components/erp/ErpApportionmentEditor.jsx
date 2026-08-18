import { Plus, Trash2, PieChart } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

// Editor de rateio (setor + conta contábil) reutilizável.
// Usado na Tomada de Preço e no Pedido de Compra para garantir que o rateio
// acompanhe o fluxo até a entrada da nota (lançamento contábil).
export default function ErpApportionmentEditor({ apportionments, onChange, setores, accounts, readOnly = false, title = "Rateio (Setor / Conta Contábil)", accent = "indigo" }) {
  const list = apportionments || [];
  const add = () => onChange([...list, { department_id: "", department_name: "", account_id: "", account_code: "", account_name: "", rateio_type: "percent", percent: 0, value: 0 }]);
  const remove = (i) => onChange(list.filter((_, idx) => idx !== i));
  const update = (i, field, value) => {
    const aps = list.map((a, idx) => idx === i ? { ...a, [field]: value } : a);
    if (field === "department_id") { const d = setores.find(d => d.id === value); aps[i].department_name = d?.name || ""; }
    if (field === "account_id") { const a = accounts.find(a => a.id === value); aps[i].account_code = a?.code || ""; aps[i].account_name = a?.name || ""; }
    onChange(aps);
  };

  const pctSum = list.reduce((s, a) => s + (Number(a.percent) || 0), 0);
  const pctOk = Math.abs(pctSum - 100) < 0.01;
  const allFilled = list.length > 0 && list.every(a => a.department_id && a.account_id);

  const headerBg = accent === "emerald" ? "bg-emerald-50" : "bg-indigo-50";
  const headerText = accent === "emerald" ? "text-emerald-800" : "text-indigo-800";

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className={`flex items-center justify-between p-2 ${headerBg} border-b`}>
        <span className={`text-sm font-semibold ${headerText} flex items-center gap-1.5`}><PieChart className="w-4 h-4" /> {title}</span>
        {!readOnly && <Button size="sm" variant="outline" onClick={add} className="h-7 gap-1" disabled={!setores.length || !accounts.length}><Plus className="w-3.5 h-3.5" /> Rateio</Button>}
      </div>
      <div className="p-2 space-y-1.5">
        {list.length === 0 && <p className="text-center text-xs text-gray-400 py-2">{readOnly ? "Sem rateio." : "Nenhum rateio. Clique em \"Rateio\"."}</p>}
        {list.map((a, i) => (
          <div key={i} className="grid grid-cols-12 gap-1.5 items-end">
            <div className="col-span-4">
              <Label className="text-[10px]">Setor</Label>
              {readOnly
                ? <p className="text-xs h-8 flex items-center">{a.department_name || "—"}</p>
                : <select value={a.department_id} onChange={e => update(i, "department_id", e.target.value)} className="w-full h-8 rounded border border-input px-2 text-xs">
                    <option value="">Selecione...</option>{setores.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>}
            </div>
            <div className="col-span-4">
              <Label className="text-[10px]">Conta Contábil</Label>
              {readOnly
                ? <p className="text-xs h-8 flex items-center">{a.account_code ? `${a.account_code} — ` : ""}{a.account_name || "—"}</p>
                : <select value={a.account_id} onChange={e => update(i, "account_id", e.target.value)} className="w-full h-8 rounded border border-input px-2 text-xs">
                    <option value="">Selecione...</option>{accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.code} — {acc.name}</option>)}
                  </select>}
            </div>
            <div className="col-span-3">
              <Label className="text-[10px]">%</Label>
              {readOnly
                ? <p className="text-xs h-8 flex items-center">{a.percent || 0}%</p>
                : <Input type="number" step="0.01" value={a.percent} onChange={e => update(i, "percent", Number(e.target.value))} className="h-8 text-xs" />}
            </div>
            <div className="col-span-1 flex justify-end">
              {!readOnly && <button onClick={() => remove(i)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>}
            </div>
          </div>
        ))}
        {!readOnly && list.length > 0 && (
          <div className="text-right text-xs">
            <span className={pctOk ? "text-emerald-600 font-medium" : "text-red-600 font-medium"}>Soma: {pctSum.toFixed(2)}% {pctOk ? "✓" : "(deve ser 100%)"}</span>
          </div>
        )}
        {!readOnly && (!setores.length || !accounts.length) && (
          <p className="text-[11px] text-amber-600">Cadastre setores e contas contábeis analíticas antes de informar o rateio.</p>
        )}
      </div>
    </div>
  );
}
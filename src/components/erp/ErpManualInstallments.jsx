import { Plus, Trash2 } from "lucide-react";

// Parcelas / vencimentos de pagamento da entrada manual — cada parcela gera
// uma conta a pagar no financeiro. O valor vazio usa o total do documento.
export default function ErpManualInstallments({ value, onChange, onAdd, total }) {
  const set = (i, patch) => onChange(value.map((x, idx) => idx === i ? { ...x, ...patch } : x));
  const remove = (i) => onChange(value.filter((_, idx) => idx !== i));
  const sum = value.reduce((s, it) => s + (Number(it.amount) || 0), 0);
  const fmt = (v) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const diff = Math.abs(sum - (Number(total) || 0));

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-gray-50 px-3 py-2 border-b flex items-center justify-between">
        <h4 className="text-sm font-semibold">Parcelas / Vencimentos (financeiro)</h4>
        <button type="button" onClick={onAdd} className="flex items-center gap-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50 rounded-md px-2 py-1">
          <Plus className="w-3.5 h-3.5" /> Parcela
        </button>
      </div>
      <table className="w-full text-xs">
        <thead className="bg-gray-50 border-b">
          <tr><th className="p-2 text-left">Parcela</th><th className="p-2 text-left w-44">Vencimento</th><th className="p-2 text-right w-32">Valor (R$)</th><th className="p-2 w-10"></th></tr>
        </thead>
        <tbody>
          {value.map((it, i) => (
            <tr key={i} className="border-b">
              <td className="p-2">{i + 1}/{value.length}</td>
              <td className="p-2"><input type="date" value={it.due_date} onChange={e => set(i, { due_date: e.target.value })} className="w-full h-8 rounded border border-input px-2 text-xs" /></td>
              <td className="p-2"><input type="number" step="0.01" value={it.amount} onChange={e => set(i, { amount: e.target.value })} placeholder="total" className="w-full h-8 rounded border border-input px-2 text-right text-xs" /></td>
              <td className="p-2 text-center">
                {value.length > 1 && <button type="button" onClick={() => remove(i)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5 text-red-500" /></button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className={`px-3 py-2 border-t text-[11px] flex items-center justify-between ${diff > 0.01 ? "text-amber-700 bg-amber-50" : "text-gray-500 bg-gray-50"}`}>
        <span>Total das parcelas: <b>{fmt(sum)}</b></span>
        {diff > 0.01
          ? <span>Diverge do total do documento ({fmt(total)}) — ajuste os valores.</span>
          : <span>Total do documento: {fmt(total)}</span>}
      </div>
    </div>
  );
}
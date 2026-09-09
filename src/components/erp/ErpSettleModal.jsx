import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

const round2 = v => Math.round((Number(v) || 0) * 100) / 100;
const fmt = v => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Modal de baixa em lote com manutenção de valores:
// valor do título x valor pago/recebido + juros - descontos deve fechar exatamente.
// A diferença é lançada automaticamente no 1º campo de juros ou descontos.
export default function ErpSettleModal({ titles, verb, bankName, date, events, onClose, onConfirm }) {
  const [entries, setEntries] = useState(titles.map(t => ({
    id: t.id,
    description: t.description || "",
    party: t.beneficiary || t.customer_name || "",
    dueDate: t.due_date || "",
    docValue: round2(t.amount),
    paid: round2(t.amount),
    juros: [0, 0, 0],
    descontos: [0, 0, 0],
  })));
  const [saving, setSaving] = useState(false);
  const [eventId, setEventId] = useState("");

  // ao alterar o valor a pagar/receber, identifica automaticamente juros ou desconto
  const onPaid = (id, v) => {
    setEntries(prev => prev.map(e => {
      if (e.id !== id) return e;
      const paid = round2(v);
      const diff = round2(paid - e.docValue);
      return {
        ...e,
        paid,
        juros: diff > 0 ? [diff, 0, 0] : [0, 0, 0],
        descontos: diff < 0 ? [-diff, 0, 0] : [0, 0, 0],
      };
    }));
  };

  const setEntry = (id, patch) => setEntries(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e));

  const sumJ = e => round2(e.juros.reduce((s, v) => s + (Number(v) || 0), 0));
  const sumD = e => round2(e.descontos.reduce((s, v) => s + (Number(v) || 0), 0));
  // documento = valor pago/recebido + juros - descontos → diferença deve ser zero
  const diff = e => round2((e.docValue + sumJ(e) - sumD(e)) - e.paid);
  const balanced = e => Math.abs(diff(e)) < 0.005;
  const allBalanced = entries.every(balanced);

  const totals = entries.reduce((acc, e) => ({
    paid: round2(acc.paid + (Number(e.paid) || 0)),
    juros: round2(acc.juros + sumJ(e)),
    descontos: round2(acc.descontos + sumD(e)),
  }), { paid: 0, juros: 0, descontos: 0 });

  const handleConfirm = async () => {
    if (!eventId) { alert("Selecione o evento contábil da baixa."); return; }
    if (!allBalanced) {
      alert("Existem títulos com valores não fechados: valor do documento ≠ valor " + (verb === "Pagar" ? "pago" : "recebido") + " + juros - descontos.");
      return;
    }
    const ev = (events || []).find(x => x.id === eventId);
    setSaving(true);
    try {
      await onConfirm(entries, ev);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
          <div>
            <h2 className="font-bold">Baixa em Lote — {verb === "Pagar" ? "Contas a Pagar" : "Contas a Receber"}</h2>
            <p className="text-xs text-gray-500">Conta: {bankName} — Data: {date}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded text-gray-500">✕</button>
        </div>

        <div className="px-4 pt-3">
          <label className="text-xs font-medium text-gray-600">Evento Contábil *</label>
          <select value={eventId} onChange={e => setEventId(e.target.value)} className="w-full h-9 rounded-md border border-input bg-white px-3 text-sm mt-1">
            <option value="">Selecione o evento da baixa...</option>
            {(events || []).map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
          </select>
          <p className="text-xs text-gray-400 mt-1">O evento é a base do lançamento contábil: banco x {verb === "Pagar" ? "fornecedor" : "cliente"}, juros e descontos.</p>
        </div>

        <div className="p-4 space-y-3">
          {entries.map(e => (
            <div key={e.id} className={`border rounded-lg p-3 ${balanced(e) ? "border-gray-200" : "border-red-300 bg-red-50"}`}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{e.description}</p>
                  <p className="text-xs text-gray-500 truncate">{e.party}{e.dueDate ? ` — Venc. ${e.dueDate}` : ""}</p>
                </div>
                {balanced(e) ? (
                  <span className="flex items-center gap-1 text-xs text-emerald-700 whitespace-nowrap"><CheckCircle2 className="w-4 h-4" /> Fechado</span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-red-600 whitespace-nowrap"><AlertTriangle className="w-4 h-4" /> Diferença: {fmt(diff(e))}</span>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-8 gap-2 items-end">
                <div>
                  <label className="text-xs text-gray-500">Valor do Título</label>
                  <input value={fmt(e.docValue)} readOnly className="w-full h-9 rounded-md border border-input bg-gray-100 px-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Valor a {verb}</label>
                  <input type="number" step="0.01" value={e.paid} onChange={ev => onPaid(e.id, ev.target.value)} className="w-full h-9 rounded-md border border-input bg-white px-2 text-sm" />
                </div>
                {[0, 1, 2].map(i => (
                  <div key={`j${i}`}>
                    <label className="text-xs text-gray-500">Juros {i + 1}</label>
                    <input type="number" step="0.01" value={e.juros[i]} onChange={ev => setEntry(e.id, { juros: e.juros.map((v, idx) => idx === i ? ev.target.value : v) })} className="w-full h-9 rounded-md border border-input bg-white px-2 text-sm" />
                  </div>
                ))}
                {[0, 1, 2].map(i => (
                  <div key={`d${i}`}>
                    <label className="text-xs text-gray-500">Desconto {i + 1}</label>
                    <input type="number" step="0.01" value={e.descontos[i]} onChange={ev => setEntry(e.id, { descontos: e.descontos.map((v, idx) => idx === i ? ev.target.value : v) })} className="w-full h-9 rounded-md border border-input bg-white px-2 text-sm" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t flex items-center justify-between gap-2 flex-wrap sticky bottom-0 bg-white">
          <p className="text-xs text-gray-600">
            {entries.length} título(s) — {verb === "Pagar" ? "Pago" : "Recebido"}: <b>{fmt(totals.paid)}</b> | Juros: <b>{fmt(totals.juros)}</b> | Descontos: <b>{fmt(totals.descontos)}</b>
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button size="sm" disabled={!allBalanced || saving || !eventId} onClick={handleConfirm}>{saving ? "Baixando..." : "Confirmar Baixa"}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
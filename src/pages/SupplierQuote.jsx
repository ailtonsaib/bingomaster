import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Gavel, CheckCircle2, Loader2, AlertCircle, ArrowLeft } from "lucide-react";
import { fmtMoney, fmtDate } from "@/lib/erpUtils";

export default function SupplierQuote() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [items, setItems] = useState([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await base44.functions.invoke("supplierQuotation", { action: "getByToken", token });
        if (res.data?.error) { setError(res.data.error); setLoading(false); return; }
        const q = res.data.quotation;
        const existing = res.data.existing || [];
        setData({ ...res.data });
        setItems(q.items.map((it, i) => {
          const ex = existing[i] || {};
          return {
            description: it.description,
            quantity: it.quantity,
            unit: it.unit,
            unit_price: ex.unit_price != null ? Number(ex.unit_price) : "",
          };
        }));
        setNotes(res.data.quote_status === "respondida" ? (existing.notes || "") : "");
      } catch (e) {
        setError(e.message || "Erro ao carregar tomada.");
      }
      setLoading(false);
    })();
  }, [token]);

  const total = items.reduce((s, it) => s + (Number(it.unit_price) || 0) * (Number(it.quantity) || 0), 0);

  const updateItem = (i, val) => setItems(prev => {
    const copy = [...prev]; copy[i] = { ...copy[i], unit_price: val === "" ? "" : Number(val) }; return copy;
  });

  const handleSubmit = async () => {
    if (items.some(it => it.unit_price === "" || Number(it.unit_price) < 0)) {
      alert("Informe o valor unitário de todos os itens (maior ou igual a zero).");
      return;
    }
    setSaving(true);
    try {
      const res = await base44.functions.invoke("supplierQuotation", {
        action: "submit", token, items, notes,
      });
      if (res.data?.error) { alert(res.data.error); setSaving(false); return; }
      setDone(true);
    } catch (e) {
      alert(e.message || "Erro ao enviar cotação.");
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-indigo-50 to-background p-6">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-3" />
        <p className="text-sm text-gray-500">Carregando tomada de preço...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-red-50 to-background p-6 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mb-3" />
        <h1 className="text-xl font-bold text-gray-800">Link inválido</h1>
        <p className="text-sm text-gray-500 mt-1 max-w-sm">{error}</p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-emerald-50 to-background p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
          <CheckCircle2 className="w-9 h-9 text-emerald-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-800">Cotação enviada!</h1>
        <p className="text-sm text-gray-500 mt-1 max-w-sm">Sua cotação foi registrada com sucesso. Obrigado pela participação.</p>
      </div>
    );
  }

  const q = data?.quotation;
  const alreadyResponded = data?.quote_status === "respondida";

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50/60 to-background">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-11 h-11 rounded-xl bg-indigo-600 flex items-center justify-center shadow">
            <Gavel className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold font-heading text-gray-800">Tomada de Preço</h1>
            <p className="text-xs text-gray-500">Preencha os valores e envie sua cotação</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border shadow-sm p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-gray-400 text-xs">Número</span><p className="font-mono font-medium">{q?.number}</p></div>
            <div><span className="text-gray-400 text-xs">Data</span><p className="font-medium">{fmtDate(q?.quotation_date)}</p></div>
            <div><span className="text-gray-400 text-xs">Fornecedor</span><p className="font-medium">{data?.supplier?.name}</p></div>
            {q?.requisition_number && <div><span className="text-gray-400 text-xs">Solicitação</span><p className="font-mono text-xs">{q.requisition_number}</p></div>}
          </div>
          {q?.description && <div className="text-sm border-t pt-2"><span className="text-gray-400 text-xs">Objeto</span><p className="font-medium">{q.description}</p></div>}
        </div>

        {alreadyResponded && (
          <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" /> Você já respondeu esta tomada. Pode revisar e reenviar se necessário.
          </div>
        )}

        <div className="bg-white rounded-xl border shadow-sm mt-3 overflow-hidden">
          <div className="p-3 bg-gray-50 border-b text-sm font-semibold text-gray-700">Itens para cotar</div>
          {items.length === 0 ? (
            <p className="p-6 text-center text-sm text-gray-400">Nenhum item nesta tomada.</p>
          ) : items.map((it, i) => (
            <div key={i} className="p-3 border-b last:border-b-0">
              <div className="flex justify-between items-start gap-2">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-800">{it.description || `Item ${i + 1}`}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Quantidade: {it.quantity} {it.unit}</p>
                </div>
                <div className="w-36">
                  <Label className="text-[10px] text-gray-400">Valor unitário (R$)</Label>
                  <Input type="number" step="0.01" min="0" value={it.unit_price}
                    onChange={e => updateItem(i, e.target.value)} className="h-8 text-sm text-right" placeholder="0,00" />
                  <p className="text-[11px] text-right text-gray-400 mt-0.5">
                    Total: {fmtMoney((Number(it.unit_price) || 0) * (Number(it.quantity) || 0))}
                  </p>
                </div>
              </div>
            </div>
          ))}
          <div className="p-3 bg-gray-50 border-t flex justify-between items-center">
            <span className="text-sm text-gray-500">Total da cotação</span>
            <span className="text-lg font-bold text-indigo-700">{fmtMoney(total)}</span>
          </div>
        </div>

        <div className="bg-white rounded-xl border shadow-sm mt-3 p-3">
          <Label className="text-sm">Observações (opcional)</Label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
            className="w-full mt-1 rounded-md border border-input bg-transparent px-3 py-2 text-sm" placeholder="Prazo de validade da cotação, condições, marcas, etc." />
        </div>

        <div className="flex gap-2 mt-4">
          <Button onClick={handleSubmit} disabled={saving} className="flex-1 gap-2 bg-indigo-600 hover:bg-indigo-700">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</> : <><CheckCircle2 className="w-4 h-4" /> Enviar Cotação</>}
          </Button>
        </div>
        <p className="text-center text-[11px] text-gray-400 mt-3">Ao enviar, sua cotação será registrada no sistema do comprador.</p>
      </div>
    </div>
  );
}
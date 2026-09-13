import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Package } from "lucide-react";
import { fmtMoney } from "@/lib/erpUtils";

const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

const TYPE_FILTERS = [
  { value: "insumo", label: "Insumo (material de consumo)" },
  { value: "materia_prima", label: "Matéria-Prima" },
  { value: "todos", label: "Todos os produtos" },
];

// Peças substituídas na parada de produção: produtos do cadastro (material de
// consumo) com quantidade e custo unitário, mais o custo extra do serviço —
// o total alimenta o custo extra da parada no apontamento da OP.
export default function ErpStopPartsModal({ user, parts = [], onConfirm, onClose }) {
  const [products, setProducts] = useState([]);
  const [typeFilter, setTypeFilter] = useState("insumo");
  const [lines, setLines] = useState(
    parts.length
      ? parts.map(p => ({ product_id: p.product_id, quantity: String(p.quantity), unit_cost: String(p.unit_cost) }))
      : [{ product_id: "", quantity: "1", unit_cost: "" }]
  );
  const [extraCost, setExtraCost] = useState("");

  useEffect(() => {
    base44.entities.ErpProduct.filter({ user_email: user.email }, "name", 500)
      .then(setProducts).catch(() => setProducts([]));
  }, [user.email]);

  const filteredProducts = typeFilter === "todos"
    ? products.filter(p => p.product_type !== "servico")
    : products.filter(p => p.product_type === typeFilter);

  const setLine = (i, patch) => setLines(prev => prev.map((l, j) => j === i ? { ...l, ...patch } : l));
  const pickProduct = (i, pid) => {
    const p = products.find(x => x.id === pid);
    setLine(i, { product_id: pid, unit_cost: String(p ? (Number(p.cost_price) || 0) : 0) });
  };
  const lineValue = (l) => r2((Number(l.quantity) || 0) * (Number(l.unit_cost) || 0));
  const partsTotal = r2(lines.reduce((s, l) => s + lineValue(l), 0));

  const confirm = () => {
    const valid = lines.filter(l => l.product_id && Number(l.quantity) > 0);
    if (lines.some(l => l.product_id && Number(l.quantity) <= 0)) { alert("Informe uma quantidade maior que zero em todas as peças."); return; }
    if (lines.some(l => !l.product_id && (Number(l.quantity) > 0 || l.unit_cost !== ""))) { alert("Selecione o produto em todas as linhas ou remova as linhas vazias."); return; }
    const built = valid.map(l => {
      const p = products.find(x => x.id === l.product_id);
      return {
        product_id: l.product_id,
        product_name: p?.name || "",
        product_code: p?.code || "",
        unit: p?.unit || "UN",
        quantity: r2(Number(l.quantity) || 0),
        unit_cost: r2(Number(l.unit_cost) || 0),
        value: lineValue(l),
      };
    });
    onConfirm({ parts: built, serviceExtraCost: r2(Number(extraCost) || 0) });
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h2 className="font-bold flex items-center gap-2"><Package className="w-5 h-5 text-amber-600" /> Peças Substituídas na Parada</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><span className="text-gray-500">✕</span></button>
        </div>
        <div className="p-4 space-y-3 text-sm">
          <div>
            <Label className="text-xs">Tipo de produto</Label>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="w-full h-9 rounded-md border border-input px-2 text-sm">
              {TYPE_FILTERS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <p className="text-[11px] text-gray-500 mt-1">O custo unitário vem do cadastro do produto — ajuste se necessário.</p>
          </div>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-100 text-gray-500">
                <tr>
                  <th className="p-2 text-left">Peça / Produto</th>
                  <th className="p-2 text-right">Quantidade</th>
                  <th className="p-2 text-right">Custo Unit.</th>
                  <th className="p-2 text-right">Valor</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-1.5">
                      <select value={l.product_id} onChange={e => pickProduct(i, e.target.value)} className="w-full h-8 rounded-md border border-input px-2 text-xs min-w-[180px]">
                        <option value="">Selecione...</option>
                        {filteredProducts.map(p => <option key={p.id} value={p.id}>{p.code ? `${p.code} — ` : ""}{p.name}</option>)}
                      </select>
                    </td>
                    <td className="p-1.5"><Input type="number" min="0" step="0.001" value={l.quantity} onChange={e => setLine(i, { quantity: e.target.value })} className="h-8 text-xs w-20" /></td>
                    <td className="p-1.5"><Input type="number" min="0" step="0.01" value={l.unit_cost} onChange={e => setLine(i, { unit_cost: e.target.value })} className="h-8 text-xs w-24" /></td>
                    <td className="p-1.5 text-right font-medium">{fmtMoney(lineValue(l))}</td>
                    <td className="p-1.5 text-right"><button onClick={() => setLines(prev => prev.filter((_, j) => j !== i))} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5 text-red-500" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button onClick={() => setLines(prev => [...prev, { product_id: "", quantity: "1", unit_cost: "" }])} className="flex items-center gap-1.5 px-3 py-2 text-xs text-indigo-600 hover:bg-indigo-50 w-full border-t">
              <Plus className="w-3.5 h-3.5" /> Adicionar peça
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Custo extra do serviço (R$)</Label><Input type="number" min="0" step="0.01" value={extraCost} onChange={e => setExtraCost(e.target.value)} placeholder="Mão de obra, serviços externos..." /></div>
            <div className="flex flex-col justify-end text-xs space-y-1">
              <div className="flex justify-between"><span>Peças substituídas</span><b>{fmtMoney(partsTotal)}</b></div>
              <div className="flex justify-between"><span>Custo extra do serviço</span><b>{fmtMoney(r2(Number(extraCost) || 0))}</b></div>
              <div className="flex justify-between border-t pt-1"><span>Custo extra total da parada</span><b className="text-red-600">{fmtMoney(r2(partsTotal + (Number(extraCost) || 0)))}</b></div>
            </div>
          </div>
        </div>
        <div className="p-4 border-t flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={confirm} className="bg-amber-600 hover:bg-amber-700">Confirmar Peças e Custo</Button>
        </div>
      </div>
    </div>
  );
}
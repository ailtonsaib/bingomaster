import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Plus, X, Printer, Trash2, Loader2, ClipboardList } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { genOrderNumber, fmtDate } from "@/lib/erpUtils";
import { DEFAULT_LABEL_SIZES, genProductionLot, labelQrPayload } from "@/lib/erpWmsLabels";

const OP_STATUS = {
  rascunho: "Rascunho",
  standby: "Aguardando Estoque",
  em_producao: "Em Produção",
};

// Etiquetas de produção por OP: informa a ordem de produção, mostra a quantidade
// prevista e gera as etiquetas conforme o fator pallet — as últimas podem ter a
// quantidade ajustada (a produção real pode diferir da prevista) e é possível
// adicionar etiquetas caso a produção aumente
export default function ErpWmsProductionLabelModal({ user, products, configs, onClose, onSaved }) {
  const [orders, setOrders] = useState([]);
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [opId, setOpId] = useState("");
  const [existing, setExisting] = useState([]); // etiquetas já geradas para a OP
  const [fabricacao, setFabricacao] = useState(new Date().toISOString().slice(0, 10));
  const [validade, setValidade] = useState("");
  const [labels, setLabels] = useState([]); // [{ qty }] — etiquetas a gerar
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(null); // etiquetas criadas → impressão

  useEffect(() => {
    (async () => {
      try {
        const [ops, lns] = await Promise.all([
          base44.entities.ErpProductionOrder.filter({ user_email: user.email }, "-created_date", 500),
          base44.entities.ErpProductionLine.filter({ user_email: user.email }, "name", 500),
        ]);
        setOrders(ops.filter(o => ["rascunho", "standby", "em_producao"].includes(o.status)));
        setLines(lns);
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, [user.email]);

  const op = orders.find(o => o.id === opId);
  const product = products?.find(p => p.id === op?.output_product_id);
  const line = lines.find(l => l.id === op?.production_line_id);
  const fator = Number(product?.fator_pallet) || 0;
  const previsto = Number(op?.output_quantity) || 0;
  const jaGeradoQty = existing.reduce((s, l) => s + (Number(l.quantity) || 0), 0);
  const total = labels.reduce((s, l) => s + (Number(l.qty) || 0), 0);
  const lote = genProductionLot(fabricacao, line);

  // Ao selecionar a OP: mostra o previsto e gera as etiquetas do saldo conforme o fator pallet
  const selectOp = async (id) => {
    setOpId(id);
    setLabels([]);
    setExisting([]);
    if (!id) return;
    const o = orders.find(x => x.id === id);
    let exOk = [];
    try {
      const ex = await base44.entities.ErpWmsLabel.filter(
        { user_email: user.email, label_type: "producao", op_number: o.order_number }, "-created_date", 500
      );
      exOk = ex.filter(l => l.status !== "cancelada");
      setExisting(exOk);
    } catch (e) { /* sem etiquetas anteriores */ }
    const p = products?.find(x => x.id === o?.output_product_id);
    const f = Number(p?.fator_pallet) || 0;
    const gerado = exOk.reduce((s, l) => s + (Number(l.quantity) || 0), 0);
    const saldo = Math.max((Number(o?.output_quantity) || 0) - gerado, 0);
    const arr = [];
    if (saldo > 0) {
      if (f > 0) {
        const n = Math.ceil(saldo / f);
        for (let i = 0; i < n; i++) arr.push({ qty: Math.round(Math.min(f, saldo - i * f) * 1000) / 1000 });
      } else arr.push({ qty: saldo });
    }
    setLabels(arr);
  };

  const addLabel = () => setLabels(prev => [...prev, { qty: fator > 0 ? fator : "" }]);
  const setQty = (i, v) => setLabels(prev => prev.map((l, idx) => idx === i ? { ...l, qty: v } : l));
  const removeLabel = (i) => setLabels(prev => prev.filter((_, idx) => idx !== i));

  const handleSave = async () => {
    if (!op) { alert("Selecione a ordem de produção."); return; }
    const qtys = labels.map(l => Number(l.qty) || 0);
    if (!qtys.length || qtys.some(q => !(q > 0))) { alert("Informe a quantidade de cada etiqueta."); return; }
    setSaving(true);
    try {
      const payloads = labels.map(l => {
        const qty = Number(l.qty) || 0;
        return {
          user_email: user.email,
          code: genOrderNumber("ETQ"),
          label_type: "producao",
          product_id: op.output_product_id,
          product_code: op.output_product_code || "",
          product_name: op.output_product_name,
          unit: product?.unit || "",
          quantity: qty,
          remaining: qty,
          lot: lote,
          fabricacao_date: fabricacao,
          expiry_date: validade || "",
          op_number: op.order_number,
          status: "ativa",
        };
      });
      const res = await base44.entities.ErpWmsLabel.bulkCreate(payloads);
      const list = Array.isArray(res) && res.length ? res : payloads;
      setCreated(list.map(l => ({ ...l, _origQty: Number(l.quantity) || 0 })));
      onSaved?.();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  // --- Impressão: etiquetas criadas, no tamanho pré-definido do modelo ---
  if (created) {
    const w = Number(configs?.producao?.width_mm) || DEFAULT_LABEL_SIZES.producao.width_mm;
    const h = Number(configs?.producao?.height_mm) || DEFAULT_LABEL_SIZES.producao.height_mm;
    const qrSize = Math.max(48, Math.round(Math.min(w, h) * 3.78 * 0.62));
    // Cada impressão soma 1 ao contador de impressões das etiquetas geradas
    const handlePrint = async () => {
      document.body.classList.add("printing-label");
      window.print();
      setTimeout(() => document.body.classList.remove("printing-label"), 500);
      try {
        const withId = (created || []).filter(l => l.id);
        await base44.entities.ErpWmsLabel.bulkUpdate(withId.map(l => ({ id: l.id, print_count: (Number(l.print_count) || 0) + 1 })));
        setCreated(prev => prev.map(l => ({ ...l, print_count: (Number(l.print_count) || 0) + 1 })));
      } catch (e) { console.error(e); }
    };

    // Grava a quantidade ajustada na etiqueta (e no saldo, enquanto não consumida)
    const persistQty = async (i) => {
      const l = created[i];
      if (!l?.id) return;
      const newQty = Number(l.quantity) || 0;
      if (newQty === (Number(l._origQty) || 0)) return;
      try {
        const data = { quantity: newQty };
        if (Number(l.remaining) === Number(l._origQty)) data.remaining = newQty;
        await base44.entities.ErpWmsLabel.update(l.id, data);
        setCreated(prev => prev.map((x, idx) => idx === i ? { ...x, _origQty: newQty } : x));
      } catch (e) { console.error(e); }
    };
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10 no-print">
            <h2 className="font-bold">Etiquetas Geradas — OP {op?.order_number}</h2>
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded text-gray-500"><X className="w-4 h-4" /></button>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-2 no-print">
              <p className="text-xs text-gray-500 flex-1">{created.length} etiqueta(s) — {created.reduce((s, l) => s + (Number(l.quantity) || 0), 0)} {product?.unit || ""} no total.</p>
              <Button size="sm" onClick={handlePrint} className="gap-1.5 bg-indigo-600 hover:bg-indigo-700"><Printer className="w-4 h-4" /> Imprimir</Button>
            </div>
            <div className="border rounded-lg divide-y no-print max-h-48 overflow-y-auto">
              <p className="p-2 text-[11px] text-gray-400">Altere a quantidade antes de imprimir — o valor ajustado fica gravado na etiqueta.</p>
              {created.map((l, i) => (
                <div key={l.id || i} className="flex items-center gap-2 p-2 text-sm">
                  <span className="font-mono text-xs text-gray-500 flex-1 truncate">{l.code}</span>
                  <span className="text-xs text-gray-500">Qtd.:</span>
                  <input type="number" min="0" step="0.001" value={l.quantity}
                    onChange={e => setCreated(prev => prev.map((x, idx) => idx === i ? { ...x, quantity: e.target.value } : x))}
                    onBlur={() => persistQty(i)}
                    className="w-24 h-8 rounded-md border border-input px-2 text-sm text-right" />
                  <span className="text-xs text-gray-400 w-8">{l.unit || ""}</span>
                </div>
              ))}
            </div>
            <div id="label-print-area" className="space-y-2">
              {created.map(l => (
                <div key={l.id || l.code} className="wms-label border-2 border-black rounded-lg p-2 flex gap-2 items-center bg-white overflow-hidden" style={{ width: `${w}mm`, height: `${h}mm`, boxSizing: "border-box" }}>
                  <div className="flex-1 text-[10px] leading-snug">
                    <p className="font-bold text-sm leading-tight">{l.product_name}</p>
                    <p>Cód.: {l.product_code || "—"}</p>
                    <p>Qtd.: <b className="text-sm">{l.quantity} {l.unit || ""}</b></p>
                    <p>OP: <b>{l.op_number || "—"}</b></p>
                    <p>Fabricação: <b>{l.fabricacao_date ? fmtDate(l.fabricacao_date) : "—"}</b></p>
                    <p>Lote: <b className="text-xs">{l.lot || "—"}</b></p>
                    <p>Validade: <b className="text-sm">{l.expiry_date ? fmtDate(l.expiry_date) : "—"}</b></p>
                    <p className="font-mono text-[9px] mt-1">{l.code}</p>
                  </div>
                  <QRCodeCanvas value={labelQrPayload(l)} size={qrSize} level="M" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- Formulário: OP → etiquetas conforme fator pallet ---
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
          <h2 className="font-bold flex items-center gap-2"><ClipboardList className="w-5 h-5 text-indigo-600" /> Etiquetas de Produção (por OP)</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded text-gray-500"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-600">Ordem de Produção *</label>
            <select value={opId} onChange={e => selectOp(e.target.value)} className="w-full h-9 rounded-md border border-input bg-white px-3 text-sm mt-1">
              <option value="">{loading ? "Carregando OPs..." : "Selecione..."}</option>
              {orders.map(o => (
                <option key={o.id} value={o.id}>
                  {o.order_number} — {o.output_product_name} ({OP_STATUS[o.status] || o.status})
                </option>
              ))}
            </select>
          </div>

          {op && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-indigo-50 border border-indigo-100 rounded-lg p-3 text-sm">
                <div><p className="text-[10px] text-gray-500 uppercase">Produto</p><p className="font-medium">{op.output_product_name}</p></div>
                <div><p className="text-[10px] text-gray-500 uppercase">Linha</p><p className="font-medium">{op.production_line_name || "—"}</p></div>
                <div><p className="text-[10px] text-gray-500 uppercase">Previsto</p><p className="font-bold text-indigo-700">{previsto} {product?.unit || ""}</p></div>
                <div><p className="text-[10px] text-gray-500 uppercase">Fator Pallet</p><p className="font-medium">{fator > 0 ? `${fator} ${product?.unit || ""}` : "—"}</p></div>
                {existing.length > 0 && (
                  <div className="col-span-2"><p className="text-[10px] text-gray-500 uppercase">Já Gerado nesta OP</p><p className="font-medium">{existing.length} etiqueta(s) — {jaGeradoQty} {product?.unit || ""}</p></div>
                )}
                <div className="col-span-2"><p className="text-[10px] text-gray-500 uppercase">Lote</p><p className="font-mono text-xs">{lote}</p></div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Fabricação</label>
                  <input type="date" value={fabricacao} onChange={e => setFabricacao(e.target.value)} className="w-full h-9 rounded-md border border-input bg-white px-3 text-sm mt-1" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Validade</label>
                  <input type="date" value={validade} onChange={e => setValidade(e.target.value)} className="w-full h-9 rounded-md border border-input bg-white px-3 text-sm mt-1" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-gray-600">Etiquetas a gerar (conforme o fator pallet)</label>
                  <button onClick={addLabel} className="text-xs text-indigo-600 hover:underline flex items-center gap-1"><Plus className="w-3 h-3" /> Adicionar etiqueta</button>
                </div>
                <div className="border rounded-lg divide-y max-h-56 overflow-y-auto">
                  {labels.length === 0 && (
                    <p className="p-3 text-center text-xs text-gray-400">
                      {jaGeradoQty >= previsto ? "Quantidade prevista já etiquetada — use \"Adicionar etiqueta\" para gerar extras." : "Nenhuma etiqueta — selecione a OP ou adicione manualmente."}
                    </p>
                  )}
                  {labels.map((l, i) => (
                    <div key={i} className="flex items-center gap-2 p-2">
                      <span className="text-xs text-gray-500 w-24">Etiqueta {i + 1}</span>
                      <input type="number" min="0" step="0.001" value={l.qty} onChange={e => setQty(i, e.target.value)} className="w-28 h-8 rounded-md border border-input px-2 text-sm" />
                      <span className="text-xs text-gray-400">{product?.unit || ""}</span>
                      <span className="flex-1 text-[10px] text-gray-400">
                        {i === labels.length - 1 && labels.length > 1 ? "Última etiqueta — ajuste conforme a produção real" : `Pallet completo (${fator || "—"})`}
                      </span>
                      <button onClick={() => removeLabel(i)} title="Remover etiqueta" className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
                    </div>
                  ))}
                </div>
                <p className={`text-xs mt-1 ${total === previsto ? "text-emerald-600" : "text-amber-600"}`}>
                  Total das etiquetas: {total} {product?.unit || ""} — previsto na OP: {previsto}
                  {total !== previsto && " (quantidade ajustável conforme a produção real)"}
                </p>
              </div>
            </>
          )}
        </div>
        <div className="p-4 border-t flex gap-2 justify-end sticky bottom-0 bg-white">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handleSave} disabled={saving || !op} className="bg-indigo-600 hover:bg-indigo-700">
            {saving ? "Gerando..." : "Gerar e Imprimir Etiquetas"}
          </Button>
        </div>
      </div>
    </div>
  );
}
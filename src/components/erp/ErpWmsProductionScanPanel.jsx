import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { ScanLine, Loader2, CheckCircle2, AlertTriangle, Trash2, Factory } from "lucide-react";
import { fmtDate } from "@/lib/erpUtils";
import { parseLabelScan } from "./ErpWmsLabelPanel";

const r3 = (v) => Math.round((Number(v) || 0) * 1000) / 1000;

// Bipagem de Produção (chão de fábrica): o operador bipa as etiquetas de
// produção do produto acabado da OP e o sistema alimenta o estoque — a
// quantidade bipada é comparada com o apontamento no encerramento da OP
// (divergência impede a conclusão da ordem de produção).
export default function ErpWmsProductionScanPanel({ user }) {
  const [orders, setOrders] = useState([]);
  const [labels, setLabels] = useState([]);
  const [moves, setMoves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [orderId, setOrderId] = useState("");
  const [scan, setScan] = useState("");
  const [pending, setPending] = useState([]);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [ops, ls, mv] = await Promise.all([
        base44.entities.ErpProductionOrder.filter({ user_email: user.email }, "-created_date", 500),
        base44.entities.ErpWmsLabel.filter({ user_email: user.email, label_type: "producao", status: "ativa" }, "-created_date", 500),
        base44.entities.ErpWmsMove.filter({ user_email: user.email }, "-created_date", 500),
      ]);
      setOrders(ops.filter(o => o.status === "em_producao"));
      setLabels(ls.filter(l => !l.stocked));
      setMoves(mv);
    } catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [user.email]);

  const order = orders.find(o => o.id === orderId);
  const docTag = order ? `OP ${order.order_number}` : "";
  // Total já bipado e entrado no estoque para esta OP
  const bipedTotal = order ? r3(moves
    .filter(m => m.move_type === "entrada" && m.document === docTag && m.product_id === order.output_product_id)
    .reduce((s, m) => s + (Number(m.quantity) || 0), 0)) : 0;
  const pendingQty = r3(pending.reduce((s, l) => s + (Number(l.quantity) || 0), 0));

  const flash = (type, text) => setMsg({ type, text });

  const handleScan = (raw) => {
    if (!order) { flash("error", "Selecione a ordem de produção."); return; }
    const parsed = parseLabelScan(raw);
    const label = parsed ? labels.find(l => l.id === parsed.id || (parsed.code && l.code === parsed.code)) : null;
    if (!parsed || !label) { flash("error", "Etiqueta não encontrada — bipie uma etiqueta de produção ativa."); return; }
    if (label.product_id !== order.output_product_id) { flash("error", `Etiqueta ${label.code} é de outro produto (${label.product_name}) — não pertence a esta OP.`); return; }
    if (label.op_number && label.op_number !== order.order_number) { flash("error", `Etiqueta ${label.code} pertence à OP ${label.op_number}.`); return; }
    if (pending.some(p => p.id === label.id)) { flash("error", `Etiqueta ${label.code} já bipada nesta sessão.`); return; }
    setPending(p => [...p, label]);
    setScan("");
    flash("ok", `${label.code} — lote ${label.lot || "—"} — ${label.quantity} ${label.unit || ""} bipado(s).`);
  };

  // Entrada no estoque: alimenta o saldo do produto acabado e registra a
  // movimentação física com lote/validade — a OP é encerrada pelo apontamento,
  // que valida a quantidade bipada contra a informada
  const confirmEntry = async () => {
    if (!pending.length) return;
    if (!confirm(`Dar entrada no estoque de ${pendingQty} ${order.output_product_name}?`)) return;
    setBusy(true);
    try {
      for (const l of pending) {
        const p = await base44.entities.ErpProduct.get(l.product_id);
        await base44.entities.ErpProduct.update(l.product_id, { stock: r3((Number(p.stock) || 0) + (Number(l.quantity) || 0)) });
      }
      await base44.entities.ErpWmsMove.bulkCreate(pending.map(l => ({
        user_email: user.email,
        move_type: "entrada",
        product_id: l.product_id,
        product_code: l.product_code || "",
        product_name: l.product_name || "",
        unit: l.unit || "",
        quantity: Number(l.quantity) || 0,
        lot: l.lot || "",
        expiry_date: l.expiry_date || "",
        document: docTag,
        operator_name: user.name || user.email,
        move_date: new Date().toISOString(),
        notes: `Entrada de produção por bipagem — etiqueta ${l.code}`,
      })));
      await base44.entities.ErpWmsLabel.bulkUpdate(pending.map(l => ({ id: l.id, stocked: true })));
      setPending([]);
      await load();
      flash("ok", "Entrada no estoque registrada — o saldo do produto acabado foi atualizado.");
    } catch (e) { alert("Erro ao dar entrada no estoque: " + e.message); }
    setBusy(false);
  };

  return (
    <div className="space-y-3">
      <h2 className="font-semibold text-base flex items-center gap-2"><Factory className="w-5 h-5 text-indigo-600" /> Bipagem de Produção (Entrada no Estoque)</h2>
      <p className="text-xs text-gray-500 -mt-1">O chão de fábrica bipa as etiquetas de produção do produto acabado e o sistema alimenta o estoque com lote e validade. No encerramento da OP, a quantidade bipada é comparada com a quantidade do apontamento — havendo divergência, a ordem de produção não pode ser concluída.</p>

      {loading ? (
        <div className="p-6 text-center text-gray-400 flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Carregando...</div>
      ) : (
        <>
          <div className="flex gap-2 flex-wrap">
            <select value={orderId} onChange={e => { setOrderId(e.target.value); setPending([]); setMsg(null); }} className="flex-1 min-w-[280px] h-9 rounded-md border border-input bg-white px-3 text-sm">
              <option value="">Selecione a ordem de produção em andamento...</option>
              {orders.map(o => <option key={o.id} value={o.id}>{o.order_number} — {o.output_product_name} ({o.status})</option>)}
            </select>
          </div>

          {order && (
            <>
              <div className="bg-white rounded-xl border p-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                <div><p className="text-xs text-gray-500">Produto acabado</p><p className="font-medium">{order.output_product_name}</p></div>
                <div><p className="text-xs text-gray-500">Qtd planejada</p><p className="font-medium">{order.output_quantity}</p></div>
                <div><p className="text-xs text-gray-500">Já bipado (estoque)</p><p className="font-bold text-emerald-700">{bipedTotal}</p></div>
                <div><p className="text-xs text-gray-500">Pendente nesta sessão</p><p className="font-bold text-indigo-700">{pendingQty}</p></div>
              </div>

              <div className="flex gap-2">
                <input
                  value={scan}
                  onChange={e => setScan(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); if (scan.trim()) handleScan(scan); } }}
                  placeholder="Bipe a etiqueta de produção (QR code) e pressione Enter..."
                  className="flex-1 h-10 rounded-md border border-input px-3 text-sm font-mono"
                />
                <Button size="sm" onClick={() => scan.trim() && handleScan(scan)} className="gap-1.5 bg-indigo-600 hover:bg-indigo-700"><ScanLine className="w-4 h-4" /> Bipar</Button>
              </div>

              {msg && (
                <div className={`flex items-center gap-2 text-sm rounded-lg p-2.5 border ${msg.type === "ok" ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-red-50 border-red-200 text-red-700"}`}>
                  {msg.type === "ok" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />} {msg.text}
                </div>
              )}

              {pending.length > 0 && (
                <div className="bg-white rounded-xl border divide-y">
                  {pending.map(l => (
                    <div key={l.id} className="flex items-center justify-between gap-2 p-2.5 text-sm">
                      <div>
                        <p className="font-mono text-xs">{l.code}</p>
                        <p className="text-xs text-gray-500">Lote {l.lot || "—"} — fabricação {l.fabricacao_date ? fmtDate(l.fabricacao_date) : "—"} — validade {l.expiry_date ? fmtDate(l.expiry_date) : "—"}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <b>{l.quantity} {l.unit || ""}</b>
                        <button onClick={() => setPending(p => p.filter(x => x.id !== l.id))} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between p-2.5 bg-gray-50">
                    <p className="text-xs text-gray-500">Total a entrar: <b>{pendingQty}</b></p>
                    <Button size="sm" onClick={confirmEntry} disabled={busy} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
                      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Dar Entrada no Estoque
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
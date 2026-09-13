import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { ScanLine, AlertTriangle, CheckCircle2, Loader2, X, PackageMinus } from "lucide-react";
import { fmtDate } from "@/lib/erpUtils";
import { parseLabelScan } from "./ErpWmsLabelPanel";

const r3 = (v) => Math.round((Number(v) || 0) * 1000) / 1000;

// Atendimento de requisição por bipagem de etiquetas com validação FIFO:
// ao bipar uma etiqueta fora da ordem de validade (FEFO), o operador recebe um
// alerta visual — se confirmar, a inconsistência é registrada no dashboard;
// se recusar, o sistema mostra qual etiqueta deve ser bipada.
export default function ErpWmsFifoAttendant({ req, onClose, onSaved }) {
  const [labels, setLabels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scan, setScan] = useState("");
  const [msg, setMsg] = useState(null); // { type: "ok"|"error", text }
  const [fifoAlert, setFifoAlert] = useState(null); // { label, expected, qty }
  const [hint, setHint] = useState(null); // etiqueta que deve ser bipada
  const [busy, setBusy] = useState(false);
  const [allocations, setAllocations] = useState(() =>
    (req.items || []).map(it => ({ item: it, entries: [], manual: 0 }))
  );

  useEffect(() => {
    base44.entities.ErpWmsLabel.filter({ user_email: req.user_email }, "-created_date", 500)
      .then(list => setLabels(list.filter(l => l.status === "ativa")))
      .catch(() => setLabels([]))
      .finally(() => setLoading(false));
  }, [req.user_email]);

  const doneOf = (a) => a.entries.reduce((s, e) => s + e.qty, 0) + (Number(a.manual) || 0);
  const allComplete = allocations.every(a => doneOf(a) >= Number(a.item.quantity));

  // Etiqueta esperada pelo FIFO: menor validade com saldo entre as ativas do produto
  const expectedLabelFor = (productId) => {
    const pool = labels.filter(l => l.status === "ativa" && l.product_id === productId && (Number(l.remaining ?? l.quantity) || 0) > 0);
    const withVal = pool.filter(l => l.expiry_date).sort((a, b) => String(a.expiry_date).localeCompare(String(b.expiry_date)));
    return withVal[0] || pool[0] || null;
  };

  const flash = (type, text) => setMsg({ type, text });

  const commitAllocation = (label, qty) => {
    setAllocations(prev => prev.map(a =>
      a.item.product_id === label.product_id ? { ...a, entries: [...a.entries, { label, qty }] } : a
    ));
    setLabels(prev => prev.map(l => l.id === label.id
      ? { ...l, remaining: r3((Number(l.remaining ?? l.quantity) || 0) - qty) } : l));
    setScan("");
  };

  const recordDeviation = async (data) => {
    try {
      await base44.entities.ErpWmsDeviation.create({ user_email: req.user_email, date: new Date().toISOString(), ...data });
    } catch (e) { console.error(e); }
  };

  const handleScan = async (raw) => {
    const parsed = parseLabelScan(raw);
    if (!parsed) { flash("error", "Etiqueta não identificada — bipie novamente."); return; }
    const label = labels.find(l => l.id === parsed.id || (parsed.code && l.code === parsed.code));
    if (!label) { flash("error", "Etiqueta não encontrada ou cancelada."); return; }
    const alloc = allocations.find(a => a.item.product_id === label.product_id);
    if (!alloc) {
      await recordDeviation({
        type: "produto_invalido", requisition_number: req.number,
        product_code: label.product_code, product_name: label.product_name,
        used_label_code: label.code, used_lot: label.lot, used_expiry: label.expiry_date,
        operator_name: req.user_email,
        notes: "Tentativa de bipar etiqueta de produto fora da requisição",
      });
      flash("error", `"${label.product_name}" não pertence aos itens desta requisição — inconsistência registrada.`);
      setScan("");
      return;
    }
    const remainingNeeded = r3(Number(alloc.item.quantity) - doneOf(alloc));
    if (remainingNeeded <= 0) { flash("error", "Este item já está completo."); setScan(""); return; }
    const labelRem = Number(label.remaining ?? label.quantity) || 0;
    if (labelRem <= 0) { flash("error", `Etiqueta ${label.code} sem saldo.`); return; }
    const qty = Math.min(labelRem, remainingNeeded);

    // FIFO/FEFO: a etiqueta bipada deve ser a de menor validade com saldo
    const expected = expectedLabelFor(label.product_id);
    if (expected && expected.id !== label.id) {
      setFifoAlert({ label, expected, qty });
      return;
    }
    commitAllocation(label, qty);
    flash("ok", `${label.code} — ${label.product_name}: ${qty} ${label.unit || ""} alocado(s).`);
  };

  // Operador confirmou atender fora do FIFO — registra a inconsistência e segue
  const confirmFifo = async () => {
    const { label, expected, qty } = fifoAlert;
    await recordDeviation({
      type: "fifo", requisition_number: req.number,
      product_code: label.product_code, product_name: label.product_name,
      expected_label_code: expected?.code || "", expected_lot: expected?.lot || "", expected_expiry: expected?.expiry_date || "",
      used_label_code: label.code, used_lot: label.lot, used_expiry: label.expiry_date,
      operator_name: req.user_email,
      notes: "Atendimento fora da ordem de validade (FIFO) confirmado pelo operador",
    });
    commitAllocation(label, qty);
    setFifoAlert(null);
    flash("ok", `${label.code} alocado fora do FIFO — inconsistência registrada no dashboard.`);
  };

  // Operador recusou — limpa a bipagem e mostra qual etiqueta deve ser bipada
  const rejectFifo = () => {
    const { expected } = fifoAlert;
    setFifoAlert(null);
    setScan("");
    setHint(expected);
    flash("error", `Bipe a etiqueta ${expected?.code || ""} — lote ${expected?.lot || "—"} — validade ${expected?.expiry_date ? fmtDate(expected.expiry_date) : "—"}.`);
  };

  const manualAllocate = (a) => {
    const remainingNeeded = r3(Number(a.item.quantity) - doneOf(a));
    const v = prompt(`Quantidade de ${a.item.product_name} sem etiqueta (máx. ${remainingNeeded} ${a.item.unit || ""}):`);
    const q = r3(Number(v) || 0);
    if (!v || q <= 0) return;
    if (q > remainingNeeded) { alert(`Quantidade maior que o pendente (${remainingNeeded}).`); return; }
    setAllocations(prev => prev.map(x => x === a ? { ...x, manual: r3((Number(x.manual) || 0) + q) } : x));
    flash("ok", `${q} ${a.item.unit || ""} de ${a.item.product_name} lançado(s) sem etiqueta.`);
  };

  const confirmAttendance = async () => {
    if (!confirm(`Confirmar o atendimento da requisição ${req.number}?\nOs itens serão baixados do estoque e as etiquetas consumidas.`)) return;
    setBusy(true);
    try {
      for (const a of allocations) {
        const total = r3(doneOf(a));
        if (total <= 0) continue;
        // baixa o saldo do produto
        if (a.item.product_id) {
          const p = await base44.entities.ErpProduct.get(a.item.product_id);
          await base44.entities.ErpProduct.update(a.item.product_id, {
            stock: Math.round((((Number(p.stock) || 0) - total) + Number.EPSILON) * 1000) / 1000,
          });
        }
        // movimentações de saída — uma por etiqueta (com lote/validade) + avulsa
        const moves = a.entries.map(e => ({
          user_email: req.user_email,
          move_type: "saida",
          product_id: a.item.product_id || "",
          product_code: a.item.product_code || e.label.product_code || "",
          product_name: a.item.product_name || e.label.product_name || "",
          unit: a.item.unit || e.label.unit || "",
          quantity: e.qty,
          lot: e.label.lot || "",
          expiry_date: e.label.expiry_date || "",
          document: `Requisição ${req.number}`,
          operator_name: req.user_email,
          move_date: new Date().toISOString(),
          notes: `Saída por requisição (etiqueta ${e.label.code})${req.production_order_number ? ` — OP ${req.production_order_number}` : ""}`,
        }));
        if ((Number(a.manual) || 0) > 0) {
          moves.push({
            user_email: req.user_email,
            move_type: "saida",
            product_id: a.item.product_id || "",
            product_code: a.item.product_code || "",
            product_name: a.item.product_name || "",
            unit: a.item.unit || "",
            quantity: Number(a.manual) || 0,
            document: `Requisição ${req.number}`,
            operator_name: req.user_email,
            move_date: new Date().toISOString(),
            notes: `Saída por requisição (sem etiqueta)${req.production_order_number ? ` — OP ${req.production_order_number}` : ""}`,
          });
        }
        if (moves.length) await base44.entities.ErpWmsMove.bulkCreate(moves);
        // consome o saldo das etiquetas bipadas
        const upd = a.entries.map(e => ({
          id: e.label.id,
          remaining: r3((Number(e.label.remaining ?? e.label.quantity) || 0) - e.qty),
        }));
        if (upd.length) await base44.entities.ErpWmsLabel.bulkUpdate(upd);
      }
      await base44.entities.ErpWarehouseRequisition.update(req.id, { status: "atendida" });
      onSaved();
    } catch (e) { alert("Erro ao confirmar atendimento: " + e.message); }
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
          <h2 className="font-bold flex items-center gap-2"><ScanLine className="w-5 h-5 text-indigo-600" /> Atendimento por Etiquetas — {req.number}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded text-gray-500"><X className="w-4 h-4" /></button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-400 flex items-center justify-center gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Carregando etiquetas...</div>
        ) : (
          <div className="p-4 space-y-3">
            <div className="flex gap-2">
              <input
                autoFocus
                value={scan}
                onChange={e => setScan(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); if (scan.trim()) handleScan(scan); } }}
                placeholder="Bipe a etiqueta do produto (QR code) e pressione Enter..."
                className="flex-1 h-10 rounded-md border border-input px-3 text-sm font-mono"
              />
              <Button size="sm" onClick={() => scan.trim() && handleScan(scan)} className="gap-1.5 bg-indigo-600 hover:bg-indigo-700"><ScanLine className="w-4 h-4" /> Bipar</Button>
            </div>

            {msg && (
              <div className={`flex items-center gap-2 text-sm rounded-lg p-2.5 border ${msg.type === "ok" ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-red-50 border-red-200 text-red-700"}`}>
                {msg.type === "ok" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />} {msg.text}
              </div>
            )}

            {/* Alerta FIFO: existe produto com validade inferior — deseja continuar? */}
            {fifoAlert && (
              <div className="bg-amber-50 border-2 border-amber-400 rounded-lg p-3 space-y-2">
                <p className="text-sm text-amber-800 font-medium flex items-center gap-2"><AlertTriangle className="w-5 h-5" /> Fora do FIFO — existe produto com validade inferior</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-white rounded-md border p-2">
                    <p className="text-gray-500 font-medium">Deve ser bipada (menor validade):</p>
                    <p className="font-mono">{fifoAlert.expected?.code || "—"}</p>
                    <p>Lote: <b>{fifoAlert.expected?.lot || "—"}</b></p>
                    <p>Validade: <b>{fifoAlert.expected?.expiry_date ? fmtDate(fifoAlert.expected.expiry_date) : "—"}</b></p>
                  </div>
                  <div className="bg-white rounded-md border p-2">
                    <p className="text-gray-500 font-medium">Etiqueta bipada:</p>
                    <p className="font-mono">{fifoAlert.label.code}</p>
                    <p>Lote: <b>{fifoAlert.label.lot || "—"}</b></p>
                    <p>Validade: <b>{fifoAlert.label.expiry_date ? fmtDate(fifoAlert.label.expiry_date) : "—"}</b></p>
                  </div>
                </div>
                <p className="text-xs text-amber-800">Deseja continuar com a etiqueta bipada? A inconsistência será registrada no dashboard.</p>
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="outline" onClick={rejectFifo}>Não — mostrar etiqueta correta</Button>
                  <Button size="sm" className="bg-amber-600 hover:bg-amber-700" onClick={confirmFifo}>Sim, continuar</Button>
                </div>
              </div>
            )}

            {/* Orientação após recusar: qual etiqueta deve ser bipada */}
            {hint && !fifoAlert && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-2.5 text-xs text-indigo-800">
                Bipe a etiqueta: <b className="font-mono">{hint.code || "—"}</b> — lote <b>{hint.lot || "—"}</b> — validade <b>{hint.expiry_date ? fmtDate(hint.expiry_date) : "—"}</b>
              </div>
            )}

            <div className="space-y-2">
              {allocations.map((a, i) => {
                const needed = Number(a.item.quantity) || 0;
                const done = doneOf(a);
                const pct = needed > 0 ? Math.min(100, (done / needed) * 100) : 100;
                const expected = expectedLabelFor(a.item.product_id);
                const hasLabels = labels.some(l => l.product_id === a.item.product_id);
                return (
                  <div key={i} className={`border rounded-lg p-2.5 space-y-2 ${done >= needed ? "bg-emerald-50/50 border-emerald-200" : "bg-white"}`}>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="text-sm font-medium">{a.item.product_name}</p>
                      <p className="text-xs">
                        {done >= needed
                          ? <span className="text-emerald-700 font-medium flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Completo</span>
                          : <span className="text-gray-500">Separado: <b>{done}</b> de <b>{needed}</b> {a.item.unit || ""}</span>}
                      </p>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded"><div className={`h-1.5 rounded ${done >= needed ? "bg-emerald-500" : "bg-indigo-500"}`} style={{ width: `${pct}%` }}></div></div>
                    {a.entries.length > 0 && (
                      <div className="text-xs text-gray-600 space-y-0.5">
                        {a.entries.map((e, j) => (
                          <p key={j} className="font-mono">{e.label.code} — lote {e.label.lot || "—"} — val. {e.label.expiry_date ? fmtDate(e.label.expiry_date) : "—"} — {e.qty} {a.item.unit || ""}</p>
                        ))}
                      </div>
                    )}
                    {(Number(a.manual) || 0) > 0 && <p className="text-xs text-gray-500">Sem etiqueta: {a.manual} {a.item.unit || ""}</p>}
                    {done < needed && (
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        {expected ? (
                          <p className="text-[11px] text-gray-400">FIFO — bipe primeiro: <b className="font-mono">{expected.code}</b> (lote {expected.lot || "—"}, val. {expected.expiry_date ? fmtDate(expected.expiry_date) : "—"})</p>
                        ) : !hasLabels ? (
                          <p className="text-[11px] text-gray-400">Produto sem etiquetas ativas.</p>
                        ) : <span></span>}
                        {!hasLabels && (
                          <button onClick={() => manualAllocate(a)} className="text-[11px] text-indigo-600 hover:underline flex items-center gap-1"><PackageMinus className="w-3 h-3" /> Lançar sem etiqueta</button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex gap-2 justify-end pt-2 border-t">
              <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>Fechar</Button>
              <Button size="sm" disabled={busy || !allComplete} onClick={confirmAttendance} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Confirmar Atendimento
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
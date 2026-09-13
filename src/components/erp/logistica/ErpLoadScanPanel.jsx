import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { ScanLine, AlertTriangle, CheckCircle2, Loader2, PackageMinus, Truck } from "lucide-react";
import { fmtDate } from "@/lib/erpUtils";
import { parseLabelScan } from "@/components/erp/ErpWmsLabelPanel";

const r3 = (v) => Math.round((Number(v) || 0) * 1000) / 1000;

// Bipagem de Separação para Carregamento (Logística): o operador bipe as
// etiquetas dos produtos da carga respeitando o FIFO/FEFO — se bipar um lote
// fora da ordem de validade, o sistema pergunta se deseja continuar: se sim,
// segue normalmente; se não, zera a bipagem e o operador bipe novamente.
export default function ErpLoadScanPanel({ user }) {
  const [cargas, setCargas] = useState([]);
  const [labels, setLabels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cargaId, setCargaId] = useState("");
  const [scan, setScan] = useState("");
  const [msg, setMsg] = useState(null);
  const [fifoAlert, setFifoAlert] = useState(null); // { label, expected, qty }
  const [hint, setHint] = useState(null);
  const [busy, setBusy] = useState(false);
  const [allocations, setAllocations] = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const [cs, ls] = await Promise.all([
        base44.entities.ErpLoadAssembly.filter({ user_email: user.email }, "-created_date", 500),
        base44.entities.ErpWmsLabel.filter({ user_email: user.email }, "-created_date", 500),
      ]);
      setCargas(cs.filter(c => c.status === "montada"));
      setLabels(ls.filter(l => l.status === "ativa"));
    } catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [user.email]);

  const carga = cargas.find(c => c.id === cargaId);

  const selectCarga = (id) => {
    const c = cargas.find(x => x.id === id);
    setCargaId(id);
    setAllocations((c?.items || []).filter(i => i.product_id).map(item => ({ item, entries: [], manual: 0 })));
    setScan(""); setMsg(null); setFifoAlert(null); setHint(null);
  };

  const doneOf = (a) => a.entries.reduce((s, e) => s + e.qty, 0) + (Number(a.manual) || 0);
  const allComplete = allocations.length > 0 && allocations.every(a => doneOf(a) >= Number(a.item.quantity));

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

  const handleScan = (raw) => {
    const parsed = parseLabelScan(raw);
    if (!parsed) { flash("error", "Etiqueta não identificada — bipie novamente."); return; }
    const label = labels.find(l => l.id === parsed.id || (parsed.code && l.code === parsed.code));
    if (!label) { flash("error", "Etiqueta não encontrada ou cancelada."); return; }
    const alloc = allocations.find(a => a.item.product_id === label.product_id);
    if (!alloc) { flash("error", `"${label.product_name}" não pertence aos produtos desta carga.`); setScan(""); return; }
    const remainingNeeded = r3(Number(alloc.item.quantity) - doneOf(alloc));
    if (remainingNeeded <= 0) { flash("error", "Este produto já está completo para a carga."); setScan(""); return; }
    const labelRem = Number(label.remaining ?? label.quantity) || 0;
    if (labelRem <= 0) { flash("error", `Etiqueta ${label.code} sem saldo.`); setScan(""); return; }
    const qty = Math.min(labelRem, remainingNeeded);

    // FIFO/FEFO: se bipar um lote fora da ordem de validade, perguntar se deseja continuar
    const expected = expectedLabelFor(label.product_id);
    if (expected && expected.id !== label.id) {
      setFifoAlert({ label, expected, qty });
      setScan("");
      return;
    }
    commitAllocation(label, qty);
    flash("ok", `${label.code} — ${label.product_name}: ${qty} ${label.unit || ""} separado(s).`);
  };

  // Operador confirmou: continua normalmente com a etiqueta bipada
  const confirmFifo = () => {
    const { label, qty } = fifoAlert;
    commitAllocation(label, qty);
    setFifoAlert(null);
    flash("ok", `${label.code} — ${qty} ${label.unit || ""} separado(s) fora do FIFO, continuando normalmente.`);
  };

  // Operador recusou: zera a bipagem e orienta bipe novamente a etiqueta correta
  const rejectFifo = () => {
    const { expected } = fifoAlert;
    setFifoAlert(null);
    setScan("");
    setHint(expected);
    flash("error", `Bipagem zerada — bipe novamente a etiqueta ${expected?.code || ""} (lote ${expected?.lot || "—"}, validade ${expected?.expiry_date ? fmtDate(expected.expiry_date) : "—"}).`);
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

  // Confirma o carregamento: baixa o estoque, registra as saídas com lote/validade
  // e consome o saldo das etiquetas — a carga passa para "carregada"
  const confirmLoad = async () => {
    if (!confirm(`Confirmar o carregamento da carga ${carga.number}?\nOs produtos serão baixados do estoque e as etiquetas consumidas.`)) return;
    setBusy(true);
    try {
      for (const a of allocations) {
        const total = r3(doneOf(a));
        if (total <= 0) continue;
        if (a.item.product_id) {
          const p = await base44.entities.ErpProduct.get(a.item.product_id);
          await base44.entities.ErpProduct.update(a.item.product_id, {
            stock: Math.round((((Number(p.stock) || 0) - total) + Number.EPSILON) * 1000) / 1000,
          });
        }
        const moves = a.entries.map(e => ({
          user_email: user.email,
          move_type: "saida",
          product_id: a.item.product_id || "",
          product_code: a.item.product_code || e.label.product_code || "",
          product_name: a.item.product_name || e.label.product_name || "",
          unit: a.item.unit || e.label.unit || "",
          quantity: e.qty,
          lot: e.label.lot || "",
          expiry_date: e.label.expiry_date || "",
          document: `Carga ${carga.number}`,
          move_date: new Date().toISOString(),
          notes: `Separação para carregamento (etiqueta ${e.label.code})`,
        }));
        if ((Number(a.manual) || 0) > 0) {
          moves.push({
            user_email: user.email,
            move_type: "saida",
            product_id: a.item.product_id || "",
            product_code: a.item.product_code || "",
            product_name: a.item.product_name || "",
            unit: a.item.unit || "",
            quantity: Number(a.manual) || 0,
            document: `Carga ${carga.number}`,
            move_date: new Date().toISOString(),
            notes: "Separação para carregamento (sem etiqueta)",
          });
        }
        if (moves.length) await base44.entities.ErpWmsMove.bulkCreate(moves);
        const upd = a.entries.map(e => ({
          id: e.label.id,
          remaining: r3((Number(e.label.remaining ?? e.label.quantity) || 0) - e.qty),
        }));
        if (upd.length) await base44.entities.ErpWmsLabel.bulkUpdate(upd);
      }
      await base44.entities.ErpLoadAssembly.update(carga.id, { status: "carregada" });
      setCargaId("");
      setAllocations([]);
      await load();
      flash("ok", `Carga ${carga.number} carregada — estoque baixado e etiquetas consumidas.`);
    } catch (e) { alert("Erro ao confirmar carregamento: " + e.message); }
    setBusy(false);
  };

  return (
    <div className="space-y-3">
      <h2 className="font-semibold text-base flex items-center gap-2"><Truck className="w-5 h-5 text-purple-600" /> Bipagem de Separação (Carregamento)</h2>
      <p className="text-xs text-gray-500 -mt-1">Bipe as etiquetas dos produtos da carga para separar o carregamento respeitando o FIFO — ao bipar um lote fora da ordem de validade, o sistema pergunta se deseja continuar: se sim, segue normalmente; se não, zera a bipagem para bipar novamente.</p>

      {loading ? (
        <div className="p-6 text-center text-gray-400 flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Carregando...</div>
      ) : (
        <>
          <div className="flex gap-2 flex-wrap">
            <select value={cargaId} onChange={e => selectCarga(e.target.value)} className="flex-1 min-w-[280px] h-9 rounded-md border border-input bg-white px-3 text-sm">
              <option value="">Selecione a carga montada...</option>
              {cargas.map(c => <option key={c.id} value={c.id}>{c.number} — {c.vehicle_plate || "veículo não informado"}{c.driver_name ? ` — ${c.driver_name}` : ""}</option>)}
            </select>
          </div>

          {carga && (
            <>
              <div className="bg-white rounded-xl border p-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                <div><p className="text-xs text-gray-500">Carga</p><p className="font-medium">{carga.number}</p></div>
                <div><p className="text-xs text-gray-500">Veículo</p><p className="font-medium">{carga.vehicle_plate || "—"}</p></div>
                <div><p className="text-xs text-gray-500">Motorista</p><p className="font-medium">{carga.driver_name || "—"}</p></div>
                <div><p className="text-xs text-gray-500">Volumes</p><p className="font-medium">{carga.total_volumes || 0}</p></div>
              </div>

              <div className="flex gap-2">
                <input
                  autoFocus
                  value={scan}
                  onChange={e => setScan(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); if (scan.trim()) handleScan(scan); } }}
                  placeholder="Bipe a etiqueta do produto (QR code) e pressione Enter..."
                  className="flex-1 h-10 rounded-md border border-input px-3 text-sm font-mono"
                />
                <Button size="sm" onClick={() => scan.trim() && handleScan(scan)} className="gap-1.5 bg-purple-600 hover:bg-purple-700"><ScanLine className="w-4 h-4" /> Bipar</Button>
              </div>

              {msg && (
                <div className={`flex items-center gap-2 text-sm rounded-lg p-2.5 border ${msg.type === "ok" ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-red-50 border-red-200 text-red-700"}`}>
                  {msg.type === "ok" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />} {msg.text}
                </div>
              )}

              {fifoAlert && (
                <div className="bg-amber-50 border-2 border-amber-400 rounded-lg p-3 space-y-2">
                  <p className="text-sm text-amber-800 font-medium flex items-center gap-2"><AlertTriangle className="w-5 h-5" /> Fora do FIFO — existe lote com validade inferior</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-white rounded-md border p-2">
                      <p className="text-gray-500 font-medium">Deveria ser bipada (menor validade):</p>
                      <p className="font-mono">{fifoAlert.expected?.code || "—"}</p>
                      <p>Lote: <b>{fifoAlert.expected?.lot || "—"}</b></p>
                      <p>Validade: <b>{fifoAlert.expected?.expiry_date ? fmtDate(fifoAlert.expected.expiry_date) : "—"}</b></p>
                    </div>
                    <div className="bg-white rounded-md border p-2">
                      <p className="text-gray-500 font-medium">Lote bipado:</p>
                      <p className="font-mono">{fifoAlert.label.code}</p>
                      <p>Lote: <b>{fifoAlert.label.lot || "—"}</b></p>
                      <p>Validade: <b>{fifoAlert.label.expiry_date ? fmtDate(fifoAlert.label.expiry_date) : "—"}</b></p>
                    </div>
                  </div>
                  <p className="text-xs text-amber-800">Deseja continuar com o lote bipado?</p>
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" variant="outline" onClick={rejectFifo}>Não — zerar e bipar novamente</Button>
                    <Button size="sm" className="bg-amber-600 hover:bg-amber-700" onClick={confirmFifo}>Sim, continuar</Button>
                  </div>
                </div>
              )}

              {hint && !fifoAlert && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-2.5 text-xs text-purple-800">
                  Bipe novamente a etiqueta: <b className="font-mono">{hint.code || "—"}</b> — lote <b>{hint.lot || "—"}</b> — validade <b>{hint.expiry_date ? fmtDate(hint.expiry_date) : "—"}</b>
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
                      <div className="h-1.5 bg-gray-100 rounded"><div className={`h-1.5 rounded ${done >= needed ? "bg-emerald-500" : "bg-purple-500"}`} style={{ width: `${pct}%` }}></div></div>
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
                            <button onClick={() => manualAllocate(a)} className="text-[11px] text-purple-600 hover:underline flex items-center gap-1"><PackageMinus className="w-3 h-3" /> Lançar sem etiqueta</button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-2 justify-end border-t pt-2">
                <Button size="sm" disabled={busy || !allComplete} onClick={confirmLoad} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />} Confirmar Carregamento
                </Button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
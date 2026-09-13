import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2, Printer, X } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { genOrderNumber, fmtDate } from "@/lib/erpUtils";
import { labelQrPayload, DEFAULT_LABEL_SIZES } from "./ErpWmsLabelPanel";

const r3 = (v) => Math.round((Number(v) || 0) * 1000) / 1000;

// Etiquetas de Compra por Nota: seleciona a NF de entrada, mostra todos os
// produtos da nota, informa quantas etiquetas imprimir de cada produto (com
// seleção de todos) e gera/imprime de uma única vez todas as etiquetas da nota.
// A quantidade do item é dividida igualmente entre as etiquetas do produto.
export default function ErpWmsPurchaseLabelModal({ user, config, onClose, onSaved }) {
  const [notas, setNotas] = useState(null);
  const [nota, setNota] = useState(null);
  const [rows, setRows] = useState([]);
  const [lot, setLot] = useState("");
  const [validade, setValidade] = useState("");
  const [busy, setBusy] = useState(false);
  const [generated, setGenerated] = useState(null);

  const w = Number(config?.width_mm) || DEFAULT_LABEL_SIZES.compra.width_mm;
  const h = Number(config?.height_mm) || DEFAULT_LABEL_SIZES.compra.height_mm;
  const qrSize = Math.max(48, Math.round(Math.min(w, h) * 3.78 * 0.62));

  useEffect(() => {
    base44.entities.ErpFiscalEntry.filter({ user_email: user.email, entry_kind: "nf_entrada" }, "-created_date", 500)
      .then(list => setNotas(list.filter(n => (n.items || []).some(it => it.product_id))))
      .catch(() => setNotas([]));
  }, [user.email]);

  const selectNota = (n) => {
    setNota(n);
    setRows((n.items || []).filter(it => it.product_id).map(it => ({ item: it, checked: true, labels: 1 })));
    setGenerated(null);
  };
  const setRow = (i, patch) => setRows(p => p.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const selectedRows = rows.filter(r => r.checked && Number(r.labels) >= 1);
  const totalLabels = selectedRows.reduce((s, r) => s + Math.floor(Number(r.labels) || 0), 0);
  const allChecked = rows.length > 0 && rows.every(r => r.checked);

  const generate = async (printAfter) => {
    if (rows.some(r => r.checked && !(Number(r.labels) >= 1))) { alert("Informe ao menos 1 etiqueta para cada produto selecionado."); return; }
    if (!selectedRows.length) { alert("Selecione ao menos um produto da nota."); return; }
    setBusy(true);
    try {
      const labels = [];
      for (const r of selectedRows) {
        const n = Math.floor(Number(r.labels));
        const perLabel = r3(Number(r.item.quantity) / n);
        for (let i = 0; i < n; i++) {
          labels.push({
            user_email: user.email,
            code: genOrderNumber("ETQ"),
            label_type: "compra",
            product_id: r.item.product_id,
            product_code: r.item.product_code || "",
            product_name: r.item.product_name || "",
            unit: r.item.unit || "",
            quantity: perLabel,
            remaining: perLabel,
            lot: lot || "",
            expiry_date: validade || "",
            nota_number: nota.nota_number || "",
            supplier_name: nota.supplier_name || "",
            status: "ativa",
          });
        }
      }
      const created = await base44.entities.ErpWmsLabel.bulkCreate(labels);
      setGenerated(created);
      onSaved();
      if (printAfter) setTimeout(handlePrint, 300);
    } catch (e) { alert(e.message); }
    setBusy(false);
  };

  const handlePrint = () => {
    document.body.classList.add("printing-label");
    window.print();
    setTimeout(() => document.body.classList.remove("printing-label"), 500);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10 no-print">
          <h2 className="font-bold">Nova Etiqueta de Compra — por Nota</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded text-gray-500"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-4 space-y-3 no-print">
          {notas === null ? (
            <div className="p-6 text-center text-gray-400 flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Carregando notas de entrada...</div>
          ) : !nota ? (
            notas.length === 0 ? (
              <p className="p-6 text-center text-gray-400">Nenhuma nota de entrada com produtos vinculados.</p>
            ) : (
              <div>
                <label className="text-xs font-medium text-gray-600">Selecione a Nota de Entrada *</label>
                <select onChange={e => { const n = notas.find(x => x.id === e.target.value); if (n) selectNota(n); }}
                  className="w-full h-9 rounded-md border border-input bg-white px-3 text-sm mt-1" defaultValue="">
                  <option value="" disabled>Selecione a nota...</option>
                  {notas.map(n => (
                    <option key={n.id} value={n.id}>NF {n.nota_number}{n.nota_series ? `/${n.nota_series}` : ""} — {n.supplier_name || "fornecedor não informado"} — {fmtDate(n.issue_date)}</option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-400 mt-1">Somente notas de entrada do módulo Fiscal com produtos vinculados.</p>
              </div>
            )
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 flex-wrap bg-gray-50 border rounded-lg p-2.5 text-sm">
                <div>
                  <p className="font-medium">NF {nota.nota_number}{nota.nota_series ? `/${nota.nota_series}` : ""} — {nota.supplier_name || "—"}</p>
                  <p className="text-xs text-gray-500">Emissão: {fmtDate(nota.issue_date)} • Total: {(Number(nota.total_nota) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
                </div>
                <button onClick={() => { setNota(null); setRows([]); setGenerated(null); }} className="text-xs text-indigo-600 hover:underline">Trocar nota</button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Lote (opcional — aplica a todas)</label>
                  <input value={lot} onChange={e => setLot(e.target.value)} className="w-full h-9 rounded-md border border-input bg-white px-3 text-sm mt-1" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Validade (opcional — aplica a todas)</label>
                  <input type="date" value={validade} onChange={e => setValidade(e.target.value)} className="w-full h-9 rounded-md border border-input bg-white px-3 text-sm mt-1" />
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 text-gray-500 text-xs">
                    <tr>
                      <th className="p-2 w-8">
                        <input type="checkbox" className="w-4 h-4 accent-indigo-600" checked={allChecked}
                          onChange={e => setRows(p => p.map(r => ({ ...r, checked: e.target.checked })))} />
                      </th>
                      <th className="p-2 text-left">Produto</th>
                      <th className="p-2 text-right">Qtd. da NF</th>
                      <th className="p-2 text-right">Qtd. por etiqueta</th>
                      <th className="p-2 text-right">Etiquetas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => {
                      const n = Math.max(1, Math.floor(Number(r.labels) || 0));
                      return (
                        <tr key={i} className={`border-t ${r.checked ? "" : "opacity-50"}`}>
                          <td className="p-2">
                            <input type="checkbox" className="w-4 h-4 accent-indigo-600" checked={r.checked} onChange={e => setRow(i, { checked: e.target.checked })} />
                          </td>
                          <td className="p-2">
                            {r.item.product_code ? <span className="font-mono text-xs text-gray-500">{r.item.product_code} — </span> : ""}{r.item.product_name}
                          </td>
                          <td className="p-2 text-right">{r.item.quantity} {r.item.unit || ""}</td>
                          <td className="p-2 text-right text-gray-500">{r3(Number(r.item.quantity) / n)}</td>
                          <td className="p-2 text-right">
                            <input type="number" min="1" step="1" value={r.labels} disabled={!r.checked}
                              onChange={e => setRow(i, { labels: e.target.value })}
                              className="w-20 h-8 rounded-md border border-input bg-white px-2 text-sm text-right" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-gray-400">A quantidade de cada produto é dividida igualmente entre as suas etiquetas. Marque todos para imprimir de uma única vez todas as etiquetas da nota.</p>

              <div className="flex items-center gap-2 justify-end border-t pt-2">
                <span className="text-xs text-gray-500 mr-auto">{totalLabels} etiqueta(s)</span>
                <Button size="sm" variant="outline" disabled={busy || !selectedRows.length} onClick={() => generate(false)}>Gerar Etiquetas</Button>
                <Button size="sm" disabled={busy || !selectedRows.length} onClick={() => generate(true)} className="gap-1.5 bg-indigo-600 hover:bg-indigo-700">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />} Gerar e Imprimir
                </Button>
              </div>
            </>
          )}
        </div>

        {generated && (
          <div className="p-4 pt-0 space-y-2">
            <div className="flex items-center justify-between no-print">
              <p className="text-xs font-medium text-emerald-700">{generated.length} etiqueta(s) gerada(s) — NF {nota.nota_number}.</p>
              <Button size="sm" onClick={handlePrint} className="gap-1.5 bg-indigo-600 hover:bg-indigo-700"><Printer className="w-4 h-4" /> Imprimir Todas</Button>
            </div>
            <div id="label-print-area" className="space-y-2">
              {generated.map(l => (
                <div key={l.id} className="wms-label border-2 border-black rounded-lg p-2 flex gap-2 items-center bg-white overflow-hidden" style={{ width: `${w}mm`, height: `${h}mm`, boxSizing: "border-box" }}>
                  <div className="flex-1 text-[10px] leading-snug">
                    <p className="font-bold text-sm leading-tight">{l.product_name}</p>
                    <p>Cód.: {l.product_code || "—"}</p>
                    <p>Qtd.: <b className="text-sm">{l.quantity} {l.unit || ""}</b></p>
                    <p>NF: <b>{l.nota_number || "—"}</b></p>
                    <p>Fornecedor: {l.supplier_name || "—"}</p>
                    <p>Lote: <b className="text-xs">{l.lot || "—"}</b></p>
                    <p>Validade: <b className="text-sm">{l.expiry_date ? fmtDate(l.expiry_date) : "—"}</b></p>
                    <p className="font-mono text-[9px] mt-1">{l.code}</p>
                  </div>
                  <QRCodeCanvas value={labelQrPayload(l)} size={qrSize} level="M" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
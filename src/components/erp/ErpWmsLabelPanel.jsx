import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Plus, Search, Loader2, Printer, Ban, X, Tag, Settings, Factory, Package } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { fmtDate } from "@/lib/erpUtils";
import ErpWmsPurchaseLabelModal from "./ErpWmsPurchaseLabelModal";
import ErpWmsProductionLabelModal from "./ErpWmsProductionLabelModal";
import { DEFAULT_LABEL_SIZES, labelQrPayload } from "@/lib/erpWmsLabels";
export { DEFAULT_LABEL_SIZES, genProductionLot, labelQrPayload, parseLabelScan } from "@/lib/erpWmsLabels";

const TYPE_OPTS = {
  compra: { label: "Compra", color: "bg-emerald-100 text-emerald-700" },
  producao: { label: "Produção", color: "bg-indigo-100 text-indigo-700" },
};

// Utilitários das etiquetas (tamanhos, lote de produção, QR code e bipagem)
// centralizados em @/lib/erpWmsLabels e reexportados abaixo para compatibilidade

export default function ErpWmsLabelPanel({ user }) {
  const [labels, setLabels] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [printing, setPrinting] = useState(null); // etiqueta(s) selecionada(s) para impressão
  const [selectedIds, setSelectedIds] = useState([]); // etiquetas marcadas para impressão em lote
  const [showForm, setShowForm] = useState(false);
  const [configs, setConfigs] = useState({}); // configuração de tamanho por modelo
  const [showConfig, setShowConfig] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [ls, ps, cfgs] = await Promise.all([
        base44.entities.ErpWmsLabel.filter({ user_email: user.email }, "-created_date", 500),
        base44.entities.ErpProduct.filter({ user_email: user.email }, "code", 500),
        base44.entities.ErpWmsLabelConfig.filter({ user_email: user.email }, "-created_date", 100),
      ]);
      setLabels(ls);
      setProducts(ps);
      const cfgMap = {};
      (cfgs || []).forEach(c => { cfgMap[c.label_type] = c; });
      setConfigs(cfgMap);
    } catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [user.email]);

  const filtered = labels.filter(l =>
    (!typeFilter || l.label_type === typeFilter) &&
    [l.code, l.product_name, l.product_code, l.lot, l.nota_number, l.supplier_name, l.op_number]
      .map(v => String(v ?? "")).join(" ").toLowerCase().includes(search.toLowerCase())
  );

  const handleCancel = async (l) => {
    if (!confirm(`Cancelar a etiqueta ${l.code} (${l.product_name})?`)) return;
    await base44.entities.ErpWmsLabel.update(l.id, { status: "cancelada" });
    load();
  };

  // Etiqueta bipada na produção (em estoque) fica bloqueada — vai para o fim da lista
  const printableRows = filtered.filter(l => l.status === "ativa" && !l.stocked);
  const sortedLabels = [...filtered].sort((a, b) => (a.stocked ? 1 : 0) - (b.stocked ? 1 : 0));
  const toggleSelect = (id) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const allSelected = printableRows.length > 0 && printableRows.every(l => selectedIds.includes(l.id));

  // Altera a quantidade da etiqueta direto na lista — grava a quantidade e o
  // saldo (enquanto a etiqueta ainda não foi consumida pela bipagem)
  const handleQtyChange = async (l, v) => {
    const newQty = Number(v) || 0;
    if (newQty === (Number(l.quantity) || 0)) return;
    if (!(newQty > 0)) { alert("Informe uma quantidade maior que zero."); load(); return; }
    try {
      const data = { quantity: newQty };
      if (Number(l.remaining) === Number(l.quantity)) data.remaining = newQty;
      await base44.entities.ErpWmsLabel.update(l.id, data);
      load();
    } catch (e) { alert(e.message); load(); }
  };

  // Contador de impressões — soma as cópias impressas de cada etiqueta (única ou lote)
  const handlePrinted = async (printedLabels, copies) => {
    try {
      await base44.entities.ErpWmsLabel.bulkUpdate(printedLabels.map(l => ({
        id: l.id,
        print_count: (Number(l.print_count) || 0) + copies,
      })));
      load();
    } catch (e) { console.error(e); }
  };

  return (
    <div className="space-y-3">
      <h2 className="font-semibold text-base flex items-center gap-2"><Tag className="w-5 h-5 text-indigo-600" /> Etiquetas de Produtos (WMS)</h2>
      <p className="text-xs text-gray-500 -mt-1">Etiquetas de <b>Compra</b> (geradas automaticamente no recebimento da NF, com lote/quantidade/validade) e de <b>Produção</b> (produto acabado da OP). Imprima quantas cópias precisar para colar nos produtos — o QR code permite bipar a etiqueta no atendimento de requisições com validação FIFO.</p>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar etiqueta, produto, lote, NF, OP..." className="w-full h-9 rounded-md border border-input bg-transparent pl-9 pr-3 text-sm" />
        </div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="h-9 rounded-md border border-input bg-white px-3 text-sm">
          <option value="">Modelo: todos</option>
          <option value="compra">Compra</option>
          <option value="producao">Produção</option>
        </select>
        <Button size="sm" variant="outline" onClick={() => setShowConfig(true)} className="gap-1.5 border-indigo-200 text-indigo-700 hover:bg-indigo-50"><Settings className="w-4 h-4" /> Configurar Tamanhos</Button>
        <Button size="sm" variant="outline" disabled={selectedIds.length === 0} onClick={() => setPrinting(printableRows.filter(l => selectedIds.includes(l.id)))} className="gap-1.5 border-emerald-200 text-emerald-700 hover:bg-emerald-50 disabled:opacity-40"><Printer className="w-4 h-4" /> Imprimir Selecionadas{selectedIds.length > 0 ? ` (${selectedIds.length})` : ""}</Button>
        <Button size="sm" onClick={() => setShowForm(true)} className="gap-1.5 bg-indigo-600 hover:bg-indigo-700"><Plus className="w-4 h-4" /> Nova Etiqueta</Button>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-gray-500 text-xs">
              <tr>
                <th className="p-2 w-8">
                  <input type="checkbox" className="w-4 h-4 accent-indigo-600" checked={allSelected} title="Selecionar todas"
                    onChange={e => setSelectedIds(e.target.checked ? printableRows.map(l => l.id) : [])} />
                </th>
                <th className="p-2 text-left">Etiqueta</th>
                <th className="p-2 text-left">Modelo</th>
                <th className="p-2 text-left">Produto</th>
                <th className="p-2 text-left">Lote</th>
                <th className="p-2 text-left">Validade</th>
                <th className="p-2 text-right">Qtd.</th>
                <th className="p-2 text-right">Saldo</th>
                <th className="p-2 text-left">Origem</th>
                <th className="p-2 text-right">Impressões</th>
                <th className="p-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={11} className="p-6 text-center text-gray-400">Carregando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={11} className="p-8 text-center text-gray-400">Nenhuma etiqueta — as etiquetas de compra são geradas ao confirmar o recebimento da NF.</td></tr>
              ) : sortedLabels.map(l => {
                const t = TYPE_OPTS[l.label_type] || {};
                const rem = Number(l.remaining ?? l.quantity) || 0;
                return (
                  <tr key={l.id} className={`border-t ${l.stocked ? "bg-emerald-50" : "hover:bg-gray-50"} ${l.status === "cancelada" ? "opacity-50" : ""}`}>
                    <td className="p-2">
                      {l.status === "ativa" && !l.stocked && (
                        <input type="checkbox" className="w-4 h-4 accent-indigo-600" checked={selectedIds.includes(l.id)} onChange={() => toggleSelect(l.id)} title="Marcar para impressão" />
                      )}
                    </td>
                    <td className="p-2 font-mono text-xs">{l.code}{l.stocked && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-sans">Bipada</span>}{l.status === "cancelada" && <span className="ml-1 text-red-500">(cancelada)</span>}</td>
                    <td className="p-2"><span className={`text-xs px-2 py-0.5 rounded-full ${t.color || "bg-gray-100 text-gray-600"}`}>{t.label || l.label_type}</span></td>
                    <td className="p-2">{l.product_name}</td>
                    <td className="p-2 font-mono text-xs">{l.lot || "—"}</td>
                    <td className="p-2">{l.expiry_date ? fmtDate(l.expiry_date) : "—"}</td>
                    <td className="p-2 text-right whitespace-nowrap">
                      {l.stocked || l.status === "cancelada" ? (
                        <span className="text-gray-400">{l.quantity}</span>
                      ) : (
                        <input
                          type="number" min="0" step="0.001" defaultValue={l.quantity}
                          onBlur={e => handleQtyChange(l, e.target.value)}
                          title="Alterar quantidade da etiqueta"
                          className="w-20 h-7 rounded-md border border-input px-2 text-sm text-right"
                        />
                      )}
                      {" "}{l.unit || ""}
                    </td>
                    <td className={`p-2 text-right font-medium ${rem <= 0 ? "text-gray-400" : "text-emerald-700"}`}>{rem}</td>
                    <td className="p-2 text-xs text-gray-500">
                      {l.label_type === "compra"
                        ? <>NF {l.nota_number || "—"}{l.supplier_name ? ` — ${l.supplier_name}` : ""}</>
                        : (l.op_number ? `OP ${l.op_number}` : "—")}
                    </td>
                    <td className={`p-2 text-right text-xs ${Number(l.print_count) > 0 ? "text-indigo-700 font-semibold" : "text-gray-400"}`}>{Number(l.print_count) || 0}×</td>
                    <td className="p-2 text-right whitespace-nowrap">
                      {l.stocked ? (
                        <span className="text-[10px] text-emerald-700 font-medium">Em estoque — bloqueada</span>
                      ) : (<>
                        <button onClick={() => setPrinting([l])} title="Imprimir etiqueta" className="p-1 hover:bg-indigo-50 rounded"><Printer className="w-4 h-4 text-indigo-600" /></button>
                        {l.status === "ativa" && <button onClick={() => handleCancel(l)} title="Cancelar etiqueta" className="p-1 hover:bg-red-50 rounded"><Ban className="w-4 h-4 text-red-500" /></button>}
                      </>)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <ErpWmsLabelForm user={user} products={products} configs={configs} onClose={() => setShowForm(false)} onSaved={load} />
      )}
      {showConfig && (
        <ErpWmsLabelConfigModal user={user} configs={configs} onClose={() => setShowConfig(false)} onSaved={load} />
      )}
      {printing && (
        <ErpLabelPrintModal
          labels={printing}
          configs={configs}
          onClose={() => setPrinting(null)}
          onPrinted={handlePrinted}
        />
      )}
    </div>
  );
}

// Configuração de largura/altura (mm) de cada modelo de etiqueta — usada na
// impressão em tamanho real para colar na etiqueta física correspondente
function ErpWmsLabelConfigModal({ user, configs, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({
    compra: {
      width_mm: configs.compra?.width_mm ?? DEFAULT_LABEL_SIZES.compra.width_mm,
      height_mm: configs.compra?.height_mm ?? DEFAULT_LABEL_SIZES.compra.height_mm,
    },
    producao: {
      width_mm: configs.producao?.width_mm ?? DEFAULT_LABEL_SIZES.producao.width_mm,
      height_mm: configs.producao?.height_mm ?? DEFAULT_LABEL_SIZES.producao.height_mm,
    },
  }));
  const [saving, setSaving] = useState(false);
  const set = (t, k, v) => setForm(p => ({ ...p, [t]: { ...p[t], [k]: v } }));

  const handleSave = async () => {
    for (const t of ["compra", "producao"]) {
      if (!(Number(form[t].width_mm) > 0) || !(Number(form[t].height_mm) > 0)) {
        alert(`Informe largura e altura válidas (mm) para a etiqueta de ${t === "compra" ? "compra" : "produção"}.`);
        return;
      }
    }
    setSaving(true);
    try {
      for (const t of ["compra", "producao"]) {
        const data = {
          user_email: user.email,
          label_type: t,
          width_mm: Number(form[t].width_mm) || 0,
          height_mm: Number(form[t].height_mm) || 0,
        };
        if (configs[t]?.id) await base44.entities.ErpWmsLabelConfig.update(configs[t].id, data);
        else await base44.entities.ErpWmsLabelConfig.create(data);
      }
      onSaved();
      onClose();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-bold">Tamanho das Etiquetas</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded text-gray-500"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-4">
          {["compra", "producao"].map(t => {
            const type = TYPE_OPTS[t];
            return (
              <div key={t} className="border rounded-lg p-3">
                <p className={`text-xs px-2 py-0.5 rounded-full w-fit mb-2 ${type.color}`}>Etiqueta de {type.label}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600">Largura (mm)</label>
                    <input type="number" min="30" max="250" value={form[t].width_mm} onChange={e => set(t, "width_mm", e.target.value)} className="w-full h-9 rounded-md border border-input px-2 text-sm mt-1" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">Altura (mm)</label>
                    <input type="number" min="20" max="200" value={form[t].height_mm} onChange={e => set(t, "height_mm", e.target.value)} className="w-full h-9 rounded-md border border-input px-2 text-sm mt-1" />
                  </div>
                </div>
              </div>
            );
          })}
          <p className="text-xs text-gray-400">Cada modelo de etiqueta tem sua própria configuração — a impressão usa estas medidas em tamanho real (mm) para colar na etiqueta física correspondente.</p>
        </div>
        <div className="p-4 border-t flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar Configurações"}</Button>
        </div>
      </div>
    </div>
  );
}

// Nova etiqueta — o modelo define o fluxo: produção (por OP) ou compra (por NF)
function ErpWmsLabelForm({ user, products, configs, onClose, onSaved }) {
  const [model, setModel] = useState("");
  if (model === "compra") {
    return (
      <ErpWmsPurchaseLabelModal
        user={user}
        config={{ ...DEFAULT_LABEL_SIZES.compra, ...(configs?.compra || {}) }}
        onClose={onClose}
        onSaved={onSaved}
      />
    );
  }
  if (model === "producao") {
    return (
      <ErpWmsProductionLabelModal
        user={user}
        products={products}
        configs={configs}
        onClose={onClose}
        onSaved={onSaved}
      />
    );
  }
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-bold">Nova Etiqueta</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded text-gray-500"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          <button onClick={() => setModel("producao")} className="w-full text-left border rounded-lg p-3 hover:border-indigo-400 hover:bg-indigo-50">
            <p className="font-semibold text-sm flex items-center gap-2"><Factory className="w-4 h-4 text-indigo-600" /> Etiqueta de Produção (por OP)</p>
            <p className="text-xs text-gray-500 mt-0.5">Informe a ordem de produção — etiquetas geradas conforme o fator pallet, com quantidades ajustáveis.</p>
          </button>
          <button onClick={() => setModel("compra")} className="w-full text-left border rounded-lg p-3 hover:border-emerald-400 hover:bg-emerald-50">
            <p className="font-semibold text-sm flex items-center gap-2"><Package className="w-4 h-4 text-emerald-600" /> Etiqueta de Compra (por Nota)</p>
            <p className="text-xs text-gray-500 mt-0.5">Selecione a NF de entrada e imprima as etiquetas dos produtos recebidos.</p>
          </button>
        </div>
      </div>
    </div>
  );
}

// Impressão da etiqueta — quantas cópias precisar para colar nos produtos,
// no tamanho pré-definido do modelo (largura/altura em mm, impressão em tamanho real)
// Impressão de uma ou várias etiquetas — cada etiqueta usa o tamanho do seu
// modelo (compra/produção) e o contador de impressões soma as cópias impressas
function ErpLabelPrintModal({ labels, configs, onClose, onPrinted }) {
  const [copies, setCopies] = useState(1);
  const cfgFor = (t) => ({ ...DEFAULT_LABEL_SIZES[t], ...(configs?.[t] || {}) });
  const title = labels.length === 1 ? `Imprimir Etiqueta ${labels[0].code}` : `Imprimir ${labels.length} Etiquetas`;

  const handlePrint = () => {
    document.body.classList.add("printing-label");
    window.print();
    setTimeout(() => {
      document.body.classList.remove("printing-label");
      onPrinted?.(labels, copies);
    }, 500);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10 no-print">
          <h2 className="font-bold">{title}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded text-gray-500"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2 no-print">
            <label className="text-xs font-medium text-gray-600 whitespace-nowrap">Cópias (por etiqueta):</label>
            <input type="number" min="1" max="200" value={copies} onChange={e => setCopies(Math.max(1, Math.min(200, Number(e.target.value) || 1)))} className="w-20 h-9 rounded-md border border-input px-2 text-sm" />
            <Button size="sm" onClick={handlePrint} className="gap-1.5 bg-indigo-600 hover:bg-indigo-700"><Printer className="w-4 h-4" /> Imprimir</Button>
          </div>
          <p className="text-[11px] text-gray-400 no-print">Tamanho pré-definido por modelo (compra/produção) — impressão em tamanho real (mm).</p>
          <div id="label-print-area" className="space-y-2">
            {labels.map(label => {
              const cfg = cfgFor(label.label_type);
              const w = Number(cfg.width_mm) || 100;
              const h = Number(cfg.height_mm) || 50;
              const qrSize = Math.max(48, Math.round(Math.min(w, h) * 3.78 * 0.62));
              return Array.from({ length: copies }).map((_, i) => (
                <div key={`${label.id}-${i}`} className="wms-label border-2 border-black rounded-lg p-2 flex gap-2 items-center bg-white overflow-hidden" style={{ width: `${w}mm`, height: `${h}mm`, boxSizing: "border-box" }}>
                  <div className="flex-1 text-[10px] leading-snug">
                    <p className="font-bold text-sm leading-tight">{label.product_name}</p>
                    <p>Cód.: {label.product_code || "—"}</p>
                    <p>Qtd.: <b className="text-sm">{label.quantity} {label.unit || ""}</b></p>
                    {label.label_type === "compra" ? (<>
                      <p>NF: <b>{label.nota_number || "—"}</b></p>
                      <p>Fornecedor: {label.supplier_name || "—"}</p>
                    </>) : (<>
                      <p>OP: <b>{label.op_number || "—"}</b></p>
                      <p>Fabricação: <b>{label.fabricacao_date ? fmtDate(label.fabricacao_date) : "—"}</b></p>
                    </>)}
                    <p>Lote: <b className="text-xs">{label.lot || "—"}</b></p>
                    <p>Validade: <b className="text-sm">{label.expiry_date ? fmtDate(label.expiry_date) : "—"}</b></p>
                    <p className="font-mono text-[9px] mt-1">{label.code}</p>
                  </div>
                  <QRCodeCanvas value={labelQrPayload(label)} size={qrSize} level="M" />
                </div>
              ));
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
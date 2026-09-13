import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Plus, Search, Loader2, Printer, Ban, X, Tag, Settings } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { genOrderNumber, fmtDate } from "@/lib/erpUtils";

const TYPE_OPTS = {
  compra: { label: "Compra", color: "bg-emerald-100 text-emerald-700" },
  producao: { label: "Produção", color: "bg-indigo-100 text-indigo-700" },
};

// Tamanhos pré-definidos por modelo de etiqueta (mm) — cada tipo (compra/produção)
// pode ter sua própria configuração de largura e altura
export const DEFAULT_LABEL_SIZES = {
  compra: { width_mm: 100, height_mm: 60 },
  producao: { width_mm: 100, height_mm: 50 },
};

// Lote de produção: ano + número do dia do ano + código da linha (ex: 2026256L01)
export function genProductionLot(fabricacao, line) {
  const dt = fabricacao ? new Date(`${fabricacao}T12:00:00`) : new Date();
  const start = new Date(dt.getFullYear(), 0, 0);
  const doy = Math.floor((dt - start) / 86400000);
  return `${dt.getFullYear()}${String(doy).padStart(3, "0")}${(line?.code || "").toUpperCase()}`;
}

// QR code da etiqueta: produto, NF, fornecedor, quantidade, lote e validade
export function labelQrPayload(l) {
  return "ETQ|" + JSON.stringify({
    id: l.id, code: l.code || "", tipo: l.label_type,
    prod: l.product_name, cod: l.product_code,
    qtd: l.quantity, un: l.unit || "",
    lote: l.lot || "", val: l.expiry_date || "", fab: l.fabricacao_date || "",
    nf: l.nota_number || "", forn: l.supplier_name || "", op: l.op_number || "",
  });
}

// Interpreta a bipagem: QR "ETQ|{json}", código da etiqueta ou id
export function parseLabelScan(text) {
  const t = String(text || "").trim();
  if (t.startsWith("ETQ|")) { try { return JSON.parse(t.slice(4)); } catch (e) { return null; } }
  return { id: t, code: t };
}

export default function ErpWmsLabelPanel({ user }) {
  const [labels, setLabels] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [printing, setPrinting] = useState(null); // etiqueta selecionada para impressão
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
        <Button size="sm" onClick={() => setShowForm(true)} className="gap-1.5 bg-indigo-600 hover:bg-indigo-700"><Plus className="w-4 h-4" /> Nova Etiqueta</Button>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-gray-500 text-xs">
              <tr>
                <th className="p-2 text-left">Etiqueta</th>
                <th className="p-2 text-left">Modelo</th>
                <th className="p-2 text-left">Produto</th>
                <th className="p-2 text-left">Lote</th>
                <th className="p-2 text-left">Validade</th>
                <th className="p-2 text-right">Qtd.</th>
                <th className="p-2 text-right">Saldo</th>
                <th className="p-2 text-left">Origem</th>
                <th className="p-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="p-6 text-center text-gray-400">Carregando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="p-8 text-center text-gray-400">Nenhuma etiqueta — as etiquetas de compra são geradas ao confirmar o recebimento da NF.</td></tr>
              ) : filtered.map(l => {
                const t = TYPE_OPTS[l.label_type] || {};
                const rem = Number(l.remaining ?? l.quantity) || 0;
                return (
                  <tr key={l.id} className={`border-t hover:bg-gray-50 ${l.status === "cancelada" ? "opacity-50" : ""}`}>
                    <td className="p-2 font-mono text-xs">{l.code}{l.status === "cancelada" && <span className="ml-1 text-red-500">(cancelada)</span>}</td>
                    <td className="p-2"><span className={`text-xs px-2 py-0.5 rounded-full ${t.color || "bg-gray-100 text-gray-600"}`}>{t.label || l.label_type}</span></td>
                    <td className="p-2">{l.product_name}</td>
                    <td className="p-2 font-mono text-xs">{l.lot || "—"}</td>
                    <td className="p-2">{l.expiry_date ? fmtDate(l.expiry_date) : "—"}</td>
                    <td className="p-2 text-right">{l.quantity} {l.unit || ""}</td>
                    <td className={`p-2 text-right font-medium ${rem <= 0 ? "text-gray-400" : "text-emerald-700"}`}>{rem}</td>
                    <td className="p-2 text-xs text-gray-500">
                      {l.label_type === "compra"
                        ? <>NF {l.nota_number || "—"}{l.supplier_name ? ` — ${l.supplier_name}` : ""}</>
                        : (l.op_number ? `OP ${l.op_number}` : "—")}
                    </td>
                    <td className="p-2 text-right whitespace-nowrap">
                      <button onClick={() => setPrinting(l)} title="Imprimir etiqueta" className="p-1 hover:bg-indigo-50 rounded"><Printer className="w-4 h-4 text-indigo-600" /></button>
                      {l.status === "ativa" && <button onClick={() => handleCancel(l)} title="Cancelar etiqueta" className="p-1 hover:bg-red-50 rounded"><Ban className="w-4 h-4 text-red-500" /></button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <ErpWmsLabelForm user={user} products={products} onClose={() => setShowForm(false)} onSaved={load} />
      )}
      {showConfig && (
        <ErpWmsLabelConfigModal user={user} configs={configs} onClose={() => setShowConfig(false)} onSaved={load} />
      )}
      {printing && (
        <ErpLabelPrintModal
          label={printing}
          config={{ ...DEFAULT_LABEL_SIZES[printing.label_type], ...(configs[printing.label_type] || {}) }}
          onClose={() => setPrinting(null)}
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

function ErpWmsLabelForm({ user, products, onClose, onSaved }) {
  const [form, setForm] = useState({
    label_type: "producao", product_id: "", quantity: "", lot: "", fabricacao: "", validade: "",
    nota_number: "", supplier_name: "", op_number: "", line_id: "",
  });
  const [saving, setSaving] = useState(false);
  const [lines, setLines] = useState([]);
  useEffect(() => {
    base44.entities.ErpProductionLine.filter({ user_email: user.email }, "name", 500)
      .then(list => setLines(list.filter(l => l.is_active !== false)))
      .catch(() => setLines([]));
  }, [user.email]);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const product = products.find(p => p.id === form.product_id);
  const line = lines.find(l => l.id === form.line_id);
  // Lote de produção automático: ano + nº do dia do ano + linha de produção
  const autoLot = form.label_type === "producao" ? genProductionLot(form.fabricacao, line) : form.lot;

  const handleSave = async () => {
    if (!form.product_id) { alert("Selecione o produto."); return; }
    if (!(Number(form.quantity) > 0)) { alert("Informe a quantidade da etiqueta."); return; }
    if (form.label_type === "producao" && !form.line_id) { alert("Selecione a linha de produção."); return; }
    setSaving(true);
    try {
      const qty = Number(form.quantity) || 0;
      await base44.entities.ErpWmsLabel.create({
        user_email: user.email,
        code: genOrderNumber("ETQ"),
        label_type: form.label_type,
        product_id: product.id,
        product_code: product.code || "",
        product_name: product.name,
        unit: product.unit || "",
        quantity: qty,
        remaining: qty,
        lot: form.label_type === "producao" ? autoLot : form.lot || "",
        fabricacao_date: form.fabricacao || "",
        expiry_date: form.validade || "",
        nota_number: form.nota_number || undefined,
        supplier_name: form.supplier_name || undefined,
        op_number: form.op_number || undefined,
        status: "ativa",
      });
      onSaved();
      onClose();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
          <h2 className="font-bold">Nova Etiqueta</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded text-gray-500"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-xs font-medium text-gray-600">Modelo *</label>
            <select value={form.label_type} onChange={e => set("label_type", e.target.value)} className="w-full h-9 rounded-md border border-input bg-white px-3 text-sm mt-1">
              <option value="producao">Etiqueta de Produção</option>
              <option value="compra">Etiqueta de Compra</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium text-gray-600">Produto *</label>
            <select value={form.product_id} onChange={e => set("product_id", e.target.value)} className="w-full h-9 rounded-md border border-input bg-white px-3 text-sm mt-1">
              <option value="">Selecione...</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.code ? `${p.code} — ` : ""}{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Quantidade *</label>
            <input type="number" min="0" step="0.001" value={form.quantity} onChange={e => set("quantity", e.target.value)} className="w-full h-9 rounded-md border border-input bg-white px-3 text-sm mt-1" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Lote</label>
            {form.label_type === "producao" ? (<>
              <input readOnly value={autoLot} className="w-full h-9 rounded-md border border-input bg-gray-50 px-3 text-sm font-mono mt-1" />
              <p className="text-[10px] text-gray-400 mt-0.5">Lote de produção gerado automaticamente: ano + nº do dia do ano + linha.</p>
            </>) : (
              <input value={form.lot} onChange={e => set("lot", e.target.value)} className="w-full h-9 rounded-md border border-input bg-white px-3 text-sm mt-1" />
            )}
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Fabricação</label>
            <input type="date" value={form.fabricacao} onChange={e => set("fabricacao", e.target.value)} className="w-full h-9 rounded-md border border-input bg-white px-3 text-sm mt-1" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Validade</label>
            <input type="date" value={form.validade} onChange={e => set("validade", e.target.value)} className="w-full h-9 rounded-md border border-input bg-white px-3 text-sm mt-1" />
          </div>
          {form.label_type === "compra" ? (<>
            <div>
              <label className="text-xs font-medium text-gray-600">Nr. NF</label>
              <input value={form.nota_number} onChange={e => set("nota_number", e.target.value)} className="w-full h-9 rounded-md border border-input bg-white px-3 text-sm mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Fornecedor</label>
              <input value={form.supplier_name} onChange={e => set("supplier_name", e.target.value)} className="w-full h-9 rounded-md border border-input bg-white px-3 text-sm mt-1" />
            </div>
          </>) : (<>
            <div>
              <label className="text-xs font-medium text-gray-600">Linha de Produção *</label>
              <select value={form.line_id} onChange={e => set("line_id", e.target.value)} className="w-full h-9 rounded-md border border-input bg-white px-3 text-sm mt-1">
                <option value="">Selecione...</option>
                {lines.map(l => <option key={l.id} value={l.id}>{l.code ? `${l.code} — ` : ""}{l.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Nr. da Ordem de Produção</label>
              <input value={form.op_number} onChange={e => set("op_number", e.target.value)} placeholder="ex: OP 001/2026" className="w-full h-9 rounded-md border border-input bg-white px-3 text-sm mt-1" />
            </div>
          </>)}
        </div>
        <div className="p-4 border-t flex gap-2 justify-end sticky bottom-0 bg-white">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar Etiqueta"}</Button>
        </div>
      </div>
    </div>
  );
}

// Impressão da etiqueta — quantas cópias precisar para colar nos produtos,
// no tamanho pré-definido do modelo (largura/altura em mm, impressão em tamanho real)
function ErpLabelPrintModal({ label, config, onClose }) {
  const [copies, setCopies] = useState(1);
  const w = Number(config?.width_mm) || DEFAULT_LABEL_SIZES[label.label_type]?.width_mm || 100;
  const h = Number(config?.height_mm) || DEFAULT_LABEL_SIZES[label.label_type]?.height_mm || 50;
  const qrSize = Math.max(48, Math.round(Math.min(w, h) * 3.78 * 0.62));

  const handlePrint = () => {
    document.body.classList.add("printing-label");
    window.print();
    setTimeout(() => document.body.classList.remove("printing-label"), 500);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10 no-print">
          <h2 className="font-bold">Imprimir Etiqueta {label.code}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded text-gray-500"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2 no-print">
            <label className="text-xs font-medium text-gray-600 whitespace-nowrap">Cópias:</label>
            <input type="number" min="1" max="200" value={copies} onChange={e => setCopies(Math.max(1, Math.min(200, Number(e.target.value) || 1)))} className="w-20 h-9 rounded-md border border-input px-2 text-sm" />
            <Button size="sm" onClick={handlePrint} className="gap-1.5 bg-indigo-600 hover:bg-indigo-700"><Printer className="w-4 h-4" /> Imprimir</Button>
          </div>
          <p className="text-[11px] text-gray-400 no-print">Tamanho pré-definido deste modelo: {w} × {h} mm (impressão em tamanho real).</p>
          <div id="label-print-area" className="space-y-2">
            {Array.from({ length: copies }).map((_, i) => (
              <div key={i} className="wms-label border-2 border-black rounded-lg p-2 flex gap-2 items-center bg-white overflow-hidden" style={{ width: `${w}mm`, height: `${h}mm`, boxSizing: "border-box" }}>
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
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
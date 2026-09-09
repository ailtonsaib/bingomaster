import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Search, Trash2, X, Download, Building } from "lucide-react";
import { fmtMoney } from "@/lib/erpUtils";

const ASSET_STATUS = [
  { value: "ativo", label: "Ativo", color: "text-emerald-700 bg-emerald-100" },
  { value: "baixado", label: "Baixado", color: "text-gray-700 bg-gray-100" },
];
const fmtDate = (s) => s ? new Date(s).toLocaleDateString("pt-BR") : "—";

export default function ErpFixedAssetManager({ user }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showImport, setShowImport] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setItems(await base44.entities.ErpFixedAsset.filter({ user_email: user.email }, "code", 500)); }
    catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [user.email]);

  const filtered = items.filter(i => (i.name + " " + (i.code || "") + " " + (i.location || "")).toLowerCase().includes(search.toLowerCase()));
  const handleDelete = async (i) => { if (confirm(`Excluir o bem "${i.name}"?`)) { await base44.entities.ErpFixedAsset.delete(i.id); load(); } };
  const totalAcquisition = filtered.reduce((s, i) => s + (Number(i.acquisition_value) || 0), 0);
  const totalCurrent = filtered.reduce((s, i) => s + (Number(i.current_value) || 0), 0);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border p-3"><p className="text-xs text-gray-500">Total de Bens</p><p className="text-xl font-bold">{filtered.length}</p></div>
        <div className="bg-white rounded-xl border p-3"><p className="text-xs text-gray-500">Valor de Aquisição</p><p className="text-xl font-bold">{fmtMoney(totalAcquisition)}</p></div>
        <div className="bg-white rounded-xl border p-3"><p className="text-xs text-gray-500">Valor Atual</p><p className="text-xl font-bold">{fmtMoney(totalCurrent)}</p></div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar bem..." className="w-full h-9 rounded-md border border-input bg-transparent pl-9 pr-3 text-sm" />
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowImport(true)} className="gap-1.5"><Download className="w-4 h-4" /> Importar de NF de Entrada</Button>
        <Button size="sm" onClick={() => { setEditing(null); setShowForm(true); }} className="gap-1.5 bg-amber-600 hover:bg-amber-700"><Plus className="w-4 h-4" /> Novo Bem</Button>
      </div>
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-gray-500 text-xs">
            <tr>
              <th className="p-2 text-left">Código</th><th className="p-2 text-left">Bem</th><th className="p-2 text-left">Aquisição</th>
              <th className="p-2 text-right">Vl. Aquisição</th><th className="p-2 text-right">Vl. Atual</th><th className="p-2 text-left">Deprec.</th>
              <th className="p-2 text-left">Localização</th><th className="p-2 text-left">Status</th><th className="p-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={9} className="p-6 text-center text-gray-400">Carregando...</td></tr>
            : filtered.length === 0 ? <tr><td colSpan={9} className="p-8 text-center text-gray-400"><Building className="w-10 h-10 mx-auto mb-2 opacity-30" /> Nenhum bem cadastrado.</td></tr>
            : filtered.map(i => (
              <tr key={i.id} className="border-t hover:bg-gray-50">
                <td className="p-2 font-mono text-xs">{i.code || "—"}</td>
                <td className="p-2 font-medium">{i.name}</td>
                <td className="p-2 text-xs">{fmtDate(i.acquisition_date)}</td>
                <td className="p-2 text-right text-xs">{fmtMoney(i.acquisition_value)}</td>
                <td className="p-2 text-right text-xs">{fmtMoney(i.current_value)}</td>
                <td className="p-2 text-xs">{i.depreciation_rate ? i.depreciation_rate + "%" : "—"}</td>
                <td className="p-2 text-xs">{i.location || "—"}</td>
                <td className="p-2"><span className={`text-xs px-1.5 py-0.5 rounded ${(ASSET_STATUS.find(s => s.value === i.status) || {}).color}`}>{(ASSET_STATUS.find(s => s.value === i.status) || {}).label || i.status}</span></td>
                <td className="p-2 text-right whitespace-nowrap">
                  <button onClick={() => { setEditing(i); setShowForm(true); }} className="p-1 hover:bg-gray-100 rounded">✏️</button>
                  <button onClick={() => handleDelete(i)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showForm && <AssetForm user={user} editing={editing} onClose={() => setShowForm(false)} onSaved={load} />}
      {showImport && <ImportFromNfModal user={user} onClose={() => setShowImport(false)} onSaved={load} />}
    </div>
  );
}

function AssetForm({ user, editing, onClose, onSaved }) {
  const [structures, setStructures] = useState([]);
  useEffect(() => {
    (async () => {
      try { setStructures(await base44.entities.ErpAssetStructure.filter({ user_email: user.email }, "name", 200)); }
      catch (e) { console.error(e); }
    })();
  }, [user.email]);
  const [form, setForm] = useState({
    code: editing?.code || "",
    structure_id: editing?.structure_id || "",
    icms_value: editing?.icms_value || 0,
    name: editing?.name || "",
    acquisition_date: editing?.acquisition_date ? editing.acquisition_date.slice(0, 10) : "",
    acquisition_value: editing?.acquisition_value || 0,
    depreciation_rate: editing?.depreciation_rate || 0,
    current_value: editing?.current_value || 0,
    location: editing?.location || "",
    status: editing?.status || "ativo",
    notes: editing?.notes || "",
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) { alert("Informe o nome do bem."); return; }
    setSaving(true);
    const payload = {
      user_email: user.email,
      ...form,
      structure_name: (structures.find(s => s.id === form.structure_id) || {}).name || "",
      icms_value: Number(form.icms_value) || 0,
      acquisition_value: Number(form.acquisition_value) || 0,
      current_value: Number(form.current_value) || 0,
      depreciation_rate: Number(form.depreciation_rate) || 0,
      acquisition_date: form.acquisition_date ? new Date(form.acquisition_date).toISOString() : undefined,
    };
    try {
      if (editing?.id) await base44.entities.ErpFixedAsset.update(editing.id, payload);
      else await base44.entities.ErpFixedAsset.create(payload);
      onSaved(); onClose();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white"><h2 className="font-bold">{editing ? "Editar Bem" : "Novo Bem Patrimonial"}</h2><button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button></div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Código</Label><Input value={form.code} onChange={e => set("code", e.target.value)} placeholder="Ex: BEM-001" /></div>
            <div><Label>Status</Label><select value={form.status} onChange={e => set("status", e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm">{ASSET_STATUS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select></div>
          </div>
          <div><Label>Bem *</Label><Input value={form.name} onChange={e => set("name", e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Estrutura Patrimonial</Label>
              <select value={form.structure_id} onChange={e => set("structure_id", e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm">
                <option value="">Selecione...</option>
                {structures.filter(s => s.is_active !== false).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div><Label>ICMS na Aquisição (CIAP)</Label><Input type="number" step="0.01" value={form.icms_value} onChange={e => set("icms_value", e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Data Aquisição</Label><Input type="date" value={form.acquisition_date} onChange={e => set("acquisition_date", e.target.value)} /></div>
            <div><Label>Localização</Label><Input value={form.location} onChange={e => set("location", e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Vl. Aquisição</Label><Input type="number" step="0.01" value={form.acquisition_value} onChange={e => set("acquisition_value", e.target.value)} /></div>
            <div><Label>Depreciação (% a.a.)</Label><Input type="number" step="0.01" value={form.depreciation_rate} onChange={e => set("depreciation_rate", e.target.value)} /></div>
            <div><Label>Vl. Atual</Label><Input type="number" step="0.01" value={form.current_value} onChange={e => set("current_value", e.target.value)} /></div>
          </div>
          <div><Label>Observações</Label><Input value={form.notes} onChange={e => set("notes", e.target.value)} /></div>
        </div>
        <div className="p-4 border-t flex gap-2 justify-end sticky bottom-0 bg-white">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </div>
      </div>
    </div>
  );
}

function ImportFromNfModal({ user, onClose, onSaved }) {
  const [orders, setOrders] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState({});
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const all = await base44.entities.ErpPurchaseOrder.filter({ user_email: user.email, is_patrimonio: true }, "-emission_date", 200);
        const eligible = all.filter(o => ["recebida", "recebida_parcial"].includes(o.status) && (o.items || []).length > 0);
        setOrders(eligible);
        const existing = await base44.entities.ErpFixedAsset.filter({ user_email: user.email }, "code", 500);
        setAssets(existing);
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, [user.email]);

  const alreadyImported = (orderNumber, productName) => assets.some(a => a.notes && a.notes.includes(`NF: ${orderNumber}`) && a.name === productName);

  const toggleItem = (orderId, itemKey) => {
    setSelected(prev => { const k = `${orderId}__${itemKey}`; const n = { ...prev }; if (n[k]) delete n[k]; else n[k] = true; return n; });
  };

  const handleImport = async () => {
    const toCreate = [];
    orders.forEach(o => {
      (o.items || []).forEach((it, idx) => {
        if (selected[`${o.id}__${idx}`]) {
          for (let q = 0; q < (Number(it.quantity) || 1); q++) {
            toCreate.push({
              user_email: user.email,
              code: `${o.order_number}-${idx + 1}${(Number(it.quantity) || 1) > 1 ? `-${q + 1}` : ""}`,
              name: it.product_name || "Bem importado",
              acquisition_date: o.emission_date,
              acquisition_value: Number(it.unit_cost) || 0,
              current_value: Number(it.unit_cost) || 0,
              depreciation_rate: 0,
              location: "",
              status: "ativo",
              notes: `Importado de NF de entrada — ${o.order_number} (Fornecedor: ${o.supplier_name || "—"}, Operação: ${o.operation_name || "—"})`,
            });
          }
        }
      });
    });
    if (toCreate.length === 0) { alert("Selecione ao menos um item para importar."); return; }
    setImporting(true);
    try {
      await base44.entities.ErpFixedAsset.bulkCreate(toCreate);
      alert(`${toCreate.length} bem(ns) importado(s) com sucesso.`);
      onSaved(); onClose();
    } catch (e) { alert(e.message); }
    setImporting(false);
  };

  const selectedCount = Object.keys(selected).length;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <div><h2 className="font-bold">Importar Bens de NF de Entrada</h2><p className="text-xs text-gray-400">Notas recebidas cuja operação gera patrimônio</p></div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          {loading ? <p className="text-center text-gray-400 py-8">Carregando...</p>
          : orders.length === 0 ? <p className="text-center text-gray-400 py-8">Nenhuma NF de entrada recebida com operação marcada como patrimônio. Marque a operação em Suprimentos → Operações e receba o pedido de compra.</p>
          : orders.map(o => (
            <div key={o.id} className="border rounded-lg overflow-hidden">
              <div className="p-2 bg-gray-50 border-b flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm font-semibold">{o.order_number}</span>
                <span className="text-xs text-gray-500">{new Date(o.emission_date).toLocaleDateString("pt-BR")}</span>
                <span className="text-xs text-gray-500">· {o.supplier_name}</span>
                <span className="text-xs text-gray-500">· {o.operation_name}</span>
                <span className="text-xs text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded ml-auto">{o.status}</span>
              </div>
              <table className="w-full text-xs">
                <tbody>
                  {(o.items || []).map((it, idx) => {
                    const imported = alreadyImported(o.order_number, it.product_name);
                    const key = `${o.id}__${idx}`;
                    return (
                      <tr key={idx} className="border-b last:border-0">
                        <td className="p-2 w-8">
                          <input type="checkbox" disabled={imported} checked={!!selected[key]} onChange={() => toggleItem(o.id, idx)} className="w-4 h-4" />
                        </td>
                        <td className="p-2">{it.product_name}</td>
                        <td className="p-2 text-center">{it.quantity} {it.unit}</td>
                        <td className="p-2 text-right">{fmtMoney(it.unit_cost)}</td>
                        <td className="p-2 text-right font-medium">{fmtMoney(it.total)}</td>
                        <td className="p-2 text-right">{imported ? <span className="text-emerald-600 text-[10px]">já importado</span> : ""}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
        <div className="p-4 border-t flex items-center justify-between sticky bottom-0 bg-white">
          <span className="text-sm text-gray-500">{selectedCount} item(ns) selecionado(s)</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button size="sm" onClick={handleImport} disabled={importing} className="bg-amber-600 hover:bg-amber-700">{importing ? "Importando..." : "Importar Selecionados"}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
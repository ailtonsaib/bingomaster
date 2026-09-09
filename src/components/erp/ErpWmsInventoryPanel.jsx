import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, Plus, Trash2, ClipboardList } from "lucide-react";

const STATUS_OPTS = [
  { value: "aberto", label: "Aberto", color: "bg-blue-100 text-blue-700" },
  { value: "contado", label: "Contado", color: "bg-amber-100 text-amber-700" },
  { value: "ajustado", label: "Ajustado", color: "bg-emerald-100 text-emerald-700" },
];
const INV_TYPES = [
  { value: "fisico", label: "Inventário Físico" },
  { value: "ciclico", label: "Inventário Cíclico" },
];
const todayISO = () => new Date().toISOString().slice(0, 10);

export default function ErpWmsInventoryPanel({ user }) {
  const [items, setItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [counting, setCounting] = useState(null);
  const [countForm, setCountForm] = useState({ counted_qty: 0, adjust: true });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [inv, p, w, l] = await Promise.all([
        base44.entities.ErpWmsInventory.filter({ user_email: user.email }, "-created_date", 500),
        base44.entities.ErpProduct.filter({ user_email: user.email }, "-created_date", 500),
        base44.entities.ErpWarehouse.filter({ user_email: user.email }, "-created_date", 500),
        base44.entities.ErpWmsLocation.filter({ user_email: user.email }, "-created_date", 500),
      ]);
      setItems(inv); setProducts(p); setWarehouses(w); setLocations(l);
    } catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [user.email]);

  const filtered = items.filter(it => {
    if (statusFilter && it.status !== statusFilter) return false;
    const t = [it.product_name, it.product_code, it.warehouse_name, it.location_code].map(v => String(v ?? "")).join(" ").toLowerCase();
    return t.includes(search.toLowerCase());
  });

  const saveCount = async () => {
    setSaving(true);
    try {
      const counted = Number(countForm.counted_qty) || 0;
      const systemQty = Number(counting.system_qty) || 0;
      const diff = counted - systemQty;
      const adjust = countForm.adjust && diff !== 0;
      if (adjust) {
        const product = products.find(p => p.id === counting.product_id);
        if (product) await base44.entities.ErpProduct.update(product.id, { stock: counted });
        await base44.entities.ErpWmsMove.create({
          user_email: user.email,
          move_type: diff > 0 ? "entrada" : "saida",
          product_id: counting.product_id,
          product_code: counting.product_code || "",
          product_name: counting.product_name || "",
          unit: product?.unit || "",
          quantity: Math.abs(diff),
          warehouse_id: counting.warehouse_id || "",
          warehouse_name: counting.warehouse_name || "",
          location_id: counting.location_id || "",
          location_code: counting.location_code || "",
          document: `Inventário ${(counting.count_date || "").slice(0, 10)}`,
          move_date: todayISO(),
          notes: "Ajuste de inventário",
        });
      }
      await base44.entities.ErpWmsInventory.update(counting.id, {
        counted_qty: counted,
        status: adjust ? "ajustado" : "contado",
      });
      setCounting(null); load();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-semibold text-base">Inventário (Físico / Cíclico)</h2>
        <Button size="sm" onClick={() => setShowForm(true)} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"><Plus className="w-4 h-4" /> Nova Contagem</Button>
      </div>
      <p className="text-xs text-gray-500 -mt-1">Contagem física por produto/endereço. Divergências podem ser ajustadas automaticamente: o saldo do produto é corrigido e a diferença é registrada como movimentação de estoque.</p>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar produto, armazém, endereço..." className="w-full h-9 rounded-md border border-input bg-transparent pl-9 pr-3 text-sm" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="h-9 rounded-md border border-input bg-white px-3 text-sm">
          <option value="">Todos os status</option>
          {STATUS_OPTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-gray-500 text-xs">
              <tr>
                <th className="p-2 text-left">Data</th><th className="p-2 text-left">Tipo</th><th className="p-2 text-left">Produto</th>
                <th className="p-2 text-left">Armazém</th><th className="p-2 text-left">Endereço</th><th className="p-2 text-right">Qtd Sistema</th>
                <th className="p-2 text-right">Qtd Contada</th><th className="p-2 text-right">Divergência</th><th className="p-2 text-left">Status</th><th className="p-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className="p-6 text-center text-gray-400">Carregando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={10} className="p-8 text-center text-gray-400">Nenhuma contagem de inventário.</td></tr>
              ) : filtered.map(it => {
                const counted = it.status !== "aberto" ? (Number(it.counted_qty) || 0) : null;
                const diff = counted !== null ? counted - (Number(it.system_qty) || 0) : null;
                const so = STATUS_OPTS.find(s => s.value === it.status);
                const to = INV_TYPES.find(t => t.value === it.inventory_type);
                return (
                  <tr key={it.id} className="border-t hover:bg-gray-50">
                    <td className="p-2 text-xs">{(it.count_date || "").slice(0, 10) || "—"}</td>
                    <td className="p-2 text-xs">{to ? to.label : it.inventory_type}</td>
                    <td className="p-2">{it.product_code ? <span className="font-mono text-xs mr-1">{it.product_code}</span> : null}{it.product_name || "—"}</td>
                    <td className="p-2">{it.warehouse_name || "—"}</td>
                    <td className="p-2 font-mono text-xs">{it.location_code || "—"}</td>
                    <td className="p-2 text-right">{Number(it.system_qty || 0).toLocaleString("pt-BR")}</td>
                    <td className="p-2 text-right">{counted !== null ? counted.toLocaleString("pt-BR") : "—"}</td>
                    <td className="p-2 text-right font-medium">
                      {diff === null ? "—" : (
                        <span className={diff === 0 ? "text-emerald-600" : diff > 0 ? "text-amber-600" : "text-red-600"}>
                          {diff > 0 ? "+" : ""}{diff.toLocaleString("pt-BR")}
                        </span>
                      )}
                    </td>
                    <td className="p-2">{so ? <span className={`text-xs px-2 py-0.5 rounded-full ${so.color}`}>{so.label}</span> : it.status}</td>
                    <td className="p-2 text-right whitespace-nowrap">
                      {it.status !== "ajustado" && (
                        <button title="Registrar Contagem" onClick={() => { setCounting(it); setCountForm({ counted_qty: it.counted_qty || 0, adjust: true }); }} className="p-1 hover:bg-blue-50 rounded"><ClipboardList className="w-4 h-4 text-blue-500" /></button>
                      )}
                      <button title="Excluir" onClick={async () => { if (confirm("Excluir esta contagem?")) { await base44.entities.ErpWmsInventory.delete(it.id); load(); } }} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <InventoryForm
          user={user} products={products} warehouses={warehouses} locations={locations}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}

      {counting && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="font-bold">Contagem — {counting.product_name}</h2>
              <button onClick={() => setCounting(null)} className="p-1 hover:bg-gray-100 rounded text-gray-500">✕</button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-sm text-gray-600">
                Endereço: <b className="font-mono">{counting.location_code || "—"}</b> · Quantidade em sistema: <b>{Number(counting.system_qty || 0).toLocaleString("pt-BR")}</b>
              </p>
              <div>
                <Label className="text-xs font-medium text-gray-600">Quantidade Física Contada</Label>
                <Input type="number" step="0.01" value={countForm.counted_qty} onChange={e => setCountForm(p => ({ ...p, counted_qty: e.target.value }))} className="mt-1" />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={countForm.adjust} onChange={e => setCountForm(p => ({ ...p, adjust: e.target.checked }))} className="w-4 h-4" />
                Ajustar o saldo do estoque automaticamente (gera movimentação da diferença)
              </label>
            </div>
            <div className="p-4 border-t flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setCounting(null)}>Cancelar</Button>
              <Button size="sm" disabled={saving} onClick={saveCount} className="bg-emerald-600 hover:bg-emerald-700">{saving ? "Salvando..." : "Registrar Contagem"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InventoryForm({ user, products, warehouses, locations, onClose, onSaved }) {
  const [form, setForm] = useState({
    inventory_type: "fisico", product_id: "", warehouse_id: "", location_id: "", count_date: todayISO(), notes: "",
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(prev => {
    const next = { ...prev, [k]: v };
    if (k === "warehouse_id") { next.location_id = ""; }
    return next;
  });

  const selectedProduct = products.find(p => p.id === form.product_id);
  const whLocations = locations.filter(l => l.warehouse_id === form.warehouse_id);

  const save = async () => {
    if (!form.product_id) return alert("Selecione o produto.");
    if (!form.warehouse_id) return alert("Selecione o armazém.");
    setSaving(true);
    try {
      const loc = locations.find(l => l.id === form.location_id);
      const wh = warehouses.find(w => w.id === form.warehouse_id);
      await base44.entities.ErpWmsInventory.create({
        user_email: user.email,
        ...form,
        product_code: selectedProduct?.code || "",
        product_name: selectedProduct?.name || "",
        unit: selectedProduct?.unit || "",
        warehouse_name: wh?.name || "",
        location_code: loc?.code || "",
        system_qty: Number(selectedProduct?.stock) || 0,
      });
      onSaved();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h2 className="font-bold">Nova Contagem de Inventário</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded text-gray-500">✕</button>
        </div>
        <div className="p-4 grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label className="text-xs font-medium text-gray-600">Tipo de Inventário</Label>
            <select value={form.inventory_type} onChange={e => set("inventory_type", e.target.value)} className="w-full h-9 rounded-md border border-input bg-white px-3 text-sm mt-1">
              {INV_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <Label className="text-xs font-medium text-gray-600">Produto *</Label>
            <select value={form.product_id} onChange={e => set("product_id", e.target.value)} className="w-full h-9 rounded-md border border-input bg-white px-3 text-sm mt-1">
              <option value="">Selecione...</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.code ? p.code + " — " : ""}{p.name} (saldo: {Number(p.stock || 0).toLocaleString("pt-BR")})</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs font-medium text-gray-600">Armazém *</Label>
            <select value={form.warehouse_id} onChange={e => set("warehouse_id", e.target.value)} className="w-full h-9 rounded-md border border-input bg-white px-3 text-sm mt-1">
              <option value="">Selecione...</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.code ? w.code + " — " : ""}{w.name}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs font-medium text-gray-600">Endereço</Label>
            <select value={form.location_id} onChange={e => set("location_id", e.target.value)} className="w-full h-9 rounded-md border border-input bg-white px-3 text-sm mt-1">
              <option value="">Selecione...</option>
              {whLocations.map(l => <option key={l.id} value={l.id}>{l.code}{l.zone ? " — " + l.zone : ""}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs font-medium text-gray-600">Data da Contagem</Label>
            <Input type="date" value={form.count_date} onChange={e => set("count_date", e.target.value)} className="mt-1" />
          </div>
          <div className="col-span-2">
            <Label className="text-xs font-medium text-gray-600">Observações</Label>
            <Input value={form.notes} onChange={e => set("notes", e.target.value)} className="mt-1" />
          </div>
          {selectedProduct && (
            <p className="col-span-2 text-xs text-gray-500">Saldo atual em sistema: <b>{Number(selectedProduct.stock || 0).toLocaleString("pt-BR")} {selectedProduct.unit || ""}</b> (capturado na abertura da contagem)</p>
          )}
        </div>
        <div className="p-4 border-t flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" disabled={saving} onClick={save} className="bg-emerald-600 hover:bg-emerald-700">{saving ? "Salvando..." : "Abrir Contagem"}</Button>
        </div>
      </div>
    </div>
  );
}
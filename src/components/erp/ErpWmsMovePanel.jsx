import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, Plus, Trash2, ArrowDownCircle, ArrowUpCircle, ArrowLeftRight, Package } from "lucide-react";

const MOVE_TYPES = [
  { value: "entrada", label: "Entrada", color: "bg-emerald-100 text-emerald-700", icon: ArrowDownCircle },
  { value: "saida", label: "Saída", color: "bg-rose-100 text-rose-700", icon: ArrowUpCircle },
  { value: "transferencia", label: "Transferência", color: "bg-blue-100 text-blue-700", icon: ArrowLeftRight },
];
const todayISO = () => new Date().toISOString().slice(0, 10);

export default function ErpWmsMovePanel({ user }) {
  const [moves, setMoves] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [m, p, w, l] = await Promise.all([
        base44.entities.ErpWmsMove.filter({ user_email: user.email }, "-created_date", 500),
        base44.entities.ErpProduct.filter({ user_email: user.email }, "-created_date", 500),
        base44.entities.ErpWarehouse.filter({ user_email: user.email }, "-created_date", 500),
        base44.entities.ErpWmsLocation.filter({ user_email: user.email }, "-created_date", 500),
      ]);
      setMoves(m); setProducts(p); setWarehouses(w); setLocations(l);
    } catch (err) { console.error(err); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [user.email]);

  const filtered = moves.filter(m => {
    if (typeFilter && m.move_type !== typeFilter) return false;
    const t = [m.product_name, m.product_code, m.document, m.lot, m.warehouse_name, m.location_code, m.target_location_code].map(v => String(v ?? "")).join(" ").toLowerCase();
    return t.includes(search.toLowerCase());
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-semibold text-base">Movimentações de Estoque (WMS)</h2>
        <Button size="sm" onClick={() => setShowForm(true)} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"><Plus className="w-4 h-4" /> Nova Movimentação</Button>
      </div>
      <p className="text-xs text-gray-500 -mt-1">Entradas e saídas atualizam automaticamente o saldo do produto no cadastro. Transferências movem o produto entre endereços.</p>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar produto, lote, documento, endereço..." className="w-full h-9 rounded-md border border-input bg-transparent pl-9 pr-3 text-sm" />
        </div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="h-9 rounded-md border border-input bg-white px-3 text-sm">
          <option value="">Todos os tipos</option>
          {MOVE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-gray-500 text-xs">
              <tr>
                <th className="p-2 text-left">Data</th><th className="p-2 text-left">Tipo</th><th className="p-2 text-left">Produto</th>
                <th className="p-2 text-right">Qtd</th><th className="p-2 text-left">Armazém</th><th className="p-2 text-left">Endereço</th>
                <th className="p-2 text-left">Destino</th><th className="p-2 text-left">Lote</th><th className="p-2 text-left">Documento</th><th className="p-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className="p-6 text-center text-gray-400">Carregando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={10} className="p-8 text-center text-gray-400">Nenhuma movimentação.</td></tr>
              ) : filtered.map(m => {
                const t = MOVE_TYPES.find(t => t.value === m.move_type);
                return (
                  <tr key={m.id} className="border-t hover:bg-gray-50">
                    <td className="p-2 text-xs">{(m.move_date || "").slice(0, 10) || "—"}</td>
                    <td className="p-2">{t ? <span className={`text-xs px-2 py-0.5 rounded-full ${t.color}`}>{t.label}</span> : m.move_type}</td>
                    <td className="p-2">{m.product_code ? <span className="font-mono text-xs mr-1">{m.product_code}</span> : null}{m.product_name || "—"}</td>
                    <td className="p-2 text-right font-medium">{Number(m.quantity || 0).toLocaleString("pt-BR")} {m.unit || ""}</td>
                    <td className="p-2">{m.warehouse_name || "—"}</td>
                    <td className="p-2 font-mono text-xs">{m.location_code || "—"}</td>
                    <td className="p-2 font-mono text-xs">{m.target_location_code || "—"}</td>
                    <td className="p-2 text-xs">{m.lot || "—"}</td>
                    <td className="p-2 text-xs">{m.document || "—"}</td>
                    <td className="p-2 text-right">
                      <button onClick={async () => { if (confirm("Excluir esta movimentação? O saldo do produto não será revertido.")) { await base44.entities.ErpWmsMove.delete(m.id); load(); } }} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <MoveForm
          user={user}
          products={products} warehouses={warehouses} locations={locations}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}
    </div>
  );
}

function MoveForm({ user, products, warehouses, locations, onClose, onSaved }) {
  const [form, setForm] = useState({
    move_type: "entrada", product_id: "", quantity: 0, warehouse_id: "", location_id: "",
    target_location_id: "", lot: "", expiry_date: "", document: "", move_date: todayISO(), notes: "",
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const selectedProduct = products.find(p => p.id === form.product_id);
  const whLocations = locations.filter(l => l.warehouse_id === form.warehouse_id);

  const save = async () => {
    if (!form.product_id) return alert("Selecione o produto.");
    const qty = Number(form.quantity) || 0;
    if (qty <= 0) return alert("Informe uma quantidade maior que zero.");
    if (!form.warehouse_id) return alert("Selecione o armazém.");
    if (form.move_type === "transferencia" && (!form.location_id || !form.target_location_id)) return alert("Informe os endereços de origem e destino da transferência.");

    setSaving(true);
    try {
      const originLoc = locations.find(l => l.id === form.location_id);
      const targetLoc = locations.find(l => l.id === form.target_location_id);
      // Atualiza o saldo do produto (entrada/saída). Transferência não altera o saldo total.
      if (form.move_type !== "transferencia" && selectedProduct) {
        const stock = Number(selectedProduct.stock) || 0;
        if (form.move_type === "saida" && stock < qty) {
          setSaving(false);
          return alert(`Estoque insuficiente de "${selectedProduct.name}". Saldo atual: ${stock}.`);
        }
        await base44.entities.ErpProduct.update(selectedProduct.id, {
          stock: form.move_type === "entrada" ? stock + qty : stock - qty,
        });
      }
      await base44.entities.ErpWmsMove.create({
        user_email: user.email,
        ...form,
        quantity: qty,
        product_code: selectedProduct?.code || "",
        product_name: selectedProduct?.name || "",
        unit: selectedProduct?.unit || "",
        warehouse_name: warehouses.find(w => w.id === form.warehouse_id)?.name || "",
        location_code: originLoc?.code || "",
        target_location_code: targetLoc?.code || "",
      });
      onSaved();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h2 className="font-bold">Nova Movimentação</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded text-gray-500">✕</button>
        </div>
        <div className="p-4 grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label className="text-xs font-medium text-gray-600">Tipo de Movimentação *</Label>
            <div className="flex gap-2 mt-1">
              {MOVE_TYPES.map(t => {
                const Icon = t.icon;
                return (
                  <button key={t.value} onClick={() => set("move_type", t.value)}
                    className={`flex-1 h-9 rounded-md border text-xs font-medium flex items-center justify-center gap-1.5 ${form.move_type === t.value ? "border-emerald-600 bg-emerald-50 text-emerald-700" : "border-input text-gray-600 hover:bg-gray-50"}`}>
                    <Icon className="w-3.5 h-3.5" /> {t.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="col-span-2">
            <Label className="text-xs font-medium text-gray-600">Produto *</Label>
            <select value={form.product_id} onChange={e => set("product_id", e.target.value)} className="w-full h-9 rounded-md border border-input bg-white px-3 text-sm mt-1">
              <option value="">Selecione...</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.code ? p.code + " — " : ""}{p.name} (saldo: {Number(p.stock || 0).toLocaleString("pt-BR")})</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs font-medium text-gray-600">Quantidade *</Label>
            <Input type="number" step="0.01" value={form.quantity} onChange={e => set("quantity", e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs font-medium text-gray-600">Data</Label>
            <Input type="date" value={form.move_date} onChange={e => set("move_date", e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs font-medium text-gray-600">Armazém *</Label>
            <select value={form.warehouse_id} onChange={e => { set("warehouse_id", e.target.value); set("location_id", ""); set("target_location_id", ""); }} className="w-full h-9 rounded-md border border-input bg-white px-3 text-sm mt-1">
              <option value="">Selecione...</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.code ? w.code + " — " : ""}{w.name}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs font-medium text-gray-600">
              {form.move_type === "entrada" ? "Endereço de Destino" : "Endereço de Origem"}
            </Label>
            <select value={form.location_id} onChange={e => set("location_id", e.target.value)} className="w-full h-9 rounded-md border border-input bg-white px-3 text-sm mt-1">
              <option value="">Selecione...</option>
              {whLocations.map(l => <option key={l.id} value={l.id}>{l.code}{l.zone ? " — " + l.zone : ""}</option>)}
            </select>
          </div>
          {form.move_type === "transferencia" && (
            <div className="col-span-2">
              <Label className="text-xs font-medium text-gray-600">Endereço de Destino *</Label>
              <select value={form.target_location_id} onChange={e => set("target_location_id", e.target.value)} className="w-full h-9 rounded-md border border-input bg-white px-3 text-sm mt-1">
                <option value="">Selecione...</option>
                {whLocations.filter(l => l.id !== form.location_id).map(l => <option key={l.id} value={l.id}>{l.code}{l.zone ? " — " + l.zone : ""}</option>)}
              </select>
            </div>
          )}
          <div>
            <Label className="text-xs font-medium text-gray-600">Lote</Label>
            <Input value={form.lot} onChange={e => set("lot", e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs font-medium text-gray-600">Validade (FIFO/FEFO)</Label>
            <Input type="date" value={form.expiry_date} onChange={e => set("expiry_date", e.target.value)} className="mt-1" />
          </div>
          <div className="col-span-2">
            <Label className="text-xs font-medium text-gray-600">Documento (NF, pedido, requisição)</Label>
            <Input value={form.document} onChange={e => set("document", e.target.value)} className="mt-1" />
          </div>
        </div>
        <div className="p-4 border-t flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" disabled={saving} onClick={save} className="bg-emerald-600 hover:bg-emerald-700 gap-1.5">{saving ? "Salvando..." : <><Package className="w-3.5 h-3.5" /> Movimentar</>}</Button>
        </div>
      </div>
    </div>
  );
}
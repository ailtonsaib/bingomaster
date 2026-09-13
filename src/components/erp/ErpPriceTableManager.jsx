import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Search, Trash2, X, CircleDollarSign } from "lucide-react";
import { fmtDate, fmtMoney } from "@/lib/erpUtils";

const PRODUCT_TYPES = [
  { value: "", label: "Todos os tipos" },
  { value: "materia_prima", label: "Matéria-Prima" },
  { value: "mercadoria", label: "Mercadoria" },
  { value: "produto_acabado", label: "Produto Acabado" },
  { value: "produto_em_processo", label: "Produto em Processo" },
  { value: "insumo", label: "Insumo" },
  { value: "consumo", label: "Consumo" },
  { value: "servico", label: "Serviço" },
];

// Tabelas de preço: cadastro com vigência (início/fim) e preço por produto
export default function ErpPriceTableManager({ user }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      setItems(await base44.entities.ErpPriceTable.filter({ user_email: user.email }, "-created_date", 500));
    } catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [user.email]);

  const filtered = items.filter(t => (t.name || "").toLowerCase().includes(search.toLowerCase()));
  const handleDelete = async (t) => {
    if (!confirm(`Excluir a tabela de preço "${t.name}"?`)) return;
    await base44.entities.ErpPriceTable.delete(t.id);
    load();
  };

  const vigencia = (t) => t.start_date ? `${fmtDate(t.start_date)}${t.end_date ? ` a ${fmtDate(t.end_date)}` : " em diante"}` : "—";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar tabela..." className="w-full h-9 rounded-md border border-input bg-transparent pl-9 pr-3 text-sm" />
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setShowForm(true); }} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"><Plus className="w-4 h-4" /> Nova Tabela de Preço</Button>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-gray-500 text-xs">
              <tr>
                <th className="p-2 text-left">Tabela</th>
                <th className="p-2 text-left">Vigência</th>
                <th className="p-2 text-right">Produtos</th>
                <th className="p-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={4} className="p-6 text-center text-gray-400">Carregando...</td></tr>
              : filtered.length === 0 ? <tr><td colSpan={4} className="p-8 text-center text-gray-400"><CircleDollarSign className="w-10 h-10 mx-auto mb-2 opacity-30" /> Nenhuma tabela de preço cadastrada.</td></tr>
              : filtered.map(t => (
                <tr key={t.id} className="border-t hover:bg-gray-50">
                  <td className="p-2 font-medium">{t.name}</td>
                  <td className="p-2 text-xs">{vigencia(t)}</td>
                  <td className="p-2 text-right">{(t.items || []).length}</td>
                  <td className="p-2 text-right whitespace-nowrap">
                    <button onClick={() => { setEditing(t); setShowForm(true); }} className="p-1 hover:bg-gray-100 rounded">✏️</button>
                    <button onClick={() => handleDelete(t)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && <ErpPriceTableForm user={user} editing={editing} onClose={() => setShowForm(false)} onSaved={load} />}
    </div>
  );
}

function ErpPriceTableForm({ user, editing, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: editing?.name || "",
    start_date: editing?.start_date ? String(editing.start_date).slice(0, 10) : new Date().toISOString().slice(0, 10),
    end_date: editing?.end_date ? String(editing.end_date).slice(0, 10) : "",
    notes: editing?.notes || "",
  });
  const [items, setItems] = useState((editing?.items || []).map(i => ({ ...i, price: Number(i.price) || 0 })));
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const [filterType, setFilterType] = useState("");

  useEffect(() => {
    const load = async () => {
      const list = [];
      try {
        for (let skip = 0; skip < 5000; skip += 500) {
          const page = await base44.entities.ErpProduct.filter({ user_email: user.email, is_active: true }, "name", 500, skip);
          list.push(...page);
          if (page.length < 500) break;
        }
      } catch (e) { console.error(e); }
      setProducts(list);
    };
    load();
  }, [user.email]);

  const filteredProducts = products.filter(p =>
    (!filterType || p.product_type === filterType) &&
    !items.find(i => i.product_id === p.id) &&
    p.name.toLowerCase().includes(search.toLowerCase())
  );
  // traz todos os produtos ativos do filtro de tipo para a tabela de preço
  const addAllFiltered = () => {
    setItems(prev => [...prev, ...filteredProducts.map(p => ({ product_id: p.id, product_code: p.code || "", product_name: p.name, unit: p.unit || "UN", price: 0 }))]);
    setSearch("");
  };
  const addProduct = (p) => {
    setItems(prev => [...prev, { product_id: p.id, product_code: p.code || "", product_name: p.name, unit: p.unit || "UN", price: Number(p.sale_price) || 0 }]);
    setSearch("");
  };
  const setPrice = (idx, v) => setItems(prev => prev.map((it, i) => i === idx ? { ...it, price: Number(v) || 0 } : it));
  const removeItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx));
  const missingPrice = items.filter(i => !(Number(i.price) > 0)).length;

  const handleSave = async () => {
    if (!form.name.trim()) { alert("Informe o nome da tabela."); return; }
    if (!form.start_date) { alert("Informe o início da vigência."); return; }
    if (form.end_date && form.end_date < form.start_date) { alert("O fim da vigência deve ser posterior ao início."); return; }
    if (!items.length) { alert("Adicione ao menos um produto à tabela."); return; }
    if (missingPrice > 0) { alert("Informe o preço de venda de todos os produtos da tabela antes de salvar."); return; }
    setSaving(true);
    const payload = {
      user_email: user.email,
      name: form.name.trim(),
      start_date: new Date(`${form.start_date}T12:00:00`).toISOString(),
      end_date: form.end_date ? new Date(`${form.end_date}T12:00:00`).toISOString() : undefined,
      items: items.map(i => ({ product_id: i.product_id, product_code: i.product_code, product_name: i.product_name, unit: i.unit, price: i.price })),
      notes: form.notes || undefined,
    };
    try {
      if (editing?.id) await base44.entities.ErpPriceTable.update(editing.id, payload);
      else await base44.entities.ErpPriceTable.create(payload);
      onSaved(); onClose();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
          <h2 className="font-bold">{editing ? "Editar Tabela de Preço" : "Nova Tabela de Preço"}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          <div><Label>Nome da Tabela *</Label><Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Ex: Tabela Prazo 30 dias" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Início da Vigência *</Label><Input type="date" value={form.start_date} onChange={e => set("start_date", e.target.value)} /></div>
            <div><Label>Fim da Vigência</Label><Input type="date" value={form.end_date} onChange={e => set("end_date", e.target.value)} /></div>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <div className="p-2 bg-gray-50 border-b flex items-center gap-2 flex-wrap">
              <select value={filterType} onChange={e => setFilterType(e.target.value)} className="h-8 rounded-md border border-input bg-white px-2 text-sm">
                {PRODUCT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <div className="relative flex-1 min-w-[160px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar produto p/ adicionar..." className="w-full h-8 rounded-md border border-input bg-white pl-9 pr-3 text-sm" />
              </div>
              <Button type="button" variant="outline" size="sm" className="h-8" onClick={addAllFiltered} disabled={filteredProducts.length === 0}>Trazer todos ({filteredProducts.length})</Button>
            </div>
            {filteredProducts.length > 0 && (
              <div className="flex flex-wrap gap-1 p-2 border-b max-h-24 overflow-y-auto">
                {filteredProducts.slice(0, 20).map(p => (
                  <button key={p.id} type="button" onClick={() => addProduct(p)} className="text-xs px-2 py-1 rounded-full border border-gray-200 hover:bg-gray-100">+ {p.name}</button>
                ))}
              </div>
            )}
            {items.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">Nenhum produto na tabela.</p>
            ) : (
              <div className="overflow-x-auto max-h-72 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 text-gray-500 text-xs sticky top-0">
                    <tr>
                      <th className="p-2 text-left">Produto</th>
                      <th className="p-2 text-center">Un.</th>
                      <th className="p-2 text-right">Preço (R$)</th>
                      <th className="p-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, idx) => (
                      <tr key={it.product_id} className="border-t">
                        <td className="p-2">{it.product_code ? `${it.product_code} — ` : ""}{it.product_name}</td>
                        <td className="p-2 text-center text-xs">{it.unit}</td>
                        <td className="p-2 text-right">
                          <input type="number" step="0.01" value={it.price} onChange={e => setPrice(idx, e.target.value)} className="w-28 h-8 rounded border border-input px-2 text-right text-sm" />
                        </td>
                        <td className="p-2 text-center"><button type="button" onClick={() => removeItem(idx)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5 text-red-500" /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div><Label>Observações</Label><textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" /></div>
        </div>
        <div className="p-4 border-t flex gap-2 justify-end sticky bottom-0 bg-white">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <div className="text-xs text-gray-500 mr-auto">{items.length > 0 ? `${items.length - missingPrice} de ${items.length} produtos com preço informado` : ""}</div>
          <Button size="sm" onClick={handleSave} disabled={saving || !items.length || missingPrice > 0} className="bg-emerald-600 hover:bg-emerald-700">{saving ? "Salvando..." : "Salvar Tabela"}</Button>
        </div>
      </div>
    </div>
  );
}
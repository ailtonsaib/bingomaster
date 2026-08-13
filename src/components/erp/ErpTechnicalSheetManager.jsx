import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Plus, Search, Trash2, FileStack, ChevronRight, ArrowLeft, Layers } from "lucide-react";
import { fmtMoney } from "@/lib/erpUtils";

export default function ErpTechnicalSheetManager({ user }) {
  const [sheets, setSheets] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null); // ficha em edição
  const [crumb, setCrumb] = useState([]); // pilha de fichas pai (para navegação de subprodutos)

  const load = async () => {
    setLoading(true);
    try {
      const [s, p] = await Promise.all([
        base44.entities.ErpTechnicalSheet.filter({ user_email: user.email }, "code", 500),
        base44.entities.ErpProduct.filter({ user_email: user.email }, "name", 1000),
      ]);
      setSheets(s); setProducts(p);
    } catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [user.email]);

  const productsById = {};
  products.forEach(p => { productsById[p.id] = p; });
  const sheetsByProduct = {};
  sheets.forEach(s => { sheetsByProduct[s.product_id] = s; });

  // Custo recursivo de uma ficha (lote) — lida com subprodutos
  const sheetLotCost = (sheetId, visited = new Set()) => {
    if (visited.has(sheetId)) return 0; // ciclo
    visited.add(sheetId);
    const sheet = sheets.find(s => s.id === sheetId);
    if (!sheet) return 0;
    let total = 0;
    for (const it of (sheet.items || [])) {
      if (it.item_type === "subproduto") {
        const sub = sheetsByProduct[it.product_id];
        if (sub) {
          const subYield = Number(sub.yield_quantity) || 1;
          const subLotCost = sheetLotCost(sub.id, new Set(visited));
          total += (Number(it.quantity) || 0) * (subLotCost / subYield);
        } else {
          const p = productsById[it.product_id];
          total += (Number(it.quantity) || 0) * (Number(p?.cost_price) || 0);
        }
      } else {
        const p = productsById[it.product_id];
        total += (Number(it.quantity) || 0) * (Number(p?.cost_price) || 0);
      }
    }
    return total;
  };

  const filtered = sheets.filter(s => {
    const t = (`${s.code} ${s.product_name}`).toLowerCase();
    return t.includes(search.toLowerCase());
  });

  const handleDelete = async (s) => {
    if (!confirm(`Excluir a ficha técnica de "${s.product_name}"?`)) return;
    await base44.entities.ErpTechnicalSheet.delete(s.id);
    load();
  };

  // Abrir ficha de subproduto (navegação aninhada)
  const openSubSheet = (productId) => {
    const sub = sheetsByProduct[productId];
    if (!sub) { alert("Este subproduto ainda não possui ficha técnica. Crie uma para ele."); return; }
    setCrumb(c => [...c, editing.id]);
    setEditing(sub);
  };

  const goBack = () => {
    if (crumb.length === 0) { setEditing(null); return; }
    const parentId = crumb[crumb.length - 1];
    const parent = sheets.find(s => s.id === parentId);
    setCrumb(c => c.slice(0, -1));
    setEditing(parent || null);
  };

  if (editing) {
    return (
      <SheetEditor
        key={editing.id || "new"}
        sheet={editing.id ? editing : null}
        sheets={sheets}
        products={products}
        productsById={productsById}
        sheetsByProduct={sheetsByProduct}
        sheetLotCost={sheetLotCost}
        user={user}
        onSaved={load}
        onBack={goBack}
        onOpenSub={openSubSheet}
        crumb={crumb}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar ficha técnica..." className="w-full h-9 rounded-md border border-input bg-transparent pl-9 pr-3 text-sm" />
        </div>
        <Button size="sm" onClick={() => setEditing({ __new: true })} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
          <Plus className="w-4 h-4" /> Nova Ficha Técnica
        </Button>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-gray-500 text-xs">
              <tr>
                <th className="p-2 text-left">Código</th>
                <th className="p-2 text-left">Produto</th>
                <th className="p-2 text-right">Rendimento</th>
                <th className="p-2 text-right">Componentes</th>
                <th className="p-2 text-right">Custo do Lote</th>
                <th className="p-2 text-right">Custo Unit.</th>
                <th className="p-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="p-6 text-center text-gray-400">Carregando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-gray-400">
                  <FileStack className="w-10 h-10 mx-auto mb-2 opacity-30" /> Nenhuma ficha técnica cadastrada.
                </td></tr>
              ) : filtered.map(s => {
                const lot = sheetLotCost(s.id);
                const unit = (Number(s.yield_quantity) || 1) > 0 ? lot / (Number(s.yield_quantity) || 1) : 0;
                return (
                  <tr key={s.id} className="border-t hover:bg-gray-50 cursor-pointer" onClick={() => setEditing(s)}>
                    <td className="p-2 font-mono text-xs">{s.code || "—"}</td>
                    <td className="p-2 font-medium">{s.product_name}</td>
                    <td className="p-2 text-right">{s.yield_quantity} {s.product_unit || ""}</td>
                    <td className="p-2 text-right">{s.items?.length || 0}</td>
                    <td className="p-2 text-right text-blue-600">{fmtMoney(lot)}</td>
                    <td className="p-2 text-right font-semibold text-emerald-600">{fmtMoney(unit)}</td>
                    <td className="p-2 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                      <button onClick={() => setEditing(s)} className="p-1 hover:bg-gray-100 rounded text-xs">✏️</button>
                      <button onClick={() => handleDelete(s)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SheetEditor({ sheet, sheets, products, productsById, sheetsByProduct, sheetLotCost, user, onSaved, onBack, onOpenSub, crumb }) {
  const isNew = !sheet || sheet.__new;
  const [code, setCode] = useState(sheet?.code || "");
  const [productId, setProductId] = useState(sheet?.product_id || "");
  const [yieldQty, setYieldQty] = useState(sheet?.yield_quantity || 1);
  const [description, setDescription] = useState(sheet?.description || "");
  const [items, setItems] = useState(sheet?.items || []);
  const [saving, setSaving] = useState(false);

  const productOptions = products.filter(p => !isNew ? true : (p.product_type === "produto_acabado" || p.product_type === "produto_em_processo"));

  const recompute = (list) => list.map(it => {
    let unitCost = Number(it.unit_cost) || 0;
    if (it.item_type === "subproduto" && it.product_id) {
      const sub = sheetsByProduct[it.product_id];
      if (sub) {
        const subYield = Number(sub.yield_quantity) || 1;
        unitCost = sheetLotCost(sub.id) / subYield;
      }
    } else if (it.product_id) {
      unitCost = Number(productsById[it.product_id]?.cost_price) || 0;
    }
    const total = (Number(it.quantity) || 0) * unitCost;
    return { ...it, unit_cost: unitCost, total };
  });

  const addItem = () => {
    setItems(prev => recompute([...prev, { item_type: "material", product_id: "", product_name: "", product_code: "", product_unit: "", quantity: 1, unit_cost: 0, total: 0 }]));
  };

  const changeItemProduct = (idx, pid) => {
    setItems(prev => prev.map((it, i) => {
      if (i !== idx) return it;
      const p = productsById[pid];
      const isSub = !!sheetsByProduct[pid];
      return recompute([{ ...it, product_id: pid, product_name: p?.name || "", product_code: p?.code || "", product_unit: p?.unit || "", item_type: isSub ? "subproduto" : "material" }])[0];
    }));
  };

  const changeItemQty = (idx, qty) => {
    setItems(prev => recompute(prev.map((it, i) => i === idx ? { ...it, quantity: Number(qty) || 0 } : it)));
  };

  const removeItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx));

  const computed = recompute(items);
  const lotCost = computed.reduce((s, it) => s + (Number(it.total) || 0), 0);
  const unitCost = (Number(yieldQty) || 1) > 0 ? lotCost / (Number(yieldQty) || 1) : 0;

  const save = async () => {
    if (!productId) { alert("Selecione o produto da ficha técnica."); return; }
    const p = productsById[productId];
    setSaving(true);
    const payload = {
      user_email: user.email,
      code, product_id: productId,
      product_name: p?.name || "", product_code: p?.code || "", product_unit: p?.unit || "",
      yield_quantity: Number(yieldQty) || 1,
      description, items: computed,
      total_cost: lotCost, unit_cost: unitCost,
      is_active: sheet?.is_active ?? true,
    };
    try {
      if (isNew) await base44.entities.ErpTechnicalSheet.create(payload);
      else await base44.entities.ErpTechnicalSheet.update(sheet.id, payload);
      onSaved();
      onBack();
    } catch (e) { alert("Erro ao salvar: " + e.message); }
    setSaving(false);
  };

  return (
    <div className="space-y-3 bg-white rounded-xl border p-4">
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-500 hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        {crumb.length > 0 && (
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5" /> Ficha de subproduto (nível {crumb.length})
          </span>
        )}
        <h2 className="font-semibold ml-auto">{isNew ? "Nova Ficha Técnica" : `Ficha — ${sheet.product_name}`}</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <label className="text-xs text-gray-500">Código</label>
          <input value={code} onChange={e => setCode(e.target.value)} placeholder="FT 001" className="w-full h-9 rounded-md border border-input bg-transparent px-2 text-sm" />
        </div>
        <div className="md:col-span-2">
          <label className="text-xs text-gray-500">Produto (ficha de)</label>
          <select value={productId} onChange={e => setProductId(e.target.value)} disabled={!isNew} className="w-full h-9 rounded-md border border-input bg-transparent px-2 text-sm">
            <option value="">Selecione...</option>
            {productOptions.map(p => <option key={p.id} value={p.id}>{p.name} {p.code ? `(${p.code})` : ""}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500">Rendimento (lote)</label>
          <input type="number" value={yieldQty} onChange={e => setYieldQty(e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-2 text-sm" />
        </div>
      </div>
      <div>
        <label className="text-xs text-gray-500">Descrição</label>
        <input value={description} onChange={e => setDescription(e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-2 text-sm" />
      </div>

      <div className="border rounded-lg overflow-hidden">
        <div className="flex items-center justify-between bg-gray-50 px-3 py-2">
          <span className="text-sm font-semibold">Componentes</span>
          <Button size="sm" variant="outline" onClick={addItem} className="gap-1.5 h-7"><Plus className="w-3.5 h-3.5" /> Adicionar</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-gray-500 text-xs">
              <tr>
                <th className="p-2 text-left">Tipo</th>
                <th className="p-2 text-left">Produto / Insumo</th>
                <th className="p-2 text-right">Qtd./lote</th>
                <th className="p-2 text-right">Custo Unit.</th>
                <th className="p-2 text-right">Total</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {computed.length === 0 ? (
                <tr><td colSpan={6} className="p-6 text-center text-gray-400">Nenhum componente. Clique em "Adicionar".</td></tr>
              ) : computed.map((it, i) => (
                <tr key={i} className="border-t">
                  <td className="p-2">
                    {it.item_type === "subproduto" ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">Subproduto</span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Material</span>
                    )}
                  </td>
                  <td className="p-2">
                    <select value={it.product_id} onChange={e => changeItemProduct(i, e.target.value)} className="w-full h-8 rounded-md border border-input bg-transparent px-2 text-sm">
                      <option value="">Selecione...</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name} {p.code ? `(${p.code})` : ""}</option>)}
                    </select>
                    {it.item_type === "subproduto" && it.product_id && (
                      <button onClick={() => onOpenSub(it.product_id)} className="text-xs text-purple-600 hover:underline flex items-center gap-1 mt-1">
                        Abrir ficha técnica do subproduto <ChevronRight className="w-3 h-3" />
                      </button>
                    )}
                  </td>
                  <td className="p-2 text-right">
                    <input type="number" value={it.quantity} onChange={e => changeItemQty(i, e.target.value)} className="w-24 h-8 rounded-md border border-input bg-transparent px-2 text-sm text-right" />
                    <span className="text-xs text-gray-400 ml-1">{it.product_unit}</span>
                  </td>
                  <td className="p-2 text-right text-gray-600">{fmtMoney(it.unit_cost)}</td>
                  <td className="p-2 text-right font-medium">{fmtMoney(it.total)}</td>
                  <td className="p-2 text-right">
                    <button onClick={() => removeItem(i)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 font-semibold border-t">
              <tr>
                <td className="p-2" colSpan={4}>Custo do lote / Custo unitário</td>
                <td className="p-2 text-right">{fmtMoney(lotCost)}</td>
                <td className="p-2 text-right text-emerald-600">{fmtMoney(unitCost)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onBack}>Cancelar</Button>
        <Button onClick={save} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">{saving ? "Salvando..." : "Salvar Ficha Técnica"}</Button>
      </div>
    </div>
  );
}
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, GitBranch, X } from "lucide-react";

// Cadastro de Linhas de Produção — cada linha é vinculada a uma etapa de
// produção e informa quais produtos produz nela (o mesmo produto pode ser
// cadastrado em linhas diferentes).
export default function ErpProductionLineManager({ user }) {
  const [lines, setLines] = useState([]);
  const [stages, setStages] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [l, s, p] = await Promise.all([
        base44.entities.ErpProductionLine.filter({ user_email: user.email }, "name", 500),
        base44.entities.ErpProductionStage.filter({ user_email: user.email }, "name", 500),
        base44.entities.ErpProduct.filter({ user_email: user.email }, "name", 1000),
      ]);
      setLines(l); setStages(s); setProducts(p);
    } catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [user.email]);

  const activeStages = (stages || []).filter(s => s.is_active !== false);

  const handleDelete = async (ln) => {
    if (!confirm(`Excluir a linha "${ln.name}"?`)) return;
    await base44.entities.ErpProductionLine.delete(ln.id);
    load();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitBranch className="w-5 h-5 text-indigo-600" />
          <h2 className="font-semibold">Linhas de Produção</h2>
        </div>
        <Button size="sm" onClick={() => setEditing({ __new: true })} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
          <Plus className="w-4 h-4" /> Nova Linha
        </Button>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-gray-500 text-xs">
              <tr>
                <th className="p-2 text-left">Código</th>
                <th className="p-2 text-left">Linha</th>
                <th className="p-2 text-left">Etapa vinculada</th>
                <th className="p-2 text-left">Produtos produzidos</th>
                <th className="p-2 text-center">Ativa</th>
                <th className="p-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="p-6 text-center text-gray-400">Carregando...</td></tr>
              ) : lines.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-gray-400">
                  <GitBranch className="w-10 h-10 mx-auto mb-2 opacity-30" /> Nenhuma linha cadastrada.
                </td></tr>
              ) : lines.map(ln => (
                <tr key={ln.id} className="border-t hover:bg-gray-50">
                  <td className="p-2 font-mono text-xs">{ln.code || "—"}</td>
                  <td className="p-2 font-medium">{ln.name}</td>
                  <td className="p-2">{ln.stage_name || "—"}</td>
                  <td className="p-2 text-xs text-gray-600">
                    {(ln.products || []).length
                      ? (ln.products || []).map(p => `${p.product_name}${Number(p.units_per_hour) > 0 ? ` (${p.units_per_hour} ${p.unit || "UN"}/h)` : ""}`).join(", ")
                      : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="p-2 text-center">{ln.is_active !== false ? "✅" : "—"}</td>
                  <td className="p-2 text-right whitespace-nowrap">
                    <button onClick={() => setEditing(ln)} className="p-1 hover:bg-gray-100 rounded text-xs">✏️</button>
                    <button onClick={() => handleDelete(ln)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <LineModal
          user={user}
          line={editing.id ? editing : null}
          stages={activeStages}
          products={products}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function LineModal({ user, line, stages, products, onClose, onSaved }) {
  const [form, setForm] = useState({
    code: line?.code || "", name: line?.name || "", description: line?.description || "",
    stage_id: line?.stage_id || "", is_active: line?.is_active !== false,
  });
  const [items, setItems] = useState(line?.products || []);
  const [productId, setProductId] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const productsById = {}; products.forEach(p => { productsById[p.id] = p; });
  const unitOf = (it) => it.unit || productsById[it.product_id]?.unit || "UN";

  const addProduct = () => {
    if (!productId) return;
    if (items.some(i => i.product_id === productId)) { alert("Este produto já está cadastrado nesta linha."); setProductId(""); return; }
    const p = products.find(x => x.id === productId);
    setItems(prev => [...prev, { product_id: productId, product_name: p?.name || "", product_code: p?.code || "", unit: p?.unit || "UN", units_per_hour: 0 }]);
    setProductId("");
  };

  const save = async () => {
    if (!form.name.trim()) { alert("Informe o nome da linha."); return; }
    if (!form.stage_id) { alert("Selecione a etapa de produção vinculada à linha."); return; }
    setSaving(true);
    const stage = stages.find(s => s.id === form.stage_id);
    const payload = {
      user_email: user.email,
      code: form.code || undefined,
      name: form.name.trim(),
      description: form.description || undefined,
      stage_id: form.stage_id,
      stage_name: stage?.name || "",
      products: items.map(it => ({ ...it, unit: unitOf(it) })),
      is_active: form.is_active,
    };
    try {
      if (line?.id) await base44.entities.ErpProductionLine.update(line.id, payload);
      else await base44.entities.ErpProductionLine.create(payload);
      onSaved();
    } catch (e) { alert("Erro ao salvar: " + e.message); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h2 className="font-bold flex items-center gap-2"><GitBranch className="w-5 h-5 text-indigo-600" /> {line ? "Editar Linha" : "Nova Linha de Produção"}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-3 text-sm">
          <div className="grid grid-cols-3 gap-3">
            <div><label className="text-xs text-gray-500">Código</label><input value={form.code} onChange={e => set("code", e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-2 text-sm" /></div>
            <div className="col-span-2"><label className="text-xs text-gray-500">Nome da linha *</label><input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Ex: Linha 1 — Envase Automático" className="w-full h-9 rounded-md border border-input bg-transparent px-2 text-sm" /></div>
          </div>
          <div>
            <label className="text-xs text-gray-500">Etapa de produção vinculada *</label>
            <select value={form.stage_id} onChange={e => set("stage_id", e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-2 text-sm">
              <option value="">Selecione a etapa...</option>
              {stages.map(s => <option key={s.id} value={s.id}>{s.code ? `${s.code} — ` : ""}{s.name}</option>)}
            </select>
            {stages.length === 0 && <p className="text-[11px] text-amber-600 mt-1">Cadastre uma etapa de produção primeiro.</p>}
          </div>
          <div><label className="text-xs text-gray-500">Descrição</label><input value={form.description} onChange={e => set("description", e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-2 text-sm" /></div>

          <div className="border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between bg-gray-50 px-3 py-2">
              <span className="text-sm font-semibold">Produtos produzidos nesta linha</span>
            </div>
            <div className="p-3 space-y-2">
              {items.length === 0 && <p className="text-center text-gray-400 text-xs py-2">Nenhum produto vinculado à linha. Selecione abaixo e clique em Adicionar — você pode adicionar quantos produtos quiser.</p>}
              {items.length > 0 && (
                <div className="grid grid-cols-[1fr,190px,28px] gap-2 px-1 text-[11px] font-semibold text-gray-500">
                  <span>Produto</span>
                  <span>Velocidade nominal (por hora)</span>
                  <span />
                </div>
              )}
              {items.map((it, i) => (
                <div key={i} className="grid grid-cols-[1fr,190px,28px] items-center gap-2 border rounded-md px-2 py-1.5 bg-gray-50/50">
                  <span className="text-xs font-medium">{it.product_code ? `${it.product_code} — ` : ""}{it.product_name}</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number" min="0" step="0.01"
                      value={it.units_per_hour ?? 0}
                      onChange={e => setItems(prev => prev.map((x, j) => j === i ? { ...x, units_per_hour: Number(e.target.value) || 0 } : x))}
                      placeholder="0"
                      title="Velocidade nominal — quantidade produzida por hora na unidade do produto"
                      className="w-24 h-8 rounded-md border border-input bg-white px-2 text-xs text-right"
                    />
                    <span className="text-xs text-gray-600 whitespace-nowrap font-medium">{unitOf(it)}/hora</span>
                  </div>
                  <button onClick={() => setItems(prev => prev.filter((_, j) => j !== i))} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5 text-red-500" /></button>
                </div>
              ))}
              <div className="flex gap-2">
                <select value={productId} onChange={e => setProductId(e.target.value)} className="flex-1 h-8 rounded-md border border-input bg-transparent px-2 text-sm">
                  <option value="">Selecione o produto produzido na linha...</option>
                  {products.filter(p => p.product_type !== "servico").map(p => <option key={p.id} value={p.id}>{p.code ? `${p.code} — ` : ""}{p.name}</option>)}
                </select>
                <Button size="sm" variant="outline" onClick={addProduct} className="gap-1.5 h-8"><Plus className="w-3.5 h-3.5" /> Adicionar</Button>
              </div>
              <p className="text-[11px] text-gray-500">O mesmo produto pode ser cadastrado em linhas diferentes — ele apenas não pode repetir dentro da mesma linha. A velocidade nominal (un./hora) é a capacidade de cada produto na linha e serve de base para o cálculo da eficiência de produção: em uma produção de 8 horas, uma linha de 1.000 un./hora deveria produzir 8.000 unidades.</p>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_active} onChange={e => set("is_active", e.target.checked)} className="w-4 h-4" /> Linha ativa
          </label>
        </div>
        <div className="p-4 border-t flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={save} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">{saving ? "Salvando..." : "Salvar"}</Button>
        </div>
      </div>
    </div>
  );
}
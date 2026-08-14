import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Workflow, Play, ArrowDown, Boxes, ClipboardList, X } from "lucide-react";
import { fmtMoney } from "@/lib/erpUtils";

export default function ErpProductionRouteManager({ user }) {
  const [routes, setRoutes] = useState([]);
  const [products, setProducts] = useState([]);
  const [sheets, setSheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // route em edição (objeto) ou {__new:true}
  const [producing, setProducing] = useState(null); // route para gerar produção

  const load = async () => {
    setLoading(true);
    try {
      const [r, p, s] = await Promise.all([
        base44.entities.ErpProductionRoute.filter({ user_email: user.email }, "name", 500),
        base44.entities.ErpProduct.filter({ user_email: user.email }, "name", 1000),
        base44.entities.ErpTechnicalSheet.filter({ user_email: user.email }, "code", 1000),
      ]);
      setRoutes(r); setProducts(p); setSheets(s);
    } catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [user.email]);

  const productsById = {}; products.forEach(p => { productsById[p.id] = p; });
  const sheetsById = {}; sheets.forEach(s => { sheetsById[s.id] = s; });

  const handleDelete = async (rt) => {
    if (!confirm(`Excluir o roteiro "${rt.name}"?`)) return;
    await base44.entities.ErpProductionRoute.delete(rt.id);
    load();
  };

  if (editing) {
    return (
      <RouteEditor
        route={editing.id ? editing : null}
        products={products}
        sheets={sheets}
        sheetsById={sheetsById}
        productsById={productsById}
        user={user}
        onSaved={load}
        onCancel={() => setEditing(null)}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Workflow className="w-5 h-5 text-indigo-600" />
          <h2 className="font-semibold">Roteiros de Produção (Etapas)</h2>
        </div>
        <Button size="sm" onClick={() => setEditing({ __new: true })} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
          <Plus className="w-4 h-4" /> Novo Roteiro
        </Button>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-gray-500 text-xs">
              <tr>
                <th className="p-2 text-left">Roteiro</th>
                <th className="p-2 text-left">Produto Final</th>
                <th className="p-2 text-right">Etapas</th>
                <th className="p-2 text-left">Sequência</th>
                <th className="p-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="p-6 text-center text-gray-400">Carregando...</td></tr>
              ) : routes.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-gray-400">
                  <Workflow className="w-10 h-10 mx-auto mb-2 opacity-30" /> Nenhum roteiro cadastrado.
                </td></tr>
              ) : routes.map(rt => (
                <tr key={rt.id} className="border-t hover:bg-gray-50">
                  <td className="p-2 font-medium">{rt.name}</td>
                  <td className="p-2">{rt.final_product_name || "—"}</td>
                  <td className="p-2 text-right">{rt.stages?.length || 0}</td>
                  <td className="p-2 text-xs text-gray-600">
                    {(rt.stages || []).sort((a, b) => a.seq - b.seq).map(s => s.name).join(" → ")}
                  </td>
                  <td className="p-2 text-right whitespace-nowrap">
                    <button onClick={() => setProducing(rt)} title="Produzir (gerar OPs + solicitações)" className="p-1 hover:bg-emerald-50 rounded"><Play className="w-4 h-4 text-emerald-600" /></button>
                    <button onClick={() => setEditing(rt)} className="p-1 hover:bg-gray-100 rounded text-xs">✏️</button>
                    <button onClick={() => handleDelete(rt)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {producing && (
        <ProduceModal route={producing} sheetsById={sheetsById} productsById={productsById} user={user} onClose={() => setProducing(null)} />
      )}
    </div>
  );
}

function RouteEditor({ route, products, sheets, sheetsById, productsById, user, onSaved, onCancel }) {
  const isNew = !route || route.__new;
  const [name, setName] = useState(route?.name || "");
  const [code, setCode] = useState(route?.code || "");
  const [finalProductId, setFinalProductId] = useState(route?.final_product_id || "");
  const [description, setDescription] = useState(route?.description || "");
  const [stages, setStages] = useState(route?.stages || []);
  const [saving, setSaving] = useState(false);

  const addStage = () => {
    setStages(prev => [...prev, { seq: prev.length + 1, name: "", output_product_id: "", output_product_name: "", ficha_tecnica_id: "", qty_per_final: 1, depends_on_prev: prev.length > 0 }]);
  };
  const updateStage = (idx, patch) => {
    setStages(prev => prev.map((s, i) => {
      if (i !== idx) return s;
      const ns = { ...s, ...patch };
      if (patch.output_product_id) ns.output_product_name = productsById[patch.output_product_id]?.name || "";
      if (patch.ficha_tecnica_id !== undefined) {
        const f = sheetsById[patch.ficha_tecnica_id];
        if (f && !ns.output_product_id) { ns.output_product_id = f.product_id; ns.output_product_name = f.product_name; }
      }
      return ns;
    }));
  };
  const removeStage = (idx) => setStages(prev => prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, seq: i + 1 })));

  const save = async () => {
    if (!name || !finalProductId || stages.length === 0) { alert("Informe nome, produto final e ao menos uma etapa."); return; }
    setSaving(true);
    const payload = {
      user_email: user.email, name, code, final_product_id: finalProductId,
      final_product_name: productsById[finalProductId]?.name || "",
      description, stages: stages.map((s, i) => ({ ...s, seq: i + 1 })),
      is_active: route?.is_active ?? true,
    };
    try {
      if (isNew) await base44.entities.ErpProductionRoute.create(payload);
      else await base44.entities.ErpProductionRoute.update(route.id, payload);
      onSaved(); onCancel();
    } catch (e) { alert("Erro ao salvar: " + e.message); }
    setSaving(false);
  };

  return (
    <div className="space-y-3 bg-white rounded-xl border p-4">
      <h2 className="font-semibold flex items-center gap-2"><Workflow className="w-4 h-4 text-indigo-600" /> {isNew ? "Novo Roteiro" : "Editar Roteiro"}</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div><label className="text-xs text-gray-500">Código</label><input value={code} onChange={e => setCode(e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-2 text-sm" /></div>
        <div><label className="text-xs text-gray-500">Nome do Roteiro</label><input value={name} onChange={e => setName(e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-2 text-sm" /></div>
        <div><label className="text-xs text-gray-500">Produto Final</label>
          <select value={finalProductId} onChange={e => setFinalProductId(e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-2 text-sm">
            <option value="">Selecione...</option>
            {products.filter(p => p.product_type === "produto_acabado").map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>
      <div><label className="text-xs text-gray-500">Descrição</label><input value={description} onChange={e => setDescription(e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-2 text-sm" /></div>

      <div className="border rounded-lg overflow-hidden">
        <div className="flex items-center justify-between bg-gray-50 px-3 py-2">
          <span className="text-sm font-semibold">Etapas (em sequência)</span>
          <Button size="sm" variant="outline" onClick={addStage} className="gap-1.5 h-7"><Plus className="w-3.5 h-3.5" /> Etapa</Button>
        </div>
        <div className="p-3 space-y-2">
          {stages.length === 0 && <p className="text-center text-gray-400 text-sm py-4">Nenhuma etapa. Adicione a primeira (ex: Xarope Simples).</p>}
          {stages.map((s, i) => (
            <div key={i} className="border rounded-lg p-2 bg-gray-50/50">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center font-bold">{s.seq}</span>
                <input value={s.name} onChange={e => updateStage(i, { name: e.target.value })} placeholder="Nome da etapa (ex: Xarope Composto)" className="flex-1 h-8 rounded-md border border-input bg-white px-2 text-sm" />
                <label className="flex items-center gap-1 text-xs text-gray-600">
                  <input type="checkbox" checked={s.depends_on_prev} onChange={e => updateStage(i, { depends_on_prev: e.target.checked })} /> Consome etapa anterior
                </label>
                <button onClick={() => removeStage(i)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pl-8">
                <div>
                  <label className="text-xs text-gray-500">Produto gerado</label>
                  <select value={s.output_product_id} onChange={e => updateStage(i, { output_product_id: e.target.value })} className="w-full h-8 rounded-md border border-input bg-white px-2 text-sm">
                    <option value="">Selecione...</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Ficha Técnica (BOM)</label>
                  <select value={s.ficha_tecnica_id} onChange={e => updateStage(i, { ficha_tecnica_id: e.target.value })} className="w-full h-8 rounded-md border border-input bg-white px-2 text-sm">
                    <option value="">—</option>
                    {sheets.map(f => <option key={f.id} value={f.id}>{f.code || f.product_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Qtd./unid. final</label>
                  <input type="number" step="0.001" value={s.qty_per_final} onChange={e => updateStage(i, { qty_per_final: Number(e.target.value) || 0 })} className="w-full h-8 rounded-md border border-input bg-white px-2 text-sm" />
                </div>
              </div>
              {s.depends_on_prev && i > 0 && (
                <p className="pl-8 mt-1 text-xs text-indigo-600 flex items-center gap-1"><ArrowDown className="w-3 h-3" /> Consome produto da etapa {stages[i - 1].seq} ({stages[i - 1].name || "—"})</p>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button onClick={save} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">{saving ? "Salvando..." : "Salvar Roteiro"}</Button>
      </div>
    </div>
  );
}

function ProduceModal({ route, sheetsById, productsById, user, onClose }) {
  const [qtyFinal, setQtyFinal] = useState(1);
  const [preview, setPreview] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);

  const stages = (route.stages || []).sort((a, b) => a.seq - b.seq);

  const compute = () => {
    const ops = [];
    const reqs = [];
    stages.forEach((st, i) => {
      const required = (Number(st.qty_per_final) || 1) * Number(qtyFinal);
      const ficha = st.ficha_tecnica_id ? sheetsById[st.ficha_tecnica_id] : null;
      const yieldQty = Number(ficha?.yield_quantity) || 1;
      const bomItems = (ficha?.items || []).map((it, k) => ({
        product_id: it.product_id, product_name: it.product_name, product_code: it.product_code, unit: it.product_unit,
        quantity_per_unit: (Number(it.quantity) || 0) / yieldQty,
        total_consumed: (Number(it.quantity) || 0) / yieldQty * required,
        item_type: it.item_type,
      }));
      const materialItems = bomItems.filter(b => b.item_type !== "subproduto" && b.product_id);
      const reqTotal = materialItems.reduce((s, it) => s + it.total_consumed * (Number(productsById[it.product_id]?.cost_price) || 0), 0);
      ops.push({ stage: st, required, bomItems });
      reqs.push({ stage: st, items: materialItems, total: reqTotal });
    });
    setPreview({ ops, reqs });
  };

  useEffect(() => { compute(); /* eslint-disable-next-line */ }, [qtyFinal]);

  const generate = async () => {
    if (!preview) return;
    if (!confirm(`Gerar ${stages.length} ordem(ns) de produção e ${stages.length} solicitação(ões) ao almoxarifado?`)) return;
    setGenerating(true);
    try {
      const now = new Date().toISOString();
      const stamp = now.slice(0, 16).replace(/[-:T]/g, "");
      const created = { ops: [], reqs: [] };
      for (const op of preview.ops) {
        const order_number = `OP ${route.code || route.name.slice(0, 8)}-${op.stage.seq}-${stamp}`;
        const createdOp = await base44.entities.ErpProductionOrder.create({
          user_email: user.email, order_number,
          output_product_id: op.stage.output_product_id, output_product_name: op.stage.output_product_name,
          output_quantity: op.required, bom_items: op.bomItems.map(b => ({ ...b, total_consumed: b.total_consumed })),
          emission_date: now, status: "rascunho", notes: `Etapa ${op.stage.seq} - ${op.stage.name} (roteiro ${route.name})`,
        });
        created.ops.push(order_number);
      }
      for (const rq of preview.reqs) {
        const number = `SC ${route.code || route.name.slice(0, 8)}-E${rq.stage.seq}-${stamp}`;
        const items = rq.items.map(it => ({
          item_type: "cadastrado", product_id: it.product_id, product_name: it.product_name,
          quantity: it.total_consumed, unit: it.unit || "UN",
          unit_price: Number(productsById[it.product_id]?.cost_price) || 0,
          total: it.total_consumed * (Number(productsById[it.product_id]?.cost_price) || 0),
        }));
        await base44.entities.ErpRequisition.create({
          user_email: user.email, number, request_date: now, request_type: "almoxarifado",
          requested_by: user.email, priority: "media",
          items, total_estimate: rq.total,
          description: `Insumos da etapa ${rq.stage.seq} - ${rq.stage.name} (roteiro ${route.name})`,
          status: "aberta",
        });
        created.reqs.push(number);
      }
      setResult(created);
    } catch (e) { alert("Erro ao gerar: " + e.message); }
    setGenerating(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h2 className="font-bold flex items-center gap-2"><Play className="w-5 h-5 text-emerald-600" /> Produzir — {route.name}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5 text-gray-500" /></button>
        </div>

        {result ? (
          <div className="p-4 space-y-3">
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-emerald-800 text-sm">
              ✓ Produção gerada com sucesso!
            </div>
            <div>
              <p className="font-semibold text-sm mb-1 flex items-center gap-1"><Boxes className="w-4 h-4" /> Ordens de Produção criadas ({result.ops.length})</p>
              <ul className="text-xs text-gray-600 list-disc pl-5">{result.ops.map((n, i) => <li key={i}>{n}</li>)}</ul>
            </div>
            <div>
              <p className="font-semibold text-sm mb-1 flex items-center gap-1"><ClipboardList className="w-4 h-4" /> Solicitações ao Almoxarifado ({result.reqs.length})</p>
              <ul className="text-xs text-gray-600 list-disc pl-5">{result.reqs.map((n, i) => <li key={i}>{n}</li>)}</ul>
            </div>
            <Button onClick={onClose} className="w-full">Concluir</Button>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            <div className="flex items-end gap-3">
              <div>
                <label className="text-xs text-gray-500">Quantidade do produto final a produzir</label>
                <input type="number" min="0" step="0.001" value={qtyFinal} onChange={e => setQtyFinal(Number(e.target.value) || 0)} className="w-40 h-9 rounded-md border border-input bg-transparent px-2 text-sm" />
              </div>
              <span className="text-xs text-gray-500 pb-2">{route.final_product_name}</span>
            </div>

            {preview && preview.ops.map((op, i) => (
              <div key={i} className="border rounded-lg">
                <div className="bg-indigo-50 px-3 py-2 flex items-center justify-between">
                  <span className="font-semibold text-sm flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center">{op.stage.seq}</span>
                    {op.stage.name}
                  </span>
                  <span className="text-xs text-gray-600">Produzir <b>{op.required}</b> {op.stage.output_product_name}</span>
                </div>
                <div className="p-2">
                  <p className="text-xs text-gray-500 mb-1">Insumos consumidos na etapa:</p>
                  {op.bomItems.length === 0 ? <p className="text-xs text-gray-400">Sem ficha técnica vinculada — nenhum insumo.</p> : (
                    <table className="w-full text-xs">
                      <thead className="text-gray-500"><tr><th className="text-left p-1">Insumo</th><th className="text-right p-1">Por unid.</th><th className="text-right p-1">Total</th><th className="p-1">Tipo</th></tr></thead>
                      <tbody>
                        {op.bomItems.map((b, k) => (
                          <tr key={k} className="border-t">
                            <td className="p-1">{b.product_name}</td>
                            <td className="p-1 text-right">{(b.quantity_per_unit).toFixed(4)} {b.unit}</td>
                            <td className="p-1 text-right font-medium">{b.total_consumed.toFixed(3)} {b.unit}</td>
                            <td className="p-1 text-center">{b.item_type === "subproduto" ? <span className="text-purple-600">subproduto</span> : <span className="text-blue-600">material</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  <p className="text-xs text-gray-500 mt-1 flex items-center gap-1"><ClipboardList className="w-3 h-3" /> Solicitação ao almoxarifado: {preview.reqs[i].items.length} insumo(s) • {fmtMoney(preview.reqs[i].total)}</p>
                </div>
              </div>
            ))}

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              <Button onClick={generate} disabled={generating} className="bg-emerald-600 hover:bg-emerald-700 gap-1.5">
                {generating ? "Gerando..." : <><Play className="w-4 h-4" /> Gerar OPs e Solicitações</>}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
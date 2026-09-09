import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Plus, Trash2, FileCheck2 } from "lucide-react";
import { genOrderNumber } from "@/lib/erpUtils";
import { computeNeeded, checkStock, shortagesMessage, createWarehouseRequisition, buildProductionTree, sumMaterials } from "@/lib/erpProductionStock";

const round3 = (v) => Math.round((Number(v) || 0) * 1000) / 1000;

export default function ErpProductionFormModal({ user, order, products, technicalSheets, onClose, onSaved }) {
  const [form, setForm] = useState({
    order_number: order?.order_number || genOrderNumber("OP"),
    output_product_id: order?.output_product_id || "",
    output_quantity: order?.output_quantity || 1,
    emission_date: order?.emission_date || new Date().toISOString().slice(0, 10),
    notes: order?.notes || "",
    bom_items: order?.bom_items || [],
  });
  const [saving, setSaving] = useState(false);
  const [groupReq, setGroupReq] = useState(false);
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const hasSheet = (pid) => (technicalSheets || []).some(t => t.product_id === pid && t.is_active !== false);

  // Ao selecionar o produto, preenche automaticamente os insumos pela Ficha Técnica
  const pickProduct = (id) => {
    const sheet = (technicalSheets || []).find(t => t.product_id === id && t.is_active !== false);
    if (sheet && (sheet.items || []).length) {
      const yieldQ = Number(sheet.yield_quantity) || 1;
      setForm(prev => ({
        ...prev,
        output_product_id: id,
        bom_items: sheet.items.map((it, i) => ({
          _key: "ft" + i + "-" + it.product_id,
          product_id: it.product_id,
          product_name: it.product_name,
          product_code: it.product_code || "",
          unit: it.product_unit || "UN",
          quantity_per_unit: round3((Number(it.quantity) || 0) / yieldQ),
          is_subproduct: it.item_type === "subproduto" || hasSheet(it.product_id),
        })),
      }));
    } else {
      set("output_product_id", id);
    }
  };

  const setInput = (id, field, value) => setForm(prev => {
    const bom_items = [...prev.bom_items];
    const i = bom_items.findIndex(b => (b._key || b.product_id) === id);
    if (i >= 0) {
      bom_items[i] = { ...bom_items[i], [field]: value };
      if (field === "product_id") {
        const p = products.find(p => p.id === value);
        if (p) { bom_items[i].product_name = p.name; bom_items[i].unit = p.unit; bom_items[i].product_code = p.code || ""; }
        bom_items[i].is_subproduct = hasSheet(value);
      }
    }
    return { ...prev, bom_items };
  });

  const addInput = () => setForm(prev => ({ ...prev, bom_items: [...prev.bom_items, { _key: "k" + Date.now() + Math.random(), product_id: "", product_name: "", unit: "UN", quantity_per_unit: 1, total_consumed: 0 }] }));
  const removeInput = (id) => setForm(prev => ({ ...prev, bom_items: prev.bom_items.filter(b => (b._key || b.product_id) !== id) }));

  const handleSave = async () => {
    if (!form.output_product_id) { alert("Selecione o produto a ser produzido."); return; }
    setSaving(true);
    const outProd = products.find(p => p.id === form.output_product_id);
    const outQty = Number(form.output_quantity) || 0;
    const bom = form.bom_items.map(b => ({
      product_id: b.product_id,
      product_name: b.product_name,
      product_code: b.product_code || "",
      unit: b.unit || "UN",
      quantity_per_unit: Number(b.quantity_per_unit) || 0,
      is_subproduct: !!b.is_subproduct,
      total_consumed: (Number(b.quantity_per_unit) || 0) * outQty,
    }));
    const stripSub = (list) => list.map(({ is_subproduct, ...rest }) => rest);
    try {
      if (order?.id) {
        // Edição — apenas atualiza a OP
        await base44.entities.ErpProductionOrder.update(order.id, {
          user_email: user.email,
          order_number: form.order_number,
          output_product_id: form.output_product_id,
          output_product_name: outProd?.name || "",
          output_product_code: outProd?.code || "",
          output_quantity: outQty,
          bom_items: stripSub(bom),
          emission_date: new Date(form.emission_date).toISOString(),
          produced_quantity: order?.produced_quantity || 0,
          status: order?.status || "rascunho",
          notes: form.notes || undefined,
        });
      } else {
        // Criação — produção multi-nível: OP principal + OPs automáticas dos subprodutos + requisições
        const directBom = stripSub(bom.filter(b => b.product_id && !b.is_subproduct));
        const tree = buildProductionTree(technicalSheets, form.output_product_id, outQty);
        // Respeita as linhas de subproduto editadas/removidas no formulário
        const subRows = bom.filter(b => b.is_subproduct && b.product_id);
        tree.children = tree.children
          .filter(c => subRows.some(r => r.product_id === c.product_id))
          .map(c => ({ ...c, qty: round3((Number((subRows.find(r => r.product_id === c.product_id) || {}).quantity_per_unit) || 0) * outQty) }));

        // Insumos de TODAS as OPs somados (verificação de estoque e requisição agrupada)
        const collectNeeded = (node, isRoot) => {
          const items = isRoot ? directBom : node.bom;
          const arr = computeNeeded(items, isRoot ? outQty : node.qty);
          (node.children || []).forEach(ch => arr.push(...collectNeeded(ch, false)));
          return arr;
        };
        const allNeeded = sumMaterials(collectNeeded(tree, true));
        const shortages = allNeeded.length ? checkStock(products, allNeeded) : [];
        let proceed = true;
        if (shortages.length) {
          proceed = confirm(`Os seguintes insumos estão SEM estoque suficiente (considerando todas as OPs):\n\n${shortagesMessage(shortages)}\n\nDeseja prosseguir? As solicitações ao almoxarifado serão geradas mesmo assim.\n\n[OK] = Prosseguir e gerar solicitações\n[Cancelar] = Deixar as OPs em standby até poder gerar as solicitações`);
        }
        const status = proceed ? "rascunho" : "standby";

        // Cria a OP principal e, recursivamente, as OPs dos subprodutos (multi-nível)
        const createdOps = [];
        const createOp = async (node, parentId, parentNumber, isRoot) => {
          const p = products.find(x => x.id === node.product_id);
          const qty = isRoot ? outQty : node.qty;
          const items = (isRoot ? directBom : node.bom).map(b => ({ ...b, total_consumed: round3((Number(b.quantity_per_unit) || 0) * qty) }));
          const op = await base44.entities.ErpProductionOrder.create({
            user_email: user.email,
            order_number: isRoot ? form.order_number : genOrderNumber("OP"),
            output_product_id: node.product_id,
            output_product_name: (isRoot ? outProd : p)?.name || "",
            output_product_code: (isRoot ? outProd : p)?.code || "",
            output_quantity: qty,
            bom_items: items,
            emission_date: new Date(form.emission_date).toISOString(),
            status,
            notes: isRoot ? (form.notes || undefined) : `OP automática de subproduto — origem: ${form.order_number}`,
            parent_order_id: parentId || undefined,
            parent_order_number: parentNumber || undefined,
          });
          createdOps.push({ op, needed: computeNeeded(items, qty) });
          for (const ch of (node.children || [])) await createOp(ch, op.id, op.order_number, false);
        };
        await createOp(tree, null, null, true);
        const mainOp = createdOps[0].op;

        // Requisições ao almoxarifado: agrupada (1 única com todos os insumos) ou individual (1 por OP)
        let reqs = 0;
        if (proceed && allNeeded.length) {
          if (groupReq) {
            const req = await createWarehouseRequisition(user, {
              production_order_id: mainOp.id,
              production_order_number: mainOp.order_number,
              items: allNeeded,
            });
            await base44.entities.ErpProductionOrder.update(mainOp.id, { requisition_id: req.id, requisition_number: req.number });
            reqs = 1;
          } else {
            for (const { op, needed } of createdOps) {
              if (!needed.length) continue;
              const req = await createWarehouseRequisition(user, {
                production_order_id: op.id,
                production_order_number: op.order_number,
                items: needed,
              });
              await base44.entities.ErpProductionOrder.update(op.id, { requisition_id: req.id, requisition_number: req.number });
              reqs++;
            }
          }
        }
        const subs = createdOps.length - 1;
        if (!proceed) alert(`${createdOps.length} OP(s) criada(s) em STANDBY${subs ? ` (principal + ${subs} subproduto(s))` : ""}. Na lista de OPs, use o botão 'Gerar solicitação ao almoxarifado' quando o estoque for reposto.`);
        else if (!allNeeded.length) alert("OP criada sem insumos (sem ficha técnica/BOM). Nenhuma solicitação ao almoxarifado foi gerada.");
        else alert(`${createdOps.length} OP(s) criada(s)${subs ? ` (principal + ${subs} subproduto(s))` : ""} e ${reqs} requisição(ões) ao almoxarifado gerada(s)${groupReq ? " — insumos agrupados" : ""}.`);
      }
      onSaved();
      onClose();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  const sheet = (technicalSheets || []).find(t => t.product_id === form.output_product_id && t.is_active !== false);
  const missingSheet = form.output_product_id && !sheet;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
          <h2 className="font-bold">{order ? "Editar Ordem de Produção" : "Nova Ordem de Produção"}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Número</Label><Input value={form.order_number} onChange={e => set("order_number", e.target.value)} /></div>
            <div><Label>Emissão</Label><Input type="date" value={form.emission_date} onChange={e => set("emission_date", e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Produto a produzir *</Label>
              <select value={form.output_product_id} onChange={e => pickProduct(e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm">
                <option value="">Selecione...</option>
                {products.filter(p => p.product_type === "produto_acabado" || p.product_type === "produto_em_processo").map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div><Label>Quantidade a produzir</Label><Input type="number" value={form.output_quantity} onChange={e => set("output_quantity", e.target.value)} /></div>
          </div>
          {sheet && (
            <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md p-2">
              <FileCheck2 className="w-4 h-4" />
              Ficha técnica <b>{sheet.code || "—"}</b> aplicada — insumos calculados automaticamente (rendimento: {sheet.yield_quantity} {sheet.product_unit} por lote).
            </div>
          )}
          {missingSheet && (
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2">
              Nenhuma ficha técnica encontrada para este produto — adicione os insumos manualmente abaixo.
            </div>
          )}
          {form.bom_items.some(b => b.is_subproduct) && (
            <div className="text-xs text-purple-700 bg-purple-50 border border-purple-200 rounded-md p-2">
              Esta ficha possui <b>subprodutos</b> (produtos em processo com ficha própria). Ao salvar, o sistema gerará OPs automáticas para cada subproduto — inclusive nos níveis mais profundos — com suas requisições ao almoxarifado.
            </div>
          )}

          <div className="border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between p-2 bg-gray-50 border-b">
              <span className="text-sm font-semibold">Estrutura de produtos (BOM) — insumos consumidos</span>
              <Button size="sm" variant="outline" onClick={addInput} className="h-7 gap-1"><Plus className="w-3.5 h-3.5" /> Insumo</Button>
            </div>
            {form.bom_items.length === 0 ? (
              <p className="p-4 text-center text-sm text-gray-400">Nenhum insumo adicionado.</p>
            ) : form.bom_items.map(b => {
              const key = b._key || b.product_id;
              return (
                <div key={key} className="grid grid-cols-12 gap-1 p-2 border-b items-end text-xs">
                  <div className="col-span-7">
                    <Label className="text-[10px]">Insumo / Matéria-prima</Label>
                    <select value={b.product_id} onChange={e => setInput(key, "product_id", e.target.value)} className="w-full h-8 rounded border border-input px-2 text-xs">
                      <option value="">Selecione...</option>
                      {products.filter(p => p.product_type === "materia_prima" || p.product_type === "insumo" || p.product_type === "produto_em_processo").map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    {b.is_subproduct && <span className="text-[10px] text-purple-600 block mt-0.5">Subproduto — gera OP própria ao salvar</span>}
                  </div>
                  <div className="col-span-3"><Label className="text-[10px]">Qtd por unidade</Label><Input type="number" step="0.001" value={b.quantity_per_unit} onChange={e => setInput(key, "quantity_per_unit", e.target.value)} className="h-8 text-xs" /></div>
                  <div className="col-span-1"><Label className="text-[10px]">Total</Label><p className="h-8 flex items-center font-medium text-[10px]">{((Number(b.quantity_per_unit) || 0) * (Number(form.output_quantity) || 0)).toFixed(2)}</p></div>
                  <div className="col-span-1"><button onClick={() => removeInput(key)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button></div>
                </div>
              );
            })}
          </div>
          {!order && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={groupReq} onChange={e => setGroupReq(e.target.checked)} className="w-4 h-4" />
              Agrupar os insumos de todas as OPs (principal + subprodutos) em uma única requisição ao almoxarifado
            </label>
          )}
          <div><Label>Observações</Label><Input value={form.notes} onChange={e => set("notes", e.target.value)} /></div>
        </div>
        <div className="p-4 border-t flex gap-2 justify-end sticky bottom-0 bg-white">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar OP"}</Button>
        </div>
      </div>
    </div>
  );
}
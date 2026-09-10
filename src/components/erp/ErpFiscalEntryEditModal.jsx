import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { X, Wrench, Loader2, Plus, Trash2 } from "lucide-react";
import ErpFiscalItemTaxes from "@/components/erp/ErpFiscalItemTaxes";
import ErpFiscalCapaTaxes from "@/components/erp/ErpFiscalCapaTaxes";
import ErpApportionmentEditor from "@/components/erp/ErpApportionmentEditor";
import { fmtMoney } from "@/lib/erpUtils";

const EMPTY_ITEM = { product_id: "", product_name: "", product_code: "", quantity: 1, unit_price: 0,
  cst_icms: "", base_icms: "", icms_rate: "", aliq_reducao_icms: "", icms_value: "", difal_value: "",
  cst_pis: "", cst_cofins: "", base_pis_cofins: "", aliq_pis_cofins: "", pauta_pis_cofins: "",
  aliq_pis: "", aliq_cofins: "", pauta_pis: "", pauta_cofins: "",
  pis_value: "", cofins_value: "", ipi_value: "",
  cst_cbs: "", cbs_rate: "", cbs_value: "", cst_ibs: "", ibs_rate: "", ibs_value: "" };

// Manutenção de uma entrada de NF reaberta: corrige dados da nota, itens,
// impostos (capa e por item) e rateio — depois basta lançar novamente.
export default function ErpFiscalEntryEditModal({ user, entry, onClose, onSaved }) {
  const [operations, setOperations] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    nota_number: entry.nota_number || "",
    issue_date: (entry.issue_date || "").slice(0, 10) || new Date().toISOString().slice(0, 10),
    due_date: (entry.due_date || "").slice(0, 10),
    total_nota: entry.total_nota || 0,
    supplier_name: entry.supplier_name || "",
    supplier_cnpj: entry.supplier_cnpj || "",
    supplier_uf: entry.supplier_uf || "",
    nature_operation: entry.nature_operation || "",
    cfop: entry.cfop || "",
    operation_id: entry.operation_id || "",
    dif_aliquota_value: entry.dif_aliquota_value || "",
    despesas_value: entry.despesas_value || "",
    descontos_value: entry.descontos_value || "",
    ciap_curto_value: entry.ciap_curto_value || "",
    ciap_longo_value: entry.ciap_longo_value || "",
    icms_frete_value: entry.icms_frete_value || "",
    pis_frete_value: entry.pis_frete_value || "",
    cofins_frete_value: entry.cofins_frete_value || "",
    notes: entry.notes || "",
  });
  const setF = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
  const [items, setItems] = useState((entry.items || []).map(it => ({
    ...EMPTY_ITEM, ...it,
    quantity: Number(it.quantity) || 0,
    unit_price: Number(it.unit_price) || 0,
    base_icms: r2(it.base_icms), icms_value: r2(it.icms_value), difal_value: r2(it.difal_value),
    base_pis_cofins: r2(it.base_pis_cofins), pis_value: r2(it.pis_value), cofins_value: r2(it.cofins_value),
    cbs_value: r2(it.cbs_value), ibs_value: r2(it.ibs_value), ipi_value: r2(it.ipi_value),
    aliq_pis: Number(it.aliq_pis ?? it.aliq_pis_cofins) || 0,
    aliq_cofins: Number(it.aliq_cofins ?? it.aliq_pis_cofins) || 0,
    pauta_pis: Number(it.pauta_pis ?? it.pauta_pis_cofins) || 0,
    pauta_cofins: Number(it.pauta_cofins ?? it.pauta_pis_cofins) || 0,
  })));
  const [capa, setCapa] = useState({
    base_icms: entry.base_icms || "", aliq_icms: entry.aliq_icms || "", aliq_reducao_icms: entry.aliq_reducao_icms || "",
    base_pis_cofins: entry.base_pis_cofins || "", aliq_pis_cofins: entry.aliq_pis_cofins || "",
    pauta_pis_cofins: entry.pauta_pis_cofins || "", difal_value: entry.difal_value || "",
  });
  const [apportionments, setApportionments] = useState(entry.apportionments || []);

  useEffect(() => {
    Promise.all([
      base44.entities.ErpOperation.filter({ user_email: user.email, type: "entrada", is_active: true }, "name", 200),
      base44.entities.ErpDepartment.filter({ user_email: user.email, is_active: true }, "name", 500),
      base44.entities.ErpChartAccount.filter({ user_email: user.email, accepts_entries: true }, "code", 500),
    ]).then(([op, d, acc]) => { setOperations(op); setDepartments(d); setAccounts(acc); }).catch(() => {});
  }, [user.email]);

  // Soma dos impostos dos itens — base de comparação com a capa
  const taxSums = (() => {
    const s = (k) => items.reduce((a, it) => a + (Number(it[k]) || 0), 0);
    return {
      base_icms: Math.round(s("base_icms") * 100) / 100,
      icms_value: Math.round(s("icms_value") * 100) / 100,
      base_pis_cofins: Math.round(s("base_pis_cofins") * 100) / 100,
      pis_value: Math.round(s("pis_value") * 100) / 100,
      cofins_value: Math.round(s("cofins_value") * 100) / 100,
      difal_value: Math.round(s("difal_value") * 100) / 100,
      cbs_value: Math.round(s("cbs_value") * 100) / 100,
      ibs_value: Math.round(s("ibs_value") * 100) / 100,
    };
  })();

  const updItem = (i, patch) => setItems(p => p.map((x, idx) => idx === i ? { ...x, ...patch } : x));

  const handleSave = async () => {
    setError("");
    if (!form.nota_number.trim()) { setError("Informe o número da nota."); return; }
    const validItems = items.filter(it => it.product_name.trim() && (Number(it.quantity) || 0) > 0);
    if (validItems.length === 0 && entry.entry_kind !== "despesa") { setError("Informe ao menos um item."); return; }
    const mapped = validItems.map(it => ({
      product_id: it.product_id || undefined,
      product_code: it.product_code || "",
      product_name: it.product_name,
      quantity: Number(it.quantity) || 0,
      unit_price: Number(it.unit_price) || 0,
      total: Math.round(((Number(it.quantity) || 0) * (Number(it.unit_price) || 0)) * 100) / 100,
      cst_icms: it.cst_icms || "", base_icms: r2(it.base_icms), icms_rate: Number(it.icms_rate) || 0,
      aliq_reducao_icms: Number(it.aliq_reducao_icms) || 0, icms_value: r2(it.icms_value),
      difal_value: r2(it.difal_value),
      cst_pis: it.cst_pis || "", cst_cofins: it.cst_cofins || "",
      base_pis_cofins: r2(it.base_pis_cofins), aliq_pis_cofins: Number(it.aliq_pis_cofins) || 0,
      aliq_pis: Number(it.aliq_pis) || 0, aliq_cofins: Number(it.aliq_cofins) || 0,
      pauta_pis_cofins: Number(it.pauta_pis_cofins) || 0,
      pauta_pis: Number(it.pauta_pis) || 0, pauta_cofins: Number(it.pauta_cofins) || 0,
      pis_value: r2(it.pis_value), cofins_value: r2(it.cofins_value),
      cst_cbs: it.cst_cbs || "", cbs_rate: Number(it.cbs_rate) || 0, cbs_value: r2(it.cbs_value),
      cst_ibs: it.cst_ibs || "", ibs_rate: Number(it.ibs_rate) || 0, ibs_value: r2(it.ibs_value),
      ipi_value: r2(it.ipi_value),
    }));
    // Capa x itens: os valores dos impostos da capa devem fechar com a soma dos itens
    const taxSumOf = (k) => mapped.reduce((s, it) => s + (Number(it[k]) || 0), 0);
    const capaNum = {
      base_icms: Number(capa.base_icms) || 0,
      base_pis_cofins: Number(capa.base_pis_cofins) || 0,
      difal_value: Number(capa.difal_value) || 0,
    };
    for (const [k, label] of [["base_icms", "Base de cálculo do ICMS"], ["base_pis_cofins", "Base de PIS/COFINS"], ["difal_value", "DIFAL"]]) {
      if (capaNum[k] > 0 && Math.abs(capaNum[k] - taxSumOf(k)) > 0.01) {
        setError(`${label} da capa (${fmtMoney(capaNum[k])}) não fecha com a soma dos itens (${fmtMoney(taxSumOf(k))}).`); return;
      }
    }
    setSaving(true);
    try {
      await base44.entities.ErpFiscalEntry.update(entry.id, {
        nota_number: form.nota_number,
        issue_date: form.issue_date ? new Date(`${form.issue_date}T12:00:00`).toISOString() : undefined,
        due_date: form.due_date ? new Date(`${form.due_date}T12:00:00`).toISOString() : undefined,
        total_nota: Number(form.total_nota) || 0,
        supplier_name: form.supplier_name, supplier_cnpj: form.supplier_cnpj, supplier_uf: form.supplier_uf,
        nature_operation: form.nature_operation, cfop: form.cfop,
        operation_id: form.operation_id || undefined,
        operation_name: operations.find(o => o.id === form.operation_id)?.name || "",
        total_products: mapped.reduce((s, it) => s + it.total, 0),
        total_icms: Math.round(taxSumOf("icms_value") * 100) / 100,
        total_ipi: Math.round(taxSumOf("ipi_value") * 100) / 100,
        total_pis: Math.round(taxSumOf("pis_value") * 100) / 100,
        total_cofins: Math.round(taxSumOf("cofins_value") * 100) / 100,
        total_cbs: Math.round(taxSumOf("cbs_value") * 100) / 100,
        total_ibs: Math.round(taxSumOf("ibs_value") * 100) / 100,
        base_icms: capaNum.base_icms > 0 ? capaNum.base_icms : Math.round(taxSumOf("base_icms") * 100) / 100,
        aliq_icms: Number(capa.aliq_icms) || 0,
        aliq_reducao_icms: Number(capa.aliq_reducao_icms) || 0,
        base_pis_cofins: capaNum.base_pis_cofins > 0 ? capaNum.base_pis_cofins : Math.round(taxSumOf("base_pis_cofins") * 100) / 100,
        aliq_pis_cofins: Number(capa.aliq_pis_cofins) || 0,
        pauta_pis_cofins: Number(capa.pauta_pis_cofins) || 0,
        difal_value: capaNum.difal_value > 0 ? capaNum.difal_value : Math.round(taxSumOf("difal_value") * 100) / 100,
        dif_aliquota_value: Number(form.dif_aliquota_value) || 0,
        despesas_value: Number(form.despesas_value) || 0,
        descontos_value: Number(form.descontos_value) || 0,
        ciap_curto_value: Number(form.ciap_curto_value) || 0,
        ciap_longo_value: Number(form.ciap_longo_value) || 0,
        icms_frete_value: Number(form.icms_frete_value) || 0,
        pis_frete_value: Number(form.pis_frete_value) || 0,
        cofins_frete_value: Number(form.cofins_frete_value) || 0,
        items: mapped,
        apportionments,
        notes: form.notes,
      });
      onSaved?.();
      onClose();
    } catch (e) { setError(e.message); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-6xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
          <h3 className="font-bold flex items-center gap-2"><Wrench className="w-5 h-5 text-indigo-600" /> Manutenção da Entrada — NF {entry.nota_number}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 space-y-4">
          {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><label className="text-xs font-medium text-gray-600">Número *</label><input value={form.nota_number} onChange={e => setF("nota_number", e.target.value)} className="w-full h-9 rounded-md border border-input px-3 text-sm" /></div>
            <div><label className="text-xs font-medium text-gray-600">Emissão</label><input type="date" value={form.issue_date} onChange={e => setF("issue_date", e.target.value)} className="w-full h-9 rounded-md border border-input px-3 text-sm" /></div>
            <div><label className="text-xs font-medium text-gray-600">Vencimento (financeiro)</label><input type="date" value={form.due_date} onChange={e => setF("due_date", e.target.value)} className="w-full h-9 rounded-md border border-input px-3 text-sm" /></div>
            <div><label className="text-xs font-medium text-gray-600">Total da Nota (R$) *</label><input type="number" step="0.01" value={form.total_nota} onChange={e => setF("total_nota", e.target.value)} className="w-full h-9 rounded-md border border-input px-3 text-sm" /></div>
            <div className="col-span-2"><label className="text-xs font-medium text-gray-600">Fornecedor</label><input value={form.supplier_name} onChange={e => setF("supplier_name", e.target.value)} className="w-full h-9 rounded-md border border-input px-3 text-sm" /></div>
            <div><label className="text-xs font-medium text-gray-600">CNPJ/CPF</label><input value={form.supplier_cnpj} onChange={e => setF("supplier_cnpj", e.target.value)} className="w-full h-9 rounded-md border border-input px-3 text-sm" /></div>
            <div><label className="text-xs font-medium text-gray-600">UF</label><input value={form.supplier_uf} onChange={e => setF("supplier_uf", e.target.value.toUpperCase().slice(0, 2))} className="w-full h-9 rounded-md border border-input px-3 text-sm" /></div>
            <div className="col-span-2"><label className="text-xs font-medium text-gray-600">Operação de Entrada</label>
              <select value={form.operation_id} onChange={e => setF("operation_id", e.target.value)} className="w-full h-9 rounded-md border border-input bg-white px-3 text-sm">
                <option value="">—</option>
                {operations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            <div><label className="text-xs font-medium text-gray-600">Natureza</label><input value={form.nature_operation} onChange={e => setF("nature_operation", e.target.value)} className="w-full h-9 rounded-md border border-input px-3 text-sm" /></div>
            <div><label className="text-xs font-medium text-gray-600">CFOP</label><input value={form.cfop} onChange={e => setF("cfop", e.target.value.replace(/\D/g, "").slice(0, 4))} className="w-full h-9 rounded-md border border-input px-3 text-sm" /></div>
          </div>

          {/* Itens */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-3 py-2 border-b flex items-center justify-between">
              <h4 className="text-sm font-semibold">Itens ({items.length})</h4>
              <Button type="button" variant="outline" size="sm" onClick={() => setItems(p => [...p, { ...EMPTY_ITEM }])} className="gap-1"><Plus className="w-3.5 h-3.5" /> Item</Button>
            </div>
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b"><tr><th className="p-2 text-left">Descrição</th><th className="p-2 text-right w-20">Qtd</th><th className="p-2 text-right w-28">V. Unit.</th><th className="p-2 text-right w-24">Total</th><th className="p-2 w-10"></th></tr></thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i} className="border-b">
                    <td className="p-2"><input value={it.product_name} onChange={e => updItem(i, { product_name: e.target.value })} className="w-full h-8 rounded border border-input px-2 text-xs" /></td>
                    <td className="p-2"><input type="number" step="0.01" value={it.quantity} onChange={e => updItem(i, { quantity: Number(e.target.value) || 0 })} className="w-16 h-8 rounded border border-input px-2 text-right text-xs" /></td>
                    <td className="p-2"><input type="number" step="0.01" value={it.unit_price} onChange={e => updItem(i, { unit_price: Number(e.target.value) || 0 })} className="w-24 h-8 rounded border border-input px-2 text-right text-xs" /></td>
                    <td className="p-2 text-right font-medium">{fmtMoney((it.quantity || 0) * (it.unit_price || 0))}</td>
                    <td className="p-2 text-center">{items.length > 1 && <button type="button" onClick={() => setItems(p => p.filter((_, idx) => idx !== i))} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5 text-red-500" /></button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Impostos por item + capa */}
          <ErpFiscalItemTaxes items={items} onChange={updItem} />
          <ErpFiscalCapaTaxes capa={capa} onChange={(k, v) => setCapa(p => ({ ...p, [k]: v }))} sums={taxSums} />

          {/* Outros valores */}
          <div>
            <label className="text-xs font-medium text-gray-600">Outros valores — contabilizados nas contas da parametrização da operação</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-1">
              {[["dif_aliquota_value", "Dif. Alíquota"], ["despesas_value", "Despesas Acessórias"], ["descontos_value", "Descontos"], ["ciap_curto_value", "CIAP Curto Prazo"], ["ciap_longo_value", "CIAP Longo Prazo"], ["icms_frete_value", "ICMS Frete"], ["pis_frete_value", "PIS s/ Frete"], ["cofins_frete_value", "COFINS s/ Frete"]].map(([k, label]) => (
                <div key={k}>
                  <input type="number" step="0.01" value={form[k]} onChange={e => setF(k, e.target.value)} placeholder={label} className="w-full h-9 rounded-md border border-input px-3 text-sm" />
                  <p className="text-[10px] text-gray-400 mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Rateio */}
          <ErpApportionmentEditor apportionments={apportionments} onChange={setApportionments} setores={departments} accounts={accounts} title="Rateio do Lançamento (Setor / Conta Contábil)" />

          <div>
            <label className="text-xs font-medium text-gray-600">Observações</label>
            <textarea value={form.notes} onChange={e => setF("notes", e.target.value)} rows={2} className="w-full rounded-md border border-input px-3 py-2 text-sm" />
          </div>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t sticky bottom-0 bg-white">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 gap-1.5">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />} Salvar Correções
          </Button>
        </div>
      </div>
    </div>
  );
}
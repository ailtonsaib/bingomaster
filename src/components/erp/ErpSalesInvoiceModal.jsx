// Faturar pedido de venda (módulo Comercial → integração Fiscal):
// - seleciona a operação de saída (ErpOperation), que define o CFOP dentro/fora
//   do estado e as flags (fiscal, financeiro, contábil);
// - aplica a regra fiscal (ErpTaxRule) por item: ICMS, PIS, COFINS, IPI, DIFAL e ST;
// - gera as parcelas no Contas a Receber (ErpReceivable) e baixa o estoque;
// - grava os dados fiscais no pedido, base da emissão da NF-e de saída.
import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { X, Loader2, Plus, Trash2 } from "lucide-react";
import { fmtMoney, fmtDate } from "@/lib/erpUtils";
import { computeErpFiscalItem, computeErpTotals } from "@/lib/erpTaxCalc";

const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const addDays = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

export default function ErpSalesInvoiceModal({ user, order, products, customers, onClose, onSaved }) {
  const [operations, setOperations] = useState([]);
  const [rules, setRules] = useState(null);
  const [companyUF, setCompanyUF] = useState("");
  const [operationId, setOperationId] = useState(order.operation_id || "");
  const [installments, setInstallments] = useState(
    (order.installments || []).length
      ? order.installments.map(p => ({ due_date: String(p.due_date || "").slice(0, 10), amount: p.amount }))
      : [{ due_date: addDays(30), amount: 0 }]
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      base44.entities.ErpOperation.filter({ user_email: user.email, type: "saida", is_active: true }, "name", 500),
      base44.entities.ErpTaxRule.filter({ user_email: user.email }, "-created_date", 500),
      base44.entities.ErpCompany.filter({ user_email: user.email }, "-created_date", 50),
    ]).then(([ops, rls, comps]) => {
      setOperations(ops);
      setRules(rls);
      const comp = comps.find(c => c.is_main) || comps[0];
      setCompanyUF(comp?.uf || "");
      setOperationId(prev => prev || ops[0]?.id || "");
    }).catch(() => setRules([]));
  }, [user.email]);

  const customer = customers.find(c => c.id === order.customer_id) || {};
  const operation = operations.find(o => o.id === operationId) || null;
  const sameUF = !!customer.uf && customer.uf === companyUF;
  const cfopCapa = operation ? (String(sameUF ? operation.cfop_dentro_estado : operation.cfop_fora_estado) || "") : "";
  const subtotal = (order.items || []).reduce((s, it) => s + (Number(it.total) || 0), 0);
  const discount = Number(order.discount) || 0;

  const calc = useMemo(() => {
    if (!rules || !operation) return null;
    const items = (order.items || []).map(it => {
      const product = products.find(p => p.id === it.product_id) || {};
      const gross = Number(it.total) || 0;
      // desconto do pedido rateado proporcionalmente nos itens
      const eff = subtotal > 0 ? Math.max(0, r2(gross - (discount * gross) / subtotal)) : gross;
      const qty = Number(it.quantity) || 0;
      const unitPrice = qty > 0 ? r2(eff / qty) : r2(eff);
      const c = computeErpFiscalItem(
        { ncm: product.ncm || "", quantity: qty, unit_price: unitPrice },
        { rules, operation: { ...operation, cfop: cfopCapa }, customerUF: customer.uf, companyUF, destinatarioTipo: "contribuinte" }
      );
      return {
        ...c,
        product_id: it.product_id, product_name: it.product_name,
        product_code: product.code || "", barcode: product.barcode || "",
        unit: it.unit || product.unit || "UN",
      };
    });
    return { items, totals: computeErpTotals(items) };
  }, [rules, operationId, companyUF]);

  const notaTotal = calc ? calc.totals.total_nota : 0;

  // preenche a parcela única com o total da nota enquanto o usuário não mexe
  useEffect(() => {
    if (notaTotal > 0 && installments.length === 1 && !(Number(installments[0].amount) > 0)) {
      setInstallments(prev => [{ ...prev[0], amount: notaTotal }]);
    }
  }, [notaTotal]);

  const setInstallment = (i, field, value) => setInstallments(prev => {
    const next = [...prev];
    next[i] = { ...next[i], [field]: field === "amount" ? Number(value) : value };
    return next;
  });

  const handleConfirm = async () => {
    if (!operation) { alert("Selecione a operação de saída."); return; }
    if (!calc) return;
    if (operation.flag_fiscal && !cfopCapa) {
      alert("A operação é fiscal: cadastre o CFOP dentro/fora do estado na operação antes de faturar.");
      return;
    }
    const parcels = installments
      .map(p => ({ due_date: p.due_date ? new Date(`${p.due_date}T12:00:00`).toISOString() : "", amount: r2(p.amount) }))
      .filter(p => p.due_date && p.amount > 0);
    if (operation.flag_financeiro) {
      if (!parcels.length) { alert("Informe ao menos uma parcela com vencimento e valor."); return; }
      if (r2(parcels.reduce((s, p) => s + p.amount, 0)) !== r2(notaTotal)) {
        alert("A soma das parcelas deve fechar com o total da nota.");
        return;
      }
    }
    // estoque: valida e baixa apenas produtos com controle de estoque
    const stockItems = (order.items || []).filter(it => {
      const p = products.find(p => p.id === it.product_id);
      return p && p.controla_estoque !== false;
    });
    for (const it of stockItems) {
      const p = products.find(p => p.id === it.product_id);
      if ((Number(p.stock) || 0) < (Number(it.quantity) || 0)) { alert(`Estoque insuficiente de "${p.name}".`); return; }
    }

    setSaving(true);
    try {
      for (const it of stockItems) {
        const p = products.find(p => p.id === it.product_id);
        await base44.entities.ErpProduct.update(p.id, { stock: r2(Number(p.stock) || 0) - r2(Number(it.quantity) || 0) });
      }
      if (operation.flag_financeiro) {
        await base44.entities.ErpReceivable.bulkCreate(parcels.map((p, i) => ({
          user_email: user.email,
          description: `Pedido ${order.number} — parcela ${i + 1}/${parcels.length}`,
          customer_name: order.customer_name || customer.name || "",
          category: "Venda",
          due_date: p.due_date,
          amount: p.amount,
          status: "aberto",
          notes: `Operação: ${operation.name}${order.payment_method ? ` — ${order.payment_method}` : ""}`,
        })));
      }
      await base44.entities.ErpSalesOrder.update(order.id, {
        status: "faturado",
        operation_id: operation.id,
        operation_name: operation.name,
        nature_operation: operation.nature_operation || operation.name,
        cfop: cfopCapa,
        items: calc.items.map(it => ({
          product_id: it.product_id, product_code: it.product_code, barcode: it.barcode,
          product_name: it.product_name, ncm: it.ncm, cfop: it.cfop, unit: it.unit,
          quantity: it.quantity, unit_price: it.unit_price, total: it.total,
          cst_icms: it.cst_icms, base_icms: it.icms_base, icms_rate: it.icms_rate, icms_value: it.icms_value,
          cst_pis: it.cst_pis, pis_rate: it.pis_rate, pis_value: it.pis_value,
          cst_cofins: it.cst_cofins, cofins_rate: it.cofins_rate, cofins_value: it.cofins_value,
          ipi_rate: it.ipi_rate, ipi_value: it.ipi_value,
        })),
        total_products: calc.totals.total_products,
        total_icms: calc.totals.total_icms,
        total_ipi: calc.totals.total_ipi,
        total_pis: calc.totals.total_pis,
        total_cofins: calc.totals.total_cofins,
        total_fcp: calc.totals.total_fcp,
        total_st: calc.totals.total_st,
        total_difal: calc.totals.total_difal,
        total_nota: notaTotal,
        total: notaTotal,
        installments: parcels,
        financeiro_gerado: !!operation.flag_financeiro,
      });
      onSaved();
      onClose();
    } catch (e) { alert("Erro ao faturar: " + e.message); }
    setSaving(false);
  };

  const tot = calc?.totals;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
          <div>
            <h2 className="font-bold">Faturar Pedido {order.number}</h2>
            <p className="text-xs text-gray-500">{order.customer_name} — emissão {fmtDate(order.emission_date)}{discount > 0 ? ` — desconto ${fmtMoney(discount)}` : ""}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
        </div>

        {!calc ? (
          <div className="p-10 text-center text-gray-400"><Loader2 className="w-8 h-8 animate-spin inline" /></div>
        ) : (
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Label>Operação de Saída *</Label>
                <select value={operationId} onChange={e => setOperationId(e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm mt-1">
                  <option value="">Selecione...</option>
                  {operations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              <div>
                <Label>CFOP ({sameUF ? "dentro" : "fora"} do estado)</Label>
                <p className="h-9 flex items-center font-mono text-sm mt-1">{cfopCapa || "—"}</p>
              </div>
            </div>

            {operation && (
              <div className="flex gap-2 text-xs">
                {[
                  { on: operation.flag_fiscal, label: "Fiscal" },
                  { on: operation.flag_financeiro, label: "Gera contas a receber" },
                  { on: operation.flag_contabil, label: "Contábil" },
                ].map(f => (
                  <span key={f.label} className={`px-2 py-0.5 rounded-full ${f.on ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-400"}`}>{f.label}</span>
                ))}
              </div>
            )}

            <div className="border rounded-lg overflow-hidden">
              <div className="p-2 bg-gray-50 border-b text-sm font-semibold">Impostos calculados pela regra fiscal</div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-100 text-gray-500">
                    <tr>
                      <th className="p-2 text-left">Produto</th>
                      <th className="p-2 text-center">NCM</th>
                      <th className="p-2 text-center">CFOP</th>
                      <th className="p-2 text-right">Qtd</th>
                      <th className="p-2 text-right">Total</th>
                      <th className="p-2 text-right">ICMS</th>
                      <th className="p-2 text-right">PIS</th>
                      <th className="p-2 text-right">COFINS</th>
                      <th className="p-2 text-right">IPI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calc.items.map((it, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-2">{it.product_name}</td>
                        <td className="p-2 text-center font-mono">{it.ncm || "—"}</td>
                        <td className="p-2 text-center font-mono">{it.cfop || "—"}</td>
                        <td className="p-2 text-right">{it.quantity}</td>
                        <td className="p-2 text-right">{fmtMoney(it.total)}</td>
                        <td className="p-2 text-right" title={`CST ${it.cst_icms} — base ${fmtMoney(it.icms_base)}`}>{fmtMoney(it.icms_value)}</td>
                        <td className="p-2 text-right" title={`CST ${it.cst_pis || "—"}`}>{fmtMoney(it.pis_value)}</td>
                        <td className="p-2 text-right" title={`CST ${it.cst_cofins || "—"}`}>{fmtMoney(it.cofins_value)}</td>
                        <td className="p-2 text-right">{fmtMoney(it.ipi_value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-2 bg-gray-50 border-t grid grid-cols-4 gap-2 text-xs">
                <span>Produtos: <b>{fmtMoney(tot.total_products)}</b></span>
                <span>ICMS: <b>{fmtMoney(tot.total_icms)}</b></span>
                <span>IPI: <b>{fmtMoney(tot.total_ipi)}</b></span>
                <span>PIS/COFINS: <b>{fmtMoney(r2(tot.total_pis + tot.total_cofins))}</b></span>
                <span>FCP: <b>{fmtMoney(tot.total_fcp)}</b></span>
                <span>ICMS-ST: <b>{fmtMoney(tot.total_st)}</b></span>
                <span>DIFAL: <b>{fmtMoney(tot.total_difal)}</b></span>
                <span className="text-sm">Total da Nota: <b className="text-emerald-700">{fmtMoney(notaTotal)}</b></span>
              </div>
            </div>

            {operation?.flag_financeiro !== false && (
              <div className="border rounded-lg overflow-hidden">
                <div className="flex items-center justify-between p-2 bg-gray-50 border-b">
                  <span className="text-sm font-semibold">Parcelas — Contas a Receber</span>
                  <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => setInstallments(prev => [...prev, { due_date: addDays(30), amount: 0 }])}><Plus className="w-3.5 h-3.5" /> Parcela</Button>
                </div>
                {installments.map((p, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 border-b last:border-0">
                    <span className="text-xs text-gray-500 w-16">{i + 1}ª parcela</span>
                    <input type="date" value={p.due_date} onChange={e => setInstallment(i, "due_date", e.target.value)} className="h-8 rounded-md border border-input px-2 text-xs" />
                    <input type="number" step="0.01" value={p.amount} onChange={e => setInstallment(i, "amount", e.target.value)} className="h-8 rounded-md border border-input px-2 text-xs flex-1" placeholder="Valor" />
                    <button onClick={() => setInstallments(prev => prev.filter((_, idx) => idx !== i))} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
                  </div>
                ))}
                <div className="p-2 bg-gray-50 border-t text-xs">
                  Soma das parcelas: <b>{fmtMoney(r2(installments.reduce((s, p) => s + (Number(p.amount) || 0), 0)))}</b> / Total da nota: <b>{fmtMoney(notaTotal)}</b>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="p-4 border-t flex gap-2 justify-end sticky bottom-0 bg-white">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handleConfirm} disabled={saving || !calc} className="bg-emerald-600 hover:bg-emerald-700">
            {saving ? "Faturando..." : "Confirmar Faturamento"}
          </Button>
        </div>
      </div>
    </div>
  );
}
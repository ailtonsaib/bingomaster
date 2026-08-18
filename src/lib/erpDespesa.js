import { base44 } from "@/api/base44Client";
import { gerarLancamentoEntrada } from "@/lib/erpJournal";

// Gera o lançamento contábil de uma despesa (ErpFiscalEntry entry_kind=despesa).
// Requer: entry.apportionments, entry.retentions, accounts (ErpChartAccount analíticas), param (ErpExpenseParameter).
export async function gerarContabilDespesa(user, entry, accounts, param) {
  const retList = (entry.retentions || []).filter(r => (r.value || 0) > 0);
  const je = await gerarLancamentoEntrada(
    user,
    { ...entry, apportionments: entry.apportionments || [], retentions: retList },
    accounts,
    {
      history: `Despesa ${entry.nota_number} - ${entry.supplier_name || ""}${entry.purchase_order_id ? ` (OC ${entry.purchase_order_number || ""})` : ""}`,
      complement: `Despesa ${entry.nota_number}`,
      param,
      retentions: retList,
    }
  );
  await base44.entities.ErpFiscalEntry.update(entry.id, {
    journal_entry_id: je.id,
    journal_entry_number: je.number,
    status: "lancada",
  });
  return je;
}

// Gera as contas a pagar (financeiro) de uma despesa: valor líquido ao fornecedor +
// cada retenção ao seu fornecedor; ou o valor total da nota quando não há retenções.
// Marca entry.financeiro_gerado = true (evita duplicidade).
export async function gerarFinanceiroDespesa(user, entry) {
  const retList = (entry.retentions || []).filter(r => (r.value || 0) > 0);
  const totalRetido = retList.reduce((s, r) => s + (r.value || 0), 0);
  const hasPo = !!entry.purchase_order_id;
  const desc = `Despesa ${entry.nota_number} - ${entry.supplier_name || ""}${hasPo ? ` (OC ${entry.purchase_order_number || ""})` : ""}`;
  const payables = [];
  if (totalRetido > 0) {
    payables.push({
      user_email: user.email,
      description: desc,
      beneficiary: entry.supplier_name || "",
      amount: (entry.total_nota || 0) - totalRetido,
      category: "Despesa",
      status: "aberto",
    });
    for (const r of retList) {
      payables.push({
        user_email: user.email,
        description: `Retenção ${r.type} - NF ${entry.nota_number} (${entry.supplier_name || ""})`,
        beneficiary: r.partner_name,
        amount: r.value,
        category: `Retenção ${r.type}`,
        status: "aberto",
      });
    }
  } else {
    payables.push({
      user_email: user.email,
      description: desc,
      beneficiary: entry.supplier_name || "",
      amount: entry.total_nota || 0,
      category: "Despesa",
      status: "aberto",
    });
  }
  await base44.entities.ErpPayable.bulkCreate(payables);
  await base44.entities.ErpFiscalEntry.update(entry.id, { financeiro_gerado: true });
  return payables.length;
}
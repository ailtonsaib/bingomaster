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

// Gera as contas a pagar (financeiro) de uma entrada/despesa: valor líquido ao fornecedor +
// cada retenção ao seu fornecedor; ou o valor total da nota quando não há retenções.
// opts: { prefix, category } — rótulo da descrição/categoria (padrão "Despesa").
// Repassa entry.due_date ao vencimento de cada conta a pagar.
// Marca entry.financeiro_gerado = true (evita duplicidade).
export async function gerarFinanceiroDespesa(user, entry, opts = {}) {
  const prefix = opts.prefix || "Despesa";
  const category = opts.category || "Despesa";
  const retList = (entry.retentions || []).filter(r => (r.value || 0) > 0);
  const totalRetido = retList.reduce((s, r) => s + (r.value || 0), 0);
  const hasPo = !!entry.purchase_order_id;
  const desc = `${prefix} ${entry.nota_number} - ${entry.supplier_name || ""}${hasPo ? ` (OC ${entry.purchase_order_number || ""})` : ""}`;
  const due = entry.due_date || undefined;
  const instList = (entry.installments || []).filter(i => (i.amount || 0) > 0);
  const payables = [];
  if (instList.length && totalRetido === 0) {
    // Parcelas informadas (digitação manual): uma conta a pagar por parcela
    instList.forEach((inst, idx) => {
      payables.push({
        user_email: user.email,
        description: `${desc} — Parcela ${idx + 1}/${instList.length}`,
        beneficiary: entry.supplier_name || "",
        amount: inst.amount,
        category,
        status: "aberto",
        due_date: inst.due_date || due,
      });
    });
  } else if (totalRetido > 0) {
    payables.push({
      user_email: user.email,
      description: desc,
      beneficiary: entry.supplier_name || "",
      amount: (entry.total_nota || 0) - totalRetido,
      category,
      status: "aberto",
      due_date: due,
    });
    for (const r of retList) {
      payables.push({
        user_email: user.email,
        description: `Retenção ${r.type} - NF ${entry.nota_number} (${entry.supplier_name || ""})`,
        beneficiary: r.partner_name,
        amount: r.value,
        category: `Retenção ${r.type}`,
        status: "aberto",
        due_date: due,
      });
    }
  } else {
    payables.push({
      user_email: user.email,
      description: desc,
      beneficiary: entry.supplier_name || "",
      amount: entry.total_nota || 0,
      category,
      status: "aberto",
      due_date: due,
    });
  }
  await base44.entities.ErpPayable.bulkCreate(payables);
  await base44.entities.ErpFiscalEntry.update(entry.id, { financeiro_gerado: true });
  return payables.length;
}

// Lança uma entrada de NF (ErpFiscalEntry entry_kind=nf_entrada): gera o movimento
// contábil (lançamento), atualiza o estoque dos itens e gera o financeiro (contas a
// pagar) com o vencimento informado. Reutilizado pelo painel ("Atualizar Lançamento")
// e pelo modal de entrada (lançamento automático quando a entrada já vem aprovada).
export async function lancarEntradaNF(user, entry, accounts) {
  const passivo = accounts.find(a => a.account_type === "passivo" && /fornecedor|contas a pagar/i.test(a.name));
  if (!passivo) throw new Error("Cadastre uma conta de passivo 'Fornecedores' (ou 'Contas a Pagar') para gerar o lançamento.");
  if (!entry.apportionments?.length) throw new Error("Sem rateio vinculado à nota. Vincule uma ordem de compra com rateio ou informe o rateio.");

  const je = await gerarLancamentoEntrada(user, entry, accounts);

  // Atualiza estoque dos itens (prefere vínculo product_id, depois código/barras/nome)
  const products = await base44.entities.ErpProduct.filter({ user_email: user.email }, "-created_date", 500);
  const byId = new Map(products.map(p => [p.id, p]));
  for (const it of entry.items || []) {
    const prod = (it.product_id && byId.get(it.product_id)) || products.find(p => (p.code && p.code === it.product_code) || (p.barcode && p.barcode === it.barcode) || (p.name && p.name.toLowerCase() === (it.product_name || "").toLowerCase()));
    if (prod) {
      await base44.entities.ErpProduct.update(prod.id, {
        stock: (prod.stock || 0) + (it.quantity || 0),
        cost_price: it.unit_price || prod.cost_price,
      });
    }
  }

  await base44.entities.ErpFiscalEntry.update(entry.id, {
    status: "lancada",
    journal_entry_id: je.id,
    journal_entry_number: je.number,
  });

  // Financeiro — contas a pagar com o vencimento informado na entrada
  if (!entry.financeiro_gerado) {
    try { await gerarFinanceiroDespesa(user, entry, { prefix: "NF", category: "NF Entrada" }); }
    catch (e) { console.error("Falha ao gerar financeiro:", e); }
  }
  return je;
}
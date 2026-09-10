import { base44 } from "@/api/base44Client";
import { gerarLancamentoEntrada, gerarLancamentoFrete } from "@/lib/erpJournal";

// Carrega a operação (ErpOperation) da entrada — null quando não vinculada/falha
async function loadOperation(user, operation_id) {
  if (!operation_id) return null;
  try { return await base44.entities.ErpOperation.get(operation_id); } catch (e) { return null; }
}

// Gera o lançamento contábil de uma despesa (ErpFiscalEntry entry_kind=despesa).
// Requer: entry.apportionments, entry.retentions, accounts (ErpChartAccount analíticas), param (ErpExpenseParameter).
// Se a operação tiver a flag Contábil desligada, não gera lançamento — apenas marca a despesa como lançada.
export async function gerarContabilDespesa(user, entry, accounts, param) {
  const op = await loadOperation(user, entry.operation_id);
  if (op && op.flag_contabil === false) {
    await base44.entities.ErpFiscalEntry.update(entry.id, { status: "lancada" });
    return null;
  }
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
  // Flags da operação: Financeiro desligada → não gera contas a pagar
  const op = await loadOperation(user, entry.operation_id);
  const geraPrincipal = !op || op.flag_financeiro !== false;
  const freteOp = entry.freight?.operation_id ? await loadOperation(user, entry.freight.operation_id) : null;
  const geraFrete = !!(entry.freight && (Number(entry.freight.value) || 0) > 0 && (!freteOp || freteOp.flag_financeiro !== false));
  if (!geraPrincipal && !geraFrete) {
    await base44.entities.ErpFiscalEntry.update(entry.id, { financeiro_gerado: true });
    return 0;
  }
  const retList = (entry.retentions || []).filter(r => (r.value || 0) > 0);
  const totalRetido = retList.reduce((s, r) => s + (r.value || 0), 0);
  const hasPo = !!entry.purchase_order_id;
  const desc = `${prefix} ${entry.nota_number} - ${entry.supplier_name || ""}${hasPo ? ` (OC ${entry.purchase_order_number || ""})` : ""}`;
  const due = entry.due_date || undefined;
  const instList = (entry.installments || []).filter(i => (i.amount || 0) > 0);
  const payables = [];
  if (geraPrincipal) {
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
  }
  // Frete (CT-e/NF-e/NFS importado): título próprio para a transportadora
  if (geraFrete) {
    payables.push({
      user_email: user.email,
      description: `Frete ${entry.freight.doc_number || ""} - ${entry.freight.supplier_name || ""} (NF ${entry.nota_number})`,
      beneficiary: entry.freight.supplier_name || "",
      amount: Number(entry.freight.value) || 0,
      category: "Frete",
      status: "aberto",
      due_date: entry.freight.due_date || due,
    });
  }
  await base44.entities.ErpPayable.bulkCreate(payables.map(p => ({ ...p, fiscal_entry_id: entry.id })));
  await base44.entities.ErpFiscalEntry.update(entry.id, { financeiro_gerado: true });
  return payables.length;
}

// Reabre o lançamento de uma entrada de NF: exclui o lançamento contábil (e o do
// frete), as contas a pagar geradas em aberto e estorna a quantidade em estoque,
// voltando a entrada para "aprovada" — ao lançar novamente nada é duplicado.
export async function reabrirEntradaNF(user, entry) {
  const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

  // 1. Lançamentos contábeis (principal e do frete)
  let journals = 0;
  for (const id of [entry.journal_entry_id, entry.freight?.journal_entry_id].filter(Boolean)) {
    try { await base44.entities.ErpJournalEntry.delete(id); journals++; } catch (e) { console.error(e); }
  }

  // 2. Contas a pagar geradas: pelo vínculo fiscal_entry_id; para as geradas antes
  // do vínculo, pela descrição (NF/Despesa + número) — somente as em aberto
  const esc = String(entry.nota_number).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pat = new RegExp(`(NF|Despesa) ${esc}([^0-9]|$)`);
  const payables = await base44.entities.ErpPayable.filter({ user_email: user.email, status: "aberto" }, "-created_date", 500);
  const linked = payables.filter(p => p.fiscal_entry_id === entry.id || (!p.fiscal_entry_id && pat.test(p.description || "")));
  let deletedPayables = 0;
  for (const p of linked) {
    try { await base44.entities.ErpPayable.delete(p.id); deletedPayables++; } catch (e) { console.error(e); }
  }

  // 3. Estorna a quantidade em estoque entrada pelos itens (o custo é recalculado no novo lançamento)
  const products = await base44.entities.ErpProduct.filter({ user_email: user.email }, "-created_date", 500);
  const byId = new Map(products.map(p => [p.id, p]));
  for (const it of entry.items || []) {
    const prod = (it.product_id && byId.get(it.product_id)) || products.find(p => (p.code && p.code === it.product_code) || (p.name && p.name.toLowerCase() === (it.product_name || "").toLowerCase()));
    if (!prod) continue;
    const qty = Number(it.quantity) || 0;
    if (qty > 0) await base44.entities.ErpProduct.update(prod.id, { stock: r2(Math.max(0, (prod.stock || 0) - qty)) });
  }

  // 4. Volta a entrada para aprovada — pronta para correção e novo lançamento
  await base44.entities.ErpFiscalEntry.update(entry.id, {
    status: "aprovada",
    journal_entry_id: "",
    journal_entry_number: "",
    financeiro_gerado: false,
    ...(entry.freight ? { freight: { ...entry.freight, journal_entry_id: "", journal_entry_number: "" } } : {}),
  });

  return { journals, payables: deletedPayables };
}

// Lança uma entrada de NF (ErpFiscalEntry entry_kind=nf_entrada): gera o movimento
// contábil (lançamento), atualiza o estoque dos itens e gera o financeiro (contas a
// pagar) com o vencimento informado. Reutilizado pelo painel ("Atualizar Lançamento")
// e pelo modal de entrada (lançamento automático quando a entrada já vem aprovada).
export async function lancarEntradaNF(user, entry, accounts) {
  const passivo = accounts.find(a => a.account_type === "passivo" && /fornecedor|contas a pagar/i.test(a.name));
  if (!passivo) throw new Error("Cadastre uma conta de passivo 'Fornecedores' (ou 'Contas a Pagar') para gerar o lançamento.");
  if (!entry.apportionments?.length && entry.entry_kind !== "nf_entrada") throw new Error("Sem rateio vinculado à nota. Vincule uma ordem de compra com rateio ou informe o rateio.");

  // Flags da operação: Contábil desligada → não gera lançamento contábil (nem do frete)
  const op = await loadOperation(user, entry.operation_id);
  const geraContabil = !op || op.flag_contabil !== false;
  const freteOp = entry.freight?.operation_id ? await loadOperation(user, entry.freight.operation_id) : null;
  const geraContabilFrete = !freteOp || freteOp.flag_contabil !== false;

  // Parametrização contábil da operação de entrada (ErpOperationAccounting) —
  // contas do lançamento definidas por operação (fornecedores/impostos a recuperar)
  let acctParam = null;
  if (entry.operation_id) {
    try {
      const aps = await base44.entities.ErpOperationAccounting.filter({ user_email: user.email, operation_id: entry.operation_id }, "-created_date", 10);
      acctParam = aps[0] || null;
    } catch (e) { acctParam = null; }
  }
  let je = null;
  if (geraContabil) {
    je = await gerarLancamentoEntrada(user, entry, accounts, acctParam ? { acctParam } : {});
  }

  // Atualiza estoque dos itens (prefere vínculo product_id, depois código/barras/nome)
  const products = await base44.entities.ErpProduct.filter({ user_email: user.email }, "-created_date", 500);
  const byId = new Map(products.map(p => [p.id, p]));
  // Frete: valor líquido (deduzidos os créditos) rateado no custo pelo valor dos itens
  const fr = entry.freight;
  const freightNet = fr ? (Number(fr.value) || 0) - (Number(fr.icms_value) || 0) - (Number(fr.pis_value) || 0) - (Number(fr.cofins_value) || 0) : 0;
  const itemsGrossTotal = (entry.items || []).reduce((s, it) => s + (Number(it.total) || (Number(it.quantity) || 0) * (Number(it.unit_price) || 0)), 0);
  for (const it of entry.items || []) {
    const prod = (it.product_id && byId.get(it.product_id)) || products.find(p => (p.code && p.code === it.product_code) || (p.barcode && p.barcode === it.barcode) || (p.name && p.name.toLowerCase() === (it.product_name || "").toLowerCase()));
    if (prod) {
      // Custo do produto sem os impostos a creditar (ICMS/IPI/PIS/COFINS) + frete líquido
      const credited = (Number(it.icms_value) || 0) + (Number(it.ipi_value) || 0) + (Number(it.pis_value) || 0) + (Number(it.cofins_value) || 0) + (Number(it.difal_value) || 0);
      const qty = Number(it.quantity) || 0;
      const gross = Number(it.total) || qty * (Number(it.unit_price) || 0);
      const freteShare = freightNet > 0 && itemsGrossTotal > 0 ? freightNet * (gross / itemsGrossTotal) : 0;
      const netCost = qty > 0 ? (Number(it.unit_price) || 0) - credited / qty + freteShare / qty : Number(it.unit_price) || 0;
      await base44.entities.ErpProduct.update(prod.id, {
        stock: (prod.stock || 0) + qty,
        cost_price: netCost > 0 ? netCost : (prod.cost_price || 0),
      });
    }
  }

  await base44.entities.ErpFiscalEntry.update(entry.id, {
    status: "lancada",
    ...(je ? { journal_entry_id: je.id, journal_entry_number: je.number } : {}),
  });

  // Lançamento do frete (transportadora): impostos a recuperar + custo líquido x fornecedor de frete
  if (geraContabilFrete && entry.freight && (Number(entry.freight.value) || 0) > 0) {
    let freteParam = null;
    if (entry.freight.operation_id) {
      try {
        const aps = await base44.entities.ErpOperationAccounting.filter({ user_email: user.email, operation_id: entry.freight.operation_id }, "-created_date", 10);
        freteParam = aps[0] || null;
      } catch (e) { freteParam = null; }
    }
    try {
      const fje = await gerarLancamentoFrete(user, entry, accounts, freteParam ? { acctParam: freteParam } : {});
      await base44.entities.ErpFiscalEntry.update(entry.id, { freight: { ...entry.freight, journal_entry_id: fje.id, journal_entry_number: fje.number } });
    } catch (e) {
      alert(`Lançamento do frete não gerado: ${e.message}`);
    }
  }

  // Financeiro — contas a pagar com o vencimento informado na entrada
  if (!entry.financeiro_gerado) {
    try { await gerarFinanceiroDespesa(user, entry, { prefix: "NF", category: "NF Entrada" }); }
    catch (e) { console.error("Falha ao gerar financeiro:", e); }
  }
  return je;
}
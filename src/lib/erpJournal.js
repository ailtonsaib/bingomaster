import { base44 } from "@/api/base44Client";
import { genOrderNumber } from "@/lib/erpUtils";

// Gera o lançamento contábil de uma entrada fiscal (NF de entrada ou despesa).
// Débito nas contas do rateio (despesa/custo) + débito nos créditos de impostos (a recuperar) /
// outras de impostos; crédito na conta credora (Fornecedores/Contas a Pagar) pelo valor líquido
// e crédito nas contas das retenções (Impostos a Pagar) pelos valores retidos.
// `entry` deve conter: nota_number, supplier_name, total_nota, total_icms, total_pis, total_cofins,
// apportionments, purchase_order_number, retentions.
// `accounts` = lista de ErpChartAccount analíticas (accepts_entries) do escopo do usuário.
// `opts` (opcional): { history, complement, param, retentions }.
//   - opts.param: parâmetro de despesa (ErpExpenseParameter) com credora/outras/credit_accounts/retentions.
//   - opts.retentions: lista de retenções resolvida { type, value, partner_id, account_id, ... }.
//   - opts.acctParam: parametrização contábil da operação (ErpOperationAccounting) — contas do
//     lançamento da NF de entrada: fornecedores (C total), ICMS/PIS/COFINS/IPI a recuperar (D).
export async function gerarLancamentoEntrada(user, entry, accounts, opts = {}) {
  const param = opts.param || null;
  const acctParam = opts.acctParam || null;
  const acctLine = (key) => (acctParam?.lines || []).find((l) => l.key === key && l.account_id);
  const byIdOrCache = (l) => accounts.find((a) => a.id === l.account_id) || { id: l.account_id, code: l.account_code, name: l.account_name };
  const retentions = opts.retentions || entry.retentions || [];
  const complement = opts.complement || `Entrada NF ${entry.nota_number}`;

  // Conta credora: parametrização da operação, parâmetro de despesa ou detecção automática (passivo Fornecedores/Contas a Pagar)
  let credora = null;
  const fornLine = acctLine("fornecedores");
  if (fornLine) credora = byIdOrCache(fornLine);
  if (!credora && param?.credora_account_id) credora = accounts.find((a) => a.id === param.credora_account_id);
  if (!credora) {
    credora = accounts.find(
      (a) => a.account_type === "passivo" && /fornecedor|contas a pagar/i.test(a.name)
    );
  }
  if (!credora) {
    throw new Error(
      "Configure a conta credora (Fornecedores/Contas a Pagar) no parâmetro de despesas ou cadastre uma conta de passivo 'Fornecedores'."
    );
  }
  // Entrada de estoque (nf_entrada): o valor líquido de cada item vai ao débito da
  // conta de estoque do cadastro do produto, junto com o seu setor da estrutura
  // orçamentária. Itens sem conta de estoque permanecem no rateio.
  const stockItems = [];
  if (entry.entry_kind === "nf_entrada" && (entry.items || []).length) {
    const products = await base44.entities.ErpProduct.filter({ user_email: user.email }, "-created_date", 500).catch(() => []);
    const byId = new Map(products.map((p) => [p.id, p]));
    for (const it of entry.items) {
      const prod = (it.product_id && byId.get(it.product_id)) || products.find((p) => (p.code && p.code === it.product_code) || (p.barcode && p.barcode === it.barcode) || (p.name && p.name.toLowerCase() === (it.product_name || "").toLowerCase()));
      if (!prod?.account_estoque_id) continue;
      const credited = (Number(it.icms_value) || 0) + (Number(it.ipi_value) || 0) + (Number(it.pis_value) || 0) + (Number(it.cofins_value) || 0);
      const gross = Number(it.total) || (Number(it.quantity) || 0) * (Number(it.unit_price) || 0);
      const net = gross - credited;
      if (net > 0) stockItems.push({ prod, net, name: it.product_name || prod.name });
    }
  }
  const stockNetTotal = stockItems.reduce((s, x) => s + x.net, 0);

  if ((!entry.apportionments || entry.apportionments.length === 0) && stockItems.length === 0) {
    throw new Error("Sem rateio vinculado à nota e sem itens com conta de estoque no cadastro do produto.");
  }

  // Retenções: resolve a conta de cada retenção (do parâmetro) se não vier informada
  const retResolved = retentions.map((r) => {
    if (r.account_id) return r;
    const pr = param?.retentions?.find((x) => x.type === r.type);
    return { ...r, account_id: pr?.account_id || "", account_name: pr?.account_name || "", account_code: pr?.account_code || "" };
  });
  const retWithAcct = retResolved.filter((r) => r.account_id && (r.value || 0) > 0);
  const retentionsValueWithAcct = retWithAcct.reduce((s, r) => s + (r.value || 0), 0);

  // Créditos de impostos (ICMS/PIS/COFINS/IPI a recuperar) e outras de impostos (sem crédito).
  // Com a parametrização da operação, usa as contas configuradas por operação.
  const taxes = [
    { type: "ICMS", value: entry.total_icms || 0 },
    { type: "PIS", value: entry.total_pis || 0 },
    { type: "COFINS", value: entry.total_cofins || 0 },
    ...(acctLine("ipi") ? [{ type: "IPI", value: entry.total_ipi || 0 }] : []),
  ];
  let despesaBase = entry.total_nota;
  const debitTaxLines = [];
  for (const t of taxes) {
    if (t.value > 0) {
      const pl = acctLine(String(t.type).toLowerCase());
      if (pl) {
        const acc = byIdOrCache(pl);
        debitTaxLines.push({ account_id: acc.id, account_code: acc.code, account_name: acc.name, debit: t.value, credit: 0, complement: pl.history_text || `Crédito ${t.type} NF ${entry.nota_number}` });
        despesaBase -= t.value;
        continue;
      }
      const cc = (param?.credit_accounts || []).find((c) => c.type === t.type && c.account_id);
      if (cc) {
        const acc = accounts.find((a) => a.id === cc.account_id);
        if (acc) {
          debitTaxLines.push({ account_id: acc.id, account_code: acc.code, account_name: acc.name, debit: t.value, credit: 0, complement: `Crédito ${t.type} NF ${entry.nota_number}` });
          despesaBase -= t.value;
        } else {
          throw new Error(`Conta de crédito de ${t.type} não encontrada no plano de contas.`);
        }
      } else if (param?.outras_impostos_account_id) {
        const acc = accounts.find((a) => a.id === param.outras_impostos_account_id);
        if (acc) {
          debitTaxLines.push({ account_id: acc.id, account_code: acc.code, account_name: acc.name, debit: t.value, credit: 0, complement: `Outras impostos ${t.type} NF ${entry.nota_number}` });
          despesaBase -= t.value;
        }
        // se a conta de outras não existir no plano, mantém na despesa (rateio)
      }
      // sem crédito e sem conta de outras configurada → permanece na despesa (despesaBase)
    }
  }

  // Linhas opcionais da parametrização da operação: despesas acessórias e CIAP
  // (débito — saem do rateio para a conta configurada) e dif. alíquota/descontos
  // (crédito — geram custo bruto com contrapartida de imposto a recolher/descontos obtidos).
  const extraDebitSpecs = [
    { key: "despesas", value: Number(entry.despesas_value) || 0, label: "DESPESAS" },
    { key: "ciap_curto_prazo", value: Number(entry.ciap_curto_value) || 0, label: "CIAP CURTO PRAZO" },
    { key: "ciap_longo_prazo", value: Number(entry.ciap_longo_value) || 0, label: "CIAP LONGO PRAZO" },
  ];
  const extraCreditSpecs = [
    { key: "dif_aliquota", value: Number(entry.dif_aliquota_value) || 0, label: "DIF. ALIQUOTA" },
    { key: "descontos", value: Number(entry.descontos_value) || 0, label: "DESCONTOS" },
  ];
  const extraDebitLines = [];
  const extraCreditLines = [];
  for (const o of extraDebitSpecs) {
    const pl = acctLine(o.key);
    if (!pl || !(o.value > 0)) continue;
    const acc = byIdOrCache(pl);
    extraDebitLines.push({ account_id: acc.id, account_code: acc.code, account_name: acc.name, debit: o.value, credit: 0, complement: pl.history_text || `${o.label} NF ${entry.nota_number}` });
    despesaBase -= o.value;
  }
  for (const o of extraCreditSpecs) {
    const pl = acctLine(o.key);
    if (!pl || !(o.value > 0)) continue;
    const acc = byIdOrCache(pl);
    extraCreditLines.push({ account_id: acc.id, account_code: acc.code, account_name: acc.name, debit: 0, credit: o.value, complement: pl.history_text || `${o.label} NF ${entry.nota_number}` });
    despesaBase += o.value;
  }

  const lines = [];
  // Débito nas contas de estoque dos produtos (entrada de estoque)
  for (const s of stockItems) {
    const acc = accounts.find((a) => a.id === s.prod.account_estoque_id);
    lines.push({
      account_id: s.prod.account_estoque_id,
      account_code: acc?.code || "",
      account_name: s.prod.account_estoque_name || acc?.name || "",
      debit: s.net,
      credit: 0,
      sector_id: s.prod.stock_sector_id || "",
      sector_name: s.prod.stock_sector_name || "",
      complement: `Entrada estoque ${s.name}${s.prod.stock_sector_name ? ` — setor ${s.prod.stock_sector_name}` : ""} NF ${entry.nota_number}`,
    });
  }
  // Débito despesa (rateio) sobre a base líquida restante (total_nota − créditos − estoque)
  const rateioBase = despesaBase - stockNetTotal;
  for (const ap of entry.apportionments || []) {
    const val =
      ap.rateio_type === "value"
        ? ap.value
        : rateioBase * ((ap.percent || 0) / 100);
    if (val > 0 && ap.account_id) {
      lines.push({
        account_id: ap.account_id,
        account_code: ap.account_code,
        account_name: ap.account_name,
        debit: val,
        credit: 0,
        complement,
      });
    }
  }
  // Débito dos impostos (créditos a recuperar + outras de impostos) e linhas opcionais (despesas/CIAP)
  for (const l of debitTaxLines) lines.push(l);
  for (const l of extraDebitLines) lines.push(l);

  const totalDebit = lines.reduce((a, l) => a + l.debit, 0);

  // Crédito credora (Fornecedores/Contas a Pagar) pelo restante + créditos das retenções
  // e das linhas opcionais de crédito (dif. alíquota / descontos)
  const extraCreditTotal = extraCreditLines.reduce((a, l) => a + l.credit, 0);
  const credoraCredit = totalDebit - retentionsValueWithAcct - extraCreditTotal;
  lines.push({
    account_id: credora.id,
    account_code: credora.code,
    account_name: credora.name,
    debit: 0,
    credit: credoraCredit,
    complement: `NF ${entry.nota_number} - ${entry.supplier_name || ""}`,
  });
  for (const r of retWithAcct) {
    const acc = accounts.find((a) => a.id === r.account_id) || { id: r.account_id, code: r.account_code, name: r.account_name };
    lines.push({
      account_id: acc.id,
      account_code: acc.code,
      account_name: acc.name,
      debit: 0,
      credit: r.value,
      complement: `Retenção ${r.type} NF ${entry.nota_number}`,
    });
  }
  for (const l of extraCreditLines) lines.push(l);

  const totalCredit = lines.reduce((a, l) => a + l.credit, 0);

  const history =
    opts.history ||
    `Entrada NF ${entry.nota_number} - ${entry.supplier_name || ""} (OC ${entry.purchase_order_number || "---"})`;

  const je = await base44.entities.ErpJournalEntry.create({
    user_email: user.email,
    number: genOrderNumber("LCT"),
    date: new Date().toISOString(),
    history,
    document: entry.nota_number,
    lines,
    total_debit: totalDebit,
    total_credit: totalCredit,
    status: "definitivo",
  });

  return je;
}
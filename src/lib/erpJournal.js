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
export async function gerarLancamentoEntrada(user, entry, accounts, opts = {}) {
  const param = opts.param || null;
  const retentions = opts.retentions || entry.retentions || [];
  const complement = opts.complement || `Entrada NF ${entry.nota_number}`;

  // Conta credora: do parâmetro ou detecção automática (passivo Fornecedores/Contas a Pagar)
  let credora = param?.credora_account_id ? accounts.find((a) => a.id === param.credora_account_id) : null;
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
  if (!entry.apportionments || entry.apportionments.length === 0) {
    throw new Error("Sem rateio vinculado à nota. Informe o setor e a conta contábil.");
  }

  // Retenções: resolve a conta de cada retenção (do parâmetro) se não vier informada
  const retResolved = retentions.map((r) => {
    if (r.account_id) return r;
    const pr = param?.retentions?.find((x) => x.type === r.type);
    return { ...r, account_id: pr?.account_id || "", account_name: pr?.account_name || "", account_code: pr?.account_code || "" };
  });
  const retWithAcct = retResolved.filter((r) => r.account_id && (r.value || 0) > 0);
  const retentionsValueWithAcct = retWithAcct.reduce((s, r) => s + (r.value || 0), 0);

  // Créditos de impostos (ICMS/PIS/COFINS a recuperar) e outras de impostos (sem crédito)
  const taxes = [
    { type: "ICMS", value: entry.total_icms || 0 },
    { type: "PIS", value: entry.total_pis || 0 },
    { type: "COFINS", value: entry.total_cofins || 0 },
  ];
  let despesaBase = entry.total_nota;
  const debitTaxLines = [];
  for (const t of taxes) {
    if (t.value > 0) {
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

  const lines = [];
  // Débito despesa (rateio) sobre a base líquida (total_nota − créditos − outras)
  for (const ap of entry.apportionments) {
    const val =
      ap.rateio_type === "value"
        ? ap.value
        : despesaBase * ((ap.percent || 0) / 100);
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
  // Débito dos impostos (créditos a recuperar + outras de impostos)
  for (const l of debitTaxLines) lines.push(l);

  const totalDebit = lines.reduce((a, l) => a + l.debit, 0);

  // Crédito credora (Fornecedores/Contas a Pagar) pelo restante + créditos das retenções
  const credoraCredit = totalDebit - retentionsValueWithAcct;
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
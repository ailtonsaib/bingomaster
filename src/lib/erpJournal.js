import { base44 } from "@/api/base44Client";
import { genOrderNumber } from "@/lib/erpUtils";

// Gera o lançamento contábil de uma entrada fiscal (NF de entrada ou despesa).
// Débito nas contas do rateio (despesa/custo), crédito no passivo (Fornecedores/Contas a Pagar).
// `entry` deve conter: nota_number, supplier_name, total_nota, apportionments, purchase_order_number.
// `accounts` = lista de ErpChartAccount analíticas (accepts_entries) do escopo do usuário.
// `opts` (opcional): { history, complement } para customizar o histórico das linhas.
export async function gerarLancamentoEntrada(user, entry, accounts, opts = {}) {
  const passivo = accounts.find(
    (a) => a.account_type === "passivo" && /fornecedor|contas a pagar/i.test(a.name)
  );
  if (!passivo) {
    throw new Error(
      "Cadastre uma conta de passivo 'Fornecedores' (ou 'Contas a Pagar') para gerar o lançamento."
    );
  }
  if (!entry.apportionments || entry.apportionments.length === 0) {
    throw new Error("Sem rateio vinculado à nota. Informe o setor e a conta contábil.");
  }

  const complement = opts.complement || `Entrada NF ${entry.nota_number}`;
  const lines = [];
  for (const ap of entry.apportionments) {
    const val =
      ap.rateio_type === "value"
        ? ap.value
        : entry.total_nota * ((ap.percent || 0) / 100);
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
  if (lines.length === 0) {
    throw new Error("Rateio sem contas contábeis válidas.");
  }
  const totalDebit = lines.reduce((a, l) => a + l.debit, 0);
  // crédito no fornecedor (ajusta diferença de arredondamento no crédito)
  lines.push({
    account_id: passivo.id,
    account_code: passivo.code,
    account_name: passivo.name,
    debit: 0,
    credit: totalDebit,
    complement: `NF ${entry.nota_number} - ${entry.supplier_name || ""}`,
  });

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
    total_credit: totalDebit,
    status: "definitivo",
  });

  return je;
}
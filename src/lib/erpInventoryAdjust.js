import { base44 } from "@/api/base44Client";
import { genOrderNumber } from "@/lib/erpUtils";

// Lançamento contábil do ajuste de inventário (confronto físico × sistema).
// Sobra (ajuste para mais): D conta de estoque do produto × C conta informada.
// Quebra (ajuste para menos): D conta informada × C conta de estoque do produto.
// Valor = |diferença| × custo unitário informado na contagem (ou custo do produto).
export async function gerarLancamentoAjusteInventario(user, { product, account, accounts = [], diff, countDate, unitCost }) {
  const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
  const quantity = Math.abs(Number(diff) || 0);
  // Custo unitário: valor informado na contagem (importação/lançamento manual) tem prioridade;
  // sem valor informado usa o custo cadastrado no produto
  const value = r2(quantity * (Number(unitCost) > 0 ? Number(unitCost) : (Number(product?.cost_price) || 0)));
  if (quantity <= 0 || value <= 0) {
    throw new Error("Ajuste sem valor contábil — diferença zerada ou produto sem custo cadastrado.");
  }
  if (!product?.account_estoque_id) {
    throw new Error(`Produto "${product?.name || ""}" sem conta contábil de estoque — configure a conta de estoque no cadastro do produto.`);
  }
  if (!account?.id) {
    throw new Error("Informe a conta contábil do ajuste (sobras/quebras de inventário).");
  }
  const stockAcc = accounts.find((a) => a.id === product.account_estoque_id)
    || { id: product.account_estoque_id, code: "", name: product.account_estoque_name || "" };
  const isSobra = Number(diff) > 0;
  const complement = `${isSobra ? "Sobra" : "Quebra"} de inventário — ${product.name} (${quantity.toLocaleString("pt-BR")} ${product.unit || "un"})`;
  const stockLine = (debit, credit) => ({
    account_id: stockAcc.id,
    account_code: stockAcc.code || "",
    account_name: product.account_estoque_name || stockAcc.name || "",
    debit,
    credit,
    sector_id: product.stock_sector_id || "",
    sector_name: product.stock_sector_name || "",
    complement,
  });
  const adjustLine = (debit, credit) => ({
    account_id: account.id,
    account_code: account.code || "",
    account_name: account.name || "",
    debit,
    credit,
    complement,
  });
  const lines = isSobra
    ? [stockLine(value, 0), adjustLine(0, value)]
    : [adjustLine(value, 0), stockLine(0, value)];

  const je = await base44.entities.ErpJournalEntry.create({
    user_email: user.email,
    number: genOrderNumber("LCT"),
    date: countDate || new Date().toISOString(),
    history: `Ajuste de Inventário — ${product.name} (${isSobra ? "sobra" : "quebra"})`,
    document: `Inventário ${(countDate || "").slice(0, 10)}`,
    lines,
    total_debit: value,
    total_credit: value,
    status: "definitivo",
  });
  return je;
}
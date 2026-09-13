// Kardex de estoque com custo médio (média móvel ponderada) — lógica
// compartilhada entre os relatórios de Kardex e de Inventário.
// Entradas de NF usam o preço unitário da nota, ajustes de inventário usam o
// custo informado na contagem e todas as saídas (vendas, produção, requisições,
// WMS) saem ao custo médio vigente — após uma nova entrada o custo médio é
// recalculado e vale para as saídas seguintes.

const sameProd = (it, product) => it.product_id === product.id
  || (it.product_code && it.product_code === product.code)
  || (it.barcode && it.barcode === product.barcode)
  || (it.product_name || "").trim().toLowerCase() === (product.name || "").trim().toLowerCase();

export function buildKardexRows(data, product) {
  const rows = [];
  // Entradas de NF lançadas: custo unitário do item (preço da nota)
  (data.entries || []).filter(e => e.status === "lancada" && e.entry_kind !== "despesa").forEach(e => {
    (e.items || []).filter(it => sameProd(it, product)).forEach(it => {
      const qty = Number(it.quantity) || 0;
      const uc = (Number(it.unit_price) || 0) > 0
        ? Number(it.unit_price)
        : (qty > 0 ? (Number(it.total) || 0) / qty : 0);
      rows.push({ date: e.entry_date || e.issue_date || e.created_date, doc: `NF ${e.nota_number}`, hist: `Entrada de nota — ${e.supplier_name || ""}`, in: qty, out: 0, cost: uc });
    });
  });
  // Vendas faturadas: saída ao custo médio
  (data.sales || []).filter(o => o.status === "faturado").forEach(o => {
    (o.items || []).filter(it => it.product_id === product.id).forEach(it => {
      rows.push({ date: o.emission_date || o.created_date, doc: `PV ${o.number}`, hist: `Venda — ${o.customer_name || ""}`, in: 0, out: Number(it.quantity) || 0 });
    });
  });
  // Ordens de produção concluídas: consumo de insumos + produto acabado.
  // Quando a requisição ao almoxarifado foi atendida, os insumos já saíram do
  // estoque na baixa da requisição — o consumo não é repetido aqui.
  (data.productions || []).filter(o => o.status === "concluida").forEach(o => {
    const d = o.completion_date || o.created_date;
    const reqAtendida = (data.requisitions || []).some(r => r.id === o.requisition_id && r.status === "atendida");
    if (!reqAtendida) (o.bom_items || []).filter(b => b.product_id === product.id && (Number(b.total_consumed) || 0) > 0).forEach(b => {
      rows.push({ date: d, doc: `OP ${o.order_number}`, hist: "Consumo de insumos — ordem de produção", in: 0, out: Number(b.total_consumed) || 0 });
    });
    if (o.output_product_id === product.id && (Number(o.produced_quantity) || 0) > 0) {
      rows.push({ date: d, doc: `OP ${o.order_number}`, hist: "Produção concluída — produto acabado", in: Number(o.produced_quantity) || 0, out: 0, cost: Number(o.output_unit_cost) || 0 });
    }
  });
  // Movimentações WMS (entrada/saída) — o espelho do ajuste de inventário é
  // ignorado (linha própria INV); transferência não altera o saldo
  const isInvMove = (m) => (m.notes || "").includes("Ajuste de inventário") || String(m.document || "").startsWith("Inventário");
  (data.moves || []).filter(m =>
    m.product_id === product.id &&
    m.move_type !== "transferencia" &&
    !isInvMove(m)
  ).forEach(m => {
    rows.push({
      date: m.move_date || m.created_date, doc: m.document || "WMS",
      hist: `${m.move_type === "entrada" ? "Entrada" : "Saída"} WMS${m.warehouse_name ? ` — ${m.warehouse_name}` : ""}${m.notes ? ` (${m.notes})` : ""}`,
      in: m.move_type === "entrada" ? Number(m.quantity) || 0 : 0,
      out: m.move_type === "saida" ? Number(m.quantity) || 0 : 0,
    });
  });
  // Ajustes de inventário (contagem: diferença entre contado e sistema) —
  // sobra entra ao custo informado na contagem (ou custo do produto)
  (data.inventories || []).filter(i => i.product_id === product.id && i.status === "ajustado").forEach(i => {
    const diff = (Number(i.counted_qty) || 0) - (Number(i.system_qty) || 0);
    if (!diff) return;
    const uc = (Number(i.unit_cost) || 0) > 0 ? Number(i.unit_cost) : (Number(product.cost_price) || 0);
    rows.push({ date: i.count_date || i.created_date, doc: `INV ${i.warehouse_name || ""}`.trim(), hist: `Ajuste de inventário — contado ${i.counted_qty} / sistema ${i.system_qty}`, in: diff > 0 ? diff : 0, out: diff < 0 ? -diff : 0, cost: uc });
  });
  rows.sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.doc).localeCompare(String(b.doc)));
  // Custo médio (média móvel): entradas ao custo conhecido da origem (sem
  // custo informado, mantêm o custo médio atual), saídas sempre ao custo médio
  let saldo = 0, valor = 0;
  return rows.map(r => {
    const avgBefore = saldo > 0 ? valor / saldo : 0;
    if (r.in > 0) {
      const uc = (Number(r.cost) || 0) > 0 ? Number(r.cost) : avgBefore;
      valor += r.in * uc;
      saldo += r.in;
      r.unit_cost = uc;
    } else if (r.out > 0) {
      const avg = avgBefore || (Number(r.cost) || 0);
      valor = Math.max(0, valor - r.out * avg);
      saldo -= r.out;
      r.unit_cost = avg;
    }
    r.saldo = saldo;
    r.avg_cost = saldo > 0 ? valor / saldo : (r.unit_cost || 0);
    return r;
  });
}

// Período: saldo anterior acumulado antes da data inicial + linhas do período
export function applyPeriod(rows, from, to) {
  if (!from && !to) return { prev: null, list: rows };
  const day = (d) => String(d || "").slice(0, 10);
  const before = rows.filter(r => from && day(r.date) < from);
  const list = rows.filter(r => (!from || day(r.date) >= from) && (!to || day(r.date) <= to));
  return { prev: from && before.length ? { saldo: before[before.length - 1].saldo } : null, list };
}

// Custo médio final do produto (fallback: custo cadastrado) — usado na
// valoração do saldo nos relatórios
export function kardexAverageCost(rows, product) {
  const avg = rows.length ? rows[rows.length - 1].avg_cost : 0;
  return (avg > 0 ? avg : (Number(product.cost_price) || 0));
}
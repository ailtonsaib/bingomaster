// Nota pré-cadastrada pelo Recebimento WMS (awaiting_completion): reconstrói o
// estado "parsed" do modal de Entrada de NF a partir do registro salvo — o
// usuário apenas informa a operação de entrada e os demais dados para concluir
// e alimentar os módulos (estoque, contábil e financeiro)
export const parsedFromDraft = (d) => ({
  nota: {
    model: d.nota_model === "NFSe" ? "NFSe" : (d.nota_model || "55"),
    number: d.nota_number || "",
    series: d.nota_series || "",
    issue_date: d.issue_date ? String(d.issue_date).slice(0, 10) : "",
    chave_acesso: d.chave_acesso || "",
    nature_operation: d.nature_operation || "",
    cfop: d.cfop || "",
  },
  supplier: { name: d.supplier_name || "", cpf_cnpj: d.supplier_cnpj || "", uf: d.supplier_uf || "" },
  totals: {
    total_products: Number(d.total_products) || 0,
    total_nota: Number(d.total_nota) || 0,
    despesas: Number(d.despesas_value) || 0,
    descontos: Number(d.descontos_value) || 0,
  },
  items: (d.items || []).map(it => ({
    product_id: it.product_id || "",
    product_code: it.product_code || "",
    product_name: it.product_name || "",
    barcode: it.barcode || "",
    ncm: it.ncm || "",
    cfop: it.cfop || "",
    unit: it.unit || "",
    quantity: Number(it.quantity) || 0,
    unit_price: Number(it.unit_price) || 0,
    total: Number(it.total) || (Number(it.quantity) || 0) * (Number(it.unit_price) || 0),
    cst_icms: it.cst_icms || "",
    base_icms: Number(it.base_icms) || 0,
    icms_rate: Number(it.icms_rate) || 0,
    icms_value: Number(it.icms_value) || 0,
    difal_value: Number(it.difal_value) || 0,
    cst_pis: it.cst_pis || "",
    cst_cofins: it.cst_cofins || "",
    base_pis_cofins: Number(it.base_pis_cofins) || 0,
    pis_value: Number(it.pis_value) || 0,
    cofins_value: Number(it.cofins_value) || 0,
    ipi_value: Number(it.ipi_value) || 0,
  })),
  duplicatas: [],
});
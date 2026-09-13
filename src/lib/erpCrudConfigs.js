// Configurações reutilizáveis para o ErpSimpleCrud (cadastros simples do ERP)
const REGIME_OPTS = [
  { value: "simples_nacional", label: "Simples Nacional" },
  { value: "lucro_real", label: "Lucro Real" },
  { value: "lucro_presumido", label: "Lucro Presumido" },
];
const OP_TYPE_OPTS = [
  { value: "entrada", label: "Entrada", color: "text-blue-700 bg-blue-100" },
  { value: "saida", label: "Saída", color: "text-emerald-700 bg-emerald-100" },
];
const USER_ROLE_OPTS = [
  { value: "admin", label: "Administrador", color: "text-red-700 bg-red-100" },
  { value: "operador", label: "Operador", color: "text-blue-700 bg-blue-100" },
  { value: "visualizador", label: "Visualizador", color: "text-gray-700 bg-gray-100" },
];
const PRIORITY_OPTS = [
  { value: "baixa", label: "Baixa", color: "text-gray-700 bg-gray-100" },
  { value: "media", label: "Média", color: "text-amber-700 bg-amber-100" },
  { value: "alta", label: "Alta", color: "text-red-700 bg-red-100" },
];
const REQ_STATUS = [
  { value: "aberta", label: "Aberta", color: "text-blue-700 bg-blue-100" },
  { value: "aprovada", label: "Aprovada", color: "text-amber-700 bg-amber-100" },
  { value: "reprovada", label: "Reprovada", color: "text-red-700 bg-red-100" },
  { value: "atendida", label: "Atendida", color: "text-emerald-700 bg-emerald-100" },
];
const QUOT_STATUS = [
  { value: "aberta", label: "Aberta", color: "text-blue-700 bg-blue-100" },
  { value: "fechada", label: "Fechada", color: "text-emerald-700 bg-emerald-100" },
  { value: "cancelada", label: "Cancelada", color: "text-red-700 bg-red-100" },
];
const PAY_STATUS = [
  { value: "aberto", label: "Aberto", color: "text-amber-700 bg-amber-100" },
  { value: "pago", label: "Pago", color: "text-emerald-700 bg-emerald-100" },
];
const REC_STATUS = [
  { value: "aberto", label: "Aberto", color: "text-amber-700 bg-amber-100" },
  { value: "recebido", label: "Recebido", color: "text-emerald-700 bg-emerald-100" },
];
const ACCT_TYPE_OPTS = [
  { value: "conta_corrente", label: "Conta Corrente", color: "text-blue-700 bg-blue-100" },
  { value: "poupanca", label: "Poupança", color: "text-emerald-700 bg-emerald-100" },
  { value: "caixa", label: "Caixa", color: "text-amber-700 bg-amber-100" },
];
const MOVE_TYPE = [
  { value: "entrada", label: "Entrada", color: "text-emerald-700 bg-emerald-100" },
  { value: "saida", label: "Saída", color: "text-red-700 bg-red-100" },
];
const ASSET_STATUS = [
  { value: "ativo", label: "Ativo", color: "text-emerald-700 bg-emerald-100" },
  { value: "baixado", label: "Baixado", color: "text-gray-700 bg-gray-100" },
];
const CUSTO_OPTS = [
  { value: "direto", label: "Direto", color: "text-blue-700 bg-blue-100" },
  { value: "indireto", label: "Indireto", color: "text-amber-700 bg-amber-100" },
];
const MONTH_OPTS = [
  { value: 0, label: "Ano todo" },
  { value: 1, label: "Janeiro" }, { value: 2, label: "Fevereiro" }, { value: 3, label: "Março" },
  { value: 4, label: "Abril" }, { value: 5, label: "Maio" }, { value: 6, label: "Junho" },
  { value: 7, label: "Julho" }, { value: 8, label: "Agosto" }, { value: 9, label: "Setembro" },
  { value: 10, label: "Outubro" }, { value: 11, label: "Novembro" }, { value: 12, label: "Dezembro" },
];
const MONTH_PAY_OPTS = MONTH_OPTS.filter(m => m.value !== 0);
const PAYROLL_STATUS = [
  { value: "pendente", label: "Pendente", color: "text-amber-700 bg-amber-100" },
  { value: "pago", label: "Pago", color: "text-emerald-700 bg-emerald-100" },
];
// Ordena contas contábeis pela estrutura do código (1.1.01.01.0001)
const compareChartCode = (a, b) => {
  const pa = String(a.code || "").split(".").map(Number);
  const pb = String(b.code || "").split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
};

export const ERP_CRUD_CONFIGS = {
  empresas: {
    entityName: "ErpCompany", title: "Cadastro de Empresas",
    fields: [
      { key: "razao_social", label: "Razão Social", required: true, full: true },
      { key: "nome_fantasia", label: "Nome Fantasia", full: true },
      { key: "cnpj", label: "CNPJ", mask: "cnpj", lookup: "cnpj" }, { key: "ie", label: "Inscrição Estadual" }, { key: "im", label: "Inscrição Municipal" },
      { key: "regime", label: "Regime Tributário", type: "select", options: REGIME_OPTS },
      { key: "nfe_series", label: "Série NF-e", type: "number" },
      { key: "nfe_number_next", label: "Próximo Número NF-e", type: "number" },
      { key: "nfe_environment", label: "Ambiente NF-e", type: "select", options: [
        { value: "2", label: "Homologação" }, { value: "1", label: "Produção" },
      ] },
      { key: "cnae", label: "CNAE", full: true },
      { key: "natureza_juridica", label: "Natureza Jurídica", full: true },
      { key: "phone", label: "Telefone", mask: "phone" },
      { key: "cep", label: "CEP", mask: "cep" }, { key: "uf", label: "UF" }, { key: "city", label: "Município" }, { key: "ibge_code", label: "Cód. IBGE" },
      { key: "address", label: "Logradouro", full: true }, { key: "number", label: "Número" }, { key: "district", label: "Bairro" },
      { key: "has_junta_registro", label: "Possui registro na Junta Comercial", type: "checkbox" },
      { key: "junta_registro_code", label: "Código na Junta Comercial (NIRE)", full: true, requiredIf: form => !!form.has_junta_registro },
      { key: "abertura", label: "Data de Abertura", inputType: "date" },
      { key: "diretor_nome", label: "Nome do Diretor", full: true },
      { key: "diretor_cpf", label: "CPF do Diretor", mask: "cnpj" }, { key: "diretor_telefone", label: "Telefone do Diretor", mask: "phone" }, { key: "diretor_email", label: "Email do Diretor" },
      { key: "contador_nome", label: "Nome do Contador", full: true },
      { key: "contador_cpf", label: "CPF do Contador", mask: "cnpj" }, { key: "contador_crc", label: "CRC do Contador" },
      { key: "contador_telefone", label: "Telefone do Contador", mask: "phone" }, { key: "contador_email", label: "Email do Contador" },
      { key: "is_main", label: "Empresa matriz", type: "checkbox" },
      { key: "is_active", label: "Ativa", type: "checkbox" },
      { key: "notes", label: "Observações", full: true },
    ],
    columns: [
      { key: "razao_social", label: "Razão Social" }, { key: "cnpj", label: "CNPJ" },
      { key: "city", label: "Município" }, { key: "uf", label: "UF" },
      { key: "regime", label: "Regime", type: "badge", options: REGIME_OPTS.map(o => ({ value: o.value, label: o.label, color: "text-gray-700 bg-gray-100" })) },
      { key: "is_active", label: "Ativa", type: "bool" },
    ],
    searchKeys: ["razao_social", "nome_fantasia", "cnpj", "city"],
  },
  filiais: {
    entityName: "ErpBranch", title: "Cadastro de Filiais (vinculadas a uma empresa)",
    fields: [
      { key: "company_id", label: "Empresa Matriz", type: "entity-select", entity: "ErpCompany", labelKey: "razao_social", required: true, cacheKey: "company_name", full: true },
      { key: "razao_social", label: "Razão Social da Filial", required: true, full: true },
      { key: "nome_fantasia", label: "Nome Fantasia", full: true },
      { key: "cnpj", label: "CNPJ", mask: "cnpj", lookup: "cnpj" }, { key: "ie", label: "Inscrição Estadual" }, { key: "im", label: "Inscrição Municipal" },
      { key: "cep", label: "CEP" }, { key: "uf", label: "UF" }, { key: "city", label: "Município" }, { key: "ibge_code", label: "Cód. IBGE" },
      { key: "address", label: "Logradouro", full: true }, { key: "number", label: "Número" }, { key: "district", label: "Bairro" },
      { key: "is_active", label: "Ativa", type: "checkbox" },
      { key: "notes", label: "Observações", full: true },
    ],
    columns: [
      { key: "company_name", label: "Empresa Matriz" }, { key: "razao_social", label: "Filial" },
      { key: "cnpj", label: "CNPJ" }, { key: "city", label: "Município" }, { key: "uf", label: "UF" },
      { key: "is_active", label: "Ativa", type: "bool" },
    ],
    searchKeys: ["razao_social", "nome_fantasia", "cnpj", "company_name", "city"],
  },
  departamentos: {
    entityName: "ErpDepartment", title: "Cadastro de Departamentos",
    fields: [
      { key: "code", label: "Código" }, { key: "name", label: "Nome", required: true, full: true },
      { key: "description", label: "Descrição", full: true },
      { key: "calcula_custo", label: "Calcula custo", type: "checkbox" },
      { key: "is_active", label: "Ativo", type: "checkbox" },
    ],
    columns: [{ key: "name", label: "Departamento" }, { key: "code", label: "Código" }, { key: "calcula_custo", label: "Calcula custo", type: "bool" }, { key: "is_active", label: "Ativo", type: "bool" }],
    searchKeys: ["name", "code"],
  },
  setores: {
    entityName: "ErpSector", title: "Cadastro de Setores (vinculados a um departamento)",
    fields: [
      { key: "department_id", label: "Departamento", type: "entity-select", entity: "ErpDepartment", required: true, cacheKey: "department_name" },
      { key: "code", label: "Código" }, { key: "name", label: "Nome do Setor", required: true, full: true },
      { key: "description", label: "Descrição", full: true },
      { key: "estrutura_custo", label: "Estrutura de custo", type: "select", options: CUSTO_OPTS },
      { key: "is_active", label: "Ativo", type: "checkbox" },
    ],
    columns: [{ key: "department_name", label: "Departamento" }, { key: "name", label: "Setor" }, { key: "code", label: "Código" }, { key: "estrutura_custo", label: "Custo", type: "badge", options: CUSTO_OPTS }, { key: "is_active", label: "Ativo", type: "bool" }],
    searchKeys: ["name", "code", "department_name"],
  },
  grupos: {
    entityName: "ErpStockGroup", title: "Cadastro de Grupos de Estoque",
    fields: [
      { key: "code", label: "Código" }, { key: "name", label: "Nome do Grupo", required: true, full: true },
      { key: "description", label: "Descrição", full: true }, { key: "is_active", label: "Ativo", type: "checkbox" },
    ],
    columns: [{ key: "name", label: "Grupo" }, { key: "code", label: "Código" }, { key: "is_active", label: "Ativo", type: "bool" }],
    searchKeys: ["name", "code"],
  },
  subgrupos: {
    entityName: "ErpStockSubgroup", title: "Cadastro de Sub-grupos de Estoque (vinculados a um grupo)",
    fields: [
      { key: "group_id", label: "Grupo de Estoque", type: "entity-select", entity: "ErpStockGroup", required: true, cacheKey: "group_name" },
      { key: "code", label: "Código" }, { key: "name", label: "Nome do Sub-grupo", required: true, full: true },
      { key: "description", label: "Descrição", full: true }, { key: "is_active", label: "Ativo", type: "checkbox" },
    ],
    columns: [{ key: "group_name", label: "Grupo" }, { key: "name", label: "Sub-grupo" }, { key: "code", label: "Código" }, { key: "is_active", label: "Ativo", type: "bool" }],
    searchKeys: ["name", "code", "group_name"],
  },
  operacoes: {
    entityName: "ErpOperation", title: "Cadastro de Operações de Entrada e Saída",
    fields: [
      { key: "type", label: "Tipo", type: "select", options: OP_TYPE_OPTS, required: true },
      { key: "kind", label: "Natureza base", type: "select", options: [
        { value: "comercializacao", label: "Compra/Venda de mercadoria" },
        { value: "industrializacao", label: "Compra/Venda de produção" },
        { value: "devolucao_venda", label: "Devolução de venda" },
        { value: "devolucao_compra", label: "Devolução de compra" },
        { value: "transferencia", label: "Transferência" },
        { value: "outra", label: "Outra" },
      ], required: true },
      { key: "code", label: "Código" }, { key: "name", label: "Nome da Operação", required: true, full: true },
      { key: "nature_operation", label: "Natureza da Operação", full: true },
      { key: "description", label: "Descrição", full: true },
      { key: "is_patrimonio", label: "Gera bem patrimonial (imobilizado)", type: "checkbox" },
      { key: "is_active", label: "Ativa", type: "checkbox" },
    ],
    columns: [
      { key: "type", label: "Tipo", type: "badge", options: OP_TYPE_OPTS },
      { key: "name", label: "Operação" }, { key: "kind", label: "Natureza base" }, { key: "nature_operation", label: "Natureza" },
      { key: "is_patrimonio", label: "Patrimônio", type: "bool" }, { key: "is_active", label: "Ativa", type: "bool" },
    ],
    searchKeys: ["name", "kind", "code"],
  },
  usuarios: {
    entityName: "ErpUser", scopeField: "owner_email", title: "Cadastro de Usuários do ERP",
    fields: [
      { key: "name", label: "Nome", required: true, full: true }, { key: "email", label: "Email", required: true },
      { key: "password_hash", label: "Senha", inputType: "password" }, { key: "role", label: "Papel", type: "select", options: USER_ROLE_OPTS },
      { key: "department_id", label: "Departamento", type: "entity-select", entity: "ErpDepartment", cacheKey: "department_name" },
      { key: "phone", label: "Telefone" }, { key: "is_active", label: "Ativo", type: "checkbox" },
    ],
    columns: [
      { key: "name", label: "Nome" }, { key: "email", label: "Email" },
      { key: "role", label: "Papel", type: "badge", options: USER_ROLE_OPTS },
      { key: "department_name", label: "Departamento" }, { key: "is_active", label: "Ativo", type: "bool" },
    ],
    searchKeys: ["name", "email", "department_name"],
  },
  redes: {
    entityName: "ErpNetwork", title: "Cadastro de Redes",
    fields: [
      { key: "name", label: "Nome da Rede", required: true, full: true },
      { key: "code", label: "Código" }, { key: "description", label: "Descrição", full: true }, { key: "is_active", label: "Ativa", type: "checkbox" },
    ],
    columns: [{ key: "name", label: "Rede" }, { key: "code", label: "Código" }, { key: "description", label: "Descrição" }, { key: "is_active", label: "Ativa", type: "bool" }],
    searchKeys: ["name", "code", "description"],
  },
  canais: {
    entityName: "ErpChannel", title: "Cadastro de Canais de Vendas",
    fields: [
      { key: "name", label: "Nome do Canal", required: true, full: true },
      { key: "description", label: "Descrição", full: true }, { key: "is_active", label: "Ativo", type: "checkbox" },
    ],
    columns: [{ key: "name", label: "Canal" }, { key: "description", label: "Descrição" }, { key: "is_active", label: "Ativo", type: "bool" }],
    searchKeys: ["name", "description"],
  },
  ramos: {
    entityName: "ErpActivitySector", title: "Cadastro de Ramos de Atividade",
    fields: [
      { key: "name", label: "Nome do Ramo", required: true, full: true },
      { key: "code", label: "Código" }, { key: "description", label: "Descrição", full: true }, { key: "is_active", label: "Ativo", type: "checkbox" },
    ],
    columns: [{ key: "name", label: "Ramo" }, { key: "code", label: "Código" }, { key: "description", label: "Descrição" }, { key: "is_active", label: "Ativo", type: "bool" }],
    searchKeys: ["name", "code", "description"],
  },
  clientes: {
    entityName: "ErpCustomer", title: "Cadastro de Clientes",
    fields: [
      { key: "name", label: "Nome / Razão Social", required: true, full: true },
      { key: "cpf_cnpj", label: "CPF/CNPJ" }, { key: "email", label: "Email" }, { key: "phone", label: "Telefone" },
      { key: "address", label: "Endereço", full: true }, { key: "district", label: "Bairro" }, { key: "city", label: "Município" }, { key: "uf", label: "UF" }, { key: "zip", label: "CEP" }, { key: "ibge_code", label: "Cód. IBGE" },
      { key: "vendedor_id", label: "Vendedor", type: "entity-select", entity: "ErpSalesTeam", cacheKey: "vendedor_name", optionsFilter: t => t.team_role === "vendedor" },
      { key: "channel_id", label: "Canal", type: "entity-select", entity: "ErpChannel", cacheKey: "channel_name" },
      { key: "activity_sector_id", label: "Ramo de Atividade", type: "entity-select", entity: "ErpActivitySector", cacheKey: "activity_sector_name" },
      { key: "network_id", label: "Rede", type: "entity-select", entity: "ErpNetwork", cacheKey: "network_name" },
      { key: "is_active", label: "Ativo", type: "checkbox" },
    ],
    columns: [{ key: "name", label: "Cliente" }, { key: "cpf_cnpj", label: "CPF/CNPJ" }, { key: "city", label: "Município" }, { key: "uf", label: "UF" }, { key: "vendedor_name", label: "Vendedor" }, { key: "channel_name", label: "Canal" }, { key: "is_active", label: "Ativo", type: "bool" }],
    searchKeys: ["name", "cpf_cnpj", "city", "vendedor_name", "channel_name"],
  },
  requisicoes: {
    entityName: "ErpRequisition", title: "Solicitações de Compra",
    fields: [
      { key: "number", label: "Número", required: true }, { key: "request_date", label: "Data", inputType: "date" },
      { key: "department_id", label: "Departamento", type: "entity-select", entity: "ErpDepartment", cacheKey: "department_name" },
      { key: "requested_by", label: "Solicitante" },
      { key: "priority", label: "Prioridade", type: "select", options: PRIORITY_OPTS },
      { key: "description", label: "Itens / Descrição", required: true, full: true },
      { key: "status", label: "Status", type: "select", options: REQ_STATUS },
      { key: "notes", label: "Observações", full: true },
    ],
    columns: [
      { key: "number", label: "Número" }, { key: "request_date", label: "Data" }, { key: "department_name", label: "Departamento" },
      { key: "requested_by", label: "Solicitante" }, { key: "priority", label: "Prioridade", type: "badge", options: PRIORITY_OPTS },
      { key: "status", label: "Status", type: "badge", options: REQ_STATUS },
    ],
    searchKeys: ["number", "description", "department_name", "requested_by"],
  },
  cotacoes: {
    entityName: "ErpQuotation", title: "Tomada de Preço / Cotações",
    fields: [
      { key: "number", label: "Número", required: true }, { key: "quotation_date", label: "Data", inputType: "date" },
      { key: "supplier_id", label: "Fornecedor", type: "entity-select", entity: "ErpSupplier", cacheKey: "supplier_name" },
      { key: "description", label: "Objeto Cotado", required: true, full: true },
      { key: "quantity", label: "Qtd", type: "number" }, { key: "unit", label: "Unidade" },
      { key: "quoted_value", label: "Valor Cotado", type: "number" },
      { key: "is_winner", label: "Cotação vencedora", type: "checkbox" },
      { key: "status", label: "Status", type: "select", options: QUOT_STATUS },
      { key: "notes", label: "Observações", full: true },
    ],
    columns: [
      { key: "number", label: "Número" }, { key: "quotation_date", label: "Data" }, { key: "supplier_name", label: "Fornecedor" },
      { key: "quoted_value", label: "Valor", type: "money" }, { key: "is_winner", label: "Vencedora", type: "bool" },
      { key: "status", label: "Status", type: "badge", options: QUOT_STATUS },
    ],
    searchKeys: ["number", "description", "supplier_name"],
  },
  contasPagar: {
    entityName: "ErpPayable", title: "Contas a Pagar",
    fields: [
      { key: "description", label: "Descrição", required: true, full: true }, { key: "beneficiary", label: "Fornecedor/Beneficiário" },
      { key: "category", label: "Categoria" }, { key: "due_date", label: "Vencimento", inputType: "date" },
      { key: "amount", label: "Valor", type: "number", required: true }, { key: "payment_date", label: "Data Pagamento", inputType: "date" },
      { key: "payment_method", label: "Forma de Pagamento" },
      { key: "status", label: "Status", type: "select", options: PAY_STATUS },
      { key: "notes", label: "Observações", full: true },
    ],
    columns: [
      { key: "description", label: "Descrição" }, { key: "beneficiary", label: "Beneficiário" }, { key: "due_date", label: "Vencimento" },
      { key: "amount", label: "Valor", type: "money" }, { key: "status", label: "Status", type: "badge", options: PAY_STATUS },
      { key: "bank_account_name", label: "Conta Bancária" },
    ],
    searchKeys: ["description", "beneficiary", "category", "bank_account_name"],
    settle: { openStatus: "aberto", doneStatus: "pago", dateField: "payment_date", actionLabel: "Baixar Selecionados" },
  },
  contasReceber: {
    entityName: "ErpReceivable", title: "Contas a Receber",
    fields: [
      { key: "description", label: "Descrição", required: true, full: true }, { key: "customer_name", label: "Cliente" },
      { key: "category", label: "Categoria" }, { key: "due_date", label: "Vencimento", inputType: "date" },
      { key: "amount", label: "Valor", type: "number", required: true }, { key: "receipt_date", label: "Data Recebimento", inputType: "date" },
      { key: "payment_method", label: "Forma de Pagamento" },
      { key: "status", label: "Status", type: "select", options: REC_STATUS },
      { key: "notes", label: "Observações", full: true },
    ],
    columns: [
      { key: "description", label: "Descrição" }, { key: "customer_name", label: "Cliente" }, { key: "due_date", label: "Vencimento" },
      { key: "amount", label: "Valor", type: "money" }, { key: "status", label: "Status", type: "badge", options: REC_STATUS },
      { key: "bank_account_name", label: "Conta Bancária" },
    ],
    searchKeys: ["description", "customer_name", "category", "bank_account_name"],
    settle: { openStatus: "aberto", doneStatus: "recebido", dateField: "receipt_date", actionLabel: "Receber Selecionados" },
  },
  contasBancarias: {
    entityName: "ErpBankAccount", title: "Contas Bancárias",
    fields: [
      { key: "bank", label: "Banco", required: true }, { key: "agency", label: "Agência" }, { key: "account", label: "Conta" },
      { key: "account_type", label: "Tipo", type: "select", options: ACCT_TYPE_OPTS }, { key: "holder", label: "Titular" },
      { key: "chart_account_id", label: "Conta Contábil", type: "entity-select", entity: "ErpChartAccount", labelKey: "name", cacheKey: "chart_account_name", prefixKey: "code", prefixCacheKey: "chart_account_code", full: true, optionsFilter: a => a.accepts_entries !== false, sortOptions: compareChartCode, hierarchical: true },
      { key: "balance", label: "Saldo", type: "number" }, { key: "is_active", label: "Ativa", type: "checkbox" },
    ],
    columns: [
      { key: "bank", label: "Banco" }, { key: "agency", label: "Agência" }, { key: "account", label: "Conta" },
      { key: "account_type", label: "Tipo", type: "badge", options: ACCT_TYPE_OPTS },
      { key: "holder", label: "Titular" },
      { key: "chart_account_code", label: "Conta Contábil", render: it => it.chart_account_code ? `${it.chart_account_code} — ${it.chart_account_name || ""}` : "—" },
      { key: "balance", label: "Saldo", type: "money" }, { key: "is_active", label: "Ativa", type: "bool" },
    ],
    searchKeys: ["bank", "holder", "account", "chart_account_name"],
  },
  caixaBanco: {
    entityName: "ErpCashMove", title: "Caixa e Banco — Movimentações",
    fields: [
      { key: "date", label: "Data", inputType: "date" }, { key: "type", label: "Tipo", type: "select", options: MOVE_TYPE, required: true },
      { key: "bank_account_id", label: "Conta Bancária", type: "entity-select", entity: "ErpBankAccount", labelKey: "bank", cacheKey: "bank_name", required: true },
      { key: "category", label: "Categoria" }, { key: "description", label: "Descrição", required: true, full: true },
      { key: "amount", label: "Valor", type: "number", required: true },
      { key: "event_id", label: "Evento Contábil (opcional — entrada: banco D x evento C, saída: banco C x evento D)", type: "entity-select", entity: "ErpAccountingEvent", labelKey: "name", cacheKey: "event_name", full: true },
      { key: "notes", label: "Observações", full: true },
    ],
    columns: [
      { key: "date", label: "Data" }, { key: "type", label: "Tipo", type: "badge", options: MOVE_TYPE },
      { key: "bank_name", label: "Conta" }, { key: "category", label: "Categoria" }, { key: "description", label: "Descrição" },
      { key: "event_name", label: "Evento Contábil" },
      { key: "amount", label: "Valor", type: "money" },
    ],
    searchKeys: ["description", "category", "bank_name", "event_name"],
    cashJournal: true,
  },
  contabilidade: {
    entityName: "ErpAccountingEntry", title: "Contabilidade — Lançamentos",
    fields: [
      { key: "date", label: "Data", inputType: "date" }, { key: "account_debit", label: "Conta Débito" }, { key: "account_credit", label: "Conta Crédito" },
      { key: "description", label: "Histórico", required: true, full: true }, { key: "value", label: "Valor", type: "number", required: true },
      { key: "document", label: "Documento" }, { key: "notes", label: "Observações", full: true },
    ],
    columns: [
      { key: "date", label: "Data" }, { key: "account_debit", label: "Débito" }, { key: "account_credit", label: "Crédito" },
      { key: "description", label: "Histórico" }, { key: "value", label: "Valor", type: "money" }, { key: "document", label: "Documento" },
    ],
    searchKeys: ["description", "account_debit", "account_credit", "document"],
  },
  custos: {
    entityName: "ErpCostCenter", title: "Centros de Custo",
    fields: [
      { key: "code", label: "Código" }, { key: "name", label: "Nome", required: true, full: true },
      { key: "description", label: "Descrição", full: true }, { key: "responsible", label: "Responsável" },
      { key: "is_active", label: "Ativo", type: "checkbox" },
    ],
    columns: [{ key: "name", label: "Centro de Custo" }, { key: "code", label: "Código" }, { key: "responsible", label: "Responsável" }, { key: "is_active", label: "Ativo", type: "bool" }],
    searchKeys: ["name", "code", "responsible"],
  },
  patrimonial: {
    entityName: "ErpFixedAsset", title: "Patrimônio — Bens",
    fields: [
      { key: "code", label: "Código" }, { key: "name", label: "Bem", required: true, full: true },
      { key: "acquisition_date", label: "Aquisição", inputType: "date" }, { key: "acquisition_value", label: "Valor Aquisição", type: "number" },
      { key: "depreciation_rate", label: "Depreciação (% a.a.)", type: "number" }, { key: "current_value", label: "Valor Atual", type: "number" },
      { key: "location", label: "Localização" }, { key: "status", label: "Status", type: "select", options: ASSET_STATUS },
      { key: "notes", label: "Observações", full: true },
    ],
    columns: [
      { key: "name", label: "Bem" }, { key: "code", label: "Código" }, { key: "acquisition_date", label: "Aquisição" },
      { key: "acquisition_value", label: "Aquisição", type: "money" }, { key: "current_value", label: "Atual", type: "money" },
      { key: "status", label: "Status", type: "badge", options: ASSET_STATUS },
    ],
    searchKeys: ["name", "code", "location"],
  },
  orcamento: {
    entityName: "ErpBudget", title: "Orçamento",
    fields: [
      { key: "name", label: "Nome do Orçamento", required: true, full: true },
      { key: "year", label: "Ano", type: "number", required: true },
      { key: "month", label: "Mês", type: "select", options: MONTH_OPTS },
      { key: "category", label: "Categoria / Conta", full: true },
      { key: "planned_value", label: "Valor Planejado", type: "number" },
      { key: "is_active", label: "Ativo", type: "checkbox" },
      { key: "notes", label: "Observações", full: true },
    ],
    columns: [
      { key: "name", label: "Orçamento" }, { key: "year", label: "Ano" },
      { key: "month", label: "Mês", type: "badge", options: MONTH_OPTS.map(o => ({ value: o.value, label: o.label, color: "text-gray-700 bg-gray-100" })) },
      { key: "category", label: "Categoria" }, { key: "planned_value", label: "Planejado", type: "money" },
      { key: "is_active", label: "Ativo", type: "bool" },
    ],
    searchKeys: ["name", "category", "year"],
  },
  folhaPagamento: {
    entityName: "ErpPayroll", title: "Folha de Pagamento",
    fields: [
      { key: "employee_name", label: "Funcionário", required: true, full: true },
      { key: "month", label: "Mês", type: "select", options: MONTH_PAY_OPTS, required: true },
      { key: "year", label: "Ano", type: "number", required: true },
      { key: "gross_salary", label: "Salário Bruto", type: "number" },
      { key: "discounts", label: "Descontos", type: "number" },
      { key: "net_salary", label: "Salário Líquido", type: "number" },
      { key: "status", label: "Status", type: "select", options: PAYROLL_STATUS },
      { key: "payment_date", label: "Data Pagamento", inputType: "date" },
      { key: "notes", label: "Observações", full: true },
    ],
    columns: [
      { key: "employee_name", label: "Funcionário" },
      { key: "month", label: "Mês", type: "badge", options: MONTH_PAY_OPTS.map(o => ({ value: o.value, label: o.label, color: "text-gray-700 bg-gray-100" })) },
      { key: "year", label: "Ano" },
      { key: "gross_salary", label: "Bruto", type: "money" },
      { key: "net_salary", label: "Líquido", type: "money" },
      { key: "status", label: "Status", type: "badge", options: PAYROLL_STATUS },
    ],
    searchKeys: ["employee_name"],
  },
  historicos: {
    entityName: "ErpStandardHistory", title: "Cadastro de Históricos Padrão",
    fields: [
      { key: "code", label: "Código", required: true },
      { key: "description", label: "Descrição", required: true, full: true },
      { key: "is_active", label: "Ativo", type: "checkbox" },
    ],
    columns: [{ key: "code", label: "Código" }, { key: "description", label: "Descrição" }, { key: "is_active", label: "Ativo", type: "bool" }],
    searchKeys: ["code", "description"],
  },
};
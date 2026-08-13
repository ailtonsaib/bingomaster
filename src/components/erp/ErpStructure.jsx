import { useState } from "react";
import { Building2, Network, GitBranch, Boxes, Layers, ArrowRightLeft, Receipt, Users } from "lucide-react";
import ErpSimpleCrud from "./ErpSimpleCrud";
import ErpTaxRuleManager from "./ErpTaxRuleManager";

const REGIME_OPTS = [
  { value: "simples_nacional", label: "Simples Nacional" },
  { value: "lucro_real", label: "Lucro Real" },
  { value: "lucro_presumido", label: "Lucro Presumido" },
];
const OP_TYPE_OPTS = [
  { value: "entrada", label: "Entrada" },
  { value: "saida", label: "Saída" },
];
const USER_ROLE_OPTS = [
  { value: "admin", label: "Administrador" },
  { value: "operador", label: "Operador" },
  { value: "visualizador", label: "Visualizador" },
];

const SUBTABS = [
  { id: "empresas", label: "Empresas", icon: Building2 },
  { id: "departamentos", label: "Departamentos", icon: Network },
  { id: "setores", label: "Setores", icon: GitBranch },
  { id: "grupos", label: "Grupos de Estoque", icon: Boxes },
  { id: "subgrupos", label: "Sub-grupos de Estoque", icon: Layers },
  { id: "operacoes", label: "Operações (Entrada/Saída)", icon: ArrowRightLeft },
  { id: "regras", label: "Regras Fiscais", icon: Receipt },
  { id: "usuarios", label: "Usuários", icon: Users },
];

export default function ErpStructure({ user }) {
  const [sub, setSub] = useState("empresas");

  const configs = {
    empresas: {
      entityName: "ErpCompany",
      title: "Cadastro de Empresas",
      fields: [
        { key: "razao_social", label: "Razão Social", required: true, full: true },
        { key: "nome_fantasia", label: "Nome Fantasia", full: true },
        { key: "cnpj", label: "CNPJ" },
        { key: "ie", label: "Inscrição Estadual" },
        { key: "im", label: "Inscrição Municipal" },
        { key: "regime", label: "Regime Tributário", type: "select", options: REGIME_OPTS },
        { key: "cep", label: "CEP" },
        { key: "uf", label: "UF" },
        { key: "city", label: "Município" },
        { key: "ibge_code", label: "Cód. IBGE" },
        { key: "address", label: "Logradouro", full: true },
        { key: "number", label: "Número" },
        { key: "district", label: "Bairro" },
        { key: "is_main", label: "Empresa matriz", type: "checkbox" },
        { key: "is_active", label: "Ativa", type: "checkbox" },
        { key: "notes", label: "Observações", full: true },
      ],
      columns: [
        { key: "razao_social", label: "Razão Social" },
        { key: "cnpj", label: "CNPJ" },
        { key: "city", label: "Município" },
        { key: "uf", label: "UF" },
        { key: "regime", label: "Regime", type: "badge", options: REGIME_OPTS.map(o => ({ value: o.value, label: o.label, color: "text-gray-700 bg-gray-100" })) },
        { key: "is_active", label: "Ativa", type: "bool" },
      ],
      searchKeys: ["razao_social", "nome_fantasia", "cnpj", "city"],
    },
    departamentos: {
      entityName: "ErpDepartment",
      title: "Cadastro de Departamentos",
      fields: [
        { key: "code", label: "Código" },
        { key: "name", label: "Nome", required: true, full: true },
        { key: "description", label: "Descrição", full: true },
        { key: "is_active", label: "Ativo", type: "checkbox" },
      ],
      columns: [
        { key: "name", label: "Departamento" },
        { key: "code", label: "Código" },
        { key: "is_active", label: "Ativo", type: "bool" },
      ],
      searchKeys: ["name", "code"],
    },
    setores: {
      entityName: "ErpSector",
      title: "Cadastro de Setores (vinculados a um departamento)",
      fields: [
        { key: "department_id", label: "Departamento", type: "entity-select", entity: "ErpDepartment", required: true, cacheKey: "department_name" },
        { key: "code", label: "Código" },
        { key: "name", label: "Nome do Setor", required: true, full: true },
        { key: "description", label: "Descrição", full: true },
        { key: "is_active", label: "Ativo", type: "checkbox" },
      ],
      columns: [
        { key: "department_name", label: "Departamento" },
        { key: "name", label: "Setor" },
        { key: "code", label: "Código" },
        { key: "is_active", label: "Ativo", type: "bool" },
      ],
      searchKeys: ["name", "code", "department_name"],
    },
    grupos: {
      entityName: "ErpStockGroup",
      title: "Cadastro de Grupos de Estoque",
      fields: [
        { key: "code", label: "Código" },
        { key: "name", label: "Nome do Grupo", required: true, full: true },
        { key: "description", label: "Descrição", full: true },
        { key: "is_active", label: "Ativo", type: "checkbox" },
      ],
      columns: [
        { key: "name", label: "Grupo" },
        { key: "code", label: "Código" },
        { key: "is_active", label: "Ativo", type: "bool" },
      ],
      searchKeys: ["name", "code"],
    },
    subgrupos: {
      entityName: "ErpStockSubgroup",
      title: "Cadastro de Sub-grupos de Estoque (vinculados a um grupo)",
      fields: [
        { key: "group_id", label: "Grupo de Estoque", type: "entity-select", entity: "ErpStockGroup", required: true, cacheKey: "group_name" },
        { key: "code", label: "Código" },
        { key: "name", label: "Nome do Sub-grupo", required: true, full: true },
        { key: "description", label: "Descrição", full: true },
        { key: "is_active", label: "Ativo", type: "checkbox" },
      ],
      columns: [
        { key: "group_name", label: "Grupo" },
        { key: "name", label: "Sub-grupo" },
        { key: "code", label: "Código" },
        { key: "is_active", label: "Ativo", type: "bool" },
      ],
      searchKeys: ["name", "code", "group_name"],
    },
    operacoes: {
      entityName: "ErpOperation",
      title: "Cadastro de Operações de Entrada e Saída",
      fields: [
        { key: "type", label: "Tipo", type: "select", options: OP_TYPE_OPTS, required: true },
        { key: "code", label: "Código" },
        { key: "name", label: "Nome da Operação", required: true, full: true },
        { key: "cfop", label: "CFOP", required: true },
        { key: "nature_operation", label: "Natureza da Operação", full: true },
        { key: "description", label: "Descrição", full: true },
        { key: "is_active", label: "Ativa", type: "checkbox" },
      ],
      columns: [
        { key: "type", label: "Tipo", type: "badge", options: [{ value: "entrada", label: "Entrada", color: "text-blue-700 bg-blue-100" }, { value: "saida", label: "Saída", color: "text-emerald-700 bg-emerald-100" }] },
        { key: "name", label: "Operação" },
        { key: "cfop", label: "CFOP" },
        { key: "nature_operation", label: "Natureza" },
        { key: "is_active", label: "Ativa", type: "bool" },
      ],
      searchKeys: ["name", "cfop", "code"],
    },
    usuarios: {
      entityName: "ErpUser",
      scopeField: "owner_email",
      title: "Cadastro de Usuários do ERP",
      fields: [
        { key: "name", label: "Nome", required: true, full: true },
        { key: "email", label: "Email", required: true },
        { key: "password_hash", label: "Senha", inputType: "password" },
        { key: "role", label: "Papel", type: "select", options: USER_ROLE_OPTS },
        { key: "department_id", label: "Departamento", type: "entity-select", entity: "ErpDepartment", cacheKey: "department_name" },
        { key: "phone", label: "Telefone" },
        { key: "is_active", label: "Ativo", type: "checkbox" },
      ],
      columns: [
        { key: "name", label: "Nome" },
        { key: "email", label: "Email" },
        { key: "role", label: "Papel", type: "badge", options: USER_ROLE_OPTS.map((o, i) => ({ value: o.value, label: o.label, color: ["text-red-700 bg-red-100", "text-blue-700 bg-blue-100", "text-gray-700 bg-gray-100"][i] })) },
        { key: "department_name", label: "Departamento" },
        { key: "is_active", label: "Ativo", type: "bool" },
      ],
      searchKeys: ["name", "email", "department_name"],
    },
  };

  const cfg = configs[sub];

  return (
    <div className="space-y-3">
      <div className="flex gap-1 flex-wrap bg-white rounded-xl border p-1">
        {SUBTABS.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setSub(t.id)} className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${sub === t.id ? "bg-emerald-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}>
              <Icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          );
        })}
      </div>

      {sub === "regras" ? (
        <ErpTaxRuleManager user={user} />
      ) : (
        <ErpSimpleCrud key={sub} user={user} entityName={cfg.entityName} scopeField={cfg.scopeField} title={cfg.title} fields={cfg.fields} columns={cfg.columns} searchKeys={cfg.searchKeys} />
      )}
    </div>
  );
}
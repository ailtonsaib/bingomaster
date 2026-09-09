import { useState } from "react";
import {
  Wrench, ClipboardCheck, HardHat, Warehouse, MapPin, ArrowLeftRight, ClipboardList,
} from "lucide-react";
import ErpSimpleCrud from "@/components/erp/ErpSimpleCrud";
import ErpMaintenanceOrderPanel from "@/components/erp/ErpMaintenanceOrderPanel";
import ErpWmsMovePanel from "@/components/erp/ErpWmsMovePanel";
import ErpWmsInventoryPanel from "@/components/erp/ErpWmsInventoryPanel";
import { SubNav } from "./ErpModuleSuprimentos";

const EQUIP_STATUS = [
  { value: "ativo", label: "Ativo", color: "bg-emerald-100 text-emerald-700" },
  { value: "em_manutencao", label: "Em Manutenção", color: "bg-amber-100 text-amber-700" },
  { value: "inativo", label: "Inativo", color: "bg-gray-100 text-gray-600" },
];

const CRUD_CONFIGS = {
  equipamentos: {
    entityName: "ErpEquipment",
    title: "Cadastro de Equipamentos",
    fields: [
      { key: "code", label: "Código", required: true },
      { key: "name", label: "Nome do Equipamento", required: true },
      { key: "category", label: "Grupo/Categoria" },
      { key: "location", label: "Localização" },
      { key: "responsible", label: "Responsável" },
      { key: "status", label: "Situação", type: "select", options: EQUIP_STATUS, required: true },
      { key: "acquisition_date", label: "Data de Aquisição", inputType: "date" },
      { key: "acquisition_value", label: "Valor de Aquisição (R$)", type: "number" },
      { key: "notes", label: "Observações Técnicas", full: true },
    ],
    columns: [
      { key: "code", label: "Código" },
      { key: "name", label: "Equipamento" },
      { key: "category", label: "Categoria" },
      { key: "location", label: "Localização" },
      { key: "status", label: "Situação", type: "badge", options: EQUIP_STATUS },
    ],
    searchKeys: ["code", "name", "category", "location"],
  },
  planos: {
    entityName: "ErpMaintenancePlan",
    title: "Planos de Manutenção Preventiva",
    fields: [
      { key: "equipment_id", label: "Equipamento", type: "entity-select", entity: "ErpEquipment", cacheKey: "equipment_name", required: true },
      { key: "description", label: "Descrição do Plano", required: true, full: true },
      { key: "frequency_days", label: "Periodicidade (dias)", type: "number", required: true },
      { key: "last_execution", label: "Última Execução", inputType: "date" },
      { key: "next_execution", label: "Próxima Execução", inputType: "date" },
      { key: "responsible", label: "Responsável" },
      { key: "checklist", label: "Checklist de Inspeção", full: true },
      { key: "is_active", label: "Ativo", type: "checkbox" },
    ],
    columns: [
      { key: "equipment_name", label: "Equipamento" },
      { key: "description", label: "Plano" },
      { key: "frequency_days", label: "Periodicidade (dias)" },
      { key: "next_execution", label: "Próxima Execução" },
      { key: "is_active", label: "Ativo", type: "bool" },
    ],
    searchKeys: ["equipment_name", "description"],
  },
  armazens: {
    entityName: "ErpWarehouse",
    title: "Cadastro de Armazéns",
    fields: [
      { key: "code", label: "Código", required: true },
      { key: "name", label: "Nome do Armazém", required: true },
      { key: "address", label: "Logradouro" },
      { key: "district", label: "Bairro" },
      { key: "city", label: "Município" },
      { key: "uf", label: "UF" },
      { key: "notes", label: "Observações", full: true },
      { key: "is_active", label: "Ativo", type: "checkbox" },
    ],
    columns: [
      { key: "code", label: "Código" },
      { key: "name", label: "Armazém" },
      { key: "city", label: "Município" },
      { key: "uf", label: "UF" },
      { key: "is_active", label: "Ativo", type: "bool" },
    ],
    searchKeys: ["code", "name", "city"],
  },
  enderecos: {
    entityName: "ErpWmsLocation",
    title: "Endereçamento do Armazém (Zonas / Corredores / Prateleiras)",
    fields: [
      { key: "warehouse_id", label: "Armazém", type: "entity-select", entity: "ErpWarehouse", cacheKey: "warehouse_name", required: true },
      { key: "code", label: "Código do Endereço (ex: A-01-02-03)", required: true },
      { key: "zone", label: "Zona (picking, paletização...)" },
      { key: "aisle", label: "Corredor" },
      { key: "shelf", label: "Prateleira" },
      { key: "level", label: "Nível" },
      { key: "capacity", label: "Capacidade", type: "number" },
      { key: "notes", label: "Observações", full: true },
      { key: "is_active", label: "Ativo", type: "checkbox" },
    ],
    columns: [
      { key: "warehouse_name", label: "Armazém" },
      { key: "code", label: "Endereço" },
      { key: "zone", label: "Zona" },
      { key: "aisle", label: "Corredor" },
      { key: "shelf", label: "Prateleira" },
      { key: "level", label: "Nível" },
      { key: "is_active", label: "Ativo", type: "bool" },
    ],
    searchKeys: ["warehouse_name", "code", "zone"],
  },
};

const GROUPS = [
  {
    id: "manutencao", label: "Manutenção Industrial", icon: Wrench, color: "purple",
    items: [
      { id: "equipamentos", label: "Equipamentos", icon: Wrench },
      { id: "planos", label: "Planos Preventivos", icon: ClipboardCheck },
      { id: "os", label: "Ordens de Serviço", icon: HardHat },
    ],
  },
  {
    id: "wms", label: "WMS — Armazenagem", icon: Warehouse, color: "indigo",
    items: [
      { id: "armazens", label: "Armazéns", icon: Warehouse },
      { id: "enderecos", label: "Endereçamento", icon: MapPin },
      { id: "movimentos", label: "Movimentações", icon: ArrowLeftRight },
      { id: "inventario", label: "Inventário", icon: ClipboardList },
    ],
  },
];

export default function ErpModuleIndustrial({ user }) {
  const [group, setGroup] = useState("manutencao");
  const [sub, setSub] = useState("equipamentos");
  const active = GROUPS.find(g => g.id === group) || GROUPS[0];

  const selectGroup = (id) => {
    setGroup(id);
    setSub(GROUPS.find(g => g.id === id).items[0].id);
  };

  const renderSub = () => {
    switch (sub) {
      case "os": return <ErpMaintenanceOrderPanel user={user} />;
      case "movimentos": return <ErpWmsMovePanel user={user} />;
      case "inventario": return <ErpWmsInventoryPanel user={user} />;
      default: return <ErpSimpleCrud key={sub} user={user} {...CRUD_CONFIGS[sub]} />;
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        {GROUPS.map(g => (
          <button key={g.id} onClick={() => selectGroup(g.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${group === g.id ? "bg-primary text-primary-foreground border-primary" : "bg-white text-foreground border-border hover:bg-muted"}`}>
            <g.icon className="w-4 h-4" /> {g.label}
          </button>
        ))}
      </div>
      <SubNav sub={sub} setSub={setSub} tabs={active.items} color={active.color} />
      {renderSub()}
    </div>
  );
}
import { useState } from "react";
import { Wrench, ClipboardCheck, HardHat, CalendarDays, Zap } from "lucide-react";
import ErpSimpleCrud from "@/components/erp/ErpSimpleCrud";
import ErpMaintenanceOrderPanel from "@/components/erp/ErpMaintenanceOrderPanel";
import ErpPreventivePanel from "@/components/erp/ErpPreventivePanel";
import ErpMaintenanceCalendar from "@/components/erp/ErpMaintenanceCalendar";
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
};

const TABS = [
  { id: "equipamentos", label: "Equipamentos", icon: Wrench },
  { id: "planos", label: "Planos Preventivos", icon: ClipboardCheck },
  { id: "preventivas", label: "Gerar Preventivas", icon: Zap },
  { id: "os", label: "Ordens de Serviço", icon: HardHat },
  { id: "calendario", label: "Calendário de OS", icon: CalendarDays },
];

export default function ErpModuleManutencao({ user }) {
  const [sub, setSub] = useState("equipamentos");
  return (
    <div className="space-y-3">
      <SubNav sub={sub} setSub={setSub} tabs={TABS} color="purple" />
      {sub === "os" ? <ErpMaintenanceOrderPanel user={user} />
        : sub === "preventivas" ? <ErpPreventivePanel user={user} />
        : sub === "calendario" ? <ErpMaintenanceCalendar user={user} />
        : <ErpSimpleCrud key={sub} user={user} {...CRUD_CONFIGS[sub]} />}
    </div>
  );
}
import { useState } from "react";
import { Warehouse, MapPin, ArrowLeftRight, ClipboardList, ArrowDownCircle } from "lucide-react";
import ErpSimpleCrud from "@/components/erp/ErpSimpleCrud";
import ErpWmsMovePanel from "@/components/erp/ErpWmsMovePanel";
import ErpWmsInventoryPanel from "@/components/erp/ErpWmsInventoryPanel";
import ErpWmsReceivingPanel from "@/components/erp/ErpWmsReceivingPanel";
import { SubNav } from "./ErpModuleSuprimentos";

const CRUD_CONFIGS = {
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

const TABS = [
  { id: "recebimento", label: "Recebimento NF", icon: ArrowDownCircle },
  { id: "armazens", label: "Armazéns", icon: Warehouse },
  { id: "enderecos", label: "Endereçamento", icon: MapPin },
  { id: "movimentos", label: "Movimentações", icon: ArrowLeftRight },
  { id: "inventario", label: "Inventário", icon: ClipboardList },
];

export default function ErpModuleWms({ user }) {
  const [sub, setSub] = useState("recebimento");
  return (
    <div className="space-y-3">
      <SubNav sub={sub} setSub={setSub} tabs={TABS} color="indigo" />
      {sub === "recebimento" && <ErpWmsReceivingPanel user={user} />}
      {sub === "movimentos" && <ErpWmsMovePanel user={user} />}
      {sub === "inventario" && <ErpWmsInventoryPanel user={user} />}
      {(sub === "armazens" || sub === "enderecos") && <ErpSimpleCrud key={sub} user={user} {...CRUD_CONFIGS[sub]} />}
    </div>
  );
}
import { useState } from "react";
import { Truck, Users, Fuel, Wrench, CircleDot, Wallet, BarChart3, Boxes } from "lucide-react";
import ErpSimpleCrud from "@/components/erp/ErpSimpleCrud";
import ErpFleetReportsPanel from "@/components/erp/ErpFleetReportsPanel";
import ErpFleetMaintenancePanel from "@/components/erp/ErpFleetMaintenancePanel";
import ErpLoadAssemblyPanel from "@/components/erp/logistica/ErpLoadAssemblyPanel";
import { SubNav } from "./ErpModuleSuprimentos";

const VEHICLE_STATUS = [
  { value: "ativo", label: "Ativo", color: "bg-emerald-100 text-emerald-700" },
  { value: "em_manutencao", label: "Em Manutenção", color: "bg-amber-100 text-amber-700" },
  { value: "inativo", label: "Inativo", color: "bg-gray-100 text-gray-600" },
];

const VEHICLE_TYPES = [
  { value: "caminhao", label: "Caminhão" },
  { value: "caminhonete", label: "Caminhonete" },
  { value: "van", label: "Van" },
  { value: "carro", label: "Carro" },
  { value: "reboque", label: "Reboque" },
  { value: "empilhadeira", label: "Empilhadeira" },
  { value: "outro", label: "Outro" },
];

const FUEL_TYPES = [
  { value: "diesel", label: "Diesel" },
  { value: "gasolina", label: "Gasolina" },
  { value: "etanol", label: "Etanol" },
  { value: "gnv", label: "GNV" },
  { value: "eletrico", label: "Elétrico" },
];

const DRIVER_STATUS = [
  { value: "ativo", label: "Ativo", color: "bg-emerald-100 text-emerald-700" },
  { value: "inativo", label: "Inativo", color: "bg-gray-100 text-gray-600" },
];

const CNH_CATEGORIES = ["A", "B", "AB", "C", "AC", "D", "AD", "E", "AE"].map(v => ({ value: v, label: v }));

const TIRE_STATUS = [
  { value: "novo", label: "Novo", color: "bg-blue-100 text-blue-700" },
  { value: "em_uso", label: "Em Uso", color: "bg-emerald-100 text-emerald-700" },
  { value: "reserva", label: "Reserva", color: "bg-gray-100 text-gray-600" },
  { value: "recapado", label: "Recapado", color: "bg-amber-100 text-amber-700" },
  { value: "descartado", label: "Descartado", color: "bg-red-100 text-red-700" },
];

const EXPENSE_CATEGORIES = [
  { value: "pedagio", label: "Pedágio", color: "bg-blue-100 text-blue-700" },
  { value: "multa", label: "Multa", color: "bg-red-100 text-red-700" },
  { value: "seguro", label: "Seguro", color: "bg-indigo-100 text-indigo-700" },
  { value: "ipva_licenciamento", label: "IPVA/Licenciamento", color: "bg-purple-100 text-purple-700" },
  { value: "estacionamento", label: "Estacionamento", color: "bg-gray-100 text-gray-600" },
  { value: "lavagem", label: "Lavagem", color: "bg-cyan-100 text-cyan-700" },
  { value: "outros", label: "Outros", color: "bg-amber-100 text-amber-700" },
];

const CRUD_CONFIGS = {
  veiculos: {
    entityName: "ErpFleetVehicle",
    title: "Cadastro de Veículos da Frota",
    fields: [
      { key: "plate", label: "Placa", required: true },
      { key: "vehicle_type", label: "Tipo", type: "select", options: VEHICLE_TYPES, required: true },
      { key: "brand", label: "Marca" },
      { key: "model", label: "Modelo" },
      { key: "year", label: "Ano", type: "number" },
      { key: "color", label: "Cor" },
      { key: "renavam", label: "RENAVAM" },
      { key: "fuel", label: "Combustível", type: "select", options: FUEL_TYPES },
      { key: "capacity_kg", label: "Capacidade de Carga (kg)", type: "number" },
      { key: "tara", label: "Tara — Peso Máximo de Carga (kg)", type: "number" },
      { key: "current_mileage", label: "Quilometragem Atual (km)", type: "number" },
      { key: "acquisition_date", label: "Data de Aquisição", inputType: "date" },
      { key: "status", label: "Situação", type: "select", options: VEHICLE_STATUS, required: true },
      { key: "notes", label: "Observações", full: true },
    ],
    columns: [
      { key: "plate", label: "Placa" },
      { key: "vehicle_type", label: "Tipo", type: "badge", options: VEHICLE_TYPES.map(t => ({ value: t.value, label: t.label, color: "bg-blue-100 text-blue-700" })) },
      { key: "brand", label: "Marca" },
      { key: "model", label: "Modelo" },
      { key: "tara", label: "Tara (kg)" },
      { key: "current_mileage", label: "Km Atual" },
      { key: "status", label: "Situação", type: "badge", options: VEHICLE_STATUS },
    ],
    searchKeys: ["plate", "brand", "model", "renavam"],
  },
  motoristas: {
    entityName: "ErpFleetDriver",
    title: "Cadastro de Motoristas",
    fields: [
      { key: "name", label: "Nome do Motorista", required: true },
      { key: "cpf", label: "CPF", mask: "cnpj" },
      { key: "cnh_number", label: "Registro da CNH" },
      { key: "cnh_category", label: "Categoria da CNH", type: "select", options: CNH_CATEGORIES },
      { key: "cnh_expiry", label: "Validade da CNH", inputType: "date" },
      { key: "phone", label: "Telefone", mask: "phone" },
      { key: "admission_date", label: "Data de Admissão", inputType: "date" },
      { key: "status", label: "Situação", type: "select", options: DRIVER_STATUS, required: true },
      { key: "notes", label: "Observações", full: true },
    ],
    columns: [
      { key: "name", label: "Motorista" },
      { key: "cpf", label: "CPF" },
      { key: "cnh_category", label: "Categoria" },
      { key: "cnh_expiry", label: "Validade CNH" },
      { key: "phone", label: "Telefone" },
      { key: "status", label: "Situação", type: "badge", options: DRIVER_STATUS },
    ],
    searchKeys: ["name", "cpf", "cnh_number"],
  },
  abastecimentos: {
    entityName: "ErpFleetFuelEntry",
    title: "Controle de Abastecimentos e Combustível",
    fields: [
      { key: "vehicle_id", label: "Veículo", type: "entity-select", entity: "ErpFleetVehicle", labelKey: "plate", cacheKey: "vehicle_plate", required: true },
      { key: "driver_id", label: "Motorista", type: "entity-select", entity: "ErpFleetDriver", cacheKey: "driver_name" },
      { key: "entry_date", label: "Data", inputType: "date", required: true },
      { key: "fuel_type", label: "Combustível", type: "select", options: FUEL_TYPES, required: true },
      { key: "liters", label: "Litros", type: "number", required: true },
      { key: "price_per_liter", label: "Preço por Litro (R$)", type: "number" },
      { key: "total_value", label: "Valor Total (R$)", type: "number", required: true },
      { key: "odometer", label: "Odômetro (km)", type: "number" },
      { key: "gas_station", label: "Posto" },
      { key: "notes", label: "Observações", full: true },
    ],
    columns: [
      { key: "entry_date", label: "Data" },
      { key: "vehicle_plate", label: "Veículo" },
      { key: "driver_name", label: "Motorista" },
      { key: "liters", label: "Litros" },
      { key: "odometer", label: "Odômetro (km)" },
      { key: "price_per_liter", label: "Preço/L", type: "money" },
      { key: "total_value", label: "Total", type: "money" },
      { key: "gas_station", label: "Posto" },
    ],
    searchKeys: ["vehicle_plate", "driver_name", "gas_station"],
  },
  pneus: {
    entityName: "ErpFleetTire",
    title: "Controle de Pneus",
    fields: [
      { key: "vehicle_id", label: "Veículo", type: "entity-select", entity: "ErpFleetVehicle", labelKey: "plate", cacheKey: "vehicle_plate", required: true },
      { key: "brand", label: "Marca", required: true },
      { key: "model", label: "Modelo" },
      { key: "size", label: "Medida (ex.: 295/80R22.5)" },
      { key: "dot", label: "DOT" },
      { key: "position", label: "Posição (ex.: DDE, TIE)" },
      { key: "purchase_date", label: "Data de Compra", inputType: "date" },
      { key: "purchase_cost", label: "Custo (R$)", type: "number" },
      { key: "status", label: "Situação", type: "select", options: TIRE_STATUS, required: true },
      { key: "notes", label: "Observações", full: true },
    ],
    columns: [
      { key: "vehicle_plate", label: "Veículo" },
      { key: "brand", label: "Marca" },
      { key: "size", label: "Medida" },
      { key: "position", label: "Posição" },
      { key: "status", label: "Situação", type: "badge", options: TIRE_STATUS },
      { key: "purchase_date", label: "Compra" },
      { key: "purchase_cost", label: "Custo", type: "money" },
    ],
    searchKeys: ["vehicle_plate", "brand", "model", "size", "position"],
  },
  gastos: {
    entityName: "ErpFleetExpense",
    title: "Controle de Gastos da Frota",
    fields: [
      { key: "vehicle_id", label: "Veículo", type: "entity-select", entity: "ErpFleetVehicle", labelKey: "plate", cacheKey: "vehicle_plate", required: true },
      { key: "category", label: "Categoria", type: "select", options: EXPENSE_CATEGORIES, required: true },
      { key: "expense_date", label: "Data", inputType: "date", required: true },
      { key: "description", label: "Descrição", required: true },
      { key: "value", label: "Valor (R$)", type: "number", required: true },
      { key: "notes", label: "Observações", full: true },
    ],
    columns: [
      { key: "expense_date", label: "Data" },
      { key: "vehicle_plate", label: "Veículo" },
      { key: "category", label: "Categoria", type: "badge", options: EXPENSE_CATEGORIES },
      { key: "description", label: "Descrição" },
      { key: "value", label: "Valor", type: "money" },
    ],
    searchKeys: ["vehicle_plate", "description", "category"],
  },
};

const TABS = [
  { id: "carga", label: "Montagem de Carga", icon: Boxes },
  { id: "veiculos", label: "Veículos", icon: Truck },
  { id: "motoristas", label: "Motoristas", icon: Users },
  { id: "abastecimentos", label: "Abastecimentos", icon: Fuel },
  { id: "manutencoes", label: "Manutenções", icon: Wrench },
  { id: "pneus", label: "Pneus", icon: CircleDot },
  { id: "gastos", label: "Gastos", icon: Wallet },
  { id: "relatorios", label: "Relatórios", icon: BarChart3 },
];

export default function ErpModuleLogistica({ user }) {
  const [sub, setSub] = useState("carga");
  return (
    <div className="space-y-3">
      <SubNav sub={sub} setSub={setSub} tabs={TABS} color="purple" />
      {sub === "carga" ? <ErpLoadAssemblyPanel user={user} />
        : sub === "manutencoes" ? <ErpFleetMaintenancePanel user={user} />
        : sub === "relatorios" ? <ErpFleetReportsPanel user={user} />
        : <ErpSimpleCrud key={sub} user={user} {...CRUD_CONFIGS[sub]} />}
    </div>
  );
}
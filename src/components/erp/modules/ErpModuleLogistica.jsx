import { useState } from "react";
import { Truck, Users } from "lucide-react";
import ErpSimpleCrud from "@/components/erp/ErpSimpleCrud";
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
};

const TABS = [
  { id: "veiculos", label: "Veículos", icon: Truck },
  { id: "motoristas", label: "Motoristas", icon: Users },
];

export default function ErpModuleLogistica({ user }) {
  const [sub, setSub] = useState("veiculos");
  return (
    <div className="space-y-3">
      <SubNav sub={sub} setSub={setSub} tabs={TABS} color="purple" />
      <ErpSimpleCrud key={sub} user={user} {...CRUD_CONFIGS[sub]} />
    </div>
  );
}
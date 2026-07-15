import { Car, Gauge, Fuel } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function VehicleDataForm({ data, onChange }) {
  const update = (field, value) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Car className="w-5 h-5 text-[#2563EB]" />
        <h3 className="font-bold text-[#1B1C21]">Dados do Veículo</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label className="text-sm font-medium text-[#333] mb-1.5 block">Marca *</Label>
          <Input
            value={data.brand}
            onChange={(e) => update("brand", e.target.value)}
            placeholder="Ex: Volkswagen"
            className="h-10"
          />
        </div>
        <div>
          <Label className="text-sm font-medium text-[#333] mb-1.5 block">Modelo *</Label>
          <Input
            value={data.model}
            onChange={(e) => update("model", e.target.value)}
            placeholder="Ex: Gol 1.0"
            className="h-10"
          />
        </div>
        <div>
          <Label className="text-sm font-medium text-[#333] mb-1.5 block">Ano</Label>
          <Input
            type="number"
            value={data.year}
            onChange={(e) => update("year", e.target.value)}
            placeholder="Ex: 2018"
            className="h-10"
          />
        </div>
        <div>
          <Label className="text-sm font-medium text-[#333] mb-1.5 block">Motor</Label>
          <Input
            value={data.engine}
            onChange={(e) => update("engine", e.target.value)}
            placeholder="Ex: 1.0 MPI"
            className="h-10"
          />
        </div>
        <div>
          <Label className="text-sm font-medium text-[#333] mb-1.5 block flex items-center gap-1">
            <Gauge className="w-3.5 h-3.5" /> Quilometragem
          </Label>
          <Input
            type="number"
            value={data.mileage}
            onChange={(e) => update("mileage", e.target.value)}
            placeholder="Ex: 85000"
            className="h-10"
          />
        </div>
        <div>
          <Label className="text-sm font-medium text-[#333] mb-1.5 block flex items-center gap-1">
            <Fuel className="w-3.5 h-3.5" /> Combustível
          </Label>
          <Select value={data.fuel || "flex"} onValueChange={(v) => update("fuel", v)}>
            <SelectTrigger className="h-10">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="flex">Flex</SelectItem>
              <SelectItem value="gasolina">Gasolina</SelectItem>
              <SelectItem value="etanol">Etanol</SelectItem>
              <SelectItem value="diesel">Diesel</SelectItem>
              <SelectItem value="hibrido">Híbrido</SelectItem>
              <SelectItem value="eletrico">Elétrico</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
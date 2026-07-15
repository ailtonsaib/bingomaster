import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, User, Car } from "lucide-react";
import { maskCpfCnpj, maskPhone, onlyDigits } from "@/lib/brMasks";

export default function VehicleRegistrationModal({ open, onClose, userEmail, cpfCnpj, existingClient, onRegistered }) {
  const [clientData, setClientData] = useState({
    name: existingClient?.name || "",
    cpf_cnpj: cpfCnpj || "",
    phone: existingClient?.phone || "",
    email: existingClient?.email || "",
    address: existingClient?.address || "",
  });
  const [vehicleData, setVehicleData] = useState({
    plate: "",
    brand: "",
    model: "",
    year: "",
    engine: "",
    fuel: "flex",
    mileage: "",
    color: "",
    vin: "",
    observations: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isNewClient = !existingClient;

  const updateClient = (field, value) => setClientData((p) => ({ ...p, [field]: value }));
  const updateVehicle = (field, value) => setVehicleData((p) => ({ ...p, [field]: value }));

  const handleSave = async () => {
    setError("");
    if (!vehicleData.brand.trim() || !vehicleData.model.trim()) {
      setError("Informe a marca e o modelo do veículo.");
      return;
    }
    if (isNewClient && !clientData.name.trim()) {
      setError("Informe o nome do cliente.");
      return;
    }

    setLoading(true);
    try {
      let finalCpfCnpj = clientData.cpf_cnpj;

      // Create client if new
      if (isNewClient) {
        const digits = onlyDigits(clientData.cpf_cnpj);
        if (digits.length !== 11 && digits.length !== 14) {
          setError("CPF/CNPJ inválido.");
          setLoading(false);
          return;
        }
        const createdClient = await base44.entities.DiagnosticClient.create({
          user_email: userEmail,
          name: clientData.name,
          cpf_cnpj: digits,
          phone: clientData.phone,
          email: clientData.email,
          address: clientData.address,
        });
        finalCpfCnpj = digits;
      }

      // Create vehicle
      const createdVehicle = await base44.entities.DiagnosticVehicle.create({
        user_email: userEmail,
        client_cpf_cnpj: finalCpfCnpj,
        client_name: isNewClient ? clientData.name : existingClient.name,
        plate: vehicleData.plate.toUpperCase(),
        brand: vehicleData.brand,
        model: vehicleData.model,
        year: vehicleData.year,
        engine: vehicleData.engine,
        fuel: vehicleData.fuel,
        mileage: vehicleData.mileage ? Number(vehicleData.mileage) : 0,
        color: vehicleData.color,
        vin: vehicleData.vin,
        observations: vehicleData.observations,
      });

      onRegistered({
        ...vehicleData,
        mileage: vehicleData.mileage ? Number(vehicleData.mileage) : 0,
      });
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao cadastrar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cadastrar {isNewClient ? "Cliente e Veículo" : "Veículo"}</DialogTitle>
        </DialogHeader>

        {isNewClient && (
          <div className="space-y-3 mb-4 pb-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-[#2563EB]" />
              <span className="text-sm font-semibold text-[#1B1C21]">Dados do Cliente</span>
            </div>
            <div>
              <Label className="text-sm mb-1 block">Nome / Razão Social *</Label>
              <Input value={clientData.name} onChange={(e) => updateClient("name", e.target.value)} className="h-10" placeholder="Nome do cliente" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm mb-1 block">CPF/CNPJ</Label>
                <Input value={maskCpfCnpj(clientData.cpf_cnpj)} onChange={(e) => updateClient("cpf_cnpj", onlyDigits(e.target.value))} className="h-10" disabled />
              </div>
              <div>
                <Label className="text-sm mb-1 block">Telefone</Label>
                <Input value={clientData.phone} onChange={(e) => updateClient("phone", maskPhone(e.target.value))} className="h-10" placeholder="(00) 00000-0000" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm mb-1 block">Email</Label>
                <Input value={clientData.email} onChange={(e) => updateClient("email", e.target.value)} className="h-10" placeholder="email@exemplo.com" />
              </div>
              <div>
                <Label className="text-sm mb-1 block">Endereço</Label>
                <Input value={clientData.address} onChange={(e) => updateClient("address", e.target.value)} className="h-10" placeholder="Endereço" />
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Car className="w-4 h-4 text-[#2563EB]" />
            <span className="text-sm font-semibold text-[#1B1C21]">Dados do Veículo</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm mb-1 block">Placa</Label>
              <Input value={vehicleData.plate} onChange={(e) => updateVehicle("plate", e.target.value.toUpperCase())} className="h-10" placeholder="ABC-1234" />
            </div>
            <div>
              <Label className="text-sm mb-1 block">Cor</Label>
              <Input value={vehicleData.color} onChange={(e) => updateVehicle("color", e.target.value)} className="h-10" placeholder="Ex: Prata" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm mb-1 block">Marca *</Label>
              <Input value={vehicleData.brand} onChange={(e) => updateVehicle("brand", e.target.value)} className="h-10" placeholder="Ex: Volkswagen" />
            </div>
            <div>
              <Label className="text-sm mb-1 block">Modelo *</Label>
              <Input value={vehicleData.model} onChange={(e) => updateVehicle("model", e.target.value)} className="h-10" placeholder="Ex: Gol 1.0" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-sm mb-1 block">Ano</Label>
              <Input type="number" value={vehicleData.year} onChange={(e) => updateVehicle("year", e.target.value)} className="h-10" placeholder="2018" />
            </div>
            <div>
              <Label className="text-sm mb-1 block">Motor</Label>
              <Input value={vehicleData.engine} onChange={(e) => updateVehicle("engine", e.target.value)} className="h-10" placeholder="1.0 MPI" />
            </div>
            <div>
              <Label className="text-sm mb-1 block">Combustível</Label>
              <Select value={vehicleData.fuel} onValueChange={(v) => updateVehicle("fuel", v)}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm mb-1 block">Quilometragem</Label>
              <Input type="number" value={vehicleData.mileage} onChange={(e) => updateVehicle("mileage", e.target.value)} className="h-10" placeholder="85000" />
            </div>
            <div>
              <Label className="text-sm mb-1 block">Chassi (VIN)</Label>
              <Input value={vehicleData.vin} onChange={(e) => updateVehicle("vin", e.target.value)} className="h-10" placeholder="Opcional" />
            </div>
          </div>
          <div>
            <Label className="text-sm mb-1 block">Observações</Label>
            <Textarea value={vehicleData.observations} onChange={(e) => updateVehicle("observations", e.target.value)} className="min-h-[60px] resize-none" placeholder="Observações sobre o veículo" />
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="rounded-lg">Cancelar</Button>
          <Button onClick={handleSave} disabled={loading} className="rounded-lg text-white" style={{ backgroundColor: "#2563EB" }}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            {loading ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
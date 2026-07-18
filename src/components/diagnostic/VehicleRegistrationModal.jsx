import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, User, Car, Search } from "lucide-react";
import { maskCpfCnpj, maskPhone, onlyDigits } from "@/lib/brMasks";
import { useToast } from "@/components/ui/use-toast";

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
  const [searchingPlate, setSearchingPlate] = useState(false);
  const { toast } = useToast();

  const isNewClient = !existingClient;

  const updateClient = (field, value) => setClientData((p) => ({ ...p, [field]: value }));
  const updateVehicle = (field, value) => setVehicleData((p) => ({ ...p, [field]: value }));

  const cleanPlate = vehicleData.plate.replace(/[^A-Za-z0-9]/g, "").toUpperCase();

  const mapFuel = (fuelStr) => {
    if (!fuelStr) return null;
    const f = fuelStr.toLowerCase();
    if (f.includes("flex")) return "flex";
    if (f.includes("gasolin")) return "gasolina";
    if (f.includes("etanol") || f.includes("álcool") || f.includes("alcool")) return "etanol";
    if (f.includes("diesel")) return "diesel";
    if (f.includes("híbrid") || f.includes("hibrid")) return "hibrido";
    if (f.includes("elétr") || f.includes("electr")) return "eletrico";
    return null;
  };

  const handlePlateSearch = async () => {
    if (cleanPlate.length < 7) {
      setError("Placa inválida. Informe uma placa com 7 caracteres (formato antigo AAA0000 ou Mercosul AAA0A00).");
      return;
    }
    setSearchingPlate(true);
    setError("");
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Você é um sistema de consulta veicular brasileiro. Busque na internet os dados cadastrais do veículo de placa "${cleanPlate}" (placa brasileira, formato antigo AAA0000 ou Mercosul AAA0A00). Retorne: marca/montadora, modelo completo, ano de fabricação, cor predominante, tipo de combustível (flex, gasolina, etanol, diesel, híbrido ou elétrico), motorização (ex: 1.0, 1.6, 2.0) e número do chassi (VIN) se disponível. Se não encontrar dados específicos para esta placa, retorne encontrado=false.`,
        add_context_from_internet: true,
        model: "gemini_3_flash",
        response_json_schema: {
          type: "object",
          properties: {
            encontrado: { type: "boolean" },
            marca: { type: "string" },
            modelo: { type: "string" },
            ano: { type: "string" },
            cor: { type: "string" },
            combustivel: { type: "string" },
            motor: { type: "string" },
            chassi: { type: "string" }
          }
        }
      });

      if (result?.encontrado) {
        setVehicleData(prev => ({
          ...prev,
          brand: result.marca || prev.brand,
          model: result.modelo || prev.model,
          year: result.ano || prev.year,
          color: result.cor || prev.color,
          engine: result.motor || prev.engine,
          vin: result.chassi || prev.vin,
          fuel: mapFuel(result.combustivel) || prev.fuel,
        }));
        toast({ title: "Veículo encontrado", description: "Os dados foram preenchidos automaticamente. Verifique e ajuste se necessário." });
      } else {
        toast({ title: "Placa não encontrada", description: "Não foi possível encontrar dados para esta placa. Preencha manualmente.", variant: "destructive" });
      }
    } catch (err) {
      setError("Não foi possível consultar a placa. Preencha os dados manualmente.");
    } finally {
      setSearchingPlate(false);
    }
  };

  const handlePlateBlur = () => {
    if (cleanPlate.length >= 7 && !searchingPlate && !vehicleData.brand) {
      handlePlateSearch();
    }
  };

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
      const cpfDigits = onlyDigits(clientData.cpf_cnpj);
      if (isNewClient && (cpfDigits.length !== 11 && cpfDigits.length !== 14)) {
        setError("CPF/CNPJ inválido.");
        setLoading(false);
        return;
      }

      await base44.functions.invoke("manageDiagnostic", {
        operation: "createClientAndVehicle",
        is_new_client: isNewClient,
        client_data: isNewClient ? {
          name: clientData.name,
          cpf_cnpj: cpfDigits,
          phone: clientData.phone,
          email: clientData.email,
          address: clientData.address,
        } : undefined,
        existing_client_name: existingClient?.name,
        vehicle_data: {
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
        },
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
              <div className="flex gap-2">
                <Input
                  value={vehicleData.plate}
                  onChange={(e) => updateVehicle("plate", e.target.value.toUpperCase())}
                  onBlur={handlePlateBlur}
                  className="h-10"
                  placeholder="ABC1D23"
                  maxLength={8}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePlateSearch}
                  disabled={searchingPlate || cleanPlate.length < 7}
                  className="h-10 w-10 flex-shrink-0 p-0"
                  title="Buscar dados do veículo pela placa"
                >
                  {searchingPlate ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </Button>
              </div>
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
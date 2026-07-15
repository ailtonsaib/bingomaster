import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, User, Car, Plus, Loader2, ChevronRight, UserPlus } from "lucide-react";
import { maskCpfCnpj, onlyDigits } from "@/lib/brMasks";

export default function ClientVehicleSelector({ userEmail, onVehicleSelect, onRegisterNew }) {
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [searching, setSearching] = useState(false);
  const [client, setClient] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    const digits = onlyDigits(cpfCnpj);
    if (digits.length !== 11 && digits.length !== 14) return;

    setSearching(true);
    setSearched(true);
    setClient(null);
    setVehicles([]);
    setSelectedId(null);

    try {
      const [clients, vehs] = await Promise.all([
        base44.entities.DiagnosticClient.filter({ user_email: userEmail, cpf_cnpj: digits }),
        base44.entities.DiagnosticVehicle.filter({ user_email: userEmail, client_cpf_cnpj: digits }),
      ]);
      if (clients.length > 0) setClient(clients[0]);
      setVehicles(vehs);
    } catch {
      // ignore
    } finally {
      setSearching(false);
    }
  };

  const handleSelectVehicle = (vehicle) => {
    setSelectedId(vehicle.id);
    onVehicleSelect({
      brand: vehicle.brand || "",
      model: vehicle.model || "",
      year: vehicle.year || "",
      engine: vehicle.engine || "",
      mileage: vehicle.mileage || "",
      fuel: vehicle.fuel || "flex",
      plate: vehicle.plate || "",
      color: vehicle.color || "",
      vin: vehicle.vin || "",
      observations: vehicle.observations || "",
    });
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSearch();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <User className="w-5 h-5 text-[#2563EB]" />
        <h3 className="font-bold text-[#1B1C21]">Cliente e Veículo</h3>
      </div>

      {/* CPF/CNPJ search */}
      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            value={cpfCnpj}
            onChange={(e) => setCpfCnpj(maskCpfCnpj(e.target.value))}
            onKeyDown={handleKeyDown}
            placeholder="Digite o CPF ou CNPJ do cliente"
            className="h-10"
          />
        </div>
        <Button
          onClick={handleSearch}
          disabled={searching || (onlyDigits(cpfCnpj).length !== 11 && onlyDigits(cpfCnpj).length !== 14)}
          className="h-10 px-5 text-white"
          style={{ backgroundColor: "#2563EB" }}
        >
          {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
        </Button>
      </div>

      {/* Results */}
      {searched && !searching && (
        <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}>
          {client ? (
            <>
              <div className="rounded-lg bg-[#DBEAFE]/50 border border-[#2563EB]/20 p-3 mb-3">
                <p className="text-sm font-semibold text-[#1B1C21]">{client.name}</p>
                <p className="text-xs text-[#71717A]">{maskCpfCnpj(client.cpf_cnpj)}</p>
                {client.phone && <p className="text-xs text-[#71717A]">{client.phone}</p>}
              </div>

              {vehicles.length > 0 ? (
                <>
                  <p className="text-xs font-medium text-[#52525B] mb-2">Veículos cadastrados ({vehicles.length})</p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {vehicles.map((v) => (
                      <button
                        key={v.id}
                        onClick={() => handleSelectVehicle(v)}
                        className={`w-full text-left p-3 rounded-lg border transition-all ${
                          selectedId === v.id
                            ? "border-[#2563EB] bg-[#2563EB]/5 ring-1 ring-[#2563EB]/20"
                            : "border-gray-100 hover:border-[#2563EB]/30 hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Car className="w-4 h-4 text-[#2563EB] flex-shrink-0" />
                            <div>
                              <span className="text-sm font-medium text-[#1B1C21]">
                                {v.brand} {v.model}
                              </span>
                              {v.plate && (
                                <span className="text-xs text-[#71717A] ml-2">| {v.plate}</span>
                              )}
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-[#A1A1AA]" />
                        </div>
                        <p className="text-xs text-[#71717A] mt-0.5">
                          {v.year || "—"} {v.engine ? `• ${v.engine}` : ""} {v.mileage ? `• ${Number(v.mileage).toLocaleString("pt-BR")} km` : ""}
                        </p>
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => onRegisterNew(onlyDigits(cpfCnpj), client)}
                    className="flex items-center gap-1 text-xs text-[#2563EB] hover:underline mt-3"
                  >
                    <Plus className="w-3.5 h-3.5" /> Cadastrar novo veículo para este cliente
                  </button>
                </>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-[#71717A] mb-2">Cliente encontrado, mas sem veículos cadastrados.</p>
                  <Button
                    onClick={() => onRegisterNew(onlyDigits(cpfCnpj), client)}
                    size="sm"
                    className="text-white"
                    style={{ backgroundColor: "#2563EB" }}
                  >
                    <Plus className="w-4 h-4 mr-1" /> Cadastrar veículo
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-[#71717A] mb-2">Nenhum cliente encontrado com este CPF/CNPJ.</p>
              <Button
                onClick={() => onRegisterNew(onlyDigits(cpfCnpj), null)}
                size="sm"
                className="text-white"
                style={{ backgroundColor: "#2563EB" }}
              >
                <UserPlus className="w-4 h-4 mr-1" /> Cadastrar cliente e veículo
              </Button>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
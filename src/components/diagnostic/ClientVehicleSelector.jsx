import { useState } from "react";
import { motion } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, User, Car, Plus, Loader2, ChevronRight, UserPlus, Trash2 } from "lucide-react";
import { maskCpfCnpj, onlyDigits } from "@/lib/brMasks";

export default function ClientVehicleSelector({ userEmail, onVehicleSelect, onRegisterNew, usage, canDelete }) {
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [searching, setSearching] = useState(false);
  const [client, setClient] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [searched, setSearched] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const refreshVehicles = async (digits) => {
    const vehs = await base44.entities.DiagnosticVehicle.filter({ user_email: userEmail, client_cpf_cnpj: digits });
    setVehicles(vehs);
  };

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

  const handleDeleteVehicle = async (vehicleId, e) => {
    e.stopPropagation();
    if (!confirm("Excluir este veículo?")) return;
    setDeleting(true);
    try {
      await base44.functions.invoke("manageDiagnostic", { operation: "deleteVehicle", vehicle_id: vehicleId });
      const digits = onlyDigits(cpfCnpj);
      await refreshVehicles(digits);
      if (selectedId === vehicleId) setSelectedId(null);
    } catch (err) {
      alert(err.response?.data?.error || "Erro ao excluir veículo.");
    }
    setDeleting(false);
  };

  const handleDeleteClient = async () => {
    if (!client) return;
    if (!confirm(`Excluir o cliente ${client.name}? Os veículos cadastrados permanecerão.`)) return;
    setDeleting(true);
    try {
      await base44.functions.invoke("manageDiagnostic", { operation: "deleteClient", client_id: client.id });
      setClient(null);
      setVehicles([]);
      setSelectedId(null);
      setCpfCnpj("");
      setSearched(false);
    } catch (err) {
      alert(err.response?.data?.error || "Erro ao excluir cliente.");
    }
    setDeleting(false);
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

      {usage && (
        <div className="flex flex-wrap gap-2 text-xs">
          <span className={`px-2 py-0.5 rounded-full font-medium ${usage.plan === 'master' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
            Plano {usage.plan_name}
          </span>
          {usage.max_diagnostics >= 0 && (
            <span className={`px-2 py-0.5 rounded-full font-medium ${usage.used_diagnostics >= usage.max_diagnostics ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
              {usage.used_diagnostics}/{usage.max_diagnostics} diagnósticos
            </span>
          )}
          {usage.max_clients >= 0 && (
            <span className={`px-2 py-0.5 rounded-full font-medium ${usage.used_clients >= usage.max_clients ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
              {usage.used_clients}/{usage.max_clients} clientes
            </span>
          )}
          {usage.max_vehicles >= 0 && (
            <span className={`px-2 py-0.5 rounded-full font-medium ${usage.used_vehicles >= usage.max_vehicles ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
              {usage.used_vehicles}/{usage.max_vehicles} veículos
            </span>
          )}
        </div>
      )}

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

      {searched && !searching && (
        <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}>
          {client ? (
            <>
              <div className="rounded-lg bg-[#DBEAFE]/50 border border-[#2563EB]/20 p-3 mb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[#1B1C21]">{client.name}</p>
                    <p className="text-xs text-[#71717A]">{maskCpfCnpj(client.cpf_cnpj)}</p>
                    {client.phone && <p className="text-xs text-[#71717A]">{client.phone}</p>}
                  </div>
                  {canDelete && (
                    <button
                      onClick={handleDeleteClient}
                      disabled={deleting}
                      className="p-2 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                      title="Excluir cliente"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {vehicles.length > 0 ? (
                <>
                  <p className="text-xs font-medium text-[#52525B] mb-2">Veículos cadastrados ({vehicles.length})</p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {vehicles.map((v) => (
                      <div key={v.id} className="flex items-center gap-2">
                        <button
                          onClick={() => handleSelectVehicle(v)}
                          className={`flex-1 text-left p-3 rounded-lg border transition-all ${
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
                        {canDelete && (
                          <button
                            onClick={(e) => handleDeleteVehicle(v.id, e)}
                            disabled={deleting}
                            className="p-2 rounded-lg text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
                            title="Excluir veículo"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
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
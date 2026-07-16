import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Search, X, Droplet, Save, CheckCircle, AlertTriangle, Car } from "lucide-react";

const VEHICLE_BRANDS = [
  "Fiat", "Volkswagen", "Chevrolet", "Hyundai", "Toyota", "Honda", "Renault",
  "Ford", "Nissan", "Jeep", "Citroën", "Peugeot", "Audi", "BMW", "Mercedes-Benz",
  "Kia", "Mitsubishi", "Jac", "Chery", "Lifan"
];

const formatCurrency = (v) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function OilChangeModal({ open, onClose, userEmail, parts = [] }) {
  const [vehicleBrand, setVehicleBrand] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleEngine, setVehicleEngine] = useState("");
  const [vehicleYear, setVehicleYear] = useState("");
  const [currentKm, setCurrentKm] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [registeredOilChange, setRegisteredOilChange] = useState(false);
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    if (open) {
      base44.entities.DiagnosticVehicle.filter({ user_email: userEmail }, "-created_date")
        .then(setVehicles)
        .catch(() => {});
    }
  }, [open, userEmail]);

  if (!open) return null;

  const handleSelectVehicle = (id) => {
    setSelectedVehicleId(id);
    setRegisteredOilChange(false);
    const v = vehicles.find(v => v.id === id);
    if (v) {
      setVehicleBrand(v.brand || "");
      setVehicleModel(v.model || "");
      setVehicleEngine(v.engine || "");
      setVehicleYear(v.year || "");
      setCurrentKm(v.mileage ? String(v.mileage) : "");
    }
  };

  const handleRegisterOilChange = async () => {
    if (!selectedVehicleId) {
      setError("Selecione um veículo cadastrado para registrar a troca.");
      return;
    }
    if (!result) {
      setError("Busque a recomendação de óleo primeiro.");
      return;
    }
    const km = Number(currentKm) || 0;
    if (km <= 0) {
      setError("Informe o KM atual do veículo.");
      return;
    }
    setRegistering(true);
    setError("");
    try {
      const interval = Number(result.interval_km) || 10000;
      const nextKm = km + interval;
      await base44.entities.DiagnosticVehicle.update(selectedVehicleId, {
        mileage: km,
        last_service_km: km,
        next_oil_change_km: nextKm,
        last_oil_change_date: new Date().toISOString(),
        oil_viscosity: result.oil_viscosity || "",
        oil_filter_code: result.filter_code && result.filter_code !== "N/D" ? result.filter_code : ""
      });
      setRegisteredOilChange(true);
      // Atualiza lista local
      setVehicles(prev => prev.map(v => v.id === selectedVehicleId ? {
        ...v, mileage: km, last_service_km: km, next_oil_change_km: nextKm,
        last_oil_change_date: new Date().toISOString(),
        oil_viscosity: result.oil_viscosity || "",
        oil_filter_code: result.filter_code && result.filter_code !== "N/D" ? result.filter_code : ""
      } : v));
    } catch (err) {
      setError("Erro ao registrar troca de óleo.");
    }
    setRegistering(false);
  };

  const handleSearch = async () => {
    setError("");
    setResult(null);
    setSaved(false);

    if (!vehicleBrand) {
      setError("Selecione a montadora do veículo.");
      return;
    }
    if (!vehicleModel.trim()) {
      setError("Informe o modelo do veículo.");
      return;
    }

    setLoading(true);
    try {
      // 1. Busca no catálogo local primeiro
      const local = await base44.entities.DiagnosticOil.filter({
        user_email: userEmail,
        vehicle_brand: vehicleBrand,
        vehicle_model: vehicleModel,
        ...(vehicleEngine ? { vehicle_engine: vehicleEngine } : {})
      });

      if (local.length > 0) {
        setResult({ ...local[0], source: "catalog" });
        setLoading(false);
        return;
      }

      // 2. Busca online via IA
      const prompt = `Você é um especialista em mecânica automotiva. Informe a recomendação de óleo do motor para o veículo:
- Montadora: ${vehicleBrand}
- Modelo: ${vehicleModel}
- Motorização: ${vehicleEngine || "não informada"}
- Ano: ${vehicleYear || "não informado"}

Forneça:
- Viscosidade SAE recomendada (ex: 5W30, 10W40, 0W20)
- Tipo de óleo (mineral, semisintetico ou sintetico)
- Quantidade de litros necessária para a troca (número)
- Código do filtro de óleo (se conhecido)
- Intervalo de troca em km
- Observações importantes

Retorne em formato JSON com esta estrutura:
{
  "oil_viscosity": "5W30",
  "oil_type": "sintetico",
  "quantity_liters": 4.2,
  "filter_code": "Código ou N/D",
  "interval_km": 10000,
  "observations": "Observações"
}`;

      const res = await base44.integrations.Core.InvokeLLM({
        prompt,
        add_context_from_internet: true,
        model: "gemini_3_flash",
        response_json_schema: {
          type: "object",
          properties: {
            oil_viscosity: { type: "string" },
            oil_type: { type: "string" },
            quantity_liters: { type: "number" },
            filter_code: { type: "string" },
            interval_km: { type: "number" },
            observations: { type: "string" }
          }
        }
      });

      setResult({ ...res, source: "online" });
    } catch (err) {
      const msg = err.response?.data?.error || err.message || "Erro ao buscar recomendação.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToCatalog = async () => {
    if (!result) return;
    setSaving(true);
    try {
      await base44.entities.DiagnosticOil.create({
        user_email: userEmail,
        vehicle_brand: vehicleBrand,
        vehicle_model: vehicleModel,
        vehicle_engine: vehicleEngine || "",
        vehicle_year: vehicleYear || "",
        oil_viscosity: result.oil_viscosity,
        oil_type: result.oil_type || "semisintetico",
        quantity_liters: Number(result.quantity_liters) || 0,
        filter_code: result.filter_code || "",
        interval_km: Number(result.interval_km) || 0,
        observations: result.observations || ""
      });
      setSaved(true);
    } catch {
      setError("Erro ao salvar no catálogo.");
    }
    setSaving(false);
  };

  const typeLabels = {
    mineral: "Mineral",
    semisintetico: "Semissintético",
    sintetico: "Sintético"
  };

  const typeColors = {
    mineral: "bg-amber-100 text-amber-700",
    semisintetico: "bg-blue-100 text-blue-700",
    sintetico: "bg-purple-100 text-purple-700"
  };

  // Busca peças de óleo no estoque
  const oilParts = parts.filter(p =>
    p.name?.toLowerCase().includes("óleo") ||
    p.name?.toLowerCase().includes("oleo") ||
    p.category?.toLowerCase().includes("óleo") ||
    p.category?.toLowerCase().includes("oleo")
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
              <Droplet className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">Troca de Óleo</h3>
              <p className="text-xs text-gray-500">Sugestão de óleo e quantidade por veículo</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Seleção de veículo cadastrado */}
          {vehicles.length > 0 && (
            <div className="p-3 rounded-lg bg-blue-50/50 border border-blue-100">
              <Label className="text-sm font-medium flex items-center gap-1"><Car className="w-3.5 h-3.5 text-blue-600" /> Veículo Cadastrado</Label>
              <select
                value={selectedVehicleId}
                onChange={e => handleSelectVehicle(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 mt-1 text-sm"
              >
                <option value="">Buscar por placa ou digitar abaixo...</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.plate ? `${v.plate.toUpperCase()} — ` : ""}{v.brand} {v.model} {v.engine ? `(${v.engine})` : ""} {v.client_name ? `| ${v.client_name}` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Seleção do veículo */}
          <div>
            <Label className="text-sm font-medium">Veículo {vehicles.length > 0 && <span className="text-xs text-gray-400">(ou preencha manualmente)</span>}</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-1">
              <select
                value={vehicleBrand}
                onChange={e => { setVehicleBrand(e.target.value); setVehicleModel(""); }}
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="">Montadora</option>
                {VEHICLE_BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
              <Input
                value={vehicleModel}
                onChange={e => setVehicleModel(e.target.value)}
                placeholder="Modelo * (ex: Palio)"
                className="flex-1"
              />
              <Input
                value={vehicleEngine}
                onChange={e => setVehicleEngine(e.target.value)}
                placeholder="Motorização (ex: 1.0, 1.6)"
                className="flex-1"
              />
              <Input
                value={vehicleYear}
                onChange={e => setVehicleYear(e.target.value)}
                placeholder="Ano (ex: 2015)"
                className="flex-1"
              />
              <Input
                type="number"
                value={currentKm}
                onChange={e => setCurrentKm(e.target.value)}
                placeholder="KM Atual (ex: 45000)"
                className="flex-1"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          <Button
            onClick={handleSearch}
            disabled={loading}
            className="w-full h-11 rounded-xl text-white font-medium gap-2"
            style={{ backgroundColor: "#2563EB" }}
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Buscando recomendação...</>
            ) : (
              <><Search className="w-4 h-4" /> Buscar Recomendação de Óleo</>
            )}
          </Button>

          {/* Resultado */}
          {result && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Droplet className="w-5 h-5 text-blue-600" />
                <h4 className="font-bold text-gray-900">Recomendação</h4>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${result.source === "catalog" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
                  {result.source === "catalog" ? "Catálogo local" : "Busca online"}
                </span>
              </div>

              {/* Destaque principal */}
              <div className="rounded-xl border-2 border-blue-200 bg-blue-50/40 p-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="text-center sm:border-r border-gray-200">
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Viscosidade SAE</p>
                    <p className="text-3xl font-black text-blue-700">{result.oil_viscosity || "—"}</p>
                    {result.oil_type && (
                      <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-bold ${typeColors[result.oil_type] || "bg-gray-100 text-gray-600"}`}>
                        {typeLabels[result.oil_type] || result.oil_type}
                      </span>
                    )}
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Quantidade</p>
                    <p className="text-3xl font-black text-gray-900">
                      {Number(result.quantity_liters).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} L
                    </p>
                    <p className="text-xs text-gray-400 mt-2">para troca completa</p>
                  </div>
                </div>
              </div>

              {/* Detalhes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {result.filter_code && result.filter_code !== "N/D" && (
                  <div className="rounded-lg border border-gray-200 p-3">
                    <p className="text-xs text-gray-500 mb-1">Filtro de Óleo</p>
                    <p className="font-mono text-sm font-bold text-gray-900">{result.filter_code}</p>
                  </div>
                )}
                {result.interval_km > 0 && (
                  <div className="rounded-lg border border-gray-200 p-3">
                    <p className="text-xs text-gray-500 mb-1">Intervalo de Troca</p>
                    <p className="text-sm font-bold text-gray-900">{result.interval_km.toLocaleString("pt-BR")} km</p>
                  </div>
                )}
              </div>

              {result.observations && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
                  <span className="font-semibold">Atenção: </span>{result.observations}
                </div>
              )}

              {/* Óleos disponíveis em estoque */}
              {oilParts.length > 0 && (
                <div className="rounded-lg border border-gray-200 p-3">
                  <p className="text-xs text-gray-500 mb-2 font-medium">Óleos disponíveis em estoque:</p>
                  <div className="space-y-1.5">
                    {oilParts.map((p, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700">{p.name} {p.brand ? `(${p.brand})` : ""}</span>
                        <span className="text-green-600 font-medium">{formatCurrency(p.sale_price)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Próxima troca calculada */}
              {selectedVehicleId && currentKm && result?.interval_km > 0 && (
                <div className="rounded-xl border-2 border-green-200 bg-green-50/40 p-4 text-center">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Próxima Troca</p>
                  <p className="text-2xl font-black text-green-700">
                    {(Number(currentKm) + Number(result.interval_km)).toLocaleString("pt-BR")} km
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    KM atual: {Number(currentKm).toLocaleString("pt-BR")} + intervalo: {Number(result.interval_km).toLocaleString("pt-BR")} km
                  </p>
                </div>
              )}

              {/* Botão registrar troca no veículo */}
              {selectedVehicleId && (
                <Button
                  onClick={handleRegisterOilChange}
                  disabled={registering || registeredOilChange}
                  className="w-full gap-2 text-white"
                  style={{ backgroundColor: "#16A34A" }}
                >
                  {registering ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Registrando troca...</>
                  ) : registeredOilChange ? (
                    <><CheckCircle className="w-4 h-4" /> Troca Registrada no Veículo!</>
                  ) : (
                    <><Droplet className="w-4 h-4" /> Registrar Troca no Veículo</>
                  )}
                </Button>
              )}

              {/* Botão salvar no catálogo */}
              {result.source === "online" && (
                <Button
                  onClick={handleSaveToCatalog}
                  disabled={saving || saved}
                  variant="outline"
                  className="w-full gap-2 border-green-200 text-green-600 hover:bg-green-50"
                >
                  {saved ? (
                    <><CheckCircle className="w-4 h-4" /> Salvo no catálogo!</>
                  ) : (
                    <><Save className="w-4 h-4" /> Salvar no Catálogo de Óleos</>
                  )}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
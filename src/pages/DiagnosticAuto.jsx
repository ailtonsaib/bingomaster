import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { getPortalUser, clearPortalUser } from "@/lib/portalSession";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LogOut, Search, History, Wrench, Loader2 } from "lucide-react";
import VehicleDataForm from "@/components/diagnostic/VehicleDataForm";
import SymptomSelector from "@/components/diagnostic/SymptomSelector";
import DiagnosticResult from "@/components/diagnostic/DiagnosticResult";

export default function DiagnosticAuto() {
  const navigate = useNavigate();
  const user = getPortalUser();

  const [vehicle, setVehicle] = useState({ brand: "", model: "", year: "", engine: "", mileage: "", fuel: "flex" });
  const [symptoms, setSymptoms] = useState([]);
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState("");

  const { data: history = [] } = useQuery({
    queryKey: ["diagnostic-history", user?.email],
    queryFn: () => base44.entities.DiagnosticRecord.filter({ user_email: user?.email }, "-created_date", 20),
    enabled: !!user?.email,
  });

  const toggleSymptom = (symptom) => {
    setSymptoms((prev) =>
      prev.includes(symptom) ? prev.filter((s) => s !== symptom) : [...prev, symptom]
    );
  };

  const handleAnalyze = async () => {
    setError("");
    if (!vehicle.brand.trim() || !vehicle.model.trim()) {
      setError("Informe a marca e o modelo do veículo.");
      return;
    }
    if (symptoms.length === 0) {
      setError("Selecione pelo menos um sintoma.");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke("diagnosticAuto", {
        vehicle_brand: vehicle.brand,
        vehicle_model: vehicle.model,
        vehicle_year: vehicle.year,
        vehicle_engine: vehicle.engine,
        vehicle_mileage: vehicle.mileage ? Number(vehicle.mileage) : 0,
        vehicle_fuel: vehicle.fuel,
        symptoms,
        description,
      });
      setResult(res.data.result);
    } catch (err) {
      const msg = err.response?.data?.error || "Erro ao processar diagnóstico. Tente novamente.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const loadFromHistory = (record) => {
    setVehicle({
      brand: record.vehicle_brand || "",
      model: record.vehicle_model || "",
      year: record.vehicle_year || "",
      engine: record.vehicle_engine || "",
      mileage: record.vehicle_mileage || "",
      fuel: record.vehicle_fuel || "flex",
    });
    setSymptoms(record.symptoms || []);
    setDescription(record.description || "");
    setResult({
      summary: record.summary,
      urgency: record.urgency,
      possible_causes: record.possible_causes,
      general_recommendation: record.general_recommendation,
    });
    setShowHistory(false);
  };

  const handleLogout = () => {
    clearPortalUser();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-[#FAFAFB]">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-[#DBEAFE] flex items-center justify-center">
              <Wrench className="w-5 h-5 text-[#2563EB]" />
            </div>
            <div>
              <span className="font-bold text-[#1B1C21] text-sm">Diagnóstico Automotivo</span>
              {user && <span className="text-xs text-[#A1A1AA] ml-2">| {user.name}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowHistory(!showHistory)} className="text-[#52525B]">
              <History className="w-4 h-4 mr-1" /> Histórico
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-[#52525B]">
              <LogOut className="w-4 h-4" /> Sair
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {showHistory && history.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mb-6 rounded-xl border border-gray-100 bg-white p-4 shadow-sm overflow-hidden"
          >
            <h3 className="text-sm font-bold text-[#1B1C21] mb-3">Diagnósticos Anteriores</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {history.map((rec) => (
                <button
                  key={rec.id}
                  onClick={() => loadFromHistory(rec)}
                  className="w-full text-left p-3 rounded-lg border border-gray-100 hover:border-[#2563EB]/30 hover:bg-[#2563EB]/5 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-[#1B1C21]">
                      {rec.vehicle_brand} {rec.vehicle_model}
                    </span>
                    <span className="text-xs text-[#A1A1AA]">
                      {new Date(rec.created_date).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                  <p className="text-xs text-[#71717A] mt-0.5 truncate">
                    {(rec.symptoms || []).join(", ")}
                  </p>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Form column */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-gray-100 bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.04)] space-y-6"
          >
            <VehicleDataForm data={vehicle} onChange={setVehicle} />
            <SymptomSelector selected={symptoms} onToggle={toggleSymptom} />

            <div>
              <label className="text-sm font-semibold text-[#1B1C21] mb-2 block">
                Descrição adicional do problema
              </label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva em suas palavras o que está acontecendo com o veículo (quando começou, em quais situações ocorre, etc.)"
                className="min-h-[80px] resize-none"
              />
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                {error}
              </div>
            )}

            <Button
              onClick={handleAnalyze}
              disabled={loading}
              className="w-full h-11 rounded-xl text-white font-medium"
              style={{ backgroundColor: "#2563EB" }}
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analisando...</>
              ) : (
                <><Search className="w-4 h-4 mr-2" /> Diagnosticar</>
              )}
            </Button>
          </motion.div>

          {/* Result column */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-gray-100 bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.04)]"
          >
            {result || loading ? (
              <DiagnosticResult result={result} loading={loading} vehicleInfo={vehicle} />
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-[#DBEAFE] flex items-center justify-center mb-4">
                  <Search className="w-8 h-8 text-[#2563EB]" />
                </div>
                <h3 className="font-bold text-[#1B1C21] mb-1">Pronto para diagnosticar</h3>
                <p className="text-sm text-[#71717A] max-w-xs">
                  Preencha os dados do veículo, selecione os sintomas e clique em <strong>Diagnosticar</strong> para identificar as possíveis causas.
                </p>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
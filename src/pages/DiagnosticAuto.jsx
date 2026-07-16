import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { getPortalUser, clearPortalUser } from "@/lib/portalSession";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LogOut, Search, History, Wrench, Loader2, Bluetooth, ClipboardList, Users, Package, Stethoscope } from "lucide-react";
import ClientVehicleSelector from "@/components/diagnostic/ClientVehicleSelector";
import VehicleRegistrationModal from "@/components/diagnostic/VehicleRegistrationModal";
import SymptomSelector from "@/components/diagnostic/SymptomSelector";
import DiagnosticResult from "@/components/diagnostic/DiagnosticResult";
import OBD2Scanner from "@/components/diagnostic/OBD2Scanner";
import OBD2Results from "@/components/diagnostic/OBD2Results";
import DiagnosticPrintView from "@/components/diagnostic/DiagnosticPrintView";
import VehicleHistoryPanel from "@/components/diagnostic/VehicleHistoryPanel";

const DIAG_TABS = [
  { id: "diagnostic", label: "Diagnóstico IA", icon: Stethoscope },
  { id: "orders", label: "Ordens de Serviço", icon: ClipboardList, link: "/diagnostico-oficina?tab=orders" },
  { id: "mechanics", label: "Mecânicos", icon: Users, link: "/diagnostico-oficina?tab=mechanics" },
  { id: "parts", label: "Peças", icon: Package, link: "/diagnostico-oficina?tab=parts" },
];

export default function DiagnosticAuto() {
  const navigate = useNavigate();
  const user = getPortalUser();

  const [vehicle, setVehicle] = useState({ brand: "", model: "", year: "", engine: "", mileage: "", fuel: "flex" });
  const [symptoms, setSymptoms] = useState([]);
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [mode, setMode] = useState("manual"); // "manual" | "obd2"
  const [obd2Data, setObd2Data] = useState(null);
  const [printData, setPrintData] = useState(null);
  const [showRegistration, setShowRegistration] = useState(false);
  const [registrationCpf, setRegistrationCpf] = useState("");
  const [registrationClient, setRegistrationClient] = useState(null);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);

  const { data: history = [] } = useQuery({
    queryKey: ["diagnostic-history", user?.email],
    queryFn: () => base44.entities.DiagnosticRecord.filter({ user_email: user?.email }, "-created_date", 100),
    enabled: !!user?.email,
  });

  const { data: usage } = useQuery({
    queryKey: ["diagnostic-usage", user?.email],
    queryFn: async () => {
      const res = await base44.functions.invoke("manageDiagnostic", { operation: "getUsage" });
      return res.data;
    },
    enabled: !!user?.email,
  });

  const canDelete = usage?.can_delete || user?.is_admin || false;

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
    if (mode === "manual" && symptoms.length === 0) {
      setError("Selecione pelo menos um sintoma.");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const payload = {
        vehicle_brand: vehicle.brand,
        vehicle_model: vehicle.model,
        vehicle_year: vehicle.year,
        vehicle_engine: vehicle.engine,
        vehicle_plate: vehicle.plate || "",
        vehicle_mileage: vehicle.mileage ? Number(vehicle.mileage) : 0,
        vehicle_fuel: vehicle.fuel,
        symptoms: mode === "manual" ? symptoms : [],
        description,
        obd2_data: mode === "obd2" && obd2Data ? {
          dtcs: obd2Data.dtcs,
          live_data: obd2Data.liveData,
        } : undefined,
      };
      const res = await base44.functions.invoke("diagnosticAuto", payload);
      setResult(res.data.result);
    } catch (err) {
      const msg = err.response?.data?.error || "Erro ao processar diagnóstico. Tente novamente.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleScanComplete = (data) => {
    setObd2Data(data);
  };

  const handleScanError = (errMsg) => {
    setError(errMsg);
  };

  const handleRegisterNew = (cpf, client) => {
    setRegistrationCpf(cpf);
    setRegistrationClient(client);
    setShowRegistration(true);
  };

  const handleRegistered = (vehicleData) => {
    setVehicle({
      brand: vehicleData.brand || "",
      model: vehicleData.model || "",
      year: vehicleData.year || "",
      engine: vehicleData.engine || "",
      mileage: vehicleData.mileage || "",
      fuel: vehicleData.fuel || "flex",
      plate: vehicleData.plate || "",
      color: vehicleData.color || "",
      vin: vehicleData.vin || "",
      observations: vehicleData.observations || "",
    });
  };

  const handlePrint = () => {
    setPrintData({
      vehicleInfo: vehicle,
      scanData: mode === "obd2" ? obd2Data : null,
      aiResult: result,
    });
  };

  const loadFromHistory = (record) => {
    setVehicle({
      brand: record.vehicle_brand || "",
      model: record.vehicle_model || "",
      year: record.vehicle_year || "",
      engine: record.vehicle_engine || "",
      plate: record.vehicle_plate || "",
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
  };

  const handleLogout = () => {
    clearPortalUser();
    navigate("/");
  };

  if (printData) {
    return <DiagnosticPrintView data={printData} />;
  }

  if (showHistoryPanel) {
    return (
      <VehicleHistoryPanel
        records={history}
        onSelectDiagnostic={(diag) => {
          loadFromHistory(diag);
          setShowHistoryPanel(false);
        }}
        onBack={() => setShowHistoryPanel(false)}
      />
    );
  }

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
              <span className="font-bold text-[#1B1C21] text-sm">Sistema Automotivo</span>
              {user && <span className="text-xs text-[#A1A1AA] ml-2">| {user.name}</span>}
              {usage && (
                <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold ${usage.plan === 'master' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                  {usage.plan_name}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowHistoryPanel(true)} className="text-[#52525B] relative">
              <History className="w-4 h-4 mr-1" /> Histórico
              {history.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-[#2563EB] text-white text-[10px] font-bold">
                  {history.length}
                </span>
              )}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-[#52525B]">
              <LogOut className="w-4 h-4" /> Sair
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {/* Tabs — Sistema Automotivo */}
        <div className="mb-6 flex gap-1 p-1 bg-gray-100 rounded-xl w-fit overflow-x-auto">
          {DIAG_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.id === "diagnostic";
            return (
              <button
                key={tab.id}
                onClick={() => tab.link ? navigate(tab.link) : undefined}
                className={`flex items-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                  isActive ? "bg-white text-[#2563EB] shadow-sm" : "text-[#71717A] hover:text-[#52525B]"
                }`}
              >
                <Icon className="w-4 h-4" /> {tab.label}
              </button>
            );
          })}
        </div>

        {/* Mode selector */}
        <div className="mb-6 flex gap-2 p-1 bg-gray-100 rounded-xl">
          <button
            onClick={() => { setMode("manual"); setObd2Data(null); setResult(null); setError(""); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
              mode === "manual" ? "bg-white text-[#2563EB] shadow-sm" : "text-[#71717A] hover:text-[#52525B]"
            }`}
          >
            <ClipboardList className="w-4 h-4" /> Sintomas
          </button>
          <button
            onClick={() => { setMode("obd2"); setResult(null); setError(""); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
              mode === "obd2" ? "bg-white text-[#2563EB] shadow-sm" : "text-[#71717A] hover:text-[#52525B]"
            }`}
          >
            <Bluetooth className="w-4 h-4" /> Scanner OBD2
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left column — vehicle data + scan/symptoms */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-gray-100 bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.04)] space-y-6"
          >
            <ClientVehicleSelector
              userEmail={user?.email}
              onVehicleSelect={(v) => setVehicle(v)}
              onRegisterNew={handleRegisterNew}
              usage={usage}
              canDelete={canDelete}
            />
            {vehicle.brand && (
              <div className="rounded-lg bg-[#2563EB]/5 border border-[#2563EB]/20 p-3">
                <p className="text-xs text-[#71717A] mb-1">Veículo selecionado:</p>
                <p className="text-sm font-semibold text-[#1B1C21]">
                  {vehicle.brand} {vehicle.model} {vehicle.year}
                  {vehicle.plate && ` | ${vehicle.plate}`}
                </p>
              </div>
            )}

            {mode === "manual" && (
              <>
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
              </>
            )}

            {mode === "obd2" && !obd2Data && (
              <OBD2Scanner onScanComplete={handleScanComplete} onScanError={handleScanError} />
            )}

            {mode === "obd2" && obd2Data && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-[#1B1C21]">Scanner conectado ✓</span>
                  <button
                    onClick={() => { setObd2Data(null); setResult(null); }}
                    className="text-xs text-[#2563EB] hover:underline"
                  >
                    Reconectar
                  </button>
                </div>
                <div>
                  <label className="text-sm font-semibold text-[#1B1C21] mb-2 block">
                    Observações adicionais (opcional)
                  </label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Descreva sintomas que o motorista notou (quando começou, em quais situações ocorre, etc.)"
                    className="min-h-[60px] resize-none"
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                {error}
              </div>
            )}

            {!(mode === "obd2" && !obd2Data) && (
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
            )}
          </motion.div>

          {/* Right column — results */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-gray-100 bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.04)]"
          >
            {result || loading ? (
              <>
                <DiagnosticResult result={result} loading={loading} vehicleInfo={vehicle} />
                {result && !loading && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <Button
                      onClick={handlePrint}
                      variant="outline"
                      className="w-full h-10 rounded-lg font-medium border-gray-200 hover:bg-gray-50"
                    >
                      🖨️ Imprimir Diagnóstico
                    </Button>
                  </div>
                )}
              </>
            ) : mode === "obd2" && obd2Data ? (
              <OBD2Results
                scanData={obd2Data}
                vehicleInfo={vehicle}
                onSendToAI={handleAnalyze}
                onPrint={handlePrint}
                aiLoading={loading}
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-[#DBEAFE] flex items-center justify-center mb-4">
                  {mode === "obd2" ? (
                    <Bluetooth className="w-8 h-8 text-[#2563EB]" />
                  ) : (
                    <Search className="w-8 h-8 text-[#2563EB]" />
                  )}
                </div>
                <h3 className="font-bold text-[#1B1C21] mb-1">
                  {mode === "obd2" ? "Conecte o scanner OBD2" : "Pronto para diagnosticar"}
                </h3>
                <p className="text-sm text-[#71717A] max-w-xs">
                  {mode === "obd2"
                    ? "Conecte o scanner na porta OBD2 do veículo e siga os passos para iniciar a leitura."
                    : "Busque o cliente por CPF/CNPJ, selecione o veículo e descreva os sintomas."}
                </p>
              </div>
            )}
          </motion.div>
        </div>
      </div>

      {showRegistration && (
        <VehicleRegistrationModal
          open={showRegistration}
          onClose={() => setShowRegistration(false)}
          userEmail={user?.email}
          cpfCnpj={registrationCpf}
          existingClient={registrationClient}
          onRegistered={handleRegistered}
          usage={usage}
        />
      )}
    </div>
  );
}
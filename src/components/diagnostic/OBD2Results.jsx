import { AlertTriangle, CheckCircle2, Printer, Activity, Code2, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DTC_DATABASE } from "@/lib/obd2DtcDatabase";

export default function OBD2Results({ scanData, vehicleInfo, onSendToAI, onPrint, aiLoading }) {
  if (!scanData) return null;

  const { dtcs, liveData, scannedAt, hasStoredCodes } = scanData;

  return (
    <div className="space-y-5">
      {/* Scan header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#2563EB]" />
          <span className="text-sm font-bold text-[#1B1C21]">Resultado do Scanner OBD2</span>
        </div>
        <span className="text-xs text-[#A1A1AA]">
          {new Date(scannedAt).toLocaleString("pt-BR")}
        </span>
      </div>

      {/* DTCs section */}
      <div className={`rounded-xl border p-4 ${hasStoredCodes ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"}`}>
        <div className="flex items-start gap-3">
          {hasStoredCodes ? (
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <h3 className={`text-sm font-bold mb-1 ${hasStoredCodes ? "text-red-700" : "text-green-700"}`}>
              {hasStoredCodes ? `${dtcs.length} código(s) de falha encontrado(s)` : "Nenhum código de falha armazenado"}
            </h3>
            <p className="text-xs text-[#52525B]">
              {vehicleInfo.brand} {vehicleInfo.model} {vehicleInfo.year}
            </p>
          </div>
        </div>
      </div>

      {/* DTC codes list */}
      {dtcs.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Code2 className="w-4 h-4 text-[#2563EB]" />
            <h3 className="font-bold text-[#1B1C21] text-sm">Códigos de Falha (DTCs)</h3>
          </div>
          <div className="space-y-2">
            {dtcs.map((dtc, idx) => (
              <div key={idx} className="rounded-lg border border-gray-100 bg-white p-3 shadow-sm">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="text-sm font-bold text-red-700 font-mono">{dtc.code}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
                    Falha
                  </span>
                </div>
                <p className="text-sm text-[#3F3F46] leading-relaxed">{dtc.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Live data */}
      {liveData.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-[#2563EB]" />
            <h3 className="font-bold text-[#1B1C21] text-sm">Dados em Tempo Real</h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {liveData.map((data, idx) => (
              <div key={idx} className="rounded-lg border border-gray-100 bg-white p-3 shadow-sm">
                <p className="text-xs text-[#71717A] mb-0.5">{data.name}</p>
                <p className="text-lg font-bold text-[#1B1C21]">
                  {data.value}
                  <span className="text-xs font-normal text-[#A1A1AA] ml-1">{data.unit}</span>
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI analysis + print buttons */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <Button
          onClick={onSendToAI}
          disabled={aiLoading}
          className="flex-1 h-11 rounded-xl text-white font-medium"
          style={{ backgroundColor: "#2563EB" }}
        >
          {aiLoading ? (
            <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" /> Analisando com IA...</>
          ) : (
            <><Wrench className="w-4 h-4 mr-2" /> Análise IA dos Dados OBD2</>
          )}
        </Button>
        <Button
          onClick={onPrint}
          variant="outline"
          className="h-11 px-6 rounded-xl font-medium border-gray-200 hover:bg-gray-50"
        >
          <Printer className="w-4 h-4 mr-2" /> Imprimir
        </Button>
      </div>

      <p className="text-xs text-[#A1A1AA] text-center">
        ⚠️ O diagnóstico OBD2 fornece dados técnicos da ECU. A análise por IA é complementar e não substitui avaliação profissional.
      </p>
    </div>
  );
}

// Export the DTC database for the print view
export { DTC_DATABASE };
import { useEffect, useRef } from "react";
import { Wrench } from "lucide-react";

export default function DiagnosticPrintView({ data }) {
  const printRef = useRef(null);

  useEffect(() => {
    if (data && printRef.current) {
      const handleAfterPrint = () => window.history.back();
      window.addEventListener("afterprint", handleAfterPrint);
      setTimeout(() => {
        window.print();
      }, 300);
      return () => window.removeEventListener("afterprint", handleAfterPrint);
    }
  }, [data]);

  if (!data) return null;

  const { vehicleInfo, scanData, aiResult } = data;

  return (
    <div className="fixed inset-0 bg-white z-50 overflow-auto">
      <div className="no-print fixed top-4 right-4 z-10">
        <button
          onClick={() => window.history.back()}
          className="px-4 py-2 bg-gray-100 rounded-lg text-sm font-medium hover:bg-gray-200"
        >
          Fechar
        </button>
      </div>

      <div ref={printRef} id="print-area" className="max-w-[800px] mx-auto p-8 text-[#1B1C21]">
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-[#2563EB] pb-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#DBEAFE] flex items-center justify-center">
              <Wrench className="w-7 h-7 text-[#2563EB]" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Relatório de Diagnóstico Automotivo</h1>
              <p className="text-sm text-gray-500">SoftPremier — Diagnóstico OBD2</p>
            </div>
          </div>
          <div className="text-right text-sm">
            <p className="font-semibold">{new Date().toLocaleDateString("pt-BR")}</p>
            <p className="text-gray-500">{new Date().toLocaleTimeString("pt-BR")}</p>
          </div>
        </div>

        {/* Vehicle info */}
        <div className="mb-6">
          <h2 className="text-sm font-bold text-[#2563EB] mb-2 uppercase tracking-wide">Dados do Veículo</h2>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            <p><span className="text-gray-500">Marca:</span> <strong>{vehicleInfo.brand}</strong></p>
            <p><span className="text-gray-500">Modelo:</span> <strong>{vehicleInfo.model}</strong></p>
            <p><span className="text-gray-500">Ano:</span> <strong>{vehicleInfo.year || "—"}</strong></p>
            <p><span className="text-gray-500">Motor:</span> <strong>{vehicleInfo.engine || "—"}</strong></p>
            <p><span className="text-gray-500">Quilometragem:</span> <strong>{vehicleInfo.mileage ? `${Number(vehicleInfo.mileage).toLocaleString("pt-BR")} km` : "—"}</strong></p>
            <p><span className="text-gray-500">Combustível:</span> <strong>{vehicleInfo.fuel}</strong></p>
          </div>
        </div>

        {/* OBD2 scan data */}
        {scanData && (
          <div className="mb-6">
            <h2 className="text-sm font-bold text-[#2563EB] mb-2 uppercase tracking-wide">
              Leitura do Scanner OBD2
            </h2>
            <p className="text-xs text-gray-500 mb-3">
              Scanner conectado em {new Date(scanData.scannedAt).toLocaleString("pt-BR")}
            </p>

            {/* DTCs */}
            <div className="mb-4">
              <h3 className="text-sm font-semibold mb-1">
                Códigos de Falha (DTCs): {scanData.dtcs.length > 0 ? scanData.dtcs.length : "Nenhum"}
              </h3>
              {scanData.dtcs.length > 0 ? (
                <table className="w-full text-sm border border-gray-200">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-3 py-1.5 font-semibold">Código</th>
                      <th className="text-left px-3 py-1.5 font-semibold">Descrição</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scanData.dtcs.map((dtc, idx) => (
                      <tr key={idx} className="border-b border-gray-100">
                        <td className="px-3 py-1.5 font-mono font-bold text-red-700">{dtc.code}</td>
                        <td className="px-3 py-1.5">{dtc.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-green-700 font-medium">✓ Nenhum código de falha armazenado na ECU.</p>
              )}
            </div>

            {/* Live data */}
            {scanData.liveData.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-1">Dados dos Sensores</h3>
                <table className="w-full text-sm border border-gray-200">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-3 py-1.5 font-semibold">Sensor</th>
                      <th className="text-right px-3 py-1.5 font-semibold">Valor</th>
                      <th className="text-left px-3 py-1.5 font-semibold pl-6">Unidade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scanData.liveData.map((d, idx) => (
                      <tr key={idx} className="border-b border-gray-100">
                        <td className="px-3 py-1.5">{d.name}</td>
                        <td className="px-3 py-1.5 text-right font-bold">{d.value}</td>
                        <td className="px-3 py-1.5 pl-6 text-gray-500">{d.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* AI analysis */}
        {aiResult && (
          <div className="mb-6">
            <h2 className="text-sm font-bold text-[#2563EB] mb-2 uppercase tracking-wide">Análise por IA</h2>

            <div className={`rounded-lg p-3 mb-3 ${
              aiResult.urgency === "alta" ? "bg-red-50 border border-red-200" :
              aiResult.urgency === "media" ? "bg-amber-50 border border-amber-200" :
              "bg-green-50 border border-green-200"
            }`}>
              <p className="text-sm font-bold mb-1">
                Urgência: {aiResult.urgency === "alta" ? "ALTA" : aiResult.urgency === "media" ? "MÉDIA" : "BAIXA"}
              </p>
              <p className="text-sm">{aiResult.summary}</p>
            </div>

            {aiResult.possible_causes && aiResult.possible_causes.length > 0 && (
              <div className="mb-3">
                <h3 className="text-sm font-semibold mb-1">Possíveis Causas:</h3>
                <ol className="list-decimal list-inside text-sm space-y-2">
                  {aiResult.possible_causes.map((c, idx) => (
                    <li key={idx}>
                      <strong>{c.cause}</strong>
                      {c.probability && ` (probabilidade: ${c.probability})`}
                      <br />
                      <span className="text-gray-600">{c.description}</span>
                      {c.recommendation && (
                        <>
                          <br />
                          <span className="text-gray-500 italic">→ {c.recommendation}</span>
                        </>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {aiResult.general_recommendation && (
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
                <h3 className="text-sm font-semibold mb-1">Recomendação Geral:</h3>
                <p className="text-sm">{aiResult.general_recommendation}</p>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-gray-200 pt-4 mt-8">
          <p className="text-xs text-gray-400 text-center">
            ⚠️ Este relatório é gerado automaticamente e não substitui a avaliação de um mecânico profissional.
            <br />
            SoftPremier — Diagnóstico Automotivo | Gerado em {new Date().toLocaleString("pt-BR")}
          </p>
        </div>
      </div>
    </div>
  );
}
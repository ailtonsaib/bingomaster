import { AlertTriangle, CheckCircle2, Lightbulb, Loader2, TrendingUp } from "lucide-react";

const urgencyConfig = {
  alta: { label: "Alta Urgência", color: "text-red-700", bg: "bg-red-50", border: "border-red-200", icon: AlertTriangle },
  media: { label: "Média Urgência", color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200", icon: AlertTriangle },
  baixa: { label: "Baixa Urgência", color: "text-green-700", bg: "bg-green-50", border: "border-green-200", icon: CheckCircle2 },
};

const probabilityConfig = {
  alta: { label: "Alta probabilidade", color: "bg-red-100 text-red-700" },
  media: { label: "Média probabilidade", color: "bg-amber-100 text-amber-700" },
  baixa: { label: "Baixa probabilidade", color: "bg-blue-100 text-blue-700" },
};

export default function DiagnosticResult({ result, loading, vehicleInfo }) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="w-10 h-10 text-[#2563EB] animate-spin mb-4" />
        <p className="text-sm font-medium text-[#52525B]">Analisando sintomas e dados do veículo...</p>
        <p className="text-xs text-[#A1A1AA] mt-1">A IA está processando o diagnóstico</p>
      </div>
    );
  }

  if (!result) return null;

  const urgency = urgencyConfig[result.urgency] || urgencyConfig.media;
  const UrgencyIcon = urgency.icon;

  return (
    <div className="space-y-4">
      {/* Summary + Urgency */}
      <div className={`rounded-xl border ${urgency.border} ${urgency.bg} p-4`}>
        <div className="flex items-start gap-3">
          <UrgencyIcon className={`w-5 h-5 ${urgency.color} flex-shrink-0 mt-0.5`} />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-sm font-bold ${urgency.color}`}>{urgency.label}</span>
              <span className="text-xs text-[#71717A]">•</span>
              <span className="text-xs text-[#52525B]">
                {vehicleInfo.brand} {vehicleInfo.model}
                {vehicleInfo.year ? ` ${vehicleInfo.year}` : ""}
              </span>
            </div>
            <p className="text-sm text-[#3F3F46] leading-relaxed">{result.summary}</p>
          </div>
        </div>
      </div>

      {/* Possible causes */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-[#2563EB]" />
          <h3 className="font-bold text-[#1B1C21] text-sm">Possíveis Causas</h3>
        </div>
        <div className="space-y-3">
          {(result.possible_causes || []).map((cause, idx) => {
            const prob = probabilityConfig[cause.probability] || probabilityConfig.media;
            return (
              <div key={idx} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h4 className="font-semibold text-[#1B1C21] text-sm flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#2563EB]/10 text-[#2563EB] text-xs flex items-center justify-center font-bold">
                      {idx + 1}
                    </span>
                    {cause.cause}
                  </h4>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${prob.color}`}>
                    {prob.label}
                  </span>
                </div>
                <p className="text-sm text-[#52525B] leading-relaxed mb-2">{cause.description}</p>
                <div className="flex items-start gap-1.5 text-xs text-[#71717A] bg-gray-50 rounded-lg p-2">
                  <Lightbulb className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <span>{cause.recommendation}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* General recommendation */}
      {result.general_recommendation && (
        <div className="rounded-xl border border-[#2563EB]/20 bg-[#2563EB]/5 p-4">
          <div className="flex items-start gap-2">
            <Lightbulb className="w-5 h-5 text-[#2563EB] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-[#1B1C21] mb-1">Recomendação Geral</p>
              <p className="text-sm text-[#3F3F46] leading-relaxed">{result.general_recommendation}</p>
            </div>
          </div>
        </div>
      )}

      <p className="text-xs text-[#A1A1AA] text-center">
        ⚠️ Este diagnóstico é uma análise automática e não substitui a avaliação de um mecânico profissional.
      </p>
    </div>
  );
}
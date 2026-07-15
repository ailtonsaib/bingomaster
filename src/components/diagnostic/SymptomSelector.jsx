import { Stethoscope, Check } from "lucide-react";

const SYMPTOM_GROUPS = [
  {
    category: "Motor",
    icon: "🔧",
    symptoms: [
      "Motor não liga",
      "Motor falhando / engasgando",
      "Barulho no motor",
      "Perda de potência",
      "Marcha lenta instável",
      "Motor apagando sozinho",
      "Cheiro de combustível",
      "Consumo excessivo de combustível",
    ],
  },
  {
    category: "Sistema Elétrico",
    icon: "⚡",
    symptoms: [
      "Luz do motor (check engine) acesa",
      "Luz de injeção eletrônica acesa",
      "Luz do óleo acesa",
      "Luz da bateria acesa",
      "Bateria descarregando",
      "Luzes fracas / piscando",
      "Carro não dá partida (sem barulho)",
    ],
  },
  {
    category: "Freios",
    icon: "🛑",
    symptoms: [
      "Freios fazendo barulho",
      "Pedal do freio macio",
      "Luz do freio acesa",
      "Freio puxando para um lado",
      "Vibração ao frear",
      "Pedal do freio duro",
    ],
  },
  {
    category: "Transmissão & Embreagem",
    icon: "⚙️",
    symptoms: [
      "Marcha engatando com dificuldade",
      "Embreagem patinando",
      "Embreagem dura",
      "Barulho ao engatar marcha",
      "Câmbio automático trocando incorretamente",
    ],
  },
  {
    category: "Direção & Suspensão",
    icon: "🚗",
    symptoms: [
      "Direção pesada",
      "Direção fazendo barulho",
      "Suspensão barulhenta",
      "Carro puxando para um lado",
      "Vibrando em alta velocidade",
      "Direção tremendo",
    ],
  },
  {
    category: "Sistema de Refrigeração",
    icon: "🌡️",
    symptoms: [
      "Superaquecimento do motor",
      "Ar condicionado não gela",
      "Vazamento de líquido de arrefecimento",
      "Ventilador não desliga",
    ],
  },
  {
    category: "Escapamento & Emissões",
    icon: "💨",
    symptoms: [
      "Fumaça preta no escapamento",
      "Fumaça branca no escapamento",
      "Fumaça azul no escapamento",
      "Cheiro forte no escapamento",
    ],
  },
  {
    category: "Outros",
    icon: "📋",
    symptoms: [
      "Vazamento de óleo",
      "Vazamento de líquido desconhecido",
      "Cheiro de queimado",
      "Luz do ABS acesa",
      "Vidros elétricos não funcionam",
    ],
  },
];

export default function SymptomSelector({ selected, onToggle }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Stethoscope className="w-5 h-5 text-[#2563EB]" />
        <h3 className="font-bold text-[#1B1C21]">Sintomas</h3>
        <span className="text-xs text-[#71717A] ml-1">
          ({selected.length} selecionado{selected.length !== 1 ? "s" : ""})
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {SYMPTOM_GROUPS.map((group) => (
          <div key={group.category} className="rounded-xl border border-gray-100 p-3 bg-gray-50/50">
            <p className="text-sm font-semibold text-[#3F3F46] mb-2 flex items-center gap-1.5">
              <span>{group.icon}</span> {group.category}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {group.symptoms.map((symptom) => {
                const isSelected = selected.includes(symptom);
                return (
                  <button
                    key={symptom}
                    type="button"
                    onClick={() => onToggle(symptom)}
                    className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition-all ${
                      isSelected
                        ? "bg-[#2563EB] text-white shadow-sm"
                        : "bg-white text-[#52525B] border border-gray-200 hover:border-[#2563EB]/40 hover:text-[#2563EB]"
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 inline mr-0.5" />}
                    {symptom}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
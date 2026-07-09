import { motion } from "framer-motion";
import { FileText, ArrowRight, ShieldCheck } from "lucide-react";

export default function SpedAccessModal({ onClose }) {
  const handleContinue = () => {
    onClose();
    window.location.href = "/validador-sped";
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-col items-center pt-8 pb-4 px-6">
          <div className="w-16 h-16 rounded-2xl bg-[#E0F2FE] flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-[#0284C7]" />
          </div>
          <h2 className="text-xl font-bold text-[#1D1D21] text-center">Validador SPED</h2>
          <p className="text-sm text-[#6B7280] text-center mt-1">
            Validação fiscal de arquivos SPED
          </p>
        </div>

        {/* Features */}
        <div className="px-6 pb-2 space-y-2">
          {[
            "Geração de SPED Fiscal, Contribuições, ECD e ECF",
            "Importação de XMLs de NFe/NFCE",
            "Consulta de CNPJ via BrasilAPI",
            "Licenças por plano (Free, Basic, Pro, Max)",
          ].map((feature, idx) => (
            <div key={idx} className="flex items-start gap-2 text-sm text-[#4B5563]">
              <ShieldCheck className="w-4 h-4 text-[#0284C7] mt-0.5 shrink-0" />
              <span>{feature}</span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-6 pt-4 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-[#6B7280] font-medium text-sm hover:bg-[#F9FAFB] transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleContinue}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#0284C7] hover:bg-[#0369A1] text-white font-medium text-sm transition-colors"
          >
            Acessar <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </div>
  );
}
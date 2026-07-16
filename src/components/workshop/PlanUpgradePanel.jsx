import { Button } from "@/components/ui/button";
import { Lock, Trophy, Check, MessageCircle, Mail, Phone } from "lucide-react";
import { CONTACT } from "@/lib/appRegistry";

export default function PlanUpgradePanel({ used, max, currentPlanName, bronzePrice }) {
  return (
    <div className="rounded-2xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 p-6 sm:p-8">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-12 h-12 rounded-xl bg-amber-400 flex items-center justify-center flex-shrink-0">
          <Lock className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-[#1B1C21]">Limite de Ordens de Serviço atingido</h3>
          <p className="text-sm text-[#71717A]">
            Você criou {used} de {max} ordens de serviço permitidas no plano {currentPlanName}.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-amber-200 p-5 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="w-5 h-5 text-amber-500" />
          <h4 className="font-bold text-[#1B1C21]">Faça upgrade para o plano Bronze</h4>
        </div>
        <p className="text-sm text-[#52525B] mb-4">
          Com o plano Bronze você tem ordens de serviço ilimitadas e pode excluir registros livremente.
        </p>
        <div className="flex items-baseline gap-1 mb-4">
          <span className="text-3xl font-bold text-amber-600">
            {bronzePrice ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(bronzePrice) : "R$ 19,90"}
          </span>
          <span className="text-sm text-[#71717A]">/mês</span>
        </div>
        <ul className="space-y-2 mb-5">
          <li className="flex items-start gap-2 text-sm text-[#52525B]">
            <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" /> Ordens de serviço ilimitadas
          </li>
          <li className="flex items-start gap-2 text-sm text-[#52525B]">
            <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" /> Clientes e veículos ilimitados
          </li>
          <li className="flex items-start gap-2 text-sm text-[#52525B]">
            <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" /> Permite excluir registros
          </li>
          <li className="flex items-start gap-2 text-sm text-[#52525B]">
            <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" /> Diagnósticos por IA ilimitados
          </li>
        </ul>
        <div className="flex flex-wrap gap-2">
          <a href={CONTACT.whatsapp} target="_blank" rel="noreferrer">
            <Button className="bg-[#25D366] hover:bg-[#25D366]/90 text-white gap-1.5">
              <MessageCircle className="w-4 h-4" /> Adquirir via WhatsApp
            </Button>
          </a>
          <a href={`mailto:${CONTACT.email}`}>
            <Button variant="outline" className="gap-1.5">
              <Mail className="w-4 h-4" /> Email
            </Button>
          </a>
          <a href={`tel:${CONTACT.phone.replace(/\D/g, "")}`}>
            <Button variant="outline" className="gap-1.5">
              <Phone className="w-4 h-4" /> {CONTACT.phone}
            </Button>
          </a>
        </div>
      </div>

      <p className="text-xs text-[#A1A1AA] text-center">
        Após a confirmação do pagamento, seu plano será atualizado e você poderá criar novas ordens de serviço imediatamente.
      </p>
    </div>
  );
}
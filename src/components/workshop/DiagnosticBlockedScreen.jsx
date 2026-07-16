import { Button } from "@/components/ui/button";
import { Lock, AlertTriangle, MessageCircle, Mail, Phone } from "lucide-react";
import { CONTACT } from "@/lib/appRegistry";

export default function DiagnosticBlockedScreen({ message, onLogout }) {
  return (
    <div className="min-h-screen bg-[#FAFAFB] flex items-center justify-center p-6">
      <div className="max-w-lg w-full">
        <div className="bg-white rounded-3xl border border-red-100 shadow-[0_4px_24px_rgba(0,0,0,0.06)] overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-br from-red-500 to-red-600 p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-3">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-xl font-bold text-white">Sistema Bloqueado</h1>
          </div>

          {/* Body */}
          <div className="p-8 text-center">
            <div className="flex justify-center mb-4">
              <AlertTriangle className="w-10 h-10 text-red-500" />
            </div>
            <p className="text-sm text-[#52525B] leading-relaxed mb-6">
              {message || "O acesso ao sistema foi bloqueado. Entre em contato com o administrador para regularizar a mensalidade e liberar o acesso."}
            </p>

            <div className="bg-red-50 rounded-2xl border border-red-100 p-5 mb-6">
              <p className="text-sm font-semibold text-red-700 mb-3">Entre em contato para regularizar:</p>
              <div className="flex flex-wrap justify-center gap-2">
                <a href={CONTACT.whatsapp} target="_blank" rel="noreferrer">
                  <Button className="bg-[#25D366] hover:bg-[#25D366]/90 text-white gap-1.5">
                    <MessageCircle className="w-4 h-4" /> WhatsApp
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

            {onLogout && (
              <Button variant="ghost" onClick={onLogout} className="text-sm text-[#71717A]">
                Sair
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
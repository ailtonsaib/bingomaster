import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Lock, MessageCircle, Clock } from "lucide-react";
import { CONTACT } from "@/lib/appRegistry";

export default function LevelGate({ gameName, price, freeLevels, deviceCode, onRequestUnlock }) {
  const [requestSent, setRequestSent] = useState(false);

  const handleWhatsApp = async () => {
    if (onRequestUnlock) {
      await onRequestUnlock(deviceCode);
    }
    setRequestSent(true);

    const phoneMatch = CONTACT.whatsapp.match(/wa\.me\/(\d+)/);
    const phone = phoneMatch ? phoneMatch[1] : "";
    const msg = encodeURIComponent(
      `Olá! Quero desbloquear os níveis premium do jogo "${gameName}".\n\n` +
        `Código do dispositivo: ${deviceCode}\n` +
        `Valor: R$ ${Number(price).toFixed(2).replace(".", ",")}`
    );
    window.open(`https://wa.me/${phone}?text=${msg}`, "_blank");
  };

  if (requestSent) {
    return (
      <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/85 backdrop-blur-sm px-6 text-center">
        <Clock className="w-12 h-12 text-yellow-400 mb-3" />
        <h3 className="text-white font-bold text-lg mb-2">Solicitação enviada!</h3>
        <p className="text-white/60 text-sm mb-1">
          Entramos em contato via WhatsApp para confirmar o pagamento.
        </p>
        <p className="text-white/40 text-xs mb-4">
          Após a confirmação, os níveis premium serão liberados automaticamente.
        </p>
        <p className="text-white/30 text-xs">Seu código: {deviceCode}</p>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/85 backdrop-blur-sm px-6 text-center">
      <Lock className="w-12 h-12 text-purple-400 mb-3" />
      <h3 className="text-white font-bold text-lg mb-1">Nível Premium 🔒</h3>
      <p className="text-white/60 text-sm mb-4 max-w-xs">
        Você concluiu os {freeLevels} níveis gratuitos! Desbloqueie todos os níveis premium por apenas:
      </p>
      <p className="text-3xl font-bold text-yellow-400 mb-4">
        R$ {Number(price).toFixed(2).replace(".", ",")}
      </p>
      <Button
        onClick={handleWhatsApp}
        className="bg-green-500 hover:bg-green-600 text-white rounded-xl h-12 px-6 mb-3"
      >
        <MessageCircle className="w-5 h-5 mr-2" /> Liberar via WhatsApp
      </Button>
      <p className="text-white/30 text-xs">Seu código: {deviceCode}</p>
    </div>
  );
}
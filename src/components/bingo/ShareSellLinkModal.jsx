import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Copy, Check, MessageCircle, Mail, Smartphone } from "lucide-react";

export default function ShareSellLinkModal({ seller, onClose }) {
  const [copied, setCopied] = useState(false);

  const appUrl = `${window.location.origin}/sell`;
  const message = `Olá ${seller.name}! 👋\n\nAcesse o link abaixo para registrar as vendas das cartelas:\n\n${appUrl}\n\nBoas vendas! 🎉`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(appUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsApp = () => {
    const phone = seller.phone?.replace(/\D/g, "");
    const url = phone
      ? `https://wa.me/55${phone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  };

  const handleEmail = () => {
    const subject = encodeURIComponent("App de Venda de Cartelas - Bingo");
    const body = encodeURIComponent(message);
    window.open(`mailto:?subject=${subject}&body=${body}`, "_blank");
  };

  const handleSMS = () => {
    const phone = seller.phone?.replace(/\D/g, "");
    const smsUrl = phone
      ? `sms:+55${phone}?body=${encodeURIComponent(message)}`
      : `sms:?body=${encodeURIComponent(message)}`;
    window.open(smsUrl, "_blank");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-background rounded-2xl shadow-2xl w-full max-w-sm mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b">
          <div>
            <h2 className="font-bold font-heading">Enviar App para Vendedor</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{seller.name}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Link */}
          <div>
            <p className="text-xs text-muted-foreground mb-2 font-medium">Link do App de Vendas</p>
            <div className="flex gap-2">
              <Input value={appUrl} readOnly className="text-sm bg-muted" />
              <Button variant="outline" size="icon" onClick={handleCopy} className="shrink-0">
                {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            {copied && <p className="text-xs text-green-600 mt-1">Link copiado!</p>}
          </div>

          {/* Share options */}
          <div>
            <p className="text-xs text-muted-foreground mb-3 font-medium">Enviar via</p>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={handleWhatsApp}
                className="flex flex-col items-center gap-2 p-3 rounded-xl border hover:bg-green-50 hover:border-green-300 transition-all"
              >
                <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
                  <MessageCircle className="w-5 h-5 text-white" />
                </div>
                <span className="text-xs font-medium">WhatsApp</span>
              </button>

              <button
                onClick={handleSMS}
                className="flex flex-col items-center gap-2 p-3 rounded-xl border hover:bg-blue-50 hover:border-blue-300 transition-all"
              >
                <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center">
                  <Smartphone className="w-5 h-5 text-white" />
                </div>
                <span className="text-xs font-medium">SMS</span>
              </button>

              <button
                onClick={handleEmail}
                className="flex flex-col items-center gap-2 p-3 rounded-xl border hover:bg-orange-50 hover:border-orange-300 transition-all"
              >
                <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-white" />
                </div>
                <span className="text-xs font-medium">E-mail</span>
              </button>
            </div>
          </div>

          {/* Message preview */}
          <div className="bg-muted/50 rounded-xl p-3">
            <p className="text-xs text-muted-foreground font-medium mb-1">Mensagem enviada:</p>
            <p className="text-xs whitespace-pre-line text-foreground/80 leading-relaxed">{message}</p>
          </div>

          <Button variant="outline" className="w-full" onClick={onClose}>Fechar</Button>
        </div>
      </div>
    </div>
  );
}
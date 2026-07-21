import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, X, Share2, Link as LinkIcon, ShieldCheck } from "lucide-react";

export default function DelegateValidationModal({ game, onClose }) {
  const [copied, setCopied] = useState(false);
  if (!game) return null;

  const shareUrl = `${window.location.origin}/auxiliar/${game.id}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsApp = () => {
    const text = `*Validação de Cartelas - ${game.name}*\n\nAcesse o painel de validação:\n${shareUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold font-heading">Painel do Auxiliar</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="text-center">
          <Badge variant="outline" className="mb-3">{game.name}</Badge>
          <p className="text-sm text-muted-foreground">
            Compartilhe o link abaixo com seu auxiliar. Ele verá apenas as cartelas não validadas deste evento.
          </p>
        </div>

        {/* QR Code */}
        <div className="flex justify-center">
          <div className="bg-white p-3 rounded-xl border">
            <QRCodeSVG value={shareUrl} size={160} />
          </div>
        </div>

        {/* Link + Copy */}
        <div className="flex gap-2">
          <div className="flex-1 min-w-0 px-3 py-2 rounded-lg border bg-muted/40 text-xs text-muted-foreground truncate flex items-center gap-2">
            <LinkIcon className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{shareUrl}</span>
          </div>
          <Button size="sm" variant={copied ? "secondary" : "default"} onClick={handleCopy} className="gap-1.5 shrink-0">
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? "Copiado!" : "Copiar"}
          </Button>
        </div>

        {/* WhatsApp share */}
        <Button variant="outline" className="w-full gap-2" onClick={handleWhatsApp}>
          <Share2 className="w-4 h-4" /> Compartilhar via WhatsApp
        </Button>

        <div className="text-xs text-muted-foreground bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-500" />
          <span>
            Tudo online em tempo real: quando o auxiliar valida uma cartela, ela some do painel dele e aparece aqui como "Concorrendo". Se você validar por aqui, também sai do painel dele automaticamente.
          </span>
        </div>
      </div>
    </div>
  );
}
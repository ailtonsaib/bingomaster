import { X, CheckCircle2, AlertTriangle, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

function Row({ label, value, mono, small }) {
  return (
    <div className="flex justify-between gap-3 border-b py-1">
      <span className="text-gray-500 whitespace-nowrap">{label}</span>
      <span className={`font-medium text-right ${mono ? "font-mono" : ""} ${small ? "text-[10px] break-all" : ""}`}>{value || "—"}</span>
    </div>
  );
}

export default function CupomResultModal({ result, onClose, onPrint }) {
  const { saleOk, nfce } = result || {};
  const authorized = !!nfce?.authorized;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-bold flex items-center gap-2">
            {authorized ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertTriangle className="w-5 h-5 text-amber-500" />}
            {authorized ? "Cupom Fiscal Emitido" : saleOk ? "Venda Registrada" : "Falha na Venda"}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-1 text-sm">
          {authorized ? (
            <>
              <p className="text-emerald-700 font-medium mb-2">NFC-e autorizada pela SEFAZ.</p>
              <Row label="Cupom (NFC-e)" value={`${nfce.number} — série ${nfce.serie}`} />
              <Row label="Protocolo" value={nfce.protocol} mono />
              <Row label="Status" value={nfce.status} />
              <Row label="Chave de Acesso" value={nfce.key} mono small />
            </>
          ) : (
            <>
              <p className="text-amber-700 font-medium mb-2">A venda foi registrada, mas o cupom fiscal não foi autorizado.</p>
              <Row label="Status" value={nfce?.status} />
              {nfce?.number && <Row label="NFC-e gerada" value={`${nfce.number} — série ${nfce.serie}`} />}
              <p className="text-xs text-gray-500 pt-2">Você pode retransmitir na aba “Saídas”.</p>
            </>
          )}
        </div>
        <div className="p-4 border-t flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>Fechar</Button>
          {authorized && (
            <Button className="flex-1 gap-1.5 bg-teal-600 hover:bg-teal-700" onClick={onPrint}>
              <Printer className="w-4 h-4" /> Imprimir Cupom
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
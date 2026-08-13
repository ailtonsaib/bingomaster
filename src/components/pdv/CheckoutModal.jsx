import { useState } from "react";
import { X, Banknote, CreditCard, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function CheckoutModal({ total, companyConfig, onClose, onConfirm }) {
  const [method, setMethod] = useState("dinheiro");
  const [amountReceived, setAmountReceived] = useState("");
  const [loading, setLoading] = useState(false);
  const [emitNfce, setEmitNfce] = useState(true);
  const canEmit = !!(companyConfig?.cnpj && companyConfig?.ie && companyConfig?.ibge_code);

  const change = amountReceived ? Math.max(0, parseFloat(amountReceived) - total) : 0;

  const methods = [
    { id: "dinheiro", label: "Dinheiro", icon: Banknote },
    { id: "credito", label: "Crédito", icon: CreditCard },
    { id: "debito", label: "Débito", icon: CreditCard },
    { id: "pix", label: "PIX", icon: QrCode },
  ];

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm({
        payment_method: method,
        payment_amount: method === "dinheiro" ? parseFloat(amountReceived) || total : total,
        change_amount: method === "dinheiro" ? change : 0,
        emit_nfce: canEmit && emitNfce,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            {companyConfig?.logo_url && (
              <img src={companyConfig.logo_url} alt="Logo" className="max-h-8 max-w-[120px] object-contain" />
            )}
            <h2 className="text-lg font-bold">Finalizar Venda</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">
          {companyConfig?.logo_url && (
            <div className="flex justify-center mb-4">
              <img src={companyConfig.logo_url} alt="Logo" className="max-h-12 max-w-[140px] object-contain" />
            </div>
          )}
          <div className="text-center mb-6">
            <p className="text-sm text-gray-500">Total a pagar</p>
            <p className="text-4xl font-bold text-orange-600">
              R$ {total.toFixed(2).replace(".", ",")}
            </p>
          </div>
          <div className="grid grid-cols-4 gap-2 mb-4">
            {methods.map(m => {
              const Icon = m.icon;
              return (
                <button
                  key={m.id}
                  onClick={() => setMethod(m.id)}
                  className={`flex flex-col items-center p-3 rounded-lg border-2 transition-all ${
                    method === m.id
                      ? "border-orange-500 bg-orange-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <Icon className={`w-5 h-5 mb-1 ${method === m.id ? "text-orange-500" : "text-gray-400"}`} />
                  <span className="text-xs font-medium">{m.label}</span>
                </button>
              );
            })}
          </div>
          {method === "dinheiro" && (
            <div className="mb-4">
              <label className="text-sm font-medium mb-1 block">Valor recebido</label>
              <Input
                type="number"
                step="0.01"
                value={amountReceived}
                onChange={(e) => setAmountReceived(e.target.value)}
                placeholder={total.toFixed(2)}
                className="h-12 text-lg"
              />
              {change > 0 && (
                <div className="mt-2 p-3 bg-green-50 rounded-lg text-center">
                  <span className="text-sm text-green-600">Troco: </span>
                  <span className="font-bold text-green-700">
                    R$ {change.toFixed(2).replace(".", ",")}
                  </span>
                </div>
              )}
            </div>
          )}
          {method === "pix" && (
            <div className="mb-4 p-4 bg-gray-50 rounded-lg text-center">
              <QrCode className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <p className="text-sm text-gray-500">Confirma a venda para registrar o pagamento PIX.</p>
            </div>
          )}
          {(method === "credito" || method === "debito") && (
            <div className="mb-4 p-4 bg-gray-50 rounded-lg text-center">
              <p className="text-sm text-gray-500">
                {method === "credito" ? "Cartão de Crédito" : "Cartão de Débito"} — Confirme a venda após processar na maquininha.
              </p>
            </div>
          )}
        </div>
        <div className="px-6 pb-2">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={canEmit && emitNfce} disabled={!canEmit} onChange={(e) => setEmitNfce(e.target.checked)} className="w-4 h-4" />
            <span>Emitir cupom fiscal (NFC-e)</span>
          </label>
          {!canEmit && <p className="text-xs text-amber-600 mt-1">Configure CNPJ, IE e IBGE da empresa para emitir NFC-e.</p>}
        </div>
        <div className="p-4 border-t flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            className="flex-1"
            style={{ backgroundColor: "#EA580C" }}
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? "Processando..." : "Confirmar Venda"}
          </Button>
        </div>
      </div>
    </div>
  );
}
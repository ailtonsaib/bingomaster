import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Loader2, Car, CreditCard, Receipt, DollarSign } from "lucide-react";
import WorkshopPaymentModal from "./WorkshopPaymentModal";

const fmtMoney = (v) => `R$ ${parseFloat(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function WorkshopCaixaModal({ userEmail, open, onClose, onGoToFinance }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [paymentOrder, setPaymentOrder] = useState(null);

  const load = useCallback(async () => {
    if (!userEmail) return;
    setLoading(true);
    try {
      const data = await base44.entities.ServiceOrder.filter(
        { user_email: userEmail, status: "concluida" },
        "-created_date"
      );
      const pending = data.filter(
        (o) =>
          (!o.payment_status || o.payment_status === "pendente") &&
          !(o.is_return && (!o.total || o.total === 0))
      );
      setOrders(pending);
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, [userEmail]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const totalPendente = orders.reduce((s, o) => s + parseFloat(o.total || 0), 0);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
              <Receipt className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="font-bold text-gray-800">Caixa — Recebimento de Clientes</h2>
              <p className="text-xs text-gray-500">OS encerradas aguardando pagamento</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-amber-600" />
            </div>
          ) : orders.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">
              Nenhuma OS aguardando pagamento no caixa.
            </p>
          ) : (
            <>
              <div className="mb-3 p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-between">
                <span className="text-sm text-amber-700 font-medium">
                  Total a receber ({orders.length} OS)
                </span>
                <span className="text-lg font-bold text-amber-700">
                  {fmtMoney(totalPendente)}
                </span>
              </div>
              <div className="space-y-2">
                {orders.map((o) => (
                  <div
                    key={o.id}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                        <Car className="w-4 h-4 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {o.order_number} — {o.client_name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {o.vehicle_brand} {o.vehicle_model}
                          {o.vehicle_plate && ` | ${o.vehicle_plate}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-green-600">
                        {fmtMoney(o.total)}
                      </span>
                      <Button
                        size="sm"
                        onClick={() => setPaymentOrder(o)}
                        className="gap-1"
                      >
                        <CreditCard className="w-4 h-4" /> Receber
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {orders.length > 0 && onGoToFinance && (
          <div className="p-4 border-t border-gray-100">
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={onGoToFinance}
            >
              <DollarSign className="w-4 h-4" /> Ir para o Financeiro
            </Button>
          </div>
        )}
      </div>

      {paymentOrder && (
        <WorkshopPaymentModal
          order={paymentOrder}
          userEmail={userEmail}
          onClose={() => setPaymentOrder(null)}
          onConfirmed={() => {
            setPaymentOrder(null);
            load();
          }}
        />
      )}
    </div>
  );
}
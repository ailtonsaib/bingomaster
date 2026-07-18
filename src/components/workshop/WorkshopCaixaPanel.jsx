import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Receipt, Loader2, Car, CreditCard } from "lucide-react";
import WorkshopPaymentModal from "./WorkshopPaymentModal";

const fmtMoney = (v) => `R$ ${parseFloat(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function WorkshopCaixaPanel({ userEmail }) {
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
      // Filtra OS de retorno sem itens adicionais (total = 0) — não geram financeiro
      const pending = data.filter(o => (!o.payment_status || o.payment_status === "pendente") && !(o.is_return && (!o.total || o.total === 0)));
      setOrders(pending);
    } catch { /* ignore */ }
    setLoading(false);
  }, [userEmail]);

  useEffect(() => { load(); }, [load]);

  const totalPendente = orders.reduce((s, o) => s + parseFloat(o.total || 0), 0);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Receipt className="w-4 h-4 text-blue-600" />
            Caixa — OS Concluídas Aguardando Pagamento
            {orders.length > 0 && <Badge className="ml-1 bg-amber-100 text-amber-700 border-0">{orders.length}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </div>
          ) : orders.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhuma OS aguardando pagamento no caixa. Conclua uma OS para que ela apareça aqui.
            </p>
          ) : (
            <>
              <div className="mb-3 p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-between">
                <span className="text-sm text-amber-700 font-medium">Total a receber no caixa</span>
                <span className="text-lg font-bold text-amber-700">{fmtMoney(totalPendente)}</span>
              </div>
              <div className="space-y-2">
                {orders.map(o => (
                  <div key={o.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                        <Car className="w-4 h-4 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{o.order_number} — {o.client_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {o.vehicle_brand} {o.vehicle_model}
                          {o.vehicle_plate && ` | ${o.vehicle_plate}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-green-600">{fmtMoney(o.total)}</span>
                      <Button size="sm" onClick={() => setPaymentOrder(o)} className="gap-1">
                        <CreditCard className="w-4 h-4" /> Informar Pagamento
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

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
    </>
  );
}
import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Receipt, TrendingUp, DollarSign } from "lucide-react";
import { Card } from "@/components/ui/card";

export default function SalesHistory({ user }) {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadSales = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const items = await base44.entities.PDVSale.filter(
        { user_email: user.email }, "-sale_date", 200
      );
      setSales(items);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [user]);

  useEffect(() => { loadSales(); }, [loadSales]);

  const today = new Date().toDateString();
  const todaySales = sales.filter(s => s.sale_date && new Date(s.sale_date).toDateString() === today && s.status === "concluida");
  const todayTotal = todaySales.reduce((s, sale) => s + sale.total, 0);
  const completedSales = sales.filter(s => s.status === "concluida");
  const totalSales = completedSales.reduce((s, sale) => s + sale.total, 0);
  const avgTicket = completedSales.length > 0 ? totalSales / completedSales.length : 0;

  const fmtDate = (d) => d ? new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";
  const methodLabels = { dinheiro: "Dinheiro", credito: "Crédito", debito: "Débito", pix: "PIX", voucher: "Voucher" };

  return (
    <div className="p-4 h-full overflow-y-auto">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <DollarSign className="w-4 h-4" /> Vendas Hoje
          </div>
          <p className="text-2xl font-bold text-green-600">R$ {todayTotal.toFixed(2).replace(".", ",")}</p>
          <p className="text-xs text-gray-400">{todaySales.length} vendas</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <TrendingUp className="w-4 h-4" /> Total Geral
          </div>
          <p className="text-2xl font-bold text-orange-600">R$ {totalSales.toFixed(2).replace(".", ",")}</p>
          <p className="text-xs text-gray-400">{completedSales.length} vendas concluídas</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Receipt className="w-4 h-4" /> Ticket Médio
          </div>
          <p className="text-2xl font-bold text-blue-600">R$ {avgTicket.toFixed(2).replace(".", ",")}</p>
          <p className="text-xs text-gray-400">por venda</p>
        </Card>
      </div>
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-gray-300 border-t-orange-500 rounded-full animate-spin" />
        </div>
      ) : sales.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <Receipt className="w-12 h-12 mx-auto mb-2" />
          <p>Nenhuma venda registrada</p>
        </div>
      ) : (
        <div className="overflow-x-auto bg-white rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500 bg-gray-50">
                <th className="p-3">Data/Hora</th>
                <th className="p-3">Itens</th>
                <th className="p-3">Pagamento</th>
                <th className="p-3 text-right">Total</th>
                <th className="p-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {sales.map(s => (
                <tr key={s.id} className="border-b hover:bg-gray-50">
                  <td className="p-3">{fmtDate(s.sale_date)}</td>
                  <td className="p-3">{(s.items || []).length} itens</td>
                  <td className="p-3">{methodLabels[s.payment_method] || s.payment_method}</td>
                  <td className="p-3 text-right font-medium">R$ {s.total.toFixed(2).replace(".", ",")}</td>
                  <td className="p-3 text-center">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      s.status === "concluida" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    }`}>
                      {s.status === "concluida" ? "Concluída" : "Cancelada"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
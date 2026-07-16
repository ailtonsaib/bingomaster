import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, Calendar, Package, Wrench, DollarSign, TrendingUp, FileDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const formatCurrency = (v) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const formatDate = (d) => d ? new Date(d).toLocaleDateString("pt-BR") : "—";

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const STATUS_CONFIG = {
  aberta: "bg-blue-50 text-blue-600",
  em_andamento: "bg-amber-50 text-amber-600",
  aguardando_pecas: "bg-orange-50 text-orange-600",
  concluida: "bg-green-50 text-green-600",
  entregue: "bg-teal-50 text-teal-600",
  cancelada: "bg-red-50 text-red-600",
};

const STATUS_LABELS = {
  aberta: "Aberta",
  em_andamento: "Em Andamento",
  aguardando_pecas: "Aguard. Peças",
  concluida: "Concluída",
  entregue: "Entregue",
  cancelada: "Cancelada",
};

export default function MonthlyReportPanel({ userEmail }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await base44.entities.ServiceOrder.filter({ user_email: userEmail }, "-created_date");
        setOrders(data);
      } catch { /* ignore */ }
      setLoading(false);
    };
    load();
  }, [userEmail]);

  const monthOrders = useMemo(() => {
    return orders.filter(o => {
      const d = new Date(o.created_date);
      return d.getFullYear() === year && d.getMonth() === month && o.status !== "cancelada";
    });
  }, [orders, year, month]);

  const totals = useMemo(() => {
    const partsTotal = monthOrders.reduce((s, o) => s + (o.parts_total || 0), 0);
    const laborTotal = monthOrders.reduce((s, o) => s + (o.labor_total || 0), 0);
    const discountTotal = monthOrders.reduce((s, o) => s + (o.discount || 0), 0);
    const grandTotal = monthOrders.reduce((s, o) => s + (o.total || 0), 0);
    const orderCount = monthOrders.length;

    // By status
    const byStatus = {};
    for (const o of monthOrders) {
      byStatus[o.status] = (byStatus[o.status] || 0) + 1;
    }

    // By mechanic
    const byMechanic = {};
    for (const o of monthOrders) {
      const name = o.mechanic_name || "Sem mecânico";
      if (!byMechanic[name]) byMechanic[name] = { count: 0, total: 0, parts: 0, labor: 0 };
      byMechanic[name].count++;
      byMechanic[name].total += o.total || 0;
      byMechanic[name].parts += o.parts_total || 0;
      byMechanic[name].labor += o.labor_total || 0;
    }

    // Top services (from items)
    const serviceMap = {};
    for (const o of monthOrders) {
      for (const item of o.items || []) {
        if (item.type === "servico" && item.description) {
          const key = item.description;
          if (!serviceMap[key]) serviceMap[key] = { count: 0, total: 0 };
          serviceMap[key].count += Number(item.quantity) || 1;
          serviceMap[key].total += item.total || 0;
        }
      }
    }
    const topServices = Object.entries(serviceMap)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    return { partsTotal, laborTotal, discountTotal, grandTotal, orderCount, byStatus, byMechanic, topServices };
  }, [monthOrders]);

  const handlePrevMonth = () => {
    if (month === 0) { setMonth(11); setYear(year - 1); }
    else setMonth(month - 1);
  };
  const handleNextMonth = () => {
    if (month === 11) { setMonth(0); setYear(year + 1); }
    else setMonth(month + 1);
  };

  const handlePrint = () => window.print();

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between no-print">
        <div>
          <h2 className="text-lg font-bold text-[#1B1C21] flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#2563EB]" /> Relatório Mensal
          </h2>
          <p className="text-sm text-[#71717A]">Resumo de todas as ordens de serviço do mês</p>
        </div>
        <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1">
          <FileDown className="w-4 h-4" /> Imprimir
        </Button>
      </div>

      {/* Month selector */}
      <div className="flex items-center justify-center gap-4 no-print">
        <button onClick={handlePrevMonth} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <ChevronLeft className="w-5 h-5 text-[#52525B]" />
        </button>
        <span className="font-bold text-base text-[#1B1C21] min-w-[180px] text-center">
          {MONTH_NAMES[month]} {year}
        </span>
        <button
          onClick={handleNextMonth}
          disabled={year === now.getFullYear() && month === now.getMonth()}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-5 h-5 text-[#52525B]" />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-[#2563EB]" />
        </div>
      ) : monthOrders.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-gray-200 rounded-xl">
          <Calendar className="w-10 h-10 mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-[#71717A]">Nenhuma ordem de serviço em {MONTH_NAMES[month]} {year}.</p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl border border-gray-100 bg-white p-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Package className="w-4 h-4 text-blue-600" />
                </div>
                <span className="text-[10px] text-[#A1A1AA] uppercase tracking-wide">Peças</span>
              </div>
              <p className="text-lg font-bold text-[#1B1C21]">{formatCurrency(totals.partsTotal)}</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-white p-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
                  <Wrench className="w-4 h-4 text-purple-600" />
                </div>
                <span className="text-[10px] text-[#A1A1AA] uppercase tracking-wide">Serviços</span>
              </div>
              <p className="text-lg font-bold text-[#1B1C21]">{formatCurrency(totals.laborTotal)}</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-white p-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-green-600" />
                </div>
                <span className="text-[10px] text-[#A1A1AA] uppercase tracking-wide">Total Geral</span>
              </div>
              <p className="text-lg font-bold text-green-600">{formatCurrency(totals.grandTotal)}</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-white p-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-amber-600" />
                </div>
                <span className="text-[10px] text-[#A1A1AA] uppercase tracking-wide">OS Emitidas</span>
              </div>
              <p className="text-lg font-bold text-[#1B1C21]">{totals.orderCount}</p>
            </div>
          </div>

          {/* Print header */}
          <div className="hidden print:block">
            <h1 className="text-xl font-bold">Relatório Mensal — {MONTH_NAMES[month]} {year}</h1>
            <p className="text-sm text-gray-500">Total de OS: {totals.orderCount} • Total Geral: {formatCurrency(totals.grandTotal)}</p>
            <hr className="my-3" />
          </div>

          {/* By mechanic */}
          {Object.keys(totals.byMechanic).length > 0 && (
            <div className="rounded-xl border border-gray-100 bg-white overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
                <h3 className="font-bold text-sm text-[#1B1C21]">Detalhamento por Mecânico</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50/50 text-left">
                    <tr>
                      <th className="p-3 font-medium">Mecânico</th>
                      <th className="p-3 font-medium text-center">OS</th>
                      <th className="p-3 font-medium text-right">Peças</th>
                      <th className="p-3 font-medium text-right">Serviços</th>
                      <th className="p-3 font-medium text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(totals.byMechanic)
                      .sort((a, b) => b[1].total - a[1].total)
                      .map(([name, data]) => (
                        <tr key={name} className="border-t border-gray-100">
                          <td className="p-3 font-medium">{name}</td>
                          <td className="p-3 text-center">{data.count}</td>
                          <td className="p-3 text-right text-blue-600">{formatCurrency(data.parts)}</td>
                          <td className="p-3 text-right text-purple-600">{formatCurrency(data.labor)}</td>
                          <td className="p-3 text-right font-bold text-green-600">{formatCurrency(data.total)}</td>
                        </tr>
                      ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 bg-gray-50">
                      <td className="p-3 font-bold">Total</td>
                      <td className="p-3 text-center font-bold">{totals.orderCount}</td>
                      <td className="p-3 text-right font-bold text-blue-600">{formatCurrency(totals.partsTotal)}</td>
                      <td className="p-3 text-right font-bold text-purple-600">{formatCurrency(totals.laborTotal)}</td>
                      <td className="p-3 text-right font-bold text-green-600">{formatCurrency(totals.grandTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Top services */}
          {totals.topServices.length > 0 && (
            <div className="rounded-xl border border-gray-100 bg-white overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
                <h3 className="font-bold text-sm text-[#1B1C21]">Serviços Mais Realizados</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50/50 text-left">
                    <tr>
                      <th className="p-3 font-medium">Serviço</th>
                      <th className="p-3 font-medium text-center">Quantidade</th>
                      <th className="p-3 font-medium text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {totals.topServices.map((s, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="p-3 font-medium">{s.name}</td>
                        <td className="p-3 text-center">{s.count}</td>
                        <td className="p-3 text-right font-medium text-green-600">{formatCurrency(s.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Full list */}
          <div className="rounded-xl border border-gray-100 bg-white overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
              <h3 className="font-bold text-sm text-[#1B1C21]">Ordens de Serviço do Mês ({monthOrders.length})</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50/50 text-left">
                  <tr>
                    <th className="p-3 font-medium">OS</th>
                    <th className="p-3 font-medium">Cliente</th>
                    <th className="p-3 font-medium">Veículo</th>
                    <th className="p-3 font-medium">Mecânico</th>
                    <th className="p-3 font-medium">Status</th>
                    <th className="p-3 font-medium text-right">Peças</th>
                    <th className="p-3 font-medium text-right">Serviços</th>
                    <th className="p-3 font-medium text-right">Total</th>
                    <th className="p-3 font-medium">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {monthOrders.map(o => (
                    <tr key={o.id} className="border-t border-gray-100">
                      <td className="p-3 font-mono text-xs font-medium text-blue-600">{o.order_number}</td>
                      <td className="p-3 font-medium">{o.client_name}</td>
                      <td className="p-3 text-gray-500 text-xs">{o.vehicle_brand} {o.vehicle_model}</td>
                      <td className="p-3 text-gray-500 text-xs">{o.mechanic_name || "—"}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_CONFIG[o.status] || ""}`}>
                          {STATUS_LABELS[o.status] || o.status}
                        </span>
                      </td>
                      <td className="p-3 text-right text-blue-600">{formatCurrency(o.parts_total)}</td>
                      <td className="p-3 text-right text-purple-600">{formatCurrency(o.labor_total)}</td>
                      <td className="p-3 text-right font-bold text-green-600">{formatCurrency(o.total)}</td>
                      <td className="p-3 text-gray-400 text-xs">{formatDate(o.created_date)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200 bg-gray-50">
                    <td className="p-3 font-bold" colSpan={5}>Total Geral</td>
                    <td className="p-3 text-right font-bold text-blue-600">{formatCurrency(totals.partsTotal)}</td>
                    <td className="p-3 text-right font-bold text-purple-600">{formatCurrency(totals.laborTotal)}</td>
                    <td className="p-3 text-right font-bold text-green-600 text-base">{formatCurrency(totals.grandTotal)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
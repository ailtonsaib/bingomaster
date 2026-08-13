import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import {
  Loader2, Calendar, FileText, Receipt, FileCheck2, Download,
  TrendingUp, FileBarChart, ArrowLeft, ChevronLeft, ChevronRight, Printer
} from "lucide-react";
import { getPortalUser } from "@/lib/portalSession";

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MONTHS_FULL = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function fmtMoney(v) { return "R$ " + (Number(v) || 0).toFixed(2).replace(".", ","); }
function fmtDate(d) { try { return new Date(d).toLocaleDateString("pt-BR"); } catch { return d || "—"; } }

function inMonth(dateStr, year, month) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return d.getFullYear() === year && d.getMonth() === month;
}

export default function FiscalReport() {
  const navigate = useNavigate();
  const user = getPortalUser();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [loading, setLoading] = useState(true);
  const [exitOrders, setExitOrders] = useState([]);
  const [nfseList, setNfseList] = useState([]);

  useEffect(() => {
    if (!user) { navigate("/pdv"); return; }
    (async () => {
      setLoading(true);
      try {
        const [orders, nfses] = await Promise.all([
          base44.entities.PDVExitOrder.filter({ user_email: user.email }, "-order_date", 500),
          base44.entities.Nfse.filter({ user_email: user.email }, "-emission_date", 500),
        ]);
        setExitOrders(orders);
        setNfseList(nfses);
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, [user, navigate]);

  const data = useMemo(() => {
    const issued = (arr, dateField) => arr.filter(o => o.status === "emitida" && inMonth(o[dateField], year, month));

    const nfeOrders = issued(exitOrders, "nfe_issue_date").filter(o => o.nfe_model === "55");
    const nfceOrders = issued(exitOrders, "nfe_issue_date").filter(o => o.nfe_model === "65");
    const nfses = issued(nfseList, "emission_date");

    const sum = arr => arr.reduce((s, o) => s + (Number(o.total_nota) || 0), 0);

    return {
      nfe: { docs: nfeOrders, count: nfeOrders.length, total: sum(nfeOrders) },
      nfce: { docs: nfceOrders, count: nfceOrders.length, total: sum(nfceOrders) },
      nfse: { docs: nfses, count: nfses.length, total: sum(nfses) },
    };
  }, [exitOrders, nfseList, year, month]);

  if (!user) return null;

  const grandTotal = data.nfe.total + data.nfce.total + data.nfse.total;
  const totalCount = data.nfe.count + data.nfce.count + data.nfse.count;

  const cards = [
    { key: "nfe", label: "NF-e", icon: FileText, color: "blue", data: data.nfe, subtitle: "Nota Fiscal Eletrônica" },
    { key: "nfce", label: "NFC-e", icon: Receipt, color: "teal", data: data.nfce, subtitle: "Cupom Fiscal Eletrônico" },
    { key: "nfse", label: "NFS-e", icon: FileCheck2, color: "purple", data: data.nfse, subtitle: "Nota de Serviço Eletrônica" },
  ];

  const colorMap = {
    blue: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", accent: "text-blue-600", bar: "bg-blue-500" },
    teal: { bg: "bg-teal-50", border: "border-teal-200", text: "text-teal-700", accent: "text-teal-600", bar: "bg-teal-500" },
    purple: { bg: "bg-purple-50", border: "border-purple-200", text: "text-purple-700", accent: "text-purple-600", bar: "bg-purple-500" },
  };

  const changeMonth = (delta) => {
    let m = month + delta, y = year;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setMonth(m); setYear(y);
  };

  const exportCsv = () => {
    const rows = [["Tipo", "Numero", "Serie", "Emissao", "Cliente", "Valor", "Status", "Protocolo"]];
    data.nfe.docs.forEach(o => rows.push(["NF-e", o.nfe_number || "", o.nfe_series || "", fmtDate(o.nfe_issue_date), o.customer_name || "", o.total_nota?.toFixed(2), o.nfe_status || "emitida", o.nfe_protocol || ""]));
    data.nfce.docs.forEach(o => rows.push(["NFC-e", o.nfe_number || "", o.nfe_series || "", fmtDate(o.nfe_issue_date), o.customer_name || "", o.total_nota?.toFixed(2), o.nfe_status || "emitida", o.nfe_protocol || ""]));
    data.nfse.docs.forEach(o => rows.push(["NFS-e", o.nfse_number || o.rps_number || "", o.rps_series || "", fmtDate(o.emission_date), o.tomador_name || "", o.total_nota?.toFixed(2), o.nfse_status || "emitida", o.nfse_protocol || ""]));
    const csv = "\uFEFF" + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `relatorio-fiscal-${MONTHS[month]}-${year}.csv`;
    a.click();
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate("/pdv-caixa")} className="p-1 hover:bg-gray-100 rounded">
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </button>
          <FileBarChart className="w-6 h-6 text-indigo-600" />
          <div>
            <h1 className="text-xl font-bold">Relatório Fiscal Mensal</h1>
            <p className="text-xs text-gray-500">Resumo de NF-e, NFC-e e NFS-e emitidas</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1.5">
            <Download className="w-3.5 h-3.5" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1.5">
            <Printer className="w-3.5 h-3.5" /> Imprimir
          </Button>
        </div>
      </div>

      {/* Month selector */}
      <div className="flex items-center justify-center gap-4 bg-white rounded-lg border p-3">
        <Button variant="ghost" size="icon" onClick={() => changeMonth(-1)}><ChevronLeft className="w-5 h-5" /></Button>
        <div className="text-center min-w-[220px]">
          <p className="text-lg font-bold capitalize">{MONTHS_FULL[month]} de {year}</p>
          <p className="text-xs text-gray-400">Período do relatório</p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => changeMonth(1)}><ChevronRight className="w-5 h-5" /></Button>
        {(month !== now.getMonth() || year !== now.getFullYear()) && (
          <Button variant="outline" size="sm" onClick={() => { setMonth(now.getMonth()); setYear(now.getFullYear()); }}>
            Mês atual
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>
      ) : (
        <>
          {/* Grand total banner */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-5 text-white">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <TrendingUp className="w-8 h-8 opacity-90" />
                <div>
                  <p className="text-sm opacity-90">Total consolidado do mês</p>
                  <p className="text-3xl font-bold">{fmtMoney(grandTotal)}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm opacity-90">Documentos emitidos</p>
                <p className="text-3xl font-bold">{totalCount}</p>
              </div>
            </div>
          </div>

          {/* Cards by model */}
          <div className="grid md:grid-cols-3 gap-4">
            {cards.map(card => {
              const c = colorMap[card.color];
              const pct = totalCount > 0 ? (card.data.count / totalCount) * 100 : 0;
              const Icon = card.icon;
              return (
                <div key={card.key} className={`${c.bg} ${c.border} border rounded-xl p-4`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Icon className={`w-5 h-5 ${c.accent}`} />
                      <div>
                        <p className="font-bold text-sm">{card.label}</p>
                        <p className="text-[10px] text-gray-500">{card.subtitle}</p>
                      </div>
                    </div>
                  </div>
                  <p className={`text-2xl font-bold ${c.text}`}>{fmtMoney(card.data.total)}</p>
                  <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                    <span>{card.data.count} documento(s)</span>
                    <span>{pct.toFixed(0)}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div className={`h-full ${c.bar} transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Detailed tables */}
          <div className="space-y-4">
            {cards.map(card => {
              const Icon = card.icon;
              const c = colorMap[card.color];
              if (card.data.docs.length === 0) return null;
              return (
                <div key={card.key} className="bg-white rounded-lg border overflow-hidden">
                  <div className="flex items-center gap-2 p-3 border-b bg-gray-50">
                    <Icon className={`w-4 h-4 ${c.accent}`} />
                    <h3 className="font-semibold text-sm">{card.label} — {card.data.count} documento(s)</h3>
                    <span className="ml-auto text-sm font-bold text-gray-700">{fmtMoney(card.data.total)}</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-100 text-gray-500">
                        <tr>
                          <th className="p-2 text-left">Número</th>
                          <th className="p-2 text-left">Emissão</th>
                          <th className="p-2 text-left">{card.key === "nfse" ? "Tomador" : "Cliente"}</th>
                          <th className="p-2 text-right">Valor</th>
                          <th className="p-2 text-left">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {card.data.docs.map(doc => (
                          <tr key={doc.id} className="border-t hover:bg-gray-50">
                            <td className="p-2 font-mono">
                              {card.key === "nfse" ? (doc.nfse_number || doc.rps_number || "—") : (doc.nfe_number || "—")}
                              {card.key === "nfse" ? doc.rps_series && `/${doc.rps_series}` : doc.nfe_series && `/${doc.nfe_series}`}
                            </td>
                            <td className="p-2">{fmtDate(card.key === "nfse" ? doc.emission_date : doc.nfe_issue_date)}</td>
                            <td className="p-2">{card.key === "nfse" ? (doc.tomador_name || "—") : (doc.customer_name || "—")}</td>
                            <td className="p-2 text-right font-medium">{fmtMoney(doc.total_nota)}</td>
                            <td className="p-2">
                              {card.key === "nfse"
                                ? (doc.nfse_status || (doc.status === "emitida" ? "Autorizada" : doc.status))
                                : (doc.nfe_status || "Emitida")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}

            {totalCount === 0 && (
              <div className="text-center py-12 text-gray-400">
                <Calendar className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p>Nenhuma nota fiscal emitida em {MONTHS_FULL[month]} de {year}</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, FileBarChart, Scale, Percent, TrendingUp, Download } from "lucide-react";

const num = (v) => Number(v) || 0;
const fmtBRL = (v) => num(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR");
};

export default function TaxReportPanel({ user }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [periodFilter, setPeriodFilter] = useState("all"); // all, month, quarter

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const list = await base44.entities.PDVExitOrder.filter({
          user_email: user.email,
          status: { $ne: "cancelada" },
        });
        setOrders(list);
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, [user.email]);

  const filteredOrders = useMemo(() => {
    if (periodFilter === "all") return orders;
    const now = new Date();
    return orders.filter(o => {
      const d = new Date(o.order_date || o.nfe_issue_date || o.created_date);
      if (periodFilter === "month") {
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }
      if (periodFilter === "quarter") {
        const q = Math.floor(now.getMonth() / 3);
        const dq = Math.floor(d.getMonth() / 3);
        return dq === q && d.getFullYear() === now.getFullYear();
      }
      return true;
    });
  }, [orders, periodFilter]);

  const data = useMemo(() => {
    let totalProdutos = 0;
    let totalNotas = 0;
    let totalIcms = 0;
    let totalIpi = 0;
    let totalPis = 0;
    let totalCofins = 0;

    // Lei 13.097 (monofásico)
    let monoPis = 0;
    let monoCofins = 0;
    let monoIpi = 0;
    let monoProdutos = 0;

    // Demais impostos (não monofásico)
    let regularPis = 0;
    let regularCofins = 0;
    let regularIpi = 0;
    let regularProdutos = 0;

    const porCategoria = {}; // category -> { produtos, pis, cofins, ipi, icms }
    const porNcm = {};

    for (const order of filteredOrders) {
      totalNotas += num(order.total_nota);
      totalIcms += num(order.total_icms);
      totalIpi += num(order.total_ipi);
      totalPis += num(order.total_pis);
      totalCofins += num(order.total_cofins);
      totalProdutos += num(order.total_products);

      const items = order.items || [];
      for (const item of items) {
        const isMono = item.monofasic === true;
        const cat = item.product_category || (isMono ? "outro" : "regular");
        const ncm = item.ncm || "—";
        const valProd = num(item.total);
        const pis = num(item.pis_value);
        const cofins = num(item.cofins_value);
        const ipi = num(item.ipi_value);
        const icms = num(item.icms_value);

        if (isMono) {
          monoPis += pis;
          monoCofins += cofins;
          monoIpi += ipi;
          monoProdutos += valProd;
        } else {
          regularPis += pis;
          regularCofins += cofins;
          regularIpi += ipi;
          regularProdutos += valProd;
        }

        if (!porCategoria[cat]) porCategoria[cat] = { produtos: 0, pis: 0, cofins: 0, ipi: 0, icms: 0 };
        porCategoria[cat].produtos += valProd;
        porCategoria[cat].pis += pis;
        porCategoria[cat].cofins += cofins;
        porCategoria[cat].ipi += ipi;
        porCategoria[cat].icms += icms;

        if (!porNcm[ncm]) porNcm[ncm] = { produtos: 0, pis: 0, cofins: 0, ipi: 0, icms: 0, monofasic: isMono };
        porNcm[ncm].produtos += valProd;
        porNcm[ncm].pis += pis;
        porNcm[ncm].cofins += cofins;
        porNcm[ncm].ipi += ipi;
        porNcm[ncm].icms += icms;
      }
    }

    const monoTotal = monoPis + monoCofins + monoIpi;
    const regularTotal = regularPis + regularCofins + regularIpi + totalIcms;
    const totalImpostos = totalIcms + totalIpi + totalPis + totalCofins;

    return {
      totalProdutos, totalNotas, totalIcms, totalIpi, totalPis, totalCofins, totalImpostos,
      mono: { pis: monoPis, cofins: monoCofins, ipi: monoIpi, produtos: monoProdutos, total: monoTotal },
      regular: { pis: regularPis, cofins: regularCofins, ipi: regularIpi, produtos: regularProdutos, total: regularTotal },
      porCategoria, porNcm,
    };
  }, [filteredOrders]);

  const catLabels = {
    combustivel: "Combustível",
    bebida_fria: "Bebida Fria",
    medicamento: "Medicamento",
    cosmetico: "Cosmético",
    autopeca: "Autopeça",
    cigarro: "Cigarro",
    outro: "Outro",
    regular: "Regular",
  };

  const exportCSV = () => {
    const rows = [
      ["Categoria", "NCM", "Monofásico", "Produtos", "ICMS", "IPI", "PIS", "COFINS"],
    ];
    for (const [ncm, v] of Object.entries(data.porNcm)) {
      rows.push([
        catLabels[v.monofasic ? Object.keys(data.porCategoria).find(k => k !== "regular") || "outro" : "regular"] || "Regular",
        ncm,
        v.monofasic ? "Sim" : "Não",
        v.produtos.toFixed(2),
        v.icms.toFixed(2),
        v.ipi.toFixed(2),
        v.pis.toFixed(2),
        v.cofins.toFixed(2),
      ]);
    }
    const csv = rows.map(r => r.join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio_tributario_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <FileBarChart className="w-5 h-5 text-orange-600" />
          <h2 className="text-lg font-bold">Relatório Tributário</h2>
          <span className="text-sm text-gray-500">({filteredOrders.length} notas)</span>
        </div>
        <div className="flex gap-2">
          <select
            value={periodFilter}
            onChange={e => setPeriodFilter(e.target.value)}
            className="flex h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          >
            <option value="all">Todo o período</option>
            <option value="month">Mês atual</option>
            <option value="quarter">Trimestre atual</option>
          </select>
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 h-9 px-3 rounded-md bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium"
          >
            <Download className="w-4 h-4" /> CSV
          </button>
        </div>
      </div>

      {filteredOrders.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <FileBarChart className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p>Nenhuma nota fiscal emitida no período</p>
        </div>
      ) : (
        <>
          {/* Resumo geral */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SummaryCard icon={TrendingUp} color="blue" label="Total de Produtos" value={fmtBRL(data.totalProdutos)} />
            <SummaryCard icon={FileBarChart} color="orange" label="Total das Notas" value={fmtBRL(data.totalNotas)} />
            <SummaryCard icon={Percent} color="green" label="Total de Impostos" value={fmtBRL(data.totalImpostos)} />
            <SummaryCard
              icon={Percent}
              color="red"
              label="Carga Tributária %"
              value={data.totalProdutos > 0 ? ((data.totalImpostos / data.totalProdutos) * 100).toFixed(2) + "%" : "0%"}
            />
          </div>

          {/* Separação Lei 13.097 vs Demais */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Lei 13.097 */}
            <div className="bg-white rounded-lg border p-4">
              <div className="flex items-center gap-2 mb-3">
                <Scale className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-sm">Lei 13.097/2015 (Monofásico)</h3>
              </div>
              <div className="space-y-2 text-sm">
                <Row label="Produtos Monofásicos" value={fmtBRL(data.mono.produtos)} />
                <Row label="PIS" value={fmtBRL(data.mono.pis)} muted />
                <Row label="COFINS" value={fmtBRL(data.mono.cofins)} muted />
                <Row label="IPI" value={fmtBRL(data.mono.ipi)} muted />
                <div className="border-t pt-2 flex justify-between font-bold">
                  <span>Subtotal</span>
                  <span className="text-indigo-600">{fmtBRL(data.mono.total)}</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  CST 04/06/07 — alíquota zero na revenda. Pago pelo fabricante/importador.
                </p>
              </div>
            </div>

            {/* Demais Impostos */}
            <div className="bg-white rounded-lg border p-4">
              <div className="flex items-center gap-2 mb-3">
                <Percent className="w-5 h-5 text-green-600" />
                <h3 className="font-bold text-sm">Demais Impostos (Bifásico/Regular)</h3>
              </div>
              <div className="space-y-2 text-sm">
                <Row label="Produtos Regulares" value={fmtBRL(data.regular.produtos)} />
                <Row label="ICMS" value={fmtBRL(data.totalIcms)} muted />
                <Row label="PIS" value={fmtBRL(data.regular.pis)} muted />
                <Row label="COFINS" value={fmtBRL(data.regular.cofins)} muted />
                <Row label="IPI" value={fmtBRL(data.regular.ipi)} muted />
                <div className="border-t pt-2 flex justify-between font-bold">
                  <span>Subtotal</span>
                  <span className="text-green-600">{fmtBRL(data.regular.total)}</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Tributação normal por operação (ICMS + PIS/COFINS/IPI não monofásicos).
                </p>
              </div>
            </div>
          </div>

          {/* Por categoria */}
          <div className="bg-white rounded-lg border overflow-hidden">
            <div className="p-3 border-b bg-gray-50">
              <h3 className="font-bold text-sm">Impostos por Categoria</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="p-2 text-left">Categoria</th>
                    <th className="p-2 text-right">Produtos</th>
                    <th className="p-2 text-right">ICMS</th>
                    <th className="p-2 text-right">IPI</th>
                    <th className="p-2 text-right">PIS</th>
                    <th className="p-2 text-right">COFINS</th>
                    <th className="p-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(data.porCategoria)
                    .sort(([,a],[,b]) => (b.produtos) - (a.produtos))
                    .map(([cat, v]) => {
                      const total = v.icms + v.ipi + v.pis + v.cofins;
                      const isMono = cat !== "regular";
                      return (
                        <tr key={cat} className="border-b hover:bg-gray-50">
                          <td className="p-2">
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${isMono ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-600"}`}>
                              {catLabels[cat] || cat}
                            </span>
                          </td>
                          <td className="p-2 text-right">{fmtBRL(v.produtos)}</td>
                          <td className="p-2 text-right">{fmtBRL(v.icms)}</td>
                          <td className="p-2 text-right">{fmtBRL(v.ipi)}</td>
                          <td className="p-2 text-right">{fmtBRL(v.pis)}</td>
                          <td className="p-2 text-right">{fmtBRL(v.cofins)}</td>
                          <td className="p-2 text-right font-medium">{fmtBRL(total)}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Por NCM */}
          <div className="bg-white rounded-lg border overflow-hidden">
            <div className="p-3 border-b bg-gray-50">
              <h3 className="font-bold text-sm">Detalhamento por NCM</h3>
            </div>
            <div className="overflow-x-auto max-h-80">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b sticky top-0">
                  <tr>
                    <th className="p-2 text-left">NCM</th>
                    <th className="p-2 text-center">Regime</th>
                    <th className="p-2 text-right">Produtos</th>
                    <th className="p-2 text-right">ICMS</th>
                    <th className="p-2 text-right">PIS</th>
                    <th className="p-2 text-right">COFINS</th>
                    <th className="p-2 text-right">IPI</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(data.porNcm)
                    .sort(([,a],[,b]) => (b.produtos) - (a.produtos))
                    .map(([ncm, v]) => (
                      <tr key={ncm} className="border-b hover:bg-gray-50">
                        <td className="p-2 font-mono">{ncm}</td>
                        <td className="p-2 text-center">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${v.monofasic ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-600"}`}>
                            {v.monofasic ? "Monofásico" : "Regular"}
                          </span>
                        </td>
                        <td className="p-2 text-right">{fmtBRL(v.produtos)}</td>
                        <td className="p-2 text-right">{fmtBRL(v.icms)}</td>
                        <td className="p-2 text-right">{fmtBRL(v.pis)}</td>
                        <td className="p-2 text-right">{fmtBRL(v.cofins)}</td>
                        <td className="p-2 text-right">{fmtBRL(v.ipi)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({ icon: Icon, color, label, value }) {
  const colors = {
    blue: "bg-blue-50 text-blue-600",
    orange: "bg-orange-50 text-orange-600",
    green: "bg-green-50 text-green-600",
    red: "bg-red-50 text-red-600",
  };
  return (
    <div className="bg-white rounded-lg border p-3 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colors[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="font-bold text-sm">{value}</p>
      </div>
    </div>
  );
}

function Row({ label, value, muted }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-600">{label}</span>
      <span className={muted ? "text-gray-500" : "font-medium"}>{value}</span>
    </div>
  );
}
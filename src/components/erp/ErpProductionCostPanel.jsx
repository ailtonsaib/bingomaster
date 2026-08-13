import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Factory, Boxes, Hammer, Wrench, Coins } from "lucide-react";
import { fmtMoney } from "@/lib/erpUtils";

export default function ErpProductionCostPanel({ user }) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [orders, products, accounts, journals] = await Promise.all([
          base44.entities.ErpProductionOrder.filter({ user_email: user.email }, "emission_date", 500),
          base44.entities.ErpProduct.filter({ user_email: user.email }, "name", 1000),
          base44.entities.ErpChartAccount.filter({ user_email: user.email }, "code", 1000),
          base44.entities.ErpJournalEntry.filter({ user_email: user.email }, "date", 500),
        ]);

        // Produtos por id (para custo de insumo)
        const prodMap = {};
        products.forEach(p => { prodMap[p.id] = p; });

        // Contas que participam do custo, por id → tipo (mao_de_obra / ggf / insumos)
        const costAccountType = {};
        accounts.filter(a => a.participates_production_cost && a.production_cost_type)
          .forEach(a => { costAccountType[a.id] = a.production_cost_type; });

        // Despesas lançadas no contábil por tipo (débitos das contas marcadas)
        const expensesByType = { insumos: 0, mao_de_obra: 0, ggf: 0 };
        (journals || []).forEach(j => {
          if (j.status !== "definitivo") return;
          if (!(j.date || "").startsWith(String(year))) return;
          (j.lines || []).forEach(l => {
            const t = costAccountType[l.account_id];
            if (t) expensesByType[t] += Number(l.debit) || 0;
          });
        });

        // Ordens de produção do ano com quantidade produzida
        const yearOrders = (orders || []).filter(o => {
          const d = o.start_date || o.emission_date || o.completion_date || "";
          return d.startsWith(String(year)) && (Number(o.produced_quantity) || 0) > 0;
        });

        const totalProduced = yearOrders.reduce((s, o) => s + (Number(o.produced_quantity) || 0), 0);

        // Mão de obra e GGF rateados por quantidade produzida
        const rows = yearOrders.map(o => {
          const qtd = Number(o.produced_quantity) || 0;
          const insumos = (o.bom_items || []).reduce((s, it) => {
            const prod = prodMap[it.product_id];
            const cost = prod ? (Number(prod.cost_price) || 0) : 0;
            const consumed = Number(it.total_consumed) || (Number(it.quantity_per_unit) || 0) * qtd;
            return s + consumed * cost;
          }, 0);
          const share = totalProduced > 0 ? qtd / totalProduced : 0;
          const maoObra = expensesByType.mao_de_obra * share;
          const ggf = expensesByType.ggf * share;
          const total = insumos + maoObra + ggf;
          const unit = qtd > 0 ? total / qtd : 0;
          return {
            id: o.id, number: o.order_number, product: o.output_product_name || "—",
            qtd, insumos, maoObra, ggf, total, unit,
          };
        });

        const totInsumos = rows.reduce((s, r) => s + r.insumos, 0);
        const totMaoObra = rows.reduce((s, r) => s + r.maoObra, 0);
        const totGGF = rows.reduce((s, r) => s + r.ggf, 0);
        const totGeral = totInsumos + totMaoObra + totGGF;

        setData({ rows, expensesByType, totInsumos, totMaoObra, totGGF, totGeral, totalProduced, hasCostAccounts: Object.keys(costAccountType).length > 0 });
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, [user.email, year]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Factory className="w-5 h-5 text-amber-600" />
          <h2 className="font-semibold">Custo de Produção</h2>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500">Exercício</label>
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="border rounded-md px-2 py-1 text-sm bg-white">
            {[currentYear, currentYear - 1, currentYear + 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-gray-400">Calculando custos de produção...</div>
      ) : !data ? (
        <div className="p-8 text-center text-gray-400">Não foi possível carregar os dados.</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card icon={Boxes} label="Insumos (BOM × custo)" value={data.totInsumos} color="text-blue-600" bg="bg-blue-50" />
            <Card icon={Hammer} label="Mão de Obra (contábil)" value={data.totMaoObra} color="text-amber-600" bg="bg-amber-50" />
            <Card icon={Wrench} label="GGF (contábil)" value={data.totGGF} color="text-purple-600" bg="bg-purple-50" />
            <Card icon={Coins} label="Custo Total de Produção" value={data.totGeral} color="text-emerald-600" bg="bg-emerald-50" />
          </div>

          {!data.hasCostAccounts && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg p-3">
              Nenhuma conta do plano de contas está marcada como participante do custo de produção. Marque as contas (Mão de Obra / GGF) no Plano de Contas para ratear as despesas contábeis.
            </div>
          )}

          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="px-3 py-2">Ordem</th>
                    <th className="px-3 py-2">Produto</th>
                    <th className="px-3 py-2 text-right">Qtd. Produzida</th>
                    <th className="px-3 py-2 text-right">Insumos</th>
                    <th className="px-3 py-2 text-right">Mão de Obra</th>
                    <th className="px-3 py-2 text-right">GGF</th>
                    <th className="px-3 py-2 text-right">Custo Total</th>
                    <th className="px-3 py-2 text-right">Custo Unit.</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.length === 0 ? (
                    <tr><td colSpan={8} className="px-3 py-6 text-center text-gray-400">Nenhuma ordem de produção concluída em {year}.</td></tr>
                  ) : data.rows.map(r => (
                    <tr key={r.id} className="border-t hover:bg-muted/30">
                      <td className="px-3 py-2">{r.number || "—"}</td>
                      <td className="px-3 py-2">{r.product}</td>
                      <td className="px-3 py-2 text-right">{r.qtd}</td>
                      <td className="px-3 py-2 text-right text-blue-600">{fmtMoney(r.insumos)}</td>
                      <td className="px-3 py-2 text-right text-amber-600">{fmtMoney(r.maoObra)}</td>
                      <td className="px-3 py-2 text-right text-purple-600">{fmtMoney(r.ggf)}</td>
                      <td className="px-3 py-2 text-right font-semibold">{fmtMoney(r.total)}</td>
                      <td className="px-3 py-2 text-right font-semibold text-emerald-600">{fmtMoney(r.unit)}</td>
                    </tr>
                  ))}
                </tbody>
                {data.rows.length > 0 && (
                  <tfoot className="bg-muted/50 font-semibold border-t">
                    <tr>
                      <td className="px-3 py-2" colSpan={3}>Totais ({data.rows.length} ordens)</td>
                      <td className="px-3 py-2 text-right text-blue-600">{fmtMoney(data.totInsumos)}</td>
                      <td className="px-3 py-2 text-right text-amber-600">{fmtMoney(data.totMaoObra)}</td>
                      <td className="px-3 py-2 text-right text-purple-600">{fmtMoney(data.totGGF)}</td>
                      <td className="px-3 py-2 text-right">{fmtMoney(data.totGeral)}</td>
                      <td className="px-3 py-2 text-right text-emerald-600">{data.totalProduced > 0 ? fmtMoney(data.totGeral / data.totalProduced) : "—"}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
          <p className="text-xs text-gray-400">
            Insumos = estrutura (BOM) da ordem × custo do produto. Mão de Obra e GGF = débitos lançados no contábil das contas marcadas como participante do custo, rateados proporcionalmente à quantidade produzida no exercício.
          </p>
        </>
      )}
    </div>
  );
}

function Card({ icon: Icon, label, value, color, bg }) {
  return (
    <div className={`rounded-xl border p-3 ${bg}`}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs text-gray-600">{label}</p>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <p className={`text-xl font-bold ${color}`}>{fmtMoney(value)}</p>
    </div>
  );
}
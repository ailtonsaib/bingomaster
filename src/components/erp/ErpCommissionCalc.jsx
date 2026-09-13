import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Calculator, Loader2, BadgeCheck } from "lucide-react";
import { fmtMoney } from "@/lib/erpUtils";
import { BASIS_OPTS } from "./ErpCommissionRuleForm";

// Carrega todas as páginas de uma entidade (limite de 500 por requisição)
async function fetchAll(entity, user, maxPages = 10) {
  const list = [];
  for (let skip = 0; skip < maxPages * 500; skip += 500) {
    const page = await base44.entities[entity].filter({ user_email: user.email }, "-created_date", 500, skip);
    list.push(...page);
    if (page.length < 500) break;
  }
  return list;
}

// Faixa aplicável pelo atingimento: ordena os limites e usa a última faixa acima do topo
function pickTier(levels, attainmentPct) {
  const sorted = [...(levels || [])].sort((a, b) => a.limit_pct - b.limit_pct);
  if (!sorted.length) return null;
  return sorted.find(l => attainmentPct <= l.limit_pct) || sorted[sorted.length - 1];
}

// Apuração de comissões por período — calcula por vendedor e gera os pagamentos pendentes
export default function ErpCommissionCalc({ user, onGenerated }) {
  const [rules, setRules] = useState([]);
  const [ruleId, setRuleId] = useState("");
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [rows, setRows] = useState(null);
  const [calculating, setCalculating] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    base44.entities.ErpCommissionRule.filter({ user_email: user.email }, "-created_date", 500)
      .then(list => {
        setRules(list);
        if (list.length && !ruleId) setRuleId(list[0].id);
      })
      .catch(() => setRules([]));
  }, [user.email]);

  const rule = rules.find(r => r.id === ruleId);

  const handleCalculate = async () => {
    if (!rule) { alert("Cadastre e selecione uma regra de comissão."); return; }
    if (!/^\d{4}-\d{2}$/.test(period)) { alert("Informe o período (YYYY-MM)."); return; }
    setCalculating(true); setMsg(""); setRows(null);
    try {
      const [team, customers, orders, goals] = await Promise.all([
        fetchAll("ErpSalesTeam", user),
        fetchAll("ErpCustomer", user),
        fetchAll("ErpSalesOrder", user),
        fetchAll("ErpSalesGoal", user),
      ]);
      const [year, month] = period.split("-").map(Number);
      const custById = new Map(customers.map(c => [c.id, c]));
      const custNameToSeller = new Map();
      customers.forEach(c => { if (c.vendedor_id && c.name && !custNameToSeller.has(c.name)) custNameToSeller.set(c.name, c.vendedor_id); });

      // Vendas do período por vendedor (pedidos não cancelados emitidos no período)
      const periodOrders = orders.filter(o => (o.emission_date || "").startsWith(period) && o.status !== "cancelado");
      const salesBySeller = new Map(); // id -> { value, volume }
      for (const o of periodOrders) {
        const sellerId = custById.get(o.customer_id)?.vendedor_id;
        if (!sellerId) continue;
        const cur = salesBySeller.get(sellerId) || { value: 0, volume: 0 };
        cur.value += Number(o.total) || 0;
        cur.volume += (o.items || []).reduce((s, it) => s + (Number(it.quantity) || 0), 0);
        salesBySeller.set(sellerId, cur);
      }

      // Vendas pagas no período: recebimentos baixados no período, casando o cliente pelo nome
      let paidBySeller = new Map();
      if (rule.basis === "vendas_pagas") {
        const receivables = await fetchAll("ErpReceivable", user);
        receivables
          .filter(r => r.status === "recebido" && (r.receipt_date || "").startsWith(period))
          .forEach(r => {
            const sellerId = custNameToSeller.get(r.customer_name);
            if (!sellerId) return;
            const cur = paidBySeller.get(sellerId) || 0;
            paidBySeller.set(sellerId, cur + (Number(r.settled_value) || Number(r.amount) || 0));
          });
      }

      const calcRows = [];
      for (const s of team.filter(t => t.is_active !== false)) {
        const sales = salesBySeller.get(s.id) || { value: 0, volume: 0 };
        const paid = paidBySeller.get(s.id) || 0;
        const isVolume = rule.basis === "volume";
        // meta do vendedor no período: meta do mês ou (anual ÷ 12)
        const wantedType = isVolume ? "volume" : "valor";
        const monthlyGoal = goals.find(g => g.owner_id === s.id && g.level === "vendedor" && g.goal_type === wantedType && g.year === year && g.month === month && g.status !== "cancelada");
        const annualGoal = goals.find(g => g.owner_id === s.id && g.level === "vendedor" && g.goal_type === wantedType && g.year === year && (!g.month || g.month === 0) && g.status !== "cancelada");
        const goalValue = monthlyGoal ? Number(monthlyGoal.target_value) || 0 : (annualGoal ? (Number(annualGoal.target_value) || 0) / 12 : 0);

        const basisMeasure = isVolume ? sales.volume : (rule.basis === "vendas_pagas" ? paid : sales.value);
        const basisValue = rule.basis === "vendas_pagas" ? paid : sales.value; // comissão sempre sobre valor (R$)
        if (!basisMeasure && !basisValue && !goalValue) continue;

        const attainment = goalValue > 0 ? (basisMeasure / goalValue) * 100 : 0;
        const tier = pickTier(rule.levels, attainment);
        const commissionPct = tier ? Number(tier.commission_pct) || 0 : 0;
        calcRows.push({
          seller_id: s.id, seller_name: s.name,
          basis_value: Math.round(basisValue * 100) / 100,
          basis_volume: Math.round(sales.volume * 100) / 100,
          goal_value: Math.round(goalValue * 100) / 100,
          attainment_pct: Math.round(attainment * 100) / 100,
          commission_pct: commissionPct,
          tier_limit_pct: tier ? Number(tier.limit_pct) || 0 : 0,
          commission_value: Math.round(basisValue * commissionPct / 100 * 100) / 100,
        });
      }
      setRows(calcRows.sort((a, b) => b.commission_value - a.commission_value));
      if (!calcRows.length) setMsg("Nenhum vendedor com vendas ou meta no período.");
    } catch (e) { setMsg("Erro ao calcular: " + e.message); }
    setCalculating(false);
  };

  const handleGenerate = async () => {
    if (!rows?.length || !rule) return;
    if (!confirm(`Gerar ${rows.length} pagamento(s) de comissão da regra "${rule.name}" para o período ${period}? Os pagamentos já existentes desta regra/período serão substituídos.`)) return;
    setGenerating(true);
    try {
      await base44.entities.ErpCommissionPayment.deleteMany({ rule_id: rule.id, period, user_email: user.email });
      await base44.entities.ErpCommissionPayment.bulkCreate(rows.map(r => ({
        user_email: user.email,
        rule_id: rule.id, rule_name: rule.name,
        seller_id: r.seller_id, seller_name: r.seller_name,
        period,
        basis_value: r.basis_value, basis_volume: r.basis_volume, goal_value: r.goal_value,
        attainment_pct: r.attainment_pct, commission_pct: r.commission_pct,
        tier_limit_pct: r.tier_limit_pct, commission_value: r.commission_value,
        status: "pendente",
      })));
      setMsg("Pagamentos de comissão gerados com status pendente.");
      onGenerated?.();
    } catch (e) { alert(e.message); }
    setGenerating(false);
  };

  const totalCommission = (rows || []).reduce((s, r) => s + (Number(r.commission_value) || 0), 0);

  return (
    <div className="space-y-3">
      <h2 className="font-semibold text-base">Apuração de Comissão</h2>

      <div className="flex items-center gap-2 flex-wrap bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-sm">
        <select value={ruleId} onChange={e => setRuleId(e.target.value)} className="h-8 rounded-md border border-input bg-white px-2 text-xs">
          <option value="">Selecione a regra...</option>
          {rules.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <input type="month" value={period} onChange={e => setPeriod(e.target.value)} className="h-8 rounded-md border border-input bg-white px-2 text-xs" />
        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 gap-1.5" onClick={handleCalculate} disabled={calculating}>
          {calculating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />} Calcular
        </Button>
        {rule && <span className="text-xs text-emerald-800">{BASIS_OPTS.find(o => o.value === rule.basis)?.label}</span>}
      </div>

      {msg && <p className="text-xs text-gray-500">{msg}</p>}

      {rows && (
        <>
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 text-gray-500 text-xs">
                  <tr>
                    <th className="p-2 text-left">Vendedor</th>
                    <th className="p-2 text-right">Base (R$)</th>
                    <th className="p-2 text-right">Volume</th>
                    <th className="p-2 text-right">Meta</th>
                    <th className="p-2 text-right">Atingimento</th>
                    <th className="p-2 text-right">Faixa</th>
                    <th className="p-2 text-right">Comissão (%)</th>
                    <th className="p-2 text-right">Valor Comissão</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr><td colSpan={8} className="p-8 text-center text-gray-400">Nenhum vendedor apurado no período.</td></tr>
                  ) : rows.map(r => (
                    <tr key={r.seller_id} className="border-t hover:bg-gray-50">
                      <td className="p-2 font-medium">{r.seller_name}</td>
                      <td className="p-2 text-right">{fmtMoney(r.basis_value)}</td>
                      <td className="p-2 text-right">{r.basis_volume ? r.basis_volume.toLocaleString("pt-BR") : "—"}</td>
                      <td className="p-2 text-right">{r.goal_value ? fmtMoney(r.goal_value) : "—"}</td>
                      <td className="p-2 text-right">{r.goal_value ? `${r.attainment_pct.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%` : "—"}</td>
                      <td className="p-2 text-right">{r.tier_limit_pct ? `até ${r.tier_limit_pct}%` : "—"}</td>
                      <td className="p-2 text-right">{r.commission_pct.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%</td>
                      <td className="p-2 text-right font-semibold text-emerald-700">{fmtMoney(r.commission_value)}</td>
                    </tr>
                  ))}
                </tbody>
                {rows.length > 0 && (
                  <tfoot className="border-t bg-gray-50 text-sm">
                    <tr>
                      <td className="p-2 font-semibold">Total</td>
                      <td colSpan={6}></td>
                      <td className="p-2 text-right font-bold text-emerald-700">{fmtMoney(totalCommission)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          <div className="flex justify-end">
            <Button size="sm" className="bg-amber-600 hover:bg-amber-700 gap-1.5" onClick={handleGenerate} disabled={generating || !rows.length}>
              {generating ? "Gerando..." : <><BadgeCheck className="w-4 h-4" /> Gerar Pagamentos</>}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
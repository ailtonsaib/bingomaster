import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Search, Trash2, CheckCircle2 } from "lucide-react";
import { fmtMoney, fmtDate } from "@/lib/erpUtils";

const ROLE_LABEL = { vendedor: "Vendedor", supervisor: "Supervisor", gerente: "Gerente" };

const fmtPeriod = (p) => {
  if (!p || !/^\d{4}-\d{2}$/.test(p)) return p || "—";
  const [y, m] = p.split("-");
  return `${m}/${y}`;
};

// Pagamentos de comissão gerados — baixa (marcar como pago) e exclusão
export default function ErpCommissionPayments({ user, refreshKey }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [busyId, setBusyId] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const list = await base44.entities.ErpCommissionPayment.filter({ user_email: user.email }, "-created_date", 500);
      setItems(list);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [user.email, refreshKey]);

  const filtered = items.filter(it => {
    if (statusFilter && it.status !== statusFilter) return false;
    const t = `${it.seller_name || ""} ${it.rule_name || ""} ${it.period || ""}`.toLowerCase();
    return t.includes(search.toLowerCase());
  });

  const markPaid = async (it) => {
    if (!confirm(`Marcar a comissão de ${it.seller_name} (${fmtPeriod(it.period)}) como paga?`)) return;
    setBusyId(it.id);
    try {
      await base44.entities.ErpCommissionPayment.update(it.id, {
        status: "pago",
        payment_date: new Date().toISOString(),
      });
      load();
    } catch (e) { alert(e.message); }
    setBusyId("");
  };

  const handleDelete = async (it) => {
    if (!confirm(`Excluir a comissão de ${it.seller_name} (${fmtPeriod(it.period)})?`)) return;
    await base44.entities.ErpCommissionPayment.delete(it.id);
    load();
  };

  const totalPending = filtered.filter(i => i.status === "pendente").reduce((s, i) => s + (Number(i.commission_value) || 0), 0);
  const totalPaid = filtered.filter(i => i.status === "pago").reduce((s, i) => s + (Number(i.commission_value) || 0), 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="font-semibold text-base mr-auto">Pagamentos de Comissão</h2>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="h-8 rounded-md border border-input bg-white px-2 text-xs">
          <option value="">Todos os status</option>
          <option value="pendente">Pendente</option>
          <option value="pago">Pago</option>
        </select>
        <div className="relative w-56">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className="w-full h-8 rounded-md border border-input bg-transparent pl-9 pr-3 text-xs" />
        </div>
      </div>

      <div className="flex gap-2 text-xs">
        <span className="bg-amber-50 text-amber-800 border border-amber-200 rounded-full px-3 py-1">Pendente: {fmtMoney(totalPending)}</span>
        <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full px-3 py-1">Pago: {fmtMoney(totalPaid)}</span>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-gray-500 text-xs">
              <tr>
                <th className="p-2 text-left">Nome</th>
                <th className="p-2 text-left">Função</th>
                <th className="p-2 text-left">Período</th>
                <th className="p-2 text-left">Regra</th>
                <th className="p-2 text-right">Base (R$)</th>
                <th className="p-2 text-right">Meta</th>
                <th className="p-2 text-right">Atingimento</th>
                <th className="p-2 text-right">Comissão (%)</th>
                <th className="p-2 text-right">Valor</th>
                <th className="p-2 text-left">Status</th>
                <th className="p-2 text-left">Pago em</th>
                <th className="p-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={12} className="p-6 text-center text-gray-400">Carregando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={12} className="p-8 text-center text-gray-400">Nenhum pagamento de comissão.</td></tr>
              ) : filtered.map(it => (
                <tr key={it.id} className="border-t hover:bg-gray-50">
                  <td className="p-2 font-medium">{it.seller_name}</td>
                  <td className="p-2 text-xs">{ROLE_LABEL[it.seller_role] || it.seller_role || "—"}</td>
                  <td className="p-2">{fmtPeriod(it.period)}</td>
                  <td className="p-2 text-gray-600">{it.rule_name}</td>
                  <td className="p-2 text-right">{fmtMoney(it.basis_value)}</td>
                  <td className="p-2 text-right">{it.goal_value ? fmtMoney(it.goal_value) : "—"}</td>
                  <td className="p-2 text-right">{it.goal_value ? `${(Number(it.attainment_pct) || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%` : "—"}</td>
                  <td className="p-2 text-right">{(Number(it.commission_pct) || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%</td>
                  <td className="p-2 text-right font-semibold text-emerald-700">{fmtMoney(it.commission_value)}</td>
                  <td className="p-2">
                    {it.status === "pago"
                      ? <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">Pago</span>
                      : <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">Pendente</span>}
                  </td>
                  <td className="p-2 text-xs text-gray-600">{it.payment_date ? fmtDate(it.payment_date) : "—"}</td>
                  <td className="p-2 text-right whitespace-nowrap">
                    {it.status === "pendente" && (
                      <button onClick={() => markPaid(it)} disabled={busyId === it.id} title="Marcar como pago"
                        className="p-1 hover:bg-emerald-50 rounded disabled:opacity-50"><CheckCircle2 className="w-4 h-4 text-emerald-600" /></button>
                    )}
                    <button onClick={() => handleDelete(it)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
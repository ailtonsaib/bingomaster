import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { CreditCard, Banknote, Landmark, ArrowLeftRight, BarChart3 } from "lucide-react";
import { fmtMoney } from "@/lib/erpUtils";

export default function ErpFinanceReports({ user }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [pay, rec, cash, banks] = await Promise.all([
          base44.entities.ErpPayable.filter({ user_email: user.email }, "due_date", 500),
          base44.entities.ErpReceivable.filter({ user_email: user.email }, "due_date", 500),
          base44.entities.ErpCashMove.filter({ user_email: user.email }, "date", 500),
          base44.entities.ErpBankAccount.filter({ user_email: user.email }, "bank", 100),
        ]);
        const now = new Date();
        const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        const pagarAberto = pay.filter(p => p.status === "aberto").reduce((s, p) => s + (Number(p.amount) || 0), 0);
        const receberAberto = rec.filter(r => r.status === "aberto").reduce((s, r) => s + (Number(r.amount) || 0), 0);
        const saldoBancario = banks.reduce((s, b) => s + (Number(b.balance) || 0), 0);
        const vencidosPagar = pay.filter(p => p.status === "aberto" && p.due_date && new Date(p.due_date) < now).reduce((s, p) => s + (Number(p.amount) || 0), 0);
        const vencidosReceber = rec.filter(r => r.status === "aberto" && r.due_date && new Date(r.due_date) < now).reduce((s, r) => s + (Number(r.amount) || 0), 0);
        const mesCash = cash.filter(c => (c.date || "").startsWith(ym));
        const entradas = mesCash.filter(c => c.type === "entrada").reduce((s, c) => s + (Number(c.amount) || 0), 0);
        const saidas = mesCash.filter(c => c.type === "saida").reduce((s, c) => s + (Number(c.amount) || 0), 0);
        setData({ pagarAberto, receberAberto, saldoBancario, vencidosPagar, vencidosReceber, entradas, saidas, fluxoMes: entradas - saidas, totalBancos: banks.length });
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, [user.email]);

  if (loading) return <div className="p-8 text-center text-gray-400">Carregando relatórios...</div>;
  if (!data) return <div className="p-8 text-center text-gray-400">Não foi possível carregar os dados.</div>;

  const cards = [
    { label: "Contas a Pagar (aberto)", value: data.pagarAberto, icon: CreditCard, color: "text-red-600", bg: "bg-red-50" },
    { label: "Contas a Receber (aberto)", value: data.receberAberto, icon: Banknote, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Saldo Bancário Total", value: data.saldoBancario, icon: Landmark, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Fluxo de Caixa do Mês", value: data.fluxoMes, icon: ArrowLeftRight, color: data.fluxoMes >= 0 ? "text-emerald-600" : "text-red-600", bg: "bg-amber-50" },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map((c, i) => (
          <div key={i} className="bg-white rounded-xl border p-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-gray-500">{c.label}</p>
              <c.icon className={`w-4 h-4 ${c.color}`} />
            </div>
            <p className={`text-xl font-bold ${c.color}`}>{fmtMoney(c.value)}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-2 mb-2"><BarChart3 className="w-4 h-4 text-red-600" /><h3 className="font-semibold text-sm">Contas a Pagar</h3></div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Em aberto</span><span>{fmtMoney(data.pagarAberto)}</span></div>
            <div className="flex justify-between text-red-600"><span>Vencidas</span><span>{fmtMoney(data.vencidosPagar)}</span></div>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-2 mb-2"><BarChart3 className="w-4 h-4 text-emerald-600" /><h3 className="font-semibold text-sm">Contas a Receber</h3></div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Em aberto</span><span>{fmtMoney(data.receberAberto)}</span></div>
            <div className="flex justify-between text-emerald-600"><span>Vencidas</span><span>{fmtMoney(data.vencidosReceber)}</span></div>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4 md:col-span-2">
          <div className="flex items-center gap-2 mb-2"><ArrowLeftRight className="w-4 h-4 text-blue-600" /><h3 className="font-semibold text-sm">Movimentações do Mês (Caixa e Banco)</h3></div>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div><p className="text-xs text-gray-500">Entradas</p><p className="font-bold text-emerald-600">{fmtMoney(data.entradas)}</p></div>
            <div><p className="text-xs text-gray-500">Saídas</p><p className="font-bold text-red-600">{fmtMoney(data.saidas)}</p></div>
            <div><p className="text-xs text-gray-500">Saldo do mês</p><p className={`font-bold ${data.fluxoMes >= 0 ? "text-emerald-600" : "text-red-600"}`}>{fmtMoney(data.fluxoMes)}</p></div>
          </div>
        </div>
      </div>
    </div>
  );
}
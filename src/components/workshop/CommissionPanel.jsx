import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, Loader2, DollarSign, CheckCircle2, Receipt, Calendar, Printer, Building2, Wrench } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import CommissionReceipt from "./CommissionReceipt";
import CompanyConfigModal from "./CompanyConfigModal";

const formatCurrency = (v) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const formatDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR");
};

export default function CommissionPanel({ userEmail }) {
  const { toast } = useToast();
  const today = new Date().toISOString().slice(0, 10);
  const firstDay = new Date();
  firstDay.setDate(1);
  const firstDayStr = firstDay.toISOString().slice(0, 10);

  const [startDate, setStartDate] = useState(firstDayStr);
  const [endDate, setEndDate] = useState(today);
  const [selectedMechanic, setSelectedMechanic] = useState("");
  const [partsCommissionRate, setPartsCommissionRate] = useState("");
  const [loading, setLoading] = useState(false);
  const [paying, setPaying] = useState(null);
  const [mechanics, setMechanics] = useState([]);
  const [orders, setOrders] = useState([]);
  const [payments, setPayments] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [receiptPayment, setReceiptPayment] = useState(null);
  const [showCompanyConfig, setShowCompanyConfig] = useState(false);

  useEffect(() => {
    const load = async () => {
      const mechs = await base44.entities.DiagnosticMechanic.filter({ user_email: userEmail, is_active: true });
      setMechanics(mechs);
    };
    load();
  }, [userEmail]);

  const handleSearch = async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    setHasSearched(true);
    try {
      const [allOrders, pays] = await Promise.all([
        base44.entities.ServiceOrder.filter({ user_email: userEmail }),
        base44.entities.DiagnosticCommissionPayment.filter({ user_email: userEmail }),
      ]);

      const start = new Date(startDate + "T00:00:00");
      const end = new Date(endDate + "T23:59:59");

      const filtered = allOrders.filter(o => {
        const statusOk = o.status === "concluida" || o.status === "entregue";
        if (!statusOk) return false;
        if (selectedMechanic && o.mechanic_id !== selectedMechanic) return false;
        const ref = o.completion_date || o.delivery_date || o.start_date;
        if (!ref) return false;
        const d = new Date(ref);
        return d >= start && d <= end;
      });

      setOrders(filtered);
      setPayments(pays);
    } catch {
      toast({ title: "Erro", description: "Não foi possível carregar as comissões.", variant: "destructive" });
    }
    setLoading(false);
  };

  // Agrupa OS por mecânico
  const byMechanic = {};
  orders.forEach(o => {
    const mid = o.mechanic_id || "_sem_mecanico";
    if (!byMechanic[mid]) {
      const mech = mechanics.find(m => m.id === mid);
      byMechanic[mid] = {
        mechanic_id: mid,
        mechanic_name: o.mechanic_name || mech?.name || "Sem mecânico",
        commission_rate: mech?.commission_rate || 0,
        order_ids: [],
        total_labor: 0,
        total_parts: 0,
        orders: [],
      };
    }
    byMechanic[mid].order_ids.push(o.id);
    byMechanic[mid].total_labor += o.labor_total || 0;
    byMechanic[mid].total_parts += o.parts_total || 0;
    byMechanic[mid].orders.push(o);
  });

  const partsRate = Number(partsCommissionRate) || 0;

  const rows = Object.values(byMechanic).map(r => {
    const laborCommission = (r.total_labor * (r.commission_rate || 0)) / 100;
    const partsCommission = (r.total_parts * partsRate) / 100;
    const commission_amount = laborCommission + partsCommission;
    const alreadyPaid = isMechanicPaid(r.mechanic_id);
    return { ...r, partsRate, commission_amount, alreadyPaid };
  });

  // Verifica se um mecânico já recebeu pagamento para o período exato
  function isMechanicPaid(mechanicId) {
    return payments.some(p =>
      p.mechanic_id === mechanicId &&
      p.period_start === startDate + "T00:00:00" &&
      p.period_end === endDate + "T23:59:59"
    );
  }

  // Lista pagamentos já feitos para o período
  const periodPayments = payments.filter(p =>
    p.period_start === startDate + "T00:00:00" &&
    p.period_end === endDate + "T23:59:59"
  );

  const handlePay = async (row) => {
    setPaying(row.mechanic_id);
    try {
      await base44.entities.DiagnosticCommissionPayment.create({
        user_email: userEmail,
        mechanic_id: row.mechanic_id,
        mechanic_name: row.mechanic_name,
        period_start: startDate + "T00:00:00",
        period_end: endDate + "T23:59:59",
        total_labor: row.total_labor,
        total_parts: row.total_parts,
        commission_rate: row.commission_rate,
        parts_commission_rate: partsRate,
        commission_amount: row.commission_amount,
        order_count: row.order_ids.length,
        order_ids: row.order_ids,
        paid_date: new Date().toISOString(),
        status: "pago",
      });
      toast({ title: "Comissão paga", description: `${row.mechanic_name}: ${formatCurrency(row.commission_amount)}` });
      // Recarrega pagamentos
      const pays = await base44.entities.DiagnosticCommissionPayment.filter({ user_email: userEmail });
      setPayments(pays);
      // Abre recibo automaticamente
      setReceiptPayment({
        ...row,
        period_start: startDate + "T00:00:00",
        period_end: endDate + "T23:59:59",
        paid_date: new Date().toISOString(),
      });
    } catch {
      toast({ title: "Erro", description: "Não foi possível registrar o pagamento.", variant: "destructive" });
    }
    setPaying(null);
  };

  const grandTotalLabor = rows.reduce((s, r) => s + r.total_labor, 0);
  const grandTotalParts = rows.reduce((s, r) => s + r.total_parts, 0);
  const grandTotalCommission = rows.reduce((s, r) => s + r.commission_amount, 0);

  return (
    <div className="space-y-5">
      {/* Botão de cadastro de empresa */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => setShowCompanyConfig(true)}
        >
          <Building2 className="w-4 h-4" /> Dados da Empresa
        </Button>
      </div>

      {/* Filtros de data + mecânico */}
      <div className="flex flex-col sm:flex-row gap-3 items-end flex-wrap">
        <div className="flex-1 min-w-[140px]">
          <Label className="text-sm font-semibold flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" /> Data Início
          </Label>
          <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-10 mt-1" />
        </div>
        <div className="flex-1 min-w-[140px]">
          <Label className="text-sm font-semibold flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" /> Data Fim
          </Label>
          <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-10 mt-1" />
        </div>
        <div className="flex-1 min-w-[160px]">
          <Label className="text-sm font-semibold flex items-center gap-1.5">
            <Wrench className="w-3.5 h-3.5" /> Mecânico
          </Label>
          <select
            value={selectedMechanic}
            onChange={e => setSelectedMechanic(e.target.value)}
            className="h-10 mt-1 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">Todos os mecânicos</option>
            {mechanics.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
        <div className="w-full sm:w-32">
          <Label className="text-sm font-semibold">% sobre Peças</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={partsCommissionRate}
            onChange={e => setPartsCommissionRate(e.target.value)}
            placeholder="Opcional"
            className="h-10 mt-1"
          />
        </div>
        <Button onClick={handleSearch} disabled={loading} className="h-10 gap-1.5 text-white" style={{ backgroundColor: "#2563EB" }}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Calcular Comissões
        </Button>
      </div>

      {/* Resumo */}
      {hasSearched && !loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
            <p className="text-xs text-blue-600 font-medium">OS no Período</p>
            <p className="text-2xl font-bold text-blue-700 mt-1">{orders.length}</p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <p className="text-xs text-gray-500 font-medium">Total Mão de Obra</p>
            <p className="text-2xl font-bold text-gray-800 mt-1">{formatCurrency(grandTotalLabor)}</p>
          </div>
          <div className="rounded-xl border border-orange-100 bg-orange-50 p-4">
            <p className="text-xs text-orange-600 font-medium">Total Peças</p>
            <p className="text-2xl font-bold text-orange-700 mt-1">{formatCurrency(grandTotalParts)}</p>
          </div>
          <div className="rounded-xl border border-green-100 bg-green-50 p-4">
            <p className="text-xs text-green-600 font-medium">Total Comissões</p>
            <p className="text-2xl font-bold text-green-700 mt-1">{formatCurrency(grandTotalCommission)}</p>
          </div>
        </div>
      )}

      {/* Tabela de comissões por mecânico */}
      {hasSearched && !loading && rows.length === 0 && (
        <div className="text-center py-12 text-gray-400 border border-dashed border-gray-200 rounded-lg">
          <DollarSign className="w-10 h-10 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">Nenhuma OS concluída no período selecionado.</p>
        </div>
      )}

      {hasSearched && !loading && rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-100">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="p-3 font-medium">Mecânico</th>
                <th className="p-3 font-medium text-center">OS</th>
                <th className="p-3 font-medium text-right">Mão de Obra</th>
                <th className="p-3 font-medium text-right">Peças</th>
                <th className="p-3 font-medium text-center">M.O. %</th>
                {partsRate > 0 && <th className="p-3 font-medium text-center">Peças %</th>}
                <th className="p-3 font-medium text-right">Valor Comissão</th>
                <th className="p-3 font-medium text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.mechanic_id} className="border-t border-gray-100 hover:bg-gray-50/50">
                  <td className="p-3">
                    <div className="flex flex-col">
                      <span className="font-medium">{row.mechanic_name}</span>
                      <span className="text-xs text-gray-400">
                        {row.orders.slice(0, 3).map(o => o.order_number).join(", ")}
                        {row.orders.length > 3 && ` +${row.orders.length - 3}`}
                      </span>
                    </div>
                  </td>
                  <td className="p-3 text-center">{row.order_ids.length}</td>
                  <td className="p-3 text-right font-medium">{formatCurrency(row.total_labor)}</td>
                  <td className="p-3 text-right font-medium text-orange-600">{formatCurrency(row.total_parts)}</td>
                  <td className="p-3 text-center">{row.commission_rate}%</td>
                  {partsRate > 0 && <td className="p-3 text-center">{partsRate}%</td>}
                  <td className="p-3 text-right font-bold text-green-600">{formatCurrency(row.commission_amount)}</td>
                  <td className="p-3 text-center">
                    {row.alreadyPaid ? (
                      <div className="flex items-center gap-2 justify-center">
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-green-50 text-green-600 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Pago
                        </span>
                        {(() => {
                          const pay = payments.find(p =>
                            p.mechanic_id === row.mechanic_id &&
                            p.period_start === startDate + "T00:00:00" &&
                            p.period_end === endDate + "T23:59:59"
                          );
                          return pay ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 h-7 px-2"
                              onClick={() => setReceiptPayment(pay)}
                            >
                              <Receipt className="w-3.5 h-3.5" />
                            </Button>
                          ) : null;
                        })()}
                      </div>
                    ) : (
                      <Button
                        onClick={() => handlePay(row)}
                        disabled={paying === row.mechanic_id || row.mechanic_id === "_sem_mecanico"}
                        size="sm"
                        className="gap-1 text-white"
                        style={{ backgroundColor: "#16A34A" }}
                      >
                        {paying === row.mechanic_id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <DollarSign className="w-3.5 h-3.5" />}
                        Pagar
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagamentos realizados no período */}
      {hasSearched && !loading && periodPayments.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Receipt className="w-4 h-4 text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-700">Pagamentos realizados neste período ({periodPayments.length})</h3>
          </div>
          <div className="space-y-2">
            {periodPayments.map(p => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border border-green-100 bg-green-50/50 px-4 py-2.5">
                <div>
                  <p className="text-sm font-medium">{p.mechanic_name}</p>
                  <p className="text-xs text-gray-400">
                    {p.order_count} OS • {p.commission_rate}% • Pago em {formatDate(p.paid_date)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-green-600">{formatCurrency(p.commission_amount)}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1 h-8"
                    onClick={() => setReceiptPayment(p)}
                  >
                    <Receipt className="w-3.5 h-3.5" /> Recibo
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal de Recibo */}
      <CommissionReceipt
        payment={receiptPayment}
        orders={orders}
        userEmail={userEmail}
        onClose={() => setReceiptPayment(null)}
      />

      {/* Modal de Cadastro de Empresa */}
      <CompanyConfigModal
        userEmail={userEmail}
        open={showCompanyConfig}
        onClose={() => setShowCompanyConfig(false)}
      />
    </div>
  );
}
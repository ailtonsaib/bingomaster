import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, Printer, Wrench, Calendar, DollarSign, User, FileText } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const fmtMoney = (v) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—");

export default function CommissionReport({ userEmail }) {
  const { toast } = useToast();
  const today = new Date().toISOString().slice(0, 10);
  const firstDay = new Date();
  firstDay.setDate(1);
  const firstDayStr = firstDay.toISOString().slice(0, 10);

  const [startDate, setStartDate] = useState(firstDayStr);
  const [endDate, setEndDate] = useState(today);
  const [mechanicFilter, setMechanicFilter] = useState("all");
  const [partsRate, setPartsRate] = useState(0);
  const [mechanics, setMechanics] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [printing, setPrinting] = useState(false);

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
      const allOrders = await base44.entities.ServiceOrder.filter({ user_email: userEmail });
      const start = new Date(startDate + "T00:00:00");
      const end = new Date(endDate + "T23:59:59");

      const filtered = allOrders.filter(o => {
        // Só OS encerradas (concluída ou entregue)
        const statusOk = o.status === "concluida" || o.status === "entregue";
        if (!statusOk) return false;
        if (mechanicFilter !== "all" && o.mechanic_id !== mechanicFilter) return false;
        // Usa exclusivamente a data de conclusão ou entrega — OS não encerrada no período não entra
        const ref = o.completion_date || o.delivery_date;
        if (!ref) return false;
        const d = new Date(ref);
        return d >= start && d <= end;
      });

      setOrders(filtered);
    } catch {
      toast({ title: "Erro", description: "Não foi possível carregar as comissões.", variant: "destructive" });
    }
    setLoading(false);
  };

  // Agrupa OS por mecânico e calcula comissão por OS
  const reportData = useMemo(() => {
    const byMechanic = {};
    orders.forEach(o => {
      const mid = o.mechanic_id || "_sem_mecanico";
      const mech = mechanics.find(m => m.id === mid);
      const laborRate = mech?.commission_rate || 0;
      const pRate = Number(partsRate) || 0;

      const laborValue = o.labor_total || 0;
      const partsValue = o.parts_total || 0;
      const osTotal = laborValue + partsValue;
      const laborCommission = (laborValue * laborRate) / 100;
      const partsCommission = (partsValue * pRate) / 100;
      const osCommission = laborCommission + partsCommission;

      if (!byMechanic[mid]) {
        byMechanic[mid] = {
          mechanic_id: mid,
          mechanic_name: o.mechanic_name || mech?.name || "Sem mecânico",
          commission_rate: laborRate,
          parts_rate: pRate,
          orders: [],
          total_labor: 0,
          total_parts: 0,
          total_os_value: 0,
          total_commission: 0,
        };
      }

      byMechanic[mid].orders.push({
        ...o,
        _labor_value: laborValue,
        _parts_value: partsValue,
        _os_total: osTotal,
        _labor_commission: laborCommission,
        _parts_commission: partsCommission,
        _os_commission: osCommission,
      });
      byMechanic[mid].total_labor += laborValue;
      byMechanic[mid].total_parts += partsValue;
      byMechanic[mid].total_os_value += osTotal;
      byMechanic[mid].total_commission += osCommission;
    });

    return Object.values(byMechanic).sort((a, b) => a.mechanic_name.localeCompare(b.mechanic_name));
  }, [orders, mechanics, partsRate]);

  const grandTotalOS = reportData.reduce((s, r) => s + r.total_os_value, 0);
  const grandTotalCommission = reportData.reduce((s, r) => s + r.total_commission, 0);
  const grandTotalLabor = reportData.reduce((s, r) => s + r.total_labor, 0);
  const grandTotalParts = reportData.reduce((s, r) => s + r.total_parts, 0);
  const totalOS = reportData.reduce((s, r) => s + r.orders.length, 0);

  const handlePrint = () => {
    setPrinting(true);
    setTimeout(() => {
      window.print();
      setPrinting(false);
    }, 300);
  };

  return (
    <Card id="print-area">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-green-600" />
          Relatório de Pagamento de Comissões
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filtros */}
        <div className="no-print flex flex-col sm:flex-row gap-3 items-end flex-wrap">
          <div className="flex-1 min-w-[140px]">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Data Inicial
            </Label>
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-9 mt-1" />
          </div>
          <div className="flex-1 min-w-[140px]">
            <Label className="text-xs text-muted-foreground">Data Final</Label>
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-9 mt-1" />
          </div>
          <div className="flex-1 min-w-[180px]">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <User className="w-3 h-3" /> Mecânico
            </Label>
            <select
              value={mechanicFilter}
              onChange={e => setMechanicFilter(e.target.value)}
              className="h-9 w-full mt-1 rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="all">Todos os Mecânicos</option>
              {mechanics.map(m => (
                <option key={m.id} value={m.id}>{m.name} ({m.commission_rate}%)</option>
              ))}
            </select>
          </div>
          <div className="w-24">
            <Label className="text-xs text-muted-foreground">% Peças</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={partsRate}
              onChange={e => setPartsRate(e.target.value)}
              placeholder="0"
              className="h-9 mt-1"
            />
          </div>
          <Button onClick={handleSearch} disabled={loading} className="h-9 gap-1.5 text-white" style={{ backgroundColor: "#2563EB" }}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Gerar Relatório
          </Button>
        </div>

        {/* Cabeçalho impresso */}
        <div className="hidden print:block mb-4">
          <h2 className="text-lg font-bold">Relatório de Pagamento de Comissões</h2>
          <p className="text-sm">Período: {fmtDate(startDate + "T00:00:00")} a {fmtDate(endDate + "T00:00:00")}</p>
          <p className="text-sm">Mecânico: {mechanicFilter === "all" ? "Todos" : mechanics.find(m => m.id === mechanicFilter)?.name || "—"}</p>
          <p className="text-sm">Emitido em: {new Date().toLocaleString("pt-BR")}</p>
        </div>

        {/* Resumo */}
        {hasSearched && !loading && reportData.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
              <p className="text-xs text-blue-600 font-medium">Total de OS</p>
              <p className="text-xl font-bold text-blue-700 mt-1">{totalOS}</p>
            </div>
            <div className="rounded-lg bg-gray-50 border border-gray-200 p-3">
              <p className="text-xs text-gray-500 font-medium">Valor Total OS</p>
              <p className="text-xl font-bold text-gray-800 mt-1">{fmtMoney(grandTotalOS)}</p>
            </div>
            <div className="rounded-lg bg-orange-50 border border-orange-200 p-3">
              <p className="text-xs text-orange-600 font-medium">M.O. + Peças</p>
              <p className="text-sm font-bold text-orange-700 mt-1">M.O: {fmtMoney(grandTotalLabor)}</p>
              <p className="text-sm font-bold text-orange-600">Peças: {fmtMoney(grandTotalParts)}</p>
            </div>
            <div className="rounded-lg bg-green-50 border border-green-200 p-3">
              <p className="text-xs text-green-600 font-medium">Saldo Total Comissões</p>
              <p className="text-xl font-bold text-green-700 mt-1">{fmtMoney(grandTotalCommission)}</p>
            </div>
          </div>
        )}

        {/* Botão imprimir */}
        {hasSearched && !loading && reportData.length > 0 && (
          <div className="no-print flex justify-end">
            <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1">
              {printing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
              Imprimir Relatório
            </Button>
          </div>
        )}

        {/* Relatório detalhado por mecânico */}
        {hasSearched && !loading && reportData.length === 0 && (
          <div className="text-center py-12 text-gray-400 border border-dashed border-gray-200 rounded-lg">
            <Wrench className="w-10 h-10 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">Nenhuma OS concluída encontrada com os filtros selecionados.</p>
          </div>
        )}

        {hasSearched && !loading && reportData.length > 0 && (
          <div className="space-y-6">
            {reportData.map((mech) => (
              <div key={mech.mechanic_id} className="border border-gray-200 rounded-lg overflow-hidden">
                {/* Cabeçalho do mecânico */}
                <div className="bg-gray-50 px-4 py-3 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-blue-600" />
                    <span className="font-semibold text-sm">{mech.mechanic_name}</span>
                    <Badge variant="secondary" className="text-[10px]">{mech.orders.length} OS</Badge>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-muted-foreground">M.O.: <b className="text-gray-700">{mech.commission_rate}%</b></span>
                    {mech.parts_rate > 0 && <span className="text-muted-foreground">Peças: <b className="text-gray-700">{mech.parts_rate}%</b></span>}
                    <span className="text-muted-foreground">Total Comissão: <b className="text-green-600 text-base">{fmtMoney(mech.total_commission)}</b></span>
                  </div>
                </div>

                {/* Tabela de OS do mecânico */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-white text-left text-xs text-muted-foreground">
                      <tr>
                        <th className="p-2 px-3">OS</th>
                        <th className="p-2 px-3">Cliente</th>
                        <th className="p-2 px-3">Veículo</th>
                        <th className="p-2 px-3">Data Conclusão</th>
                        <th className="p-2 px-3 text-right">Mão de Obra</th>
                        <th className="p-2 px-3 text-right">Peças</th>
                        <th className="p-2 px-3 text-right">Valor OS</th>
                        <th className="p-2 px-3 text-right">Comissão</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mech.orders.map((o) => (
                        <tr key={o.id} className="border-t border-gray-100 hover:bg-gray-50/50">
                          <td className="p-2 px-3 font-medium">{o.order_number}</td>
                          <td className="p-2 px-3 text-muted-foreground">{o.client_name || "—"}</td>
                          <td className="p-2 px-3 text-muted-foreground text-xs">
                            {o.vehicle_brand} {o.vehicle_model}
                            {o.vehicle_plate && <span className="block text-[10px]">{o.vehicle_plate}</span>}
                          </td>
                          <td className="p-2 px-3 text-muted-foreground text-xs">{fmtDate(o.completion_date || o.delivery_date)}</td>
                          <td className="p-2 px-3 text-right">{fmtMoney(o._labor_value)}</td>
                          <td className="p-2 px-3 text-right text-orange-600">{fmtMoney(o._parts_value)}</td>
                          <td className="p-2 px-3 text-right font-medium">{fmtMoney(o._os_total)}</td>
                          <td className="p-2 px-3 text-right font-bold text-green-600">{fmtMoney(o._os_commission)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 font-bold bg-gray-50">
                        <td colSpan={4} className="p-2 px-3 text-right text-muted-foreground">Subtotal {mech.mechanic_name}:</td>
                        <td className="p-2 px-3 text-right">{fmtMoney(mech.total_labor)}</td>
                        <td className="p-2 px-3 text-right text-orange-600">{fmtMoney(mech.total_parts)}</td>
                        <td className="p-2 px-3 text-right">{fmtMoney(mech.total_os_value)}</td>
                        <td className="p-2 px-3 text-right text-green-600">{fmtMoney(mech.total_commission)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            ))}

            {/* Saldo total geral */}
            <div className="flex items-center justify-between rounded-lg bg-green-600 text-white px-6 py-4">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                <span className="font-bold text-lg">SALDO TOTAL DE COMISSÕES</span>
              </div>
              <span className="font-bold text-2xl">{fmtMoney(grandTotalCommission)}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
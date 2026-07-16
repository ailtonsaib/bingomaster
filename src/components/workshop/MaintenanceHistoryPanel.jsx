import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Search, Car, Wrench, Droplet, Calendar, Gauge, History, Loader2, X, Filter } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const formatCurrency = (v) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const formatDate = (d) => d ? new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";
const formatKM = (v) => (v || 0).toLocaleString("pt-BR") + " km";

const TYPE_CONFIG = {
  troca_oleo: { label: "Troca de Óleo", icon: Droplet, color: "#2563EB", bg: "#DBEAFE" },
  servico: { label: "Serviço", icon: Wrench, color: "#7C3AED", bg: "#EDE9FE" },
  revisao: { label: "Revisão", icon: Gauge, color: "#059669", bg: "#D1FAE5" },
  outro: { label: "Outro", icon: History, color: "#6B7280", bg: "#F3F4F6" },
};

export default function MaintenanceHistoryPanel({ userEmail }) {
  const { toast } = useToast();
  const [records, setRecords] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    vehicle_id: "",
    type: "troca_oleo",
    description: "",
    date: new Date().toISOString().slice(0, 10),
    mileage: "",
    oil_viscosity: "",
    oil_filter_code: "",
    cost: "",
    mechanic_name: "",
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [hist, vehs] = await Promise.all([
        base44.entities.DiagnosticMaintenanceHistory.filter({ user_email: userEmail }),
        base44.entities.DiagnosticVehicle.filter({ user_email: userEmail }),
      ]);
      setRecords(hist);
      setVehicles(vehs);
    } catch {
      toast({ title: "Erro", description: "Não foi possível carregar o histórico.", variant: "destructive" });
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [userEmail]);

  const vehicleById = useMemo(() => {
    const map = new Map();
    vehicles.forEach(v => map.set(v.id, v));
    return map;
  }, [vehicles]);

  // Group records by vehicle
  const vehicleGroups = useMemo(() => {
    const map = new Map();
    for (const rec of records) {
      const key = rec.vehicle_id || `${rec.plate || ""}|${rec.brand || ""}|${rec.model || ""}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          vehicle_id: rec.vehicle_id,
          plate: rec.plate || "",
          brand: rec.brand || "",
          model: rec.model || "",
          year: rec.year || "",
          client_name: rec.client_name || "",
          records: [],
        });
      }
      map.get(key).records.push(rec);
    }
    for (const g of map.values()) {
      g.records.sort((a, b) => new Date(b.date) - new Date(a.date));
    }
    return Array.from(map.values()).sort((a, b) => new Date(b.records[0]?.date) - new Date(a.records[0]?.date));
  }, [records]);

  const filteredGroups = useMemo(() => {
    let result = vehicleGroups;
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(g =>
        g.brand?.toLowerCase().includes(q) ||
        g.model?.toLowerCase().includes(q) ||
        g.plate?.toLowerCase().includes(q) ||
        g.client_name?.toLowerCase().includes(q)
      );
    }
    if (filterType !== "all") {
      result = result.filter(g => g.records.some(r => r.type === filterType));
    }
    return result;
  }, [vehicleGroups, search, filterType]);

  const handleSave = async () => {
    if (!form.date) {
      toast({ title: "Erro", description: "Informe a data da manutenção.", variant: "destructive" });
      return;
    }
    if (form.type === "troca_oleo" && !form.mileage) {
      toast({ title: "Erro", description: "Informe a quilometragem da troca de óleo.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const veh = form.vehicle_id ? vehicleById.get(form.vehicle_id) : null;
      const mileage = Number(form.mileage) || 0;

      // Calculate next oil change KM if applicable
      let nextOilKM = 0;
      if (form.type === "troca_oleo" && veh) {
        const oilEntry = await base44.entities.DiagnosticOil.filter({
          user_email: userEmail,
          vehicle_brand: veh.brand,
          vehicle_model: veh.model,
        }).catch(() => []);
        const interval = oilEntry[0]?.interval_km || 10000;
        nextOilKM = mileage + interval;

        // Update vehicle tracking
        await base44.entities.DiagnosticVehicle.update(veh.id, {
          mileage,
          last_service_km: mileage,
          last_oil_change_date: new Date(form.date).toISOString(),
          next_oil_change_km: nextOilKM,
          oil_viscosity: form.oil_viscosity || veh.oil_viscosity || "",
          oil_filter_code: form.oil_filter_code || veh.oil_filter_code || "",
        });
      }

      await base44.entities.DiagnosticMaintenanceHistory.create({
        user_email: userEmail,
        vehicle_id: form.vehicle_id || "",
        client_cpf_cnpj: veh?.client_cpf_cnpj || "",
        client_name: veh?.client_name || "",
        plate: veh?.plate || "",
        brand: veh?.brand || "",
        model: veh?.model || "",
        year: veh?.year || "",
        type: form.type,
        description: form.description,
        date: new Date(form.date).toISOString(),
        mileage,
        oil_viscosity: form.type === "troca_oleo" ? form.oil_viscosity : "",
        oil_filter_code: form.type === "troca_oleo" ? form.oil_filter_code : "",
        next_oil_change_km: nextOilKM,
        cost: Number(form.cost) || 0,
        mechanic_name: form.mechanic_name,
      });

      toast({ title: "Manutenção registrada", description: "Histórico atualizado com sucesso." });
      setForm({ vehicle_id: "", type: "troca_oleo", description: "", date: new Date().toISOString().slice(0, 10), mileage: "", oil_viscosity: "", oil_filter_code: "", cost: "", mechanic_name: "" });
      setShowForm(false);
      loadData();
    } catch (err) {
      toast({ title: "Erro", description: "Não foi possível salvar.", variant: "destructive" });
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    try {
      await base44.entities.DiagnosticMaintenanceHistory.delete(id);
      setRecords(prev => prev.filter(r => r.id !== id));
      toast({ title: "Registro removido." });
    } catch {
      toast({ title: "Erro", description: "Não foi possível excluir.", variant: "destructive" });
    }
  };

  const totalRecords = records.length;
  const oilChangeCount = records.filter(r => r.type === "troca_oleo").length;
  const serviceCount = records.filter(r => r.type === "servico").length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#1B1C21] flex items-center gap-2">
            <History className="w-5 h-5 text-[#2563EB]" /> Histórico de Manutenção
          </h2>
          <p className="text-sm text-[#71717A]">Trocas de óleo e serviços realizados por veículo</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="text-white gap-1" style={{ backgroundColor: "#2563EB" }}>
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? "Fechar" : "Registrar Manutenção"}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-gray-100 bg-white p-4 text-center">
          <div className="text-2xl font-bold text-[#1B1C21]">{totalRecords}</div>
          <div className="text-[10px] text-[#A1A1AA] uppercase tracking-wide">Total</div>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4 text-center">
          <div className="text-2xl font-bold text-[#2563EB]">{oilChangeCount}</div>
          <div className="text-[10px] text-[#A1A1AA] uppercase tracking-wide">Trocas de Óleo</div>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4 text-center">
          <div className="text-2xl font-bold text-[#7C3AED]">{serviceCount}</div>
          <div className="text-[10px] text-[#A1A1AA] uppercase tracking-wide">Serviços</div>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 space-y-4">
          <h3 className="font-semibold text-sm text-[#1B1C21]">Nova Manutenção</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-1">
              <Label className="text-xs">Veículo</Label>
              <select
                value={form.vehicle_id}
                onChange={e => setForm({ ...form, vehicle_id: e.target.value })}
                className="w-full h-9 rounded-md border border-input bg-white px-3 mt-1 text-sm"
              >
                <option value="">Selecione...</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.brand} {v.model} {v.plate && `| ${v.plate}`}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">Tipo</Label>
              <select
                value={form.type}
                onChange={e => setForm({ ...form, type: e.target.value })}
                className="w-full h-9 rounded-md border border-input bg-white px-3 mt-1 text-sm"
              >
                {Object.entries(TYPE_CONFIG).map(([val, cfg]) => (
                  <option key={val} value={val}>{cfg.label}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">Data</Label>
              <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="h-9 mt-1" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Quilometragem</Label>
              <Input type="number" value={form.mileage} onChange={e => setForm({ ...form, mileage: e.target.value })} placeholder="KM" className="h-9 mt-1" />
            </div>
            {form.type === "troca_oleo" && (
              <>
                <div>
                  <Label className="text-xs">Viscosidade do Óleo</Label>
                  <Input value={form.oil_viscosity} onChange={e => setForm({ ...form, oil_viscosity: e.target.value })} placeholder="ex: 5W30" className="h-9 mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Código do Filtro</Label>
                  <Input value={form.oil_filter_code} onChange={e => setForm({ ...form, oil_filter_code: e.target.value })} placeholder="Cód. filtro" className="h-9 mt-1" />
                </div>
              </>
            )}
            <div>
              <Label className="text-xs">Custo (R$)</Label>
              <Input type="number" step="0.01" value={form.cost} onChange={e => setForm({ ...form, cost: e.target.value })} className="h-9 mt-1" />
            </div>
            <div>
              <Label className="text-xs">Mecânico</Label>
              <Input value={form.mechanic_name} onChange={e => setForm({ ...form, mechanic_name: e.target.value })} className="h-9 mt-1" />
            </div>
          </div>

          <div>
            <Label className="text-xs">Descrição</Label>
            <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Descreva a manutenção realizada..." className="mt-1 min-h-[60px]" />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="text-white" style={{ backgroundColor: "#2563EB" }}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />} Salvar
            </Button>
          </div>
        </div>
      )}

      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A1A1AA]" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por veículo, placa ou cliente..." className="pl-9 h-10" />
        </div>
        <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
          {[{ val: "all", label: "Todos" }, { val: "troca_oleo", label: "Óleo" }, { val: "servico", label: "Serviços" }, { val: "revisao", label: "Revisões" }].map(f => (
            <button key={f.val} onClick={() => setFilterType(f.val)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filterType === f.val ? "bg-white text-[#2563EB] shadow-sm" : "text-[#71717A] hover:text-[#52525B]"}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Vehicle groups */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-[#2563EB]" />
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-gray-200 rounded-xl">
          <Car className="w-10 h-10 mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-[#71717A]">Nenhum registro de manutenção encontrado.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredGroups.map(group => {
            const veh = group.vehicle_id ? vehicleById.get(group.vehicle_id) : null;
            const currentKM = veh?.mileage || group.records[0]?.mileage || 0;
            const lastOil = group.records.find(r => r.type === "troca_oleo");
            const nextOilKM = lastOil?.next_oil_change_km || veh?.next_oil_change_km || 0;
            const oilDue = nextOilKM > 0 && currentKM >= nextOilKM;

            return (
              <div key={group.key} className="rounded-xl border border-gray-100 bg-white overflow-hidden shadow-sm">
                {/* Vehicle header */}
                <div className="flex items-center justify-between bg-gray-50 px-5 py-3 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#DBEAFE] flex items-center justify-center">
                      <Car className="w-5 h-5 text-[#2563EB]" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-[#1B1C21]">{group.brand} {group.model}</p>
                      <p className="text-xs text-[#71717A]">
                        {group.plate && `Placa: ${group.plate}`}
                        {group.year && ` • Ano: ${group.year}`}
                        {group.client_name && ` • ${group.client_name}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-[10px] text-[#A1A1AA] uppercase">KM Atual</p>
                      <p className="text-sm font-bold text-[#1B1C21]">{formatKM(currentKM)}</p>
                    </div>
                    {nextOilKM > 0 && (
                      <div className="text-right">
                        <p className="text-[10px] uppercase" style={{ color: oilDue ? "#EF4444" : "#A1A1AA" }}>Próx. Troca</p>
                        <p className="text-sm font-bold" style={{ color: oilDue ? "#EF4444" : "#1B1C21" }}>{formatKM(nextOilKM)}</p>
                      </div>
                    )}
                  </div>
                </div>

                {oilDue && (
                  <div className="px-5 py-2 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
                    <span className="text-xs text-amber-700 font-medium">⚠ Troca de óleo vencida! KM atual ultrapassou o previsto.</span>
                  </div>
                )}

                {/* Timeline */}
                <div className="p-5">
                  <div className="space-y-0">
                    {group.records
                      .filter(r => filterType === "all" || r.type === filterType)
                      .map((rec, idx) => {
                        const cfg = TYPE_CONFIG[rec.type] || TYPE_CONFIG.outro;
                        const Icon = cfg.icon;
                        return (
                          <div key={rec.id || idx} className="relative pl-8 pb-5 last:pb-0">
                            <div className="absolute left-0 top-0.5 w-4 h-4 rounded-full border-2 border-white shadow-sm flex items-center justify-center" style={{ backgroundColor: cfg.color }}>
                              <Icon className="w-2 h-2 text-white" />
                            </div>
                            {idx < group.records.length - 1 && <div className="absolute left-[7px] top-5 bottom-0 w-px bg-gray-100" />}
                            <div className="rounded-lg border border-gray-100 p-3 hover:border-gray-200 transition-colors">
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ backgroundColor: cfg.bg, color: cfg.color }}>
                                    {cfg.label}
                                  </span>
                                  {rec.order_number && (
                                    <span className="text-[10px] text-[#A1A1AA]">OS: {rec.order_number}</span>
                                  )}
                                </div>
                                <button onClick={() => handleDelete(rec.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              {rec.description && <p className="text-sm text-[#1B1C21] mb-1.5">{rec.description}</p>}
                              <div className="flex flex-wrap items-center gap-3 text-xs text-[#71717A]">
                                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {formatDate(rec.date)}</span>
                                {rec.mileage > 0 && <span className="flex items-center gap-1"><Gauge className="w-3 h-3" /> {formatKM(rec.mileage)}</span>}
                                {rec.oil_viscosity && <span className="flex items-center gap-1"><Droplet className="w-3 h-3" /> {rec.oil_viscosity}</span>}
                                {rec.mechanic_name && <span className="flex items-center gap-1"><Wrench className="w-3 h-3" /> {rec.mechanic_name}</span>}
                                {rec.cost > 0 && <span className="font-medium text-green-600">{formatCurrency(rec.cost)}</span>}
                              </div>
                              {rec.type === "troca_oleo" && rec.next_oil_change_km > 0 && (
                                <p className="text-[11px] text-[#2563EB] mt-1">Próxima troca: {formatKM(rec.next_oil_change_km)}</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
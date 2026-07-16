import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Pencil, Loader2, Car, User, Droplet, Link2, Search, AlertCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { maskCpfCnpj, maskPhone } from "@/lib/brMasks";

const FUEL_OPTIONS = [
  { value: "flex", label: "Flex" },
  { value: "gasolina", label: "Gasolina" },
  { value: "etanol", label: "Etanol" },
  { value: "diesel", label: "Diesel" },
  { value: "hibrido", label: "Híbrido" },
  { value: "eletrico", label: "Elétrico" }
];

const sanitizeCpfCnpj = (v) => (v || "").replace(/\D/g, "");

export default function ClientVehicleManager({ userEmail }) {
  const { toast } = useToast();
  const [clients, setClients] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("vehicles");
  const [search, setSearch] = useState("");
  const [showClientForm, setShowClientForm] = useState(false);
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const [clientForm, setClientForm] = useState({ name: "", cpf_cnpj: "", phone: "", email: "", address: "" });
  const [vehicleForm, setVehicleForm] = useState({
    client_cpf_cnpj: "", client_name: "", plate: "", brand: "", model: "", year: "",
    engine: "", fuel: "flex", mileage: 0, color: "", vin: "", observations: ""
  });

  const loadData = async () => {
    try {
      const [c, v] = await Promise.all([
        base44.entities.DiagnosticClient.filter({ user_email: userEmail }, "-created_date"),
        base44.entities.DiagnosticVehicle.filter({ user_email: userEmail }, "-created_date")
      ]);
      setClients(c);
      setVehicles(v);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const filteredClients = clients.filter(c =>
    !search ||
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.cpf_cnpj?.includes(sanitizeCpfCnpj(search))
  );

  const filteredVehicles = vehicles.filter(v =>
    !search ||
    v.plate?.toLowerCase().includes(search.toLowerCase()) ||
    v.model?.toLowerCase().includes(search.toLowerCase()) ||
    v.brand?.toLowerCase().includes(search.toLowerCase()) ||
    v.client_name?.toLowerCase().includes(search.toLowerCase())
  );

  // ---- Client handlers ----
  const handleNewClient = () => {
    setEditing(null);
    setClientForm({ name: "", cpf_cnpj: "", phone: "", email: "", address: "" });
    setShowClientForm(true);
  };

  const handleEditClient = (c) => {
    setEditing(c);
    setClientForm({ name: c.name, cpf_cnpj: maskCpfCnpj(c.cpf_cnpj || ""), phone: maskPhone(c.phone || ""), email: c.email || "", address: c.address || "" });
    setShowClientForm(true);
  };

  const handleSaveClient = async () => {
    if (!clientForm.name.trim() || !clientForm.cpf_cnpj.trim()) {
      toast({ title: "Erro", description: "Nome e CPF/CNPJ são obrigatórios.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const data = { ...clientForm, cpf_cnpj: sanitizeCpfCnpj(clientForm.cpf_cnpj), user_email: userEmail };
      if (editing) {
        await base44.entities.DiagnosticClient.update(editing.id, data);
      } else {
        await base44.entities.DiagnosticClient.create(data);
      }
      toast({ title: "Sucesso", description: editing ? "Cliente atualizado." : "Cliente cadastrado." });
      setShowClientForm(false);
      loadData();
    } catch {
      toast({ title: "Erro", description: "Não foi possível salvar.", variant: "destructive" });
    }
    setSaving(false);
  };

  const handleDeleteClient = async (id) => {
    if (!confirm("Excluir este cliente?")) return;
    try {
      await base44.entities.DiagnosticClient.delete(id);
      toast({ title: "Excluído", description: "Cliente removido." });
      loadData();
    } catch {
      toast({ title: "Erro", description: "Não foi possível excluir.", variant: "destructive" });
    }
  };

  // ---- Vehicle handlers ----
  const handleNewVehicle = (prefillClient = null) => {
    setEditing(null);
    setVehicleForm({
      client_cpf_cnpj: prefillClient?.cpf_cnpj || "", client_name: prefillClient?.name || "",
      plate: "", brand: "", model: "", year: "", engine: "", fuel: "flex",
      mileage: 0, color: "", vin: "", observations: ""
    });
    setShowVehicleForm(true);
  };

  const handleEditVehicle = (v) => {
    setEditing(v);
    setVehicleForm({
      client_cpf_cnpj: v.client_cpf_cnpj || "", client_name: v.client_name || "",
      plate: v.plate || "", brand: v.brand || "", model: v.model || "",
      year: v.year || "", engine: v.engine || "", fuel: v.fuel || "flex",
      mileage: v.mileage || 0, color: v.color || "", vin: v.vin || "",
      observations: v.observations || ""
    });
    setShowVehicleForm(true);
  };

  const handleSelectClientForVehicle = (cpfCnpj) => {
    const c = clients.find(c => c.cpf_cnpj === sanitizeCpfCnpj(cpfCnpj));
    setVehicleForm(prev => ({ ...prev, client_cpf_cnpj: sanitizeCpfCnpj(cpfCnpj), client_name: c?.name || "" }));
  };

  const handleSaveVehicle = async () => {
    if (!vehicleForm.client_cpf_cnpj.trim()) {
      toast({ title: "Erro", description: "Vincule um cliente ao veículo.", variant: "destructive" });
      return;
    }
    if (!vehicleForm.brand.trim() || !vehicleForm.model.trim()) {
      toast({ title: "Erro", description: "Marca e modelo são obrigatórios.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const data = {
        ...vehicleForm,
        user_email: userEmail,
        mileage: Number(vehicleForm.mileage) || 0,
        client_cpf_cnpj: sanitizeCpfCnpj(vehicleForm.client_cpf_cnpj)
      };
      if (editing) {
        await base44.entities.DiagnosticVehicle.update(editing.id, data);
      } else {
        await base44.entities.DiagnosticVehicle.create(data);
      }
      toast({ title: "Sucesso", description: editing ? "Veículo atualizado." : "Veículo cadastrado." });
      setShowVehicleForm(false);
      loadData();
    } catch {
      toast({ title: "Erro", description: "Não foi possível salvar.", variant: "destructive" });
    }
    setSaving(false);
  };

  const handleDeleteVehicle = async (id) => {
    if (!confirm("Excluir este veículo?")) return;
    try {
      await base44.entities.DiagnosticVehicle.delete(id);
      toast({ title: "Excluído", description: "Veículo removido." });
      loadData();
    } catch {
      toast({ title: "Erro", description: "Não foi possível excluir.", variant: "destructive" });
    }
  };

  // Oil change status
  const getOilStatus = (v) => {
    if (!v.next_oil_change_km || v.next_oil_change_km === 0) return { label: "Sem registro", color: "bg-gray-100 text-gray-500", km: 0 };
    const diff = v.next_oil_change_km - (v.mileage || 0);
    if (diff <= 0) return { label: "Troca vencida", color: "bg-red-100 text-red-700", km: diff };
    if (diff <= 1000) return { label: "Troca próxima", color: "bg-amber-100 text-amber-700", km: diff };
    return { label: "Em dia", color: "bg-green-100 text-green-700", km: diff };
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h3 className="text-lg font-bold flex items-center gap-2">
          {view === "vehicles" ? <><Car className="w-5 h-5 text-blue-600" /> Veículos ({vehicles.length})</> : <><User className="w-5 h-5 text-blue-600" /> Clientes ({clients.length})</>}
        </h3>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setView(view === "vehicles" ? "clients" : "vehicles")} className="gap-1">
            <Link2 className="w-4 h-4" /> {view === "vehicles" ? "Ver Clientes" : "Ver Veículos"}
          </Button>
          {view === "vehicles" ? (
            <Button onClick={() => handleNewVehicle()} className="gap-1 text-white" style={{ backgroundColor: "#2563EB" }}>
              <Plus className="w-4 h-4" /> Novo Veículo
            </Button>
          ) : (
            <Button onClick={handleNewClient} className="gap-1 text-white" style={{ backgroundColor: "#2563EB" }}>
              <Plus className="w-4 h-4" /> Novo Cliente
            </Button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome, placa, modelo..." className="pl-9 w-full" />
      </div>

      {/* Vehicles List */}
      {view === "vehicles" && (
        filteredVehicles.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Car className="w-12 h-12 mx-auto mb-2 text-gray-300" />
            <p>{search ? "Nenhum veículo encontrado." : "Nenhum veículo cadastrado."}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredVehicles.map(v => {
              const oil = getOilStatus(v);
              return (
                <div key={v.id} className="rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-all">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900">{v.brand} {v.model}</span>
                        {v.plate && <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-gray-100 text-gray-600 border border-gray-200">{v.plate.toUpperCase()}</span>}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {v.client_name || "Sem cliente"} {v.year ? `• ${v.year}` : ""} {v.engine ? `• ${v.engine}` : ""}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => handleEditVehicle(v)} className="p-1.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDeleteVehicle(v.id)} className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                    <div>
                      <span className="text-xs text-gray-400">KM Atual: </span>
                      <span className="text-sm font-medium text-gray-700">{(v.mileage || 0).toLocaleString("pt-BR")} km</span>
                    </div>
                    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${oil.color}`}>
                      <Droplet className="w-3 h-3" />
                      {oil.label}
                      {oil.km !== 0 && (
                        <span className="text-[10px]">
                          {oil.km > 0 ? `(${oil.km.toLocaleString("pt-BR")} km)` : `(${Math.abs(oil.km).toLocaleString("pt-BR")} km atrás)`}
                        </span>
                      )}
                    </div>
                  </div>
                  {v.last_oil_change_date && (
                    <p className="text-[10px] text-gray-400 mt-1">Última troca: {new Date(v.last_oil_change_date).toLocaleDateString("pt-BR")} {v.oil_viscosity ? `• Óleo ${v.oil_viscosity}` : ""}</p>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Clients List */}
      {view === "clients" && (
        filteredClients.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <User className="w-12 h-12 mx-auto mb-2 text-gray-300" />
            <p>{search ? "Nenhum cliente encontrado." : "Nenhum cliente cadastrado."}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredClients.map(c => {
              const clientVehicles = vehicles.filter(v => v.client_cpf_cnpj === c.cpf_cnpj);
              return (
                <div key={c.id} className="rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-all">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <span className="font-bold text-gray-900">{c.name}</span>
                      <p className="text-xs text-gray-500 mt-0.5">{c.cpf_cnpj ? `CPF/CNPJ: ${maskCpfCnpj(c.cpf_cnpj)}` : ""}</p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => handleEditClient(c)} className="p-1.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDeleteClient(c.id)} className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                  {c.phone || c.email ? (
                    <p className="text-xs text-gray-500">{c.phone || ""} {c.phone && c.email ? "•" : ""} {c.email || ""}</p>
                  ) : null}
                  {clientVehicles.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <p className="text-xs text-gray-400 mb-1.5">Veículos ({clientVehicles.length}):</p>
                      <div className="flex flex-wrap gap-1.5">
                        {clientVehicles.map(v => (
                          <button key={v.id} onClick={() => { setView("vehicles"); }} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700 hover:bg-blue-100">
                            <Car className="w-3 h-3" /> {v.brand} {v.model} {v.plate ? `(${v.plate})` : ""}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <Button variant="outline" size="sm" onClick={() => handleNewVehicle(c)} className="mt-3 gap-1 text-xs h-7 w-full">
                    <Plus className="w-3 h-3" /> Adicionar Veículo
                  </Button>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Client Form Modal */}
      {showClientForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowClientForm(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><User className="w-5 h-5 text-blue-600" /> {editing ? "Editar Cliente" : "Novo Cliente"}</h3>
            <div className="space-y-3">
              <div>
                <Label className="text-sm">Nome / Razão Social *</Label>
                <Input value={clientForm.name} onChange={e => setClientForm({ ...clientForm, name: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label className="text-sm">CPF / CNPJ *</Label>
                <Input value={maskCpfCnpj(clientForm.cpf_cnpj)} onChange={e => setClientForm({ ...clientForm, cpf_cnpj: e.target.value })} placeholder="000.000.000-00 ou 00.000.000/0000-00" className="mt-1" />
              </div>
              <div>
                <Label className="text-sm">Telefone</Label>
                <Input value={maskPhone(clientForm.phone)} onChange={e => setClientForm({ ...clientForm, phone: e.target.value })} placeholder="(00) 00000-0000" className="mt-1" />
              </div>
              <div>
                <Label className="text-sm">Email</Label>
                <Input type="email" value={clientForm.email} onChange={e => setClientForm({ ...clientForm, email: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label className="text-sm">Endereço</Label>
                <Input value={clientForm.address} onChange={e => setClientForm({ ...clientForm, address: e.target.value })} className="mt-1" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setShowClientForm(false)}>Cancelar</Button>
              <Button onClick={handleSaveClient} disabled={saving} className="text-white" style={{ backgroundColor: "#2563EB" }}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Vehicle Form Modal */}
      {showVehicleForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowVehicleForm(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Car className="w-5 h-5 text-blue-600" /> {editing ? "Editar Veículo" : "Novo Veículo"}</h3>

            {/* Client link */}
            <div className="mb-4 p-3 rounded-lg bg-blue-50/50 border border-blue-100">
              <Label className="text-sm font-medium flex items-center gap-1"><Link2 className="w-3.5 h-3.5 text-blue-600" /> Vincular Cliente *</Label>
              <select
                value={vehicleForm.client_cpf_cnpj}
                onChange={e => handleSelectClientForVehicle(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 mt-1 text-sm"
              >
                <option value="">Selecione um cliente...</option>
                {clients.map(c => <option key={c.id} value={c.cpf_cnpj}>{c.name} {c.cpf_cnpj ? `(${c.cpf_cnpj})` : ""}</option>)}
              </select>
              {vehicleForm.client_name && <p className="text-xs text-green-600 mt-1">✓ {vehicleForm.client_name}</p>}
              {clients.length === 0 && (
                <p className="text-xs text-amber-600 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Cadastre um cliente primeiro.</p>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <Label className="text-sm">Placa</Label>
                <Input value={vehicleForm.plate} onChange={e => setVehicleForm({ ...vehicleForm, plate: e.target.value.toUpperCase() })} placeholder="ABC1D23" className="mt-1 uppercase" />
              </div>
              <div>
                <Label className="text-sm">Marca *</Label>
                <Input value={vehicleForm.brand} onChange={e => setVehicleForm({ ...vehicleForm, brand: e.target.value })} placeholder="Ex: Fiat" className="mt-1" />
              </div>
              <div>
                <Label className="text-sm">Modelo *</Label>
                <Input value={vehicleForm.model} onChange={e => setVehicleForm({ ...vehicleForm, model: e.target.value })} placeholder="Ex: Palio" className="mt-1" />
              </div>
              <div>
                <Label className="text-sm">Ano Fabricação</Label>
                <Input value={vehicleForm.year} onChange={e => setVehicleForm({ ...vehicleForm, year: e.target.value })} placeholder="Ex: 2015" className="mt-1" />
              </div>
              <div>
                <Label className="text-sm">Motorização</Label>
                <Input value={vehicleForm.engine} onChange={e => setVehicleForm({ ...vehicleForm, engine: e.target.value })} placeholder="Ex: 1.0, 1.6" className="mt-1" />
              </div>
              <div>
                <Label className="text-sm">Combustível</Label>
                <select value={vehicleForm.fuel} onChange={e => setVehicleForm({ ...vehicleForm, fuel: e.target.value })} className="w-full h-9 rounded-md border border-input bg-transparent px-3 mt-1 text-sm">
                  {FUEL_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-sm">KM Atual</Label>
                <Input type="number" value={vehicleForm.mileage} onChange={e => setVehicleForm({ ...vehicleForm, mileage: e.target.value })} placeholder="0" className="mt-1" />
              </div>
              <div>
                <Label className="text-sm">Cor</Label>
                <Input value={vehicleForm.color} onChange={e => setVehicleForm({ ...vehicleForm, color: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label className="text-sm">Chassi (VIN)</Label>
                <Input value={vehicleForm.vin} onChange={e => setVehicleForm({ ...vehicleForm, vin: e.target.value })} className="mt-1" />
              </div>
              <div className="col-span-3">
                <Label className="text-sm">Observações</Label>
                <Input value={vehicleForm.observations} onChange={e => setVehicleForm({ ...vehicleForm, observations: e.target.value })} className="mt-1" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setShowVehicleForm(false)}>Cancelar</Button>
              <Button onClick={handleSaveVehicle} disabled={saving} className="text-white" style={{ backgroundColor: "#2563EB" }}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
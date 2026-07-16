import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Save, Loader2, Search, Package, Wrench, User, AlertCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { maskCpfCnpj, onlyDigits } from "@/lib/brMasks";

const formatCurrency = (v) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function ServiceOrderForm({ userEmail, onSaved, onCancel }) {
  const { toast } = useToast();
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [searching, setSearching] = useState(false);
  const [client, setClient] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [manualVehicle, setManualVehicle] = useState({ brand: "", model: "", plate: "", year: "", mileage: "" });
  const [clientNotFound, setClientNotFound] = useState(false);
  const [manualClient, setManualClient] = useState({ name: "", phone: "" });

  const [mechanics, setMechanics] = useState([]);
  const [selectedMechanicId, setSelectedMechanicId] = useState("");
  const [parts, setParts] = useState([]);
  const [serviceTypes, setServiceTypes] = useState([]);
  const [selectedServiceTypeId, setSelectedServiceTypeId] = useState("");

  const [complaint, setComplaint] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [warrantyMonths, setWarrantyMonths] = useState(0);

  const [partSearch, setPartSearch] = useState("");
  const [showPartDropdown, setShowPartDropdown] = useState(false);
  const [items, setItems] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [mechs, prts, svcs] = await Promise.all([
        base44.entities.DiagnosticMechanic.filter({ user_email: userEmail, is_active: true }),
        base44.entities.DiagnosticPart.filter({ user_email: userEmail, is_active: true }),
        base44.entities.DiagnosticServiceType.filter({ user_email: userEmail, is_active: true }),
      ]);
      setMechanics(mechs);
      setParts(prts);
      setServiceTypes(svcs);
    };
    load();
  }, [userEmail]);

  const handleClientSearch = async () => {
    const digits = onlyDigits(cpfCnpj);
    if (digits.length !== 11 && digits.length !== 14) return;
    setSearching(true);
    setClient(null);
    setVehicles([]);
    setSelectedVehicleId("");
    setClientNotFound(false);
    try {
      const [clients, vehs] = await Promise.all([
        base44.entities.DiagnosticClient.filter({ user_email: userEmail, cpf_cnpj: digits }),
        base44.entities.DiagnosticVehicle.filter({ user_email: userEmail, client_cpf_cnpj: digits }),
      ]);
      if (clients.length > 0) {
        setClient(clients[0]);
        setVehicles(vehs);
      } else {
        setClientNotFound(true);
      }
    } catch { /* ignore */ }
    setSearching(false);
  };

  const filteredParts = partSearch
    ? parts.filter(p =>
        p.name?.toLowerCase().includes(partSearch.toLowerCase()) ||
        p.code?.toLowerCase().includes(partSearch.toLowerCase()) ||
        p.barcode?.includes(partSearch)
      ).slice(0, 8)
    : [];

  const handleAddPart = (part) => {
    setItems(prev => [...prev, {
      type: "peca",
      description: part.name,
      quantity: 1,
      unit_price: part.sale_price || 0,
      total: part.sale_price || 0,
      part_id: part.id,
      part_code: part.code || "",
    }]);
    setPartSearch("");
    setShowPartDropdown(false);
  };

  const handleAddService = () => {
    setItems(prev => [...prev, {
      type: "servico",
      description: "",
      quantity: 1,
      unit_price: 0,
      total: 0,
    }]);
  };

  const handleItemChange = (idx, field, value) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [field]: value };
      updated.total = (Number(updated.quantity) || 0) * (Number(updated.unit_price) || 0);
      return updated;
    }));
  };

  const handleRemoveItem = (idx) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const partsTotal = items.filter(i => i.type === "peca").reduce((s, i) => s + (i.total || 0), 0);
  const laborTotal = items.filter(i => i.type === "servico").reduce((s, i) => s + (i.total || 0), 0);
  const total = partsTotal + laborTotal - (Number(discount) || 0);

  const selectedVehicle = vehicles.find(v => v.id === selectedVehicleId);
  const selectedServiceType = serviceTypes.find(s => s.id === selectedServiceTypeId);

  // Filtra mecânicos pela categoria do serviço: especialidade compatível OU geral
  const filteredMechanics = selectedServiceType
    ? mechanics.filter(m => m.specialty === selectedServiceType.category || m.specialty === "geral")
    : mechanics;

  const handleServiceTypeChange = (id) => {
    setSelectedServiceTypeId(id);
    setSelectedMechanicId("");
  };

  const handleSave = async () => {
    let finalClientName = client?.name || manualClient.name;
    let finalClientCpf = onlyDigits(cpfCnpj);
    let finalClientPhone = client?.phone || manualClient.phone;
    let finalVehicle = selectedVehicle || {
      brand: manualVehicle.brand,
      model: manualVehicle.model,
      plate: manualVehicle.plate,
      year: manualVehicle.year,
      mileage: Number(manualVehicle.mileage) || 0,
    };

    if (!finalClientName?.trim()) {
      toast({ title: "Erro", description: "Selecione ou cadastre o cliente.", variant: "destructive" });
      return;
    }
    if (!finalVehicle.brand?.trim() || !finalVehicle.model?.trim()) {
      toast({ title: "Erro", description: "Informe marca e modelo do veículo.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const now = new Date();
      const order_number = `OS-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;

      const selectedMechanic = mechanics.find(m => m.id === selectedMechanicId);

      await base44.entities.ServiceOrder.create({
        user_email: userEmail,
        order_number,
        status: "aberta",
        client_id: client?.id || "",
        client_name: finalClientName,
        client_cpf_cnpj: finalClientCpf,
        client_phone: finalClientPhone || "",
        vehicle_id: selectedVehicle?.id || "",
        vehicle_plate: finalVehicle.plate || "",
        vehicle_brand: finalVehicle.brand,
        vehicle_model: finalVehicle.model,
        vehicle_year: finalVehicle.year || "",
        vehicle_mileage: Number(finalVehicle.mileage) || 0,
        service_type_id: selectedServiceType?.id || "",
        service_type_name: selectedServiceType?.name || "",
        service_category: selectedServiceType?.category || "geral",
        mechanic_id: selectedMechanicId || "",
        mechanic_name: selectedMechanic?.name || "",
        client_complaint: complaint,
        technical_diagnosis: diagnosis,
        items,
        parts_total: partsTotal,
        labor_total: laborTotal,
        discount: Number(discount) || 0,
        total,
        scheduled_date: scheduledDate || "",
        warranty_months: Number(warrantyMonths) || 0,
        payment_status: "pendente",
        notes,
      });

      toast({ title: "Ordem de Serviço criada", description: `OS ${order_number} criada com sucesso.` });
      onSaved();
    } catch (err) {
      toast({ title: "Erro", description: "Não foi possível criar a OS.", variant: "destructive" });
    }
    setSaving(false);
  };

  return (
    <div className="space-y-5">
      {/* Client search */}
      <div>
        <Label className="text-sm font-semibold">Cliente</Label>
        <div className="flex gap-2 mt-1">
          <Input
            value={cpfCnpj}
            onChange={e => setCpfCnpj(maskCpfCnpj(e.target.value))}
            onKeyDown={e => e.key === "Enter" && handleClientSearch()}
            placeholder="CPF ou CNPJ do cliente"
            className="h-10 flex-1"
          />
          <Button onClick={handleClientSearch} disabled={searching} className="h-10 text-white" style={{ backgroundColor: "#2563EB" }}>
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </Button>
        </div>

        {client && (
          <div className="mt-2 rounded-lg bg-blue-50 border border-blue-200 p-3">
            <p className="font-semibold text-sm">{client.name}</p>
            <p className="text-xs text-gray-500">{maskCpfCnpj(client.cpf_cnpj)} {client.phone && `• ${client.phone}`}</p>
          </div>
        )}

        {clientNotFound && (
          <div className="mt-2 rounded-lg bg-amber-50 border border-amber-200 p-3">
            <p className="text-xs text-amber-700 mb-2">Cliente não encontrado. Preencha os dados:</p>
            <div className="grid grid-cols-2 gap-2">
              <Input value={manualClient.name} onChange={e => setManualClient({ ...manualClient, name: e.target.value })} placeholder="Nome do cliente" className="h-9 text-sm" />
              <Input value={manualClient.phone} onChange={e => setManualClient({ ...manualClient, phone: e.target.value })} placeholder="Telefone" className="h-9 text-sm" />
            </div>
          </div>
        )}
      </div>

      {/* Vehicle */}
      {client && vehicles.length > 0 && (
        <div>
          <Label className="text-sm font-semibold">Veículo</Label>
          <select
            value={selectedVehicleId}
            onChange={e => setSelectedVehicleId(e.target.value)}
            className="w-full h-10 rounded-md border border-input bg-transparent px-3 mt-1 text-sm"
          >
            <option value="">Selecione um veículo...</option>
            {vehicles.map(v => (
              <option key={v.id} value={v.id}>{v.brand} {v.model} {v.year} {v.plate && `| ${v.plate}`}</option>
            ))}
          </select>
        </div>
      )}

      {(clientNotFound || (client && vehicles.length === 0)) && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          <div><Label className="text-xs">Marca</Label><Input value={manualVehicle.brand} onChange={e => setManualVehicle({ ...manualVehicle, brand: e.target.value })} className="h-9 mt-1 text-sm" /></div>
          <div><Label className="text-xs">Modelo</Label><Input value={manualVehicle.model} onChange={e => setManualVehicle({ ...manualVehicle, model: e.target.value })} className="h-9 mt-1 text-sm" /></div>
          <div><Label className="text-xs">Placa</Label><Input value={manualVehicle.plate} onChange={e => setManualVehicle({ ...manualVehicle, plate: e.target.value.toUpperCase() })} className="h-9 mt-1 text-sm" /></div>
          <div><Label className="text-xs">Ano</Label><Input value={manualVehicle.year} onChange={e => setManualVehicle({ ...manualVehicle, year: e.target.value })} className="h-9 mt-1 text-sm" /></div>
          <div><Label className="text-xs">KM</Label><Input type="number" value={manualVehicle.mileage} onChange={e => setManualVehicle({ ...manualVehicle, mileage: e.target.value })} className="h-9 mt-1 text-sm" /></div>
        </div>
      )}

      {/* Service type + mechanic + scheduling */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <Label className="text-sm font-semibold">Tipo de Serviço</Label>
          <select
            value={selectedServiceTypeId}
            onChange={e => handleServiceTypeChange(e.target.value)}
            className="w-full h-10 rounded-md border border-input bg-transparent px-3 mt-1 text-sm"
          >
            <option value="">Selecione...</option>
            {serviceTypes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {selectedServiceType && (
            <p className="text-xs text-blue-600 mt-1">Categoria: {selectedServiceType.category}</p>
          )}
        </div>
        <div>
          <Label className="text-sm font-semibold">
            Mecânico Responsável
            {selectedServiceType && filteredMechanics.length > 0 && (
              <span className="text-xs text-gray-400 font-normal ml-1">({filteredMechanics.length} disponível)</span>
            )}
          </Label>
          <select
            value={selectedMechanicId}
            onChange={e => setSelectedMechanicId(e.target.value)}
            className="w-full h-10 rounded-md border border-input bg-transparent px-3 mt-1 text-sm"
            disabled={!selectedServiceTypeId && serviceTypes.length > 0}
          >
            <option value="">Selecione...</option>
            {filteredMechanics.map(m => (
              <option key={m.id} value={m.id}>
                {m.name}{m.specialty === "geral" ? " (Geral)" : ` (${m.specialty})`}
              </option>
            ))}
          </select>
          {selectedServiceType && filteredMechanics.length === 0 && (
            <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> Nenhum mecânico desta categoria. Cadastre um mecânico especializado ou "Geral".
            </p>
          )}
          {!selectedServiceTypeId && serviceTypes.length > 0 && (
            <p className="text-xs text-gray-400 mt-1">Selecione o tipo de serviço para filtrar mecânicos.</p>
          )}
        </div>
        <div>
          <Label className="text-sm font-semibold">Previsão de Conclusão</Label>
          <Input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} className="h-10 mt-1" />
        </div>
      </div>

      {/* Complaint + diagnosis */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label className="text-sm font-semibold">Queixa do Cliente</Label>
          <Textarea value={complaint} onChange={e => setComplaint(e.target.value)} placeholder="Descreva o problema relatado..." className="mt-1 min-h-[80px]" />
        </div>
        <div>
          <Label className="text-sm font-semibold">Diagnóstico Técnico</Label>
          <Textarea value={diagnosis} onChange={e => setDiagnosis(e.target.value)} placeholder="Diagnóstico técnico realizado..." className="mt-1 min-h-[80px]" />
        </div>
      </div>

      {/* Items */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-sm font-semibold">Itens da OS (Peças e Serviços)</Label>
          <Button onClick={handleAddService} variant="outline" size="sm" className="gap-1">
            <Plus className="w-3.5 h-3.5" /> Adicionar Serviço
          </Button>
        </div>

        <div className="relative mb-3">
          <Input
            value={partSearch}
            onChange={e => { setPartSearch(e.target.value); setShowPartDropdown(true); }}
            onFocus={() => setShowPartDropdown(true)}
            placeholder="Buscar peça para adicionar..."
            className="h-10"
          />
          {showPartDropdown && partSearch && filteredParts.length > 0 && (
            <div className="absolute z-20 mt-1 w-full bg-white rounded-lg border border-gray-200 shadow-lg max-h-56 overflow-y-auto">
              {filteredParts.map(part => (
                <button
                  key={part.id}
                  onClick={() => handleAddPart(part)}
                  className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-gray-100 last:border-0"
                >
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">{part.name}</span>
                    <span className="text-sm text-green-600 font-medium">{formatCurrency(part.sale_price)}</span>
                  </div>
                  <div className="text-xs text-gray-400">
                    {part.code && `Cód: ${part.code} • `}Estoque: {part.stock} {part.unit}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {items.length === 0 ? (
          <div className="text-center py-8 text-gray-400 border border-dashed border-gray-200 rounded-lg">
            <Package className="w-8 h-8 mx-auto mb-1 text-gray-300" />
            <p className="text-sm">Nenhum item adicionado.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-100">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="p-2 font-medium">Tipo</th>
                  <th className="p-2 font-medium">Descrição</th>
                  <th className="p-2 font-medium text-center" style={{ width: 70 }}>Qtd</th>
                  <th className="p-2 font-medium text-center" style={{ width: 100 }}>Valor Unit.</th>
                  <th className="p-2 font-medium text-right" style={{ width: 100 }}>Total</th>
                  <th style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx} className="border-t border-gray-100">
                    <td className="p-2">
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${item.type === "peca" ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600"}`}>
                        {item.type === "peca" ? "Peça" : "Serviço"}
                      </span>
                    </td>
                    <td className="p-2">
                      <Input
                        value={item.description}
                        onChange={e => handleItemChange(idx, "description", e.target.value)}
                        className="h-8 text-sm border-0 bg-transparent focus-visible:ring-1"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={e => handleItemChange(idx, "quantity", e.target.value)}
                        className="h-8 w-16 text-sm text-center mx-auto"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        type="number"
                        step="0.01"
                        value={item.unit_price}
                        onChange={e => handleItemChange(idx, "unit_price", e.target.value)}
                        className="h-8 w-24 text-sm text-right"
                      />
                    </td>
                    <td className="p-2 text-right font-medium text-green-600">{formatCurrency(item.total)}</td>
                    <td className="p-2">
                      <button onClick={() => handleRemoveItem(idx)} className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Totals */}
      <div className="flex justify-end">
        <div className="w-full max-w-xs space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Peças:</span>
            <span className="font-medium">{formatCurrency(partsTotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Mão de Obra:</span>
            <span className="font-medium">{formatCurrency(laborTotal)}</span>
          </div>
          <div className="flex justify-between text-sm items-center">
            <span className="text-gray-500">Desconto:</span>
            <Input type="number" step="0.01" value={discount} onChange={e => setDiscount(e.target.value)} className="h-8 w-28 text-right text-sm" />
          </div>
          <div className="flex justify-between border-t pt-1.5">
            <span className="font-bold">Total:</span>
            <span className="font-bold text-lg text-blue-600">{formatCurrency(total)}</span>
          </div>
        </div>
      </div>

      {/* Notes + warranty */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-sm font-semibold">Garantia (meses)</Label>
          <Input type="number" value={warrantyMonths} onChange={e => setWarrantyMonths(e.target.value)} className="h-9 mt-1" />
        </div>
        <div>
          <Label className="text-sm font-semibold">Observações</Label>
          <Input value={notes} onChange={e => setNotes(e.target.value)} className="h-9 mt-1" />
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button onClick={handleSave} disabled={saving} className="text-white gap-1" style={{ backgroundColor: "#2563EB" }}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Criar Ordem de Serviço
        </Button>
      </div>
    </div>
  );
}
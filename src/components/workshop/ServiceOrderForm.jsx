import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Save, Loader2, Search, Package, Wrench, User, AlertCircle, RotateCcw } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { maskCpfCnpj, onlyDigits } from "@/lib/brMasks";
import { getPortalUser } from "@/lib/portalSession";

const formatCurrency = (v) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function ServiceOrderForm({ userEmail, onSaved, onCancel, editOrder }) {
  const { toast } = useToast();
  const isEditing = !!editOrder;
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
  const [priority, setPriority] = useState("media");

  const [partSearch, setPartSearch] = useState("");
  const [showPartDropdown, setShowPartDropdown] = useState(false);
  const [selectedAddServiceTypeId, setSelectedAddServiceTypeId] = useState("");
  const [items, setItems] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const [allClients, setAllClients] = useState([]);
  const [allVehicles, setAllVehicles] = useState([]);
  const [clientSearch, setClientSearch] = useState("");
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [clientLoading, setClientLoading] = useState(false);
  const [isReturn, setIsReturn] = useState(false);
  const [originalOrder, setOriginalOrder] = useState(null);
  const [searchingReturn, setSearchingReturn] = useState(false);

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

      const [clis, vehs] = await Promise.all([
        base44.entities.DiagnosticClient.filter({ user_email: userEmail }),
        base44.entities.DiagnosticVehicle.filter({ user_email: userEmail }),
      ]);
      setAllClients(clis);
      setAllVehicles(vehs);

      // Pre-fill form when editing an existing order
      if (editOrder) {
        if (editOrder.client_cpf_cnpj) setCpfCnpj(editOrder.client_cpf_cnpj);
        if (editOrder.client_name) {
          setClient({ name: editOrder.client_name, cpf_cnpj: editOrder.client_cpf_cnpj, phone: editOrder.client_phone, id: editOrder.client_id });
        }
        if (editOrder.vehicle_id) {
          setVehicles([{ id: editOrder.vehicle_id, brand: editOrder.vehicle_brand, model: editOrder.vehicle_model, plate: editOrder.vehicle_plate, year: editOrder.vehicle_year, mileage: editOrder.vehicle_mileage }]);
          setSelectedVehicleId(editOrder.vehicle_id);
        } else {
          setManualVehicle({
            brand: editOrder.vehicle_brand || "",
            model: editOrder.vehicle_model || "",
            plate: editOrder.vehicle_plate || "",
            year: editOrder.vehicle_year || "",
            mileage: editOrder.vehicle_mileage || "",
          });
        }
        setSelectedServiceTypeId(editOrder.service_type_id || "");
        setSelectedMechanicId(editOrder.mechanic_id || "");
        setComplaint(editOrder.client_complaint || "");
        setDiagnosis(editOrder.technical_diagnosis || "");
        setScheduledDate(editOrder.scheduled_date ? editOrder.scheduled_date.split("T")[0] : "");
        setWarrantyMonths(editOrder.warranty_months || 0);
        setPriority(editOrder.priority || "media");
        setItems(editOrder.items || []);
        setDiscount(editOrder.discount || 0);
        setNotes(editOrder.notes || "");
        setIsReturn(!!editOrder.is_return);
        if (editOrder.original_order_id) {
          setOriginalOrder({
            id: editOrder.original_order_id,
            order_number: editOrder.original_order_number || "",
            items: editOrder.original_items || [],
          });
        }
      }
    };
    load();
  }, [userEmail, editOrder]);

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

  // Quando seleciona um veículo em modo retorno, busca a última OS concluída/entregue daquele veículo
  useEffect(() => {
    if (!isReturn || !selectedVehicleId || isEditing) return;
    const fetchLastOS = async () => {
      setSearchingReturn(true);
      try {
        const veh = vehicles.find(v => v.id === selectedVehicleId);
        if (!veh) return;
        const allOrders = await base44.entities.ServiceOrder.filter({
          user_email: userEmail,
          vehicle_id: selectedVehicleId,
        }, "-created_date");
        // Prioriza OS concluída/entregue; se não houver, pega a mais recente
        const lastOS = allOrders.find(o => o.status === "concluida" || o.status === "entregue") || allOrders[0];
        if (lastOS) {
          setOriginalOrder({
            id: lastOS.id,
            order_number: lastOS.order_number,
            items: lastOS.items || [],
          });
          // Preenche os campos com os dados da OS original
          setSelectedServiceTypeId(lastOS.service_type_id || "");
          setSelectedMechanicId(lastOS.mechanic_id || "");
          setComplaint(lastOS.client_complaint || "");
          setDiagnosis(lastOS.technical_diagnosis || "");
          setWarrantyMonths(lastOS.warranty_months || 0);
          setNotes(lastOS.notes ? `[Retorno OS ${lastOS.order_number}] ${lastOS.notes}` : `[Retorno OS ${lastOS.order_number}]`);
          // Mantém os itens vazios — serão preenchidos apenas com itens adicionais
          setItems([]);
          setDiscount(0);
          toast({
            title: "OS de Retorno",
            description: `Dados herdados da OS ${lastOS.order_number}. Adicione apenas itens/serviços novos.`,
          });
        } else {
          setOriginalOrder(null);
          toast({ title: "Aviso", description: "Nenhuma OS anterior encontrada para este veículo.", variant: "destructive" });
        }
      } catch { /* ignore */ }
      setSearchingReturn(false);
    };
    fetchLastOS();
  }, [isReturn, selectedVehicleId, isEditing]);

  const filteredParts = partSearch
    ? parts.filter(p => {
        const q = partSearch.toLowerCase();
        const name = (p.name || "").toLowerCase();
        const code = (p.code || "").toLowerCase();
        const brand = (p.brand || "").toLowerCase();
        const category = (p.category || "").toLowerCase();
        // busca por início de palavra (prioridade) ou contém em qualquer posição
        return name.startsWith(q) ||
          name.includes(q) ||
          code.startsWith(q) ||
          code.includes(q) ||
          brand.includes(q) ||
          category.includes(q) ||
          (p.barcode || "").includes(partSearch);
      })
      .sort((a, b) => {
        // ordena: começa com o termo primeiro, depois contém
        const q = partSearch.toLowerCase();
        const aName = (a.name || "").toLowerCase();
        const bName = (b.name || "").toLowerCase();
        const aStarts = aName.startsWith(q) ? 0 : 1;
        const bStarts = bName.startsWith(q) ? 0 : 1;
        if (aStarts !== bStarts) return aStarts - bStarts;
        return aName.localeCompare(bName);
      })
      .slice(0, 10)
    : [];

  const clientResults = clientSearch
    ? allClients.filter(c => {
        const q = clientSearch.toLowerCase();
        const name = (c.name || "").toLowerCase();
        const cpf = (c.cpf_cnpj || "").toLowerCase();
        const digits = onlyDigits(clientSearch);
        // busca também por placa de veículos vinculados
        const hasVehicleMatch = allVehicles.some(v =>
          v.client_cpf_cnpj === c.cpf_cnpj &&
          (
            (v.plate || "").toLowerCase().includes(q) ||
            (v.brand || "").toLowerCase().includes(q) ||
            (v.model || "").toLowerCase().includes(q)
          )
        );
        return name.startsWith(q) ||
          name.includes(q) ||
          cpf.includes(q) ||
          cpf.includes(digits) ||
          (c.phone || "").includes(digits) ||
          hasVehicleMatch;
      })
      .sort((a, b) => {
        const q = clientSearch.toLowerCase();
        const aName = (a.name || "").toLowerCase();
        const bName = (b.name || "").toLowerCase();
        const aStarts = aName.startsWith(q) ? 0 : 1;
        const bStarts = bName.startsWith(q) ? 0 : 1;
        if (aStarts !== bStarts) return aStarts - bStarts;
        return aName.localeCompare(bName);
      })
      .slice(0, 8)
    : [];

  const handleSelectClient = async (c) => {
    setCpfCnpj(maskCpfCnpj(c.cpf_cnpj));
    setClient(c);
    setClientNotFound(false);
    setManualClient({ name: "", phone: "" });
    const vehs = allVehicles.filter(v => v.client_cpf_cnpj === c.cpf_cnpj);
    setVehicles(vehs);
    setSelectedVehicleId("");
    if (vehs.length === 0) {
      setManualVehicle({ brand: "", model: "", plate: "", year: "", mileage: "" });
    }
    setClientSearch("");
    setShowClientDropdown(false);
  };

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
    toast({ title: "Peça adicionada", description: `${part.name} — ${formatCurrency(part.sale_price || 0)}` });
  };

  const handleAddService = () => {
    const svc = serviceTypes.find(s => s.id === selectedAddServiceTypeId);
    if (svc) {
      setItems(prev => [...prev, {
        type: "servico",
        description: svc.name,
        quantity: 1,
        unit_price: svc.default_price || 0,
        total: svc.default_price || 0,
        service_type_id: svc.id,
        service_category: svc.category,
      }]);
      setSelectedAddServiceTypeId("");
      toast({ title: "Serviço adicionado", description: `${svc.name} — ${formatCurrency(svc.default_price || 0)}` });
    } else {
      setItems(prev => [...prev, {
        type: "servico",
        description: "",
        quantity: 1,
        unit_price: 0,
        total: 0,
      }]);
      toast({ title: "Serviço adicionado", description: "Serviço em branco — preencha a descrição e valor." });
    }
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
      const selectedMechanic = mechanics.find(m => m.id === selectedMechanicId);

      const orderData = {
        client_id: client?.id || editOrder?.client_id || "",
        client_name: finalClientName,
        client_cpf_cnpj: finalClientCpf,
        client_phone: finalClientPhone || "",
        vehicle_id: selectedVehicle?.id || editOrder?.vehicle_id || "",
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
        priority,
        notes,
        is_return: isReturn,
        original_order_id: originalOrder?.id || "",
        original_order_number: originalOrder?.order_number || "",
        original_items: originalOrder?.items || [],
      };

      const sessionUser = getPortalUser();
      if (isEditing) {
        await base44.entities.ServiceOrder.update(editOrder.id, {
          ...orderData,
          last_edited_by_email: sessionUser?.email || "",
          last_edited_by_name: sessionUser?.name || "",
        });
        toast({ title: "OS atualizada", description: `Ordem de Serviço ${editOrder.order_number} atualizada com sucesso.` });
      } else {
        const now = new Date();
        const order_number = `OS-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
        await base44.entities.ServiceOrder.create({
          ...orderData,
          user_email: userEmail,
          order_number,
          status: "aberta",
          payment_status: "pendente",
        });
        toast({ title: "Ordem de Serviço criada", description: `OS ${order_number} criada com sucesso.` });
      }
      onSaved();
    } catch (err) {
      toast({ title: "Erro", description: isEditing ? "Não foi possível atualizar a OS." : "Não foi possível criar a OS.", variant: "destructive" });
    }
    setSaving(false);
  };

  return (
    <div className="space-y-5">
      {/* Tipo de OS: Nova ou Retorno */}
      {!isEditing && (
        <div>
          <Label className="text-sm font-semibold mb-2 block">Tipo de Abertura</Label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setIsReturn(false); setOriginalOrder(null); }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 text-sm font-medium transition-all ${
                !isReturn ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-400 hover:border-gray-300"
              }`}
            >
              <Plus className="w-4 h-4" /> Nova OS
            </button>
            <button
              type="button"
              onClick={() => setIsReturn(true)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 text-sm font-medium transition-all ${
                isReturn ? "border-amber-500 bg-amber-50 text-amber-700" : "border-gray-200 text-gray-400 hover:border-gray-300"
              }`}
            >
              <RotateCcw className="w-4 h-4" /> OS de Retorno
            </button>
          </div>
          {isReturn && (
            <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Selecione o veículo e o sistema buscará automaticamente a última OS para herdar os dados.
              {" "}Adicione apenas peças/serviços novos — itens herdados não geram financeiro.
            </p>
          )}
        </div>
      )}

      {/* Indicador de OS original (quando retorno) */}
      {originalOrder && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 flex items-center gap-2">
          <RotateCcw className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-700">
              Retorno da OS {originalOrder.order_number}
            </p>
            <p className="text-xs text-amber-600">
              {originalOrder.items?.length || 0} itens na OS original (não geram cobrança).
              {" "}Apenas itens adicionados agora geram financeiro.
            </p>
          </div>
          {!isEditing && (
            <button
              type="button"
              onClick={() => setOriginalOrder(null)}
              className="text-xs text-amber-600 hover:underline"
            >
              Limpar
            </button>
          )}
        </div>
      )}

      {searchingReturn && (
        <div className="flex items-center gap-2 text-sm text-amber-600">
          <Loader2 className="w-4 h-4 animate-spin" /> Buscando última OS do veículo...
        </div>
      )}

      {/* Client search */}
      <div>
        <Label className="text-sm font-semibold">Cliente</Label>
        <div className="relative mt-1">
          <Input
            value={clientSearch}
            onChange={e => { setClientSearch(e.target.value); setShowClientDropdown(true); }}
            onFocus={() => setShowClientDropdown(true)}
            onBlur={() => setTimeout(() => setShowClientDropdown(false), 200)}
            onKeyDown={e => { if (e.key === "Enter" && clientResults.length > 0) handleSelectClient(clientResults[0]); }}
            placeholder="Digite o nome, CPF/CNPJ ou placa do veículo..."
            className="h-10 flex-1 pl-9"
          />
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          {showClientDropdown && clientSearch && clientResults.length > 0 && (
            <div className="absolute z-20 mt-1 w-full bg-white rounded-lg border border-gray-200 shadow-lg max-h-64 overflow-y-auto">
              {clientResults.map(c => {
                const v = allVehicles.find(v => v.client_cpf_cnpj === c.cpf_cnpj);
                return (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => handleSelectClient(c)}
                    className="w-full text-left px-3 py-2.5 hover:bg-blue-50 border-b border-gray-100 last:border-0 transition-colors"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-800">{c.name}</span>
                      <span className="text-xs text-gray-400">{maskCpfCnpj(c.cpf_cnpj)}</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {c.phone && `${c.phone} • `}
                      {v ? `Veículo: ${v.brand} ${v.model} ${v.plate ? `| ${v.plate}` : ""}` : "Sem veículo cadastrado"}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          {showClientDropdown && clientSearch && clientResults.length === 0 && !clientLoading && (
            <div className="absolute z-20 mt-1 w-full bg-white rounded-lg border border-gray-200 shadow-lg px-3 py-2.5 text-sm text-gray-400">
              Nenhum cliente encontrado para "{clientSearch}". Use a busca por CPF/CNPJ abaixo ou cadastre manualmente.
            </div>
          )}
        </div>

        {/* CPF/CNPJ direct search fallback */}
        <div className="flex gap-2 mt-2">
          <Input
            value={cpfCnpj}
            onChange={e => setCpfCnpj(maskCpfCnpj(e.target.value))}
            onKeyDown={e => e.key === "Enter" && handleClientSearch()}
            placeholder="Ou digite o CPF/CNPJ se o cliente não apareceu acima"
            className="h-9 flex-1 text-sm"
          />
          <Button type="button" onClick={handleClientSearch} disabled={searching} className="h-9 text-white" style={{ backgroundColor: "#2563EB" }}>
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

      {/* Priority */}
      <div>
        <Label className="text-sm font-semibold">Prioridade</Label>
        <div className="flex gap-2 mt-1">
          {[
            { value: "baixa", label: "Baixa", color: "bg-green-100 text-green-700 border-green-300", dot: "bg-green-500" },
            { value: "media", label: "Média", color: "bg-yellow-100 text-yellow-700 border-yellow-300", dot: "bg-yellow-500" },
            { value: "alta", label: "Alta", color: "bg-red-100 text-red-700 border-red-300", dot: "bg-red-500" },
          ].map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setPriority(opt.value)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                priority === opt.value ? `${opt.color} border-current` : "bg-white text-gray-400 border-gray-200 hover:border-gray-300"
              }`}
            >
              <span className={`w-2.5 h-2.5 rounded-full ${opt.dot}`} />
              {opt.label}
            </button>
          ))}
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

      {/* Itens da OS original (quando retorno) */}
      {isReturn && originalOrder && originalOrder.items && originalOrder.items.length > 0 && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
          <p className="text-xs font-semibold text-amber-600 mb-2 flex items-center gap-1">
            <RotateCcw className="w-3.5 h-3.5" />
            ITENS DA OS ORIGINAL {originalOrder.order_number} (não cobrados)
          </p>
          <div className="space-y-1">
            {originalOrder.items.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm py-1 border-b border-amber-100 last:border-0">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${item.type === "peca" ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600"}`}>
                    {item.type === "peca" ? "Peça" : "Serviço"}
                  </span>
                  <span>{item.description}</span>
                </div>
                <span className="text-gray-400 line-through text-xs">{formatCurrency(item.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Items */}
      <div>
        <Label className="text-sm font-semibold mb-2 block">
          {isReturn ? "Itens Adicionais (peças/serviços novos)" : "Itens da OS (Peças e Serviços)"}
        </Label>
        {isReturn && (
          <p className="text-xs text-amber-600 mb-2">Adicione apenas itens/serviços novos. Os itens da OS original já constam acima e não geram cobrança.</p>
        )}

        {/* Services section */}
        <div className="rounded-lg border border-purple-100 bg-purple-50/30 p-3 mb-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Wrench className="w-4 h-4 text-purple-600" />
            <span className="text-sm font-semibold text-purple-700">Serviços</span>
          </div>
          <div className="flex gap-2">
            <select
              value={selectedAddServiceTypeId}
              onChange={e => setSelectedAddServiceTypeId(e.target.value)}
              className="flex-1 h-10 rounded-md border border-input bg-white px-3 text-sm"
            >
              <option value="">Selecionar serviço cadastrado...</option>
              {serviceTypes.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.default_price > 0 && `— ${formatCurrency(s.default_price)}`}
                </option>
              ))}
            </select>
            <button type="button" onClick={handleAddService} className="flex items-center gap-1 h-10 px-4 rounded-md border border-purple-300 text-purple-700 hover:bg-purple-100 text-sm font-medium transition-colors">
              <Plus className="w-3.5 h-3.5" /> Adicionar
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1">Selecione um serviço ou deixe em branco e clique em "Adicionar" para inserir manualmente.</p>
        </div>

        {/* Parts section */}
        <div className="rounded-lg border border-blue-100 bg-blue-50/30 p-3 mb-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Package className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-semibold text-blue-700">Peças</span>
          </div>
          <div className="relative">
            <Input
              value={partSearch}
              onChange={e => { setPartSearch(e.target.value); setShowPartDropdown(true); }}
              onFocus={() => setShowPartDropdown(true)}
              onBlur={() => setTimeout(() => setShowPartDropdown(false), 200)}
              placeholder="Digite para buscar peças (ex: rolamento, filtro, pastilha...)"
              className="h-10 bg-white"
            />
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            {showPartDropdown && partSearch && filteredParts.length > 0 && (
              <div className="absolute z-20 mt-1 w-full bg-white rounded-lg border border-gray-200 shadow-lg max-h-64 overflow-y-auto">
                {filteredParts.map(part => (
                  <button
                    type="button"
                    key={part.id}
                    onClick={() => handleAddPart(part)}
                    className="w-full text-left px-3 py-2.5 hover:bg-blue-50 border-b border-gray-100 last:border-0 transition-colors"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-800">{part.name}</span>
                      <span className="text-sm text-green-600 font-semibold">{formatCurrency(part.sale_price)}</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {part.code && `Cód: ${part.code} • `}
                      {part.brand && `${part.brand} • `}
                      Estoque: {part.stock} {part.unit}
                    </div>
                  </button>
                ))}
              </div>
            )}
            {showPartDropdown && partSearch && filteredParts.length === 0 && (
              <div className="absolute z-20 mt-1 w-full bg-white rounded-lg border border-gray-200 shadow-lg px-3 py-2.5 text-sm text-gray-400">
                Nenhuma peça encontrada para "{partSearch}". Cadastre peças no menu "Estoque".
              </div>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-1">Digite para buscar por nome, código, marca ou categoria. O preço vem do cadastro mas pode ser editado na tabela.</p>
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

      {/* Assinatura do cliente */}
      <div className="grid grid-cols-2 gap-8 pt-8 border-t border-gray-100">
        <div className="text-center">
          <div className="border-t border-gray-400 pt-1">
            <p className="text-xs text-gray-500">{client?.name || manualClient.name || "Cliente"}</p>
            <p className="text-[10px] text-gray-400">Assinatura do Cliente</p>
          </div>
        </div>
        <div className="text-center">
          <div className="border-t border-gray-400 pt-1">
            <p className="text-xs text-gray-500">{mechanics.find(m => m.id === selectedMechanicId)?.name || "Mecânico Responsável"}</p>
            <p className="text-[10px] text-gray-400">Assinatura do Mecânico</p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button onClick={handleSave} disabled={saving} className="text-white gap-1" style={{ backgroundColor: "#2563EB" }}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {isEditing ? "Salvar Alterações" : "Criar Ordem de Serviço"}
        </Button>
      </div>
    </div>
  );
}
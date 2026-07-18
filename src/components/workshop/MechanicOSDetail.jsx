import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, Play, Package, CheckCircle2, Plus, Trash2, Pencil, Save, Wrench, Car, FileText } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const fmtMoney = (v) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—");

const STATUS_OPTIONS = [
  { value: "em_andamento", label: "Iniciar Serviço", icon: Play, color: "#2563EB" },
  { value: "aguardando_pecas", label: "Aguardando Peças", icon: Package, color: "#F59E0B" },
  { value: "concluida", label: "Concluir OS", icon: CheckCircle2, color: "#16A34A" },
];

export default function MechanicOSDetail({ os, mechanic, onUpdate, onBack }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(os.status);
  const [technicalDiagnosis, setTechnicalDiagnosis] = useState(os.technical_diagnosis || "");
  const [notes, setNotes] = useState(os.notes || "");
  const [items, setItems] = useState(os.items || []);
  const [showAddItem, setShowAddItem] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [newItem, setNewItem] = useState({ type: "peca", description: "", quantity: 1, unit_price: 0 });

  const parts = items.filter(i => i.type === "peca");
  const services = items.filter(i => i.type === "servico");
  const partsTotal = parts.reduce((s, i) => s + (i.total || (i.quantity * i.unit_price)), 0);
  const laborTotal = services.reduce((s, i) => s + (i.total || (i.quantity * i.unit_price)), 0);
  const grandTotal = partsTotal + laborTotal;

  const handleStatusChange = async (newStatus) => {
    setSaving(true);
    try {
      const updates = {
        status: newStatus,
        technical_diagnosis: technicalDiagnosis,
        notes,
        items,
        parts_total: partsTotal,
        labor_total: laborTotal,
        total: grandTotal,
        last_edited_by_email: mechanic.email,
        last_edited_by_name: mechanic.name,
      };
      if (newStatus === "em_andamento" && !os.start_date) {
        updates.start_date = new Date().toISOString();
      }
      if (newStatus === "concluida" && !os.completion_date) {
        updates.completion_date = new Date().toISOString();
      }
      const updated = await base44.entities.ServiceOrder.update(os.id, updates);
      toast({ title: "Status atualizado", description: `OS #${os.order_number} marcada como ${newStatus.replace("_", " ")}.` });
      setStatus(newStatus);
      onUpdate({ ...os, ...updates, ...updated });
    } catch {
      toast({ title: "Erro", description: "Não foi possível atualizar a OS.", variant: "destructive" });
    }
    setSaving(false);
  };

  const handleSaveObservations = async () => {
    setSaving(true);
    try {
      const updates = {
        technical_diagnosis: technicalDiagnosis,
        notes,
        items,
        parts_total: partsTotal,
        labor_total: laborTotal,
        total: grandTotal,
        last_edited_by_email: mechanic.email,
        last_edited_by_name: mechanic.name,
      };
      await base44.entities.ServiceOrder.update(os.id, updates);
      toast({ title: "Salvo", description: "Pareceres e observações salvos." });
      onUpdate({ ...os, ...updates });
    } catch {
      toast({ title: "Erro", description: "Não foi possível salvar.", variant: "destructive" });
    }
    setSaving(false);
  };

  const handleAddItem = () => {
    if (!newItem.description.trim()) {
      toast({ title: "Erro", description: "Informe a descrição.", variant: "destructive" });
      return;
    }
    const item = {
      ...newItem,
      quantity: Number(newItem.quantity) || 1,
      unit_price: Number(newItem.unit_price) || 0,
    };
    item.total = item.quantity * item.unit_price;

    if (editingIndex !== null) {
      const updated = [...items];
      updated[editingIndex] = item;
      setItems(updated);
      setEditingIndex(null);
    } else {
      setItems([...items, item]);
    }
    setNewItem({ type: "peca", description: "", quantity: 1, unit_price: 0 });
    setShowAddItem(false);
  };

  const handleEditItem = (index) => {
    setEditingIndex(index);
    setNewItem({ ...items[index] });
    setShowAddItem(true);
  };

  const handleRemoveItem = (index) => {
    if (!confirm("Remover este item?")) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const STATUS_BADGE = {
    aberta: "bg-gray-100 text-gray-700",
    em_andamento: "bg-blue-100 text-blue-700",
    aguardando_pecas: "bg-amber-100 text-amber-700",
    concluida: "bg-green-100 text-green-700",
    entregue: "bg-purple-100 text-purple-700",
  };

  return (
    <div className="min-h-screen bg-[#FAFAFB]">
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 px-3 py-1.5 rounded-lg">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-900 text-sm">OS #{os.order_number}</span>
            <Badge className={`border-0 ${STATUS_BADGE[status]}`}>{status.replace("_", " ")}</Badge>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Dados da OS */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <Car className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-gray-400">Veículo</p>
                <p className="font-medium text-sm">{os.vehicle_brand} {os.vehicle_model}</p>
                <p className="text-xs text-gray-500">{os.vehicle_plate} {os.vehicle_year && `• ${os.vehicle_year}`}</p>
                {os.vehicle_mileage > 0 && <p className="text-xs text-gray-500">{os.vehicle_mileage.toLocaleString("pt-BR")} km</p>}
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-400">Cliente</p>
              <p className="font-medium text-sm">{os.client_name}</p>
              {os.client_phone && <p className="text-xs text-gray-500">{os.client_phone}</p>}
            </div>
          </div>
          {os.client_complaint && (
            <div className="mt-4 pt-4 border-t border-gray-50">
              <p className="text-xs text-gray-400 mb-1">Queixa do Cliente</p>
              <p className="text-sm text-gray-700">{os.client_complaint}</p>
            </div>
          )}
          {os.service_type_name && (
            <div className="mt-2">
              <p className="text-xs text-gray-400">Tipo de Serviço</p>
              <p className="text-sm font-medium">{os.service_type_name}</p>
            </div>
          )}
        </div>

        {/* Mudança de Status */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Play className="w-4 h-4 text-blue-600" /> Marcar Status da OS
          </h3>
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map(opt => {
              const Icon = opt.icon;
              const isCurrent = status === opt.value;
              const isDisabled = (opt.value === "concluida" && (status === "entregue" || status === "concluida")) || saving;
              return (
                <Button
                  key={opt.value}
                  variant={isCurrent ? "default" : "outline"}
                  disabled={isDisabled}
                  onClick={() => handleStatusChange(opt.value)}
                  className="gap-1.5"
                  style={isCurrent ? { backgroundColor: opt.color } : {}}
                >
                  <Icon className="w-4 h-4" /> {opt.label}
                </Button>
              );
            })}
          </div>
          {status === "concluida" && (
            <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> OS concluída em {fmtDate(os.completion_date)}
            </p>
          )}
        </div>

        {/* Peças e Serviços */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Package className="w-4 h-4 text-blue-600" /> Peças e Serviços
            </h3>
            <Button size="sm" variant="outline" onClick={() => { setEditingIndex(null); setNewItem({ type: "peca", description: "", quantity: 1, unit_price: 0 }); setShowAddItem(true); }} className="gap-1">
              <Plus className="w-3.5 h-3.5" /> Adicionar
            </Button>
          </div>

          {items.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Nenhum item adicionado.</p>
          ) : (
            <div className="space-y-2">
              {items.map((item, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg border border-gray-50 px-3 py-2">
                  <Badge variant={item.type === "peca" ? "default" : "secondary"} className="text-[10px]">
                    {item.type === "peca" ? "Peça" : "Serviço"}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.description}</p>
                    <p className="text-xs text-gray-400">{item.quantity}x {fmtMoney(item.unit_price)}</p>
                  </div>
                  <span className="text-sm font-bold text-gray-700">{fmtMoney(item.total || (item.quantity * item.unit_price))}</span>
                  <div className="flex gap-1">
                    <button onClick={() => handleEditItem(i)} className="p-1.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleRemoveItem(i)} className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              {/* Totais */}
              <div className="pt-3 border-t border-gray-50 space-y-1 text-sm">
                <div className="flex justify-between text-gray-500">
                  <span>Peças ({parts.length})</span>
                  <span className="font-medium text-orange-600">{fmtMoney(partsTotal)}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Mão de Obra ({services.length})</span>
                  <span className="font-medium text-blue-600">{fmtMoney(laborTotal)}</span>
                </div>
                <div className="flex justify-between font-bold text-gray-800 pt-1 border-t border-gray-50">
                  <span>Total</span>
                  <span>{fmtMoney(grandTotal)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Formulário adicionar/editar item */}
          {showAddItem && (
            <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50/30 p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-1">
                  <Label className="text-xs">Tipo</Label>
                  <select
                    value={newItem.type}
                    onChange={e => setNewItem({ ...newItem, type: e.target.value })}
                    className="w-full h-9 rounded-md border border-input bg-transparent px-3 mt-1 text-sm"
                  >
                    <option value="peca">Peça</option>
                    <option value="servico">Serviço</option>
                  </select>
                </div>
                <div className="sm:col-span-3">
                  <Label className="text-xs">Descrição *</Label>
                  <Input value={newItem.description} onChange={e => setNewItem({ ...newItem, description: e.target.value })} className="mt-1" placeholder="Ex: Pastilha de freio dianteira" />
                </div>
                <div>
                  <Label className="text-xs">Quantidade</Label>
                  <Input type="number" step="0.01" value={newItem.quantity} onChange={e => setNewItem({ ...newItem, quantity: e.target.value })} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Valor Unit.</Label>
                  <Input type="number" step="0.01" value={newItem.unit_price} onChange={e => setNewItem({ ...newItem, unit_price: e.target.value })} className="mt-1" />
                </div>
                <div className="flex items-end">
                  <span className="text-sm font-bold text-gray-700">
                    Total: {fmtMoney((Number(newItem.quantity) || 0) * (Number(newItem.unit_price) || 0))}
                  </span>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => { setShowAddItem(false); setEditingIndex(null); }}>Cancelar</Button>
                <Button size="sm" onClick={handleAddItem} className="text-white" style={{ backgroundColor: "#2563EB" }}>
                  {editingIndex !== null ? "Atualizar" : "Adicionar"}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Pareceres Técnicos */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600" /> Pareceres e Observações
          </h3>

          <div>
            <Label className="text-sm font-medium">Diagnóstico Técnico</Label>
            <textarea
              value={technicalDiagnosis}
              onChange={e => setTechnicalDiagnosis(e.target.value)}
              rows={4}
              placeholder="Descreva o diagnóstico técnico realizado, problemas encontrados, laudo..."
              className="w-full mt-1 rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            />
          </div>

          <div>
            <Label className="text-sm font-medium">Observações Gerais</Label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Observações sobre a execução, recomendações, etc."
              className="w-full mt-1 rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            />
          </div>

          <Button onClick={handleSaveObservations} disabled={saving} className="gap-1.5 text-white" style={{ backgroundColor: "#2563EB" }}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar Pareceres
          </Button>
        </div>
      </div>
    </div>
  );
}
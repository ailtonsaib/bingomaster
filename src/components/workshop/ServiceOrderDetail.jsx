import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, Phone, Car, UserCog, Calendar, Shield, Pencil, FileText } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import ResponsibilityTermModal from "@/components/workshop/ResponsibilityTermModal";

const formatCurrency = (v) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const formatDate = (d) => d ? new Date(d).toLocaleDateString("pt-BR") : "—";

const STATUS_CONFIG = {
  aberta: { label: "Aberta", color: "bg-blue-50 text-blue-600" },
  em_andamento: { label: "Em Andamento", color: "bg-amber-50 text-amber-600" },
  aguardando_pecas: { label: "Aguardando Peças", color: "bg-orange-50 text-orange-600" },
  concluida: { label: "Concluída", color: "bg-green-50 text-green-600" },
  entregue: { label: "Entregue", color: "bg-teal-50 text-teal-600" },
  cancelada: { label: "Cancelada", color: "bg-red-50 text-red-600" },
};

export default function ServiceOrderDetail({ order, userEmail, onBack, onEdit }) {
  const { toast } = useToast();
  const [currentStatus, setCurrentStatus] = useState(order.status);
  const [updating, setUpdating] = useState(false);
  const [showResponsibilityTerm, setShowResponsibilityTerm] = useState(false);

  const handleStatusChange = async (newStatus) => {
    if (newStatus === currentStatus) return;

    setUpdating(true);
    try {
      const wasConcluida = order.status === "concluida" || order.status === "entregue";
      const willBeConcluida = newStatus === "concluida";

      const updateData = { status: newStatus };
      if (newStatus === "concluida" && !order.completion_date) updateData.completion_date = new Date().toISOString();
      if (newStatus === "entregue" && !order.delivery_date) updateData.delivery_date = new Date().toISOString();
      await base44.entities.ServiceOrder.update(order.id, updateData);

      // Ao concluir a OS, cria automaticamente um título a receber no financeiro da oficina
      if (willBeConcluida && !wasConcluida) {
        const existing = await base44.entities.PortalFinanceTransaction.filter({
          user_email: userEmail,
          source_module: "workshop",
        }).then(list => list.filter(t => t.description && t.description.includes(order.order_number)));
        if (existing.length === 0) {
          await base44.entities.PortalFinanceTransaction.create({
            user_email: userEmail,
            description: `OS ${order.order_number} — ${order.vehicle_brand || ""} ${order.vehicle_model || ""}`.trim(),
            amount: order.total || 0,
            type: "income",
            source_module: "workshop",
            category: "Ordem de Serviço",
            date: new Date().toISOString(),
            launch_date: new Date().toISOString(),
            due_date: new Date(Date.now() + 30 * 86400000).toISOString(),
            contact_name: order.client_name || "",
            status: "pending",
          });
          toast({ title: "OS concluída", description: `Título de ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(order.total || 0)} gerado no financeiro.` });
        } else {
          toast({ title: "OS concluída", description: "Status atualizado. Título financeiro já existia." });
        }
      } else if (newStatus === "cancelada" && wasConcluida) {
        const txs = await base44.entities.PortalFinanceTransaction.filter({
          user_email: userEmail,
          source_module: "workshop",
        }).then(list => list.filter(t => t.description && t.description.includes(order.order_number) && t.status === "pending"));
        for (const tx of txs) {
          await base44.entities.PortalFinanceTransaction.delete(tx.id);
        }
        toast({ title: "OS cancelada", description: "Título financeiro pendente removido." });
      } else {
        toast({ title: "Status atualizado", description: `OS marcada como ${STATUS_CONFIG[newStatus].label}.` });
      }

      setCurrentStatus(newStatus);
      order.status = newStatus;
    } catch {
      toast({ title: "Erro", description: "Não foi possível atualizar.", variant: "destructive" });
    }
    setUpdating(false);
  };

  const statusInfo = STATUS_CONFIG[currentStatus] || STATUS_CONFIG.aberta;

  return (
    <div>
      <div className="flex items-center justify-between mb-4 no-print">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-gray-600">
          <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
        </Button>
        <div className="flex items-center gap-2">
          {onEdit && order.status !== "cancelada" && (
            <Button variant="outline" size="sm" onClick={onEdit} className="gap-1">
              <Pencil className="w-4 h-4" /> Editar OS
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowResponsibilityTerm(true)} className="gap-1 border-amber-200 text-amber-600 hover:bg-amber-50">
            <FileText className="w-4 h-4" /> Termo
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1">
            <Printer className="w-4 h-4" /> Imprimir
          </Button>
        </div>
      </div>

      <div id="print-area" className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between border-b pb-4">
          <div>
            <h2 className="text-xl font-bold">{order.order_number}</h2>
            <p className="text-xs text-gray-500">Aberta em {formatDate(order.created_date)}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusInfo.color}`}>{statusInfo.label}</span>
            <select
              value={currentStatus}
              onChange={e => handleStatusChange(e.target.value)}
              disabled={updating}
              className="h-8 rounded-md border border-input bg-transparent px-2 text-xs no-print"
            >
              {Object.entries(STATUS_CONFIG).map(([value, conf]) => (
                <option key={value} value={value}>{conf.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Client + Vehicle */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-xs font-semibold text-gray-400 mb-1">CLIENTE</p>
            <p className="font-semibold">{order.client_name}</p>
            {order.client_cpf_cnpj && <p className="text-xs text-gray-500">{order.client_cpf_cnpj}</p>}
            {order.client_phone && <p className="text-xs text-gray-500 flex items-center gap-1"><Phone className="w-3 h-3" /> {order.client_phone}</p>}
          </div>
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-xs font-semibold text-gray-400 mb-1">VEÍCULO</p>
            <p className="font-semibold flex items-center gap-1"><Car className="w-4 h-4 text-blue-600" /> {order.vehicle_brand} {order.vehicle_model}</p>
            <div className="text-xs text-gray-500">
              {order.vehicle_year && `Ano: ${order.vehicle_year}`}
              {order.vehicle_plate && ` • Placa: ${order.vehicle_plate}`}
              {order.vehicle_mileage ? ` • KM: ${Number(order.vehicle_mileage).toLocaleString("pt-BR")}` : ""}
            </div>
          </div>
        </div>

        {/* Mechanic + dates */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div>
            <p className="text-xs text-gray-400">Mecânico</p>
            <p className="flex items-center gap-1"><UserCog className="w-3.5 h-3.5 text-gray-400" /> {order.mechanic_name || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Previsão</p>
            <p className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-gray-400" /> {formatDate(order.scheduled_date)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Conclusão</p>
            <p>{formatDate(order.completion_date)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Garantia</p>
            <p className="flex items-center gap-1"><Shield className="w-3.5 h-3.5 text-gray-400" /> {order.warranty_months ? `${order.warranty_months} meses` : "—"}</p>
          </div>
        </div>

        {/* Complaint + diagnosis */}
        {(order.client_complaint || order.technical_diagnosis) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {order.client_complaint && (
              <div>
                <p className="text-xs font-semibold text-gray-400 mb-1">QUEIXA DO CLIENTE</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{order.client_complaint}</p>
              </div>
            )}
            {order.technical_diagnosis && (
              <div>
                <p className="text-xs font-semibold text-gray-400 mb-1">DIAGNÓSTICO TÉCNICO</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{order.technical_diagnosis}</p>
              </div>
            )}
          </div>
        )}

        {/* Items */}
        {order.items && order.items.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-400 mb-2">ITENS DA ORDEM DE SERVIÇO</p>
            <table className="w-full text-sm border border-gray-100 rounded-lg overflow-hidden">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="p-2 font-medium">Tipo</th>
                  <th className="p-2 font-medium">Descrição</th>
                  <th className="p-2 font-medium text-center">Qtd</th>
                  <th className="p-2 font-medium text-right">Valor Unit.</th>
                  <th className="p-2 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item, idx) => (
                  <tr key={idx} className="border-t border-gray-100">
                    <td className="p-2">
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${item.type === "peca" ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600"}`}>
                        {item.type === "peca" ? "Peça" : "Serviço"}
                      </span>
                    </td>
                    <td className="p-2">{item.description}</td>
                    <td className="p-2 text-center">{item.quantity}</td>
                    <td className="p-2 text-right">{formatCurrency(item.unit_price)}</td>
                    <td className="p-2 text-right font-medium">{formatCurrency(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-full max-w-xs space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Peças:</span><span>{formatCurrency(order.parts_total)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Mão de Obra:</span><span>{formatCurrency(order.labor_total)}</span></div>
            {order.discount > 0 && <div className="flex justify-between"><span className="text-gray-500">Desconto:</span><span>- {formatCurrency(order.discount)}</span></div>}
            <div className="flex justify-between border-t pt-1 text-base font-bold">
              <span>Total:</span><span className="text-blue-600">{formatCurrency(order.total)}</span>
            </div>
          </div>
        </div>

        {/* Payment + notes */}
        <div className="grid grid-cols-2 gap-3 text-sm border-t pt-3">
          <div>
            <span className="text-xs text-gray-400">Pagamento: </span>
            <span className={`font-medium ${order.payment_status === "pago" ? "text-green-600" : order.payment_status === "parcial" ? "text-amber-600" : "text-gray-500"}`}>
              {order.payment_status === "pago" ? "Pago" : order.payment_status === "parcial" ? "Parcial" : "Pendente"}
            </span>
            {order.payment_method && <span className="text-gray-400"> • {order.payment_method}</span>}
          </div>
        </div>

        {order.notes && (
          <div className="border-t pt-3">
            <p className="text-xs font-semibold text-gray-400 mb-1">OBSERVAÇÕES</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{order.notes}</p>
          </div>
        )}

        {/* Assinaturas */}
        <div className="grid grid-cols-2 gap-8 pt-10">
          <div className="text-center">
            <div className="border-t border-gray-400 pt-1">
              <p className="text-xs text-gray-500">{order.client_name}</p>
              <p className="text-[10px] text-gray-400">Assinatura do Cliente</p>
            </div>
          </div>
          <div className="text-center">
            <div className="border-t border-gray-400 pt-1">
              <p className="text-xs text-gray-500">{order.mechanic_name || "Mecânico Responsável"}</p>
              <p className="text-[10px] text-gray-400">Assinatura do Mecânico</p>
            </div>
          </div>
        </div>
      </div>

      {showResponsibilityTerm && (
        <ResponsibilityTermModal
          order={order}
          userEmail={userEmail}
          onClose={() => setShowResponsibilityTerm(false)}
        />
      )}
    </div>
  );
}
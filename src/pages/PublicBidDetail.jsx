import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { useUserScope } from "@/hooks/useUserScope";
import EmpenhoModal from "@/components/licitacoes/EmpenhoModal";
import { ArrowLeft, Loader2, FileText, Truck, Trophy, FileSignature, CheckCircle2, XCircle } from "lucide-react";

const STATUS_LABEL = { rascunho: "Rascunho", publicado: "Publicado", em_andamento: "Em Andamento", julgamento: "Julgamento", homologado: "Homologado", empenhado: "Empenhado", entregue: "Entregue", cancelado: "Cancelado" };
const STATUS_COLOR = { rascunho: "bg-gray-100 text-gray-700", publicado: "bg-blue-100 text-blue-700", em_andamento: "bg-amber-100 text-amber-700", julgamento: "bg-purple-100 text-purple-700", homologado: "bg-emerald-100 text-emerald-700", empenhado: "bg-indigo-100 text-indigo-700", entregue: "bg-green-100 text-green-700", cancelado: "bg-red-100 text-red-700" };
const MODALITY_LABEL = { pregao_eletronico: "Pregão Eletrônico", pregao_presencial: "Pregão Presencial", concorrencia: "Concorrência", tomada_precos: "Tomada de Preços", convite: "Convite", dispensa: "Dispensa", inexigibilidade: "Inexigibilidade" };
const EMPENHO_STATUS = { emitido: "Emitido", parcial: "Parcial", liquidado: "Liquidado", pago: "Pago", cancelado: "Cancelado" };
const EMPENHO_COLOR = { emitido: "bg-blue-100 text-blue-700", parcial: "bg-amber-100 text-amber-700", liquidado: "bg-purple-100 text-purple-700", pago: "bg-emerald-100 text-emerald-700", cancelado: "bg-red-100 text-red-700" };

const fmtDate = (iso) => iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
const fmtMoney = (v) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function PublicBidDetail() {
  const { bidId } = useParams();
  const navigate = useNavigate();
  const { user } = useUserScope();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showEmpenho, setShowEmpenho] = useState(false);
  const [winnerModal, setWinnerModal] = useState(false);

  const { data: bid, isLoading } = useQuery({
    queryKey: ["public-bid", bidId],
    queryFn: () => base44.entities.PublicBid.get(bidId),
    enabled: !!bidId,
  });
  const { data: suppliers = [] } = useQuery({
    queryKey: ["bid-suppliers", user?.email],
    queryFn: () => user ? base44.entities.BidSupplier.filter({ user_email: user.email }) : [],
    enabled: !!user,
  });
  const { data: empenhos = [] } = useQuery({
    queryKey: ["empenhos", bidId],
    queryFn: () => base44.entities.PurchaseOrder.filter({ bid_id: bidId }),
    enabled: !!bidId,
  });

  const updateBid = useMutation({
    mutationFn: (data) => base44.entities.PublicBid.update(bidId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["public-bid", bidId] }); qc.invalidateQueries({ queryKey: ["public-bids"] }); }
  });
  const createEmpenho = useMutation({
    mutationFn: (data) => base44.entities.PurchaseOrder.create({ ...data, user_email: user.email, bid_id: bidId, bid_number: bid?.bid_number, agency_id: bid?.agency_id, agency_name: bid?.agency_name }),
    onSuccess: () => {
      updateBid.mutate({ status: "empenhado" });
      qc.invalidateQueries({ queryKey: ["empenhos", bidId] });
      setShowEmpenho(false);
      toast({ title: "Empenho emitido com sucesso!" });
    }
  });
  const setWinner = useMutation({
    mutationFn: (supplierId) => {
      const supplier = suppliers.find(s => s.id === supplierId);
      return base44.entities.PublicBid.update(bidId, { winner_supplier_id: supplierId, winner_supplier_name: supplier?.name || "", status: "homologado" });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["public-bid", bidId] }); setWinnerModal(false); toast({ title: "Vencedor homologado" }); }
  });

  const advanceStatus = (newStatus) => updateBid.mutate({ status: newStatus });

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>;
  if (!bid) return <div className="min-h-screen flex items-center justify-center text-gray-400">Pregão não encontrado.</div>;

  const totalRef = (bid.items || []).reduce((s, it) => s + (it.quantity * it.reference_price || 0), 0);

  return (
    <div className="min-h-screen bg-[#FAFAFB]">
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate("/licitacoes")} className="text-gray-400 hover:text-gray-600 mr-1"><ArrowLeft className="w-5 h-5" /></button>
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center"><FileText className="w-5 h-5 text-white" /></div>
            <div>
              <span className="font-bold text-gray-900 text-sm block">{bid.bid_number}</span>
              <span className="text-xs text-gray-400">{MODALITY_LABEL[bid.modality]}</span>
            </div>
          </div>
          <Badge className={`border-0 ${STATUS_COLOR[bid.status]}`}>{STATUS_LABEL[bid.status]}</Badge>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Objeto */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="font-bold text-gray-900 text-sm mb-1">Objeto</h2>
          <p className="text-sm text-gray-700">{bid.object_description}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-gray-50">
            <div><p className="text-[10px] text-gray-400 uppercase">Órgão</p><p className="text-sm font-medium text-gray-700">{bid.agency_name || "—"}</p></div>
            <div><p className="text-[10px] text-gray-400 uppercase">Abertura</p><p className="text-sm font-medium text-gray-700">{fmtDate(bid.opening_date)}</p></div>
            <div><p className="text-[10px] text-gray-400 uppercase">Encerramento</p><p className="text-sm font-medium text-gray-700">{fmtDate(bid.closing_date)}</p></div>
            <div><p className="text-[10px] text-gray-400 uppercase">Total de referência</p><p className="text-sm font-bold text-blue-700">{fmtMoney(totalRef)}</p></div>
          </div>
        </div>

        {/* Fluxo de status */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="font-bold text-gray-900 text-sm mb-3">Fluxo do Pregão</h2>
          <div className="flex flex-wrap gap-2">
            {["publicado", "em_andamento", "julgamento", "homologado", "empenhado", "entregue"].map(st => (
              <Button key={st} size="sm" variant={bid.status === st ? "default" : "outline"} disabled={updateBid.isPending} onClick={() => advanceStatus(st)} className={bid.status === st ? "bg-blue-600 text-white border-0" : ""}>
                {STATUS_LABEL[st]}
              </Button>
            ))}
            <Button size="sm" variant="outline" className="border-red-200 text-red-600 hover:bg-red-50" disabled={updateBid.isPending} onClick={() => advanceStatus("cancelado")}><XCircle className="w-3 h-3" /> Cancelar</Button>
          </div>
        </div>

        {/* Itens */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="font-bold text-gray-900 text-sm mb-3">Itens do Pregão ({bid.items?.length || 0})</h2>
          <div className="space-y-2">
            {(bid.items || []).map((it, i) => (
              <div key={i} className="flex items-center justify-between gap-3 py-2 border-b border-gray-50 last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800">{it.description}</p>
                  <p className="text-xs text-gray-400">{it.quantity} {it.unit} × {fmtMoney(it.reference_price)}</p>
                </div>
                <p className="text-sm font-semibold text-gray-700">{fmtMoney(it.quantity * it.reference_price)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Vencedor */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-gray-900 text-sm">Fornecedor Vencedor</h2>
            {!bid.winner_supplier_id && bid.status !== "cancelado" && (
              <Button size="sm" variant="outline" onClick={() => setWinnerModal(true)} className="gap-1"><Trophy className="w-3 h-3" /> Definir Vencedor</Button>
            )}
          </div>
          {bid.winner_supplier_name ? (
            <div className="flex items-center gap-3 bg-emerald-50 rounded-lg p-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center"><Truck className="w-4 h-4 text-emerald-600" /></div>
              <div><p className="font-semibold text-gray-800 text-sm">{bid.winner_supplier_name}</p><p className="text-xs text-emerald-600">Homologado</p></div>
            </div>
          ) : <p className="text-sm text-gray-400">Nenhum vencedor definido ainda.</p>}
        </div>

        {/* Empenhos */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-gray-900 text-sm">Empenhos ({empenhos.length})</h2>
            {bid.winner_supplier_id && bid.status !== "cancelado" && (
              <Button size="sm" className="gap-1 bg-blue-600 hover:bg-blue-700 text-white border-0" onClick={() => setShowEmpenho(true)}><FileSignature className="w-3 h-3" /> Gerar Empenho</Button>
            )}
          </div>
          {empenhos.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhum empenho emitido. Defina o vencedor para liberar a geração.</p>
          ) : (
            <div className="space-y-2">
              {empenhos.map(emp => (
                <div key={emp.id} className="flex items-center justify-between gap-3 py-3 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center"><FileSignature className="w-4 h-4 text-indigo-600" /></div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-800 text-sm">{emp.order_number}</p>
                      <p className="text-xs text-gray-400">{emp.supplier_name} • Entrega: {fmtDate(emp.delivery_date)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-indigo-700 text-sm">{fmtMoney(emp.total_value)}</p>
                    <Badge className={`text-[9px] border-0 mt-1 ${EMPENHO_COLOR[emp.status]}`}>{EMPENHO_STATUS[emp.status]}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showEmpenho && <EmpenhoModal bid={bid} suppliers={suppliers} onSave={(d) => createEmpenho.mutate(d)} onClose={() => setShowEmpenho(false)} />}

      {winnerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setWinnerModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-900 mb-3">Selecionar Fornecedor Vencedor</h3>
            {suppliers.length === 0 ? <p className="text-sm text-gray-400">Cadastre fornecedores primeiro.</p> : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {suppliers.map(s => (
                  <button key={s.id} onClick={() => setWinner.mutate(s.id)} className="w-full text-left p-3 rounded-lg border border-gray-100 hover:border-blue-300 hover:bg-blue-50 transition">
                    <p className="font-medium text-gray-800 text-sm">{s.name}</p>
                    <p className="text-xs text-gray-400">{s.cnpj ? `CNPJ ${s.cnpj}` : "—"} • {s.city}/{s.uf}</p>
                  </button>
                ))}
              </div>
            )}
            <Button variant="outline" className="w-full mt-4" onClick={() => setWinnerModal(false)}>Fechar</Button>
          </div>
        </div>
      )}
    </div>
  );
}
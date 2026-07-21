import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { useUserScope } from "@/hooks/useUserScope";
import AgencyFormModal from "@/components/licitacoes/AgencyFormModal";
import SupplierFormModal from "@/components/licitacoes/SupplierFormModal";
import BidFormModal from "@/components/licitacoes/BidFormModal";
import { Gavel, Building2, Truck, Plus, Search, ArrowLeft, FileText, Loader2 } from "lucide-react";

const MODALITY_LABEL = {
  pregao_eletronico: "Pregão Eletrônico",
  pregao_presencial: "Pregão Presencial",
  concorrencia: "Concorrência",
  tomada_precos: "Tomada de Preços",
  convite: "Convite",
  dispensa: "Dispensa",
  inexigibilidade: "Inexigibilidade",
};

const STATUS_LABEL = {
  rascunho: "Rascunho",
  publicado: "Publicado",
  em_andamento: "Em Andamento",
  julgamento: "Julgamento",
  homologado: "Homologado",
  empenhado: "Empenhado",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

const STATUS_COLOR = {
  rascunho: "bg-gray-100 text-gray-700",
  publicado: "bg-blue-100 text-blue-700",
  em_andamento: "bg-amber-100 text-amber-700",
  julgamento: "bg-purple-100 text-purple-700",
  homologado: "bg-emerald-100 text-emerald-700",
  empenhado: "bg-indigo-100 text-indigo-700",
  entregue: "bg-green-100 text-green-700",
  cancelado: "bg-red-100 text-red-700",
};

export default function PublicBids() {
  const navigate = useNavigate();
  const { user, loadingUser } = useUserScope();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState("pregoes");
  const [search, setSearch] = useState("");
  const [showAgency, setShowAgency] = useState(null);
  const [showSupplier, setShowSupplier] = useState(null);
  const [showBid, setShowBid] = useState(null);

  const { data: agencies = [], isLoading: la } = useQuery({
    queryKey: ["public-agencies", user?.email],
    queryFn: () => user ? base44.entities.PublicAgency.filter({ user_email: user.email }) : [],
    enabled: !!user,
  });
  const { data: suppliers = [], isLoading: ls } = useQuery({
    queryKey: ["bid-suppliers", user?.email],
    queryFn: () => user ? base44.entities.BidSupplier.filter({ user_email: user.email }) : [],
    enabled: !!user,
  });
  const { data: bids = [], isLoading: lb } = useQuery({
    queryKey: ["public-bids", user?.email],
    queryFn: () => user ? base44.entities.PublicBid.filter({ user_email: user.email }, "-created_date", 100) : [],
    enabled: !!user,
  });

  const saveAgency = useMutation({
    mutationFn: (data) => data.id ? base44.entities.PublicAgency.update(data.id, data) : base44.entities.PublicAgency.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["public-agencies"] }); setShowAgency(null); toast({ title: "Órgão salvo" }); }
  });
  const saveSupplier = useMutation({
    mutationFn: (data) => data.id ? base44.entities.BidSupplier.update(data.id, data) : base44.entities.BidSupplier.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bid-suppliers"] }); setShowSupplier(null); toast({ title: "Fornecedor salvo" }); }
  });
  const saveBid = useMutation({
    mutationFn: (data) => {
      const total = (data.items || []).reduce((s, it) => s + (it.quantity * it.reference_price || 0), 0);
      const payload = { ...data, total_value: total };
      return data.id ? base44.entities.PublicBid.update(data.id, payload) : base44.entities.PublicBid.create(payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["public-bids"] }); setShowBid(null); toast({ title: "Pregão salvo" }); }
  });

  const filteredBids = bids.filter(b => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (b.bid_number || "").toLowerCase().includes(q) || (b.object_description || "").toLowerCase().includes(q) || (b.agency_name || "").toLowerCase().includes(q);
  }).sort((a, b) => {
    const ORDER = { em_andamento: 0, publicado: 1, julgamento: 2, homologado: 3, empenhado: 4, rascunho: 5, entregue: 6, cancelado: 7 };
    return (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9);
  });

  if (loadingUser) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>;

  return (
    <div className="min-h-screen bg-[#FAFAFB]">
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate("/")} className="text-gray-400 hover:text-gray-600 mr-1"><ArrowLeft className="w-5 h-5" /></button>
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center"><Gavel className="w-5 h-5 text-white" /></div>
            <div>
              <span className="font-bold text-gray-900 text-sm block">Licitações Públicas</span>
              <span className="text-xs text-gray-400">Vendas para órgãos públicos</span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
          <button onClick={() => setTab("pregoes")} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === "pregoes" ? "bg-white text-blue-700 shadow-sm" : "text-gray-500"}`}>Pregões</button>
          <button onClick={() => setTab("orgaos")} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === "orgaos" ? "bg-white text-blue-700 shadow-sm" : "text-gray-500"}`}>Órgãos</button>
          <button onClick={() => setTab("fornecedores")} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === "fornecedores" ? "bg-white text-blue-700 shadow-sm" : "text-gray-500"}`}>Fornecedores</button>
        </div>

        {tab === "pregoes" && (
          <>
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative flex-1 min-w-48">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar pregão, órgão..." className="w-full h-10 pl-9 pr-3 rounded-lg border border-gray-200 bg-white text-sm" />
              </div>
              <Button className="gap-2 bg-blue-600 hover:bg-blue-700 text-white border-0" onClick={() => setShowBid({})}><Plus className="w-4 h-4" /> Novo Pregão</Button>
            </div>

            {lb ? (
              <div className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-500 mx-auto" /></div>
            ) : filteredBids.length === 0 ? (
              <div className="text-center py-16 text-gray-400 border border-dashed border-gray-200 rounded-xl">
                <Gavel className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">Nenhum pregão cadastrado ainda.</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {filteredBids.map(b => (
                  <button key={b.id} onClick={() => navigate(`/licitacoes/${b.id}`)} className="w-full text-left bg-white rounded-xl border border-gray-100 p-4 hover:border-blue-200 hover:shadow-sm transition-all">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0"><FileText className="w-5 h-5 text-blue-600" /></div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-gray-900 text-sm">{b.bid_number}</span>
                            <Badge className={`text-[10px] border-0 ${STATUS_COLOR[b.status]}`}>{STATUS_LABEL[b.status]}</Badge>
                            <span className="text-[10px] text-gray-400">{MODALITY_LABEL[b.modality]}</span>
                          </div>
                          <p className="text-sm text-gray-700 mt-0.5 line-clamp-1">{b.object_description}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{b.agency_name || "—"} • {b.items?.length || 0} item(ns)</p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-blue-700">{(b.total_value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
                        {b.winner_supplier_name && <p className="text-[10px] text-gray-400 mt-1">Vencedor: {b.winner_supplier_name}</p>}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "orgaos" && (
          <>
            <div className="flex justify-end">
              <Button className="gap-2 bg-blue-600 hover:bg-blue-700 text-white border-0" onClick={() => setShowAgency({})}><Plus className="w-4 h-4" /> Novo Órgão</Button>
            </div>
            {la ? <div className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-500 mx-auto" /></div> : agencies.length === 0 ? (
              <div className="text-center py-16 text-gray-400 border border-dashed border-gray-200 rounded-xl"><Building2 className="w-10 h-10 mx-auto mb-2 text-gray-300" /><p className="text-sm">Nenhum órgão cadastrado.</p></div>
            ) : (
              <div className="grid gap-2">
                {agencies.map(a => (
                  <button key={a.id} onClick={() => setShowAgency(a)} className="w-full text-left bg-white rounded-xl border border-gray-100 p-4 hover:border-blue-200 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center"><Building2 className="w-4 h-4 text-gray-500" /></div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-gray-900 text-sm">{a.name}</p>
                        <p className="text-xs text-gray-400">{a.cnpj ? `CNPJ ${a.cnpj}` : "—"} • {a.contact_person || "Sem contato"}</p>
                      </div>
                      <p className="text-xs text-gray-400">{a.city}/{a.uf}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "fornecedores" && (
          <>
            <div className="flex justify-end">
              <Button className="gap-2 bg-blue-600 hover:bg-blue-700 text-white border-0" onClick={() => setShowSupplier({})}><Plus className="w-4 h-4" /> Novo Fornecedor</Button>
            </div>
            {ls ? <div className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-500 mx-auto" /></div> : suppliers.length === 0 ? (
              <div className="text-center py-16 text-gray-400 border border-dashed border-gray-200 rounded-xl"><Truck className="w-10 h-10 mx-auto mb-2 text-gray-300" /><p className="text-sm">Nenhum fornecedor cadastrado.</p></div>
            ) : (
              <div className="grid gap-2">
                {suppliers.map(s => (
                  <button key={s.id} onClick={() => setShowSupplier(s)} className="w-full text-left bg-white rounded-xl border border-gray-100 p-4 hover:border-blue-200 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center"><Truck className="w-4 h-4 text-gray-500" /></div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-gray-900 text-sm">{s.name}</p>
                        <p className="text-xs text-gray-400">{s.cnpj ? `CNPJ ${s.cnpj}` : "—"} • {s.contact_person || "Sem contato"}</p>
                      </div>
                      <p className="text-xs text-gray-400">{s.city}/{s.uf}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {showAgency && <AgencyFormModal initial={showAgency.id ? showAgency : null} onSave={(d) => saveAgency.mutate({ ...d, user_email: user.email, id: showAgency.id })} onClose={() => setShowAgency(null)} />}
      {showSupplier && <SupplierFormModal initial={showSupplier.id ? showSupplier : null} onSave={(d) => saveSupplier.mutate({ ...d, user_email: user.email, id: showSupplier.id })} onClose={() => setShowSupplier(null)} />}
      {showBid && <BidFormModal initial={showBid.id ? showBid : null} agencies={agencies} onSave={(d) => saveBid.mutate({ ...d, user_email: user.email, id: showBid.id })} onClose={() => setShowBid(null)} />}
    </div>
  );
}
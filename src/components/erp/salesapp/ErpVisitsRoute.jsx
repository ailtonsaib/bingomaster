import { useState, useEffect, useMemo } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { fmtDate } from "@/lib/erpUtils";
import { Search, MapPin, GripVertical, Route } from "lucide-react";

const VISIT_STATUS = {
  vendido: { label: "Vendeu", color: "bg-emerald-100 text-emerald-700", border: "border-l-emerald-500" },
  sem_venda: { label: "Sem venda", color: "bg-amber-100 text-amber-700", border: "border-l-amber-400" },
  pendente: { label: "Sem visita", color: "bg-gray-100 text-gray-600", border: "border-l-gray-300" },
};
const VISIT_FREQ = { semanal: "Semanal", bissemanal: "Bissemanal", quinzenal: "Quinzenal", mensal: "Mensal" };
const WEEKDAYS = { segunda: "Segunda", terca: "Terça", quarta: "Quarta", quinta: "Quinta", sexta: "Sexta", sabado: "Sábado" };

// Roteirização de visitas: sequência automática por endereço (município de partida → município → bairro → nome)
// com reordenação manual por arraste para o vendedor desviar de ruas bloqueadas, trânsito etc.
export default function ErpVisitsRoute({ user, customers, onRefresh, onNewOrder }) {
  const [team, setTeam] = useState([]);
  const [sellerFilter, setSellerFilter] = useState("");
  const [vSearch, setVSearch] = useState("");
  const [busyId, setBusyId] = useState("");
  const [manualOrder, setManualOrder] = useState([]);

  useEffect(() => {
    base44.entities.ErpSalesTeam.filter({ user_email: user.email }, "-created_date", 500)
      .then(list => setTeam(list.filter(t => t.is_active !== false && t.team_role === "vendedor")))
      .catch(() => setTeam([]));
  }, [user.email]);

  const seller = team.find(t => t.id === sellerFilter);

  const route = useMemo(() => {
    const list = customers.filter(c =>
      (!sellerFilter || c.vendedor_id === sellerFilter) &&
      [c.name, c.city, c.district, c.vendedor_name].map(v => String(v ?? "")).join(" ").toLowerCase().includes(vSearch.toLowerCase())
    );
    const startCity = (seller?.start_city || "").trim().toLowerCase();
    const sorted = [...list].sort((a, b) => {
      // clientes do município de partida do vendedor primeiro
      if (startCity) {
        const d = Number((a.city || "").toLowerCase() === startCity) - Number((b.city || "").toLowerCase() === startCity);
        if (d) return -d;
      }
      return (a.city || "").localeCompare(b.city || "", "pt-BR")
        || (a.district || "").localeCompare(b.district || "", "pt-BR")
        || (a.name || "").localeCompare(b.name || "", "pt-BR");
    });
    if (manualOrder.length === 0) return sorted;
    // ordem ajustada manualmente (arraste) prevalece; clientes novos entram no fim
    return [...sorted].sort((a, b) => {
      const ia = manualOrder.indexOf(a.id), ib = manualOrder.indexOf(b.id);
      return (ia === -1 ? Infinity : ia) - (ib === -1 ? Infinity : ib);
    });
  }, [customers, sellerFilter, vSearch, manualOrder, seller]);

  const onDragEnd = (result) => {
    if (!result.destination || result.destination.index === result.source.index) return;
    const ids = route.map(c => c.id);
    const [moved] = ids.splice(result.source.index, 1);
    ids.splice(result.destination.index, 0, moved);
    setManualOrder(ids);
  };

  // Visita sem venda: o vendedor informa o motivo e o cliente fica amarelo — pode voltar depois e vender
  const handleNoSale = async (c) => {
    const reason = prompt(`Motivo da não venda para ${c.name}:`);
    if (!reason || !reason.trim()) { alert("Informe o motivo da não venda."); return; }
    setBusyId(c.id);
    try {
      await base44.entities.ErpCustomer.update(c.id, {
        visit_status: "sem_venda",
        no_sale_reason: reason.trim(),
        last_visit_date: new Date().toISOString(),
      });
      onRefresh();
    } catch (e) { alert(e.message); }
    setBusyId("");
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={vSearch} onChange={e => setVSearch(e.target.value)} placeholder="Buscar cliente, cidade, bairro..." className="w-full h-9 rounded-md border border-input bg-transparent pl-9 pr-3 text-sm" />
        </div>
        <select value={sellerFilter} onChange={e => { setSellerFilter(e.target.value); setManualOrder([]); }} className="h-9 rounded-md border border-input bg-white px-3 text-sm">
          <option value="">Vendedor: todos</option>
          {team.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <p className="text-xs text-gray-500 whitespace-nowrap">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 mr-1 align-middle"></span>fez pedido
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400 ml-2 mr-1 align-middle"></span>visitado sem venda
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-gray-300 ml-2 mr-1 align-middle"></span>sem visita
        </p>
      </div>

      {seller && (seller.start_address || seller.start_district || seller.start_city) && (
        <p className="text-xs text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-md px-2 py-1.5 inline-flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5" /> Ponto de partida: {[seller.start_address, seller.start_district, seller.start_city].filter(Boolean).join(" — ")}
        </p>
      )}

      <p className="text-xs text-gray-400 flex items-center gap-1">
        <Route className="w-3.5 h-3.5" /> Rota sequenciada por município e bairro a partir do ponto de partida — arraste os clientes para ajustar o trajeto (ruas bloqueadas, trânsito etc.).
      </p>

      {route.length === 0 ? (
        <div className="bg-white rounded-xl border p-8 text-center text-gray-400">Nenhum cliente ativo no filtro.</div>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="rota-visitas">
            {(drop) => (
              <div ref={drop.innerRef} {...drop.droppableProps} className="space-y-2">
                {route.map((c, idx) => {
                  const st = VISIT_STATUS[c.visit_status] || VISIT_STATUS.pendente;
                  const days = [c.visit_day_1, c.visit_day_2].filter(Boolean).map(d => WEEKDAYS[d] || d).join(" e ");
                  return (
                    <Draggable key={c.id} draggableId={c.id} index={idx}>
                      {(provided, snapshot) => (
                        <div ref={provided.innerRef} {...provided.draggableProps}
                          className={`rounded-xl border border-l-4 p-3 flex flex-wrap items-center gap-2 ${st.border} ${snapshot.isDragging ? "shadow-lg bg-indigo-50" : "bg-white"}`}>
                          <div {...provided.dragHandleProps} className="p-0.5 text-gray-300 hover:text-gray-500 cursor-grab">
                            <GripVertical className="w-4 h-4" />
                          </div>
                          <span className="w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0">{idx + 1}</span>
                          <div className="flex-1 min-w-[220px]">
                            <p className="font-semibold text-sm">{c.name}</p>
                            <p className="text-xs text-gray-500">
                              {c.address ? `${c.address} — ` : ""}{c.district || "—"}/{c.city || "—"} · Vendedor: {c.vendedor_name || "—"}
                            </p>
                            <p className="text-xs text-gray-500">
                              Visita: {VISIT_FREQ[c.visit_frequency] || "não configurada"}{days ? ` — ${days}` : ""}
                              {c.last_visit_date ? ` · Última: ${fmtDate(c.last_visit_date)}` : ""}
                            </p>
                            {c.no_sale_reason && <p className="text-xs text-amber-700">Motivo da não venda: {c.no_sale_reason}</p>}
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span>
                          <div className="flex gap-1.5">
                            <Button size="sm" className="h-7 bg-emerald-600 hover:bg-emerald-700" onClick={() => onNewOrder({ seller_id: c.vendedor_id || sellerFilter || "", customer_id: c.id })}>Fazer Pedido</Button>
                            <Button size="sm" variant="outline" className="h-7 text-amber-700 border-amber-300" disabled={busyId === c.id} onClick={() => handleNoSale(c)}>
                              {busyId === c.id ? "Salvando..." : "Visita sem Venda"}
                            </Button>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  );
                })}
                {drop.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}
    </div>
  );
}
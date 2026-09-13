import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Plus, Search, Trash2, Factory, Play, CheckCircle2, PackagePlus, Calculator, Timer } from "lucide-react";
import ErpProductionFormModal from "./ErpProductionFormModal";
import ErpProductionCompleteModal from "./ErpProductionCompleteModal";
import ErpProductionRecostModal from "./ErpProductionRecostModal";
import ErpProductionApontamentoModal, { minsBetween, fmtDuration, fmtDateTime, lunchMinutes } from "./ErpProductionApontamentoModal";
import { fmtDate, fmtMoney, PRODUCTION_STATUS } from "@/lib/erpUtils";
import { computeNeeded, checkStock, shortagesMessage, createWarehouseRequisition } from "@/lib/erpProductionStock";

export default function ErpProductionPanel({ user }) {
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [technicalSheets, setTechnicalSheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailReq, setDetailReq] = useState(null);
  const [completing, setCompleting] = useState(null);
  const [recosting, setRecosting] = useState(null);
  const [apontamento, setApontamento] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [o, p, t] = await Promise.all([
        base44.entities.ErpProductionOrder.filter({ user_email: user.email }, "-emission_date", 500),
        base44.entities.ErpProduct.filter({ user_email: user.email }, "-created_date", 500),
        base44.entities.ErpTechnicalSheet.filter({ user_email: user.email }, "code", 500),
      ]);
      setOrders(o); setProducts(p); setTechnicalSheets(t);
    } catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [user.email]);

  // Carrega a requisição vinculada quando abre o detalhe da OP
  useEffect(() => {
    if (!detail?.requisition_id) { setDetailReq(null); return; }
    base44.entities.ErpWarehouseRequisition.get(detail.requisition_id)
      .then(setDetailReq)
      .catch(() => setDetailReq(null));
  }, [detail]);

  const filtered = orders.filter(o => {
    const okS = statusFilter === "all" || o.status === statusFilter;
    const t = (o.order_number + " " + (o.output_product_name || "")).toLowerCase();
    return okS && t.includes(search.toLowerCase());
  });

  const handleDelete = async (o) => {
    if (!confirm(`Excluir a ordem "${o.order_number}"?`)) return;
    await base44.entities.ErpProductionOrder.delete(o.id);
    load();
  };

  // Gerar solicitação ao almoxarifado (OP em standby ou OP sem solicitação)
  const handleGenerateRequisition = async (o) => {
    const needed = computeNeeded(o.bom_items, o.output_quantity);
    if (!needed.length) { alert("Esta OP não possui insumos no BOM — nada a solicitar."); return; }
    const shortages = checkStock(products, needed);
    let proceed = true;
    if (shortages.length) {
      proceed = confirm(`Os seguintes insumos AINDA estão sem estoque suficiente:\n\n${shortagesMessage(shortages)}\n\nDeseja prosseguir? A solicitação ao almoxarifado será gerada mesmo assim.\n\n[OK] = Prosseguir e gerar solicitação\n[Cancelar] = Manter a OP em standby`);
    }
    if (!proceed) return;
    setBusy(o.id);
    try {
      // OP de subproduto: referencia a OP de produto acabado de origem
      const parent = o.parent_order_number ? orders.find(x => x.order_number === o.parent_order_number) : null;
      const req = await createWarehouseRequisition(user, {
        production_order_id: o.id,
        production_order_number: o.order_number,
        finished_order_number: parent ? parent.order_number : undefined,
        finished_product_name: parent ? parent.output_product_name : undefined,
        items: needed,
      });
      await base44.entities.ErpProductionOrder.update(o.id, {
        status: o.status === "standby" ? "rascunho" : o.status,
        requisition_id: req.id,
        requisition_number: req.number,
      });
      alert(`Solicitação ao almoxarifado gerada: ${req.number}`);
      load();
    } catch (e) { alert("Erro ao gerar solicitação: " + e.message); }
    setBusy(null);
  };

  // Iniciar produção
  const handleStart = async (o) => {
    await base44.entities.ErpProductionOrder.update(o.id, { status: "em_producao", start_date: new Date().toISOString() });
    load();
  };

  // Concluir produção: abre a janela com a quantidade real produzida, o
  // consumo teórico x requisitado e a valoração pelos insumos consumidos
  const handleComplete = (o) => setCompleting(o);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar ordem..." className="w-full h-9 rounded-md border border-input bg-transparent pl-9 pr-3 text-sm" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm">
          <option value="all">Todos os status</option>
          {Object.entries(PRODUCTION_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <Button size="sm" onClick={() => { setEditing(null); setShowForm(true); }} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
          <Plus className="w-4 h-4" /> Nova OP
        </Button>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-gray-500 text-xs">
              <tr>
                <th className="p-2 text-left">OP</th>
                <th className="p-2 text-left">Produto</th>
                <th className="p-2 text-right">Qtd</th>
                <th className="p-2 text-right">Insumos</th>
                <th className="p-2 text-left">Emissão</th>
                <th className="p-2 text-left">Status</th>
                <th className="p-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="p-6 text-center text-gray-400">Carregando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-gray-400">
                  <Factory className="w-10 h-10 mx-auto mb-2 opacity-30" /> Nenhuma ordem de produção.
                </td></tr>
              ) : filtered.map(o => {
                const st = PRODUCTION_STATUS[o.status] || { label: o.status, color: "text-gray-700 bg-gray-100" };
                return (
                  <tr key={o.id} className="border-t hover:bg-gray-50 cursor-pointer" onClick={() => setDetail(o)}>
                    <td className="p-2 font-mono text-xs">{o.order_number}{o.parent_order_number && <span className="block text-[10px] text-gray-400">↳ {o.parent_order_number}</span>}</td>
                    <td className="p-2 font-medium">{o.output_product_name}</td>
                    <td className="p-2 text-right">{o.output_quantity}</td>
                    <td className="p-2 text-right">{o.bom_items?.length || 0}</td>
                    <td className="p-2 text-gray-600">{fmtDate(o.emission_date)}</td>
                    <td className="p-2"><span className={`text-xs px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span></td>
                    <td className="p-2 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                      {o.status === "standby" && (
                        <button onClick={() => handleGenerateRequisition(o)} disabled={busy === o.id} title="Gerar solicitação ao almoxarifado" className="p-1 hover:bg-amber-50 rounded">
                          <PackagePlus className={`w-4 h-4 text-amber-600 ${busy === o.id ? "animate-spin" : ""}`} />
                        </button>
                      )}
                      {!o.requisition_id && o.status === "rascunho" && (
                        <button onClick={() => handleGenerateRequisition(o)} disabled={busy === o.id} title="Gerar solicitação ao almoxarifado" className="p-1 hover:bg-amber-50 rounded">
                          <PackagePlus className="w-4 h-4 text-amber-600" />
                        </button>
                      )}
                      {o.status === "rascunho" && (
                        <button onClick={() => handleStart(o)} title="Iniciar produção" className="p-1 hover:bg-blue-50 rounded"><Play className="w-4 h-4 text-blue-600" /></button>
                      )}
                      {o.status === "em_producao" && (
                        <button onClick={() => handleComplete(o)} disabled={busy === o.id} title="Concluir e atualizar estoque" className="p-1 hover:bg-emerald-50 rounded">
                          <CheckCircle2 className={`w-4 h-4 text-emerald-600 ${busy === o.id ? "animate-spin" : ""}`} />
                        </button>
                      )}
                      {o.status === "concluida" && (
                        <button onClick={() => setRecosting(o)} title="Recalcular custo da produção" className="p-1 hover:bg-amber-50 rounded">
                          <Calculator className="w-4 h-4 text-amber-600" />
                        </button>
                      )}
                      {o.status !== "cancelada" && (
                        <button onClick={() => setApontamento(o)} title="Apontamento — horários e paradas de produção" className="p-1 hover:bg-indigo-50 rounded">
                          <Timer className="w-4 h-4 text-indigo-600" />
                        </button>
                      )}
                      <button onClick={() => { setEditing(o); setShowForm(true); }} className="p-1 hover:bg-gray-100 rounded"><span className="text-xs">✏️</span></button>
                      <button onClick={() => handleDelete(o)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <ErpProductionFormModal user={user} order={editing} products={products} technicalSheets={technicalSheets} onClose={() => setShowForm(false)} onSaved={load} />
      )}

      {completing && (
        <ErpProductionCompleteModal user={user} order={completing} products={products} onClose={() => setCompleting(null)} onSaved={() => { setCompleting(null); load(); }} />
      )}

      {recosting && (
        <ErpProductionRecostModal user={user} order={recosting} products={products} onClose={() => setRecosting(null)} onSaved={() => { setRecosting(null); load(); }} />
      )}

      {apontamento && (
        <ErpProductionApontamentoModal user={user} order={apontamento} onClose={() => setApontamento(null)} onSaved={load} />
      )}

      {detail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setDetail(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="font-bold">{detail.order_number}</h2>
              <button onClick={() => setDetail(null)} className="p-1 hover:bg-gray-100 rounded text-gray-500">✕</button>
            </div>
            <div className="p-4 space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-gray-500">Produto: </span><b>{detail.output_product_name}</b></div>
                <div><span className="text-gray-500">Qtd planejada: </span><b>{detail.output_quantity}</b></div>
                <div><span className="text-gray-500">Produzida: </span><b>{detail.produced_quantity || 0}</b></div>
                <div><span className="text-gray-500">Status: </span><b>{(PRODUCTION_STATUS[detail.status] || {}).label}</b></div>
                {detail.parent_order_number && <div><span className="text-gray-500">OP de origem: </span><b>{detail.parent_order_number}</b></div>}
                {detail.requisition_number && <div><span className="text-gray-500">Solicitação almoxarifado: </span><b>{detail.requisition_number}</b></div>}
                {detail.complementary_requisition_number && <div><span className="text-gray-500">Requisição complementar: </span><b>{detail.complementary_requisition_number}</b></div>}
                {detail.parts_requisition_number && <div><span className="text-gray-500">Req. peças substituídas: </span><b>{detail.parts_requisition_number}</b></div>}
                {Number(detail.input_cost_total) > 0 && <div><span className="text-gray-500">Custo dos insumos consumidos: </span><b>{fmtMoney(detail.input_cost_total)}</b></div>}
                {Number(detail.output_unit_cost) > 0 && <div><span className="text-gray-500">Custo unitário produzido: </span><b>{fmtMoney(detail.output_unit_cost)}</b></div>}
              </div>
              {detailReq && detailReq.items?.length > 0 && (
                <div>
                  <p className="font-semibold mb-1">Itens requisitados ao almoxarifado ({detailReq.number}):</p>
                  <table className="w-full text-xs border rounded">
                    <thead className="bg-gray-100"><tr><th className="p-1.5 text-left">Insumo</th><th className="p-1.5 text-right">Solicitado</th><th className="p-1.5 text-right">Estoque na ocasião</th></tr></thead>
                    <tbody>
                      {detailReq.items.map((it, i) => (
                        <tr key={i} className="border-t"><td className="p-1.5">{it.product_name}</td><td className="p-1.5 text-right">{it.quantity} {it.unit}</td><td className="p-1.5 text-right">{it.stock_at_request}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div>
                <p className="font-semibold mb-1">Insumos consumidos:</p>
                {detail.bom_items?.length ? (
                  <table className="w-full text-xs border rounded">
                    <thead className="bg-gray-100"><tr><th className="p-1.5 text-left">Insumo</th><th className="p-1.5 text-right">Por unid.</th><th className="p-1.5 text-right">Consumo teórico</th>{detailReq && <th className="p-1.5 text-right">Requisitado</th>}</tr></thead>
                    <tbody>
                      {detail.bom_items.map((b, i) => (
                        <tr key={i} className="border-t"><td className="p-1.5">{b.product_name}</td><td className="p-1.5 text-right">{b.quantity_per_unit} {b.unit}</td><td className="p-1.5 text-right">{b.total_consumed || (Number(b.quantity_per_unit) * detail.output_quantity)}</td>{detailReq && <td className="p-1.5 text-right">{detailReq.items?.find(it => it.product_id === b.product_id)?.quantity ?? "—"}</td>}</tr>
                      ))}
                    </tbody>
                  </table>
                ) : <p className="text-gray-400">Sem insumos.</p>}
              </div>
              {detail.loss_items?.length > 0 && (
                <div>
                  <p className="font-semibold mb-1 text-red-600">Insumos considerados perda ({fmtMoney(detail.loss_items.reduce((s, l) => s + (Number(l.value) || 0), 0))}):</p>
                  <table className="w-full text-xs border rounded">
                    <tbody>
                      {detail.loss_items.map((l, i) => (
                        <tr key={i} className="border-t"><td className="p-1.5">{l.product_name}</td><td className="p-1.5 text-right">{l.quantity} {l.unit}</td><td className="p-1.5 text-right text-red-600">{fmtMoney(l.value || 0)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {detail.wip_items?.length > 0 && (
                <div>
                  <p className="font-semibold mb-1 text-amber-600">Insumos deixados em processo — WIP ({fmtMoney(detail.wip_items.reduce((s, l) => s + (Number(l.value) || 0), 0))}):</p>
                  <table className="w-full text-xs border rounded">
                    <tbody>
                      {detail.wip_items.map((l, i) => (
                        <tr key={i} className="border-t"><td className="p-1.5">{l.product_name}</td><td className="p-1.5 text-right">{l.quantity} {l.unit}</td><td className="p-1.5 text-right text-amber-600">{fmtMoney(l.value || 0)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {(detail.start_datetime || detail.end_datetime || (detail.stops || []).length > 0) && (() => {
                const grossMin = minsBetween(detail.start_datetime, detail.end_datetime);
                const lunchMin = grossMin > 0 ? lunchMinutes(detail.lunch_start, detail.lunch_end) : 0;
                const availableMin = grossMin - lunchMin;
                const downtimeMin = (detail.stops || []).reduce((s, st) => s + minsBetween(st.start_time, st.end_time), 0);
                const efficiency = availableMin > 0 ? Math.max(0, Math.round(((availableMin - downtimeMin) / availableMin) * 100)) : null;
                return (
                  <div>
                    <p className="font-semibold mb-1 text-indigo-700">Apontamento de produção:</p>
                    <div className="text-xs space-y-0.5 pl-2 border-l-2 border-indigo-200">
                      <div>Início: <b>{fmtDateTime(detail.start_datetime)}</b> — Fim: <b>{fmtDateTime(detail.end_datetime)}</b>{detail.lunch_start && <> (refeição: {detail.lunch_start} às {detail.lunch_end || "—"})</>}</div>
                      <div>Tempo disponível: <b>{fmtDuration(availableMin)}</b> • Paradas: <b className="text-red-600">{fmtDuration(downtimeMin)}</b> ({(detail.stops || []).length} registro(s)) • Efetivo: <b className="text-emerald-700">{fmtDuration(availableMin - downtimeMin)}</b>{efficiency !== null && <> • Eficiência: <b>{efficiency}%</b></>}</div>
                      {Number(detail.extra_cost_total) > 0 && <div>Custo extra das paradas (agregado ao custo de produção): <b className="text-red-600">{fmtMoney(detail.extra_cost_total)}</b></div>}
                      {(detail.stops || []).length > 0 && (
                        <table className="w-full text-xs border rounded mt-1">
                          <thead className="bg-gray-100"><tr><th className="p-1.5 text-left">Motivo</th><th className="p-1.5 text-left">Equipamento</th><th className="p-1.5 text-right">Duração</th><th className="p-1.5 text-right">Pessoas</th><th className="p-1.5 text-right">Custo extra</th></tr></thead>
                          <tbody>
                            {(detail.stops || []).map((st, i) => (
                              <tr key={i} className="border-t">
                                <td className="p-1.5">{(st.type === "mecanica" && "Mecânica") || (st.type === "eletrica" && "Elétrica") || "Operacional"}{st.replaced_part ? " — substituiu peça" : ""}{st.notes ? ` (${st.notes})` : ""}{(st.parts || []).length > 0 && <span className="block text-[10px] text-gray-500">{st.parts.map(p => `${p.quantity}x ${p.product_name}`).join(", ")}</span>}</td>
                                <td className="p-1.5">{st.equipment_name || "—"}</td>
                                <td className="p-1.5 text-right">{fmtDuration(minsBetween(st.start_time, st.end_time))}</td>
                                <td className="p-1.5 text-right">{st.people_count || "—"}</td>
                                <td className="p-1.5 text-right">{Number(st.extra_cost) > 0 ? fmtMoney(st.extra_cost) : "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
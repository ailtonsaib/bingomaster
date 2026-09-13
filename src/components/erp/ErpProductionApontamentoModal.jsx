import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Timer } from "lucide-react";
import ErpStopPartsModal from "./ErpStopPartsModal";
import { fmtMoney } from "@/lib/erpUtils";
import { createWarehouseRequisition, sumMaterials } from "@/lib/erpProductionStock";

const STOP_TYPES = { mecanica: "Parada Mecânica", eletrica: "Parada Elétrica", operacional: "Parada Operacional" };
const STOP_COLORS = { mecanica: "text-amber-700 bg-amber-100", eletrica: "text-blue-700 bg-blue-100", operacional: "text-gray-700 bg-gray-100" };

// Helpers de duração do apontamento — compartilhados com o painel de produção
export const minsBetween = (a, b) => (a && b ? Math.max(0, Math.round((new Date(b) - new Date(a)) / 60000)) : 0);
export const fmtDuration = (min) => min >= 60 ? `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, "0")}min` : `${min}min`;
export const fmtDateTime = (v) => v ? new Date(v).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
export const lunchMinutes = (s, e) => {
  if (!s || !e) return 0;
  const [sh, sm] = String(s).split(":").map(Number);
  const [eh, em] = String(e).split(":").map(Number);
  return Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
};

// Apontamento da ordem de produção: horário de início/fim, parada para refeição
// e registro das paradas (mecânicas/elétricas/operacionais) com equipamento,
// horário dentro do período de produção, pessoas envolvidas, troca de peça,
// custo extra e observações — base da eficiência e do custo extra da produção.
export default function ErpProductionApontamentoModal({ user, order, onClose, onSaved }) {
  const [form, setForm] = useState({
    start_datetime: order.start_datetime || "",
    end_datetime: order.end_datetime || "",
    lunch_start: order.lunch_start || "",
    lunch_end: order.lunch_end || "",
  });
  const [stops, setStops] = useState(order.stops || []);
  const [equipment, setEquipment] = useState([]);
  const [newStop, setNewStop] = useState({ type: "operacional", equipment_id: "", start_time: "", end_time: "", people_count: 1, replaced_part: false, extra_cost: "", notes: "", parts: [] });
  const [partsModal, setPartsModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const setNS = (k, v) => setNewStop(prev => ({ ...prev, [k]: v }));

  // Peças substituídas: produto do cadastro (material de consumo) + quantidade,
  // custo da peça e custo extra do serviço — o total alimenta o custo extra da parada
  const applyParts = ({ parts, serviceExtraCost }) => {
    const total = Math.round((parts.reduce((s, p) => s + (Number(p.value) || 0), 0) + serviceExtraCost) * 100) / 100;
    setNS("parts", parts);
    setNS("extra_cost", String(total));
    setPartsModal(false);
  };
  const toggleReplacedPart = (checked) => {
    setNS("replaced_part", checked);
    if (checked) setPartsModal(true);
    else setNS("parts", []);
  };

  useEffect(() => {
    base44.entities.ErpEquipment.filter({ user_email: user.email }, "name", 500)
      .then(setEquipment).catch(() => setEquipment([]));
  }, [user.email]);

  // Eficiência: tempo disponível (bruto − refeição) x tempo efetivo (disponível − paradas)
  const grossMin = minsBetween(form.start_datetime, form.end_datetime);
  const lunchMin = grossMin > 0 ? lunchMinutes(form.lunch_start, form.lunch_end) : 0;
  const availableMin = grossMin - lunchMin;
  const downtimeMin = stops.reduce((s, st) => s + minsBetween(st.start_time, st.end_time), 0);
  const effectiveMin = availableMin - downtimeMin;
  const efficiency = availableMin > 0 ? Math.max(0, Math.round((effectiveMin / availableMin) * 100)) : null;
  const stopsExtraCost = Math.round(stops.reduce((s, st) => s + (Number(st.extra_cost) || 0), 0) * 100) / 100;

  const addStop = () => {
    if (!form.start_datetime || !form.end_datetime) { alert("Informe primeiro a data/hora de início e de fim da produção."); return; }
    if (!newStop.start_time || !newStop.end_time) { alert("Informe a hora de início e de fim da parada."); return; }
    if (new Date(newStop.end_time) <= new Date(newStop.start_time)) { alert("A hora de fim da parada deve ser posterior à hora de início."); return; }
    if (new Date(newStop.start_time) < new Date(form.start_datetime) || new Date(newStop.end_time) > new Date(form.end_datetime)) {
      alert("A parada deve estar dentro do horário de produção (entre o início e o fim informados)."); return;
    }
    const isEqStop = newStop.type === "mecanica" || newStop.type === "eletrica";
    if (isEqStop && !newStop.equipment_id) { alert("Informe o equipamento que parou."); return; }
    const eq = equipment.find(e => e.id === newStop.equipment_id);
    setStops(prev => [...prev, {
      type: newStop.type,
      equipment_id: isEqStop ? newStop.equipment_id : "",
      equipment_name: eq ? eq.name : "",
      start_time: newStop.start_time,
      end_time: newStop.end_time,
      people_count: Number(newStop.people_count) || 0,
      replaced_part: isEqStop && !!newStop.replaced_part,
      parts: isEqStop && newStop.replaced_part ? (newStop.parts || []) : [],
      extra_cost: Number(newStop.extra_cost) || 0,
      notes: newStop.notes || "",
    }]);
    setNewStop({ type: "operacional", equipment_id: "", start_time: "", end_time: "", people_count: 1, replaced_part: false, extra_cost: "", notes: "", parts: [] });
  };

  const handleSave = async () => {
    if (form.start_datetime && form.end_datetime && new Date(form.end_datetime) <= new Date(form.start_datetime)) {
      alert("A data/hora final de produção deve ser posterior à inicial."); return;
    }
    setSaving(true);
    try {
      // Peças substituídas nas paradas: agrupa por produto e gera requisição ao
      // almoxarifado — o estoque das peças é baixado quando o almoxarifado atende
      const groupedParts = sumMaterials(stops.flatMap(st => st.parts || []));
      let partsReq = null;
      if (groupedParts.length) {
        if (order.parts_requisition_id) {
          const existing = await base44.entities.ErpWarehouseRequisition.get(order.parts_requisition_id).catch(() => null);
          if (existing && existing.status === "pendente") {
            await base44.entities.ErpWarehouseRequisition.update(existing.id, { items: groupedParts });
          } else if (existing) {
            alert("A requisição de peças substituídas já foi atendida pelo almoxarifado — o estoque já foi baixado e a requisição não será alterada.");
          }
        } else {
          partsReq = await createWarehouseRequisition(user, {
            production_order_id: order.id,
            production_order_number: order.order_number,
            items: groupedParts,
            notes: "Peças substituídas nas paradas de produção (apontamento)",
          });
        }
      }
      await base44.entities.ErpProductionOrder.update(order.id, {
        start_datetime: form.start_datetime || "",
        end_datetime: form.end_datetime || "",
        lunch_start: form.lunch_start || "",
        lunch_end: form.lunch_end || "",
        stops,
        extra_cost_total: stopsExtraCost,
        ...(partsReq ? { parts_requisition_id: partsReq.id, parts_requisition_number: partsReq.number } : {}),
      });
      alert("Apontamento salvo." + (partsReq ? `\n\nRequisição de peças substituídas gerada: ${partsReq.number} — o estoque das peças será baixado quando o almoxarifado atendê-la.` : ""));
      onSaved();
      onClose();
    } catch (e) { alert("Erro ao salvar apontamento: " + e.message); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
          <h2 className="font-bold flex items-center gap-2"><Timer className="w-5 h-5 text-indigo-600" /> Apontamento — {order.order_number}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><span className="text-gray-500">✕</span></button>
        </div>
        <div className="p-4 space-y-4 text-sm">
          <p className="text-xs text-gray-500">{order.output_product_name} • Quantidade: {order.output_quantity}</p>

          {/* Horários da produção */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><Label className="text-xs">Início da produção</Label><Input type="datetime-local" value={form.start_datetime} onChange={e => set("start_datetime", e.target.value)} /></div>
            <div><Label className="text-xs">Fim da produção</Label><Input type="datetime-local" value={form.end_datetime} onChange={e => set("end_datetime", e.target.value)} /></div>
            <div><Label className="text-xs">Refeição — início</Label><Input type="time" value={form.lunch_start} onChange={e => set("lunch_start", e.target.value)} /></div>
            <div><Label className="text-xs">Refeição — retorno</Label><Input type="time" value={form.lunch_end} onChange={e => set("lunch_end", e.target.value)} /></div>
          </div>

          {/* Eficiência */}
          {grossMin > 0 && (
            <div className="rounded-lg border bg-gray-50 p-3 grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
              <div>Tempo bruto: <b>{fmtDuration(grossMin)}</b></div>
              <div>Refeição: <b>{lunchMin ? `− ${fmtDuration(lunchMin)}` : "—"}</b></div>
              <div>Disponível: <b>{fmtDuration(availableMin)}</b></div>
              <div>Paradas: <b className="text-red-600">− {fmtDuration(downtimeMin)}</b></div>
              <div>Tempo efetivo: <b className="text-emerald-700">{fmtDuration(effectiveMin)}</b></div>
              <div>Eficiência: <b className={efficiency >= 85 ? "text-emerald-700" : efficiency >= 60 ? "text-amber-600" : "text-red-600"}>{efficiency}%</b></div>
              {stopsExtraCost > 0 && <div className="col-span-2 md:col-span-3">Custo extra das paradas (agregado ao custo do produto na conclusão): <b className="text-red-600">{fmtMoney(stopsExtraCost)}</b></div>}
            </div>
          )}

          {/* Paradas registradas */}
          <div className="border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between p-2 bg-gray-50 border-b">
              <span className="font-semibold text-xs">Paradas de produção ({stops.length})</span>
            </div>
            {stops.length === 0 ? (
              <p className="p-4 text-center text-xs text-gray-400">Nenhuma parada registrada.</p>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-gray-100 text-gray-500">
                  <tr>
                    <th className="p-2 text-left">Motivo</th>
                    <th className="p-2 text-left">Equipamento</th>
                    <th className="p-2 text-left">Início</th>
                    <th className="p-2 text-left">Fim</th>
                    <th className="p-2 text-right">Duração</th>
                    <th className="p-2 text-right">Pessoas</th>
                    <th className="p-2 text-right">Custo extra</th>
                    <th className="p-2 text-right"></th>
                  </tr>
                </thead>
                <tbody>
                  {stops.map((st, i) => (
                    <tr key={i} className="border-t align-top">
                      <td className="p-2"><span className={`px-2 py-0.5 rounded-full ${STOP_COLORS[st.type] || STOP_COLORS.operacional}`}>{STOP_TYPES[st.type] || st.type}</span>
                        {st.replaced_part && <span className="block text-[10px] text-amber-700 mt-0.5">Substituiu peça</span>}
                        {st.notes && <span className="block text-[10px] text-gray-500 mt-0.5 max-w-[220px]">{st.notes}</span>}
                        {(st.parts || []).length > 0 && <span className="block text-[10px] text-gray-500 mt-0.5">Peças: {st.parts.map(p => `${p.quantity}x ${p.product_name} (${fmtMoney(p.value)})`).join(", ")}</span>}
                      </td>
                      <td className="p-2">{st.equipment_name || "—"}</td>
                      <td className="p-2">{fmtDateTime(st.start_time)}</td>
                      <td className="p-2">{fmtDateTime(st.end_time)}</td>
                      <td className="p-2 text-right font-medium">{fmtDuration(minsBetween(st.start_time, st.end_time))}</td>
                      <td className="p-2 text-right">{st.people_count || "—"}</td>
                      <td className="p-2 text-right">{Number(st.extra_cost) > 0 ? fmtMoney(st.extra_cost) : "—"}</td>
                      <td className="p-2 text-right"><button onClick={() => setStops(prev => prev.filter((_, j) => j !== i))} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5 text-red-500" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Nova parada */}
          <div className="border rounded-lg p-3 space-y-2">
            <p className="font-semibold text-xs flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" /> Registrar parada de produção</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div>
                <Label className="text-[10px]">Motivo da parada *</Label>
                <select value={newStop.type} onChange={e => setNS("type", e.target.value)} className="w-full h-8 rounded-md border border-input px-2 text-xs">
                  <option value="operacional">Parada Operacional</option>
                  <option value="mecanica">Parada Mecânica</option>
                  <option value="eletrica">Parada Elétrica</option>
                </select>
              </div>
              {(newStop.type === "mecanica" || newStop.type === "eletrica") && (
                <div>
                  <Label className="text-[10px]">Equipamento que parou *</Label>
                  <select value={newStop.equipment_id} onChange={e => setNS("equipment_id", e.target.value)} className="w-full h-8 rounded-md border border-input px-2 text-xs">
                    <option value="">Selecione...</option>
                    {equipment.map(eq => <option key={eq.id} value={eq.id}>{eq.name}{eq.code ? ` (${eq.code})` : ""}</option>)}
                  </select>
                </div>
              )}
              <div><Label className="text-[10px]">Parou em *</Label><Input type="datetime-local" value={newStop.start_time} onChange={e => setNS("start_time", e.target.value)} className="h-8 text-xs" /></div>
              <div><Label className="text-[10px]">Concluída em *</Label><Input type="datetime-local" value={newStop.end_time} onChange={e => setNS("end_time", e.target.value)} className="h-8 text-xs" /></div>
              <div><Label className="text-[10px]">Pessoas envolvidas</Label><Input type="number" min="0" value={newStop.people_count} onChange={e => setNS("people_count", e.target.value)} className="h-8 text-xs" /></div>
              <div><Label className="text-[10px]">Custo extra (R$)</Label><Input type="number" step="0.01" min="0" value={newStop.extra_cost} onChange={e => setNS("extra_cost", e.target.value)} className="h-8 text-xs" placeholder="Peça, mão de obra..." /></div>
              {(newStop.type === "mecanica" || newStop.type === "eletrica") && (
                <div className="flex items-end gap-2 pb-1.5 text-xs">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={newStop.replaced_part} onChange={e => toggleReplacedPart(e.target.checked)} className="w-4 h-4" /> Substituiu peça
                  </label>
                  {newStop.replaced_part && (
                    <button type="button" onClick={() => setPartsModal(true)} className="text-indigo-600 underline text-[11px]">Peças ({(newStop.parts || []).length})</button>
                  )}
                </div>
              )}
            </div>
            {newStop.replaced_part && (newStop.parts || []).length > 0 && (
              <p className="text-[11px] text-gray-600">Peças substituídas: {newStop.parts.map(p => `${p.quantity}x ${p.product_name} (${fmtMoney(p.value)})`).join(", ")}</p>
            )}
            <div>
              <Label className="text-[10px]">Observações — motivo da parada, peça substituída, etc.</Label>
              <Input value={newStop.notes} onChange={e => setNS("notes", e.target.value)} className="h-8 text-xs" />
            </div>
            <Button size="sm" variant="outline" onClick={addStop} className="gap-1.5"><Plus className="w-3.5 h-3.5" /> Adicionar Parada</Button>
          </div>
        </div>
        <div className="p-4 border-t flex gap-2 justify-end sticky bottom-0 bg-white">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" disabled={saving} onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700">{saving ? "Salvando..." : "Salvar Apontamento"}</Button>
        </div>
      </div>

      {partsModal && (
        <ErpStopPartsModal user={user} parts={newStop.parts || []} onClose={() => setPartsModal(false)} onConfirm={applyParts} />
      )}
    </div>
  );
}
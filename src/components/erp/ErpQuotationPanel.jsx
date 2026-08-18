import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Search, Trash2, Gavel, X, ClipboardList, Link2, Unlink, Trophy, AlertTriangle, CheckCircle2, Send } from "lucide-react";
import { genOrderNumber, fmtMoney, fmtDate, UNITS } from "@/lib/erpUtils";
import ErpQuotationSendModal from "./ErpQuotationSendModal";
import ErpApportionmentEditor from "./ErpApportionmentEditor";

const STATUS = {
  aberta: { label: "Aberta", color: "text-blue-700 bg-blue-100" },
  fechada: { label: "Fechada", color: "text-emerald-700 bg-emerald-100" },
  cancelada: { label: "Cancelada", color: "text-red-700 bg-red-100" },
};
const MIN_SUPPLIERS = 3;

export default function ErpQuotationPanel({ user }) {
  const [items, setItems] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [finalizing, setFinalizing] = useState(null);
  const [sending, setSending] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [list, sups] = await Promise.all([
        base44.entities.ErpQuotation.filter({ user_email: user.email }, "-quotation_date", 500),
        base44.entities.ErpPartner.filter({ user_email: user.email, partner_type: { $in: ["fornecedor", "ambos"] } }, "-created_date", 500),
      ]);
      setItems(list); setSuppliers(sups);
    } catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [user.email]);

  const filtered = items.filter(o => {
    const okS = statusFilter === "all" || o.status === statusFilter;
    const t = (o.number + " " + (o.description || "") + " " + (o.requisition_number || "") + " " + (o.winner_supplier_name || "")).toLowerCase();
    return okS && t.includes(search.toLowerCase());
  });

  const handleDelete = async (o) => { if (!confirm(`Excluir tomada de preço "${o.number}"?`)) return; await base44.entities.ErpQuotation.delete(o.id); load(); };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar tomada de preço..." className="w-full h-9 rounded-md border border-input bg-transparent pl-9 pr-3 text-sm" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm">
          <option value="all">Todos os status</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <Button size="sm" onClick={() => { setEditing(null); setShowForm(true); }} className="gap-1.5 bg-indigo-600 hover:bg-indigo-700"><Plus className="w-4 h-4" /> Nova Tomada</Button>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-gray-500 text-xs">
              <tr>
                <th className="p-2 text-left">Número</th>
                <th className="p-2 text-left">Data</th>
                <th className="p-2 text-left">Solicitação</th>
                <th className="p-2 text-left">Objeto</th>
                <th className="p-2 text-right">Fornecedores</th>
                <th className="p-2 text-right">Menor Preço</th>
                <th className="p-2 text-left">Vencedor</th>
                <th className="p-2 text-left">Status</th>
                <th className="p-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={9} className="p-6 text-center text-gray-400">Carregando...</td></tr>
              : filtered.length === 0 ? <tr><td colSpan={9} className="p-8 text-center text-gray-400"><Gavel className="w-10 h-10 mx-auto mb-2 opacity-30" /> Nenhuma tomada de preço.</td></tr>
              : filtered.map(o => {
                const st = STATUS[o.status] || { label: o.status, color: "text-gray-700 bg-gray-100" };
                const nSup = (o.supplier_quotes || []).length;
                return (
                  <tr key={o.id} className="border-t hover:bg-gray-50">
                    <td className="p-2 font-mono text-xs">{o.number}</td>
                    <td className="p-2 text-gray-600">{fmtDate(o.quotation_date)}</td>
                    <td className="p-2 font-mono text-xs text-indigo-600">{o.requisition_number || "—"}</td>
                    <td className="p-2 max-w-[260px]">
                      <div className="truncate" title={o.description}>{o.description || "—"}</div>
                      {o.apportionments?.length > 0 && (
                        <div className="text-[10px] text-gray-400 mt-0.5" title={o.apportionments.map(a => `${a.department_name} • ${a.account_code || a.account_name} (${a.percent || 0}%)`).join(", ")}>
                          Setor: {o.apportionments.map(a => a.department_name).filter(Boolean).join(", ")} · {o.apportionments.length} conta(s)
                        </div>
                      )}
                    </td>
                    <td className="p-2 text-right">
                      <span className={nSup >= MIN_SUPPLIERS ? "text-emerald-600 font-medium" : "text-amber-600 font-medium"}>{nSup}</span>
                      <span className="text-gray-400 text-xs">/{MIN_SUPPLIERS}</span>
                    </td>
                    <td className="p-2 text-right font-medium">{fmtMoney(o.suggested_value)}</td>
                    <td className="p-2">{o.winner_supplier_name ? (
                      <span className="text-emerald-700 font-medium flex items-center gap-1"><Trophy className="w-3.5 h-3.5" /> {o.winner_supplier_name}</span>
                    ) : "—"}</td>
                    <td className="p-2"><span className={`text-xs px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span></td>
                    <td className="p-2 text-right whitespace-nowrap">
                      {o.status === "aberta" && (o.supplier_quotes || []).length > 0 && (
                        <button onClick={() => setSending(o)} title="Enviar ao fornecedor" className="p-1 hover:bg-indigo-50 rounded"><Send className="w-4 h-4 text-indigo-600" /></button>
                      )}
                      {o.status === "aberta" && (
                        <button onClick={() => setFinalizing(o)} title="Finalizar tomada" className="p-1 hover:bg-emerald-50 rounded"><CheckCircle2 className="w-4 h-4 text-emerald-600" /></button>
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
        <ErpQuotationForm
          user={user} quotation={editing} suppliers={suppliers}
          onClose={() => setShowForm(false)} onSaved={load}
        />
      )}
      {finalizing && (
        <FinalizeModal
          quotation={finalizing} suppliers={suppliers}
          onClose={() => setFinalizing(null)} onSaved={load}
        />
      )}
      {sending && (
        <ErpQuotationSendModal
          quotation={sending} suppliers={suppliers}
          onClose={() => setSending(null)} onSaved={load}
        />
      )}
    </div>
  );
}

function ErpQuotationForm({ user, quotation, suppliers, onClose, onSaved }) {
  const [requisitions, setRequisitions] = useState([]);
  const [setores, setSetores] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loadingReqs, setLoadingReqs] = useState(true);
  const [form, setForm] = useState({
    number: quotation?.number || genOrderNumber("TP"),
    quotation_date: quotation?.quotation_date || new Date().toISOString().slice(0, 10),
    requisition_id: quotation?.requisition_id || "",
    requisition_number: quotation?.requisition_number || "",
    description: quotation?.description || "",
    items: quotation?.items || [],
    apportionments: quotation?.apportionments || [],
    supplier_quotes: quotation?.supplier_quotes || [],
    status: quotation?.status || "aberta",
    notes: quotation?.notes || "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [list, s, a] = await Promise.all([
          base44.entities.ErpRequisition.filter({ user_email: user.email, status: { $in: ["aberta", "aprovada"] } }, "-request_date", 200),
          base44.entities.ErpSector.filter({ user_email: user.email }, "name", 500),
          base44.entities.ErpChartAccount.filter({ user_email: user.email, accepts_entries: true }, "code", 5000),
        ]);
        setRequisitions(list); setSetores(s); setAccounts(a);
      } catch (e) { console.error(e); }
      setLoadingReqs(false);
    })();
  }, [user.email]);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handlePickRequisition = (reqId) => {
    if (!reqId) { setForm(prev => ({ ...prev, requisition_id: "", requisition_number: "" })); return; }
    const req = requisitions.find(r => r.id === reqId);
    if (!req) return;
    const importedItems = (req.items || []).map(it => ({
      item_type: it.item_type || "novo",
      product_id: it.product_id || "",
      product_name: it.product_name || "",
      description: it.description || it.product_name || "",
      quantity: Number(it.quantity) || 1,
      unit: it.unit || "UN",
      unit_price: Number(it.unit_price) || 0,
      total: (Number(it.quantity) || 1) * (Number(it.unit_price) || 0),
    }));
    setForm(prev => ({
      ...prev,
      requisition_id: req.id,
      requisition_number: req.number,
      items: importedItems,
      apportionments: (req.apportionments || []).map(a => ({ ...a })),
      description: prev.description || (req.department_name ? `Solicitação ${req.number} — ${req.department_name}` : `Solicitação ${req.number}`),
    }));
  };
  const unlinkRequisition = () => setForm(prev => ({ ...prev, requisition_id: "", requisition_number: "" }));

  const addItem = () => setForm(prev => ({ ...prev, items: [...prev.items, { item_type: "novo", product_id: "", product_name: "", description: "", quantity: 1, unit: "UN", unit_price: 0, total: 0 }] }));
  const removeItem = (i) => setForm(prev => ({ ...prev, items: prev.items.filter((_, idx) => idx !== i) }));
  const updateItem = (i, field, value) => setForm(prev => {
    const items = [...prev.items]; items[i] = { ...items[i], [field]: value };
    if (["quantity", "unit_price"].includes(field)) items[i].total = (Number(items[i].quantity) || 0) * (Number(items[i].unit_price) || 0);
    return { ...prev, items };
  });

  // Supplier quotes
  const addSupplierQuote = () => setForm(prev => ({ ...prev, supplier_quotes: [...prev.supplier_quotes, { supplier_id: "", supplier_name: "", quoted_value: 0, notes: "" }] }));
  const removeSupplierQuote = (i) => setForm(prev => ({ ...prev, supplier_quotes: prev.supplier_quotes.filter((_, idx) => idx !== i) }));
  const updateSupplierQuote = (i, field, value) => setForm(prev => {
    const sq = [...prev.supplier_quotes]; sq[i] = { ...sq[i], [field]: value };
    if (field === "supplier_id") { const s = suppliers.find(s => s.id === value); sq[i].supplier_name = s?.name || ""; sq[i].supplier_email = s?.email || ""; }
    return { ...prev, supplier_quotes: sq };
  });

  const handleSave = async () => {
    if (!form.description) { alert("Informe o objeto cotado."); return; }
    const pctSum = (form.apportionments || []).reduce((s, a) => s + (Number(a.percent) || 0), 0);
    if (!form.apportionments.length) { alert("Informe ao menos um rateio (setor / conta contábil)."); return; }
    if (form.apportionments.some(a => !a.department_id || !a.account_id)) { alert("Preencha setor e conta contábil em todos os rateios."); return; }
    if (Math.abs(pctSum - 100) >= 0.01) { alert(`A soma dos percentuais do rateio deve ser 100% (atual: ${pctSum.toFixed(2)}%).`); return; }
    setSaving(true);
    const payload = {
      user_email: user.email,
      number: form.number,
      quotation_date: new Date(form.quotation_date).toISOString(),
      requisition_id: form.requisition_id || undefined,
      requisition_number: form.requisition_number || undefined,
      description: form.description,
      items: form.items,
      apportionments: form.apportionments,
      supplier_quotes: form.supplier_quotes,
      status: form.status,
      notes: form.notes || undefined,
    };
    try {
      if (quotation?.id) await base44.entities.ErpQuotation.update(quotation.id, payload);
      else await base44.entities.ErpQuotation.create(payload);
      onSaved(); onClose();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
          <h2 className="font-bold">{quotation ? "Editar Tomada de Preço" : "Nova Tomada de Preço"}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Número</Label><Input value={form.number} onChange={e => set("number", e.target.value)} /></div>
            <div><Label>Data</Label><Input type="date" value={form.quotation_date?.slice(0,10)} onChange={e => set("quotation_date", e.target.value)} /></div>
            <div><Label>Status</Label>
              <select value={form.status} onChange={e => set("status", e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm">
                {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>

          <div className="border rounded-lg p-2.5 bg-indigo-50/40">
            <Label className="text-xs text-indigo-700 flex items-center gap-1.5 mb-1.5"><ClipboardList className="w-3.5 h-3.5" /> Buscar Solicitação (opcional)</Label>
            <div className="flex gap-2 items-center">
              {loadingReqs ? <span className="text-xs text-gray-400">Carregando...</span> : (
                <>
                  <select value={form.requisition_id} onChange={e => handlePickRequisition(e.target.value)} className="flex-1 h-9 rounded-md border border-input bg-white px-3 text-sm">
                    <option value="">Não vincular — tomada avulsa</option>
                    {requisitions.map(r => <option key={r.id} value={r.id}>{r.number} — {r.department_name || r.requested_by || "—"} ({r.items?.length || 0} itens)</option>)}
                  </select>
                  {form.requisition_id && <button type="button" onClick={unlinkRequisition} title="Desvincular" className="p-2 hover:bg-white rounded text-indigo-600"><Unlink className="w-4 h-4" /></button>}
                </>
              )}
            </div>
            {form.requisition_id && <p className="text-[11px] text-indigo-600 mt-1.5 flex items-center gap-1"><Link2 className="w-3 h-3" /> Vinculada a {form.requisition_number} — itens importados ({form.items.length}).</p>}
          </div>

          <div><Label>Objeto Cotado</Label><Input value={form.description} onChange={e => set("description", e.target.value)} placeholder="Descrição do objeto cotado" /></div>

          <ErpApportionmentEditor
            apportionments={form.apportionments}
            onChange={(aps) => set("apportionments", aps)}
            setores={setores}
            accounts={accounts}
            title={form.requisition_id ? "Rateio herdado da solicitação (setor / conta contábil)" : "Rateio obrigatório (setor / conta contábil)"}
            accent="indigo"
          />

          <div className="border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between p-2 bg-gray-50 border-b"><span className="text-sm font-semibold">Itens</span><Button size="sm" variant="outline" onClick={addItem} className="h-7 gap-1"><Plus className="w-3.5 h-3.5" /> Item</Button></div>
            {form.items.length === 0 ? <p className="p-4 text-center text-sm text-gray-400">Nenhum item.</p> : form.items.map((it, i) => (
              <div key={i} className="grid grid-cols-12 gap-1 p-2 border-b items-end text-xs">
                <div className="col-span-5"><Label className="text-[10px]">Descrição</Label><Input value={it.description || it.product_name || ""} onChange={e => updateItem(i, "description", e.target.value)} className="h-8 text-xs" /></div>
                <div className="col-span-1"><Label className="text-[10px]">Qtd</Label><Input type="number" step="0.01" value={it.quantity} onChange={e => updateItem(i, "quantity", Number(e.target.value))} className="h-8 text-xs" /></div>
                <div className="col-span-1"><Label className="text-[10px]">Un.</Label><select value={it.unit} onChange={e => updateItem(i, "unit", e.target.value)} className="w-full h-8 rounded border border-input px-1 text-xs">{UNITS.map(u => <option key={u} value={u}>{u}</option>)}</select></div>
                <div className="col-span-2"><Label className="text-[10px]">Vlr. unit.</Label><Input type="number" step="0.01" value={it.unit_price} onChange={e => updateItem(i, "unit_price", Number(e.target.value))} className="h-8 text-xs" /></div>
                <div className="col-span-2"><Label className="text-[10px]">Total</Label><p className="h-8 flex items-center font-medium">{fmtMoney(it.total)}</p></div>
                <div className="col-span-1"><button onClick={() => removeItem(i)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button></div>
              </div>
            ))}
          </div>

          {/* Cotações dos fornecedores */}
          <div className="border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between p-2 bg-amber-50 border-b">
              <span className="text-sm font-semibold text-amber-800">Cotações dos Fornecedores ({form.supplier_quotes.length}/{MIN_SUPPLIERS} mín.)</span>
              <Button size="sm" variant="outline" onClick={addSupplierQuote} className="h-7 gap-1"><Plus className="w-3.5 h-3.5" /> Fornecedor</Button>
            </div>
            {form.supplier_quotes.length === 0 ? <p className="p-4 text-center text-sm text-gray-400">Nenhuma cotação. Adicione ao menos {MIN_SUPPLIERS} fornecedores para finalizar.</p> : form.supplier_quotes.map((sq, i) => (
              <div key={i} className="grid grid-cols-12 gap-1 p-2 border-b items-end text-xs">
                <div className="col-span-6"><Label className="text-[10px]">Fornecedor</Label>
                  <select value={sq.supplier_id} onChange={e => updateSupplierQuote(i, "supplier_id", e.target.value)} className="w-full h-8 rounded border border-input px-2 text-xs">
                    <option value="">Selecione...</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="col-span-4"><Label className="text-[10px]">Valor Cotado (R$)</Label><Input type="number" step="0.01" value={sq.quoted_value} onChange={e => updateSupplierQuote(i, "quoted_value", Number(e.target.value))} className="h-8 text-xs" /></div>
                <div className="col-span-1"><Label className="text-[10px]">&nbsp;</Label><Input value={sq.notes || ""} onChange={e => updateSupplierQuote(i, "notes", e.target.value)} className="h-8 text-xs" placeholder="Obs" /></div>
                <div className="col-span-1"><button onClick={() => removeSupplierQuote(i)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button></div>
              </div>
            ))}
            {form.supplier_quotes.length > 0 && form.supplier_quotes.length < MIN_SUPPLIERS && (
              <p className="p-2 text-xs text-amber-600 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Faltam {MIN_SUPPLIERS - form.supplier_quotes.length} fornecedor(es) para atingir o mínimo de {MIN_SUPPLIERS}.</p>
            )}
          </div>

          <div><Label>Observações</Label><Input value={form.notes} onChange={e => set("notes", e.target.value)} /></div>
        </div>
        <div className="p-4 border-t flex gap-2 justify-end sticky bottom-0 bg-white">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </div>
      </div>
    </div>
  );
}

function FinalizeModal({ quotation, onClose, onSaved }) {
  const quotes = (quotation.supplier_quotes || []).filter(q => q.supplier_id && Number(q.quoted_value) > 0);
  const sorted = [...quotes].sort((a, b) => (Number(a.quoted_value) || 0) - (Number(b.quoted_value) || 0));
  const suggested = sorted[0] || null;

  const [winnerId, setWinnerId] = useState(suggested?.supplier_id || "");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const winner = quotes.find(q => q.supplier_id === winnerId);
  const changed = winner && suggested && winner.supplier_id !== suggested.supplier_id;
  const canFinalize = quotes.length >= MIN_SUPPLIERS && winner && (!changed || reason.trim().length > 0);

  const handleFinalize = async () => {
    if (quotes.length < MIN_SUPPLIERS) { alert(`Informe cotações de ao menos ${MIN_SUPPLIERS} fornecedores para finalizar.`); return; }
    if (!winner) { alert("Selecione o fornecedor vencedor."); return; }
    if (changed && !reason.trim()) { alert("Informe o motivo da alteração do vencedor sugerido."); return; }
    setSaving(true);
    const payload = {
      status: "fechada",
      is_winner: true,
      suggested_supplier_id: suggested?.supplier_id || undefined,
      suggested_supplier_name: suggested?.supplier_name || undefined,
      suggested_value: Number(suggested?.quoted_value) || 0,
      winner_supplier_id: winner.supplier_id,
      winner_supplier_name: winner.supplier_name,
      winner_value: Number(winner.quoted_value) || 0,
      quoted_value: Number(winner.quoted_value) || 0,
      change_reason: changed ? reason.trim() : undefined,
    };
    try {
      await base44.entities.ErpQuotation.update(quotation.id, payload);
      onSaved(); onClose();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
          <h2 className="font-bold flex items-center gap-1.5"><Trophy className="w-5 h-5 text-amber-500" /> Finalizar Tomada de Preço</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          <div className="text-sm"><span className="text-gray-500">Tomada:</span> <b>{quotation.number}</b> — {quotation.description}</div>

          {quotes.length < MIN_SUPPLIERS ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Cotações insuficientes</p>
                <p className="text-xs mt-0.5">Foram informadas {quotes.length} cotação(ões) válida(s). O mínimo para finalizar é de {MIN_SUPPLIERS} fornecedores.</p>
                <p className="text-xs mt-1">Edite a tomada e adicione mais cotações de fornecedores.</p>
              </div>
            </div>
          ) : (
            <>
              <div>
                <Label className="text-xs text-gray-500">Cotações recebidas (menor → maior)</Label>
                <div className="space-y-1 mt-1">
                  {sorted.map((q, i) => {
                    const isSuggested = suggested && q.supplier_id === suggested.supplier_id;
                    const isPicked = q.supplier_id === winnerId;
                    return (
                      <label key={q.supplier_id} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer ${isPicked ? "border-emerald-400 bg-emerald-50" : "border-gray-200 bg-white hover:bg-gray-50"}`}>
                        <input type="radio" name="winner" checked={isPicked} onChange={() => setWinnerId(q.supplier_id)} />
                        <span className="flex-1 text-sm">{q.supplier_name}</span>
                        <span className="font-medium text-sm">{fmtMoney(q.quoted_value)}</span>
                        {isSuggested && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium">Sugerido</span>}
                        {isPicked && <Trophy className="w-4 h-4 text-amber-500" />}
                      </label>
                    );
                  })}
                </div>
                {suggested && <p className="text-xs text-indigo-600 mt-1.5 flex items-center gap-1"><Trophy className="w-3.5 h-3.5" /> Sugestão do sistema: <b>{suggested.supplier_name}</b> — {fmtMoney(suggested.quoted_value)} (menor preço)</p>}
              </div>

              {changed && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg">
                  <Label className="text-xs text-amber-800 flex items-center gap-1 mb-1"><AlertTriangle className="w-3.5 h-3.5" /> Motivo da alteração do vencedor (obrigatório)</Label>
                  <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} className="w-full rounded-md border border-amber-300 bg-white px-3 py-2 text-sm" placeholder="Justifique por que o vencedor escolhido difere do menor preço sugerido..." />
                </div>
              )}
            </>
          )}
        </div>
        <div className="p-4 border-t flex gap-2 justify-end sticky bottom-0 bg-white">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handleFinalize} disabled={saving || !canFinalize} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
            {saving ? "Finalizando..." : (<><CheckCircle2 className="w-4 h-4" /> Finalizar Tomada</>)}
          </Button>
        </div>
      </div>
    </div>
  );
}
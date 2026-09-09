import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Search, Plus, Pencil, Trash2, ChevronLeft, Loader2 } from "lucide-react";
import ErpCombobox from "@/components/erp/ErpCombobox";

// carrega todas as páginas de uma entidade (limite de 500 por requisição)
async function loadAll(entity, query, sort) {
  const list = [];
  for (let skip = 0; skip < 5000; skip += 500) {
    const page = await base44.entities[entity].filter(query, sort, 500, skip);
    list.push(...page);
    if (page.length < 500) break;
  }
  return list;
}

// ordena contas contábeis pela estrutura do código (1.1.01.01.0001)
function compareChartCode(a, b) {
  const pa = String(a.code || "").split(".").map(Number);
  const pb = String(b.code || "").split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}

const emptyLine = () => ({ type: "D", account_id: "", account_code: "", account_name: "", history_id: "", history_code: "", history_text: "" });

export default function ErpAccountingEventManager({ user }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [editor, setEditor] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [histories, setHistories] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setEvents(await loadAll("ErpAccountingEvent", { user_email: user.email }, "-created_date"));
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [user.email]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    (async () => {
      try {
        const [accs, hists] = await Promise.all([
          loadAll("ErpChartAccount", { user_email: user.email }, "-created_date"),
          loadAll("ErpStandardHistory", { user_email: user.email }, "-created_date"),
        ]);
        setAccounts(accs.filter(a => a.accepts_entries !== false && a.is_active !== false).sort(compareChartCode));
        setHistories(hists.filter(h => h.is_active !== false).sort((a, b) => (Number(a.code) || 0) - (Number(b.code) || 0)));
      } catch (e) { console.error(e); }
    })();
  }, [user.email]);

  const selected = events.find(e => e.id === selectedId) || null;
  const filteredEvents = events.filter(e => String(e.name || "").toLowerCase().includes(search.toLowerCase()));

  const handleDelete = async (ev) => {
    if (!confirm(`Excluir o evento "${ev.name}"?`)) return;
    await base44.entities.ErpAccountingEvent.delete(ev.id);
    if (selectedId === ev.id) setSelectedId(null);
    load();
  };

  const openEditor = (ev) => {
    setEditor({
      id: ev?.id || null,
      name: ev?.name || "",
      partner_type: ev?.partner_type || "fornecedor",
      lines: (ev?.lines || []).length ? ev.lines.map(l => ({ ...l })) : [emptyLine()],
      jd: {
        j1: ev?.juros_1_account_id || "", j2: ev?.juros_2_account_id || "", j3: ev?.juros_3_account_id || "",
        d1: ev?.descontos_1_account_id || "", d2: ev?.descontos_2_account_id || "", d3: ev?.descontos_3_account_id || "",
      },
    });
  };

  return (
    <div className="space-y-3">
      <div>
        <h2 className="font-semibold text-base">Cadastro de Eventos</h2>
        <p className="text-xs text-gray-500">Evento contábil com linhas de débito/crédito, conta contábil e histórico padrão.</p>
      </div>

      {!selected ? (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar evento..." className="w-full h-9 rounded-md border border-input bg-transparent pl-9 pr-3 text-sm" />
            </div>
            <Button size="sm" onClick={() => openEditor(null)} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"><Plus className="w-4 h-4" /> Novo</Button>
          </div>

          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 text-gray-500 text-xs">
                  <tr>
                    <th className="p-2 text-left">Nome do Evento</th>
                    <th className="p-2 text-left">Tipo</th>
                    <th className="p-2 text-left">Linhas</th>
                    <th className="p-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={4} className="p-6 text-center text-gray-400">Carregando...</td></tr>
                  ) : filteredEvents.length === 0 ? (
                    <tr><td colSpan={4} className="p-8 text-center text-gray-400">Nenhum evento cadastrado.</td></tr>
                  ) : filteredEvents.map(ev => (
                    <tr key={ev.id} className="border-t hover:bg-gray-50">
                      <td className="p-2">
                        <button onClick={() => setSelectedId(ev.id)} className="text-left font-medium text-blue-700 hover:underline">{ev.name}</button>
                      </td>
                      <td className="p-2">{ev.partner_type === "cliente" ? "Cliente" : "Fornecedor"}</td>
                      <td className="p-2">{(ev.lines || []).length}</td>
                      <td className="p-2 text-right whitespace-nowrap">
                        <button onClick={() => openEditor(ev)} className="p-1 hover:bg-gray-100 rounded"><Pencil className="w-4 h-4 text-gray-500" /></button>
                        <button onClick={() => handleDelete(ev)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setSelectedId(null)} className="gap-1"><ChevronLeft className="w-4 h-4" /> Voltar</Button>
            <h2 className="font-semibold text-base flex-1">nome do evento: <span className="uppercase">{selected.name}</span> <span className="text-xs font-normal text-gray-500">({selected.partner_type === "cliente" ? "Cliente — Contas a Receber" : "Fornecedor — Contas a Pagar"})</span></h2>
            <Button variant="outline" size="sm" onClick={() => openEditor(selected)} className="gap-1"><Pencil className="w-4 h-4" /> Editar</Button>
            <Button variant="destructive" size="sm" onClick={() => handleDelete(selected)} className="gap-1"><Trash2 className="w-4 h-4" /> Excluir</Button>
          </div>

          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead className="bg-gray-100 text-gray-600 text-xs">
                  <tr>
                    <th rowSpan={2} className="p-2 border border-gray-200 text-center">Tipo</th>
                    <th colSpan={2} className="p-2 border border-gray-200 text-center uppercase">Conta Contabil</th>
                    <th colSpan={2} className="p-2 border border-gray-200 text-center uppercase">Hist. Padrao</th>
                  </tr>
                  <tr>
                    <th className="p-2 border border-gray-200">C/C</th>
                    <th className="p-2 border border-gray-200">Descrição</th>
                    <th className="p-2 border border-gray-200">Cod.</th>
                    <th className="p-2 border border-gray-200">Descrição</th>
                  </tr>
                </thead>
                <tbody>
                  {(selected.lines || []).length === 0 ? (
                    <tr><td colSpan={5} className="p-6 text-center text-gray-400 border border-gray-200">Nenhuma linha cadastrada.</td></tr>
                  ) : selected.lines.map((l, i) => (
                    <tr key={i}>
                      <td className={`p-2 border border-gray-200 text-center font-semibold ${l.type === "D" ? "text-blue-700" : "text-amber-700"}`}>{l.type}</td>
                      <td className="p-2 border border-gray-200">{l.account_code || "—"}</td>
                      <td className="p-2 border border-gray-200">{l.account_name || "—"}</td>
                      <td className="p-2 border border-gray-200 text-center">{l.history_code || "—"}</td>
                      <td className="p-2 border border-gray-200">{l.history_text || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-xl border p-3">
            <p className="text-xs font-medium text-gray-600 mb-2">Contas de juros e descontos da baixa (contabilização sempre contra a conta do banco)</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
              {[1, 2, 3].map(n => (
                <div key={`j${n}`} className="flex items-center gap-1">
                  <span className="w-28 shrink-0 text-gray-500 font-medium">Juros {n} ({selected.partner_type === "cliente" ? "C" : "D"})</span>
                  <span>{selected[`juros_${n}_account_code`] ? `${selected[`juros_${n}_account_code`]} — ${selected[`juros_${n}_account_name`]}` : "—"}</span>
                </div>
              ))}
              {[1, 2, 3].map(n => (
                <div key={`d${n}`} className="flex items-center gap-1">
                  <span className="w-28 shrink-0 text-gray-500 font-medium">Desconto {n} ({selected.partner_type === "cliente" ? "D" : "C"})</span>
                  <span>{selected[`descontos_${n}_account_code`] ? `${selected[`descontos_${n}_account_code`]} — ${selected[`descontos_${n}_account_name`]}` : "—"}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {editor && (
        <EventEditor
          user={user}
          initial={editor}
          accounts={accounts}
          histories={histories}
          onClose={() => setEditor(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}

function EventEditor({ user, initial, accounts, histories, onClose, onSaved }) {
  const [name, setName] = useState(initial.name);
  const [partnerType, setPartnerType] = useState(initial.partner_type || "fornecedor");
  const [jd, setJd] = useState(initial.jd || { j1: "", j2: "", j3: "", d1: "", d2: "", d3: "" });
  const [lines, setLines] = useState(initial.lines.length ? initial.lines : [emptyLine()]);
  const [saving, setSaving] = useState(false);

  const setLine = (i, patch) => setLines(prev => prev.map((l, idx) => idx === i ? { ...l, ...patch } : l));

  const onAccount = (i, v) => {
    const acc = accounts.find(a => a.id === v);
    setLine(i, { account_id: v, account_code: acc?.code || "", account_name: acc?.name || "" });
  };

  const onHistory = (i, v) => {
    const h = histories.find(x => x.id === v);
    setLine(i, { history_id: v, history_code: h?.code || "", history_text: h?.description || "" });
  };

  const handleSave = async () => {
    if (!name.trim()) { alert("Informe o nome do evento."); return; }
    const valid = [];
    for (const [idx, l] of lines.entries()) {
      if (!l.account_id) continue;
      const acc = accounts.find(a => a.id === l.account_id);
      if (!acc || acc.accepts_entries === false) {
        alert(`Linha ${idx + 1}: conta sintética (agrupadora) não é permitida — selecione uma conta analítica.`);
        return;
      }
      valid.push(l);
    }
    if (!valid.length) { alert("Selecione a conta contábil em pelo menos uma linha."); return; }
    setSaving(true);
    const payload = { user_email: user.email, name: name.trim(), partner_type: partnerType, lines: valid };
    const accOf = id => accounts.find(a => a.id === id);
    [["j", "juros"], ["d", "descontos"]].forEach(([p, field]) => {
      for (let n = 1; n <= 3; n++) {
        const acc = accOf(jd[`${p}${n}`]);
        payload[`${field}_${n}_account_id`] = acc?.id || "";
        payload[`${field}_${n}_account_code`] = acc?.code || "";
        payload[`${field}_${n}_account_name`] = acc?.name || "";
      }
    });
    try {
      if (initial.id) await base44.entities.ErpAccountingEvent.update(initial.id, payload);
      else await base44.entities.ErpAccountingEvent.create(payload);
      onSaved();
      onClose();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h2 className="font-bold">{initial.id ? "Editar Evento" : "Novo Evento"}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded text-gray-500">✕</button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600">Nome do Evento *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: FORNECEDORES" className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm mt-1 uppercase" />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600">Tipo do Evento *</label>
            <select value={partnerType} onChange={e => setPartnerType(e.target.value)} className="w-full h-9 rounded-md border border-input bg-white px-3 text-sm mt-1">
              <option value="fornecedor">Fornecedor — Contas a Pagar (D Fornecedor x C Banco)</option>
              <option value="cliente">Cliente — Contas a Receber (D Banco x C Cliente)</option>
            </select>
          </div>

          <div className="bg-gray-50 rounded-lg border p-2">
            <p className="text-xs font-medium text-gray-600 mb-2">Linhas do evento (conta contábil e histórico padrão)</p>
            <div className="space-y-2">
              {lines.map((l, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <select value={l.type} onChange={e => setLine(i, { type: e.target.value })} className="col-span-2 h-9 rounded-md border border-input bg-white px-2 text-sm">
                    <option value="D">D — Débito</option>
                    <option value="C">C — Crédito</option>
                  </select>
                  <div className="col-span-6">
                    <ErpCombobox
                      value={l.account_id}
                      onValueChange={v => onAccount(i, v)}
                      options={accounts.map(a => ({ id: a.id, label: `${a.code} — ${a.name}` }))}
                      placeholder="Digite código ou descrição da conta..."
                    />
                  </div>
                  <div className="col-span-3">
                    <ErpCombobox
                      value={l.history_id}
                      onValueChange={v => onHistory(i, v)}
                      options={histories.map(h => ({ id: h.id, label: `${h.code} — ${h.description}` }))}
                      placeholder="Hist. padrão..."
                      clearable
                    />
                  </div>
                  <button onClick={() => setLines(prev => prev.filter((_, idx) => idx !== i))} className="col-span-1 p-1 hover:bg-red-50 rounded justify-self-center" title="Remover linha">
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={() => setLines(prev => [...prev, emptyLine()])} className="gap-1 mt-2"><Plus className="w-4 h-4" /> Adicionar linha</Button>
          </div>

          <div className="bg-gray-50 rounded-lg border p-2">
            <p className="text-xs font-medium text-gray-600 mb-1">Contas de juros e descontos da baixa (contabilização sempre contra a conta contábil do banco)</p>
            <p className="text-xs text-gray-400 mb-2">Pagamento: D Fornecedor, D Juros 1-3, C Descontos 1-3 e C da conta contábil cadastrada no banco. Recebimento: D banco e D descontos, C cliente e C juros.</p>
            <div className="grid grid-cols-2 gap-2">
              {[1, 2, 3].map(n => (
                <div key={`j${n}`}>
                  <label className="text-xs text-gray-500">Juros {n} ({partnerType === "cliente" ? "C" : "D"})</label>
                  <ErpCombobox
                    value={jd[`j${n}`]}
                    onValueChange={v => setJd(prev => ({ ...prev, [`j${n}`]: v }))}
                    options={accounts.map(a => ({ id: a.id, label: `${a.code} — ${a.name}` }))}
                    placeholder="Conta de juros..."
                    clearable
                  />
                </div>
              ))}
              {[1, 2, 3].map(n => (
                <div key={`d${n}`}>
                  <label className="text-xs text-gray-500">Desconto {n} ({partnerType === "cliente" ? "D" : "C"})</label>
                  <ErpCombobox
                    value={jd[`d${n}`]}
                    onValueChange={v => setJd(prev => ({ ...prev, [`d${n}`]: v }))}
                    options={accounts.map(a => ({ id: a.id, label: `${a.code} — ${a.name}` }))}
                    placeholder="Conta de desconto..."
                    clearable
                  />
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-gray-400">Selecione somente contas analíticas (aceitam lançamento). O histórico padrão é opcional — cadastre em Históricos Padrão.</p>
        </div>
        <div className="p-4 border-t flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </div>
      </div>
    </div>
  );
}
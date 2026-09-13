import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { lookupCnpj } from "@/lib/cnpjLookup";
import { genOrderNumber, fmtDate } from "@/lib/erpUtils";
import { maskCpfCnpj, maskCep, maskPhone, onlyDigits } from "@/lib/brMasks";
import ErpSettleModal from "@/components/erp/ErpSettleModal";

async function lookupCep(cep) {
  const clean = onlyDigits(cep);
  if (clean.length !== 8) return null;
  try {
    const resp = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
    const d = await resp.json();
    if (d?.erro) return null;
    return { address: d.logradouro || "", district: d.bairro || "", city: d.localidade || "", uf: d.uf || "", ibge_code: d.ibge ? String(d.ibge) : "" };
  } catch (e) { return null; }
}

// field: { key, label, type: text|number|select|checkbox|entity-select, options?, entity?, labelKey?, cacheKey?, required?, full?, placeholder? }
// column: { key, label, type?: text|badge|money|bool, options?(for badge) }
// rowAction (opcional): { icon, title, onClick(item) } — ação extra por linha
export default function ErpSimpleCrud({ user, entityName, scopeField = "user_email", title, fields, columns, searchKeys, settle, cashJournal, rowAction }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [entityOptions, setEntityOptions] = useState({});
  // Baixa em lote (settle): { openStatus, doneStatus, dateField, actionLabel }
  const [selectedIds, setSelectedIds] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [settleEvents, setSettleEvents] = useState([]);
  const [settleBankId, setSettleBankId] = useState("");
  const [settleDate, setSettleDate] = useState(new Date().toISOString().slice(0, 10));
  const [settling, setSettling] = useState(false);
  const [settleModalOpen, setSettleModalOpen] = useState(false);

  const entitySelectFields = useMemo(() => fields.filter(f => f.type === "entity-select"), [fields]);

  const load = async () => {
    setLoading(true);
    try {
      const list = await base44.entities[entityName].filter({ [scopeField]: user.email }, "-created_date", 500);
      setItems(list);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const loadOptions = async () => {
    const opts = {};
    for (const f of entitySelectFields) {
      try {
        // paginação: carrega todas as páginas (limite de 500 por requisição)
        const list = [];
        for (let skip = 0; skip < 5000; skip += 500) {
          const page = await base44.entities[f.entity].filter({ user_email: user.email }, "-created_date", 500, skip);
          list.push(...page);
          if (page.length < 500) break;
        }
        const filtered = f.optionsFilter ? list.filter(f.optionsFilter) : list;
        opts[f.key] = f.sortOptions ? [...filtered].sort(f.sortOptions) : filtered;
      } catch (e) { opts[f.key] = []; }
    }
    setEntityOptions(opts);
  };

  useEffect(() => { load(); if (entitySelectFields.length) loadOptions(); }, [user.email]);

  useEffect(() => {
    if (!settle) return;
    base44.entities.ErpBankAccount.filter({ user_email: user.email }, "-created_date", 500)
      .then(list => setBankAccounts(list.filter(b => b.is_active !== false)))
      .catch(() => setBankAccounts([]));
    base44.entities.ErpAccountingEvent.filter({ user_email: user.email }, "-created_date", 500)
      .then(list => setSettleEvents(list))
      .catch(() => setSettleEvents([]));
  }, [user.email, settle]);

  const filtered = items.filter(it => {
    const t = (searchKeys || columns.map(c => c.key)).map(k => String(it[k] ?? "")).join(" ").toLowerCase();
    return t.includes(search.toLowerCase());
  });

  const handleDelete = async (it) => {
    if (!confirm(`Excluir "${it.name || it.razao_social || it.id}"?`)) return;
    await base44.entities[entityName].delete(it.id);
    load();
  };

  // --- Baixa em lote ---
  const isSettleable = (it) => !!settle && it[settle.statusField || "status"] === settle.openStatus;
  const toggleSelect = (id) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const settleOpenRows = filtered.filter(isSettleable);
  const allOpenSelected = settleOpenRows.length > 0 && settleOpenRows.every(it => selectedIds.includes(it.id));
  const selectedTotal = items.filter(it => selectedIds.includes(it.id)).reduce((s, it) => s + (Number(it.amount) || 0), 0);
  const settleVerb = settle?.doneStatus === "recebido" ? "Receber" : "Pagar";

  const handleSettle = () => {
    const bank = bankAccounts.find(b => b.id === settleBankId);
    if (!bank) { alert("Selecione a conta bancária da baixa."); return; }
    if (!settleDate) { alert("Informe a data da baixa."); return; }
    setSettleModalOpen(true);
  };

  const handleSettleConfirm = async (entries, event) => {
    if (!event) { alert("Selecione o evento contábil da baixa."); return; }
    const bank = bankAccounts.find(b => b.id === settleBankId);
    const isPay = settle.doneStatus === "pago";
    const r2 = v => Math.round((Number(v) || 0) * 100) / 100;

    // validações antes de baixar — nada é gravado se faltar configuração contábil
    const errs = [];
    if (!bank?.chart_account_id) errs.push("A conta bancária da baixa não possui conta contábil vinculada (cadastre em Contas Bancárias).");
    const partnerLines = (event.lines || []).filter(l => l.type === (isPay ? "D" : "C"));
    if (!partnerLines.length) errs.push(`O evento "${event.name}" não possui linha ${isPay ? "de débito (fornecedor)" : "de crédito (cliente)"}.`);
    entries.forEach(e => {
      [1, 2, 3].forEach(n => {
        if ((Number(e.juros[n - 1]) || 0) > 0 && !event[`juros_${n}_account_id`]) errs.push(`Título "${e.description}": Juros ${n} informado, mas o evento não tem a conta de Juros ${n} configurada.`);
        if ((Number(e.descontos[n - 1]) || 0) > 0 && !event[`descontos_${n}_account_id`]) errs.push(`Título "${e.description}": Desconto ${n} informado, mas o evento não tem a conta de Desconto ${n} configurada.`);
      });
    });
    if (errs.length) { alert(errs.join("\n")); return; }

    setSettling(true);
    try {
      await base44.entities[entityName].bulkUpdate(entries.map(e => ({
        id: e.id,
        [settle.statusField || "status"]: settle.doneStatus,
        [settle.dateField]: settleDate,
        bank_account_id: bank.id,
        bank_account_name: bank.bank + (bank.account ? ` — ${bank.account}` : ""),
        event_id: event.id,
        event_name: event.name,
        settled_value: Number(e.paid) || 0,
        juros_1: Number(e.juros[0]) || 0,
        juros_2: Number(e.juros[1]) || 0,
        juros_3: Number(e.juros[2]) || 0,
        descontos_1: Number(e.descontos[0]) || 0,
        descontos_2: Number(e.descontos[1]) || 0,
        descontos_3: Number(e.descontos[2]) || 0,
      })));

      // Lançamento contábil por título — banco sempre C no pagamento e sempre D no recebimento
      for (const e of entries) {
        const docVal = r2(e.docValue);
        const jSum = r2((Number(e.juros[0]) || 0) + (Number(e.juros[1]) || 0) + (Number(e.juros[2]) || 0));
        const dSum = r2((Number(e.descontos[0]) || 0) + (Number(e.descontos[1]) || 0) + (Number(e.descontos[2]) || 0));
        const bankVal = r2(docVal + jSum - dSum);
        const lines = [];
        // lado do parceiro: fornecedor D (pagamento) / cliente C (recebimento) pelo valor do título
        for (const l of partnerLines) {
          lines.push({
            account_id: l.account_id, account_code: l.account_code, account_name: l.account_name,
            ...(isPay ? { debit: docVal, credit: 0 } : { debit: 0, credit: docVal }),
            complement: l.history_text || `${isPay ? "Pagamento" : "Recebimento"} ${e.description}`,
          });
        }
        // juros e descontos conforme o evento — cada título mantém seus próprios valores
        for (let n = 1; n <= 3; n++) {
          const jv = Number(e.juros[n - 1]) || 0;
          if (jv > 0) lines.push({
            account_id: event[`juros_${n}_account_id`], account_code: event[`juros_${n}_account_code`], account_name: event[`juros_${n}_account_name`],
            ...(isPay ? { debit: jv, credit: 0 } : { debit: 0, credit: jv }),
            complement: `Juros ${n} — ${e.description}`,
          });
          const dv = Number(e.descontos[n - 1]) || 0;
          if (dv > 0) lines.push({
            account_id: event[`descontos_${n}_account_id`], account_code: event[`descontos_${n}_account_code`], account_name: event[`descontos_${n}_account_name`],
            ...(isPay ? { debit: 0, credit: dv } : { debit: dv, credit: 0 }),
            complement: `Desconto ${n} — ${e.description}`,
          });
        }
        // banco: crédito na baixa de Contas a Pagar, débito na baixa de Contas a Receber
        lines.push({
          account_id: bank.chart_account_id, account_code: bank.chart_account_code, account_name: bank.chart_account_name,
          ...(isPay ? { debit: 0, credit: bankVal } : { debit: bankVal, credit: 0 }),
          complement: `${isPay ? "Pagamento" : "Recebimento"} ${bank.bank}${bank.account ? ` — ${bank.account}` : ""}`,
        });

        const totalDebit = r2(lines.reduce((s, l) => s + (l.debit || 0), 0));
        const totalCredit = r2(lines.reduce((s, l) => s + (l.credit || 0), 0));
        await base44.entities.ErpJournalEntry.create({
          user_email: user.email,
          number: genOrderNumber("LCT"),
          date: settleDate ? new Date(`${settleDate}T12:00:00`).toISOString() : new Date().toISOString(),
          history: `${isPay ? "Pagamento" : "Recebimento"} ${e.description}${e.party ? ` - ${e.party}` : ""}`,
          document: e.description,
          lines,
          total_debit: totalDebit,
          total_credit: totalCredit,
          status: "definitivo",
        });
      }

      setSettleModalOpen(false);
      setSelectedIds([]);
      load();
    } catch (e) { alert(e.message); }
    setSettling(false);
  };

  // Após salvar movimentação de caixa com evento contábil: gera o lançamento
  // Entrada: banco D x evento C — Saída: banco C x evento D (apenas na inclusão)
  const handleSaved = async (payload, editing) => {
    await load();
    if (!cashJournal || editing?.id || !payload?.event_id) return;
    try {
      const value = Number(payload.amount) || 0;
      if (value <= 0) return;
      const [ev, bankAcc] = await Promise.all([
        base44.entities.ErpAccountingEvent.get(payload.event_id),
        payload.bank_account_id ? base44.entities.ErpBankAccount.get(payload.bank_account_id) : null,
      ]);
      if (!bankAcc?.chart_account_id) { alert("Movimentação salva, mas a conta bancária não possui conta contábil vinculada — o lançamento contábil não foi gerado."); return; }
      const isIn = payload.type === "entrada";
      const evLines = (ev?.lines || []).filter(l => l.type === (isIn ? "C" : "D"));
      if (evLines.length !== 1) { alert(`Movimentação salva, mas o evento "${ev?.name}" precisa de exatamente uma linha ${isIn ? "de crédito (para entrada)" : "de débito (para saída)"} — o lançamento contábil não foi gerado.`); return; }
      const l = evLines[0];
      const lines = [
        {
          account_id: bankAcc.chart_account_id, account_code: bankAcc.chart_account_code, account_name: bankAcc.chart_account_name,
          ...(isIn ? { debit: value, credit: 0 } : { debit: 0, credit: value }),
          complement: `${isIn ? "Entrada" : "Saída"} ${bankAcc.bank}${bankAcc.account ? ` — ${bankAcc.account}` : ""}`,
        },
        {
          account_id: l.account_id, account_code: l.account_code, account_name: l.account_name,
          ...(isIn ? { debit: 0, credit: value } : { debit: value, credit: 0 }),
          complement: l.history_text || payload.description,
        },
      ];
      await base44.entities.ErpJournalEntry.create({
        user_email: user.email,
        number: genOrderNumber("LCT"),
        date: payload.date ? new Date(`${payload.date}T12:00:00`).toISOString() : new Date().toISOString(),
        history: `${isIn ? "Entrada" : "Saída"} de caixa — ${payload.description}`,
        document: payload.description,
        lines,
        total_debit: value,
        total_credit: value,
        status: "definitivo",
      });
    } catch (e) {
      alert("Movimentação salva, mas o lançamento contábil não foi gerado: " + e.message);
    }
  };

  const ISO_DATE = /^\d{4}-\d{2}-\d{2}([T\s]|$)/;
  const renderCell = (it, col) => {
    const v = it[col.key];
    if (col.type === "money") return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    if (col.type === "bool") return v ? "Sim" : "Não";
    if (col.type === "date") return fmtDate(v);
    if (col.type === "badge" && col.options) {
      const o = col.options.find(o => o.value === v);
      return o ? <span className={`text-xs px-2 py-0.5 rounded-full ${o.color}`}>{o.label}</span> : v;
    }
    if (col.render) return col.render(it);
    // datas armazenadas em ISO são exibidas no padrão brasileiro (DD/MM/AAAA)
    if (typeof v === "string" && ISO_DATE.test(v)) return fmtDate(v);
    return v ?? "—";
  };

  return (
    <div className="space-y-3">
      <div>
        <h2 className="font-semibold text-base">{title}</h2>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className="w-full h-9 rounded-md border border-input bg-transparent pl-9 pr-3 text-sm" />
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setShowForm(true); }} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"><Plus className="w-4 h-4" /> Novo</Button>
      </div>

      {settle && (
        <div className="flex items-center gap-2 flex-wrap bg-amber-50 border border-amber-200 rounded-lg p-2 text-sm">
          <span className="text-xs font-medium text-amber-800">
            {selectedIds.length} selecionado(s) — Total: {Number(selectedTotal).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </span>
          <select value={settleBankId} onChange={e => setSettleBankId(e.target.value)} className="h-8 rounded-md border border-input bg-white px-2 text-xs">
            <option value="">Conta bancária da baixa...</option>
            {bankAccounts.map(b => <option key={b.id} value={b.id}>{b.bank}{b.account ? ` — ${b.account}` : ""}</option>)}
          </select>
          <input type="date" value={settleDate} onChange={e => setSettleDate(e.target.value)} className="h-8 rounded-md border border-input bg-white px-2 text-xs" />
          <Button size="sm" className="bg-amber-600 hover:bg-amber-700" disabled={settling || selectedIds.length === 0} onClick={handleSettle}>
            {settling ? "Baixando..." : (settle.actionLabel || "Baixar Selecionados")}
          </Button>
        </div>
      )}

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-gray-500 text-xs">
              <tr>
                {settle && (
                  <th className="p-2 w-8">
                    <input type="checkbox" className="w-4 h-4 accent-amber-600" checked={allOpenSelected}
                      onChange={e => setSelectedIds(e.target.checked ? settleOpenRows.map(it => it.id) : [])} />
                  </th>
                )}
                {columns.map(c => <th key={c.key} className="p-2 text-left">{c.label}</th>)}
                <th className="p-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={columns.length + (settle ? 2 : 1)} className="p-6 text-center text-gray-400">Carregando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={columns.length + (settle ? 2 : 1)} className="p-8 text-center text-gray-400">Nenhum registro.</td></tr>
              ) : filtered.map(it => (
                <tr key={it.id} className="border-t hover:bg-gray-50">
                  {settle && (
                    <td className="p-2">
                      {isSettleable(it) && (
                        <input type="checkbox" className="w-4 h-4 accent-amber-600" checked={selectedIds.includes(it.id)} onChange={() => toggleSelect(it.id)} />
                      )}
                    </td>
                  )}
                  {columns.map(c => <td key={c.key} className="p-2">{renderCell(it, c)}</td>)}
                  <td className="p-2 text-right whitespace-nowrap">
                    {rowAction && (() => { const RowIcon = rowAction.icon; return (
                      <button onClick={() => rowAction.onClick(it)} title={rowAction.title || ""} className="p-1 hover:bg-indigo-50 rounded"><RowIcon className="w-4 h-4 text-indigo-600" /></button>
                    ); })()}
                    <button onClick={() => { setEditing(it); setShowForm(true); }} className="p-1 hover:bg-gray-100 rounded"><Pencil className="w-4 h-4 text-gray-500" /></button>
                    <button onClick={() => handleDelete(it)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <ErpSimpleForm
          user={user}
          scopeField={scopeField}
          entityName={entityName}
          editing={editing}
          fields={fields}
          entityOptions={entityOptions}
          onClose={() => setShowForm(false)}
          onSaved={handleSaved}
        />
      )}

      {settle && settleModalOpen && (
        <ErpSettleModal
          titles={items.filter(it => selectedIds.includes(it.id))}
          verb={settleVerb}
          bankName={(() => { const b = bankAccounts.find(x => x.id === settleBankId); return b ? b.bank + (b.account ? ` — ${b.account}` : "") : ""; })()}
          date={settleDate}
          events={settleEvents.filter(ev => ev.partner_type === (settleVerb === "Pagar" ? "fornecedor" : "cliente"))}
          onClose={() => setSettleModalOpen(false)}
          onConfirm={handleSettleConfirm}
        />
      )}
    </div>
  );
}

function ErpSimpleForm({ user, scopeField, entityName, editing, fields, entityOptions, onClose, onSaved }) {
  const buildInitial = () => {
    const o = {};
    fields.forEach(f => {
      o[f.key] = editing?.[f.key] ?? (f.type === "checkbox" ? false : f.type === "number" ? 0 : f.type === "select" ? (f.options?.[0]?.value ?? "") : "");
      // campo de data: recupera apenas YYYY-MM-DD para o input type="date"
      if (f.inputType === "date" && o[f.key]) o[f.key] = String(o[f.key]).slice(0, 10);
    });
    return o;
  };
  const [form, setForm] = useState(buildInitial);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const onCnpjLookup = async (cnpjValue) => {
    const digits = onlyDigits(cnpjValue || form.cnpj || "");
    if (digits.length !== 14) { setMsg(""); return; }
    setBusy(true); setMsg("Consultando CNPJ na Receita...");
    const res = await lookupCnpj(digits);
    setBusy(false);
    if (res?.error) { setMsg("⚠ " + res.error); return; }
    const isMei = /MEI|MICRO EMPREENDEDOR INDIVIDUAL/i.test(`${res.porte || ""} ${res.natureza_juridica || ""}`);
    const has = (k) => fields.some(ff => ff.key === k);
    setForm(prev => {
      const up = {};
      if (has("razao_social")) up.razao_social = res.razao_social || prev.razao_social;
      else if (has("name")) up.name = res.razao_social || prev.name;
      if (has("nome_fantasia")) up.nome_fantasia = res.nome_fantasia || prev.nome_fantasia;
      if (has("email")) up.email = res.email || prev.email;
      if (has("cep")) up.cep = res.cep ? maskCep(res.cep) : prev.cep;
      else if (has("zip")) up.zip = res.cep ? maskCep(res.cep) : prev.zip;
      if (has("address")) up.address = res.address || prev.address;
      if (has("number")) up.number = res.number || prev.number;
      if (has("district")) up.district = res.district || prev.district;
      if (has("city")) up.city = res.city || prev.city;
      if (has("uf")) up.uf = res.uf || prev.uf;
      if (has("ibge_code")) up.ibge_code = res.ibge_code || prev.ibge_code;
      if (has("phone")) up.phone = res.phone ? maskPhone(res.phone) : prev.phone;
      if (has("cnae")) up.cnae = res.cnae ? `${res.cnae} - ${res.cnae_descricao}`.replace(/ - $/, "") : prev.cnae;
      if (has("natureza_juridica")) up.natureza_juridica = res.natureza_juridica || prev.natureza_juridica;
      if (has("has_junta_registro")) up.has_junta_registro = !isMei && !!res.natureza_juridica;
      if (has("abertura")) up.abertura = res.abertura || prev.abertura;
      return { ...prev, ...up };
    });
    // Complementa o código IBGE via ViaCEP quando a Receita não retornar
    if (!res.ibge_code && has("ibge_code") && onlyDigits(res.cep).length === 8) {
      const cepData = await lookupCep(onlyDigits(res.cep));
      if (cepData?.ibge_code) setForm(prev => ({ ...prev, ibge_code: cepData.ibge_code }));
    }
    setMsg("Dados preenchidos pela Receita Federal.");
  };

  const onCepLookup = async (cepValue) => {
    const digits = onlyDigits(cepValue || form.cep || "");
    if (digits.length !== 8) return;
    setBusy(true); setMsg("Buscando endereço...");
    const res = await lookupCep(digits);
    setBusy(false);
    if (!res) { setMsg("CEP não encontrado."); return; }
    setForm(prev => ({
      ...prev,
      address: res.address || prev.address,
      district: res.district || prev.district,
      city: res.city || prev.city,
      uf: res.uf || prev.uf,
      ibge_code: res.ibge_code || prev.ibge_code,
    }));
    setMsg("Endereço preenchido pelo CEP.");
  };

  const set = (k, v) => setForm(prev => {
    const next = { ...prev, [k]: v };
    const f = fields.find(ff => ff.key === k);
    if (f?.type === "entity-select" && f.cacheKey) {
      const opt = (entityOptions[k] || []).find(o => o.id === v);
      next[f.cacheKey] = opt ? opt[f.labelKey || "name"] : "";
      if (f.prefixKey && opt) next[f.prefixCacheKey] = opt[f.prefixKey] || "";
    }
    return next;
  });

  const handleSave = async () => {
    for (const f of fields) {
      const req = f.required || (f.requiredIf && f.requiredIf(form));
      if (req && !String(form[f.key] ?? "").trim()) { alert(`Informe ${f.label}.`); return; }
    }
    setSaving(true);
    const payload = { [scopeField]: user.email, ...form };
    // limpa campos vazios opcionais e converte números
    fields.forEach(f => {
      if (f.type === "number") payload[f.key] = Number(form[f.key]) || 0;
      if (f.mask) payload[f.key] = onlyDigits(form[f.key]);
      if (!f.required && !String(form[f.key] ?? "").trim() && f.type !== "checkbox") delete payload[f.key];
    });
    try {
      if (editing?.id) await base44.entities[entityName].update(editing.id, payload);
      else await base44.entities[entityName].create(payload);
      onSaved(payload, editing);
      onClose();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h2 className="font-bold">{editing ? "Editar" : "Novo"}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded text-gray-500">✕</button>
        </div>
        <div className="p-4 grid grid-cols-2 gap-3">
          {msg && <p className="col-span-2 text-xs text-gray-500 flex items-center gap-1">{busy && <Loader2 className="w-3 h-3 animate-spin" />}{msg}</p>}
          {fields.map(f => (
            <div key={f.key} className={f.full ? "col-span-2" : ""}>
              <label className="text-xs font-medium text-gray-600">{f.label}{f.required ? " *" : ""}</label>
              {f.type === "checkbox" ? (
                <label className="flex items-center gap-2 mt-1.5 text-sm">
                  <input type="checkbox" checked={!!form[f.key]} onChange={e => set(f.key, e.target.checked)} className="w-4 h-4" /> Sim
                </label>
              ) : f.type === "select" ? (
                <select value={form[f.key]} onChange={e => set(f.key, e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm mt-1">
                  {(f.options || []).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : f.type === "entity-select" ? (
                <select value={form[f.key]} onChange={e => set(f.key, e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm mt-1">
                  <option value="">Selecione...</option>
                  {(entityOptions[f.key] || []).map(o => (
                    <option key={o.id} value={o.id}>
                      {f.hierarchical ? "\u00A0\u00A0\u00A0".repeat(Math.max((o.grau || 1) - 1, 0)) : ""}{f.prefixKey && o[f.prefixKey] ? `${o[f.prefixKey]} — ` : ""}{o[f.labelKey || "name"]}
                    </option>
                  ))}
                </select>
              ) : (
                <>
                <input
                  type={f.type === "number" ? "number" : f.inputType || "text"}
                  list={f.datalistId || undefined}
                  placeholder={f.placeholder || ""}
                  value={form[f.key]}
                  onChange={e => {
                    let v = e.target.value;
                    if (f.mask === "cnpj") v = maskCpfCnpj(v);
                    else if (f.mask === "cep") v = maskCep(v);
                    else if (f.mask === "phone") v = maskPhone(v);
                    set(f.key, v);
                    if (f.lookup === "cnpj" && onlyDigits(v).length === 14) onCnpjLookup(v);
                    if (f.mask === "cep" && onlyDigits(v).length === 8) onCepLookup(v);
                  }}
                  onBlur={f.lookup === "cnpj" ? () => onCnpjLookup() : f.mask === "cep" ? () => onCepLookup() : undefined}
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm mt-1"
                />
                {f.datalistId && (
                  <datalist id={f.datalistId}>
                    {(f.datalistOptions || []).map(o => <option key={o} value={o} />)}
                  </datalist>
                )}
                </>
              )}
            </div>
          ))}
        </div>
        <div className="p-4 border-t flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </div>
      </div>
    </div>
  );
}
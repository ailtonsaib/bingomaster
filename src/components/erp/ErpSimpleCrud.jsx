import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { lookupCnpj } from "@/lib/cnpjLookup";
import { maskCpfCnpj, maskCep, maskPhone, onlyDigits } from "@/lib/brMasks";

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
export default function ErpSimpleCrud({ user, entityName, scopeField = "user_email", title, fields, columns, searchKeys }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [entityOptions, setEntityOptions] = useState({});

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
        opts[f.key] = await base44.entities[f.entity].filter({ user_email: user.email }, "-created_date", 500);
      } catch (e) { opts[f.key] = []; }
    }
    setEntityOptions(opts);
  };

  useEffect(() => { load(); if (entitySelectFields.length) loadOptions(); }, [user.email]);

  const filtered = items.filter(it => {
    const t = (searchKeys || columns.map(c => c.key)).map(k => String(it[k] ?? "")).join(" ").toLowerCase();
    return t.includes(search.toLowerCase());
  });

  const handleDelete = async (it) => {
    if (!confirm(`Excluir "${it.name || it.razao_social || it.id}"?`)) return;
    await base44.entities[entityName].delete(it.id);
    load();
  };

  const renderCell = (it, col) => {
    const v = it[col.key];
    if (col.type === "money") return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    if (col.type === "bool") return v ? "Sim" : "Não";
    if (col.type === "badge" && col.options) {
      const o = col.options.find(o => o.value === v);
      return o ? <span className={`text-xs px-2 py-0.5 rounded-full ${o.color}`}>{o.label}</span> : v;
    }
    if (col.render) return col.render(it);
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

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-gray-500 text-xs">
              <tr>{columns.map(c => <th key={c.key} className="p-2 text-left">{c.label}</th>)}
                <th className="p-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={columns.length + 1} className="p-6 text-center text-gray-400">Carregando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={columns.length + 1} className="p-8 text-center text-gray-400">Nenhum registro.</td></tr>
              ) : filtered.map(it => (
                <tr key={it.id} className="border-t hover:bg-gray-50">
                  {columns.map(c => <td key={c.key} className="p-2">{renderCell(it, c)}</td>)}
                  <td className="p-2 text-right whitespace-nowrap">
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
          onSaved={load}
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
    });
    return o;
  };
  const [form, setForm] = useState(buildInitial);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const onCnpjLookup = async () => {
    const digits = onlyDigits(form.cnpj || "");
    if (digits.length !== 14) { setMsg(""); return; }
    setBusy(true); setMsg("Consultando CNPJ na Receita...");
    const res = await lookupCnpj(digits);
    setBusy(false);
    if (res?.error) { setMsg("⚠ " + res.error); return; }
    setForm(prev => ({
      ...prev,
      razao_social: res.razao_social || prev.razao_social,
      nome_fantasia: res.nome_fantasia || prev.nome_fantasia,
      cep: res.cep ? maskCep(res.cep) : prev.cep,
      address: res.address || prev.address,
      number: res.number || prev.number,
      district: res.district || prev.district,
      city: res.city || prev.city,
      uf: res.uf || prev.uf,
      ibge_code: res.ibge_code || prev.ibge_code,
      phone: res.phone ? maskPhone(res.phone) : prev.phone,
    }));
    setMsg("Dados preenchidos pela Receita Federal.");
  };

  const onCepLookup = async () => {
    const digits = onlyDigits(form.cep || "");
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
    }
    return next;
  });

  const handleSave = async () => {
    for (const f of fields) if (f.required && !String(form[f.key] ?? "").trim()) { alert(`Informe ${f.label}.`); return; }
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
      onSaved();
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
                  {(entityOptions[f.key] || []).map(o => <option key={o.id} value={o.id}>{o[f.labelKey || "name"]}</option>)}
                </select>
              ) : (
                <input
                  type={f.type === "number" ? "number" : f.inputType || "text"}
                  value={form[f.key]}
                  onChange={e => {
                    let v = e.target.value;
                    if (f.mask === "cnpj") v = maskCpfCnpj(v);
                    else if (f.mask === "cep") v = maskCep(v);
                    else if (f.mask === "phone") v = maskPhone(v);
                    set(f.key, v);
                  }}
                  onBlur={f.lookup === "cnpj" ? onCnpjLookup : f.mask === "cep" ? onCepLookup : undefined}
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm mt-1"
                />
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
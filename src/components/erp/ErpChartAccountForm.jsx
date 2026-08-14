import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Search, Plus, AlertTriangle } from "lucide-react";

const TYPE_OPTS = [
  { value: "ativo", label: "Ativo", nature: "devedora" },
  { value: "passivo", label: "Passivo", nature: "credora" },
  { value: "patrimonio_liquido", label: "Patrimônio Líquido", nature: "credora" },
  { value: "receita", label: "Receita", nature: "credora" },
  { value: "despesa", label: "Despesa", nature: "devedora" },
  { value: "compensacao", label: "Compensação", nature: "" },
];
const ENCERRAMENTO_OPTS = [
  { value: "nao_aplica", label: "Não Aplica" },
  { value: "sim", label: "Sim" },
  { value: "nao", label: "Não" },
];
const CLASS_IND_OPTS = [
  { value: "nao_aplica", label: "Não Aplica" },
  { value: "insumos", label: "Insumos" },
  { value: "mao_de_obra", label: "Mão de Obra" },
  { value: "ggf", label: "GGF" },
];
const ESTRUTURA_OPTS = [
  { value: "nao_aplica", label: "Não Aplica" },
  { value: "direto", label: "Custo Direto" },
  { value: "indireto", label: "Custo Indireto" },
];
const SIM_NAO = [
  { value: "sim", label: "Sim" },
  { value: "nao", label: "Não" },
];
const TIPO_OPTS = [
  { value: "analitica", label: "ANALÍTICA" },
  { value: "sintetica", label: "SINTÉTICA" },
];

function Field({ label, children, full }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <Label className="block mb-1 text-gray-600">{label}</Label>
      {children}
    </div>
  );
}

function Select({ value, onChange, options, placeholder }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} className="w-full h-9 rounded-md border border-gray-300 bg-white px-3 text-sm">
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export default function ErpChartAccountForm({ user, editing, accounts, refItems, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: editing?.name || "",
    referencia: editing?.referencia || "",
    code: editing?.code || "",
    classificacao: editing?.classificacao || "",
    account_type: editing?.account_type || "ativo",
    nature: editing?.nature || "devedora",
    conta_encerramento: editing?.conta_encerramento || "nao_aplica",
    classificacao_industrial: editing?.classificacao_industrial || "nao_aplica",
    estrutura_custo: editing?.estrutura_custo || "nao_aplica",
    concilia_lancamentos: editing?.concilia_lancamentos ?? true,
    conta_orcamentaria: editing?.conta_orcamentaria ?? false,
    grau: editing?.grau || 1,
    tipo: editing?.accepts_entries === false ? "sintetica" : "analitica",
    parent_code: editing?.parent_code || "",
    referential_code: editing?.referential_code || "",
    referential_name: editing?.referential_name || "",
    usa_centro_custo: editing?.usa_centro_custo ?? false,
    is_active: editing?.is_active !== false,
  });
  const [refSearch, setRefSearch] = useState("");
  const [showRefSearch, setShowRefSearch] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const set = (k, v) => setForm(p => {
    const next = { ...p, [k]: v };
    // Conta referencial só existe em analítica
    if (k === "tipo" && v === "sintetica") {
      next.referential_code = "";
      next.referential_name = "";
    }
    return next;
  });

  const onType = (t) => { const opt = TYPE_OPTS.find(o => o.value === t); setForm(p => ({ ...p, account_type: t, nature: opt.nature || p.nature })); };
  const onRef = (code) => {
    const r = refItems.find(r => r.code === code);
    setForm(p => ({ ...p, referential_code: code, referential_name: r?.name || "" }));
    setShowRefSearch(false);
  };

  const filteredRef = useMemo(() => refItems.filter(r => (r.code + " " + r.name).toLowerCase().includes(refSearch.toLowerCase())).slice(0, 100), [refItems, refSearch]);

  // Validação de unicidade
  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = "Informe a descrição.";
    if (!form.code.trim()) errs.code = "Informe a máscara/código.";
    // Unicidade code
    const dupCode = accounts.find(a => a.code === form.code.trim() && a.id !== editing?.id);
    if (dupCode) errs.code = `Código "${form.code}" já existe (${dupCode.name}).`;
    // Unicidade referencial (só analítica)
    if (form.tipo === "analitica" && form.referential_code) {
      const dupRef = accounts.find(a => a.referential_code === form.referential_code && a.id !== editing?.id);
      if (dupRef) errs.referential_code = `Conta referencial "${form.referential_code}" já vinculada a ${dupRef.name}.`;
    }
    // Referencial obrigatório para analítica
    if (form.tipo === "analitica" && !form.referential_code) {
      errs.referential_code = "Conta referencial é obrigatória para contas analíticas.";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    const isAnalitica = form.tipo === "analitica";
    const parent = accounts.find(a => a.code === form.parent_code);
    const payload = {
      user_email: user.email,
      code: form.code.trim(),
      name: form.name.trim(),
      referencia: form.referencia || undefined,
      grau: Number(form.grau) || 1,
      account_type: form.account_type,
      nature: form.nature,
      classificacao: form.classificacao || undefined,
      conta_encerramento: form.conta_encerramento,
      classificacao_industrial: form.classificacao_industrial,
      estrutura_custo: form.estrutura_custo,
      concilia_lancamentos: !!form.concilia_lancamentos,
      conta_orcamentaria: !!form.conta_orcamentaria,
      accepts_entries: isAnalitica,
      parent_code: form.parent_code || undefined,
      parent_id: parent?.id || undefined,
      parent_name: parent?.name || undefined,
      referential_code: isAnalitica ? form.referential_code : undefined,
      referential_name: isAnalitica ? form.referential_name : undefined,
      usa_centro_custo: !!form.usa_centro_custo,
      participates_production_cost: form.classificacao_industrial !== "nao_aplica",
      production_cost_type: form.classificacao_industrial !== "nao_aplica" ? form.classificacao_industrial : undefined,
      is_active: !!form.is_active,
    };
    try {
      if (editing?.id) await base44.entities.ErpChartAccount.update(editing.id, payload);
      else await base44.entities.ErpChartAccount.create(payload);
      onSaved(); onClose();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
          <h2 className="font-bold text-indigo-800">Cadastro de Plano de Contas</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Descrição *" full>
              <Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="CAIXA" />
              {errors.name && <p className="text-xs text-red-500 mt-0.5">{errors.name}</p>}
            </Field>

            <Field label="Referência">
              <Input value={form.referencia} onChange={e => set("referencia", e.target.value)} placeholder="1000" />
            </Field>
            <Field label="Máscara Sugerida *">
              <Input value={form.code} onChange={e => set("code", e.target.value)} placeholder="1.1.01.01.0001" />
              {errors.code && <p className="text-xs text-red-500 mt-0.5">{errors.code}</p>}
            </Field>

            <Field label="Classificação">
              <Input value={form.classificacao} onChange={e => set("classificacao", e.target.value)} placeholder="Classificação" />
            </Field>
            <Field label="Identificação Níveis *">
              <Select value={form.account_type} onChange={onType} options={TYPE_OPTS} />
            </Field>

            <Field label="Natureza da Conta">
              <Select value={form.nature} onChange={v => set("nature", v)} options={[{value:"devedora",label:"Devedora"},{value:"credora",label:"Credora"}]} />
            </Field>
            <Field label="Conta Encerramento">
              <Select value={form.conta_encerramento} onChange={v => set("conta_encerramento", v)} options={ENCERRAMENTO_OPTS} />
            </Field>

            <Field label="Classificação Industrial">
              <Select value={form.classificacao_industrial} onChange={v => set("classificacao_industrial", v)} options={CLASS_IND_OPTS} />
            </Field>
            <Field label="Estrutura de Custo">
              <Select value={form.estrutura_custo} onChange={v => set("estrutura_custo", v)} options={ESTRUTURA_OPTS} />
            </Field>

            <Field label="Concilia Lançamentos">
              <Select value={form.concilia_lancamentos ? "sim" : "nao"} onChange={v => set("concilia_lancamentos", v === "sim")} options={SIM_NAO} />
            </Field>
            <Field label="Conta Orçamentária">
              <Select value={form.conta_orcamentaria ? "sim" : "nao"} onChange={v => set("conta_orcamentaria", v === "sim")} options={SIM_NAO} />
            </Field>

            <Field label="Grau">
              <Input type="number" value={form.grau} onChange={e => set("grau", e.target.value)} placeholder="5" />
            </Field>
            <Field label="Tipo">
              <Select value={form.tipo} onChange={v => set("tipo", v)} options={TIPO_OPTS} />
            </Field>

            <Field label="Nível Superior">
              <Input value={form.parent_code} onChange={e => set("parent_code", e.target.value)} placeholder="1.1.01.01" list="parent-codes" />
              <datalist id="parent-codes">
                {accounts.filter(a => a.id !== editing?.id).map(a => <option key={a.id} value={a.code}>{a.name}</option>)}
              </datalist>
            </Field>
            <Field label="Plano de Contas Referencial">
              <div className="relative">
                <Input
                  value={form.referential_code}
                  onChange={e => { set("referential_code", e.target.value); set("referential_name", ""); }}
                  placeholder={form.tipo === "sintetica" ? "Null (sintética)" : "1.01.01.01.01"}
                  disabled={form.tipo === "sintetica"}
                  className={form.tipo === "sintetica" ? "bg-gray-100 text-gray-400" : "pr-9"}
                />
                {form.tipo === "analitica" && (
                  <button type="button" onClick={() => setShowRefSearch(s => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-indigo-600">
                    <Search className="w-4 h-4" />
                  </button>
                )}
                {showRefSearch && form.tipo === "analitica" && (
                  <div className="absolute z-20 mt-1 w-full bg-white border rounded-md shadow-lg max-h-64 overflow-y-auto">
                    <div className="p-2 border-b sticky top-0 bg-white">
                      <input autoFocus value={refSearch} onChange={e => setRefSearch(e.target.value)} placeholder="Buscar conta referencial..." className="w-full h-8 rounded border px-2 text-sm" />
                    </div>
                    {filteredRef.map(r => (
                      <button key={r.code} type="button" onClick={() => onRef(r.code)} className="w-full text-left px-3 py-1.5 hover:bg-indigo-50 text-xs border-b">
                        <span className="font-mono">{r.code}</span> — {r.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {form.referential_name && <p className="text-xs text-gray-500 mt-0.5">{form.referential_name}</p>}
              {errors.referential_code && <p className="text-xs text-red-500 mt-0.5">{errors.referential_code}</p>}
            </Field>

            <Field label="Usa Centro de Custo">
              <Select value={form.usa_centro_custo ? "sim" : "nao"} onChange={v => set("usa_centro_custo", v === "sim")} options={SIM_NAO} />
            </Field>
            <div className="flex items-end">
              <Button type="button" variant="outline" size="sm" disabled={!form.usa_centro_custo} className="gap-1.5 text-indigo-700 border-indigo-300">
                <Plus className="w-4 h-4" /> Vincular Centros de Custo
              </Button>
            </div>
          </div>

          {form.tipo === "sintetica" && (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg p-2.5 text-xs text-blue-700">
              <AlertTriangle className="w-4 h-4 shrink-0" /> Conta Sintética (agrupadora): a conta referencial será nula e não aceita lançamentos.
            </div>
          )}
        </div>
        <div className="p-4 border-t flex gap-2 justify-end sticky bottom-0 bg-white">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="bg-indigo-700 hover:bg-indigo-800">{saving ? "Salvando..." : "Salvar"}</Button>
        </div>
      </div>
    </div>
  );
}
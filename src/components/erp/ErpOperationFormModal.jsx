import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";
import { KIND_LABELS } from "@/lib/erpCfopSuggest";

const OP_TYPE_OPTS = [
  { value: "entrada", label: "Entrada" },
  { value: "saida", label: "Saída" },
];
const KIND_OPTS = Object.entries(KIND_LABELS).map(([value, label]) => ({ value, label }));

const onlyDigits = (v) => String(v || "").replace(/\D/g, "");

export default function ErpOperationFormModal({ user, operation, onClose, onSaved }) {
  const [form, setForm] = useState({
    type: operation?.type || "saida",
    kind: operation?.kind || "comercializacao",
    code: operation?.code || "",
    name: operation?.name || "",
    nature_operation: operation?.nature_operation || "",
    description: operation?.description || "",
    is_patrimonio: !!operation?.is_patrimonio,
    is_active: operation?.is_active !== false,
    flag_contabil: operation?.flag_contabil !== false,
    flag_fiscal: operation?.flag_fiscal !== false,
    flag_financeiro: operation?.flag_financeiro !== false,
    cfop_dentro_estado: operation?.cfop_dentro_estado || "",
    cfop_fora_estado: operation?.cfop_fora_estado || "",
    cfop_importacao: operation?.cfop_importacao || "",
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) { alert("Informe o nome da operação."); return; }
    if (form.flag_fiscal && !onlyDigits(form.cfop_dentro_estado) && !onlyDigits(form.cfop_fora_estado) && !onlyDigits(form.cfop_importacao)) {
      alert("Operação marcada como Fiscal: informe pelo menos um CFOP (dentro do estado, fora do estado ou importação).");
      return;
    }
    setSaving(true);
    const payload = {
      user_email: user.email,
      type: form.type,
      kind: form.kind,
      code: form.code || undefined,
      name: form.name.trim(),
      nature_operation: form.nature_operation || undefined,
      description: form.description || undefined,
      flag_contabil: form.flag_contabil,
      flag_fiscal: form.flag_fiscal,
      flag_financeiro: form.flag_financeiro,
      cfop_dentro_estado: onlyDigits(form.cfop_dentro_estado) || undefined,
      cfop_fora_estado: onlyDigits(form.cfop_fora_estado) || undefined,
      cfop_importacao: onlyDigits(form.cfop_importacao) || undefined,
      is_patrimonio: form.is_patrimonio,
      is_active: form.is_active,
    };
    try {
      if (operation?.id) await base44.entities.ErpOperation.update(operation.id, payload);
      else await base44.entities.ErpOperation.create(payload);
      onSaved();
      onClose();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  const fieldClass = "w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm";

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
          <h2 className="font-bold">{operation ? "Editar Operação" : "Nova Operação"}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo *</Label>
              <select value={form.type} onChange={e => set("type", e.target.value)} className={fieldClass}>
                {OP_TYPE_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div><Label>Código</Label><Input value={form.code} onChange={e => set("code", e.target.value)} /></div>
          </div>
          <div><Label>Nome da Operação *</Label><Input value={form.name} onChange={e => set("name", e.target.value)} /></div>

          <div>
            <Label>Natureza base *</Label>
            <select value={form.kind} onChange={e => set("kind", e.target.value)} className={fieldClass}>
              {KIND_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <p className="text-[11px] text-gray-500 mt-1">O CFOP será sugerido automaticamente na regra fiscal conforme esta natureza, a UF de destino e a Substituição Tributária.</p>
          </div>

          <div><Label>Natureza da Operação (texto livre)</Label><Input value={form.nature_operation} onChange={e => set("nature_operation", e.target.value)} /></div>
          <div><Label>Descrição</Label><Input value={form.description} onChange={e => set("description", e.target.value)} /></div>

          <div className="border rounded-lg p-3 space-y-2 bg-gray-50">
            <p className="text-xs font-semibold text-gray-600">Integrações da operação</p>
            <div className="grid grid-cols-3 gap-2">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.flag_contabil} onChange={e => set("flag_contabil", e.target.checked)} className="w-4 h-4" /> Contábil</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.flag_fiscal} onChange={e => set("flag_fiscal", e.target.checked)} className="w-4 h-4" /> Fiscal</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.flag_financeiro} onChange={e => set("flag_financeiro", e.target.checked)} className="w-4 h-4" /> Financeiro</label>
            </div>
            <p className="text-[11px] text-gray-500">Contábil: gera lançamento contábil. Fiscal: exige CFOP e envia ao fiscal (SPEDs fiscais). Financeiro: gera as parcelas no contas a pagar.</p>
            <div className="grid grid-cols-3 gap-2">
              <div><Label className="text-xs">CFOP dentro do estado</Label><Input value={form.cfop_dentro_estado} onChange={e => set("cfop_dentro_estado", onlyDigits(e.target.value).slice(0, 4))} placeholder="ex: 1102" /></div>
              <div><Label className="text-xs">CFOP fora do estado</Label><Input value={form.cfop_fora_estado} onChange={e => set("cfop_fora_estado", onlyDigits(e.target.value).slice(0, 4))} placeholder="ex: 2102" /></div>
              <div><Label className="text-xs">CFOP importação</Label><Input value={form.cfop_importacao} onChange={e => set("cfop_importacao", onlyDigits(e.target.value).slice(0, 4))} placeholder="ex: 3102" /></div>
            </div>
            <p className="text-[11px] text-gray-500">CFOPs opcionais — quando a operação é marcada como Fiscal, ao menos um é obrigatório; nas entradas o CFOP é escolhido conforme a UF do fornecedor.</p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_patrimonio} onChange={e => set("is_patrimonio", e.target.checked)} className="w-4 h-4" /> Gera bem patrimonial (imobilizado)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_active} onChange={e => set("is_active", e.target.checked)} className="w-4 h-4" /> Ativa
          </label>
        </div>
        <div className="p-4 border-t flex gap-2 justify-end sticky bottom-0 bg-white">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </div>
      </div>
    </div>
  );
}
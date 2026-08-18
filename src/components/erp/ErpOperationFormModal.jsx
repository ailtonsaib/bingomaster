import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";
import ErpCfopPicker from "@/components/erp/ErpCfopPicker";

const OP_TYPE_OPTS = [
  { value: "entrada", label: "Entrada" },
  { value: "saida", label: "Saída" },
];

// Prefixo esperado do CFOP conforme tipo de operação e cenário
const CFOP_PREFIX = {
  entrada: { cfop: "1", cfop_fora_estado: "2", cfop_importacao_exportacao: "3" },
  saida: { cfop: "5", cfop_fora_estado: "6", cfop_importacao_exportacao: "7" },
};

const onlyDigits = (v) => String(v || "").replace(/\D/g, "");

export default function ErpOperationFormModal({ user, operation, onClose, onSaved }) {
  const [form, setForm] = useState({
    type: operation?.type || "saida",
    code: operation?.code || "",
    name: operation?.name || "",
    cfop: operation?.cfop || "",
    cfop_fora_estado: operation?.cfop_fora_estado || "",
    cfop_importacao_exportacao: operation?.cfop_importacao_exportacao || "",
    nature_operation: operation?.nature_operation || "",
    description: operation?.description || "",
    is_patrimonio: !!operation?.is_patrimonio,
    is_active: operation?.is_active !== false,
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const prefixes = CFOP_PREFIX[form.type];
  const impExpLabel = form.type === "entrada" ? "CFOP de Importação" : "CFOP de Exportação";
  const impExpHint = form.type === "entrada" ? "Inicia com 3" : "Inicia com 7";

  const validateCfop = (key) => {
    const v = onlyDigits(form[key]);
    if (!v) return true; // opcional tratado à parte
    return v.startsWith(prefixes[key]);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { alert("Informe o nome da operação."); return; }
    const cfopDentro = onlyDigits(form.cfop);
    const cfopFora = onlyDigits(form.cfop_fora_estado);
    if (!cfopDentro) { alert("Informe o CFOP dentro do estado."); return; }
    if (!cfopFora) { alert("Informe o CFOP fora do estado."); return; }
    if (!validateCfop("cfop")) { alert(`CFOP dentro do estado deve iniciar com ${prefixes.cfop} (tipo ${form.type}).`); return; }
    if (!validateCfop("cfop_fora_estado")) { alert(`CFOP fora do estado deve iniciar com ${prefixes.cfop_fora_estado} (tipo ${form.type}).`); return; }
    if (form.cfop_importacao_exportacao && !validateCfop("cfop_importacao_exportacao")) {
      alert(`${impExpLabel} deve iniciar com ${prefixes.cfop_importacao_exportacao} (tipo ${form.type}).`); return;
    }
    setSaving(true);
    const payload = {
      user_email: user.email,
      type: form.type,
      code: form.code || undefined,
      name: form.name.trim(),
      cfop: cfopDentro,
      cfop_fora_estado: cfopFora || undefined,
      cfop_importacao_exportacao: onlyDigits(form.cfop_importacao_exportacao) || undefined,
      nature_operation: form.nature_operation || undefined,
      description: form.description || undefined,
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

          <div className="border-t pt-3 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase">CFOPs ({form.type === "entrada" ? "Entrada" : "Saída"})</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>CFOP Dentro Estado *</Label>
                <ErpCfopPicker value={form.cfop} onChange={code => set("cfop", code)} prefixes={[prefixes.cfop]} />
              </div>
              <div>
                <Label>CFOP Fora Estado *</Label>
                <ErpCfopPicker value={form.cfop_fora_estado} onChange={code => set("cfop_fora_estado", code)} prefixes={[prefixes.cfop_fora_estado]} />
              </div>
              <div>
                <Label>{impExpLabel}</Label>
                <ErpCfopPicker value={form.cfop_importacao_exportacao} onChange={code => set("cfop_importacao_exportacao", code)} prefixes={[prefixes.cfop_importacao_exportacao]} />
              </div>
            </div>
          </div>

          <div><Label>Natureza da Operação</Label><Input value={form.nature_operation} onChange={e => set("nature_operation", e.target.value)} /></div>
          <div><Label>Descrição</Label><Input value={form.description} onChange={e => set("description", e.target.value)} /></div>
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
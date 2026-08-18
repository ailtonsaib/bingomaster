import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";
import { fmtMoney } from "@/lib/erpUtils";

export default function ErpApproverFormModal({ user, approver, onClose, onSaved }) {
  const [departments, setDepartments] = useState([]);
  const [erpUsers, setErpUsers] = useState([]);
  const [form, setForm] = useState({
    department_id: approver?.department_id || "",
    approver_user_id: approver?.approver_user_id || "",
    substitute_user_id: approver?.substitute_user_id || "",
    max_value: approver?.max_value || 0,
    is_active: approver?.is_active !== false,
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  useEffect(() => {
    Promise.all([
      base44.entities.ErpDepartment.filter({ user_email: user.email }, "name", 500),
      base44.entities.ErpUser.filter({ owner_email: user.email }, "name", 500),
    ]).then(([d, u]) => { setDepartments(d); setErpUsers(u.filter(x => x.is_active !== false)); })
      .catch(() => {});
  }, [user.email]);

  const handleSave = async () => {
    if (!form.department_id) { alert("Selecione o setor."); return; }
    if (!form.approver_user_id) { alert("Selecione o aprovador."); return; }
    setSaving(true);
    const dept = departments.find(d => d.id === form.department_id);
    const apv = erpUsers.find(u => u.id === form.approver_user_id);
    const sub = erpUsers.find(u => u.id === form.substitute_user_id);
    const payload = {
      user_email: user.email,
      department_id: form.department_id,
      department_name: dept?.name || "",
      approver_user_id: form.approver_user_id,
      approver_name: apv?.name || "",
      approver_email: apv?.email || "",
      substitute_user_id: form.substitute_user_id || undefined,
      substitute_name: sub?.name || undefined,
      substitute_email: sub?.email || undefined,
      max_value: Number(form.max_value) || 0,
      is_active: form.is_active,
    };
    try {
      if (approver?.id) await base44.entities.ErpApprover.update(approver.id, payload);
      else await base44.entities.ErpApprover.create(payload);
      onSaved();
      onClose();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  const sel = "w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm";

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
          <h2 className="font-bold">{approver ? "Editar Aprovador" : "Novo Aprovador"}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <Label>Setor / Departamento *</Label>
            <select value={form.department_id} onChange={e => set("department_id", e.target.value)} className={sel}>
              <option value="">Selecione...</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            {departments.length === 0 && <p className="text-xs text-gray-400 mt-1">Nenhum setor cadastrado. Crie departamentos primeiro.</p>}
          </div>
          <div>
            <Label>Aprovador (usuário) *</Label>
            <select value={form.approver_user_id} onChange={e => set("approver_user_id", e.target.value)} className={sel}>
              <option value="">Selecione...</option>
              {erpUsers.map(u => <option key={u.id} value={u.id}>{u.name} — {u.email} ({u.user_type})</option>)}
            </select>
            {erpUsers.length === 0 && <p className="text-xs text-gray-400 mt-1">Nenhum usuário ERP cadastrado.</p>}
          </div>
          <div>
            <Label>Substituto (opcional)</Label>
            <select value={form.substitute_user_id} onChange={e => set("substitute_user_id", e.target.value)} className={sel}>
              <option value="">Nenhum</option>
              {erpUsers.filter(u => u.id !== form.approver_user_id).map(u => <option key={u.id} value={u.id}>{u.name} — {u.email} ({u.user_type})</option>)}
            </select>
          </div>
          <div>
            <Label>Valor máximo de aprovação (R$)</Label>
            <Input type="number" step="0.01" value={form.max_value} onChange={e => set("max_value", e.target.value)} />
            <p className="text-xs text-gray-400 mt-1">Acima deste valor, somente usuário do tipo <b>diretor</b> poderá aprovar.</p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_active} onChange={e => set("is_active", e.target.checked)} className="w-4 h-4" />
            Ativo
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
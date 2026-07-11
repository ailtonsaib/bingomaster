import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";

export default function TicketForm({ users, types, priorities, currentUser, onSave, onCancel }) {
  const [form, setForm] = useState({
    title: "", description: "", type_id: "", priority_id: "", assigned_to_id: "",
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    const type = types.find((t) => t.id === form.type_id);
    const priority = priorities.find((p) => p.id === form.priority_id);
    const assignee = users.find((u) => u.id === form.assigned_to_id);
    await onSave({
      title: form.title,
      description: form.description,
      type_id: form.type_id || "",
      type_name: type?.name || "",
      priority_id: form.priority_id || "",
      priority_name: priority?.name || "",
      priority_level: priority?.level || 0,
      assigned_to_id: form.assigned_to_id || "",
      assigned_to_name: assignee?.name || "",
      created_by_id: currentUser.id,
      created_by_name: currentUser.name,
      company_id: currentUser.company_id,
      company_name: currentUser.company_name,
    });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-lg">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Novo Chamado</h2>
            <Button variant="ghost" size="icon" onClick={onCancel}><X className="w-4 h-4" /></Button>
          </div>
          <div>
            <Label>Título *</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Resumo do chamado" />
          </div>
          <div>
            <Label>Descrição</Label>
            <textarea className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm min-h-[80px]" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo</Label>
              <select className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={form.type_id} onChange={(e) => setForm({ ...form, type_id: e.target.value })}>
                <option value="">Selecione...</option>
                {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <Label>Prioridade</Label>
              <select className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={form.priority_id} onChange={(e) => setForm({ ...form, priority_id: e.target.value })}>
                <option value="">Selecione...</option>
                {priorities.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <Label>Atribuir para</Label>
            <select className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={form.assigned_to_id} onChange={(e) => setForm({ ...form, assigned_to_id: e.target.value })}>
              <option value="">Sem responsável</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
            </select>
          </div>
          <div className="flex gap-2 pt-2">
            <Button className="flex-1" onClick={handleSubmit} disabled={saving || !form.title.trim()}>{saving ? "Salvando..." : "Criar Chamado"}</Button>
            <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
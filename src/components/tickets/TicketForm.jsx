import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Paperclip, Loader2, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function TicketForm({ users, types, priorities, currentUser, onSave, onCancel }) {
  const [form, setForm] = useState({
    title: "", description: "", type_id: "", priority_id: "", assigned_to_id: "",
  });
  const [saving, setSaving] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);

  const handleFiles = async (files) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const uploaded = [];
      for (const file of files) {
        const res = await base44.integrations.Core.UploadFile({ file });
        uploaded.push({ file_url: res.file_url, file_name: file.name });
      }
      setAttachments((prev) => [...prev, ...uploaded]);
    } catch (e) { alert("Erro ao enviar arquivo"); }
    setUploading(false);
  };

  const removeAttachment = (idx) => setAttachments((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
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
        created_by_role: currentUser.role,
        company_id: currentUser.company_id,
        company_name: currentUser.company_name,
        attachments,
      });
    } catch (err) {
      /* erro já tratado no handleCreate */
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
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
          {/* Attachments */}
          <div>
            <Label>Anexos</Label>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer text-sm px-3 py-2 rounded-md border border-dashed border-input hover:bg-muted/30 transition-colors">
                <Paperclip className="w-4 h-4" />
                <span>Adicionar arquivos</span>
                <input type="file" multiple className="hidden" onChange={(e) => handleFiles(Array.from(e.target.files))} />
              </label>
              {uploading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
            </div>
            {attachments.length > 0 && (
              <div className="mt-2 space-y-1">
                {attachments.map((a, i) => (
                  <div key={i} className="flex items-center justify-between bg-muted/30 rounded px-2 py-1 text-xs">
                    <span className="truncate">{a.file_name}</span>
                    <button onClick={() => removeAttachment(i)} className="text-destructive hover:text-destructive/80"><Trash2 className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-2 pt-2">
            <Button className="flex-1" onClick={handleSubmit} disabled={saving || uploading || !form.title.trim()}>{saving ? "Salvando..." : "Criar Chamado"}</Button>
            <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
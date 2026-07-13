import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Loader2 } from "lucide-react";

export default function UserEditModal({ user, currentUser, onSave, onClose }) {
  const [form, setForm] = useState({
    name: user.name || "",
    email: user.email || "",
    role: user.role || "agent",
    password: "",
  });
  const [saving, setSaving] = useState(false);
  const isSystemAdmin = currentUser.role === "system_admin";

  const handleSave = async () => {
    if (!form.name || !form.email) return;
    setSaving(true);
    const updates = { name: form.name, email: form.email, role: form.role };
    if (form.password) updates.password = form.password;
    await onSave(user.id, updates);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Editar Usuário</h2>
            <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
          </div>
          <div>
            <Label>Nome</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <Label>Tipo de Acesso</Label>
            <select className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="requester">Solicitante (Cliente)</option>
              <option value="agent">Agente (Atendente)</option>
              <option value="master_agent">Atendente Master</option>
              {isSystemAdmin && <option value="company_admin">Administrador da Empresa</option>}
            </select>
          </div>
          <div>
            <Label>Nova Senha (opcional)</Label>
            <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Deixe em branco para manter a atual" />
          </div>
          <div className="flex gap-2 pt-2">
            <Button className="flex-1" onClick={handleSave} disabled={saving || !form.name || !form.email}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar Alterações"}
            </Button>
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
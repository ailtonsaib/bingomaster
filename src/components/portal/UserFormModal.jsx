import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function UserFormModal({ adminEmail, onClose, onSaved }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [canAccessBingo, setCanAccessBingo] = useState(true);
  const [canAccessFinance, setCanAccessFinance] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await base44.functions.invoke('portalAuth', {
        operation: 'createUser',
        admin_email: adminEmail,
        name,
        email,
        password,
        can_access_bingo: canAccessBingo,
        can_access_finance: canAccessFinance,
      });
      onSaved();
      onClose();
    } catch (err) {
      alert(err.response?.data?.error || "Erro ao criar usuário");
    }
    setSaving(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-background rounded-2xl w-full max-w-md shadow-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold mb-4">Novo Usuário</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <Label>Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <Label>Senha</Label>
            <Input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2 pt-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={canAccessBingo}
                onChange={(e) => setCanAccessBingo(e.target.checked)}
                className="w-4 h-4"
              />
              Acesso ao BingoMaster
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={canAccessFinance}
                onChange={(e) => setCanAccessFinance(e.target.checked)}
                className="w-4 h-4"
              />
              Acesso ao Controle de Finanças
            </label>
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Criando..." : "Criar Usuário"}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
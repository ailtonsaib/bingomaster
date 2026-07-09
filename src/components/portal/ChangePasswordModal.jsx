import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, KeyRound, X } from "lucide-react";

export default function ChangePasswordModal({ userEmail, onClose }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("Preencha todos os campos.");
      return;
    }
    if (newPassword.length < 6) {
      setError("A nova senha deve ter no mínimo 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("A confirmação de senha não confere.");
      return;
    }
    if (newPassword === currentPassword) {
      setError("A nova senha deve ser diferente da atual.");
      return;
    }

    setLoading(true);
    try {
      const res = await base44.functions.invoke('portalAuth', {
        operation: 'changePassword',
        email: userEmail,
        current_password: currentPassword,
        new_password: newPassword,
      });
      if (res.data?.success) {
        onClose();
      } else {
        setError(res.data?.error || "Erro ao alterar senha.");
      }
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao alterar senha.");
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl p-6 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold">Alterar Senha</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="text-sm font-medium mb-1.5 block">Senha atual</Label>
            <Input
              type="password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              className="h-10"
            />
          </div>
          <div>
            <Label className="text-sm font-medium mb-1.5 block">Nova senha</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              className="h-10"
            />
          </div>
          <div>
            <Label className="text-sm font-medium mb-1.5 block">Confirmar nova senha</Label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="h-10"
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={loading} className="gap-1.5">
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Alterar Senha
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, ShieldCheck, Loader2 } from "lucide-react";

export default function DiscountAuthModal({ ownerEmail, discountAmount, onAuthorized, onClose }) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleConfirm = async () => {
    if (!password) {
      setError("Digite a senha de autorização.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await base44.functions.invoke("portalAuth", {
        operation: "validateDiscountAuth",
        owner_email: ownerEmail,
        password,
      });
      const data = res?.data || res;
      if (data?.authorized) {
        onAuthorized(data.authorized_by);
      } else {
        setError(data?.error || "Senha inválida ou sem permissão.");
      }
    } catch {
      setError("Não foi possível validar a autorização.");
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-amber-600" />
            </div>
            <h3 className="font-bold text-[#1B1C21]">Autorização de Desconto</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
            Desconto solicitado: <strong>R$ {parseFloat(discountAmount || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong>
            <br />
            <span className="text-xs">Informe a senha de um usuário autorizado para conceder o desconto.</span>
          </div>

          <div>
            <Label>Senha de Autorização</Label>
            <Input
              type="password"
              autoFocus
              value={password}
              onChange={e => { setPassword(e.target.value); setError(""); }}
              onKeyDown={e => { if (e.key === "Enter") handleConfirm(); }}
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="px-5 py-3 border-t flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={loading} className="bg-amber-600 hover:bg-amber-700">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
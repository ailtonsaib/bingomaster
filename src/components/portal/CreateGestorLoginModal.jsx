import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, Loader2, CheckCircle2 } from "lucide-react";

const DIAGNOSTIC_PLANS = [
  { key: "free", label: "FREE" },
  { key: "teste", label: "TESTE" },
  { key: "bronze", label: "BRONZE" },
  { key: "master", label: "MASTER" },
];

export default function CreateGestorLoginModal({ adminEmail, company, onClose, onSaved }) {
  const [name, setName] = useState(company.admin_name || company.responsible_name || "");
  const [email, setEmail] = useState(company.admin_email || company.user_email || "");
  const [password, setPassword] = useState("gestor123");
  const [plan, setPlan] = useState(company.diagnostic_plan || "free");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [createdPassword, setCreatedPassword] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await base44.functions.invoke("portalAuth", {
        operation: "createCompanyGestorLogin",
        admin_email: adminEmail,
        company_id: company.id,
        gestor_name: name,
        gestor_password: password,
        diagnostic_plan: plan,
      });
      setCreatedPassword(res.data?.default_password || null);
      setSuccess(true);
      onSaved();
    } catch (err) {
      alert(err.response?.data?.error || err.data?.error || "Erro ao criar acesso");
    }
    setSaving(false);
  };

  if (success) {
    const isLiberate = createdPassword === null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
        <div className="bg-background rounded-2xl w-full max-w-md shadow-2xl p-6 text-center" onClick={(e) => e.stopPropagation()}>
          <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-lg font-bold mb-2">{isLiberate ? "Acesso Liberado!" : "Acesso Criado!"}</h2>
          <p className="text-sm text-muted-foreground mb-4">
            {isLiberate
              ? "A permissão da Oficina Premium foi concedida ao gestor existente. Ele já pode entrar com sua senha atual."
              : "O gestor agora pode entrar no sistema da Oficina Premium."}
          </p>
          {!isLiberate && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4 text-left">
              <p className="text-xs font-semibold text-amber-800 mb-1">Credenciais de acesso:</p>
              <p className="text-sm text-amber-700">Email: <span className="font-mono">{email}</span></p>
              <p className="text-sm text-amber-700">Senha: <span className="font-mono">{createdPassword}</span></p>
              <p className="text-xs text-amber-600 mt-1">Será solicitada a troca de senha no primeiro acesso.</p>
            </div>
          )}
          <Button onClick={onClose} className="w-full">Fechar</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-background rounded-2xl w-full max-w-md shadow-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-1 flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-cyan-600" /> Criar Acesso do Gestor
        </h2>
        <p className="text-xs text-muted-foreground mb-4">
          Empresa: <strong>{company.razao_social}</strong>
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label>Nome do gestor</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <Label>Email de login</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <Label>Senha inicial</Label>
            <Input value={password} onChange={(e) => setPassword(e.target.value)} required />
            <p className="text-xs text-muted-foreground mt-1">Será solicitada a troca no primeiro acesso.</p>
          </div>
          <div>
            <Label>Plano</Label>
            <select value={plan} onChange={(e) => setPlan(e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm mt-1">
              {DIAGNOSTIC_PLANS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={saving} className="gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
              {saving ? "Criando..." : "Criar Acesso"}
            </Button>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
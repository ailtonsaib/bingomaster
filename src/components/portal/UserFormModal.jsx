import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Info } from "lucide-react";

const BINGO_PLANS = [
  { key: "free", label: "FREE", desc: "50 cartelas" },
  { key: "basic", label: "BASIC", desc: "200 cartelas" },
  { key: "pro", label: "PRO", desc: "500 cartelas" },
  { key: "max", label: "MAX", desc: "1.000 cartelas" },
  { key: "ultra", label: "ULTRA", desc: "5.000 cartelas" },
  { key: "enterprise", label: "ENTERPRISE", desc: "Ilimitado" },
  { key: "mega", label: "MEGA", desc: "Ilimitado + Rifa" },
];

const FINANCE_PLANS = [
  { key: "test", label: "Teste", desc: "10 movimentações" },
  { key: "full", label: "Completo", desc: "Acesso ilimitado" },
];

const SPED_PLANS = [
  { key: "free", label: "FREE", desc: "5 downloads" },
  { key: "basic", label: "BASIC", desc: "Fiscal ilimitado" },
  { key: "pro", label: "PRO", desc: "Fiscal + Contribuições" },
  { key: "max", label: "MAX", desc: "Todos os módulos" },
];

export default function UserFormModal({ adminEmail, onClose, onSaved }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("Premier@123");
  const [canAccessBingo, setCanAccessBingo] = useState(true);
  const [bingoPlan, setBingoPlan] = useState("free");
  const [canAccessFinance, setCanAccessFinance] = useState(false);
  const [financePlan, setFinancePlan] = useState("test");
  const [canAccessChamados, setCanAccessChamados] = useState(false);
  const [canAccessSped, setCanAccessSped] = useState(false);
  const [spedPlan, setSpedPlan] = useState("free");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data = {
        can_access_bingo: canAccessBingo,
        can_access_finance: canAccessFinance,
        can_access_chamados: canAccessChamados,
        can_access_sped: canAccessSped,
        bingo_plan: canAccessBingo ? bingoPlan : "free",
        sped_plan: canAccessSped ? spedPlan : "free",
        finance_full_access: canAccessFinance && financePlan === "full",
        finance_transaction_limit: canAccessFinance && financePlan === "test" ? 10 : 0,
        finance_transactions_used: 0,
        finance_release_requested: false,
      };
      await base44.functions.invoke('portalAuth', {
        operation: 'createUser',
        admin_email: adminEmail,
        name,
        email,
        password,
        ...data,
      });
      onSaved();
      onClose();
    } catch (err) {
      alert(err.response?.data?.error || "Erro ao criar usuário");
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-background rounded-2xl w-full max-w-md shadow-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-4">Novo Usuário</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <Label>Senha de Primeiro Acesso</Label>
            <Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Senha temporária" />
            <p className="text-xs text-muted-foreground mt-1">Padrão: <span className="font-mono font-semibold">Premier@123</span> — o usuário poderá trocar no primeiro acesso.</p>
          </div>

          {/* BingoPremier permissions */}
          <div className="pt-2 border-t">
            <label className="flex items-center gap-2 text-sm font-medium mb-2">
              <input type="checkbox" checked={canAccessBingo} onChange={(e) => setCanAccessBingo(e.target.checked)} className="w-4 h-4" />
              BingoPremier
            </label>
            {canAccessBingo && (
              <select
                value={bingoPlan}
                onChange={(e) => setBingoPlan(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
              >
                {BINGO_PLANS.map((p) => (
                  <option key={p.key} value={p.key}>{p.label} — {p.desc}</option>
                ))}
              </select>
            )}
          </div>

          {/* Finance permissions */}
          <div className="pt-2 border-t">
            <label className="flex items-center gap-2 text-sm font-medium mb-2">
              <input type="checkbox" checked={canAccessFinance} onChange={(e) => setCanAccessFinance(e.target.checked)} className="w-4 h-4" />
              Controle de Finanças
            </label>
            {canAccessFinance && (
              <select
                value={financePlan}
                onChange={(e) => setFinancePlan(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
              >
                {FINANCE_PLANS.map((p) => (
                  <option key={p.key} value={p.key}>{p.label} — {p.desc}</option>
                ))}
              </select>
            )}
          </div>

          {/* Chamados permissions */}
          <div className="pt-2 border-t">
            <label className="flex items-center gap-2 text-sm font-medium mb-2">
              <input type="checkbox" checked={canAccessChamados} onChange={(e) => setCanAccessChamados(e.target.checked)} className="w-4 h-4" />
              Sistema de Chamados
            </label>
          </div>

          {/* SPED permissions */}
          <div className="pt-2 border-t">
            <label className="flex items-center gap-2 text-sm font-medium mb-2">
              <input type="checkbox" checked={canAccessSped} onChange={(e) => setCanAccessSped(e.target.checked)} className="w-4 h-4" />
              Validador SPED
            </label>
            {canAccessSped && (
              <select
                value={spedPlan}
                onChange={(e) => setSpedPlan(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
              >
                {SPED_PLANS.map((p) => (
                  <option key={p.key} value={p.key}>{p.label} — {p.desc}</option>
                ))}
              </select>
            )}
          </div>

          <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50">
            <Info className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              O usuário fará login com esta senha no portal e poderá trocá-la após o primeiro acesso.
            </p>
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
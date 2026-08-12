import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Link2, Loader2, CheckCircle2 } from "lucide-react";

const DIAGNOSTIC_PLANS = [
  { key: "free", label: "FREE" },
  { key: "teste", label: "TESTE" },
  { key: "bronze", label: "BRONZE" },
  { key: "master", label: "MASTER" },
];

function formatCnpj(v) {
  const d = String(v || "").replace(/\D/g, "").padStart(14, "0");
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}

export default function LinkCompanyToUserModal({ adminEmail, onClose, onSaved }) {
  const [companies, setCompanies] = useState([]);
  const [users, setUsers] = useState([]);
  const [companyId, setCompanyId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [plan, setPlan] = useState("master");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [compRes, userRes] = await Promise.all([
          base44.functions.invoke("portalAuth", { operation: "getDiagnosticCompanies", admin_email: adminEmail }),
          base44.functions.invoke("portalAuth", { operation: "getUsers", admin_email: adminEmail }),
        ]);
        setCompanies(compRes.data?.companies || []);
        setUsers((userRes.data?.users || []).filter((u) => u.is_active && !u.is_admin));
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    };
    load();
  }, [adminEmail]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!companyId || !userEmail) return;
    setSaving(true);
    try {
      const res = await base44.functions.invoke("portalAuth", {
        operation: "linkCompanyToUser",
        admin_email: adminEmail,
        company_id: companyId,
        user_email: userEmail,
        diagnostic_plan: plan,
      });
      setSuccess(res.data?.message || "Empresa vinculada com sucesso.");
      onSaved();
    } catch (err) {
      alert(err.response?.data?.error || err.data?.error || "Erro ao vincular empresa");
    }
    setSaving(false);
  };

  if (success) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
        <div className="bg-background rounded-2xl w-full max-w-md shadow-2xl p-6 text-center" onClick={(e) => e.stopPropagation()}>
          <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-lg font-bold mb-2">Empresa Vinculada!</h2>
          <p className="text-sm text-muted-foreground mb-4">{success}</p>
          <Button onClick={onClose} className="w-full">Fechar</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-background rounded-2xl w-full max-w-md shadow-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-1 flex items-center gap-2">
          <Link2 className="w-5 h-5 text-cyan-600" /> Vincular Empresa a Usuário
        </h2>
        <p className="text-xs text-muted-foreground mb-4">
          Associa uma empresa já cadastrada a um usuário existente do portal e libera o acesso à Oficina Premium.
        </p>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <Label>Empresa</Label>
              <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} required className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm mt-1">
                <option value="">Selecione...</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.razao_social} — {c.cnpj ? formatCnpj(c.cnpj) : "s/ CNPJ"}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Usuário (email de login)</Label>
              <select value={userEmail} onChange={(e) => setUserEmail(e.target.value)} required className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm mt-1">
                <option value="">Selecione...</option>
                {users.map((u) => (
                  <option key={u.email} value={u.email}>{u.name} — {u.email}</option>
                ))}
              </select>
              {users.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">Nenhum usuário ativo não-admin encontrado. Crie o usuário primeiro no painel.</p>
              )}
            </div>
            <div>
              <Label>Plano da Oficina</Label>
              <select value={plan} onChange={(e) => setPlan(e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm mt-1">
                {DIAGNOSTIC_PLANS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={saving || !companyId || !userEmail} className="gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                {saving ? "Vinculando..." : "Vincular"}
              </Button>
              <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Building2, Search, Loader2, Plus, Wrench, KeyRound } from "lucide-react";
import CreateGestorLoginModal from "@/components/portal/CreateGestorLoginModal";

const PLAN_LABELS = {
  free: "FREE",
  teste: "TESTE",
  bronze: "BRONZE",
  master: "MASTER",
};

function formatCnpj(v) {
  if (!v) return "—";
  const d = String(v).replace(/\D/g, "").padStart(14, "0");
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return "—";
  }
}

function getPaymentStatus(c) {
  if (c.diagnostic_blocked_date) return { label: "Bloqueado", variant: "destructive" };
  if (c.diagnostic_payment_status === "grace_period") return { label: "Tolerância", variant: "secondary" };
  if (c.diagnostic_due_date) {
    const overdue = new Date(c.diagnostic_due_date) < new Date();
    if (overdue) return { label: "Vencido", variant: "secondary" };
  }
  return { label: "Ativo", variant: "default" };
}

export default function DiagnosticCompaniesPanel({ adminEmail, onNewGestor }) {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [loginModal, setLoginModal] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke("portalAuth", {
        operation: "getDiagnosticCompanies",
        admin_email: adminEmail,
      });
      setCompanies(res.data.companies || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [adminEmail]);

  useEffect(() => { load(); }, [load]);

  const term = search.trim().toLowerCase();
  const filtered = companies.filter((c) =>
    !term ||
    (c.razao_social || "").toLowerCase().includes(term) ||
    (c.cnpj || "").includes(term) ||
    (c.admin_name || "").toLowerCase().includes(term) ||
    (c.admin_email || "").toLowerCase().includes(term)
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Wrench className="w-5 h-5 text-cyan-600" /> Empresas da Oficina Premium
          <Badge variant="secondary" className="text-xs">{companies.length}</Badge>
        </h2>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar por empresa, CNPJ ou gestor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 w-full sm:w-72"
            />
          </div>
          <Button variant="outline" className="gap-2 border-cyan-300 text-cyan-700 hover:bg-cyan-50" onClick={onNewGestor}>
            <Plus className="w-4 h-4" /> Novo Gestor
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-8 text-center">
          <Building2 className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            {companies.length === 0
              ? "Nenhuma empresa cadastrada ainda. Clique em \"Novo Gestor\" para cadastrar a primeira empresa da Oficina Premium."
              : "Nenhuma empresa encontrada para a busca."}
          </p>
        </CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium">Empresa</th>
                    <th className="text-left p-3 font-medium">CNPJ</th>
                    <th className="text-left p-3 font-medium">Cidade/UF</th>
                    <th className="text-left p-3 font-medium">Gestor</th>
                    <th className="text-left p-3 font-medium">Plano</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">Vencimento</th>
                    <th className="text-left p-3 font-medium">Acesso</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => {
                    const status = getPaymentStatus(c);
                    return (
                      <tr key={c.id} className="border-t hover:bg-muted/20">
                        <td className="p-3 min-w-[180px]">
                          <p className="font-medium">{c.razao_social || "—"}</p>
                          {c.nome_fantasia && <p className="text-xs text-muted-foreground">{c.nome_fantasia}</p>}
                        </td>
                        <td className="p-3 text-xs text-muted-foreground">{formatCnpj(c.cnpj)}</td>
                        <td className="p-3 text-xs text-muted-foreground">
                          {[c.city, c.uf].filter(Boolean).join(" - ") || "—"}
                        </td>
                        <td className="p-3 min-w-[160px]">
                          <p className="font-medium text-sm">{c.admin_name || c.responsible_name || "—"}</p>
                          <p className="text-xs text-muted-foreground">{c.admin_email || c.user_email || "—"}</p>
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" className="text-xs">{PLAN_LABELS[c.diagnostic_plan] || (c.diagnostic_plan || "—").toUpperCase()}</Badge>
                        </td>
                        <td className="p-3">
                          <Badge variant={status.variant} className="text-xs">{status.label}</Badge>
                        </td>
                        <td className="p-3 text-xs text-muted-foreground">{formatDate(c.diagnostic_due_date)}</td>
                        <td className="p-3">
                          <div className="flex flex-col gap-1">
                            {c.has_portal_user && c.can_access_diagnostic && c.portal_active
                              ? <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">Liberado</Badge>
                              : <>
                                  <Badge variant="destructive" className="text-xs">
                                    {c.has_portal_user ? "Sem acesso à oficina" : "Sem login"}
                                  </Badge>
                                  <Button size="sm" variant="outline" className="gap-1 text-xs h-7 border-cyan-300 text-cyan-700 hover:bg-cyan-50" onClick={() => setLoginModal(c)}>
                                    <KeyRound className="w-3 h-3" /> {c.has_portal_user ? "Liberar Oficina" : "Criar Acesso"}
                                  </Button>
                                </>
                            }
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {loginModal && (
        <CreateGestorLoginModal
          adminEmail={adminEmail}
          company={loginModal}
          onClose={() => setLoginModal(null)}
          onSaved={() => { setLoginModal(null); load(); }}
        />
      )}
    </div>
  );
}
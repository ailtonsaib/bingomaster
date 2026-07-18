import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calendar, Check, Unlock, UserPlus, DollarSign, AlertCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { getPortalUser } from "@/lib/portalSession";

const formatDate = (d) => d ? new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";
const formatCurrency = (v) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function DiagnosticSubscriptionManager({ users, onRefresh }) {
  const { toast } = useToast();
  const adminUser = getPortalUser();
  const adminEmail = adminUser?.email || users?.[0]?.email || "";
  const [loading, setLoading] = useState(true);
  const [subscriptions, setSubscriptions] = useState([]);
  const [registerModal, setRegisterModal] = useState(null);

  const loadSubscriptions = async () => {
    try {
      const res = await base44.functions.invoke("portalAuth", {
        operation: "getUsers",
        admin_email: adminEmail,
      });
      const allUsers = res.data.users || [];
      const diagnosticUsers = allUsers.filter((u) => u.can_access_diagnostic && !u.is_admin);
      setSubscriptions(diagnosticUsers);
    } catch {
      // Try filtering from passed users prop
      if (users) {
        setSubscriptions(users.filter((u) => u.can_access_diagnostic && !u.is_admin));
      }
    }
    setLoading(false);
  };

  useEffect(() => { loadSubscriptions(); }, [users]);

  const handleRegister = async (userEmail, acquisitionPrice, monthlyPrice, registrationDate) => {
    try {
      await base44.functions.invoke("manageDiagnostic", {
        operation: "adminRegisterCompany",
        email: adminEmail,
        user_email: userEmail,
        acquisition_price: acquisitionPrice,
        monthly_price: monthlyPrice,
        registration_date: registrationDate,
      });
      toast({ title: "Sucesso", description: "Empresa registrada e assinatura ativada." });
      setRegisterModal(null);
      onRefresh?.();
      loadSubscriptions();
    } catch (err) {
      toast({ title: "Erro", description: "Não foi possível registrar a empresa.", variant: "destructive" });
    }
  };

  const handleMarkPayment = async (userEmail) => {
    if (!confirm("Confirmar recebimento da mensalidade? O vencimento será estendido por 30 dias.")) return;
    try {
      await base44.functions.invoke("manageDiagnostic", {
        operation: "adminMarkPayment",
        email: adminEmail,
        user_email: userEmail,
      });
      toast({ title: "Pagamento registrado", description: "Mensalidade estendida por 30 dias." });
      loadSubscriptions();
    } catch {
      toast({ title: "Erro", description: "Não foi possível registrar o pagamento.", variant: "destructive" });
    }
  };

  const handleUnblock = async (userEmail) => {
    const days = prompt("Quantos dias de acesso conceder após o desbloqueio?", "30");
    if (!days) return;
    try {
      await base44.functions.invoke("manageDiagnostic", {
        operation: "adminUnblock",
        email: adminEmail,
        user_email: userEmail,
        extend_days: Number(days),
      });
      toast({ title: "Sistema desbloqueado", description: `Acesso liberado por ${days} dias.` });
      loadSubscriptions();
    } catch {
      toast({ title: "Erro", description: "Não foi possível desbloquear.", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <DollarSign className="w-5 h-5 text-amber-600" />
        <h3 className="text-lg font-bold">Assinaturas — Plano Bronze</h3>
      </div>

      {subscriptions.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          Nenhum usuário com acesso ao Sistema Automotivo. Crie um usuário e marque "Sistema Automotivo" com plano Bronze.
        </p>
      ) : (
        <div className="space-y-3">
          {subscriptions.map((u) => {
            const isBronze = u.diagnostic_plan === "bronze";
            const status = u.diagnostic_payment_status || "active";
            const hasRegistration = !!u.diagnostic_registration_date;

            return (
              <Card key={u.id}>
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* User info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-sm">{u.name}</p>
                        <Badge variant={isBronze ? "default" : "secondary"} className="text-xs">
                          {(u.diagnostic_plan || "free").toUpperCase()}
                        </Badge>
                        {isBronze && hasRegistration && (
                          <Badge
                            className={`text-xs border-0 ${
                              status === "active" ? "bg-green-100 text-green-700" :
                              status === "grace_period" ? "bg-amber-100 text-amber-700" :
                              "bg-red-100 text-red-700"
                            }`}
                          >
                            {status === "active" ? "Em dia" : status === "grace_period" ? "Em tolerância" : "Bloqueado"}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </div>

                    {/* Subscription details */}
                    {isBronze && hasRegistration ? (
                      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                        <div className="text-xs space-y-0.5">
                          <p className="flex items-center gap-1 text-muted-foreground">
                            <Calendar className="w-3 h-3" /> Cadastro: {formatDate(u.diagnostic_registration_date)}
                          </p>
                          <p className="flex items-center gap-1 text-muted-foreground">
                            <DollarSign className="w-3 h-3" /> Aquisição: {formatCurrency(u.diagnostic_acquisition_price)}
                          </p>
                          <p className="flex items-center gap-1 text-muted-foreground">
                            <Calendar className="w-3 h-3" /> Vencimento: {formatDate(u.diagnostic_due_date)}
                          </p>
                          <p className="flex items-center gap-1 text-muted-foreground">
                            <DollarSign className="w-3 h-3" /> Mensalidade: {formatCurrency(u.diagnostic_monthly_price)}
                          </p>
                          {u.diagnostic_last_payment_date && (
                            <p className="flex items-center gap-1 text-green-600">
                              <Check className="w-3 h-3" /> Último pagamento: {formatDate(u.diagnostic_last_payment_date)}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <Button size="sm" variant="outline" className="gap-1 text-green-600 border-green-300 hover:bg-green-50" onClick={() => handleMarkPayment(u.email)}>
                            <Check className="w-3.5 h-3.5" /> Registrar Pagamento
                          </Button>
                          {status === "blocked" && (
                            <Button size="sm" variant="outline" className="gap-1 text-blue-600 border-blue-300 hover:bg-blue-50" onClick={() => handleUnblock(u.email)}>
                              <Unlock className="w-3.5 h-3.5" /> Desbloquear
                            </Button>
                          )}
                        </div>
                      </div>
                    ) : isBronze && !hasRegistration ? (
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-500" />
                        <Button size="sm" variant="outline" className="gap-1" onClick={() => setRegisterModal(u)}>
                          <UserPlus className="w-3.5 h-3.5" /> Registrar Empresa
                        </Button>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Plano não requer assinatura</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Register modal */}
      {registerModal && (
        <RegisterCompanyModal
          user={registerModal}
          onClose={() => setRegisterModal(null)}
          onConfirm={handleRegister}
        />
      )}
    </div>
  );
}

function RegisterCompanyModal({ user, onClose, onConfirm }) {
  const today = new Date().toISOString().split("T")[0];
  const [acquisitionPrice, setAcquisitionPrice] = useState(99.9);
  const [monthlyPrice, setMonthlyPrice] = useState(19.9);
  const [registrationDate, setRegistrationDate] = useState(today);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-background rounded-2xl w-full max-w-md shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-1">Registrar Empresa</h2>
        <p className="text-sm text-muted-foreground mb-4">{user.name} — {user.email}</p>

        <div className="space-y-3">
          <div>
            <Label>Valor de Aquisição (R$)</Label>
            <Input type="number" step="0.01" value={acquisitionPrice} onChange={(e) => setAcquisitionPrice(e.target.value)} className="mt-1" />
            <p className="text-xs text-muted-foreground mt-1">Valor único pago no cadastro</p>
          </div>
          <div>
            <Label>Mensalidade (R$ / mês)</Label>
            <Input type="number" step="0.01" value={monthlyPrice} onChange={(e) => setMonthlyPrice(e.target.value)} className="mt-1" />
            <p className="text-xs text-muted-foreground mt-1">Valor recorrente mensal</p>
          </div>
          <div>
            <Label>Data de Cadastro</Label>
            <Input type="date" value={registrationDate} onChange={(e) => setRegistrationDate(e.target.value)} className="mt-1" />
            <p className="text-xs text-muted-foreground mt-1">O vencimento será 30 dias após esta data</p>
          </div>
        </div>

        <div className="flex gap-2 pt-4">
          <Button onClick={() => onConfirm(user.email, Number(acquisitionPrice), Number(monthlyPrice), registrationDate)}>
            Registrar e Ativar
          </Button>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
        </div>
      </div>
    </div>
  );
}
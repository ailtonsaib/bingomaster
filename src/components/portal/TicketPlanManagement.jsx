import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LifeBuoy, Check, Loader2, RotateCcw, Building2, Lock, Unlock } from "lucide-react";

export default function TicketPlanManagement() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [editLimitId, setEditLimitId] = useState(null);
  const [tempLimit, setTempLimit] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke("ticketSystem", { operation: "getCompaniesWithPlan" });
      setCompanies(res.data.companies || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggleFullAccess = async (company) => {
    setSavingId(company.id);
    try {
      const newAccess = !company.ticket_full_access;
      await base44.functions.invoke("ticketSystem", {
        operation: "updateCompanyPlan",
        company_id: company.id,
        ticket_full_access: newAccess,
        ticket_plan: newAccess ? "full" : "free",
      });
      await load();
    } catch (e) { alert("Erro ao atualizar plano"); }
    setSavingId(null);
  };

  const saveLimit = async (company) => {
    setSavingId(company.id);
    try {
      const limit = parseInt(tempLimit) || 10;
      await base44.functions.invoke("ticketSystem", {
        operation: "updateCompanyPlan",
        company_id: company.id,
        ticket_limit: limit,
      });
      setEditLimitId(null);
      await load();
    } catch (e) { alert("Erro ao salvar limite"); }
    setSavingId(null);
  };

  const fmtCnpj = (cnpj) => {
    const v = (cnpj || "").replace(/\D/g, "");
    return v.replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2");
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 mb-2">
        <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
          <LifeBuoy className="w-5 h-5 text-red-600" />
        </div>
        <div>
          <h3 className="font-bold text-base">Planos da Central de Chamados</h3>
          <p className="text-sm text-muted-foreground">Gerencie o acesso de cada empresa. O plano Free permite até 10 chamados. Libere acesso completo para chamados ilimitados.</p>
        </div>
      </div>

      {companies.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Nenhuma empresa cadastrada ainda.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {companies.map((c) => {
            const isFull = c.ticket_full_access || c.ticket_plan === "full";
            const limit = c.ticket_limit ?? 10;
            const pct = isFull ? 0 : Math.min(100, (c.ticket_count / limit) * 100);
            return (
              <Card key={c.id} className={isFull ? "ring-1 ring-emerald-300" : ""}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4 flex-wrap">
                    <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                      <Building2 className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                      <div>
                        <p className="font-medium text-sm">{c.razao_social}</p>
                        <p className="text-xs text-muted-foreground">{fmtCnpj(c.cnpj)}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge className={isFull ? "bg-emerald-100 text-emerald-700 border-0" : "bg-slate-100 text-slate-700 border-0"}>
                        {isFull ? "Completo" : "Free"}
                      </Badge>
                      {!c.is_active && <Badge variant="destructive" className="text-xs">Inativa</Badge>}
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Chamados</p>
                        <p className="text-sm font-bold">{c.ticket_count}{!isFull && <span className="text-muted-foreground font-normal">/{limit}</span>}</p>
                      </div>
                      {!isFull && (
                        <div className="w-24">
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div className={`h-full rounded-full ${pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )}
                    </div>

                    {!isFull && (
                      <div className="flex items-center gap-2">
                        {editLimitId === c.id ? (
                          <>
                            <Input
                              type="number"
                              value={tempLimit}
                              onChange={(e) => setTempLimit(e.target.value)}
                              className="w-20 h-8 text-sm"
                              placeholder="10"
                            />
                            <Button size="sm" className="h-8 gap-1" onClick={() => saveLimit(c)} disabled={savingId === c.id}>
                              {savingId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} OK
                            </Button>
                            <Button size="sm" variant="outline" className="h-8" onClick={() => setEditLimitId(null)}>Cancelar</Button>
                          </>
                        ) : (
                          <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setEditLimitId(c.id); setTempLimit(String(limit)); }}>
                            Editar limite
                          </Button>
                        )}
                      </div>
                    )}

                    <Button
                      size="sm"
                      variant={isFull ? "outline" : "default"}
                      className={`h-8 gap-1.5 ${isFull ? "" : "bg-emerald-600 hover:bg-emerald-700"}`}
                      onClick={() => toggleFullAccess(c)}
                      disabled={savingId === c.id}
                    >
                      {savingId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : isFull ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                      {isFull ? "Bloquear" : "Liberar Completo"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div className="flex justify-end">
        <Button variant="ghost" size="sm" className="gap-1" onClick={load}><RotateCcw className="w-4 h-4" /> Atualizar</Button>
      </div>
    </div>
  );
}
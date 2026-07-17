import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Globe, Clock, ShieldCheck, ShieldAlert, RefreshCw } from "lucide-react";

const FAILURE_LABELS = {
  user_not_found: "Usuário não encontrado",
  invalid_password: "Senha incorreta",
  inactive: "Usuário inativo",
  missing_credentials: "Credenciais incompletas",
};

export default function LoginHistoryPanel({ adminEmail }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [successFilter, setSuccessFilter] = useState("all");

  const load = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke("portalAuth", {
        operation: "getLoginHistory",
        admin_email: adminEmail,
        filter_email: search.trim() || undefined,
        filter_success: successFilter === "success" ? true : successFilter === "failed" ? false : undefined,
      });
      setHistory(res.data.history || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, successFilter]);

  const stats = {
    total: history.length,
    success: history.filter(h => h.success).length,
    failed: history.filter(h => !h.success).length,
    uniqueEmails: new Set(history.map(h => h.email)).size,
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Clock className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Tentativas</p>
              <p className="text-base font-bold">{stats.total}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Sucessos</p>
              <p className="text-base font-bold text-emerald-600">{stats.success}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Falhas</p>
              <p className="text-base font-bold text-red-600">{stats.failed}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
              <Globe className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Usuários únicos</p>
              <p className="text-base font-bold">{stats.uniqueEmails}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Buscar por email ou nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <select
          value={successFilter}
          onChange={(e) => setSuccessFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
        >
          <option value="all">Todas</option>
          <option value="success">Apenas sucessos</option>
          <option value="failed">Apenas falhas</option>
        </select>
        <Button variant="outline" size="icon" onClick={load} title="Atualizar">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Data/Hora</th>
                  <th className="text-left p-3 font-medium">Email</th>
                  <th className="text-left p-3 font-medium">Nome</th>
                  <th className="text-left p-3 font-medium">Tipo</th>
                  <th className="text-left p-3 font-medium">Resultado</th>
                  <th className="text-left p-3 font-medium">IP</th>
                  <th className="text-left p-3 font-medium">Dispositivo</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-muted-foreground">Carregando...</td>
                  </tr>
                )}
                {!loading && history.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-muted-foreground">Nenhum registro encontrado.</td>
                  </tr>
                )}
                {!loading && history.map((h) => (
                  <tr key={h.id} className="border-t hover:bg-muted/20">
                    <td className="p-3 whitespace-nowrap text-xs text-muted-foreground">
                      {h.attempt_time ? new Date(h.attempt_time).toLocaleString("pt-BR", {
                        day: "2-digit", month: "2-digit", year: "numeric",
                        hour: "2-digit", minute: "2-digit", second: "2-digit"
                      }) : "—"}
                    </td>
                    <td className="p-3 font-medium">{h.email}</td>
                    <td className="p-3 text-muted-foreground">{h.user_name || "—"}</td>
                    <td className="p-3">
                      <Badge variant="outline" className="text-xs capitalize">{h.user_type || "—"}</Badge>
                    </td>
                    <td className="p-3">
                      {h.success ? (
                        <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">Sucesso</Badge>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <Badge variant="destructive" className="text-xs w-fit">Falha</Badge>
                          <span className="text-xs text-muted-foreground">
                            {FAILURE_LABELS[h.failure_reason] || h.failure_reason}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">{h.ip_address || "—"}</td>
                    <td className="p-3 text-xs text-muted-foreground max-w-[220px] truncate" title={h.user_agent || ""}>
                      {h.user_agent ? h.user_agent.replace(/^Mozilla\/[^\s]+\s*/, "").slice(0, 60) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
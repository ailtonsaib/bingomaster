import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Download, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

export default function AgapeMigrationModal({ userEmail, onClose, onSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const handleMigrate = async () => {
    if (!email || !password) {
      setError("Preencha email e senha do app Ágape");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await base44.functions.invoke("migrateAgapeData", { email, password });
      setResult(res.data);
      if (res.data?.success && onSuccess) {
        setTimeout(() => onSuccess(), 2000);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Erro ao migrar dados");
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Download className="w-5 h-5" />
            Migrar dados do Ágape
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {result?.success ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-4 rounded-lg bg-emerald-50 border border-emerald-200">
                <CheckCircle className="w-6 h-6 text-emerald-600 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-emerald-800">Migração concluída!</p>
                  <p className="text-sm text-emerald-700">{result.message}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-lg bg-muted">
                  <p className="text-xs text-muted-foreground">Importadas</p>
                  <p className="text-lg font-bold text-emerald-600">{result.imported}</p>
                </div>
                <div className="p-2 rounded-lg bg-muted">
                  <p className="text-xs text-muted-foreground">Duplicatas</p>
                  <p className="text-lg font-bold text-amber-600">{result.duplicates_skipped}</p>
                </div>
                <div className="p-2 rounded-lg bg-muted">
                  <p className="text-xs text-muted-foreground">Total Ágape</p>
                  <p className="text-lg font-bold">{result.total_agape_transactions}</p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Informe suas credenciais do app <strong>Ágape de Casais</strong> para importar
                todas as transações financeiras para o Controle de Finanças.
              </p>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="agape-email">Email do Ágape</Label>
                  <Input
                    id="agape-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="agape-password">Senha do Ágape</Label>
                  <Input
                    id="agape-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    onKeyDown={(e) => e.key === "Enter" && handleMigrate()}
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={onClose} disabled={loading}>
                  Cancelar
                </Button>
                <Button className="flex-1 gap-2" onClick={handleMigrate} disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Migrando...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Migrar Dados
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
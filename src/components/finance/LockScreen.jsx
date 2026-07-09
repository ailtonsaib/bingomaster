import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Lock, Clock, LogOut, ArrowLeft, TrendingUp, TrendingDown } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function LockScreen({ user, onRefresh, onLogout, transactions }) {
  const [requesting, setRequesting] = useState(false);
  const navigate = useNavigate();

  const handleRequest = async () => {
    setRequesting(true);
    try {
      await base44.functions.invoke('portalAuth', {
        operation: 'requestRelease',
        email: user.email,
      });
      await onRefresh();
    } catch (e) {
      alert("Erro ao solicitar liberação");
    }
    setRequesting(false);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full">
        {/* Back button */}
        <Button variant="ghost" size="sm" className="mb-4 gap-1" onClick={() => navigate('/')}>
          <ArrowLeft className="w-4 h-4" /> Voltar ao Portal
        </Button>

        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
            {user.finance_release_requested ? (
              <Clock className="w-8 h-8 text-amber-600" />
            ) : (
              <Lock className="w-8 h-8 text-amber-600" />
            )}
          </div>
          <h1 className="text-2xl font-bold font-heading mb-2">
            {user.finance_release_requested ? "Aguardando Aprovação" : "Limite Atingido"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {user.finance_release_requested
              ? "Sua solicitação de liberação foi enviada. Aguarde a aprovação do administrador para acesso completo."
              : `Você utilizou todas as ${user.finance_transaction_limit} movimentações disponíveis no plano gratuito.`}
          </p>
        </div>

        <Card className="mb-4">
          <CardContent className="p-6">
            {!user.finance_release_requested ? (
              <Button className="w-full gap-2" onClick={handleRequest} disabled={requesting}>
                <Lock className="w-4 h-4" />
                {requesting ? "Solicitando..." : "Solicitar Liberação ao Administrador"}
              </Button>
            ) : (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-center">
                <Clock className="w-6 h-6 text-amber-600 mx-auto mb-2" />
                <p className="text-sm text-amber-700">Solicitação enviada. O administrador foi notificado.</p>
              </div>
            )}
            <Button variant="outline" className="w-full mt-3 gap-2" onClick={onLogout}>
              <LogOut className="w-4 h-4" /> Sair
            </Button>
          </CardContent>
        </Card>

        {transactions && transactions.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground mb-3">Suas movimentações:</p>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {transactions.map((tx) => (
                  <div key={tx.id} className="flex justify-between text-sm py-1">
                    <span className="truncate">{tx.description}</span>
                    <span className={tx.type === 'income' ? 'text-emerald-600 font-medium' : 'text-red-600 font-medium'}>
                      {tx.type === 'income' ? '+' : '-'} R$ {parseFloat(tx.amount).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
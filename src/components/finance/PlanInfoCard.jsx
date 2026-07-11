import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lock, CheckCircle2, Sparkles } from "lucide-react";

export default function PlanInfoCard({ user }) {
  const isFullAccess = user.finance_full_access;
  const used = user.finance_transactions_used || 0;
  const limit = user.finance_transaction_limit || 10;
  const remaining = Math.max(0, limit - used);
  const progress = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const price = user.finance_plan_price ?? 49.90;

  return (
    <Card className={`border-2 ${isFullAccess ? 'border-emerald-200' : 'border-amber-200'}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            {isFullAccess ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            ) : (
              <Lock className="w-5 h-5 text-amber-600" />
            )}
            <div>
              <h3 className="font-bold text-sm">
                {isFullAccess ? "Plano Completo" : "Plano de Teste"}
              </h3>
              <p className="text-xs text-muted-foreground">
                {isFullAccess
                  ? "Acesso ilimitado a todas as funcionalidades"
                  : `Acesso limitado a ${limit} movimentações`}
              </p>
            </div>
          </div>
          <Badge variant={isFullAccess ? "default" : "secondary"}>
            {isFullAccess ? "Ativo" : `${used}/${limit}`}
          </Badge>
        </div>

        {isFullAccess ? (
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-100">
            <p className="text-sm text-emerald-700 font-medium">
              ✓ Seu plano está ativo com acesso completo a todas as funcionalidades do aplicativo.
            </p>
          </div>
        ) : (
          <>
            {/* Progress bar */}
            <div className="mb-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>{used} usadas</span>
                <span>{remaining} restantes</span>
              </div>
              <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-amber-500 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Upgrade section */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/20">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <p className="text-sm font-semibold text-foreground">Faça upgrade para o Plano Completo</p>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Tenha movimentações ilimitadas e acesso a todos os recursos sem restrições.
              </p>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Valor do plano</p>
                  <p className="text-2xl font-bold text-primary">
                    R$ {price.toFixed(2).replace('.', ',')}
                  </p>
                  <p className="text-xs text-muted-foreground">Pagamento único</p>
                </div>
                <p className="text-xs text-muted-foreground text-right max-w-[140px]">
                  Entre em contato com o administrador para adquirir
                </p>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
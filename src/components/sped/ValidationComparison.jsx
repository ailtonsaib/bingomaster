import React, { useMemo, useState, memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ArrowRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  GitCompare,
} from 'lucide-react';

function erroKey(e) {
  return `${e.linha || 0}|${e.registro || ''}|${e.mensagem || ''}`;
}

function ValidationComparison({ resultadoOriginal, resultadoCorrigido }) {
  const analise = useMemo(() => {
    if (!resultadoOriginal || !resultadoCorrigido) return null;

    const errosOrig = resultadoOriginal.erros || [];
    const errosCorr = resultadoCorrigido.erros || [];
    const avisosOrig = resultadoOriginal.avisos || [];
    const avisosCorr = resultadoCorrigido.avisos || [];

    const setOrig = new Set(errosOrig.map(erroKey));
    const setCorr = new Set(errosCorr.map(erroKey));

    const corrigidos = errosOrig.filter((e) => !setCorr.has(erroKey(e)));
    const persistentes = errosOrig.filter((e) => setCorr.has(erroKey(e)));
    const novos = errosCorr.filter((e) => !setOrig.has(erroKey(e)));

    return {
      corrigidos,
      persistentes,
      novos,
      totalOriginal: errosOrig.length,
      totalCorrigido: errosCorr.length,
      avisosOriginal: avisosOrig.length,
      avisosCorrigido: avisosCorr.length,
      reducao: errosOrig.length - errosCorr.length,
    };
  }, [resultadoOriginal, resultadoCorrigido]);

  const [limiteCorrigidos, setLimiteCorrigidos] = useState(30);
  const [limiteNovos, setLimiteNovos] = useState(30);
  const [limitePersistentes, setLimitePersistentes] = useState(30);

  if (!analise) return null;

  const pctReducao = analise.totalOriginal > 0
    ? Math.round((analise.reducao / analise.totalOriginal) * 100)
    : 0;

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <GitCompare className="w-5 h-5 text-primary" />
          Comparativo: Antes × Depois da Correção
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Resumo comparativo */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-center">
            <p className="text-xs text-muted-foreground font-semibold mb-1">Original</p>
            <p className="text-2xl font-bold text-red-600">{analise.totalOriginal}</p>
            <p className="text-xs text-muted-foreground">erros</p>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-center">
            <p className="text-xs text-muted-foreground font-semibold mb-1">Corrigido</p>
            <p className="text-2xl font-bold text-emerald-600">{analise.totalCorrigido}</p>
            <p className="text-xs text-muted-foreground">erros</p>
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-center">
            <p className="text-xs text-muted-foreground font-semibold mb-1">Resolvidos</p>
            <p className="text-2xl font-bold text-blue-600">{analise.corrigidos.length}</p>
            <p className="text-xs text-muted-foreground">pela correção</p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-center">
            <p className="text-xs text-muted-foreground font-semibold mb-1">Redução</p>
            <p className="text-2xl font-bold text-amber-600">{pctReducao}%</p>
            <p className="text-xs text-muted-foreground">dos erros</p>
          </div>
        </div>

        {analise.reducao !== 0 && (
          <div className={`flex items-center gap-2 rounded-lg p-3 ${analise.reducao > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
            {analise.reducao > 0 ? <TrendingDown className="w-5 h-5" /> : <TrendingUp className="w-5 h-5" />}
            <p className="text-sm font-medium">
              {analise.reducao > 0
                ? `${analise.reducao} erro(s) corrigido(s) automaticamente — de ${analise.totalOriginal} para ${analise.totalCorrigido}.`
                : `A correção introduziu ${Math.abs(analise.reducao)} novo(s) erro(s) — de ${analise.totalOriginal} para ${analise.totalCorrigido}.`}
            </p>
          </div>
        )}

        {/* Erros resolvidos pela correção */}
        {analise.corrigidos.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-emerald-700 flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4" />
              Erros resolvidos pela correção automática ({analise.corrigidos.length})
            </h4>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {analise.corrigidos.slice(0, limiteCorrigidos).map((e, idx) => (
                <div key={idx} className="flex items-start gap-2 rounded border border-emerald-200 bg-emerald-50 p-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-emerald-800">{e.mensagem}</p>
                    <p className="text-xs text-emerald-600">Linha {e.linha} {e.registro && `| ${e.registro}`}</p>
                  </div>
                </div>
              ))}
            </div>
            {analise.corrigidos.length > limiteCorrigidos && (
              <div className="mt-2 text-center">
                <Button variant="outline" size="sm" onClick={() => setLimiteCorrigidos(l => l + 30)}>
                  Ver mais ({analise.corrigidos.length - limiteCorrigidos} restantes)
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Novos erros introduzidos */}
        {analise.novos.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-red-700 flex items-center gap-2 mb-2">
              <XCircle className="w-4 h-4" />
              Novos erros após correção ({analise.novos.length})
            </h4>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {analise.novos.slice(0, limiteNovos).map((e, idx) => (
                <div key={idx} className="flex items-start gap-2 rounded border border-red-200 bg-red-50 p-2">
                  <XCircle className="w-3.5 h-3.5 text-red-600 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-red-800">{e.mensagem}</p>
                    <p className="text-xs text-red-600">Linha {e.linha} {e.registro && `| ${e.registro}`}</p>
                  </div>
                </div>
              ))}
            </div>
            {analise.novos.length > limiteNovos && (
              <div className="mt-2 text-center">
                <Button variant="outline" size="sm" onClick={() => setLimiteNovos(l => l + 30)}>
                  Ver mais ({analise.novos.length - limiteNovos} restantes)
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Erros persistentes */}
        {analise.persistentes.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-amber-700 flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4" />
              Erros não resolvidos — requerem correção manual ({analise.persistentes.length})
            </h4>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {analise.persistentes.slice(0, limitePersistentes).map((e, idx) => (
                <div key={idx} className="flex items-start gap-2 rounded border border-amber-200 bg-amber-50 p-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-amber-800">{e.mensagem}</p>
                    <p className="text-xs text-amber-600">Linha {e.linha} {e.registro && `| ${e.registro}`}</p>
                  </div>
                </div>
              ))}
            </div>
            {analise.persistentes.length > limitePersistentes && (
              <div className="mt-2 text-center">
                <Button variant="outline" size="sm" onClick={() => setLimitePersistentes(l => l + 30)}>
                  Ver mais ({analise.persistentes.length - limitePersistentes} restantes)
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Transição de status */}
        <div className="flex items-center justify-center gap-3 pt-2 border-t">
          <div className="text-center">
            <Badge variant={resultadoOriginal.isValid ? 'default' : 'destructive'} className="text-sm">
              {resultadoOriginal.isValid ? 'VÁLIDO' : 'INVÁLIDO'}
            </Badge>
            <p className="text-xs text-muted-foreground mt-1">Original</p>
          </div>
          <ArrowRight className="w-5 h-5 text-muted-foreground" />
          <div className="text-center">
            <Badge variant={resultadoCorrigido.isValid ? 'default' : 'destructive'} className="text-sm">
              {resultadoCorrigido.isValid ? 'VÁLIDO' : 'INVÁLIDO'}
            </Badge>
            <p className="text-xs text-muted-foreground mt-1">Corrigido</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default memo(ValidationComparison);
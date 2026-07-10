import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle,
  XCircle,
  Download,
  ChevronDown,
  ChevronRight,
  Layers,
  FileWarning,
  CheckCircle2,
} from 'lucide-react';

export default function DivergenceReport({ resultado }) {
  const [expandedBlocks, setExpandedBlocks] = useState({});

  const divergences = useMemo(() => {
    const todas = [
      ...(resultado.erros || []).map((e) => ({ ...e, severidade: 'erro' })),
      ...(resultado.avisos || []).map((a) => ({ ...a, severidade: 'aviso' })),
    ];

    const byBlock = {};
    for (const item of todas) {
      const reg = item.registro || '??';
      const bloco = reg === '??' ? '?' : reg.charAt(0);
      if (!byBlock[bloco]) {
        byBlock[bloco] = { bloco, erros: 0, avisos: 0, registros: {} };
      }
      if (item.severidade === 'erro') byBlock[bloco].erros++;
      else byBlock[bloco].avisos++;

      if (!byBlock[bloco].registros[reg]) {
        byBlock[bloco].registros[reg] = { erros: 0, avisos: 0, itens: [] };
      }
      byBlock[bloco].registros[reg].itens.push(item);
      if (item.severidade === 'erro') byBlock[bloco].registros[reg].erros++;
      else byBlock[bloco].registros[reg].avisos++;
    }

    return Object.values(byBlock).sort((a, b) => a.bloco.localeCompare(b.bloco));
  }, [resultado]);

  if (!resultado) return null;

  const totalErros = resultado.erros?.length || 0;
  const totalAvisos = resultado.avisos?.length || 0;
  const blocosComErro = divergences.filter((d) => d.erros > 0).length;
  const blocosComAviso = divergences.filter((d) => d.avisos > 0 && d.erros === 0).length;
  const blocosOk = (resultado.resumo?.blocosEncontrados?.length || 0) - divergences.length;

  const toggleBlock = (bloco) => {
    setExpandedBlocks((prev) => ({ ...prev, [bloco]: !prev[bloco] }));
  };

  const baixarRelatorioDivergencias = () => {
    let txt = `RELATÓRIO RESUMIDO DE DIVERGÊNCIAS\n`;
    txt += `${'='.repeat(60)}\n`;
    txt += `Arquivo: ${resultado.nomeArquivo}\n`;
    txt += `Tipo: ${resultado.tipoDetectado}\n`;
    txt += `Status: ${resultado.isValid ? 'VÁLIDO' : 'INVÁLIDO'}\n`;
    txt += `Total de linhas: ${resultado.estatisticas?.totalLinhas || 0}\n\n`;

    txt += `RESUMO GERAL:\n`;
    txt += `  - Total de erros críticos: ${totalErros}\n`;
    txt += `  - Total de avisos: ${totalAvisos}\n`;
    txt += `  - Blocos com erros: ${blocosComErro}\n`;
    txt += `  - Blocos com apenas avisos: ${blocosComAviso}\n`;
    txt += `  - Blocos sem divergências: ${blocosOk > 0 ? blocosOk : 0}\n\n`;

    txt += `${'='.repeat(60)}\n`;
    txt += `DIVERGÊNCIAS POR BLOCO\n`;
    txt += `${'='.repeat(60)}\n\n`;

    for (const d of divergences) {
      const statusBloco = d.erros > 0 ? 'FORA DO PADRÃO' : 'COM AVISOS';
      txt += `BLOCO ${d.bloco} — ${statusBloco}\n`;
      txt += `  Erros: ${d.erros} | Avisos: ${d.avisos}\n`;
      for (const [reg, info] of Object.entries(d.registros).sort(([a], [b]) => a.localeCompare(b))) {
        txt += `\n  Registro ${reg} (${info.erros} erro(s), ${info.avisos} aviso(s)):\n`;
        for (const item of info.itens) {
          txt += `    [${item.severidade === 'erro' ? 'ERRO' : 'AVISO'}] Linha ${item.linha}: ${item.mensagem}\n`;
        }
      }
      txt += `\n${'-'.repeat(60)}\n`;
    }

    const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `divergencias_${resultado.nomeArquivo || 'sped'}_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FileWarning className="w-5 h-5 text-primary" />
            Relatório de Divergências
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={baixarRelatorioDivergencias}
          >
            <Download className="h-4 w-4" /> Baixar Relatório
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Resumo geral */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-center">
            <p className="text-2xl font-bold text-red-600">{totalErros}</p>
            <p className="text-xs text-muted-foreground">Erros Críticos</p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-center">
            <p className="text-2xl font-bold text-amber-600">{totalAvisos}</p>
            <p className="text-xs text-muted-foreground">Avisos</p>
          </div>
          <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-center">
            <p className="text-2xl font-bold text-orange-600">{blocosComErro}</p>
            <p className="text-xs text-muted-foreground">Blocos com Erro</p>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-center">
            <p className="text-2xl font-bold text-emerald-600">{blocosOk > 0 ? blocosOk : 0}</p>
            <p className="text-xs text-muted-foreground">Blocos OK</p>
          </div>
        </div>

        {/* Detalhamento por bloco */}
        {divergences.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <p className="text-sm font-medium text-emerald-700">
              Nenhuma divergência encontrada. Todos os blocos estão em conformidade.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {divergences.map((d) => {
              const isExpanded = expandedBlocks[d.bloco];
              const foraPadrao = d.erros > 0;
              return (
                <div
                  key={d.bloco}
                  className={`rounded-lg border ${
                    foraPadrao
                      ? 'border-red-300 bg-red-50/50'
                      : 'border-amber-300 bg-amber-50/50'
                  }`}
                >
                  {/* Cabeçalho do bloco */}
                  <button
                    onClick={() => toggleBlock(d.bloco)}
                    className="w-full flex items-center justify-between p-3 hover:bg-black/5 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      )}
                      <Layers className="w-4 h-4 text-muted-foreground" />
                      <span className="font-semibold text-sm">Bloco {d.bloco}</span>
                      <Badge
                        variant={foraPadrao ? 'destructive' : 'secondary'}
                        className="text-xs"
                      >
                        {foraPadrao ? 'Fora do padrão' : 'Com avisos'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      {d.erros > 0 && (
                        <Badge variant="destructive" className="text-xs gap-1">
                          <XCircle className="w-3 h-3" /> {d.erros}
                        </Badge>
                      )}
                      {d.avisos > 0 && (
                        <Badge variant="outline" className="text-xs gap-1 border-amber-400 text-amber-700">
                          <AlertTriangle className="w-3 h-3" /> {d.avisos}
                        </Badge>
                      )}
                    </div>
                  </button>

                  {/* Detalhes expandidos */}
                  {isExpanded && (
                    <div className="border-t border-border/50 p-3 space-y-2">
                      {Object.entries(d.registros)
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([reg, info]) => (
                          <div key={reg} className="rounded-md border border-border/60 bg-card p-2">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs font-mono font-semibold">
                                Registro {reg}
                              </span>
                              <div className="flex gap-1.5">
                                {info.erros > 0 && (
                                  <Badge variant="destructive" className="text-[10px] py-0">
                                    {info.erros} erro(s)
                                  </Badge>
                                )}
                                {info.avisos > 0 && (
                                  <Badge variant="outline" className="text-[10px] py-0 border-amber-400 text-amber-700">
                                    {info.avisos} aviso(s)
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <div className="space-y-1">
                              {info.itens.map((item, idx) => (
                                <div
                                  key={idx}
                                  className={`flex items-start gap-2 text-xs rounded p-1.5 ${
                                    item.severidade === 'erro'
                                      ? 'bg-red-50 text-red-800'
                                      : 'bg-amber-50 text-amber-800'
                                  }`}
                                >
                                  {item.severidade === 'erro' ? (
                                    <XCircle className="w-3 h-3 mt-0.5 shrink-0 text-red-600" />
                                  ) : (
                                    <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0 text-amber-600" />
                                  )}
                                  <span className="flex-1">{item.mensagem}</span>
                                  {item.linha > 0 && (
                                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                      L{item.linha}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
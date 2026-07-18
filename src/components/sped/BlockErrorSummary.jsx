import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { XCircle, AlertTriangle, ChevronRight, Layers } from 'lucide-react';

const BLOCO_INFO = {
  '0': { nome: 'Abertura e Identificação', orientacao: 'Verificar registros 0000, 0001, 0150, 0200 — campos obrigatórios, CNPJ/CPF válidos, datas no formato DDMMAAAA.' },
  'I': { nome: 'Lançamentos Contábeis', orientacao: 'Verificar I050 (plano de contas), I155 (consistência de saldos: VL_SLD_FIN = VL_SLD_INI + débitos - créditos), I200/I250 (partidas dobradas: soma débitos = soma créditos).' },
  'J': { nome: 'Demonstrações Contábeis', orientacao: 'Verificar J005 (COD_DEM válido), J100/J150 (campos obrigatórios, IND_DC correto, valores não negativos), J900/J930 (datas, CPF, COD_ASSIN).' },
  'K': { nome: 'Conglomerados Econômicos', orientacao: 'Verificar registros K030, K100, K200 — campos obrigatórios e datas no formato DDMMAAAA.' },
  '9': { nome: 'Controle e Encerramento', orientacao: 'Verificar registro 9900 (totalizadores por tipo de registro) e 9999 (contador total de linhas). O bloco 9 deve ser o último do arquivo.' },
};

const BLOCO_ORDEM = ['0', 'I', 'J', 'K', '9'];

export default function BlockErrorSummary({ resultado }) {
  const resumo = useMemo(() => {
    if (!resultado?.erros?.length) return [];
    
    const porBloco = {};
    for (const erro of resultado.erros) {
      const bloco = (erro.registro || '?').charAt(0);
      if (!porBloco[bloco]) {
        porBloco[bloco] = { bloco, total: 0, registros: {}, exemplo: null };
      }
      porBloco[bloco].total++;
      porBloco[bloco].registros[erro.registro] = (porBloco[bloco].registros[erro.registro] || 0) + 1;
      if (!porBloco[bloco].exemplo) {
        porBloco[bloco].exemplo = erro;
      }
    }

    return Object.values(porBloco).sort((a, b) => {
      const ia = BLOCO_ORDEM.indexOf(a.bloco);
      const ib = BLOCO_ORDEM.indexOf(b.bloco);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
  }, [resultado]);

  if (resumo.length === 0) return null;

  return (
    <Card className="border-red-200 bg-red-50/30">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2 text-red-700">
          <Layers className="w-5 h-5" />
          Resumo de Erros por Bloco
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {resumo.map((item) => {
          const info = BLOCO_INFO[item.bloco] || { nome: 'Outros', orientacao: 'Verificar os registros deste bloco.' };
          return (
            <div key={item.bloco} className="rounded-lg border border-red-200 bg-white p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-100 text-red-700 font-bold text-sm">
                    {item.bloco}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-gray-800">Bloco {item.bloco} — {info.nome}</p>
                    <p className="text-xs text-gray-500">
                      {item.total} erro{item.total > 1 ? 's' : ''} • Registros afetados: {Object.entries(item.registros).map(([r, c]) => `${r} (${c})`).join(', ')}
                    </p>
                  </div>
                </div>
                <Badge variant="destructive" className="text-xs">{item.total} erro{item.total > 1 ? 's' : ''}</Badge>
              </div>

              <div className="flex items-start gap-2 mb-2 rounded-md bg-red-50 p-2">
                <XCircle className="w-3.5 h-3.5 text-red-600 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-red-800 font-medium">{item.exemplo.mensagem}</p>
                  <p className="text-[10px] text-red-500 mt-0.5">
                    {item.exemplo.linha > 0 ? `Linha ${item.exemplo.linha}` : 'Estrutura'} {item.exemplo.registro && `| Registro ${item.exemplo.registro}`}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 p-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-amber-800 font-semibold flex items-center gap-1">
                    <ChevronRight className="w-3 h-3" /> O que ajustar:
                  </p>
                  <p className="text-xs text-amber-700 mt-0.5">{info.orientacao}</p>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
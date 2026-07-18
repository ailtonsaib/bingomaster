import React, { useState, memo } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, FileWarning } from 'lucide-react';
import DivergenceReport from '@/components/sped/DivergenceReport';

/**
 * Wrapper colapsável para DivergenceReport.
 * Só monta o componente pesado quando expandido.
 */
function CollapsibleDivergenceReport({ resultado }) {
  const [aberto, setAberto] = useState(false);
  const totalErros = resultado?.erros?.length || 0;
  const totalAvisos = resultado?.avisos?.length || 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
        <div className="flex items-center gap-2">
          <FileWarning className="w-5 h-5 text-primary shrink-0" />
          <div>
            <p className="text-sm font-semibold">Relatório de Divergências</p>
            <p className="text-xs text-muted-foreground">Resumo agrupado por bloco e registro. Clique para expandir.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {totalErros > 0 && (
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-red-100 text-red-700 shrink-0">
              {totalErros} erro(s)
            </span>
          )}
          {totalAvisos > 0 && (
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-700 shrink-0">
              {totalAvisos} aviso(s)
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setAberto(!aberto)}
          >
            {aberto ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            {aberto ? 'Recolher' : 'Expandir'}
          </Button>
        </div>
      </div>
      {aberto && <DivergenceReport resultado={resultado} />}
    </div>
  );
}

export default memo(CollapsibleDivergenceReport);
import React, { useState, memo } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, ScrollText } from 'lucide-react';
import ValidationLogPanel from '@/components/sped/ValidationLogPanel';

/**
 * Wrapper colapsável para ValidationLogPanel.
 * O componente pesado só é montado quando o usuário expande — evita travamento
 * em arquivos grandes (600KB+) onde o split de linhas e regex podem bloquear a UI.
 */
function CollapsibleLogPanel({ resultado, conteudo }) {
  const [aberto, setAberto] = useState(false);
  const count = resultado?.erros?.length || 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <ScrollText className="w-5 h-5 text-primary shrink-0" />
          <div>
            <p className="text-sm font-semibold">Log de Validação — Comparação com PVA Oficial</p>
            <p className="text-xs text-muted-foreground">Detalhamento linha a linha, campo a campo. Clique para expandir.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {count > 0 && (
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-red-100 text-red-700 shrink-0">
              {count}
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
      {aberto && <ValidationLogPanel resultado={resultado} conteudo={conteudo} />}
    </div>
  );
}

export default memo(CollapsibleLogPanel);
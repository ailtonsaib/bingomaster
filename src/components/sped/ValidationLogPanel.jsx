import React, { useState, useMemo, memo, useDeferredValue } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  ScrollText,
  XCircle,
  AlertTriangle,
  Search,
  ChevronDown,
  ChevronRight,
  FileSearch,
  Clipboard,
} from 'lucide-react';

function extrairCampo(mensagem) {
  const matchCampo = mensagem.match(/campo\s+([^\s,)]+|"[^"]*")/i);
  if (matchCampo) return matchCampo[1].replace(/"/g, '');

  const matchTag = mensagem.match(/<([A-Za-z_]+)>/);
  if (matchTag) return matchTag[1];

  const matchField = mensagem.match(/\b([A-Z][A-Z0-9_]{2,})\b\s*(inv[aá]lido|obrigat[aó]rio|n[aã]o)/i);
  if (matchField) return matchField[1];

  const matchIdx = mensagem.match(/[Cc]ampo\s*(\d+)/);
  if (matchIdx) return `Campo #${matchIdx[1]}`;

  return '—';
}

function extrairRegraPVA(mensagem, registro) {
  const matchDeve = mensagem.match(/deve ser\s+(.+?)(?:\.|$)/i);
  if (matchDeve) return matchDeve[1].trim();

  const matchEsperado = mensagem.match(/esperado:?\s+(.+?)(?:\.|$)/i);
  if (matchEsperado) return matchEsperado[1].trim();

  const matchInvalido = mensagem.match(/inv[aá]lido:?\s*"([^"]+)"/i);
  if (matchInvalido) {
    const matchDeve2 = mensagem.match(/deve\s+(?:ser|estar)[^"]*:\s*(.+?)(?:\.|$)/i);
    if (matchDeve2) return matchDeve2[1].trim();
    return `Valor inválido: "${matchInvalido[1]}"`;
  }

  const matchObrigatorio = mensagem.match(/obrigat[aó]rio[^.]*\./i);
  if (matchObrigatorio) return matchObrigatorio[0].trim();

  return `Verificar regra do registro ${registro}`;
}

function extrairValorEncontrado(mensagem, linhaConteudo) {
  const matchAspas = mensagem.match(/"([^"]+)"/);
  if (matchAspas) return matchAspas[1];

  if (linhaConteudo) {
    const campos = linhaConteudo.split('|').filter(c => c !== '');
    return campos.slice(1, 6).join(' | ') || '—';
  }

  return '—';
}

const LogEntry = memo(function LogEntry({ entry, linhaConteudo, idx }) {
  const [expandido, setExpandido] = useState(false);
  const isErro = entry.severidade === 'erro';
  const campo = useMemo(() => extrairCampo(entry.mensagem), [entry.mensagem]);
  const regraPVA = useMemo(() => extrairRegraPVA(entry.mensagem, entry.registro), [entry.mensagem, entry.registro]);
  const valorEncontrado = useMemo(() => extrairValorEncontrado(entry.mensagem, linhaConteudo), [entry.mensagem, linhaConteudo]);

  return (
    <div className={`rounded-lg border ${isErro ? 'border-red-200 bg-red-50/50' : 'border-amber-200 bg-amber-50/50'}`}>
      <button
        className="w-full flex items-start gap-3 p-3 text-left hover:bg-black/[0.02] transition-colors"
        onClick={() => setExpandido(!expandido)}
      >
        {expandido ? (
          <ChevronDown className={`w-4 h-4 mt-0.5 shrink-0 ${isErro ? 'text-red-500' : 'text-amber-500'}`} />
        ) : (
          <ChevronRight className={`w-4 h-4 mt-0.5 shrink-0 ${isErro ? 'text-red-500' : 'text-amber-500'}`} />
        )}
        {isErro ? (
          <XCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
        ) : (
          <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
              #{idx + 1}
            </span>
            <Badge variant="outline" className={`text-xs font-mono ${isErro ? 'border-red-400 text-red-700' : 'border-amber-400 text-amber-700'}`}>
              Linha {entry.linha || '—'}
            </Badge>
            {entry.registro && (
              <Badge variant="secondary" className="text-xs font-mono">
                {entry.registro}
              </Badge>
            )}
            {campo !== '—' && (
              <Badge variant="outline" className="text-xs font-mono text-primary border-primary/40">
                {campo}
              </Badge>
            )}
            <span className={`text-xs font-medium ${isErro ? 'text-red-700' : 'text-amber-700'}`}>
              {entry.mensagem.length > 80 ? entry.mensagem.substring(0, 80) + '...' : entry.mensagem}
            </span>
          </div>
        </div>
      </button>

      {expandido && (
        <div className="border-t border-slate-200 px-4 pb-3 pt-2 space-y-2 bg-white/60">
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Mensagem Completa</p>
              <p className={`text-sm ${isErro ? 'text-red-800' : 'text-amber-800'}`}>{entry.mensagem}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Regra PVA (Exigência Oficial)</p>
              <p className="text-sm text-slate-700 font-medium">{regraPVA}</p>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Valor Encontrado</p>
              <p className="text-sm font-mono text-slate-800 bg-slate-100 rounded px-2 py-1 break-all">{valorEncontrado}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Campo Identificado</p>
              <p className="text-sm font-mono text-primary font-bold">{campo}</p>
            </div>
          </div>
          {linhaConteudo && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <FileSearch className="w-3.5 h-3.5" />
                Conteúdo da Linha {entry.linha}
              </p>
              <div className="mt-1 rounded bg-slate-900 text-slate-100 px-3 py-2 font-mono text-xs overflow-x-auto whitespace-pre-wrap break-all">
                {linhaConteudo}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default function ValidationLogPanel({ resultado, conteudo }) {
  const [busca, setBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [limite, setLimite] = useState(30);
  const buscaDeferida = useDeferredValue(busca);

  const linhasArquivo = useMemo(() => {
    if (!conteudo) return [];
    return conteudo.split(/\r?\n/);
  }, [conteudo]);

  const todasEntradas = useMemo(() => {
    if (!resultado) return [];
    const erros = (resultado.erros || []).map((e, i) => ({ ...e, severidade: 'erro', _origIdx: i }));
    const avisos = (resultado.avisos || []).map((a, i) => ({ ...a, severidade: 'aviso', _origIdx: erros.length + i }));
    return [...erros, ...avisos].sort((a, b) => (a.linha || 0) - (b.linha || 0));
  }, [resultado]);

  const entradasFiltradas = useMemo(() => {
    let lista = todasEntradas;

    if (filtroTipo === 'erros') lista = lista.filter(e => e.severidade === 'erro');
    else if (filtroTipo === 'avisos') lista = lista.filter(e => e.severidade === 'aviso');
    else if (filtroTipo === 'estrutura') lista = lista.filter(e => e.linha === 0 || !e.linha);

    if (buscaDeferida.trim()) {
      const termo = buscaDeferida.toLowerCase().trim();
      lista = lista.filter(e =>
        e.mensagem.toLowerCase().includes(termo) ||
        (e.registro || '').toLowerCase().includes(termo) ||
        String(e.linha || '').includes(termo)
      );
    }

    return lista;
  }, [todasEntradas, buscaDeferida, filtroTipo]);

  // Reset paginação quando filtros mudam
  React.useEffect(() => {
    setLimite(30);
  }, [buscaDeferida, filtroTipo]);

  if (!resultado) return null;

  const totalErros = resultado.erros?.length || 0;
  const totalAvisos = resultado.avisos?.length || 0;
  const visiveis = entradasFiltradas.slice(0, limite);

  return (
    <Card className="border-slate-300">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ScrollText className="w-5 h-5 text-primary" />
          Log de Validação — Comparação com PVA Oficial
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Detalhamento linha a linha, campo a campo, do que o PVA (Programa Validador de Arquivos) exige versus o que foi encontrado no arquivo.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por mensagem, registro ou linha..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-8 text-sm"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            <Button
              size="sm"
              variant={filtroTipo === 'todos' ? 'default' : 'outline'}
              onClick={() => setFiltroTipo('todos')}
            >
              Todos ({todasEntradas.length})
            </Button>
            <Button
              size="sm"
              variant={filtroTipo === 'erros' ? 'destructive' : 'outline'}
              onClick={() => setFiltroTipo('erros')}
            >
              <XCircle className="w-3.5 h-3.5 mr-1" />
              Erros ({totalErros})
            </Button>
            <Button
              size="sm"
              variant={filtroTipo === 'avisos' ? 'secondary' : 'outline'}
              onClick={() => setFiltroTipo('avisos')}
            >
              <AlertTriangle className="w-3.5 h-3.5 mr-1" />
              Avisos ({totalAvisos})
            </Button>
            <Button
              size="sm"
              variant={filtroTipo === 'estrutura' ? 'default' : 'outline'}
              onClick={() => setFiltroTipo('estrutura')}
            >
              Estrutura
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-slate-50 rounded-lg px-3 py-2">
          <Clipboard className="w-3.5 h-3.5" />
          <span>
            Clique em cada item para expandir e ver: <strong>campo</strong>, <strong>regra PVA</strong>, <strong>valor encontrado</strong> e o <strong>conteúdo da linha</strong>.
          </span>
        </div>

        {entradasFiltradas.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <ScrollText className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Nenhuma ocorrência encontrada com os filtros atuais.</p>
          </div>
        ) : (
          <>
            <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-1">
              {visiveis.map((entry, idx) => {
                const linhaConteudo = entry.linha > 0 && linhasArquivo[entry.linha - 1]
                  ? linhasArquivo[entry.linha - 1]
                  : null;
                return (
                  <LogEntry
                    key={entry._origIdx}
                    entry={entry}
                    linhaConteudo={linhaConteudo}
                    idx={idx}
                  />
                );
              })}
            </div>
            {entradasFiltradas.length > limite && (
              <div className="text-center">
                <Button variant="outline" size="sm" onClick={() => setLimite(l => l + 30)}>
                  Ver mais ({entradasFiltradas.length - limite} restantes)
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
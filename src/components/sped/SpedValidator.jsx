import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  ShieldCheck,
  ShieldAlert,
  FileCheck2,
  Download,
  Pencil,
  RefreshCw,
} from 'lucide-react';

export default function SpedValidator({ planKey, limitReached, clienteId, clienteNome }) {
  const [arquivo, setArquivo] = useState(null);
  const [conteudo, setConteudo] = useState('');
  const [conteudoEditado, setConteudoEditado] = useState('');
  const [modoEdicao, setModoEdicao] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState('');
  const [foiCorrigido, setFoiCorrigido] = useState(false);
  const inputRef = useRef(null);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErro('');
    setResultado(null);

    if (!file.name.toLowerCase().endsWith('.txt') && !file.name.toLowerCase().endsWith('.xml')) {
      setErro('Por favor, selecione um arquivo .txt (SPED/DIME-SC) ou .xml (REINF).');
      return;
    }

    setArquivo(file);
    const leitor = new FileReader();
    leitor.onload = (ev) => {
      const texto = ev.target.result;
      setConteudo(texto);
      setConteudoEditado(texto);
    };
    leitor.onerror = () => setErro('Erro ao ler o arquivo.');
    leitor.readAsText(file, 'utf-8');
  };

  const salvarValidacao = async (dados, nome, conteudoFinal, corrigido) => {
    try {
      let userEmail = '';
      try {
        const user = await base44.auth.me();
        userEmail = user?.email || '';
      } catch (_) {}

      await base44.entities.SpedValidation.create({
        arquivo_nome: nome,
        tipo_detectado: dados.tipoDetectado || 'DESCONHECIDO',
        is_valid: !!dados.isValid,
        total_erros: dados.erros?.length || 0,
        total_avisos: dados.avisos?.length || 0,
        total_linhas: dados.estatisticas?.totalLinhas || 0,
        foi_corrigido: corrigido,
        conteudo_final: conteudoFinal,
        cliente_id: clienteId || '',
        cliente_nome: clienteNome || '',
        validated_by: userEmail,
        validation_date: new Date().toISOString()
      });
    } catch (e) {
      console.error('Erro ao salvar validação:', e);
    }
  };

  const validarConteudo = async (conteudoParaValidar, nome) => {
    setLoading(true);
    setErro('');

    try {
      const response = await base44.functions.invoke('validarSped', {
        conteudo: conteudoParaValidar,
        nomeArquivo: nome,
      });
      const dados = response.data;

      if (dados.success) {
        setResultado(dados);
        setConteudo(conteudoParaValidar);
        await salvarValidacao(dados, nome, conteudoParaValidar, foiCorrigido);
      } else {
        setErro(dados.error || 'Erro na validação.');
      }
    } catch (err) {
      setErro('Erro ao validar: ' + (err.message || 'erro desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  const handleValidar = () => {
    if (!conteudo) {
      setErro('Selecione um arquivo primeiro.');
      return;
    }
    validarConteudo(conteudo, arquivo?.name || 'arquivo_sped.txt');
  };

  const handleRevalidar = () => {
    if (!conteudoEditado.trim()) {
      setErro('O conteúdo não pode estar vazio.');
      return;
    }
    setFoiCorrigido(true);
    validarConteudo(conteudoEditado, arquivo?.name || 'arquivo_sped.txt');
  };

  const handleBaixarCorrigido = () => {
    const blob = new Blob([conteudoEditado], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (arquivo?.name || 'arquivo_sped').replace(/\.(txt|xml)$/, '') + '_corrigido.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLimpar = () => {
    setArquivo(null);
    setConteudo('');
    setConteudoEditado('');
    setResultado(null);
    setErro('');
    setModoEdicao(false);
    setFoiCorrigido(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const baixarRelatorio = () => {
    if (!resultado) return;
    let txt = `RELATÓRIO DE VALIDAÇÃO SPED\n`;
    txt += `Arquivo: ${resultado.nomeArquivo}\n`;
    txt += `Tipo detectado: ${resultado.tipoDetectado}\n`;
    txt += `Status: ${resultado.isValid ? 'VÁLIDO ✓' : 'INVÁLIDO ✗'}\n`;
    txt += `Total de linhas: ${resultado.estatisticas.totalLinhas}\n`;
    txt += `Erros: ${resultado.erros.length}\n`;
    txt += `Avisos: ${resultado.avisos.length}\n`;
    txt += `\n${'='.repeat(60)}\n\n`;

    if (resultado.erros.length > 0) {
      txt += `ERROS (${resultado.erros.length}):\n\n`;
      resultado.erros.forEach((e, i) => {
        txt += `  ${i + 1}. [Linha ${e.linha} | ${e.registro}] ${e.mensagem}\n`;
      });
      txt += `\n${'='.repeat(60)}\n\n`;
    }

    if (resultado.avisos.length > 0) {
      txt += `AVISOS (${resultado.avisos.length}):\n\n`;
      resultado.avisos.forEach((a, i) => {
        txt += `  ${i + 1}. [Linha ${a.linha} | ${a.registro}] ${a.mensagem}\n`;
      });
    }

    const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio_validacao_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Upload + Ações */}
      <Card className={arquivo ? 'border-emerald-300' : 'border-2 border-dashed border-primary/40 bg-primary/5'}>
        <CardContent className="p-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
              arquivo ? 'bg-emerald-100' : 'bg-primary/10'
            }`}>
              {arquivo ? (
                <FileCheck2 className="w-8 h-8 text-emerald-600" />
              ) : (
                <UploadCloud className="w-8 h-8 text-primary" />
              )}
            </div>

            <div>
              <p className="text-sm font-semibold text-foreground">
                {arquivo ? arquivo.name : 'Selecione um arquivo SPED, DIME-SC (.txt) ou REINF (.xml) para validar'}
              </p>
              {arquivo && (
                <p className="text-xs text-muted-foreground mt-1">
                  {(arquivo.size / 1024).toFixed(1)} KB
                </p>
              )}
            </div>

            <Input
              ref={inputRef}
              type="file"
              accept=".txt,.xml"
              onChange={handleFileSelect}
              className="hidden"
              id="input-validar-sped"
            />

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => inputRef.current?.click()}
                disabled={loading}
              >
                <UploadCloud className="h-4 w-4" />
                {arquivo ? 'Trocar Arquivo' : 'Selecionar Arquivo'}
              </Button>
              {arquivo && (
                <Button
                  variant="default"
                  size="sm"
                  className="gap-2"
                  onClick={handleValidar}
                  disabled={loading || !conteudo}
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Validando...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="h-4 w-4" /> Validar
                    </>
                  )}
                </Button>
              )}
              {resultado && !resultado.isValid && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 border-amber-400 text-amber-700 hover:bg-amber-50"
                  onClick={() => setModoEdicao(!modoEdicao)}
                  disabled={loading}
                >
                  <Pencil className="h-4 w-4" />
                  {modoEdicao ? 'Fechar Editor' : 'Corrigir Arquivo'}
                </Button>
              )}
              {resultado && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="gap-2"
                  onClick={baixarRelatorio}
                >
                  <Download className="h-4 w-4" /> Relatório
                </Button>
              )}
              {(arquivo || resultado) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLimpar}
                  disabled={loading}
                >
                  Limpar
                </Button>
              )}
            </div>

            {erro && (
              <p className="text-sm text-red-600 font-medium mt-1">{erro}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Resultado */}
      {resultado && (
        <>
          {/* Status Geral */}
          <Card className={resultado.isValid ? 'border-emerald-400 bg-emerald-50' : 'border-red-400 bg-red-50'}>
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                {resultado.isValid ? (
                  <CheckCircle2 className="w-12 h-12 text-emerald-600 shrink-0" />
                ) : (
                  <XCircle className="w-12 h-12 text-red-600 shrink-0" />
                )}
                <div>
                  <h3 className={`text-xl font-bold ${resultado.isValid ? 'text-emerald-700' : 'text-red-700'}`}>
                    {resultado.isValid ? 'Arquivo Válido!' : 'Arquivo com Erros'}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {resultado.isValid
                      ? 'Nenhum erro crítico encontrado. O arquivo está conforme a estrutura SPED.'
                      : `${resultado.erros.length} erro(s) crítico(s) encontrado(s). Corrija antes de enviar à SEFAZ.`}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Estatísticas */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <FileText className="w-8 h-8 text-primary shrink-0" />
                <div>
                  <p className="text-2xl font-bold">{resultado.estatisticas.totalLinhas}</p>
                  <p className="text-xs text-muted-foreground">Total de Linhas</p>
                </div>
              </CardContent>
            </Card>
            <Card className={resultado.erros.length > 0 ? 'border-red-300' : ''}>
              <CardContent className="p-4 flex items-center gap-3">
                <ShieldAlert className="w-8 h-8 text-red-500 shrink-0" />
                <div>
                  <p className="text-2xl font-bold text-red-600">{resultado.erros.length}</p>
                  <p className="text-xs text-muted-foreground">Erros Críticos</p>
                </div>
              </CardContent>
            </Card>
            <Card className={resultado.avisos.length > 0 ? 'border-amber-300' : ''}>
              <CardContent className="p-4 flex items-center gap-3">
                <AlertTriangle className="w-8 h-8 text-amber-500 shrink-0" />
                <div>
                  <p className="text-2xl font-bold text-amber-600">{resultado.avisos.length}</p>
                  <p className="text-xs text-muted-foreground">Avisos</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <FileCheck2 className="w-8 h-8 text-emerald-500 shrink-0" />
                <div>
                  <p className="text-lg font-bold">{resultado.resumo.registrosUnicos}</p>
                  <p className="text-xs text-muted-foreground">Tipos de Registro</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tipo detectado + Blocos */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Informações do Arquivo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-muted-foreground">Tipo SPED detectado:</span>
                <Badge variant="default">{resultado.tipoDetectado}</Badge>
              </div>
              <div className="flex items-start gap-2 flex-wrap">
                <span className="text-sm font-semibold text-muted-foreground mt-1">Blocos encontrados:</span>
                {resultado.resumo.blocosEncontrados.map((b) => (
                  <Badge key={b} variant="outline" className="text-xs">
                    Bloco {b}
                  </Badge>
                ))}
              </div>
              <div>
                <span className="text-sm font-semibold text-muted-foreground">Registros por tipo:</span>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {Object.entries(resultado.estatisticas.registros)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([reg, count]) => (
                      <Badge key={reg} variant="secondary" className="text-xs font-mono">
                        {reg}: {count}
                      </Badge>
                    ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Lista de Erros */}
          {resultado.erros.length > 0 && (
            <Card className="border-red-200">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 text-red-700">
                  <XCircle className="w-5 h-5" />
                  Erros Críticos ({resultado.erros.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {resultado.erros.map((e, idx) => (
                    <div key={idx} className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3">
                      <XCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-red-800">{e.mensagem}</p>
                        <p className="text-xs text-red-600 mt-1">
                          Linha {e.linha} {e.registro && `| Registro ${e.registro}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Lista de Avisos */}
          {resultado.avisos.length > 0 && (
            <Card className="border-amber-200">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 text-amber-700">
                  <AlertTriangle className="w-5 h-5" />
                  Avisos ({resultado.avisos.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {resultado.avisos.map((a, idx) => (
                    <div key={idx} className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                      <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-amber-800">{a.mensagem}</p>
                        <p className="text-xs text-amber-600 mt-1">
                          {a.linha > 0 ? `Linha ${a.linha}` : 'Estrutura'} {a.registro && `| Registro ${a.registro}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Editor / Correção */}
          {modoEdicao && (
            <Card className="border-primary/40">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Pencil className="w-5 h-5 text-primary" />
                  Corrigir e Revalidar Arquivo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Edite o conteúdo abaixo para corrigir os erros encontrados. Use as informações da lista de erros acima para localizar as linhas problemáticas. Após editar, clique em "Revalidar" para verificar novamente.
                </p>
                <Textarea
                  value={conteudoEditado}
                  onChange={(e) => setConteudoEditado(e.target.value)}
                  className="font-mono text-xs min-h-[400px] resize-y"
                  spellCheck={false}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    className="gap-2"
                    onClick={handleRevalidar}
                    disabled={loading}
                  >
                    {loading ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Revalidando...</>
                    ) : (
                      <><RefreshCw className="h-4 w-4" /> Revalidar</>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={handleBaixarCorrigido}
                    disabled={loading}
                  >
                    <Download className="h-4 w-4" /> Baixar Corrigido
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setConteudoEditado(conteudo); }}
                    disabled={loading}
                  >
                    Restaurar Original
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
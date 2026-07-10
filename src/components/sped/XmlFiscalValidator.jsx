import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
  Truck,
  FileSpreadsheet,
} from 'lucide-react';

export default function XmlFiscalValidator({ planKey }) {
  const [arquivo, setArquivo] = useState(null);
  const [conteudo, setConteudo] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState('');
  const inputRef = useRef(null);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErro('');
    setResultado(null);

    if (!file.name.toLowerCase().endsWith('.xml')) {
      setErro('Por favor, selecione um arquivo .xml (NF-e ou CT-e).');
      return;
    }

    setArquivo(file);
    const leitor = new FileReader();
    leitor.onload = (ev) => {
      const texto = ev.target.result;
      setConteudo(texto);
    };
    leitor.onerror = () => setErro('Erro ao ler o arquivo.');
    leitor.readAsText(file, 'utf-8');
  };

  const handleValidar = async () => {
    if (!conteudo) { setErro('Selecione um arquivo primeiro.'); return; }
    setLoading(true);
    setErro('');
    try {
      const response = await base44.functions.invoke('validarXmlFiscal', {
        conteudo,
        nomeArquivo: arquivo?.name || 'documento.xml',
      });
      const dados = response.data;
      if (dados.success) {
        setResultado(dados);
      } else {
        setErro(dados.error || 'Erro na validação.');
      }
    } catch (err) {
      setErro('Erro ao validar: ' + (err.message || 'erro desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  const salvarValidacao = async (dados) => {
    try {
      let userEmail = '';
      try { const user = await base44.auth.me(); userEmail = user?.email || ''; } catch (_) {}
      await base44.entities.SpedValidation.create({
        arquivo_nome: arquivo?.name || 'documento.xml',
        tipo_detectado: dados.tipoDetectado || 'DESCONHECIDO',
        is_valid: !!dados.isValid,
        total_erros: dados.erros?.length || 0,
        total_avisos: dados.avisos?.length || 0,
        total_linhas: dados.estatisticas?.totalDocumentos || 0,
        foi_corrigido: false,
        conteudo_final: conteudo,
        validated_by: userEmail,
        validation_date: new Date().toISOString()
      });
    } catch (e) { console.error('Erro ao salvar validação:', e); }
  };

  const baixarRelatorio = () => {
    if (!resultado) return;
    let txt = `RELATÓRIO DE VALIDAÇÃO DE DOCUMENTO FISCAL ELETRÔNICO\n`;
    txt += `Arquivo: ${resultado.nomeArquivo}\n`;
    txt += `Tipo detectado: ${resultado.tipoDetectado === 'NFE' ? 'NF-e (Nota Fiscal Eletrônica)' : 'CT-e (Conhecimento de Transporte Eletrônico)'}\n`;
    txt += `Total de documentos: ${resultado.resumo.totalDocumentos}\n`;
    txt += `Status: ${resultado.isValid ? 'VÁLIDO ✓' : 'INVÁLIDO ✗'}\n`;
    txt += `Erros: ${resultado.erros.length}\n`;
    txt += `Avisos: ${resultado.avisos.length}\n`;
    txt += `\n${'='.repeat(60)}\n\n`;
    if (resultado.erros.length > 0) {
      txt += `ERROS (${resultado.erros.length}):\n\n`;
      resultado.erros.forEach((e, i) => { txt += `  ${i + 1}. [${e.registro}] ${e.mensagem}\n`; });
      txt += `\n${'='.repeat(60)}\n\n`;
    }
    if (resultado.avisos.length > 0) {
      txt += `AVISOS (${resultado.avisos.length}):\n\n`;
      resultado.avisos.forEach((a, i) => { txt += `  ${i + 1}. [${a.registro}] ${a.mensagem}\n`; });
    }
    const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio_validacao_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLimpar = () => {
    setArquivo(null);
    setConteudo('');
    setResultado(null);
    setErro('');
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="space-y-6">
      {/* Info */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p className="font-semibold text-foreground mb-1">Validador de NF-e e CT-e</p>
              <p>Faça upload de um arquivo XML de <strong>Nota Fiscal Eletrônica (NF-e/NFC-e)</strong> ou <strong>Conhecimento de Transporte Eletrônico (CT-e)</strong> para validar a estrutura, campos obrigatórios, regras de negócio e conformidade com o leiaute vigente da SEFAZ.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upload */}
      <Card className={arquivo ? 'border-emerald-300' : 'border-2 border-dashed border-primary/40 bg-primary/5'}>
        <CardContent className="p-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${arquivo ? 'bg-emerald-100' : 'bg-primary/10'}`}>
              {arquivo ? <FileCheck2 className="w-8 h-8 text-emerald-600" /> : <UploadCloud className="w-8 h-8 text-primary" />}
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {arquivo ? arquivo.name : 'Selecione um arquivo XML de NF-e ou CT-e para validar'}
              </p>
              {arquivo && <p className="text-xs text-muted-foreground mt-1">{(arquivo.size / 1024).toFixed(1)} KB</p>}
            </div>
            <Input ref={inputRef} type="file" accept=".xml" onChange={handleFileSelect} className="hidden" id="input-validar-xml" />
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-2" onClick={() => inputRef.current?.click()} disabled={loading}>
                <UploadCloud className="h-4 w-4" /> {arquivo ? 'Trocar Arquivo' : 'Selecionar Arquivo'}
              </Button>
              {arquivo && (
                <Button variant="default" size="sm" className="gap-2" onClick={handleValidar} disabled={loading || !conteudo}>
                  {loading ? (<><Loader2 className="h-4 w-4 animate-spin" /> Validando...</>) : (<><ShieldCheck className="h-4 w-4" /> Validar</>)}
                </Button>
              )}
              {resultado && (
                <Button variant="secondary" size="sm" className="gap-2" onClick={baixarRelatorio}>
                  <Download className="h-4 w-4" /> Relatório
                </Button>
              )}
              {(arquivo || resultado) && (
                <Button variant="ghost" size="sm" onClick={handleLimpar} disabled={loading}>Limpar</Button>
              )}
            </div>
            {erro && <p className="text-sm text-red-600 font-medium mt-1">{erro}</p>}
          </div>
        </CardContent>
      </Card>

      {/* Resultado */}
      {resultado && (
        <>
          {/* Status */}
          <Card className={resultado.isValid ? 'border-emerald-400 bg-emerald-50' : 'border-red-400 bg-red-50'}>
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                {resultado.isValid ? <CheckCircle2 className="w-12 h-12 text-emerald-600 shrink-0" /> : <XCircle className="w-12 h-12 text-red-600 shrink-0" />}
                <div>
                  <h3 className={`text-xl font-bold ${resultado.isValid ? 'text-emerald-700' : 'text-red-700'}`}>
                    {resultado.isValid ? 'Documento Válido!' : 'Documento com Erros'}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {resultado.isValid
                      ? `XML conforme o leiaute ${resultado.tipoDetectado === 'NFE' ? 'NF-e' : 'CT-e'} vigente. Nenhum erro crítico encontrado.`
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
                {resultado.tipoDetectado === 'NFE' ? <FileText className="w-8 h-8 text-primary shrink-0" /> : <Truck className="w-8 h-8 text-primary shrink-0" />}
                <div>
                  <p className="text-2xl font-bold">{resultado.resumo.totalDocumentos}</p>
                  <p className="text-xs text-muted-foreground">{resultado.tipoDetectado === 'NFE' ? 'NF-e encontrada(s)' : 'CT-e encontrado(s)'}</p>
                </div>
              </CardContent>
            </Card>
            <Card className={resultado.erros.length > 0 ? 'border-red-300' : ''}>
              <CardContent className="p-4 flex items-center gap-3">
                <ShieldAlert className="w-8 h-8 text-red-500 shrink-0" />
                <div><p className="text-2xl font-bold text-red-600">{resultado.erros.length}</p><p className="text-xs text-muted-foreground">Erros Críticos</p></div>
              </CardContent>
            </Card>
            <Card className={resultado.avisos.length > 0 ? 'border-amber-300' : ''}>
              <CardContent className="p-4 flex items-center gap-3">
                <AlertTriangle className="w-8 h-8 text-amber-500 shrink-0" />
                <div><p className="text-2xl font-bold text-amber-600">{resultado.avisos.length}</p><p className="text-xs text-muted-foreground">Avisos</p></div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <FileSpreadsheet className="w-8 h-8 text-emerald-500 shrink-0" />
                <div><p className="text-lg font-bold">{resultado.tipoDetectado}</p><p className="text-xs text-muted-foreground">Tipo Detectado</p></div>
              </CardContent>
            </Card>
          </div>

          {/* Tipo detectado */}
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileText className="w-5 h-5 text-primary" /> Informações do Documento</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-muted-foreground">Tipo detectado:</span>
                <Badge variant="default">{resultado.tipoDetectado === 'NFE' ? 'NF-e / NFC-e' : 'CT-e'}</Badge>
              </div>
              <div className="flex items-start gap-2 flex-wrap">
                <span className="text-sm font-semibold text-muted-foreground mt-1">Documentos:</span>
                {Object.keys(resultado.estatisticas.documentos).map((d) => (
                  <Badge key={d} variant="outline" className="text-xs">{d}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Erros */}
          {resultado.erros.length > 0 && (
            <Card className="border-red-200">
              <CardHeader><CardTitle className="text-base flex items-center gap-2 text-red-700"><XCircle className="w-5 h-5" /> Erros Críticos ({resultado.erros.length})</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {resultado.erros.map((e, idx) => (
                    <div key={idx} className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3">
                      <XCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-red-800">{e.mensagem}</p>
                        <p className="text-xs text-red-600 mt-1">{e.registro}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Avisos */}
          {resultado.avisos.length > 0 && (
            <Card className="border-amber-200">
              <CardHeader><CardTitle className="text-base flex items-center gap-2 text-amber-700"><AlertTriangle className="w-5 h-5" /> Avisos ({resultado.avisos.length})</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {resultado.avisos.map((a, idx) => (
                    <div key={idx} className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                      <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-amber-800">{a.mensagem}</p>
                        <p className="text-xs text-amber-600 mt-1">{a.registro}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
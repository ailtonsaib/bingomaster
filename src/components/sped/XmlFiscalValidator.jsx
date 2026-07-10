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
  Building2,
  Users,
  Calculator,
  Package,
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

          {/* Dados Extraídos - Emitente, Destinatário, Totais */}
          {resultado.documentos && resultado.documentos.length > 0 && (
            <div className="space-y-4">
              {resultado.documentos.map((doc, docIdx) => (
                <div key={docIdx} className="space-y-4">
                  {/* Chave de acesso */}
                  {doc.chave_acesso && (
                    <Card className="border-primary/30 bg-primary/5">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <FileText className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-muted-foreground mb-1">Chave de Acesso</p>
                            <p className="text-sm font-mono break-all">{doc.chave_acesso.match(/.{1,4}/g)?.join(' ') || doc.chave_acesso}</p>
                            {doc.ide && (
                              <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                                {doc.ide.numero && <span>NF: <strong className="text-foreground">{doc.ide.numero}</strong></span>}
                                {doc.ide.serie && <span>Série: <strong className="text-foreground">{doc.ide.serie}</strong></span>}
                                {doc.ide.modelo && <span>Modelo: <strong className="text-foreground">{doc.ide.modelo === '55' ? 'NF-e' : doc.ide.modelo === '65' ? 'NFC-e' : doc.ide.modelo}</strong></span>}
                                {doc.ide.dhEmi && <span>Emissão: <strong className="text-foreground">{new Date(doc.ide.dhEmi).toLocaleString('pt-BR')}</strong></span>}
                                {doc.ide.tpNF && <Badge variant="outline" className="text-xs">{doc.ide.tpNF}</Badge>}
                                {doc.ide.tpAmb && <Badge variant="outline" className="text-xs">{doc.ide.tpAmb}</Badge>}
                                {doc.ide.finNFe && <Badge variant="outline" className="text-xs">{doc.ide.finNFe}</Badge>}
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Emitente e Destinatário */}
                  <div className="grid gap-4 md:grid-cols-2">
                    {/* Emitente */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2"><Building2 className="w-4 h-4 text-primary" /> Emitente</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0 space-y-1.5 text-sm">
                        {doc.emitente ? (
                          <>
                            <p className="font-semibold text-foreground">{doc.emitente.nome || '—'}</p>
                            <div className="flex gap-2">
                              <Badge variant="outline" className="text-xs">{doc.emitente.tipo_doc || '—'}</Badge>
                              <span className="text-muted-foreground font-mono text-xs">{doc.emitente.documento || '—'}</span>
                            </div>
                            {doc.emitente.ie && <p className="text-xs text-muted-foreground">IE: {doc.emitente.ie}</p>}
                            {doc.emitente.crt && (
                              <p className="text-xs text-muted-foreground">CRT: {doc.emitente.crt === '1' ? 'Simples Nacional' : doc.emitente.crt === '2' ? 'Simples Nacional (sublimite)' : doc.emitente.crt === '3' ? 'Regime Normal' : doc.emitente.crt}</p>
                            )}
                            {doc.emitente.endereco && (
                              <p className="text-xs text-muted-foreground">{doc.emitente.endereco.logradouro}, {doc.emitente.endereco.numero} - {doc.emitente.endereco.bairro}</p>
                            )}
                            {doc.emitente.municipio && (
                              <p className="text-xs text-muted-foreground">{doc.emitente.municipio} - {doc.emitente.uf}</p>
                            )}
                            {doc.emitente.cep && (
                              <p className="text-xs text-muted-foreground">CEP: {doc.emitente.cep}</p>
                            )}
                          </>
                        ) : <p className="text-muted-foreground text-xs">Emitente não encontrado</p>}
                      </CardContent>
                    </Card>

                    {/* Destinatário */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2"><Users className="w-4 h-4 text-primary" /> Destinatário</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0 space-y-1.5 text-sm">
                        {doc.destinatario ? (
                          <>
                            <p className="font-semibold text-foreground">{doc.destinatario.nome || '—'}</p>
                            <div className="flex gap-2">
                              <Badge variant="outline" className="text-xs">{doc.destinatario.tipo_doc || '—'}</Badge>
                              <span className="text-muted-foreground font-mono text-xs">{doc.destinatario.documento || '—'}</span>
                            </div>
                            {doc.destinatario.ie && <p className="text-xs text-muted-foreground">IE: {doc.destinatario.ie}</p>}
                            {doc.destinatario.indIEDest && (
                              <p className="text-xs text-muted-foreground">{doc.destinatario.indIEDest === '1' ? 'Contribuinte ICMS' : doc.destinatario.indIEDest === '2' ? 'Isento' : doc.destinatario.indIEDest === '9' ? 'Não contribuinte' : ''}</p>
                            )}
                            {doc.destinatario.endereco && (
                              <p className="text-xs text-muted-foreground">{doc.destinatario.endereco.logradouro}, {doc.destinatario.endereco.numero} - {doc.destinatario.endereco.bairro}</p>
                            )}
                            {doc.destinatario.municipio && (
                              <p className="text-xs text-muted-foreground">{doc.destinatario.municipio} - {doc.destinatario.uf}</p>
                            )}
                          </>
                        ) : <p className="text-muted-foreground text-xs">Destinatário não encontrado</p>}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Totais */}
                  {doc.totais && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2"><Calculator className="w-4 h-4 text-primary" /> Valores Totais</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
                          <div className="space-y-0.5">
                            <p className="text-xs text-muted-foreground">Valor dos Produtos</p>
                            <p className="font-semibold">R$ {doc.totais.vProd.toFixed(2)}</p>
                          </div>
                          <div className="space-y-0.5">
                            <p className="text-xs text-muted-foreground">Descontos</p>
                            <p className="font-semibold text-red-600">- R$ {doc.totais.vDesc.toFixed(2)}</p>
                          </div>
                          <div className="space-y-0.5">
                            <p className="text-xs text-muted-foreground">Frete</p>
                            <p className="font-semibold">R$ {doc.totais.vFrete.toFixed(2)}</p>
                          </div>
                          <div className="space-y-0.5">
                            <p className="text-xs text-muted-foreground">Seguro</p>
                            <p className="font-semibold">R$ {doc.totais.vSeg.toFixed(2)}</p>
                          </div>
                          <div className="space-y-0.5">
                            <p className="text-xs text-muted-foreground">Outras Despesas</p>
                            <p className="font-semibold">R$ {doc.totais.vOutro.toFixed(2)}</p>
                          </div>
                          <div className="space-y-0.5">
                            <p className="text-xs text-muted-foreground">Base ICMS</p>
                            <p className="font-semibold">R$ {doc.totais.vBC.toFixed(2)}</p>
                          </div>
                          <div className="space-y-0.5">
                            <p className="text-xs text-muted-foreground">Valor ICMS</p>
                            <p className="font-semibold">R$ {doc.totais.vICMS.toFixed(2)}</p>
                          </div>
                          <div className="space-y-0.5">
                            <p className="text-xs text-muted-foreground">Valor ST</p>
                            <p className="font-semibold">R$ {doc.totais.vST.toFixed(2)}</p>
                          </div>
                          <div className="space-y-0.5">
                            <p className="text-xs text-muted-foreground">IPI</p>
                            <p className="font-semibold">R$ {doc.totais.vIPI.toFixed(2)}</p>
                          </div>
                          <div className="space-y-0.5">
                            <p className="text-xs text-muted-foreground">PIS</p>
                            <p className="font-semibold">R$ {doc.totais.vPIS.toFixed(2)}</p>
                          </div>
                          <div className="space-y-0.5">
                            <p className="text-xs text-muted-foreground">COFINS</p>
                            <p className="font-semibold">R$ {doc.totais.vCOFINS.toFixed(2)}</p>
                          </div>
                          <div className="space-y-0.5 rounded-lg bg-primary/10 px-3 py-2 -m-1">
                            <p className="text-xs text-muted-foreground font-semibold">Valor Total da Nota</p>
                            <p className="font-bold text-primary text-lg">R$ {doc.totais.vNF.toFixed(2)}</p>
                          </div>
                        </div>

                        {/* Verificação cruzada */}
                        <div className="mt-3 flex items-center gap-2 text-xs">
                          <Package className="w-4 h-4 text-muted-foreground" />
                          <span className="text-muted-foreground">
                            {doc.total_itens} item(ns) | Soma dos itens: R$ {doc.soma_vProd_itens.toFixed(2)}
                          </span>
                          {Math.abs(doc.soma_vProd_itens - doc.totais.vProd) <= 0.01 ? (
                            <Badge variant="outline" className="text-xs border-emerald-400 text-emerald-700">Soma confere ✓</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs border-red-400 text-red-700">Divergência!</Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Itens */}
                  {doc.itens && doc.itens.length > 0 && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2"><Package className="w-4 h-4 text-primary" /> Itens da Nota ({doc.itens.length})</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="max-h-64 overflow-y-auto rounded-lg border">
                          <table className="w-full text-xs">
                            <thead className="bg-muted/50 sticky top-0">
                              <tr>
                                <th className="text-left p-2 font-semibold">#</th>
                                <th className="text-left p-2 font-semibold">Código</th>
                                <th className="text-left p-2 font-semibold">Descrição</th>
                                <th className="text-center p-2 font-semibold">CFOP</th>
                                <th className="text-right p-2 font-semibold">Qtde</th>
                                <th className="text-right p-2 font-semibold">V. Unit.</th>
                                <th className="text-right p-2 font-semibold">V. Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {doc.itens.map((item, i) => (
                                <tr key={i} className="border-t hover:bg-muted/30">
                                  <td className="p-2 text-muted-foreground">{item.nItem}</td>
                                  <td className="p-2 font-mono">{item.cProd}</td>
                                  <td className="p-2 max-w-xs truncate" title={item.xProd}>{item.xProd}</td>
                                  <td className="p-2 text-center font-mono">{item.CFOP}</td>
                                  <td className="p-2 text-right">{item.qCom.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                  <td className="p-2 text-right">{item.vUnCom.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                  <td className="p-2 text-right font-semibold">{item.vProd.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              ))}
            </div>
          )}

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
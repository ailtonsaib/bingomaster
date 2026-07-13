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
  Loader2,
  Download,
  ArrowRight,
  FileDown,
  Building2,
  Calendar,
  Scale,
  FileCheck2,
} from 'lucide-react';

export default function DimeScGenerator({ planKey, allowedTypes }) {
  const [arquivo, setArquivo] = useState(null);
  const [conteudo, setConteudo] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState('');
  const inputRef = useRef(null);

  const podeGerar = allowedTypes.includes('DIMESC');

  const formatarCnpj = (cnpj) => {
    const num = String(cnpj || '').replace(/\D/g, '');
    if (num.length !== 14) return cnpj;
    return num.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  };

  const formatarMoeda = (valor) => {
    if (!valor) return '0,00';
    const str = String(valor).replace(/[^\d,-]/g, '').replace(',', '.');
    const num = parseFloat(str);
    if (isNaN(num) || num === 0) return '0,00';
    return Math.abs(num).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Fallback: se o backend retornar créditos = 0, calcular a partir de débitos - saldo a recolher
  const calcularCreditos = () => {
    const creditosStr = String(resultado?.resumo?.creditos || '0').replace(/[^\d,-]/g, '').replace(',', '.');
    const creditosNum = parseFloat(creditosStr);
    if (creditosNum > 0.01) return resultado.resumo.creditos;

    // Tentar calcular: créditos = débitos - saldo a recolher
    const debitosStr = String(resultado?.resumo?.debitos || '0').replace(/[^\d,-]/g, '').replace(',', '.');
    const debitosNum = parseFloat(debitosStr);
    const saldoMatch = String(resultado?.resumo?.saldo || '').match(/R\$\s*([\d.,]+)/);
    if (saldoMatch && debitosNum > 0) {
      const raw = saldoMatch[1];
      const saldoNum = raw.includes(',')
        ? parseFloat(raw.replace(/\./g, '').replace(',', '.'))
        : parseFloat(raw);
      if (!isNaN(saldoNum) && saldoNum > 0) {
        const calculado = debitosNum - saldoNum;
        if (calculado > 0) return calculado.toFixed(2).replace('.', ',');
      }
    }
    return resultado?.resumo?.creditos || '0,00';
  };

  const formatarSaldo = (saldo) => {
    // saldo vem como "A RECOLHER: R$ 637776.29" (ponto como decimal)
    const match = String(saldo || '').match(/^(.*?)R\$\s*([\d.,]+)$/);
    if (!match) return saldo;
    const raw = match[2];
    // Se tem vírgula: formato BR (1.234,56) → remove pontos, troca vírgula por ponto
    // Se só tem ponto: formato US (1234.56) → converte direto
    const num = raw.includes(',')
      ? parseFloat(raw.replace(/\./g, '').replace(',', '.'))
      : parseFloat(raw);
    if (isNaN(num)) return saldo;
    const valorFormatado = num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${match[1]}R$ ${valorFormatado}`;
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErro('');
    setResultado(null);

    if (!file.name.toLowerCase().endsWith('.txt')) {
      setErro('Selecione um arquivo .txt no formato SPED Fiscal.');
      return;
    }

    setArquivo(file);
    const leitor = new FileReader();
    leitor.onload = (ev) => setConteudo(ev.target.result);
    leitor.onerror = () => setErro('Erro ao ler o arquivo.');
    leitor.readAsText(file, 'utf-8');
  };

  const handleGerar = async () => {
    if (!conteudo) {
      setErro('Selecione um arquivo SPED Fiscal primeiro.');
      return;
    }

    setLoading(true);
    setErro('');

    try {
      const response = await base44.functions.invoke('gerarDimeSC', {
        conteudoSped: conteudo,
        nomeArquivo: arquivo?.name || 'sped_fiscal.txt',
      });
      const dados = response.data;

      if (dados.success) {
        setResultado(dados);
      } else {
        setErro(dados.error || 'Erro ao gerar DIME-SC.');
      }
    } catch (err) {
      setErro('Erro ao gerar: ' + (err.message || 'erro desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!resultado) return;
    const blob = new Blob([resultado.conteudo], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = resultado.arquivoGerado;
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

  if (!podeGerar) {
    return (
      <Card className="border-amber-300 bg-amber-50">
        <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center">
            <FileDown className="w-7 h-7 text-amber-600" />
          </div>
          <h3 className="text-lg font-bold text-amber-800">Geração de DIME-SC não disponível no seu plano</h3>
          <p className="text-sm text-amber-700 max-w-md">
            A geração de arquivos DIME-SC a partir do SPED Fiscal está disponível a partir do plano <strong>Max</strong>.
            Faça upgrade para gerar arquivos DIME-SC automaticamente.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Fluxo explicativo */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-5">
          <div className="flex flex-col md:flex-row items-center gap-4 justify-center text-center">
            <div className="flex flex-col items-center gap-1">
              <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center">
                <FileText className="w-6 h-6 text-primary" />
              </div>
              <p className="text-xs font-semibold text-muted-foreground">SPED Fiscal (.txt)</p>
            </div>
            <ArrowRight className="w-5 h-5 text-muted-foreground rotate-90 md:rotate-0" />
            <div className="flex flex-col items-center gap-1">
              <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
                <Loader2 className={`w-6 h-6 text-primary-foreground ${loading ? 'animate-spin' : ''}`} />
              </div>
              <p className="text-xs font-semibold text-muted-foreground">Conversão</p>
            </div>
            <ArrowRight className="w-5 h-5 text-muted-foreground rotate-90 md:rotate-0" />
            <div className="flex flex-col items-center gap-1">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                <FileCheck2 className="w-6 h-6 text-emerald-600" />
              </div>
              <p className="text-xs font-semibold text-muted-foreground">DIME-SC (.txt)</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upload */}
      <Card className={arquivo ? 'border-emerald-300' : 'border-2 border-dashed border-primary/40 bg-primary/5'}>
        <CardContent className="p-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${arquivo ? 'bg-emerald-100' : 'bg-primary/10'}`}>
              {arquivo ? (
                <FileCheck2 className="w-8 h-8 text-emerald-600" />
              ) : (
                <UploadCloud className="w-8 h-8 text-primary" />
              )}
            </div>

            <div>
              <p className="text-sm font-semibold text-foreground">
                {arquivo ? arquivo.name : 'Selecione um arquivo SPED Fiscal (.txt)'}
              </p>
              {arquivo && (
                <p className="text-xs text-muted-foreground mt-1">{(arquivo.size / 1024).toFixed(1)} KB</p>
              )}
            </div>

            <Input
              ref={inputRef}
              type="file"
              accept=".txt"
              onChange={handleFileSelect}
              className="hidden"
              id="input-gerar-dime"
            />

            <div className="flex gap-2 flex-wrap justify-center">
              <Button variant="outline" size="sm" className="gap-2" onClick={() => inputRef.current?.click()} disabled={loading}>
                <UploadCloud className="h-4 w-4" />
                {arquivo ? 'Trocar Arquivo' : 'Selecionar SPED Fiscal'}
              </Button>
              {arquivo && (
                <Button variant="default" size="sm" className="gap-2" onClick={handleGerar} disabled={loading || !conteudo}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Gerando...
                    </>
                  ) : (
                    <>
                      <FileDown className="h-4 w-4" /> Gerar DIME-SC
                    </>
                  )}
                </Button>
              )}
              {(arquivo || resultado) && (
                <Button variant="ghost" size="sm" onClick={handleLimpar} disabled={loading}>
                  Limpar
                </Button>
              )}
            </div>

            {erro && <p className="text-sm text-red-600 font-medium mt-1">{erro}</p>}
          </div>
        </CardContent>
      </Card>

      {/* Resultado */}
      {resultado && (
        <>
          <Card className="border-emerald-400 bg-emerald-50">
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <CheckCircle2 className="w-12 h-12 text-emerald-600 shrink-0" />
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-emerald-700">DIME-SC Gerada com Sucesso!</h3>
                  <p className="text-sm text-muted-foreground">
                    Arquivo <strong>{resultado.arquivoGerado}</strong> gerado com {resultado.linhasGeradas} registros.
                  </p>
                </div>
                <Button variant="default" size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={handleDownload}>
                  <Download className="h-4 w-4" /> Baixar Arquivo
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Resumo da empresa */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" />
                Dados do Contribuinte
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Razão Social:</span>
                  <p className="font-semibold">{resultado.empresa.razao}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">CNPJ:</span>
                  <p className="font-semibold">{formatarCnpj(resultado.empresa.cnpj)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">UF:</span>
                  <p className="font-semibold">{resultado.empresa.uf}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Período de Apuração:</span>
                  <p className="font-semibold flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {resultado.empresa.mesAno || 'N/D'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Resumo fiscal */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <FileText className="w-8 h-8 text-primary shrink-0" />
                <div>
                  <p className="text-2xl font-bold">{resultado.resumo.totalCfops}</p>
                  <p className="text-xs text-muted-foreground">CFOPs Mapeados</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-red-200">
              <CardContent className="p-4 flex items-center gap-3">
                <Scale className="w-8 h-8 text-red-500 shrink-0" />
                <div>
                  <p className="text-lg font-bold text-red-600">R$ {formatarMoeda(resultado.resumo.debitos)}</p>
                  <p className="text-xs text-muted-foreground">Débitos ICMS</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-emerald-200">
              <CardContent className="p-4 flex items-center gap-3">
                <Scale className="w-8 h-8 text-emerald-500 shrink-0" />
                <div>
                  <p className="text-lg font-bold text-emerald-600">R$ {formatarMoeda(calcularCreditos())}</p>
                  <p className="text-xs text-muted-foreground">Créditos ICMS</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <Badge variant={resultado.resumo.saldo.includes('RECOLHER') ? 'destructive' : 'secondary'} className="text-xs">
                  {formatarSaldo(resultado.resumo.saldo)}
                </Badge>
              </CardContent>
            </Card>
          </div>

          {resultado.resumo.icmsSt === 'Sim' && (
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="p-4">
                <p className="text-sm text-blue-800">
                  <strong>ICMS Substituição Tributária:</strong> Detectado no SPED Fiscal. Registro 05 (Apuração ST) foi incluído na DIME-SC.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Prévia do arquivo */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Prévia do Arquivo Gerado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-xs font-mono bg-muted/50 rounded-lg p-4 overflow-x-auto max-h-72 overflow-y-auto border">
                {resultado.conteudo.split('\r\n').slice(0, 30).join('\n')}
                {resultado.conteudo.split('\r\n').length > 30 ? '\n...' : ''}
              </pre>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  XCircle,
  Loader2,
  Download,
  FileCheck2,
  Users,
  Receipt,
  TrendingUp,
} from 'lucide-react';

export default function ReinfGenerator({ planKey, allowedTypes, clienteId }) {
  const [arquivos, setArquivos] = useState([]);
  const [periodo, setPeriodo] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState('');
  const inputRef = useRef(null);

  const liberado = allowedTypes?.includes('REINF');

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    setErro('');
    setResultado(null);

    const xmlsValidos = files.filter(f => f.name.toLowerCase().endsWith('.xml'));
    if (xmlsValidos.length === 0) {
      setErro('Selecione arquivos .xml de NFS-e.');
      return;
    }
    setArquivos(xmlsValidos);
  };

  const handleGerar = async () => {
    if (arquivos.length === 0) {
      setErro('Selecione ao menos um arquivo de NFS-e.');
      return;
    }
    if (!periodo) {
      setErro('Informe o período de apuração (AAAA-MM).');
      return;
    }

    setLoading(true);
    setErro('');

    try {
      const xmlsLidos = await Promise.all(
        arquivos.map(
          (arquivo) =>
            new Promise((resolve, reject) => {
              const leitor = new FileReader();
              leitor.onload = (e) =>
                resolve({ nome: arquivo.name, conteudo: e.target.result });
              leitor.onerror = () => reject(new Error(`Erro ao ler: ${arquivo.name}`));
              leitor.readAsText(arquivo, 'utf-8');
            })
        )
      );

      // Pega o cliente selecionado da página pai via window (hack simples)
      // Na verdade, o componente recebe clienteId como prop
      const response = await base44.functions.invoke('gerarReinf', {
        xmls: xmlsLidos,
        clienteId,
        periodo
      });

      const dados = response.data;
      if (dados.success) {
        setResultado(dados);
      } else {
        setErro(dados.error || 'Erro ao gerar REINF.');
      }
    } catch (err) {
      setErro('Erro: ' + (err.message || 'erro desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!resultado?.conteudo) return;
    const blob = new Blob([resultado.conteudo], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = resultado.arquivoGerado;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLimpar = () => {
    setArquivos([]);
    setResultado(null);
    setErro('');
    setPeriodo('');
    if (inputRef.current) inputRef.current.value = '';
  };

  if (!liberado) {
    return (
      <Card className="border-amber-300 bg-amber-50">
        <CardContent className="p-6 text-center">
          <FileText className="w-10 h-10 text-amber-500 mx-auto mb-3" />
          <p className="text-sm font-semibold text-amber-800">
            Gerador de REINF disponível nos planos MAX ou superiores.
          </p>
          <p className="text-xs text-amber-700 mt-1">
            Faça upgrade para gerar arquivos SPED REINF a partir de NFS-e.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Upload + Configuração */}
      <Card className={arquivos.length > 0 ? 'border-emerald-300' : 'border-2 border-dashed border-primary/40 bg-primary/5'}>
        <CardContent className="p-6">
          <div className="flex flex-col gap-4">
            <div className="text-center">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3 ${arquivos.length > 0 ? 'bg-emerald-100' : 'bg-primary/10'}`}>
                {arquivos.length > 0 ? (
                  <FileCheck2 className="w-8 h-8 text-emerald-600" />
                ) : (
                  <UploadCloud className="w-8 h-8 text-primary" />
                )}
              </div>
              <p className="text-sm font-semibold text-foreground">
                {arquivos.length > 0
                  ? `${arquivos.length} arquivo(s) NFS-e selecionado(s)`
                  : 'Selecione os arquivos XML de NFS-e'}
              </p>
              {arquivos.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {arquivos.reduce((acc, f) => acc + f.size, 0) / 1024 < 1024
                    ? `${(arquivos.reduce((acc, f) => acc + f.size, 0) / 1024).toFixed(1)} KB total`
                    : `${(arquivos.reduce((acc, f) => acc + f.size, 0) / 1024 / 1024).toFixed(1)} MB total`}
                </p>
              )}
            </div>

            <Input
              ref={inputRef}
              type="file"
              accept=".xml"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              id="input-reinf-xml"
            />

            <div className="flex flex-wrap gap-2 justify-center">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => inputRef.current?.click()}
                disabled={loading}
              >
                <UploadCloud className="h-4 w-4" />
                {arquivos.length > 0 ? 'Trocar Arquivos' : 'Selecionar NFS-e'}
              </Button>
            </div>

            {/* Período */}
            <div className="flex flex-col sm:flex-row items-center gap-3 border-t pt-4">
              <Label className="text-sm font-bold whitespace-nowrap">
                Período de Apuração:
              </Label>
              <Input
                type="month"
                value={periodo}
                onChange={(e) => setPeriodo(e.target.value)}
                disabled={loading}
                className="sm:max-w-[200px]"
              />
              <p className="text-xs text-muted-foreground">
                Mês/ano das retenções a serem declaradas no REINF.
              </p>
            </div>

            {/* Ações */}
            <div className="flex flex-wrap gap-2 justify-center">
              <Button
                variant="default"
                size="sm"
                className="gap-2"
                onClick={handleGerar}
                disabled={loading || arquivos.length === 0 || !periodo}
              >
                {loading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Gerando REINF...</>
                ) : (
                  <><TrendingUp className="h-4 w-4" /> Gerar REINF</>
                )}
              </Button>
              {(arquivos.length > 0 || resultado) && (
                <Button variant="ghost" size="sm" onClick={handleLimpar} disabled={loading}>
                  Limpar
                </Button>
              )}
            </div>

            {erro && (
              <p className="text-sm text-red-600 font-medium text-center">{erro}</p>
            )}
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
                  <h3 className="text-xl font-bold text-emerald-700">REINF Gerado!</h3>
                  <p className="text-sm text-muted-foreground">
                    {resultado.arquivoGerado} — Período {resultado.periodo}
                  </p>
                </div>
                <Button
                  variant="default"
                  size="sm"
                  className="gap-2"
                  onClick={handleDownload}
                >
                  <Download className="h-4 w-4" /> Baixar XML
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Estatísticas */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <Receipt className="w-8 h-8 text-primary shrink-0" />
                <div>
                  <p className="text-2xl font-bold">{resultado.nfseProcessadas}</p>
                  <p className="text-xs text-muted-foreground">NFS-e Processadas</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <Users className="w-8 h-8 text-blue-500 shrink-0" />
                <div>
                  <p className="text-2xl font-bold">{resultado.totalBeneficiarios}</p>
                  <p className="text-xs text-muted-foreground">Beneficiários</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <FileText className="w-8 h-8 text-violet-500 shrink-0" />
                <div>
                  <p className="text-2xl font-bold">{resultado.eventosR2010 + resultado.eventosR2020 + 2}</p>
                  <p className="text-xs text-muted-foreground">Eventos Gerados</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-emerald-300">
              <CardContent className="p-4 flex items-center gap-3">
                <TrendingUp className="w-8 h-8 text-emerald-500 shrink-0" />
                <div>
                  <p className="text-lg font-bold text-emerald-600">
                    R$ {parseFloat(resultado.retencoes.total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-muted-foreground">Total Retido</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detalhamento de Retenções */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Retenções por Tributo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {[
                  { label: 'PIS', valor: resultado.retencoes.pis, cor: 'text-blue-600' },
                  { label: 'COFINS', valor: resultado.retencoes.cofins, cor: 'text-violet-600' },
                  { label: 'CSLL', valor: resultado.retencoes.csll, cor: 'text-amber-600' },
                  { label: 'IRRF', valor: resultado.retencoes.irrf, cor: 'text-red-600' },
                  { label: 'CPP/INSS', valor: resultado.retencoes.cpp, cor: 'text-emerald-600' },
                ].map((r) => (
                  <div key={r.label} className="rounded-lg border bg-card p-3 text-center">
                    <p className="text-xs font-semibold text-muted-foreground">{r.label}</p>
                    <p className={`text-lg font-bold ${r.cor}`}>
                      R$ {parseFloat(r.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                ))}
              </div>

              {/* Resumo de Eventos */}
              <div className="mt-4 border-t pt-4">
                <p className="text-sm font-semibold text-muted-foreground mb-2">Eventos Gerados:</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="text-xs">R-1000 — Cadastro</Badge>
                  <Badge variant="secondary" className="text-xs">
                    R-2010 — {resultado.eventosR2010} evento(s) de retenção na fonte
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    R-2020 — {resultado.eventosR2020} evento(s) de retenção previdenciária
                  </Badge>
                  <Badge variant="secondary" className="text-xs">R-2099 — Fechamento</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
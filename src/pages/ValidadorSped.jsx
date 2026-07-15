import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  ArrowLeft,
  Zap,
  Settings,
  Upload,
  FileText,
  Download,
  Search,
  Save,
  Building2,
  Loader2,
  TrendingUp,
  TrendingDown,
  Scale,
  Trash2,
  Lock,
  Check,
  Crown,
  ShieldCheck,
  FileDown,
  History,
  FileCheck,
  CalendarClock
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { getPortalUser } from '@/lib/portalSession';
import { useLicense } from '@/hooks/useLicense';
import SpedPlanPanel from '@/components/sped/SpedPlanPanel';
import SpedSubscriptionPanel from '@/components/sped/SpedSubscriptionPanel';
import SpedValidator from '@/components/sped/SpedValidator';
import DimeScGenerator from '@/components/sped/DimeScGenerator';
import ReinfGenerator from '@/components/sped/ReinfGenerator';
import XmlFiscalValidator from '@/components/sped/XmlFiscalValidator';

const SPED_TYPE_LABELS = {
  FISCAL: 'SPED Fiscal (ICMS/IPI)',
  CONTRIBUICOES: 'SPED Contribuições (PIS/COFINS)',
  ECD: 'SPED ECD (Contábil Digital)',
  ECF: 'SPED ECF (Contábil Fiscal)',
  DIMESC: 'DIME-SC (Declaração ICMS Santa Catarina)',
  REINF: 'SPED REINF (Retenções e Informações Fiscais)'
};

const PLAN_SPED_TYPES = {
  free: ['FISCAL'],
  basic: ['FISCAL'],
  pro: ['FISCAL', 'CONTRIBUICOES'],
  max: ['FISCAL', 'CONTRIBUICOES', 'ECD', 'ECF', 'DIMESC', 'REINF'],
  mega: ['FISCAL', 'CONTRIBUICOES', 'ECD', 'ECF', 'DIMESC', 'REINF'],
  ultra: ['FISCAL', 'CONTRIBUICOES', 'ECD', 'ECF', 'DIMESC', 'REINF'],
  enterprise: ['FISCAL', 'CONTRIBUICOES', 'ECD', 'ECF', 'DIMESC', 'REINF']
};

const FREE_DOWNLOAD_LIMIT = 5;

export default function ValidadorSped() {
  const [aba, setAba] = useState('gerador');
  const [status, setStatus] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [loading, setLoading] = useState(false);
  const [historico, setHistorico] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [clienteSelecionado, setClienteSelecionado] = useState('');
  const [consultandoCnpj, setConsultandoCnpj] = useState(false);
  const [spedType, setSpedType] = useState('FISCAL');
  const { license, loading: loadingLicense } = useLicense();
  const [companyLogo, setCompanyLogo] = useState(null);

  // Form Admin
  const [razaoSocial, setRazaoSocial] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [ie, setIe] = useState('');
  const [uf, setUf] = useState('GO');
  const [municipio, setMunicipio] = useState('');
  const [regime, setRegime] = useState('NORMAL');
  const [perfil, setPerfil] = useState('PRESUMIDO');

  const planKey = license?.plan_key || 'free';
  const allowedTypes = PLAN_SPED_TYPES[planKey] || ['FISCAL'];
  const isFreePlan = planKey === 'free';
  const downloadsUsed = historico.length;
  const downloadsRemaining = isFreePlan
    ? Math.max(0, FREE_DOWNLOAD_LIMIT - downloadsUsed)
    : null;
  const limitReached = isFreePlan && downloadsUsed >= FREE_DOWNLOAD_LIMIT;

  const carregarDados = useCallback(async () => {
    try {
      const arquivos = await base44.entities.SpedFile.list('-created_date', 50);
      setHistorico(arquivos);
      const cliList = await base44.entities.ClienteSped.list('-created_date', 50);
      setClientes(cliList);
      if (cliList.length > 0 && !clienteSelecionado) {
        setClienteSelecionado(cliList[0].id);
      }
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    }
  }, [clienteSelecionado]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  useEffect(() => {
    (async () => {
      try {
        const portalUser = getPortalUser();
        if (!portalUser) return;
        const list = await base44.entities.PDVCompanyConfig.filter({ user_email: portalUser.email });
        if (list.length > 0) setCompanyLogo(list[0].logo_url || null);
      } catch (e) { console.error(e); }
    })();
  }, []);

  const formatCnpj = (valor) =>
    valor.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');

  const buscarCnpjReceita = async () => {
    const cnpjLimpo = cnpj.replace(/\D/g, '');
    if (cnpjLimpo.length !== 14) return;

    setConsultandoCnpj(true);
    setStatus('Consultando dados na Receita Federal...');

    try {
      const response = await base44.functions.invoke('consultaCnpj', { cnpj: cnpjLimpo });
      const dados = response.data.dados;
      const situacao = dados.descricao_situacao_cadastral || dados.situacao_cadastral;

      if (situacao && situacao.toString().toUpperCase() !== 'ATIVA') {
        alert(`❌ CNPJ INATIVO: ${situacao}. Não pode ser cadastrado.`);
        setStatus(`CNPJ ${cnpjLimpo} está INATIVO.`);
        setRazaoSocial('');
        setCnpj('');
        setIe('');
        setMunicipio('');
        return;
      }

      setRazaoSocial(dados.razao_social || dados.nome_fantasia || '');
      setMunicipio(dados.codigo_municipio_ibge?.toString() || dados.codigo_municipio?.toString() || '');
      setUf(dados.uf || 'GO');
      setStatus('✔ Dados do contribuinte recuperados!');
    } catch (err) {
      alert('Erro ao consultar CNPJ. Verifique o número.');
      setStatus('Falha ao consultar CNPJ.');
    } finally {
      setConsultandoCnpj(false);
    }
  };

  const handleSalvarCliente = async (e) => {
    e.preventDefault();
    const cnpjLimpo = cnpj.replace(/\D/g, '');

    if (!razaoSocial || !cnpjLimpo || !ie || !municipio) {
      alert('Preencha todos os campos obrigatórios (*).');
      return;
    }

    const cnpjJaExiste = clientes.some(
      (c) => c.cnpj.replace(/\D/g, '') === cnpjLimpo
    );
    if (cnpjJaExiste) {
      alert(`⚠️ CNPJ ${formatCnpj(cnpjLimpo)} já cadastrado!`);
      return;
    }

    try {
      await base44.entities.ClienteSped.create({
        razao_social: razaoSocial,
        cnpj: cnpjLimpo,
        ie: ie.replace(/\D/g, ''),
        uf,
        municipio,
        regime,
        perfil: regime === 'NORMAL' ? perfil : 'PRESUMIDO'
      });
      alert('Contribuinte salvo com sucesso!');
      setRazaoSocial('');
      setCnpj('');
      setIe('');
      setMunicipio('');
      carregarDados();
    } catch (err) {
      alert('Erro ao salvar cliente: ' + err.message);
    }
  };

  const handleXmlSelection = async (event) => {
    const arquivos = event.target.files;
    if (!arquivos || arquivos.length === 0) return;
    if (!clienteSelecionado) {
      alert('Selecione uma empresa contribuinte primeiro!');
      return;
    }

    if (!allowedTypes.includes(spedType)) {
      alert('Seu plano não inclui este tipo de SPED. Faça upgrade!');
      return;
    }

    setLoading(true);
    setStatus(`Lendo ${arquivos.length} arquivos XML...`);
    setResultado(null);

    try {
      const listaXmls = await Promise.all(
        Array.from(arquivos).map(
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

      setStatus('Consolidando dados com o perfil tributário...');

      const response = await base44.functions.invoke('gerarSped', {
        xmls: listaXmls,
        clienteId: clienteSelecionado,
        spedType
      });
      const dados = response.data;

      if (dados.success) {
        setStatus('✔ Arquivo fiscal gerado com sucesso!');
        setResultado(dados);
        carregarDados();
      } else {
        setStatus(`❌ Erro: ${dados.error}`);
      }
    } catch (err) {
      setStatus(`❌ Falha: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (arq) => {
    if (limitReached) {
      alert(`⚠ Limite de ${FREE_DOWNLOAD_LIMIT} downloads do plano FREE atingido!\n\nFaça upgrade para o plano BÁSICO para downloads ilimitados.`);
      return;
    }
    const blob = new Blob([arq.conteudo], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = arq.nome_arquivo;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteArquivo = async (id) => {
    if (!confirm('Excluir este arquivo SPED?')) return;
    await base44.entities.SpedFile.delete(id);
    carregarDados();
  };

  // Bloqueio temporário: apenas admin pode acessar durante testes
  const portalUser = getPortalUser();
  if (!portalUser?.is_admin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
            <Settings className="w-8 h-8 text-amber-600" />
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">Sistema em Manutenção</h1>
          <p className="text-sm text-muted-foreground mb-6">
            O Validador SPED está passando por melhorias e testes técnicos.
            Volte em breve — em breve estará disponível novamente.
          </p>
          <Button variant="outline" onClick={() => window.history.back()} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <header className="mb-6 flex flex-col gap-4 border-b pb-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Button variant="ghost" size="sm" className="mb-2 -ml-2 gap-1" onClick={() => window.history.back()}>
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Button>
            <div className="flex items-center gap-3">
              {companyLogo && (
                <img src={companyLogo} alt="Logo" className="max-h-12 max-w-[120px] object-contain" />
              )}
              <h1 className="font-heading text-2xl font-bold text-primary md:text-3xl">
                Sistema Multi-Cliente SPED
              </h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Gere arquivos SPED Fiscal de acordo com o regime tributário do contribuinte.
            </p>
            {!loadingLicense && license && (
              <Badge className="mt-2" variant={isFreePlan ? 'secondary' : 'default'}>
                <Crown className="h-3 w-3 mr-1" />
                Plano {license.plan_name || planKey.toUpperCase()}
                {isFreePlan && ` · ${downloadsRemaining} downloads restantes`}
              </Badge>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant={aba === 'gerador' ? 'default' : 'outline'}
              onClick={() => setAba('gerador')}
              className="gap-2"
            >
              <Zap className="h-4 w-4" /> Gerador SPED
            </Button>
            <Button
              variant={aba === 'validador' ? 'default' : 'outline'}
              onClick={() => setAba('validador')}
              className="gap-2"
            >
              <ShieldCheck className="h-4 w-4" /> Validador
            </Button>
            <Button
              variant={aba === 'xmlfiscal' ? 'default' : 'outline'}
              onClick={() => setAba('xmlfiscal')}
              className="gap-2"
            >
              <FileCheck className="h-4 w-4" /> NF-e / CT-e
            </Button>
            <Button
              variant={aba === 'dime' ? 'default' : 'outline'}
              onClick={() => setAba('dime')}
              className="gap-2"
            >
              <FileDown className="h-4 w-4" /> DIME-SC
            </Button>
            <Button
              variant={aba === 'reinf' ? 'default' : 'outline'}
              onClick={() => setAba('reinf')}
              className="gap-2"
            >
              <TrendingUp className="h-4 w-4" /> REINF
            </Button>
            <Button
              variant={aba === 'planos' ? 'default' : 'outline'}
              onClick={() => setAba('planos')}
              className="gap-2"
            >
              <Crown className="h-4 w-4" /> Planos
            </Button>
            <Button
              variant={aba === 'assinaturas' ? 'default' : 'outline'}
              onClick={() => setAba('assinaturas')}
              className="gap-2"
            >
              <CalendarClock className="h-4 w-4" /> Assinaturas
            </Button>
            <Button
              variant={aba === 'admin' ? 'default' : 'outline'}
              onClick={() => setAba('admin')}
              className="gap-2"
            >
              <Settings className="h-4 w-4" /> Painel Admin
            </Button>
            <Link to="/sped-validations">
              <Button variant="outline" className="gap-2">
                <History className="h-4 w-4" /> Histórico
              </Button>
            </Link>
          </div>
        </header>

        {/* ABA 1: Gerador SPED */}
        {aba === 'gerador' && (
          <div className="space-y-6">
            {/* Seletor de cliente */}
            <Card>
              <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
                <Label className="font-semibold">Empresa Contribuinte Declarante:</Label>
                <Select value={clienteSelecionado} onValueChange={setClienteSelecionado}>
                  <SelectTrigger className="w-full md:min-w-[300px]">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {clientes.length === 0 ? (
                      <SelectItem value={null} disabled>
                        Nenhum cliente cadastrado
                      </SelectItem>
                    ) : (
                      clientes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.razao_social} ({formatCnpj(c.cnpj)})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* Seletor de tipo SPED + aviso de limite */}
            <Card>
              <CardContent className="p-4 space-y-4">
                <div>
                  <Label className="mb-2 block text-sm font-bold">Tipo de SPED:</Label>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {Object.entries(SPED_TYPE_LABELS).map(([key, label]) => {
                      const allowed = allowedTypes.includes(key);
                      const selected = spedType === key;
                      return (
                        <button
                          key={key}
                          onClick={() => allowed && setSpedType(key)}
                          disabled={!allowed}
                          className={`relative rounded-lg border p-3 text-left transition-all ${
                            selected
                              ? 'border-primary bg-primary/10 ring-1 ring-primary'
                              : allowed
                                ? 'border-border hover:border-primary/50 cursor-pointer'
                                : 'border-muted bg-muted/30 cursor-not-allowed opacity-60'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold">{label.split(' (')[0]}</span>
                            {allowed ? (
                              selected && <Check className="h-4 w-4 text-primary" />
                            ) : (
                              <Lock className="h-3 w-3 text-muted-foreground" />
                            )}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {label.split(' (')[1]?.replace(')', '') || ''}
                          </p>
                          {!allowed && (
                            <p className="mt-1 text-xs font-semibold text-amber-600">
                              Plano {planKey === 'free' || planKey === 'basic' ? 'PRO' : 'MAX'}+
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {isFreePlan && (
                  <div className={`rounded-lg border p-3 text-sm ${
                    limitReached
                      ? 'border-red-300 bg-red-50 text-red-700'
                      : 'border-amber-300 bg-amber-50 text-amber-700'
                  }`}>
                    {limitReached ? (
                      <strong>⚠ Limite de {FREE_DOWNLOAD_LIMIT} downloads atingido! Faça upgrade no plano BÁSICO para continuar.</strong>
                    ) : (
                      <>Plano FREE: {downloadsRemaining} de {FREE_DOWNLOAD_LIMIT} downloads restantes.</>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Upload de XMLs */}
            <Card className="border-2 border-dashed border-primary/40 bg-primary/5">
              <CardContent className="p-8 text-center">
                <Label
                  htmlFor="input-xml"
                  className="mb-3 block cursor-pointer font-semibold text-primary"
                >
                  Clique para selecionar os XMLs para este cliente
                </Label>
                <Input
                  id="input-xml"
                  type="file"
                  accept=".xml"
                  multiple
                  onChange={handleXmlSelection}
                  disabled={loading}
                  className="mx-auto max-w-md cursor-pointer"
                />
                {loading && (
                  <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Processando XMLs...
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Status */}
            {status && (
              <div className="rounded-lg border bg-muted p-4 font-mono text-sm">
                ⏳ Status: {status}
              </div>
            )}

            {/* Resultado */}
            {resultado && (
              <div className="space-y-4">
                <Card className="border-emerald-300 bg-emerald-50">
                  <CardContent className="p-5">
                    <h3 className="mb-2 flex items-center gap-2 text-lg font-bold text-emerald-700">
                      🚀 Arquivo SPED Gerado!
                    </h3>
                    <p className="text-sm">
                      <strong>Nome:</strong> {resultado.arquivoGerado}
                    </p>
                    <p className="text-sm">
                      <strong>Linhas escrituradas:</strong> {resultado.linhasGeradas} linhas
                    </p>
                    <p className="text-sm">
                      <strong>Participantes:</strong> {resultado.totalParticipantes} |{' '}
                      <strong>Produtos:</strong> {resultado.totalProdutos}
                    </p>
                  </CardContent>
                </Card>

                {/* Apuração */}
                <Card className="border-blue-300 bg-blue-50">
                  <CardHeader>
                    <CardTitle className="text-base text-primary">
                      📊 Resumo da Apuração Mensal (ICMS)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="rounded-lg border bg-white p-3">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <TrendingDown className="h-3 w-3" /> (-) Créditos
                        </div>
                        <p className="text-lg font-bold text-emerald-600">
                          R${' '}
                          {parseFloat(resultado.apuracao.creditos).toLocaleString('pt-BR', {
                            minimumFractionDigits: 2
                          })}
                        </p>
                      </div>
                      <div className="rounded-lg border bg-white p-3">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <TrendingUp className="h-3 w-3" /> (+) Débitos
                        </div>
                        <p className="text-lg font-bold text-red-600">
                          R${' '}
                          {parseFloat(resultado.apuracao.debitos).toLocaleString('pt-BR', {
                            minimumFractionDigits: 2
                          })}
                        </p>
                      </div>
                      <div className="rounded-lg border bg-white p-3">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Scale className="h-3 w-3" /> Resultado
                        </div>
                        <p className="text-sm font-bold text-primary">
                          {resultado.apuracao.saldo}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Histórico */}
            <div>
              <h2 className="mb-3 border-b-2 pb-2 text-lg font-bold">
                📁 Repositório de Arquivos SPED Gerados
              </h2>
              {historico.length === 0 ? (
                <p className="text-sm italic text-muted-foreground">
                  Nenhum arquivo gerado ainda.
                </p>
              ) : (
                <div className="overflow-hidden rounded-lg border">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b bg-muted">
                      <tr>
                        <th className="p-3">Nome do Arquivo</th>
                        <th className="p-3">Tipo</th>
                        <th className="p-3">Cliente</th>
                        <th className="p-3">Tamanho</th>
                        <th className="p-3 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historico.map((arq, idx) => (
                        <tr
                          key={arq.id}
                          className={idx % 2 === 0 ? 'bg-white' : 'bg-muted/30'}
                        >
                          <td className="p-3 font-mono text-xs">{arq.nome_arquivo}</td>
                          <td className="p-3">
                            <Badge variant="outline" className="text-xs">
                              {arq.sped_type || 'FISCAL'}
                            </Badge>
                          </td>
                          <td className="p-3 text-muted-foreground">{arq.cliente_nome}</td>
                          <td className="p-3 text-muted-foreground">
                            {arq.tamanho_kb?.toFixed(2)} KB
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex justify-center gap-2">
                              <Button
                                size="sm"
                                variant="default"
                                className="gap-1"
                                onClick={() => handleDownload(arq)}
                              >
                                <Download className="h-3 w-3" /> Download
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleDeleteArquivo(arq.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ABA: Validador */}
        {aba === 'validador' && (
          <SpedValidator
            planKey={planKey}
            limitReached={limitReached}
            clienteId={clienteSelecionado}
            clienteNome={clientes.find(c => c.id === clienteSelecionado)?.razao_social || ''}
            onClienteCadastrado={carregarDados}
          />
        )}

        {/* ABA: NF-e / CT-e */}
        {aba === 'xmlfiscal' && (
          <XmlFiscalValidator planKey={planKey} />
        )}

        {/* ABA: DIME-SC */}
        {aba === 'dime' && (
          <DimeScGenerator planKey={planKey} allowedTypes={allowedTypes} />
        )}

        {/* ABA: REINF */}
        {aba === 'reinf' && (
          <ReinfGenerator planKey={planKey} allowedTypes={allowedTypes} clienteId={clienteSelecionado} />
        )}

        {/* ABA: Planos */}
        {aba === 'planos' && (
          <SpedPlanPanel planKey={planKey} downloadsUsed={downloadsUsed} isAdmin={license?.is_admin} />
        )}

        {/* ABA: Assinaturas */}
        {aba === 'assinaturas' && (
          <SpedSubscriptionPanel />
        )}

        {/* ABA 2: Painel Admin */}
        {aba === 'admin' && (
          <div className="grid gap-6 md:grid-cols-2">
            {/* Formulário */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" /> Cadastrar Novo Contribuinte
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSalvarCliente} className="space-y-4">
                  <div>
                    <Label className="mb-1 block text-sm font-bold">
                      CNPJ * (dispara busca)
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        value={cnpj}
                        onChange={(e) => setCnpj(e.target.value)}
                        placeholder="14 números do CNPJ"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={buscarCnpjReceita}
                        disabled={consultandoCnpj}
                        className="gap-1"
                      >
                        {consultandoCnpj ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Search className="h-4 w-4" />
                        )}
                        Buscar
                      </Button>
                    </div>
                  </div>

                  <div>
                    <Label className="mb-1 block text-sm font-bold">Razão Social *</Label>
                    <Input
                      type="text"
                      value={razaoSocial}
                      onChange={(e) => setRazaoSocial(e.target.value)}
                      placeholder="Nome da Empresa"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="mb-1 block text-sm font-bold">
                        Inscrição Estadual *
                      </Label>
                      <Input
                        type="text"
                        value={ie}
                        onChange={(e) => setIe(e.target.value)}
                        placeholder="111222333"
                      />
                    </div>
                    <div>
                      <Label className="mb-1 block text-sm font-bold">UF</Label>
                      <Select value={uf} onValueChange={setUf}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {['GO', 'SP', 'RJ', 'MG', 'PR', 'SC', 'RS', 'BA', 'CE', 'DF', 'ES', 'MT', 'MS', 'PA', 'PB', 'PE', 'RN', 'SE', 'TO', 'AC', 'AL', 'AM', 'AP', 'MA', 'PI', 'RO', 'RR'].map((u) => (
                            <SelectItem key={u} value={u}>{u}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label className="mb-1 block text-sm font-bold">
                      Código Município (IBGE) *
                    </Label>
                    <Input
                      type="text"
                      value={municipio}
                      onChange={(e) => setMunicipio(e.target.value)}
                      placeholder="Ex: 5208707"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="mb-1 block text-sm font-bold">
                        Regime Tributário
                      </Label>
                      <Select value={regime} onValueChange={setRegime}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NORMAL">Regime Normal</SelectItem>
                          <SelectItem value="SIMPLES">Simples Nacional</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="mb-1 block text-sm font-bold">Perfil</Label>
                      <Select
                        value={perfil}
                        onValueChange={setPerfil}
                        disabled={regime === 'SIMPLES'}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PRESUMIDO">Lucro Presumido</SelectItem>
                          <SelectItem value="REAL">Lucro Real</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Button type="submit" className="w-full gap-2" size="lg">
                    <Save className="h-4 w-4" /> Salvar Contribuinte
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Lista de Clientes */}
            <div>
              <h3 className="mb-3 text-lg font-bold">Clientes Cadastrados</h3>
              {clientes.length === 0 ? (
                <p className="text-sm italic text-muted-foreground">
                  Nenhuma empresa registrada.
                </p>
              ) : (
                <div className="space-y-3">
                  {clientes.map((c) => (
                    <Card key={c.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <strong className="block">{c.razao_social}</strong>
                            <span className="mt-1 block text-sm text-muted-foreground">
                              CNPJ: {formatCnpj(c.cnpj)} | IE: {c.ie || '-'}
                            </span>
                            <Badge
                              className="mt-2"
                              variant={c.regime === 'SIMPLES' ? 'secondary' : 'default'}
                            >
                              {c.regime === 'SIMPLES'
                                ? 'Simples Nacional'
                                : `Normal - ${c.perfil}`}
                            </Badge>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={async () => {
                              if (confirm('Excluir este cliente?')) {
                                await base44.entities.ClienteSped.delete(c.id);
                                carregarDados();
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
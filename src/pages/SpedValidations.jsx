import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  ArrowLeft,
  Search,
  FileText,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Pencil,
  Download,
  Loader2,
  Filter,
  Calendar,
  Building2,
  Trash2
} from 'lucide-react';

const TYPE_LABELS = {
  FISCAL: 'SPED Fiscal',
  CONTRIBUICOES: 'SPED Contribuições',
  ECD: 'SPED ECD',
  ECF: 'SPED ECF',
  DIMESC: 'DIME-SC',
  REINF: 'SPED REINF',
  DESCONHECIDO: 'Não identificado'
};

export default function SpedValidations() {
  const [validations, setValidations] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [clienteFilter, setClienteFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [vals, cliList] = await Promise.all([
        base44.entities.SpedValidation.list('-validation_date', 500),
        base44.entities.ClienteSped.list('-created_date', 50)
      ]);
      setValidations(vals);
      setClientes(cliList);
    } catch (err) {
      console.error('Erro ao carregar validações:', err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    return validations.filter((v) => {
      const matchesSearch = !search ||
        v.arquivo_nome?.toLowerCase().includes(search.toLowerCase()) ||
        v.cliente_nome?.toLowerCase().includes(search.toLowerCase()) ||
        v.validated_by?.toLowerCase().includes(search.toLowerCase());

      const matchesCliente = clienteFilter === 'all' || v.cliente_id === clienteFilter;
      const matchesType = typeFilter === 'all' || v.tipo_detectado === typeFilter;

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'valid' && v.is_valid) ||
        (statusFilter === 'invalid' && !v.is_valid) ||
        (statusFilter === 'corrected' && v.foi_corrigido);

      let matchesDate = true;
      if (dateFrom) {
        const valDate = v.validation_date ? new Date(v.validation_date) : null;
        const fromDate = new Date(dateFrom);
        if (valDate && valDate < fromDate) matchesDate = false;
      }
      if (dateTo) {
        const valDate = v.validation_date ? new Date(v.validation_date) : null;
        const toDate = new Date(dateTo + 'T23:59:59');
        if (valDate && valDate > toDate) matchesDate = false;
      }

      return matchesSearch && matchesCliente && matchesType && matchesStatus && matchesDate;
    });
  }, [validations, search, clienteFilter, typeFilter, statusFilter, dateFrom, dateTo]);

  const formatDate = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleDownload = (v) => {
    const conteudo = v.conteudo_final || '';
    if (!conteudo) return;
    const isXml = v.tipo_detectado === 'REINF';
    const blob = new Blob([conteudo], { type: isXml ? 'application/xml' : 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = v.arquivo_nome || 'arquivo_validado.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = async (id) => {
    if (!confirm('Excluir este registro de validação?')) return;
    await base44.entities.SpedValidation.delete(id);
    loadData();
  };

  const clearFilters = () => {
    setSearch('');
    setClienteFilter('all');
    setTypeFilter('all');
    setStatusFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  const hasActiveFilters = search || clienteFilter !== 'all' || typeFilter !== 'all' || statusFilter !== 'all' || dateFrom || dateTo;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-col gap-4 border-b pb-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Link to="/validador-sped">
              <Button variant="ghost" size="sm" className="mb-2 -ml-2 gap-1">
                <ArrowLeft className="h-4 w-4" /> Voltar ao Validador
              </Button>
            </Link>
            <h1 className="font-heading text-2xl font-bold text-primary md:text-3xl">
              Histórico de Validações
            </h1>
            <p className="text-sm text-muted-foreground">
              Todos os arquivos SPED, DIME-SC e REINF validados ou corrigidos.
            </p>
          </div>
        </header>

        {/* Filtros */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Filter className="h-4 w-4" /> Filtros
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">Buscar</label>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Nome, cliente ou e-mail..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">Cliente</label>
                <Select value={clienteFilter} onValueChange={setClienteFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os clientes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os clientes</SelectItem>
                    {clientes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.razao_social}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">Tipo</label>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os tipos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os tipos</SelectItem>
                    {Object.entries(TYPE_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="valid">Válidos</SelectItem>
                    <SelectItem value="invalid">Com erros</SelectItem>
                    <SelectItem value="corrected">Corrigidos</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Data inicial
                </label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Data final
                </label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </div>

            {hasActiveFilters && (
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Limpar filtros
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Resumo */}
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <FileText className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{filtered.length}</p>
                <p className="text-xs text-muted-foreground">Total validações</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-emerald-200">
            <CardContent className="flex items-center gap-3 p-4">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              <div>
                <p className="text-2xl font-bold text-emerald-600">{filtered.filter(v => v.is_valid).length}</p>
                <p className="text-xs text-muted-foreground">Arquivos válidos</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-red-200">
            <CardContent className="flex items-center gap-3 p-4">
              <XCircle className="h-8 w-8 text-red-500" />
              <div>
                <p className="text-2xl font-bold text-red-600">{filtered.filter(v => !v.is_valid).length}</p>
                <p className="text-xs text-muted-foreground">Com erros</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-amber-200">
            <CardContent className="flex items-center gap-3 p-4">
              <Pencil className="h-8 w-8 text-amber-500" />
              <div>
                <p className="text-2xl font-bold text-amber-600">{filtered.filter(v => v.foi_corrigido).length}</p>
                <p className="text-xs text-muted-foreground">Corrigidos</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lista */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="mx-auto mb-3 h-12 w-12 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                {hasActiveFilters
                  ? 'Nenhuma validação encontrada com os filtros aplicados.'
                  : 'Nenhuma validação realizada ainda.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-muted">
                <tr>
                  <th className="p-3">Arquivo</th>
                  <th className="p-3">Tipo</th>
                  <th className="p-3">Cliente</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-center">Erros / Avisos</th>
                  <th className="p-3">Data</th>
                  <th className="p-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((v, idx) => (
                  <tr key={v.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-muted/30'}>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <p className="truncate font-mono text-xs font-medium">{v.arquivo_nome}</p>
                          <p className="text-xs text-muted-foreground">{v.total_linhas || 0} linhas</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className="text-xs">
                        {TYPE_LABELS[v.tipo_detectado] || v.tipo_detectado || '—'}
                      </Badge>
                    </td>
                    <td className="p-3">
                      {v.cliente_nome ? (
                        <div className="flex items-center gap-1">
                          <Building2 className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs">{v.cliente_nome}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-col items-center gap-1">
                        {v.is_valid ? (
                          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-xs">
                            <CheckCircle2 className="mr-1 h-3 w-3" /> Válido
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-700 hover:bg-red-100 text-xs">
                            <XCircle className="mr-1 h-3 w-3" /> Erros
                          </Badge>
                        )}
                        {v.foi_corrigido && (
                          <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 text-xs">
                            <Pencil className="mr-1 h-3 w-3" /> Corrigido
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      <span className="text-xs font-semibold text-red-600">{v.total_erros || 0}</span>
                      <span className="text-xs text-muted-foreground"> / </span>
                      <span className="text-xs font-semibold text-amber-600">{v.total_avisos || 0}</span>
                    </td>
                    <td className="p-3">
                      <p className="text-xs">{formatDate(v.validation_date || v.created_date)}</p>
                      {v.validated_by && (
                        <p className="text-xs text-muted-foreground truncate max-w-[120px]">{v.validated_by}</p>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex justify-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => handleDownload(v)}
                          title="Baixar arquivo"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => handleDelete(v.id)}
                          title="Excluir registro"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
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
  );
}
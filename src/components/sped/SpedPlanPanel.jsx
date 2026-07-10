import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Check, X, Lock, FileText, TrendingUp, Zap, Save, Pencil, Loader2, RotateCcw } from 'lucide-react';

const SPED_TYPES = [
  { key: 'FISCAL', label: 'SPED Fiscal', desc: 'ICMS / IPI' },
  { key: 'CONTRIBUICOES', label: 'SPED Contribuições', desc: 'PIS / COFINS' },
  { key: 'ECD', label: 'SPED ECD', desc: 'Escrituração Contábil Digital' },
  { key: 'ECF', label: 'SPED ECF', desc: 'Escrituração Contábil Fiscal' },
  { key: 'DIMESC', label: 'DIME-SC', desc: 'Declaração ICMS Santa Catarina' },
  { key: 'REINF', label: 'SPED REINF', desc: 'Retenções e Informações Fiscais' }
];

const FALLBACK_PLANS = [
  { plan_key: 'free', plan_name: 'FREE', price: 0, downloads_limit: 5, sped_types: ['FISCAL'], description: 'Para testes e pequenas operações', is_active: true, order: 1 },
  { plan_key: 'basic', plan_name: 'BÁSICO', price: 49.90, downloads_limit: null, sped_types: ['FISCAL'], description: 'SPED Fiscal ilimitado', is_active: true, order: 2 },
  { plan_key: 'pro', plan_name: 'PRO', price: 99.90, downloads_limit: null, sped_types: ['FISCAL', 'CONTRIBUICOES'], description: 'SPED Fiscal + Contribuições', is_active: true, order: 3 },
  { plan_key: 'max', plan_name: 'MAX', price: 199.90, downloads_limit: null, sped_types: ['FISCAL', 'CONTRIBUICOES', 'ECD', 'ECF', 'DIMESC', 'REINF'], description: 'Todos os módulos SPED', is_active: true, order: 4 }
];

const PLAN_COLORS = {
  free: 'bg-slate-100 text-slate-700 border-slate-300',
  basic: 'bg-blue-100 text-blue-700 border-blue-300',
  pro: 'bg-purple-100 text-purple-700 border-purple-300',
  max: 'bg-emerald-100 text-emerald-700 border-emerald-300'
};

export default function SpedPlanPanel({ planKey, downloadsUsed, isAdmin: isAdminProp }) {
  const [plans, setPlans] = useState(FALLBACK_PLANS);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState({});
  const [isAdmin, setIsAdmin] = useState(isAdminProp || false);

  const carregarPlanos = async () => {
    try {
      const res = await base44.functions.invoke('manageSpedPlans', { action: 'list' });
      if (res.data?.success && res.data.plans?.length > 0) {
        setPlans(res.data.plans);
      }
    } catch (e) {
      console.error('Erro ao carregar planos:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarPlanos();
  }, []);

  useEffect(() => {
    if (isAdminProp) {
      setIsAdmin(true);
      return;
    }
    base44.auth.me()
      .then((user) => setIsAdmin(user?.role === 'admin'))
      .catch(() => setIsAdmin(false));
  }, [isAdminProp]);

  const iniciarEdicao = (plano) => {
    setEditando(plano.plan_key);
    setForm({
      plan_key: plano.plan_key,
      plan_name: plano.plan_name,
      price: plano.price ?? 0,
      downloads_limit: plano.downloads_limit ?? '',
      sped_types: plano.sped_types || [],
      description: plano.description || '',
      is_active: plano.is_active !== false
    });
  };

  const cancelarEdicao = () => {
    setEditando(null);
    setForm({});
  };

  const toggleTipo = (tipo) => {
    const atual = form.sped_types || [];
    setForm({
      ...form,
      sped_types: atual.includes(tipo) ? atual.filter((t) => t !== tipo) : [...atual, tipo]
    });
  };

  const salvarPlano = async () => {
    setSalvando(true);
    try {
      const res = await base44.functions.invoke('manageSpedPlans', {
        ...form,
        action: 'save'
      });
      if (res.data && !res.data.success) {
        alert('Erro ao salvar: ' + (res.data.error || 'erro desconhecido'));
        return;
      }
      await carregarPlanos();
      setEditando(null);
      setForm({});
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || 'erro desconhecido';
      alert('Erro ao salvar: ' + msg);
    } finally {
      setSalvando(false);
    }
  };

  const formatPreco = (preco) => {
    if (preco === 0 || preco === null) return 'Grátis';
    return `R$ ${Number(preco).toFixed(2).replace('.', ',')}`;
  };

  const isMaxPlan = ['max', 'mega', 'ultra', 'enterprise'].includes(planKey);
  const currentPlan = plans.find((p) => p.plan_key === planKey) || plans[0];
  const effectivePlan = isMaxPlan ? plans.find((p) => p.plan_key === 'max') || plans[3] : currentPlan;

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header admin */}
      {isAdmin && (
        <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <p className="text-sm font-semibold text-primary">
              Modo Administrador — Edite os valores dos planos diretamente na tabela abaixo.
            </p>
          </div>
          <Button variant="ghost" size="sm" className="gap-1" onClick={carregarPlanos}>
            <RotateCcw className="h-4 w-4" /> Atualizar
          </Button>
        </div>
      )}

      {/* Plano atual + uso */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className={`border-2 ${PLAN_COLORS[effectivePlan?.plan_key] || PLAN_COLORS.free}`}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Plano Atual
                </p>
                <h3 className="text-2xl font-bold">{effectivePlan?.plan_name || 'FREE'}</h3>
                <p className="text-sm text-muted-foreground mt-1">{effectivePlan?.description || ''}</p>
              </div>
              <Zap className="h-8 w-8 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Downloads Utilizados
            </p>
            {effectivePlan?.downloads_limit != null ? (
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-primary">{downloadsUsed}</span>
                  <span className="text-lg text-muted-foreground">/ {effectivePlan.downloads_limit}</span>
                </div>
                <div className="mt-3 h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      downloadsUsed >= effectivePlan.downloads_limit ? 'bg-red-500' : 'bg-primary'
                    }`}
                    style={{ width: `${Math.min(100, (downloadsUsed / effectivePlan.downloads_limit) * 100)}%` }}
                  />
                </div>
                {downloadsUsed >= effectivePlan.downloads_limit && (
                  <p className="mt-2 text-xs font-semibold text-red-600">
                    ⚠ Limite de downloads atingido! Faça upgrade do plano.
                  </p>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <TrendingUp className="h-8 w-8 text-emerald-500" />
                <div>
                  <span className="text-2xl font-bold text-emerald-600">Ilimitado</span>
                  <p className="text-sm text-muted-foreground">{downloadsUsed} downloads realizados</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Módulos disponíveis no plano atual */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Módulos SPED Disponíveis no Seu Plano</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SPED_TYPES.map((tipo) => {
              const available = (effectivePlan?.sped_types || []).includes(tipo.key);
              return (
                <div
                  key={tipo.key}
                  className={`rounded-lg border p-4 ${
                    available ? 'border-emerald-300 bg-emerald-50' : 'border-muted bg-muted/30'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <FileText className={`h-5 w-5 ${available ? 'text-emerald-600' : 'text-muted-foreground'}`} />
                    {available ? (
                      <Check className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Lock className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <p className="mt-2 text-sm font-bold">{tipo.label}</p>
                  <p className="text-xs text-muted-foreground">{tipo.desc}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Tabela comparativa de planos (com edição para admin) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Comparativo de Planos SPED</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-3 text-left">Recurso</th>
                  {plans.map((p) => (
                    <th key={p.plan_key} className="p-3 text-center min-w-[140px]">
                      <Badge variant="default" className={PLAN_COLORS[p.plan_key] || PLAN_COLORS.free}>
                        {p.plan_name}
                      </Badge>
                      <p className="mt-1 text-xs font-normal text-muted-foreground">{formatPreco(p.price)}</p>
                      {isAdmin && editando !== p.plan_key && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-1 h-6 gap-1 text-xs"
                          onClick={() => iniciarEdicao(p)}
                        >
                          <Pencil className="h-3 w-3" /> Editar
                        </Button>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="p-3 font-medium">Downloads de arquivos</td>
                  {plans.map((p) => (
                    <td key={p.plan_key} className="p-3 text-center">
                      {editando === p.plan_key ? (
                        <Input
                          type="number"
                          value={form.downloads_limit ?? ''}
                          onChange={(e) => setForm({ ...form, downloads_limit: e.target.value === '' ? null : e.target.value })}
                          placeholder="Ilimitado = vazio"
                          className="h-8 text-center text-xs"
                        />
                      ) : (
                        p.downloads_limit != null ? `${p.downloads_limit} arquivos` : 'Ilimitado'
                      )}
                    </td>
                  ))}
                </tr>
                <tr className="border-b">
                  <td className="p-3 font-medium">Preço (R$)</td>
                  {plans.map((p) => (
                    <td key={p.plan_key} className="p-3 text-center">
                      {editando === p.plan_key ? (
                        <Input
                          type="number"
                          step="0.01"
                          value={form.price}
                          onChange={(e) => setForm({ ...form, price: e.target.value })}
                          className="h-8 text-center text-xs"
                        />
                      ) : (
                        formatPreco(p.price)
                      )}
                    </td>
                  ))}
                </tr>
                {SPED_TYPES.map((tipo) => (
                  <tr key={tipo.key} className="border-b">
                    <td className="p-3 font-medium">{tipo.label}</td>
                    {plans.map((p) => {
                      const has = (p.sped_types || []).includes(tipo.key);
                      const isChecked = editando === p.plan_key && (form.sped_types || []).includes(tipo.key);
                      return (
                        <td key={p.plan_key} className="p-3 text-center">
                          {editando === p.plan_key ? (
                            <div className="flex justify-center">
                              <Checkbox checked={isChecked} onCheckedChange={() => toggleTipo(tipo.key)} />
                            </div>
                          ) : has ? (
                            <Check className="h-4 w-4 text-emerald-600 mx-auto" />
                          ) : (
                            <X className="h-4 w-4 text-muted-foreground mx-auto" />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr className="border-b">
                  <td className="p-3 font-medium">Descrição</td>
                  {plans.map((p) => (
                    <td key={p.plan_key} className="p-3 text-center text-xs text-muted-foreground">
                      {editando === p.plan_key ? (
                        <Input
                          value={form.description || ''}
                          onChange={(e) => setForm({ ...form, description: e.target.value })}
                          className="h-8 text-center text-xs"
                        />
                      ) : (
                        p.description || '—'
                      )}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Botões salvar/cancelar edição */}
          {isAdmin && editando && (
            <div className="mt-4 flex items-center justify-end gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
              <span className="mr-auto text-sm font-semibold text-primary">
                Editando plano: {form.plan_name}
              </span>
              <Button variant="outline" size="sm" onClick={cancelarEdicao} disabled={salvando}>
                Cancelar
              </Button>
              <Button size="sm" className="gap-1" onClick={salvarPlano} disabled={salvando}>
                {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar Alterações
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
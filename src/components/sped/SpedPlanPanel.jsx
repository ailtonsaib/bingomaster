import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, X, Lock, FileText, TrendingUp, Zap } from 'lucide-react';

const SPED_PLANS = [
  {
    key: 'free',
    name: 'FREE',
    price: 'Grátis',
    color: 'bg-slate-100 text-slate-700 border-slate-300',
    badge: 'secondary',
    downloads: 5,
    types: ['FISCAL'],
    description: 'Para testes e pequenas operações'
  },
  {
    key: 'basic',
    name: 'BÁSICO',
    price: 'R$ 49,90',
    color: 'bg-blue-100 text-blue-700 border-blue-300',
    badge: 'default',
    downloads: null,
    types: ['FISCAL'],
    description: 'SPED Fiscal ilimitado'
  },
  {
    key: 'pro',
    name: 'PRO',
    price: 'R$ 99,90',
    color: 'bg-purple-100 text-purple-700 border-purple-300',
    badge: 'default',
    downloads: null,
    types: ['FISCAL', 'CONTRIBUICOES'],
    description: 'SPED Fiscal + Contribuições'
  },
  {
    key: 'max',
    name: 'MAX',
    price: 'R$ 199,90',
    color: 'bg-emerald-100 text-emerald-700 border-emerald-300',
    badge: 'default',
    downloads: null,
    types: ['FISCAL', 'CONTRIBUICOES', 'ECD', 'ECF'],
    description: 'Todos os módulos SPED'
  }
];

const SPED_TYPES = [
  { key: 'FISCAL', label: 'SPED Fiscal', desc: 'ICMS / IPI' },
  { key: 'CONTRIBUICOES', label: 'SPED Contribuições', desc: 'PIS / COFINS' },
  { key: 'ECD', label: 'SPED ECD', desc: 'Escrituração Contábil Digital' },
  { key: 'ECF', label: 'SPED ECF', desc: 'Escrituração Contábil Fiscal' }
];

export default function SpedPlanPanel({ planKey, downloadsUsed }) {
  const currentPlan = SPED_PLANS.find(p => p.key === planKey) || SPED_PLANS[0];
  const isMaxPlan = ['max', 'mega', 'ultra', 'enterprise'].includes(planKey);
  const effectivePlan = isMaxPlan ? SPED_PLANS[3] : currentPlan;

  return (
    <div className="space-y-6">
      {/* Plano atual + uso */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className={`border-2 ${effectivePlan.color}`}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Plano Atual
                </p>
                <h3 className="text-2xl font-bold">{effectivePlan.name}</h3>
                <p className="text-sm text-muted-foreground mt-1">{effectivePlan.description}</p>
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
            {effectivePlan.downloads !== null ? (
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-primary">{downloadsUsed}</span>
                  <span className="text-lg text-muted-foreground">/ {effectivePlan.downloads}</span>
                </div>
                <div className="mt-3 h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      downloadsUsed >= effectivePlan.downloads ? 'bg-red-500' : 'bg-primary'
                    }`}
                    style={{ width: `${Math.min(100, (downloadsUsed / effectivePlan.downloads) * 100)}%` }}
                  />
                </div>
                {downloadsUsed >= effectivePlan.downloads && (
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
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {SPED_TYPES.map((tipo) => {
              const available = effectivePlan.types.includes(tipo.key);
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

      {/* Tabela comparativa de planos */}
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
                  {SPED_PLANS.map((p) => (
                    <th key={p.key} className="p-3 text-center min-w-[120px]">
                      <Badge variant={p.badge} className={p.color}>{p.name}</Badge>
                      <p className="mt-1 text-xs font-normal text-muted-foreground">{p.price}</p>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="p-3 font-medium">Downloads de arquivos</td>
                  <td className="p-3 text-center">5 arquivos</td>
                  <td className="p-3 text-center">Ilimitado</td>
                  <td className="p-3 text-center">Ilimitado</td>
                  <td className="p-3 text-center">Ilimitado</td>
                </tr>
                {SPED_TYPES.map((tipo) => (
                  <tr key={tipo.key} className="border-b">
                    <td className="p-3 font-medium">{tipo.label}</td>
                    {SPED_PLANS.map((p) => {
                      const has = p.types.includes(tipo.key);
                      return (
                        <td key={p.key} className="p-3 text-center">
                          {has ? (
                            <Check className="h-4 w-4 text-emerald-600 mx-auto" />
                          ) : (
                            <X className="h-4 w-4 text-muted-foreground mx-auto" />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
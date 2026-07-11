import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  Check, X, Clock, Ban, Lock, Unlock, Trash2, Calendar, Mail, AlertTriangle, Loader2, RefreshCw, Plus
} from 'lucide-react';

const SPED_PLANS = [
  { key: 'basic', name: 'BÁSICO' },
  { key: 'pro', name: 'PRO' },
  { key: 'max', name: 'MAX' },
];

function formatDateBR(isoStr) {
  if (!isoStr) return '—';
  return new Date(isoStr).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });
}

function daysLeft(expiresAt) {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

const STATUS_CONFIG = {
  active: { label: 'Ativa', badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-300', icon: Check },
  expired: { label: 'Expirada', badgeClass: 'bg-red-100 text-red-700 border-red-300', icon: AlertTriangle },
  blocked: { label: 'Bloqueada', badgeClass: 'bg-slate-200 text-slate-700 border-slate-400', icon: Lock },
};

export default function SpedSubscriptionPanel() {
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ user_email: '', user_name: '', plan_key: 'basic', notes: '' });
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('manageSpedSubscriptions', { action: 'list' });
      if (res.data?.success) setSubs(res.data.subscriptions || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async () => {
    if (!formData.user_email || !formData.plan_key) return;
    setSaving(true);
    try {
      const plan = SPED_PLANS.find(p => p.key === formData.plan_key);
      const res = await base44.functions.invoke('manageSpedSubscriptions', {
        action: 'approve',
        user_email: formData.user_email,
        user_name: formData.user_name,
        plan_key: formData.plan_key,
        plan_name: plan?.name || formData.plan_key.toUpperCase(),
        notes: formData.notes
      });
      if (res.data?.success) {
        alert(res.data.message || 'Assinatura aprovada!');
        setFormData({ user_email: '', user_name: '', plan_key: 'basic', notes: '' });
        setShowForm(false);
        await load();
      } else {
        alert('Erro: ' + (res.data?.error || 'erro desconhecido'));
      }
    } catch (e) {
      alert('Erro: ' + (e.message || ''));
    }
    setSaving(false);
  };

  const handleAction = async (action, sub) => {
    if (action === 'delete' && !confirm(`Excluir assinatura de ${sub.user_email}?`)) return;
    if (action === 'block' && !confirm(`Bloquear acesso de ${sub.user_email}?`)) return;
    try {
      const res = await base44.functions.invoke('manageSpedSubscriptions', {
        action, subscription_id: sub.id
      });
      if (res.data?.success) await load();
      else alert('Erro: ' + (res.data?.error || ''));
    } catch (e) { alert('Erro: ' + e.message); }
  };

  const filtered = subs.filter(s => {
    const t = searchTerm.toLowerCase();
    return !t || (s.user_email || '').toLowerCase().includes(t) || (s.user_name || '').toLowerCase().includes(t);
  });

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold">Controle de Assinaturas SPED</h2>
          <p className="text-sm text-muted-foreground">
            Ao aprovar, o sistema conta 90 dias. 10 dias antes do vencimento, um e-mail é enviado automaticamente. Vencido, o acesso é bloqueado.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1" onClick={load}>
            <RefreshCw className="h-4 w-4" /> Atualizar
          </Button>
          <Button size="sm" className="gap-1" onClick={() => setShowForm(!showForm)}>
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showForm ? 'Cancelar' : 'Aprovar Assinatura'}
          </Button>
        </div>
      </div>

      {/* Approval form */}
      {showForm && (
        <Card className="border-2 border-primary/30 bg-primary/5">
          <CardContent className="p-5">
            <h3 className="font-bold mb-3 flex items-center gap-2"><Check className="h-5 w-5 text-primary" /> Nova Aprovação de Plano</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs font-medium">E-mail do usuário *</Label>
                <Input value={formData.user_email} onChange={e => setFormData({ ...formData, user_email: e.target.value })}
                  placeholder="cliente@email.com" className="h-9" />
              </div>
              <div>
                <Label className="text-xs font-medium">Nome do usuário</Label>
                <Input value={formData.user_name} onChange={e => setFormData({ ...formData, user_name: e.target.value })}
                  placeholder="Nome completo" className="h-9" />
              </div>
              <div>
                <Label className="text-xs font-medium">Plano *</Label>
                <Select value={formData.plan_key} onValueChange={v => setFormData({ ...formData, plan_key: v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SPED_PLANS.map(p => <SelectItem key={p.key} value={p.key}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-medium">Observações</Label>
                <Input value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Opcional" className="h-9" />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button className="gap-2" onClick={handleApprove} disabled={saving || !formData.user_email}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Aprovar (90 dias)
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
          placeholder="Buscar por e-mail ou nome..." className="pl-3" />
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-emerald-200">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Ativas</p>
            <p className="text-2xl font-bold text-emerald-600">{subs.filter(s => s.status === 'active').length}</p>
          </CardContent>
        </Card>
        <Card className="border-amber-200">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Expirando (≤10 dias)</p>
            <p className="text-2xl font-bold text-amber-600">
              {subs.filter(s => s.status === 'active' && daysLeft(s.expires_at) <= 10).length}
            </p>
          </CardContent>
        </Card>
        <Card className="border-red-200">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Expiradas/Bloqueadas</p>
            <p className="text-2xl font-bold text-red-600">
              {subs.filter(s => s.status === 'expired' || s.status === 'blocked').length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          Nenhuma assinatura encontrada. Clique em "Aprovar Assinatura" para começar.
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(sub => {
            const cfg = STATUS_CONFIG[sub.status] || STATUS_CONFIG.active;
            const dl = daysLeft(sub.expires_at);
            const isExpiringSoon = sub.status === 'active' && dl !== null && dl <= 10;
            const isExpired = sub.status === 'expired' || sub.status === 'blocked';
            const StatusIcon = cfg.icon;

            return (
              <Card key={sub.id} className={isExpiringSoon ? 'border-2 border-amber-300' : isExpired ? 'border-2 border-red-200 opacity-80' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-[200px]">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className={cfg.badgeClass}>
                          <StatusIcon className="w-3 h-3 mr-1" /> {cfg.label}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">{sub.plan_name || sub.plan_key?.toUpperCase()}</Badge>
                        {sub.renewal_count > 0 && (
                          <Badge variant="outline" className="text-xs">Renovada {sub.renewal_count}x</Badge>
                        )}
                      </div>
                      <p className="font-semibold text-sm">{sub.user_name || sub.user_email}</p>
                      <p className="text-xs text-muted-foreground">{sub.user_email}</p>
                      {sub.notes && <p className="text-xs text-muted-foreground mt-1">📝 {sub.notes}</p>}
                    </div>

                    <div className="flex gap-4 text-xs">
                      <div>
                        <p className="text-muted-foreground">Aprovado em</p>
                        <p className="font-semibold flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDateBR(sub.approved_at)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Vence em</p>
                        <p className={`font-semibold flex items-center gap-1 ${isExpiringSoon ? 'text-amber-600' : isExpired ? 'text-red-600' : 'text-foreground'}`}>
                          <Clock className="w-3 h-3" />{formatDateBR(sub.expires_at)}
                        </p>
                      </div>
                      {sub.status === 'active' && dl !== null && (
                        <div>
                          <p className="text-muted-foreground">Restam</p>
                          <p className={`font-bold ${dl <= 10 ? 'text-amber-600' : 'text-emerald-600'}`}>{dl} dias</p>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      {sub.notification_sent_at && (
                        <Badge variant="outline" className="text-xs text-blue-600 border-blue-300 bg-blue-50">
                          <Mail className="w-3 h-3 mr-1" /> Aviso enviado
                        </Badge>
                      )}
                      {sub.status === 'active' && (
                        <>
                          <Button size="sm" variant="outline" className="gap-1 h-8"
                            onClick={() => handleAction('approve', sub)}
                            title="Renovar por mais 90 dias">
                            <RefreshCw className="h-3.5 w-3.5" /> Renovar
                          </Button>
                          <Button size="sm" variant="outline" className="gap-1 h-8 text-orange-600 border-orange-300 hover:bg-orange-50"
                            onClick={() => handleAction('block', sub)}
                            title="Bloquear acesso">
                            <Ban className="h-3.5 h-3.5" /> Bloquear
                          </Button>
                        </>
                      )}
                      {sub.status === 'blocked' && (
                        <Button size="sm" variant="outline" className="gap-1 h-8 text-emerald-600 border-emerald-300 hover:bg-emerald-50"
                          onClick={() => handleAction('unblock', sub)}
                          title="Desbloquear">
                          <Unlock className="h-3.5 w-3.5" /> Desbloquear
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500"
                        onClick={() => handleAction('delete', sub)}
                        title="Excluir">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
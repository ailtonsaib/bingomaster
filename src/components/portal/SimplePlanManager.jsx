import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, X, Pencil, Loader2, Lock } from "lucide-react";

export default function SimplePlanManager({ appModule, defaults, featureDefs, icon: Icon, iconColor, title }) {
  const [plans, setPlans] = useState(defaults);
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const saved = await base44.entities.AppPlanConfig.filter({ app_module: appModule });
      if (saved.length === 0) {
        const created = await base44.entities.AppPlanConfig.bulkCreate(
          defaults.map(d => ({ ...d, app_module: appModule }))
        );
        setPlans(created.length ? created : defaults);
      } else {
        const savedMap = Object.fromEntries(saved.map(p => [p.plan_key, p]));
        setPlans(defaults.map(def => {
          const db = savedMap[def.plan_key];
          return db ? { ...def, ...db, features: { ...def.features, ...(db.features || {}) } } : def;
        }));
      }
    } catch (e) { setPlans(defaults); }
    setLoading(false);
  };

  const startEdit = (plan) => {
    setEditingKey(plan.plan_key);
    setForm({
      price: plan.price ?? 0,
      description: plan.description || "",
      features: { ...(plan.features || {}) },
    });
  };

  const toggleFeature = (key) => {
    setForm(f => ({ ...f, features: { ...f.features, [key]: !f.features[key] } }));
  };

  const save = async (plan) => {
    setSaving(true);
    try {
      const updated = {
        price: plan.plan_key === "free" ? 0 : (Number(String(form.price).replace(',', '.')) || 0),
        description: form.description,
        features: Object.fromEntries(featureDefs.map(f => [f.key, !!form.features[f.key]])),
      };
      if (plan.id) {
        await base44.entities.AppPlanConfig.update(plan.id, updated);
      } else {
        const created = await base44.entities.AppPlanConfig.create({ ...plan, ...updated, app_module: appModule });
        plan.id = created.id;
      }
      setPlans(prev => prev.map(p => p.plan_key === plan.plan_key ? { ...p, ...updated } : p));
      setEditingKey(null);
    } catch (e) { alert("Erro ao salvar: " + (e.message || "")); }
    setSaving(false);
  };

  const fmtPrice = (v) => v === 0 || v == null ? "Grátis" : `R$ ${Number(v).toFixed(2).replace(".", ",")}`;

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start gap-3 mb-5">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${iconColor}1a` }}>
            <Icon className="w-5 h-5" style={{ color: iconColor }} />
          </div>
          <div>
            <h3 className="font-bold text-base">{title}</h3>
            <p className="text-sm text-muted-foreground">Configure o preço do plano Gold e os pacotes disponíveis em cada plano. O plano Free é sempre gratuito.</p>
          </div>
        </div>

        <div className="space-y-3">
          {plans.map((plan) => {
            const isEditing = editingKey === plan.plan_key;
            const isFree = plan.plan_key === "free";
            return (
              <div key={plan.plan_key} className={`rounded-xl border p-4 ${isEditing ? "ring-2 ring-primary ring-offset-1" : isFree ? "border-slate-200 bg-slate-50/50" : "border-amber-300 bg-amber-50/50"}`}>
                <div className="flex items-start gap-4 flex-wrap">
                  <Badge className={`border-0 font-bold text-sm px-3 py-1 ${isFree ? "bg-slate-200 text-slate-700" : "bg-amber-200 text-amber-800"}`}>
                    {isFree && <Lock className="w-3 h-3 mr-1" />}{plan.plan_name}
                  </Badge>

                  {isEditing ? (
                    <div className="flex flex-1 flex-wrap gap-3 items-end">
                      <div className="flex flex-col gap-1 min-w-[120px]">
                        <label className="text-xs font-medium text-muted-foreground">Preço (R$)</label>
                        <Input type="text" inputMode="decimal" value={isFree ? "0" : form.price} disabled={isFree}
                          onChange={e => setForm(f => ({ ...f, price: e.target.value }))} className="h-8 text-sm" />
                      </div>
                      <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
                        <label className="text-xs font-medium text-muted-foreground">Descrição</label>
                        <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="h-8 text-sm" />
                      </div>
                      <div className="flex flex-col gap-1 min-w-full">
                        <label className="text-xs font-medium text-muted-foreground">Pacotes disponíveis</label>
                        <div className="flex flex-wrap gap-3 mt-1">
                          {featureDefs.map(f => (
                            <label key={f.key} className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                              <input type="checkbox" checked={!!form.features[f.key]} onChange={() => toggleFeature(f.key)} className="w-3.5 h-3.5 accent-primary" />
                              <span>{f.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" className="h-8 gap-1.5" onClick={() => save(plan)} disabled={saving}>
                          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Salvar
                        </Button>
                        <Button size="sm" variant="outline" className="h-8" onClick={() => setEditingKey(null)}><X className="w-3.5 h-3.5" /></Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-1 flex-wrap gap-6 items-center justify-between">
                      <div className="flex gap-6 flex-wrap">
                        <div>
                          <p className="text-xs text-muted-foreground">Preço</p>
                          <p className="text-base font-bold">{fmtPrice(plan.price)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Descrição</p>
                          <p className="text-sm text-foreground/80">{plan.description || "—"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Pacotes</p>
                          <div className="flex flex-wrap gap-1">
                            {featureDefs.map(f => (
                              <span key={f.key} className={`text-xs px-2 py-0.5 rounded-full border font-medium ${(plan.features || {})[f.key] ? "bg-emerald-50 border-emerald-300 text-emerald-700" : "bg-slate-50 border-slate-200 text-slate-400 line-through"}`}>
                                {f.label}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={() => startEdit(plan)}>
                        <Pencil className="w-3.5 h-3.5" /> Editar
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
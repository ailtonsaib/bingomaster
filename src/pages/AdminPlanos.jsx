import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Save, Pencil, Check, X, Settings, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";

const DEFAULT_PLANS = [
  { plan_key: "free",       plan_name: "FREE",       price: 0,    max_cards: 50,    description: "Para conhecer o sistema" },
  { plan_key: "basic",      plan_name: "BASIC",      price: 400,  max_cards: 2000,  description: "Para pequenos eventos" },
  { plan_key: "pro",        plan_name: "PRO",        price: 700,  max_cards: 4000,  description: "Para eventos frequentes" },
  { plan_key: "max",        plan_name: "MAX",        price: 900,  max_cards: 8000,  description: "Para grandes eventos" },
  { plan_key: "ultra",      plan_name: "ULTRA",      price: 1100, max_cards: 12000, description: "Para eventos de grande porte" },
  { plan_key: "enterprise", plan_name: "ENTERPRISE", price: 1500, max_cards: 15000, description: "Para empresas e operações maiores" },
  { plan_key: "mega",       plan_name: "MEGA",       price: 2500, max_cards: 50000, description: "Para operações de larga escala" },
];

const BADGE_COLORS = {
  free:       "bg-slate-100 text-slate-700",
  basic:      "bg-blue-100 text-blue-700",
  pro:        "bg-violet-100 text-violet-700",
  max:        "bg-emerald-100 text-emerald-700",
  ultra:      "bg-pink-100 text-pink-700",
  enterprise: "bg-orange-100 text-orange-700",
  mega:       "bg-violet-200 text-violet-900",
};

export default function AdminPlanos() {
  const { toast } = useToast();
  const [plans, setPlans] = useState([]);
  const [editing, setEditing] = useState(null); // plan_key being edited
  const [editValues, setEditValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    setLoading(true);
    const saved = await base44.entities.PlanConfig.list();
    if (saved.length === 0) {
      // Seed defaults on first access
      const created = await base44.entities.PlanConfig.bulkCreate(DEFAULT_PLANS);
      setPlans(created.length ? created : DEFAULT_PLANS.map((p, i) => ({ ...p, id: String(i) })));
    } else {
      // Merge: ensure all default keys exist
      const savedMap = Object.fromEntries(saved.map(p => [p.plan_key, p]));
      const merged = DEFAULT_PLANS.map(def => savedMap[def.plan_key] || def);
      setPlans(merged);
    }
    setLoading(false);
  };

  const startEdit = (plan) => {
    setEditing(plan.plan_key);
    setEditValues({ price: plan.price ?? 0, max_cards: plan.max_cards, description: plan.description || "" });
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditValues({});
  };

  const saveEdit = async (plan) => {
    setSaving(true);
    const updated = {
      price: Number(editValues.price),
      max_cards: Number(editValues.max_cards),
      description: editValues.description,
    };
    if (plan.id) {
      await base44.entities.PlanConfig.update(plan.id, updated);
      setPlans(prev => prev.map(p => p.plan_key === plan.plan_key ? { ...p, ...updated } : p));
    } else {
      const created = await base44.entities.PlanConfig.create({ ...plan, ...updated });
      setPlans(prev => prev.map(p => p.plan_key === plan.plan_key ? { ...p, ...updated, id: created.id } : p));
    }
    setSaving(false);
    setEditing(null);
    toast({ title: "Salvo!", description: `Plano ${plan.plan_name} atualizado com sucesso.` });
  };

  const formatPrice = (val) => {
    if (!val || val === 0) return "Gratuito";
    return Number(val).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link to="/info-planos" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>

        <div className="mb-4 flex justify-end">
          <Link to="/admin-solicitacoes">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Clock className="w-4 h-4" /> Ver Solicitações
            </Button>
          </Link>
        </div>
        <div className="mb-8 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Settings className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-heading">Administração de Planos</h1>
            <p className="text-sm text-muted-foreground">Altere preços e limite de cartelas de cada plano</p>
          </div>
        </div>

        <div className="space-y-3">
          {plans.map((plan) => {
            const isEditing = editing === plan.plan_key;
            const badgeClass = BADGE_COLORS[plan.plan_key] || "bg-slate-100 text-slate-700";

            return (
              <Card key={plan.plan_key} className={`transition-all ${isEditing ? "ring-2 ring-primary ring-offset-1" : ""}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4 flex-wrap">
                    {/* Plan badge */}
                    <div className="flex items-center gap-2 min-w-[120px]">
                      <Badge className={`${badgeClass} border-0 font-bold text-sm px-3 py-1`}>
                        {plan.plan_name}
                      </Badge>
                    </div>

                    {isEditing ? (
                      /* ── EDIT MODE ── */
                      <div className="flex flex-1 flex-wrap gap-3 items-end">
                        <div className="flex flex-col gap-1 min-w-[140px]">
                          <label className="text-xs font-medium text-muted-foreground">Preço (R$)</label>
                          <Input
                            type="number"
                            min="0"
                            value={editValues.price}
                            onChange={e => setEditValues(v => ({ ...v, price: e.target.value }))}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="flex flex-col gap-1 min-w-[160px]">
                          <label className="text-xs font-medium text-muted-foreground">Máx. Cartelas</label>
                          <Input
                            type="number"
                            min="1"
                            value={editValues.max_cards}
                            onChange={e => setEditValues(v => ({ ...v, max_cards: e.target.value }))}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
                          <label className="text-xs font-medium text-muted-foreground">Descrição</label>
                          <Input
                            value={editValues.description}
                            onChange={e => setEditValues(v => ({ ...v, description: e.target.value }))}
                            className="h-8 text-sm"
                            placeholder="Descrição curta..."
                          />
                        </div>
                        <div className="flex gap-2 pb-0.5">
                          <Button
                            size="sm"
                            className="h-8 gap-1.5"
                            onClick={() => saveEdit(plan)}
                            disabled={saving}
                          >
                            {saving ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            Salvar
                          </Button>
                          <Button size="sm" variant="outline" className="h-8" onClick={cancelEdit}>
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      /* ── VIEW MODE ── */
                      <div className="flex flex-1 flex-wrap gap-6 items-center justify-between">
                        <div className="flex gap-8 flex-wrap">
                          <div>
                            <p className="text-xs text-muted-foreground">Preço</p>
                            <p className="text-base font-bold">{formatPrice(plan.price)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Máx. Cartelas</p>
                            <p className="text-base font-bold">{Number(plan.max_cards).toLocaleString("pt-BR")}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Descrição</p>
                            <p className="text-sm text-foreground/80">{plan.description || "—"}</p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 shrink-0"
                          onClick={() => startEdit(plan)}
                        >
                          <Pencil className="w-3.5 h-3.5" /> Editar
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
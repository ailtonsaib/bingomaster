import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Check, X, Save, Pencil, RotateCcw, Loader2, Grid3x3, FileText, Wallet, DollarSign, LifeBuoy } from "lucide-react";
import TicketPlanManagement from "@/components/portal/TicketPlanManagement";

const BINGO_DEFAULTS = [
  { plan_key: "free", plan_name: "FREE", price: 0, max_cards: 50, description: "Para conhecer o sistema", app_generator: true, app_seller: false, app_buyer: false, app_telao: false, app_rifa: false },
  { plan_key: "basic", plan_name: "BASIC", price: 400, max_cards: 2000, description: "Para pequenos eventos", app_generator: true, app_seller: true, app_buyer: false, app_telao: false, app_rifa: true },
  { plan_key: "pro", plan_name: "PRO", price: 700, max_cards: 4000, description: "Para eventos frequentes", app_generator: true, app_seller: true, app_buyer: false, app_telao: true, app_rifa: true },
  { plan_key: "max", plan_name: "MAX", price: 900, max_cards: 8000, description: "Para grandes eventos", app_generator: true, app_seller: true, app_buyer: true, app_telao: true, app_rifa: true },
  { plan_key: "ultra", plan_name: "ULTRA", price: 1100, max_cards: 12000, description: "Para eventos de grande porte", app_generator: true, app_seller: true, app_buyer: true, app_telao: true, app_rifa: true },
  { plan_key: "enterprise", plan_name: "ENTERPRISE", price: 1500, max_cards: 15000, description: "Para empresas e operações maiores", app_generator: true, app_seller: true, app_buyer: true, app_telao: true, app_rifa: true },
  { plan_key: "mega", plan_name: "MEGA", price: 2500, max_cards: 50000, description: "Para operações de larga escala", app_generator: true, app_seller: true, app_buyer: true, app_telao: true, app_rifa: true },
];

const BINGO_APPS = [
  { key: "app_generator", label: "Gerador" },
  { key: "app_seller", label: "Vendedor" },
  { key: "app_buyer", label: "Comprador" },
  { key: "app_telao", label: "Telão" },
  { key: "app_rifa", label: "Rifas" },
];

const SPED_TYPES = [
  { key: "FISCAL", label: "Fiscal", desc: "ICMS / IPI" },
  { key: "CONTRIBUICOES", label: "Contribuições", desc: "PIS / COFINS" },
  { key: "ECD", label: "ECD", desc: "Escrituração Contábil" },
  { key: "ECF", label: "ECF", desc: "Escrituração Fiscal" },
  { key: "DIMESC", label: "DIME-SC", desc: "ICMS Santa Catarina" },
  { key: "REINF", label: "REINF", desc: "Retenções" },
];

const SPED_FALLBACK = [
  { plan_key: "free", plan_name: "FREE", price: 0, downloads_limit: 5, sped_types: ["FISCAL"], description: "Para testes", is_active: true, order: 1 },
  { plan_key: "basic", plan_name: "BÁSICO", price: 49.90, downloads_limit: null, sped_types: ["FISCAL"], description: "SPED Fiscal ilimitado", is_active: true, order: 2 },
  { plan_key: "pro", plan_name: "PRO", price: 99.90, downloads_limit: null, sped_types: ["FISCAL", "CONTRIBUICOES"], description: "Fiscal + Contribuições", is_active: true, order: 3 },
  { plan_key: "max", plan_name: "MAX", price: 199.90, downloads_limit: null, sped_types: ["FISCAL", "CONTRIBUICOES", "ECD", "ECF", "DIMESC", "REINF"], description: "Todos os módulos", is_active: true, order: 4 },
];

const BINGO_BADGE = {
  free: "bg-slate-100 text-slate-700",
  basic: "bg-blue-100 text-blue-700",
  pro: "bg-violet-100 text-violet-700",
  max: "bg-emerald-100 text-emerald-700",
  ultra: "bg-pink-100 text-pink-700",
  enterprise: "bg-orange-100 text-orange-700",
  mega: "bg-violet-200 text-violet-900",
};

const SPED_BADGE = {
  free: "bg-slate-100 text-slate-700",
  basic: "bg-blue-100 text-blue-700",
  pro: "bg-purple-100 text-purple-700",
  max: "bg-emerald-100 text-emerald-700",
};

export default function PlanManagement() {
  const [section, setSection] = useState("bingo");
  const [bingoPlans, setBingoPlans] = useState([]);
  const [spedPlans, setSpedPlans] = useState(SPED_FALLBACK);
  const [loadingBingo, setLoadingBingo] = useState(true);
  const [loadingSped, setLoadingSped] = useState(true);
  const [editingBingo, setEditingBingo] = useState(null);
  const [bingoForm, setBingoForm] = useState({});
  const [savingBingo, setSavingBingo] = useState(false);
  const [editingSped, setEditingSped] = useState(null);
  const [spedForm, setSpedForm] = useState({});
  const [savingSped, setSavingSped] = useState(false);

  useEffect(() => {
    loadBingoPlans();
    loadSpedPlans();
  }, []);

  const loadBingoPlans = async () => {
    try {
      const saved = await base44.entities.PlanConfig.list();
      if (saved.length === 0) {
        const created = await base44.entities.PlanConfig.bulkCreate(BINGO_DEFAULTS);
        setBingoPlans(created.length ? created : BINGO_DEFAULTS);
      } else {
        const savedMap = Object.fromEntries(saved.map(p => [p.plan_key, p]));
        setBingoPlans(BINGO_DEFAULTS.map(def => savedMap[def.plan_key] || def));
      }
    } catch (e) { setBingoPlans(BINGO_DEFAULTS); }
    setLoadingBingo(false);
  };

  const loadSpedPlans = async () => {
    try {
      const res = await base44.functions.invoke("manageSpedPlans", { action: "list" });
      if (res.data?.success && res.data.plans?.length > 0) setSpedPlans(res.data.plans);
    } catch (e) { /* keep fallback */ }
    setLoadingSped(false);
  };

  const startBingoEdit = (plan) => {
    setEditingBingo(plan.plan_key);
    setBingoForm({
      price: plan.price ?? 0,
      max_cards: plan.max_cards,
      description: plan.description || "",
      app_generator: plan.app_generator ?? true,
      app_seller: plan.app_seller ?? false,
      app_buyer: plan.app_buyer ?? false,
      app_telao: plan.app_telao ?? false,
      app_rifa: plan.app_rifa ?? false,
    });
  };

  const saveBingoPlan = async (plan) => {
    setSavingBingo(true);
    try {
      const updated = {
        price: Number(String(bingoForm.price).replace(',', '.')) || 0,
        max_cards: Number(String(bingoForm.max_cards).replace('.', '')) || 0,
        description: bingoForm.description,
        app_generator: !!bingoForm.app_generator,
        app_seller: !!bingoForm.app_seller,
        app_buyer: !!bingoForm.app_buyer,
        app_telao: !!bingoForm.app_telao,
        app_rifa: !!bingoForm.app_rifa,
      };
      if (plan.id) {
        await base44.entities.PlanConfig.update(plan.id, updated);
        setBingoPlans(prev => prev.map(p => p.plan_key === plan.plan_key ? { ...p, ...updated } : p));
      } else {
        const created = await base44.entities.PlanConfig.create({ ...plan, ...updated });
        setBingoPlans(prev => prev.map(p => p.plan_key === plan.plan_key ? { ...p, ...updated, id: created.id } : p));
      }
      setEditingBingo(null);
    } catch (e) { alert("Erro ao salvar plano: " + (e.message || "")); }
    setSavingBingo(false);
  };

  const startSpedEdit = (plan) => {
    setEditingSped(plan.plan_key);
    setSpedForm({
      plan_key: plan.plan_key,
      plan_name: plan.plan_name,
      price: plan.price ?? 0,
      downloads_limit: plan.downloads_limit ?? "",
      sped_types: plan.sped_types || [],
      description: plan.description || "",
      is_active: plan.is_active !== false,
    });
  };

  const toggleSpedType = (tipo) => {
    const atual = spedForm.sped_types || [];
    setSpedForm({ ...spedForm, sped_types: atual.includes(tipo) ? atual.filter(t => t !== tipo) : [...atual, tipo] });
  };

  const saveSpedPlan = async () => {
    setSavingSped(true);
    try {
      const payload = {
        ...spedForm,
        action: "save",
        price: Number(String(spedForm.price).replace(',', '.')) || 0,
        downloads_limit: spedForm.downloads_limit === "" || spedForm.downloads_limit === null ? null : Number(String(spedForm.downloads_limit).replace('.', '')) || null,
      };
      const res = await base44.functions.invoke("manageSpedPlans", payload);
      if (res.data && !res.data.success) { alert("Erro: " + (res.data.error || "")); return; }
      await loadSpedPlans();
      setEditingSped(null);
    } catch (e) { alert("Erro: " + (e.message || "")); }
    setSavingSped(false);
  };

  const fmtPrice = (v) => v === 0 || v == null ? "Grátis" : `R$ ${Number(v).toFixed(2).replace(".", ",")}`;

  return (
    <div className="space-y-6">
      {/* Sub-section tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setSection("bingo")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${section === "bingo" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          <Grid3x3 className="w-4 h-4" /> Planos Bingo
        </button>
        <button
          onClick={() => setSection("sped")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${section === "sped" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          <FileText className="w-4 h-4" /> Planos SPED
        </button>
        <button
          onClick={() => setSection("finance")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${section === "finance" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          <Wallet className="w-4 h-4" /> Planos Finance
        </button>
        <button
          onClick={() => setSection("chamados")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${section === "chamados" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          <LifeBuoy className="w-4 h-4" /> Planos Chamados
        </button>
      </div>

      {/* BINGO PLANS */}
      {section === "bingo" && (
        loadingBingo ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-3">
            {bingoPlans.map((plan) => {
              const isEditing = editingBingo === plan.plan_key;
              return (
                <Card key={plan.plan_key} className={isEditing ? "ring-2 ring-primary ring-offset-1" : ""}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4 flex-wrap">
                      <Badge className={`${BINGO_BADGE[plan.plan_key] || "bg-slate-100 text-slate-700"} border-0 font-bold text-sm px-3 py-1`}>
                        {plan.plan_name}
                      </Badge>

                      {isEditing ? (
                        <div className="flex flex-1 flex-wrap gap-3 items-end">
                          <div className="flex flex-col gap-1 min-w-[120px]">
                            <label className="text-xs font-medium text-muted-foreground">Preço (R$)</label>
                            <Input type="text" inputMode="decimal" value={bingoForm.price} onChange={e => setBingoForm(v => ({ ...v, price: e.target.value }))} className="h-8 text-sm" />
                          </div>
                          <div className="flex flex-col gap-1 min-w-[140px]">
                            <label className="text-xs font-medium text-muted-foreground">Máx. Cartelas</label>
                            <Input type="text" inputMode="numeric" value={bingoForm.max_cards} onChange={e => setBingoForm(v => ({ ...v, max_cards: e.target.value }))} className="h-8 text-sm" />
                          </div>
                          <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
                            <label className="text-xs font-medium text-muted-foreground">Descrição</label>
                            <Input value={bingoForm.description} onChange={e => setBingoForm(v => ({ ...v, description: e.target.value }))} className="h-8 text-sm" />
                          </div>
                          <div className="flex flex-col gap-1 min-w-full">
                            <label className="text-xs font-medium text-muted-foreground">Aplicativos</label>
                            <div className="flex flex-wrap gap-3 mt-1">
                              {BINGO_APPS.map(app => (
                                <label key={app.key} className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                                  <input type="checkbox" checked={!!bingoForm[app.key]} onChange={e => setBingoForm(v => ({ ...v, [app.key]: e.target.checked }))} className="w-3.5 h-3.5 accent-primary" />
                                  <span>{app.label}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" className="h-8 gap-1.5" onClick={() => saveBingoPlan(plan)} disabled={savingBingo}>
                              {savingBingo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Salvar
                            </Button>
                            <Button size="sm" variant="outline" className="h-8" onClick={() => setEditingBingo(null)}><X className="w-3.5 h-3.5" /></Button>
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
                              <p className="text-xs text-muted-foreground">Cartelas</p>
                              <p className="text-base font-bold">{Number(plan.max_cards).toLocaleString("pt-BR")}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Descrição</p>
                              <p className="text-sm text-foreground/80">{plan.description || "—"}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Apps</p>
                              <div className="flex flex-wrap gap-1">
                                {BINGO_APPS.map(app => (
                                  <span key={app.key} className={`text-xs px-2 py-0.5 rounded-full border font-medium ${plan[app.key] ? "bg-emerald-50 border-emerald-300 text-emerald-700" : "bg-slate-50 border-slate-200 text-slate-400 line-through"}`}>
                                    {app.label}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                          <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={() => startBingoEdit(plan)}>
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
        )
      )}

      {/* SPED PLANS */}
      {section === "sped" && (
        loadingSped ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="flex items-center justify-between p-3 border-b">
                <p className="text-sm font-semibold">Comparativo de Planos SPED</p>
                <Button variant="ghost" size="sm" className="gap-1" onClick={loadSpedPlans}><RotateCcw className="w-4 h-4" /> Atualizar</Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-3 text-left font-medium">Recurso</th>
                      {spedPlans.map(p => (
                        <th key={p.plan_key} className="p-3 text-center min-w-[140px]">
                          <Badge className={SPED_BADGE[p.plan_key] || SPED_BADGE.free}>{p.plan_name}</Badge>
                          <p className="mt-1 text-xs font-normal text-muted-foreground">{fmtPrice(p.price)}</p>
                          {editingSped !== p.plan_key && (
                            <Button variant="ghost" size="sm" className="mt-1 h-6 gap-1 text-xs" onClick={() => startSpedEdit(p)}>
                              <Pencil className="h-3 w-3" /> Editar
                            </Button>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="p-3 font-medium">Downloads</td>
                      {spedPlans.map(p => (
                        <td key={p.plan_key} className="p-3 text-center">
                          {editingSped === p.plan_key ? (
                            <Input type="text" inputMode="numeric" value={spedForm.downloads_limit ?? ""} onChange={e => setSpedForm({ ...spedForm, downloads_limit: e.target.value === "" ? null : e.target.value })} placeholder="Vazio = ilimitado" className="h-8 text-center text-xs" />
                          ) : p.downloads_limit != null ? `${p.downloads_limit} arquivos` : "Ilimitado"}
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b">
                      <td className="p-3 font-medium">Preço (R$)</td>
                      {spedPlans.map(p => (
                        <td key={p.plan_key} className="p-3 text-center">
                          {editingSped === p.plan_key ? (
                            <Input type="text" inputMode="decimal" value={spedForm.price} onChange={e => setSpedForm({ ...spedForm, price: e.target.value })} className="h-8 text-center text-xs" />
                          ) : fmtPrice(p.price)}
                        </td>
                      ))}
                    </tr>
                    {SPED_TYPES.map(tipo => (
                      <tr key={tipo.key} className="border-b">
                        <td className="p-3 font-medium">{tipo.label}<span className="text-xs text-muted-foreground block">{tipo.desc}</span></td>
                        {spedPlans.map(p => {
                          const has = (p.sped_types || []).includes(tipo.key);
                          const isChecked = editingSped === p.plan_key && (spedForm.sped_types || []).includes(tipo.key);
                          return (
                            <td key={p.plan_key} className="p-3 text-center">
                              {editingSped === p.plan_key ? (
                                <div className="flex justify-center"><Checkbox checked={isChecked} onCheckedChange={() => toggleSpedType(tipo.key)} /></div>
                              ) : has ? <Check className="h-4 w-4 text-emerald-600 mx-auto" /> : <X className="h-4 w-4 text-muted-foreground mx-auto" />}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    <tr className="border-b">
                      <td className="p-3 font-medium">Descrição</td>
                      {spedPlans.map(p => (
                        <td key={p.plan_key} className="p-3 text-center text-xs text-muted-foreground">
                          {editingSped === p.plan_key ? (
                            <Input value={spedForm.description || ""} onChange={e => setSpedForm({ ...spedForm, description: e.target.value })} className="h-8 text-center text-xs" />
                          ) : p.description || "—"}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
              {editingSped && (
                <div className="mt-4 flex items-center justify-end gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 m-3">
                  <span className="mr-auto text-sm font-semibold text-primary">Editando: {spedForm.plan_name}</span>
                  <Button variant="outline" size="sm" onClick={() => setEditingSped(null)} disabled={savingSped}>Cancelar</Button>
                  <Button size="sm" className="gap-1" onClick={saveSpedPlan} disabled={savingSped}>
                    {savingSped ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )
      )}

      {/* FINANCE PLANS */}
      {section === "finance" && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="font-bold text-base">Plano Financeiro</h3>
                <p className="text-sm text-muted-foreground">O valor do plano financeiro é configurado individualmente por usuário na aba "Usuários".</p>
              </div>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-amber-600" />
              <p className="text-sm text-amber-700">Cada usuário tem seu próprio <strong>finance_plan_price</strong> (padrão R$ 49,90). Ajuste o valor diretamente na linha do usuário na aba Usuários.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* CHAMADOS PLANS */}
      {section === "chamados" && (
        <TicketPlanManagement />
      )}
    </div>
  );
}
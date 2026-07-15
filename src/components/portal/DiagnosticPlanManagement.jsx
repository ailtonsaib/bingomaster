import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, Wrench } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function DiagnosticPlanManagement() {
  const { toast } = useToast();
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);

  const loadConfigs = async () => {
    try {
      const res = await base44.functions.invoke("manageDiagnostic", { operation: "getPlanConfigs" });
      setConfigs(res.data.configs || []);
    } catch (err) {
      toast({ title: "Erro", description: "Não foi possível carregar os planos.", variant: "destructive" });
    }
    setLoading(false);
  };

  useEffect(() => { loadConfigs(); }, []);

  const handleField = (id, field, value) => {
    setConfigs((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
  };

  const handleSave = async (config) => {
    setSaving(config.id);
    try {
      await base44.functions.invoke("manageDiagnostic", {
        operation: "savePlanConfig",
        plan_id: config.plan_id,
        plan_name: config.plan_name,
        price: Number(config.price),
        max_diagnostics: Number(config.max_diagnostics),
        max_clients: Number(config.max_clients),
        max_vehicles: Number(config.max_vehicles),
        can_delete: config.can_delete,
        is_active: config.is_active,
        id: config.id,
      });
      toast({ title: "Plano atualizado", description: `${config.plan_name} salvo com sucesso.` });
    } catch (err) {
      toast({ title: "Erro", description: "Não foi possível salvar o plano.", variant: "destructive" });
    }
    setSaving(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Wrench className="w-5 h-5 text-blue-600" />
        <h3 className="text-lg font-bold">Planos — Diagnóstico Automotivo</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {configs.map((config) => (
          <Card key={config.id}>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant={config.plan_id === "master" ? "default" : "secondary"}>
                    {config.plan_name}
                  </Badge>
                  <span className="text-xs text-muted-foreground">ID: {config.plan_id}</span>
                </div>
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.is_active}
                    onChange={(e) => handleField(config.id, "is_active", e.target.checked)}
                    className="w-3.5 h-3.5"
                  />
                  <span>Ativo</span>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs mb-1 block">Nome de exibição</Label>
                  <Input
                    value={config.plan_name}
                    onChange={(e) => handleField(config.id, "plan_name", e.target.value)}
                    className="h-9"
                  />
                </div>
                <div>
                  <Label className="text-xs mb-1 block">Preço (R$ / mês)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={config.price}
                    onChange={(e) => handleField(config.id, "price", e.target.value)}
                    className="h-9"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs mb-1 block">Máx. Diagnósticos</Label>
                  <Input
                    type="number"
                    value={config.max_diagnostics}
                    onChange={(e) => handleField(config.id, "max_diagnostics", e.target.value)}
                    className="h-9"
                    placeholder="-1 = ilimitado"
                  />
                </div>
                <div>
                  <Label className="text-xs mb-1 block">Máx. Clientes</Label>
                  <Input
                    type="number"
                    value={config.max_clients}
                    onChange={(e) => handleField(config.id, "max_clients", e.target.value)}
                    className="h-9"
                    placeholder="-1 = ilimitado"
                  />
                </div>
                <div>
                  <Label className="text-xs mb-1 block">Máx. Veículos</Label>
                  <Input
                    type="number"
                    value={config.max_vehicles}
                    onChange={(e) => handleField(config.id, "max_vehicles", e.target.value)}
                    className="h-9"
                    placeholder="-1 = ilimitado"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.can_delete}
                    onChange={(e) => handleField(config.id, "can_delete", e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span>Permitir excluir clientes/veículos</span>
                </label>
                <Button
                  size="sm"
                  onClick={() => handleSave(config)}
                  disabled={saving === config.id}
                  className="gap-1"
                >
                  {saving === config.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Salvar
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                {config.max_diagnostics < 0 ? "Diagnósticos ilimitados" : `${config.max_diagnostics} diagnósticos`}
                {" • "}
                {config.max_clients < 0 ? "Clientes ilimitados" : `${config.max_clients} clientes`}
                {" • "}
                {config.max_vehicles < 0 ? "Veículos ilimitados" : `${config.max_vehicles} veículos`}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
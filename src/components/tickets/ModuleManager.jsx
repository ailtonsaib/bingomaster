import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Loader2, Boxes, Layers } from "lucide-react";

// ─── MODULE MANAGER ───
export function ModuleManager() {
  const [modules, setModules] = useState([]);
  const [submodules, setSubmodules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [moduleName, setModuleName] = useState("");
  const [moduleDesc, setModuleDesc] = useState("");
  const [subName, setSubName] = useState("");
  const [subModuleId, setSubModuleId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [mRes, sRes] = await Promise.all([
        base44.functions.invoke('ticketSystem', { operation: 'getModules' }),
        base44.functions.invoke('ticketSystem', { operation: 'getSubModules' }),
      ]);
      setModules(mRes.data.modules || []);
      setSubmodules(sRes.data.submodules || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreateModule = async () => {
    if (!moduleName) return;
    await base44.functions.invoke('ticketSystem', { operation: 'createModule', name: moduleName, description: moduleDesc });
    setModuleName(""); setModuleDesc("");
    await load();
  };

  const handleDeleteModule = async (id) => {
    if (!confirm("Excluir módulo? Sub-módulos vinculados também serão removidos.")) return;
    await base44.functions.invoke('ticketSystem', { operation: 'deleteModule', module_id: id });
    await load();
  };

  const handleCreateSub = async () => {
    if (!subName || !subModuleId) return;
    await base44.functions.invoke('ticketSystem', { operation: 'createSubModule', name: subName, module_id: subModuleId });
    setSubName(""); setSubModuleId("");
    await load();
  };

  const handleDeleteSub = async (id) => {
    if (!confirm("Excluir sub-módulo?")) return;
    await base44.functions.invoke('ticketSystem', { operation: 'deleteSubModule', submodule_id: id });
    await load();
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Módulos */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2"><Boxes className="w-5 h-5 text-primary" /><h3 className="font-semibold">Módulos</h3></div>
          <div className="grid grid-cols-1 gap-2">
            <div><Label>Nome do Módulo *</Label><Input value={moduleName} onChange={(e) => setModuleName(e.target.value)} placeholder="Ex: Financeiro, RH, Vendas" /></div>
            <div><Label>Descrição</Label><Input value={moduleDesc} onChange={(e) => setModuleDesc(e.target.value)} /></div>
          </div>
          <Button onClick={handleCreateModule} className="gap-2"><Plus className="w-4 h-4" /> Adicionar Módulo</Button>
          <div className="space-y-2 pt-2 border-t">
            {modules.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum módulo cadastrado</p>
            ) : modules.map((m) => (
              <div key={m.id} className="flex items-center justify-between bg-muted/30 rounded-lg p-2.5">
                <div><p className="text-sm font-medium">{m.name}</p>{m.description && <p className="text-xs text-muted-foreground">{m.description}</p>}</div>
                <Button variant="ghost" size="icon" onClick={() => handleDeleteModule(m.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Sub-módulos */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2"><Layers className="w-5 h-5 text-primary" /><h3 className="font-semibold">Sub-módulos</h3></div>
          {modules.length === 0 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs text-amber-800">Cadastre pelo menos um módulo antes de adicionar sub-módulos.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-2">
                <div>
                  <Label>Módulo Vinculado *</Label>
                  <select className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={subModuleId} onChange={(e) => setSubModuleId(e.target.value)}>
                    <option value="">Selecione um módulo...</option>
                    {modules.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div><Label>Nome do Sub-módulo *</Label><Input value={subName} onChange={(e) => setSubName(e.target.value)} placeholder="Ex: Contas a Pagar, Folha de Pagamento" /></div>
              </div>
              <Button onClick={handleCreateSub} className="gap-2" disabled={!subModuleId || !subName}><Plus className="w-4 h-4" /> Adicionar Sub-módulo</Button>
              <div className="space-y-2 pt-2 border-t">
                {submodules.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhum sub-módulo cadastrado</p>
                ) : submodules.map((s) => (
                  <div key={s.id} className="flex items-center justify-between bg-muted/30 rounded-lg p-2.5">
                    <div>
                      <p className="text-sm font-medium">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{s.module_name}</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteSub(s.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
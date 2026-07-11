import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Pencil, Building2, Layers, CircleDot, AlertTriangle, ChevronRight } from "lucide-react";

const LEVEL_CONFIG = {
  departamento: { label: "Departamento", icon: Building2, color: "bg-primary/10 text-primary" },
  setor: { label: "Setor", icon: Layers, color: "bg-blue-100 text-blue-700" },
  centro_custo: { label: "Centro de Custo", icon: CircleDot, color: "bg-emerald-100 text-emerald-700" },
};

export default function CostCenterManager({ userEmail }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", code: "", level: "departamento", parent_id: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('portalAuth', {
        operation: 'getCostCenters', email: userEmail,
      });
      setItems(res.data.costCenters || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [userEmail]);

  useEffect(() => { load(); }, [load]);

  const departamentos = items.filter(i => i.level === 'departamento');
  const setores = items.filter(i => i.level === 'setor');

  const startEdit = (item) => {
    setEditing(item.id);
    setError("");
    setForm({ name: item.name, code: item.code || "", level: item.level, parent_id: item.parent_id || "" });
  };

  const startNew = () => {
    setEditing("new");
    setError("");
    setForm({ name: "", code: "", level: "departamento", parent_id: "" });
  };

  const validateForm = () => {
    setError("");
    if (!form.name.trim()) {
      setError("O nome é obrigatório.");
      return false;
    }
    if (form.level === 'setor' && !form.parent_id) {
      setError("Um Setor deve obrigatoriamente estar vinculado a um Departamento. Selecione um departamento pai antes de salvar.");
      return false;
    }
    if (form.level === 'centro_custo' && !form.parent_id) {
      setError("Um Centro de Custo deve obrigatoriamente estar vinculado a um Setor. Selecione um setor pai antes de salvar.");
      return false;
    }
    return true;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setSaving(true);
    try {
      const res = await base44.functions.invoke('portalAuth', {
        operation: 'saveCostCenter',
        email: userEmail,
        id: editing === "new" ? undefined : editing,
        name: form.name,
        code: form.code || undefined,
        level: form.level,
        parent_id: form.parent_id || undefined,
        is_active: true,
      });
      if (res.data?.error) {
        setError(res.data.error);
        setSaving(false);
        return;
      }
      setEditing(null);
      await load();
    } catch (e) {
      setError("Erro ao salvar. Verifique os dados e tente novamente.");
    }
    setSaving(false);
  };

  const handleDelete = async (id, level, name) => {
    const childLevel = level === 'departamento' ? 'setores' : level === 'setor' ? 'centros de custo' : null;
    const hasChildren = childLevel
      ? items.some(i => i.parent_id === id)
      : false;
    const msg = hasChildren
      ? `Excluir "${name}"? Existem ${childLevel} vinculados a este item. Exclua ou revincule os filhos primeiro.`
      : `Excluir "${name}"?`;
    if (!confirm(msg)) return;
    if (hasChildren) return;
    try {
      await base44.functions.invoke('portalAuth', { operation: 'deleteCostCenter', id });
      await load();
    } catch (e) { alert("Erro ao excluir"); }
  };

  const onLevelChange = (level) => {
    setError("");
    setForm({ ...form, level, parent_id: "" });
  };

  const canSave = () => {
    if (!form.name.trim()) return false;
    if (form.level === 'setor' && !form.parent_id) return false;
    if (form.level === 'centro_custo' && !form.parent_id) return false;
    return true;
  };

  if (loading) {
    return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Estrutura de Centros de Custo</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Hierarquia: <span className="font-medium">Departamento</span> → <span className="font-medium">Setor</span> → <span className="font-medium">Centro de Custo</span>
          </p>
        </div>
        <Button className="gap-2" onClick={startNew}><Plus className="w-4 h-4" /> Novo</Button>
      </div>

      {editing && (
        <Card className="ring-2 ring-primary ring-offset-1">
          <CardContent className="p-4">
            <form onSubmit={handleSave} className="space-y-3">
              {error && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>Nome</Label>
                  <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div>
                  <Label>Código (opcional)</Label>
                  <Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>Nível</Label>
                  <select value={form.level} onChange={e => onLevelChange(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm">
                    <option value="departamento">1 - Departamento</option>
                    <option value="setor">2 - Setor</option>
                    <option value="centro_custo">3 - Centro de Custo</option>
                  </select>
                </div>
                {form.level === 'setor' && (
                  <div>
                    <Label>Departamento Pai *</Label>
                    {departamentos.length === 0 ? (
                      <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs">
                        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <span>Nenhum departamento cadastrado. Crie um Departamento primeiro antes de vincular um Setor.</span>
                      </div>
                    ) : (
                      <select value={form.parent_id} onChange={e => setForm({ ...form, parent_id: e.target.value })}
                        className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm" required>
                        <option value="">Selecione o departamento...</option>
                        {departamentos.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    )}
                  </div>
                )}
                {form.level === 'centro_custo' && (
                  <div>
                    <Label>Setor Pai *</Label>
                    {setores.length === 0 ? (
                      <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs">
                        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <span>Nenhum setor cadastrado. Crie um Setor (vinculado a um Departamento) primeiro antes de vincular um Centro de Custo.</span>
                      </div>
                    ) : (
                      <select value={form.parent_id} onChange={e => setForm({ ...form, parent_id: e.target.value })}
                        className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm" required>
                        <option value="">Selecione o setor...</option>
                        {setores.map(s => {
                          const parentDept = departamentos.find(d => d.id === s.parent_id);
                          return <option key={s.id} value={s.id}>{s.name}{parentDept ? ` (${parentDept.name})` : ''}</option>;
                        })}
                      </select>
                    )}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={saving || !canSave()}>{saving ? "Salvando..." : "Salvar"}</Button>
                <Button type="button" variant="outline" onClick={() => { setEditing(null); setError(""); }}>Cancelar</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {items.length === 0 && !editing ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
          <Building2 className="w-10 h-10 mx-auto mb-2 text-muted-foreground/40" />
          Nenhuma estrutura cadastrada. Comece criando um <strong>Departamento</strong> (Nível 1).
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {departamentos.map(depto => {
            const deptoSetores = items.filter(i => i.level === 'setor' && i.parent_id === depto.id);
            return (
              <Card key={depto.id}>
                <CardContent className="p-4">
                  {/* Departamento */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge className={LEVEL_CONFIG.departamento.color + " border-0"}>Nível 1</Badge>
                      <div>
                        <p className="font-semibold">{depto.name}</p>
                        {depto.code && <p className="text-xs text-muted-foreground">Código: {depto.code}</p>}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => startEdit(depto)}><Pencil className="w-4 h-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(depto.id, depto.level, depto.name)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                    </div>
                  </div>
                  {/* Setores */}
                  {deptoSetores.length > 0 && (
                    <div className="ml-6 mt-3 space-y-2 border-l-2 border-primary/20 pl-4">
                      {deptoSetores.map(setor => {
                        const setorCCs = items.filter(i => i.level === 'centro_custo' && i.parent_id === setor.id);
                        return (
                          <div key={setor.id}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                                <Badge className={LEVEL_CONFIG.setor.color + " border-0 text-xs"}>Nível 2</Badge>
                                <span className="text-sm font-medium">{setor.name}</span>
                                {setor.code && <span className="text-xs text-muted-foreground">{setor.code}</span>}
                              </div>
                              <div className="flex gap-1">
                                <Button size="icon" variant="ghost" onClick={() => startEdit(setor)}><Pencil className="w-3.5 h-3.5" /></Button>
                                <Button size="icon" variant="ghost" onClick={() => handleDelete(setor.id, setor.level, setor.name)}><Trash2 className="w-3.5 h-3.5 text-red-500" /></Button>
                              </div>
                            </div>
                            {/* Centros de Custo */}
                            {setorCCs.length > 0 && (
                              <div className="ml-6 mt-1 space-y-1 border-l-2 border-blue-200 pl-4">
                                {setorCCs.map(cc => (
                                  <div key={cc.id} className="flex items-center justify-between py-1">
                                    <div className="flex items-center gap-2">
                                      <ChevronRight className="w-3 h-3 text-muted-foreground" />
                                      <Badge className={LEVEL_CONFIG.centro_custo.color + " border-0 text-xs"}>Nível 3</Badge>
                                      <span className="text-sm">{cc.name}</span>
                                      {cc.code && <span className="text-xs text-muted-foreground">{cc.code}</span>}
                                    </div>
                                    <div className="flex gap-1">
                                      <Button size="icon" variant="ghost" onClick={() => startEdit(cc)}><Pencil className="w-3 h-3" /></Button>
                                      <Button size="icon" variant="ghost" onClick={() => handleDelete(cc.id, cc.level, cc.name)}><Trash2 className="w-3 h-3 text-red-500" /></Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
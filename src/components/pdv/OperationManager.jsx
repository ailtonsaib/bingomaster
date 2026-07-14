import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil, Trash2, Plus, X, Loader2, ArrowDownToLine, ArrowUpFromLine, Search } from "lucide-react";

const EMPTY = {
  name: "", operation_type: "entrada", cfop_default: "", nature_operation: "", description: "", is_active: true,
};

export default function OperationManager({ user }) {
  const [operations, setOperations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await base44.entities.PDVOperation.filter({ user_email: user.email });
      setOperations(list);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [user.email]);

  useEffect(() => { load(); }, [load]);

  const filtered = operations.filter(o =>
    o.name?.toLowerCase().includes(search.toLowerCase()) ||
    o.cfop_default?.includes(search) ||
    o.nature_operation?.toLowerCase().includes(search.toLowerCase())
  );

  const openNew = () => { setForm(EMPTY); setEditing(null); setShowForm(true); };
  const openEdit = (o) => { setForm({ ...EMPTY, ...o }); setEditing(o); setShowForm(true); };

  const save = async () => {
    if (!form.name || !form.operation_type) { alert("Preencha o nome e o tipo de operação!"); return; }
    setSaving(true);
    try {
      const data = { ...form, user_email: user.email };
      if (editing?.id) {
        await base44.entities.PDVOperation.update(editing.id, data);
      } else {
        await base44.entities.PDVOperation.create(data);
      }
      setShowForm(false);
      load();
    } catch (e) { alert("Erro ao salvar: " + e.message); }
    setSaving(false);
  };

  const remove = async (o) => {
    if (!confirm(`Excluir a operação "${o.name}"?`)) return;
    await base44.entities.PDVOperation.delete(o.id);
    load();
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <ArrowDownToLine className="w-5 h-5 text-orange-600" />
          <h2 className="text-lg font-bold">Modelos de Operação</h2>
          <span className="text-sm text-gray-500">({operations.length})</span>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className="pl-9 h-9 w-48" />
          </div>
          <Button onClick={openNew} className="h-9 gap-1.5 bg-orange-600 hover:bg-orange-700">
            <Plus className="w-4 h-4" /> Nova
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-orange-600" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <ArrowDownToLine className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p>Nenhuma operação cadastrada</p>
          <p className="text-xs mt-1">Crie modelos de operação para entrada e saída (CFOP, natureza) para agilizar lançamentos.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(o => (
            <div key={o.id} className="bg-white rounded-lg border p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {o.operation_type === "entrada" ? (
                    <ArrowDownToLine className="w-4 h-4 text-blue-600" />
                  ) : (
                    <ArrowUpFromLine className="w-4 h-4 text-green-600" />
                  )}
                  <div>
                    <h3 className="font-semibold text-sm">{o.name}</h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${o.operation_type === "entrada" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>
                      {o.operation_type === "entrada" ? "Entrada" : "Saída"}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(o)} className="p-1 text-gray-400 hover:text-blue-600">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => remove(o)} className="p-1 text-gray-400 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="text-xs text-gray-500 space-y-0.5">
                {o.nature_operation && <p><b>Natureza:</b> {o.nature_operation}</p>}
                {o.cfop_default && <p><b>CFOP:</b> <span className="font-mono">{o.cfop_default}</span></p>}
                {o.description && <p className="text-gray-400">{o.description}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
              <h3 className="font-bold">{editing ? "Editar Operação" : "Nova Operação"}</h3>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <Label>Nome *</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="h-9" placeholder="Ex: Compra para Comercialização" />
              </div>
              <div>
                <Label>Tipo de Operação *</Label>
                <select value={form.operation_type} onChange={e => setForm({ ...form, operation_type: e.target.value })} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                  <option value="entrada">Entrada</option>
                  <option value="saida">Saída</option>
                </select>
              </div>
              <div>
                <Label>Natureza da Operação</Label>
                <Input value={form.nature_operation} onChange={e => setForm({ ...form, nature_operation: e.target.value })} className="h-9" placeholder="Ex: Venda de mercadoria" />
              </div>
              <div>
                <Label>CFOP Padrão</Label>
                <Input value={form.cfop_default} onChange={e => setForm({ ...form, cfop_default: e.target.value.replace(/\D/g, '').slice(0, 4) })} className="h-9 font-mono" placeholder="Ex: 5102" />
              </div>
              <div>
                <Label>Descrição</Label>
                <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="h-9" placeholder="Observações..." />
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t sticky bottom-0 bg-white">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button onClick={save} disabled={saving} className="bg-orange-600 hover:bg-orange-700 gap-1.5">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Salvar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
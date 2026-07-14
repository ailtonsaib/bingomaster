import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { X, Plus, Pencil, Trash2, Folder, FolderOpen, ChevronDown, ChevronRight, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function CategoryModal({ user, onClose, onSaved }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: "", parent_id: "" });
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const cats = await base44.entities.PDVCategory.filter(
        { user_email: user.email, is_active: true },
        "name",
        200
      );
      setCategories(cats);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  const rootCats = categories.filter(c => !c.parent_id);
  const getSubCats = (parentId) => categories.filter(c => c.parent_id === parentId);

  const toggleExpand = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const parent = form.parent_id ? categories.find(c => c.id === form.parent_id) : null;
      const data = {
        name: form.name.trim(),
        user_email: user.email,
        parent_id: form.parent_id || "",
        parent_name: parent?.name || "",
        is_active: true,
      };
      if (editingId) {
        await base44.entities.PDVCategory.update(editingId, data);
      } else {
        await base44.entities.PDVCategory.create(data);
      }
      setForm({ name: "", parent_id: "" });
      setEditingId(null);
      loadData();
      onSaved?.();
    } catch (e) {
      alert("Erro ao salvar: " + e.message);
    }
    setSaving(false);
  };

  const handleEdit = (cat) => {
    setEditingId(cat.id);
    setForm({ name: cat.name, parent_id: cat.parent_id || "" });
  };

  const handleDelete = async (cat) => {
    const subs = getSubCats(cat.id);
    const msg = subs.length > 0
      ? `Esta categoria possui ${subs.length} sub-categoria(s). Excluir também as sub-categorias?`
      : "Excluir esta categoria?";
    if (!confirm(msg)) return;
    await base44.entities.PDVCategory.update(cat.id, { is_active: false });
    for (const sub of subs) {
      await base44.entities.PDVCategory.update(sub.id, { is_active: false });
    }
    loadData();
    onSaved?.();
  };

  const handleCancel = () => {
    setForm({ name: "", parent_id: "" });
    setEditingId(null);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-orange-100 flex items-center justify-center">
              <Tag className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h2 className="font-bold text-lg">Categorias e Sub-categorias</h2>
              <p className="text-xs text-gray-500">Organize seus produtos em hierarquias</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Form */}
          <form onSubmit={handleSubmit} className="bg-gray-50 rounded-xl p-4 border">
            <div className="flex items-center gap-2 mb-3">
              <Plus className="w-4 h-4 text-orange-600" />
              <span className="text-sm font-semibold">
                {editingId ? "Editar categoria" : "Nova categoria"}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="mb-1 block text-xs text-gray-500">Nome *</Label>
                <Input
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: Enlatados"
                  autoFocus
                />
              </div>
              <div>
                <Label className="mb-1 block text-xs text-gray-500">Categoria pai (opcional)</Label>
                <select
                  value={form.parent_id}
                  onChange={e => setForm({ ...form, parent_id: e.target.value })}
                  className="w-full h-9 rounded-md border border-input bg-white px-3 text-sm"
                >
                  <option value="">— Categoria raiz —</option>
                  {rootCats.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              {editingId && (
                <Button type="button" variant="outline" size="sm" onClick={handleCancel}>
                  Cancelar
                </Button>
              )}
              <Button type="submit" size="sm" style={{ backgroundColor: "#EA580C" }} disabled={saving}>
                {saving ? "Salvando..." : editingId ? "Atualizar" : "Adicionar"}
              </Button>
            </div>
          </form>

          {/* Tree */}
          {loading ? (
            <div className="flex justify-center py-6">
              <div className="w-6 h-6 border-2 border-gray-300 border-t-orange-500 rounded-full animate-spin" />
            </div>
          ) : rootCats.length === 0 ? (
            <div className="text-center py-6 text-gray-400">
              <Folder className="w-10 h-10 mx-auto mb-2" />
              <p className="text-sm">Nenhuma categoria cadastrada</p>
            </div>
          ) : (
            <div className="space-y-1">
              {rootCats.map(cat => {
                const subs = getSubCats(cat.id);
                const isExpanded = expanded[cat.id];
                return (
                  <div key={cat.id}>
                    <div className="flex items-center gap-2 p-2.5 rounded-lg hover:bg-gray-50 group">
                      <button
                        onClick={() => subs.length > 0 && toggleExpand(cat.id)}
                        className="p-0.5 hover:bg-gray-200 rounded"
                      >
                        {subs.length > 0 ? (
                          isExpanded
                            ? <ChevronDown className="w-4 h-4 text-gray-400" />
                            : <ChevronRight className="w-4 h-4 text-gray-400" />
                        ) : (
                          <span className="w-4" />
                        )}
                      </button>
                      {isExpanded && subs.length > 0 ? (
                        <FolderOpen className="w-4 h-4 text-orange-500" />
                      ) : (
                        <Folder className="w-4 h-4 text-orange-500" />
                      )}
                      <span className="flex-1 text-sm font-medium">{cat.name}</span>
                      <button
                        onClick={() => {
                          setForm({ name: "", parent_id: cat.id });
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-orange-100 rounded transition-all"
                        title="Adicionar sub-categoria"
                      >
                        <Plus className="w-3.5 h-3.5 text-orange-600" />
                      </button>
                      <button
                        onClick={() => handleEdit(cat)}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-blue-100 rounded transition-all"
                      >
                        <Pencil className="w-3.5 h-3.5 text-blue-500" />
                      </button>
                      <button
                        onClick={() => handleDelete(cat)}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      </button>
                    </div>
                    {isExpanded && subs.length > 0 && (
                      <div className="ml-8 border-l border-gray-200 pl-2 space-y-0.5">
                        {subs.map(sub => (
                          <div key={sub.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 group">
                            <span className="w-4" />
                            <Tag className="w-3.5 h-3.5 text-gray-400" />
                            <span className="flex-1 text-sm text-gray-600">{sub.name}</span>
                            <button
                              onClick={() => handleEdit(sub)}
                              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-blue-100 rounded transition-all"
                            >
                              <Pencil className="w-3.5 h-3.5 text-blue-500" />
                            </button>
                            <button
                              onClick={() => handleDelete(sub)}
                              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded transition-all"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-500" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex justify-end">
          <Button variant="outline" onClick={onClose}>Concluir</Button>
        </div>
      </div>
    </div>
  );
}
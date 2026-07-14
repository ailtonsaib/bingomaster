import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Trash2, Plus, Loader2, Building2, Search } from "lucide-react";
import SupplierFormModal from "@/components/pdv/SupplierFormModal";

export default function SupplierManager({ user }) {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await base44.entities.PDVSupplier.filter({ user_email: user.email });
      setSuppliers(list);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [user.email]);

  useEffect(() => { load(); }, [load]);

  const filtered = suppliers.filter(s =>
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.cpf_cnpj?.includes(search)
  );

  const openNew = () => { setEditing(null); setShowForm(true); };
  const openEdit = (s) => { setEditing(s); setShowForm(true); };

  const remove = async (s) => {
    if (!confirm(`Excluir fornecedor "${s.name}"?`)) return;
    await base44.entities.PDVSupplier.delete(s.id);
    load();
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-orange-600" />
          <h2 className="text-lg font-bold">Fornecedores</h2>
          <span className="text-sm text-gray-500">({suppliers.length})</span>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className="pl-9 h-9 w-48" />
          </div>
          <Button onClick={openNew} className="h-9 gap-1.5 bg-orange-600 hover:bg-orange-700">
            <Plus className="w-4 h-4" /> Novo
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-orange-600" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Building2 className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p>Nenhum fornecedor cadastrado</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(s => (
            <div key={s.id} className="bg-white rounded-lg border p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-semibold text-sm">{s.name}</h3>
                  <p className="text-xs text-gray-500">{s.cpf_cnpj ? `CNPJ: ${s.cpf_cnpj}` : "Sem CNPJ"}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(s)} className="p-1 text-gray-400 hover:text-blue-600">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => remove(s)} className="p-1 text-gray-400 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="text-xs text-gray-500 space-y-0.5">
                {s.city && <p>📍 {s.city}/{s.uf}</p>}
                {s.phone && <p>📞 {s.phone}</p>}
                {s.email && <p>✉️ {s.email}</p>}
                {s.ie && <p>IE: {s.ie}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <SupplierFormModal
          user={user}
          supplier={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => load()}
        />
      )}
    </div>
  );
}
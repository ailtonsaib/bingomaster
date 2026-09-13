import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Pencil, Trash2, Truck } from "lucide-react";
import { maskCpfCnpj } from "@/lib/brMasks";
import ErpSupplierFormModal from "./ErpSupplierFormModal";

export default function ErpSupplierManager({ user }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    setLoading(true);
    try { setItems(await base44.entities.ErpSupplier.filter({ user_email: user.email }, "-created_date", 500)); }
    catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [user.email]);

  const filtered = items.filter(s => (s.name + " " + (s.cnpj || "") + " " + (s.city || "")).toLowerCase().includes(search.toLowerCase()));

  const handleDelete = async (s) => {
    if (!confirm(`Excluir o fornecedor "${s.name}"?`)) return;
    await base44.entities.ErpSupplier.delete(s.id);
    load();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar fornecedor..." className="pl-9" />
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setShowForm(true); }} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
          <Plus className="w-4 h-4" /> Novo Fornecedor
        </Button>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-gray-500 text-xs">
              <tr>
                <th className="p-2 text-left">Fornecedor</th>
                <th className="p-2 text-left">CNPJ</th>
                <th className="p-2 text-left">Contato</th>
                <th className="p-2 text-left">Cidade/UF</th>
                <th className="p-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="p-6 text-center text-gray-400">Carregando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-gray-400">
                  <Truck className="w-10 h-10 mx-auto mb-2 opacity-30" /> Nenhum fornecedor cadastrado.
                </td></tr>
              ) : filtered.map(s => (
                <tr key={s.id} className="border-t hover:bg-gray-50">
                  <td className="p-2 font-medium">{s.name}</td>
                  <td className="p-2 text-gray-600 font-mono text-xs">{s.cnpj ? maskCpfCnpj(s.cnpj) : "—"}</td>
                  <td className="p-2 text-gray-600">{s.contact_person || "—"} {s.phone ? `• ${s.phone}` : ""}</td>
                  <td className="p-2 text-gray-600">{s.city ? `${s.city}/${s.uf || ""}` : "—"}</td>
                  <td className="p-2 text-right">
                    <button onClick={() => { setEditing(s); setShowForm(true); }} className="p-1 hover:bg-gray-100 rounded"><Pencil className="w-4 h-4 text-gray-500" /></button>
                    <button onClick={() => handleDelete(s)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && <ErpSupplierFormModal user={user} supplier={editing} onClose={() => setShowForm(false)} onSaved={load} />}
    </div>
  );
}
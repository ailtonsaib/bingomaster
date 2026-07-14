import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Trash2, Plus, Loader2, Search, Users, Building2, Briefcase, User } from "lucide-react";
import ContactFormModal from "@/components/pdv/ContactFormModal";

const TYPE_FILTERS = [
  { id: "all", label: "Todos", icon: Users },
  { id: "cliente", label: "Clientes", icon: User },
  { id: "fornecedor", label: "Fornecedores", icon: Building2 },
  { id: "funcionario", label: "Funcionários", icon: Briefcase },
];

export default function ContactManager({ user }) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await base44.entities.PDVContact.filter({ user_email: user.email });
      setContacts(list);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [user.email]);

  useEffect(() => { load(); }, [load]);

  const filtered = contacts.filter(c => {
    const matchesSearch =
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.cpf_cnpj?.includes(search);
    if (!matchesSearch) return false;
    if (typeFilter === "all") return true;
    if (typeFilter === "cliente") return c.is_cliente;
    if (typeFilter === "fornecedor") return c.is_fornecedor;
    if (typeFilter === "funcionario") return c.is_funcionario;
    return true;
  });

  const openNew = () => { setEditing(null); setShowForm(true); };
  const openEdit = (c) => { setEditing(c); setShowForm(true); };

  const remove = async (c) => {
    if (!confirm(`Excluir contato "${c.name}"?`)) return;
    await base44.entities.PDVContact.delete(c.id);
    load();
  };

  const countByType = (type) => {
    if (type === "all") return contacts.length;
    if (type === "cliente") return contacts.filter(c => c.is_cliente).length;
    if (type === "fornecedor") return contacts.filter(c => c.is_fornecedor).length;
    if (type === "funcionario") return contacts.filter(c => c.is_funcionario).length;
    return 0;
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-orange-600" />
          <h2 className="text-lg font-bold">Contatos</h2>
          <span className="text-sm text-gray-500">({contacts.length})</span>
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

      {/* Filtros por tipo */}
      <div className="flex gap-1 flex-wrap">
        {TYPE_FILTERS.map(tf => {
          const Icon = tf.icon;
          return (
            <button
              key={tf.id}
              onClick={() => setTypeFilter(tf.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                typeFilter === tf.id
                  ? "bg-orange-600 text-white"
                  : "bg-white text-gray-600 border border-gray-200 hover:border-orange-300"
              }`}
            >
              <Icon className="w-4 h-4" /> {tf.label}
              <span className={`text-xs px-1.5 rounded ${typeFilter === tf.id ? "bg-orange-700" : "bg-gray-100"}`}>
                {countByType(tf.id)}
              </span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-orange-600" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Users className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p>Nenhum contato cadastrado</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(c => (
            <div key={c.id} className="bg-white rounded-lg border p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-semibold text-sm">{c.name}</h3>
                  <p className="text-xs text-gray-500">{c.cpf_cnpj ? `CPF/CNPJ: ${c.cpf_cnpj}` : "Sem CPF/CNPJ"}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(c)} className="p-1 text-gray-400 hover:text-blue-600">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => remove(c)} className="p-1 text-gray-400 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {/* Badges de tipo */}
              <div className="flex flex-wrap gap-1 mb-2">
                {c.is_cliente && (
                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700">Cliente</span>
                )}
                {c.is_fornecedor && (
                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-700">Fornecedor</span>
                )}
                {c.is_funcionario && (
                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-700">Funcionário</span>
                )}
              </div>
              <div className="text-xs text-gray-500 space-y-0.5">
                {c.is_cliente && c.buyer_type && c.buyer_type !== "consumidor_final" && (
                  <p className="text-amber-600 font-medium">
                    {c.buyer_type === "distribuidor" ? "Distribuidor / Atacadista" : "Revendedor / Varejista"}
                  </p>
                )}
                {c.phone && <p>📞 {c.phone}</p>}
                {c.email && <p>✉️ {c.email}</p>}
                {c.city && <p>📍 {c.city}/{c.uf}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <ContactFormModal
          user={user}
          contact={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => load()}
        />
      )}
    </div>
  );
}
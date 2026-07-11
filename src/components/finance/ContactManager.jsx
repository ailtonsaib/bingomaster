import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Pencil, Users, Search } from "lucide-react";

const TIPO_CONFIG = {
  cliente: { label: "Cliente", color: "bg-blue-100 text-blue-700" },
  fornecedor: { label: "Fornecedor", color: "bg-amber-100 text-amber-700" },
  ambos: { label: "Cliente + Fornecedor", color: "bg-primary/10 text-primary" },
};

export default function ContactManager({ userEmail }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ razao_social: "", nome_fantasia: "", cnpj: "", endereco: "", tipo: "cliente" });
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('portalAuth', {
        operation: 'getContacts', email: userEmail,
      });
      setItems(res.data.contacts || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [userEmail]);

  useEffect(() => { load(); }, [load]);

  const startEdit = (item) => {
    setEditing(item.id);
    setForm({ razao_social: item.razao_social, nome_fantasia: item.nome_fantasia || "", cnpj: item.cnpj || "", endereco: item.endereco || "", tipo: item.tipo });
  };

  const startNew = () => {
    setEditing("new");
    setForm({ razao_social: "", nome_fantasia: "", cnpj: "", endereco: "", tipo: "cliente" });
  };

  const formatCnpj = (value) => {
    const digits = value.replace(/\D/g, "").slice(0, 14);
    return digits
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await base44.functions.invoke('portalAuth', {
        operation: 'saveContact',
        email: userEmail,
        id: editing === "new" ? undefined : editing,
        razao_social: form.razao_social,
        nome_fantasia: form.nome_fantasia || undefined,
        cnpj: form.cnpj.replace(/\D/g, "") || undefined,
        endereco: form.endereco || undefined,
        tipo: form.tipo,
        is_active: true,
      });
      setEditing(null);
      await load();
    } catch (e) { alert("Erro ao salvar"); }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!confirm("Excluir este cadastro?")) return;
    try {
      await base44.functions.invoke('portalAuth', { operation: 'deleteContact', id });
      await load();
    } catch (e) { alert("Erro ao excluir"); }
  };

  const filtered = items.filter(i =>
    !search ||
    i.razao_social?.toLowerCase().includes(search.toLowerCase()) ||
    i.nome_fantasia?.toLowerCase().includes(search.toLowerCase()) ||
    i.cnpj?.includes(search.replace(/\D/g, ""))
  );

  if (loading) {
    return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Clientes & Fornecedores</h2>
        <Button className="gap-2" onClick={startNew}><Plus className="w-4 h-4" /> Novo</Button>
      </div>

      {editing && (
        <Card className="ring-2 ring-primary ring-offset-1">
          <CardContent className="p-4">
            <form onSubmit={handleSave} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>Razão Social *</Label>
                  <Input value={form.razao_social} onChange={e => setForm({ ...form, razao_social: e.target.value })} required />
                </div>
                <div>
                  <Label>Nome Fantasia</Label>
                  <Input value={form.nome_fantasia} onChange={e => setForm({ ...form, nome_fantasia: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>CNPJ</Label>
                  <Input value={formatCnpj(form.cnpj)} onChange={e => setForm({ ...form, cnpj: e.target.value })} placeholder="00.000.000/0000-00" />
                </div>
                <div>
                  <Label>Tipo</Label>
                  <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}
                    className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm">
                    <option value="cliente">Cliente</option>
                    <option value="fornecedor">Fornecedor</option>
                    <option value="ambos">Cliente + Fornecedor</option>
                  </select>
                </div>
              </div>
              <div>
                <Label>Endereço</Label>
                <Input value={form.endereco} onChange={e => setForm({ ...form, endereco: e.target.value })} placeholder="Rua, número, bairro, cidade/UF" />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={saving || !form.razao_social.trim()}>{saving ? "Salvando..." : "Salvar"}</Button>
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {items.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por razão social, fantasia ou CNPJ..." className="pl-9" />
        </div>
      )}

      {filtered.length === 0 && !editing ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
          <Users className="w-10 h-10 mx-auto mb-2 text-muted-foreground/40" />
          {items.length === 0 ? "Nenhum cliente ou fornecedor cadastrado." : "Nenhum resultado para a busca."}
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(item => (
            <Card key={item.id}>
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <Badge className={TIPO_CONFIG[item.tipo]?.color + " border-0 shrink-0"}>{TIPO_CONFIG[item.tipo]?.label}</Badge>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{item.razao_social}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {item.nome_fantasia && `${item.nome_fantasia} · `}
                      {item.cnpj && `${item.cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")} · `}
                      {item.endereco || ""}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" onClick={() => startEdit(item)}><Pencil className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => handleDelete(item.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
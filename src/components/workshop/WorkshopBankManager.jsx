import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Star, Landmark, Loader2, X } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const ACCOUNT_TYPES = {
  conta_corrente: "Conta Corrente",
  conta_poupanca: "Conta Poupança",
};

const DEFAULT_BANKS = [
  { bank_name: "Caixa Econômica Federal", bank_code: "104" },
  { bank_name: "Banco do Brasil", bank_code: "001" },
  { bank_name: "Itaú Unibanco", bank_code: "341" },
  { bank_name: "Bradesco", bank_code: "237" },
  { bank_name: "Santander", bank_code: "033" },
  { bank_name: "Nubank", bank_code: "260" },
  { bank_name: "Inter", bank_code: "077" },
];

export default function WorkshopBankManager({ userEmail }) {
  const { toast } = useToast();
  const [banks, setBanks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    bank_name: "",
    bank_code: "",
    agency: "",
    account: "",
    account_type: "conta_corrente",
    is_default: false,
  });

  const load = useCallback(async () => {
    if (!userEmail) return;
    setLoading(true);
    try {
      const data = await base44.entities.WorkshopBankAccount.filter({ user_email: userEmail });
      setBanks(data);
      // Auto-cria a Caixa como padrão se não houver nenhuma conta
      if (data.length === 0) {
        const caixa = await base44.entities.WorkshopBankAccount.create({
          user_email: userEmail,
          bank_name: "Caixa Econômica Federal",
          bank_code: "104",
          agency: "",
          account: "",
          account_type: "conta_corrente",
          is_default: true,
          is_active: true,
        });
        setBanks([caixa]);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [userEmail]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Se marcando como padrão, desmarca os outros
      if (form.is_default) {
        const others = banks.filter(b => b.is_default && b.id !== editing?.id);
        for (const b of others) {
          await base44.entities.WorkshopBankAccount.update(b.id, { is_default: false });
        }
      }
      if (editing) {
        await base44.entities.WorkshopBankAccount.update(editing.id, form);
        toast({ title: "Conta atualizada" });
      } else {
        await base44.entities.WorkshopBankAccount.create({ ...form, user_email: userEmail });
        toast({ title: "Conta cadastrada" });
      }
      setShowForm(false);
      setEditing(null);
      setForm({ bank_name: "", bank_code: "", agency: "", account: "", account_type: "conta_corrente", is_default: false });
      load();
    } catch {
      toast({ title: "Erro", description: "Não foi possível salvar.", variant: "destructive" });
    }
  };

  const handleEdit = (bank) => {
    setEditing(bank);
    setForm({
      bank_name: bank.bank_name || "",
      bank_code: bank.bank_code || "",
      agency: bank.agency || "",
      account: bank.account || "",
      account_type: bank.account_type || "conta_corrente",
      is_default: bank.is_default || false,
    });
    setShowForm(true);
  };

  const handleDelete = async (bank) => {
    if (!confirm(`Excluir a conta ${bank.bank_name}?`)) return;
    try {
      await base44.entities.WorkshopBankAccount.delete(bank.id);
      toast({ title: "Conta excluída" });
      load();
    } catch {
      toast({ title: "Erro", description: "Não foi possível excluir.", variant: "destructive" });
    }
  };

  const handleSetDefault = async (bank) => {
    try {
      const others = banks.filter(b => b.is_default && b.id !== bank.id);
      for (const b of others) {
        await base44.entities.WorkshopBankAccount.update(b.id, { is_default: false });
      }
      await base44.entities.WorkshopBankAccount.update(bank.id, { is_default: true });
      toast({ title: "Conta padrão definida", description: bank.bank_name });
      load();
    } catch {
      toast({ title: "Erro", variant: "destructive" });
    }
  };

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-blue-600" /></div>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Landmark className="w-4 h-4 text-blue-600" /> Contas Bancárias
        </CardTitle>
        <Button size="sm" onClick={() => { setEditing(null); setForm({ bank_name: "", bank_code: "", agency: "", account: "", account_type: "conta_corrente", is_default: false }); setShowForm(true); }} className="gap-1">
          <Plus className="w-4 h-4" /> Nova Conta
        </Button>
      </CardHeader>
      <CardContent>
        {showForm && (
          <form onSubmit={handleSubmit} className="mb-4 p-4 rounded-lg border bg-muted/20 space-y-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">{editing ? "Editar Conta" : "Nova Conta"}</p>
              <Button type="button" variant="ghost" size="icon" onClick={() => { setShowForm(false); setEditing(null); }}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Banco</Label>
                <select
                  value={form.bank_code}
                  onChange={(e) => {
                    const sel = DEFAULT_BANKS.find(b => b.bank_code === e.target.value);
                    setForm({ ...form, bank_code: e.target.value, bank_name: sel?.bank_name || form.bank_name });
                  }}
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                >
                  <option value="">Selecione...</option>
                  {DEFAULT_BANKS.map(b => <option key={b.bank_code} value={b.bank_code}>{b.bank_code} — {b.bank_name}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs">Ou nome manual</Label>
                <Input value={form.bank_name} onChange={e => setForm({ ...form, bank_name: e.target.value, bank_code: form.bank_code })} placeholder="Nome do banco" />
              </div>
              <div>
                <Label className="text-xs">Agência</Label>
                <Input value={form.agency} onChange={e => setForm({ ...form, agency: e.target.value })} placeholder="Ex: 1234" />
              </div>
              <div>
                <Label className="text-xs">Conta</Label>
                <Input value={form.account} onChange={e => setForm({ ...form, account: e.target.value })} placeholder="Ex: 56789-0" />
              </div>
              <div>
                <Label className="text-xs">Tipo de Conta</Label>
                <select
                  value={form.account_type}
                  onChange={e => setForm({ ...form, account_type: e.target.value })}
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                >
                  {Object.entries(ACCOUNT_TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="flex items-end gap-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.is_default} onChange={e => setForm({ ...form, is_default: e.target.checked })} className="w-4 h-4" />
                  Definir como padrão
                </label>
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm">Salvar</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => { setShowForm(false); setEditing(null); }}>Cancelar</Button>
            </div>
          </form>
        )}

        {banks.length === 0 && !showForm ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhuma conta cadastrada</p>
        ) : (
          <div className="space-y-2">
            {banks.map(bank => (
              <div key={bank.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Landmark className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium flex items-center gap-2">
                      {bank.bank_code} — {bank.bank_name}
                      {bank.is_default && <Badge className="bg-amber-100 text-amber-700 border-0 text-[10px]">Padrão</Badge>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {bank.agency ? `Ag: ${bank.agency}` : "Ag: —"}
                      {bank.account ? ` • Conta: ${bank.account}` : ""}
                      {bank.account_type ? ` • ${ACCOUNT_TYPES[bank.account_type] || bank.account_type}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {!bank.is_default && (
                    <Button variant="ghost" size="icon" onClick={() => handleSetDefault(bank)} title="Definir como padrão">
                      <Star className="w-4 h-4 text-gray-400" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(bank)}>
                    <Pencil className="w-4 h-4 text-gray-400" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(bank)}>
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
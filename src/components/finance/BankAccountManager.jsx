import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Pencil, Landmark, Search } from "lucide-react";
import { BRAZILIAN_BANKS } from "@/lib/brazilianBanks";

export default function BankAccountManager({ userEmail }) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [bankSearch, setBankSearch] = useState("");
  const [form, setForm] = useState({
    bank_code: "", bank_name: "", agency: "", account_number: "",
    account_type: "corrente", holder_name: "",
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('portalAuth', {
        operation: 'getBankAccounts', email: userEmail,
      });
      setAccounts(res.data.bankAccounts || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [userEmail]);

  useEffect(() => { load(); }, [load]);

  const filteredBanks = BRAZILIAN_BANKS.filter(b => {
    const term = bankSearch.trim().toLowerCase();
    return !term || b.name.toLowerCase().includes(term) || b.code.includes(term);
  });

  const startNew = () => {
    setEditing("new");
    setForm({ bank_code: "", bank_name: "", agency: "", account_number: "", account_type: "corrente", holder_name: "" });
    setBankSearch("");
  };

  const startEdit = (acc) => {
    setEditing(acc.id);
    setForm({
      bank_code: acc.bank_code, bank_name: acc.bank_name,
      agency: acc.agency, account_number: acc.account_number,
      account_type: acc.account_type || "corrente", holder_name: acc.holder_name || "",
    });
    setBankSearch("");
  };

  const selectBank = (bank) => {
    setForm({ ...form, bank_code: bank.code, bank_name: bank.name });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await base44.functions.invoke('portalAuth', {
        operation: 'saveBankAccount',
        email: userEmail,
        id: editing === "new" ? undefined : editing,
        bank_code: form.bank_code,
        bank_name: form.bank_name,
        agency: form.agency,
        account_number: form.account_number,
        account_type: form.account_type,
        holder_name: form.holder_name || undefined,
        is_active: true,
      });
      setEditing(null);
      await load();
    } catch (e) { alert("Erro ao salvar conta"); }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!confirm("Excluir esta conta bancária?")) return;
    try {
      await base44.functions.invoke('portalAuth', { operation: 'deleteBankAccount', id });
      await load();
    } catch (e) { alert("Erro ao excluir"); }
  };

  // Group accounts by bank
  const banksMap = {};
  accounts.forEach(a => {
    if (!banksMap[a.bank_code]) banksMap[a.bank_code] = { bank_name: a.bank_name, bank_code: a.bank_code, accounts: [] };
    banksMap[a.bank_code].accounts.push(a);
  });

  if (loading) {
    return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Contas Bancárias</h2>
        <Button className="gap-2" onClick={startNew}><Plus className="w-4 h-4" /> Nova Conta</Button>
      </div>

      {editing && (
        <Card className="ring-2 ring-primary ring-offset-1">
          <CardContent className="p-4">
            <form onSubmit={handleSave} className="space-y-3">
              {/* Bank selector */}
              {!form.bank_code ? (
                <div>
                  <Label>Selecione o Banco</Label>
                  <div className="relative mb-2">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome ou código..."
                      value={bankSearch}
                      onChange={e => setBankSearch(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                  <div className="max-h-60 overflow-y-auto rounded-md border">
                    {filteredBanks.map(bank => (
                      <button
                        key={bank.code}
                        type="button"
                        onClick={() => selectBank(bank)}
                        className="w-full flex items-center gap-3 p-2.5 hover:bg-muted/50 text-left border-b last:border-0"
                      >
                        <Badge variant="secondary" className="font-mono text-xs">{bank.code}</Badge>
                        <span className="text-sm">{bank.name}</span>
                      </button>
                    ))}
                    {filteredBanks.length === 0 && (
                      <p className="p-4 text-sm text-muted-foreground text-center">Nenhum banco encontrado</p>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <Landmark className="w-5 h-5 text-primary" />
                      <div>
                        <p className="font-medium text-sm">{form.bank_name}</p>
                        <p className="text-xs text-muted-foreground">Código: {form.bank_code}</p>
                      </div>
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setForm({ ...form, bank_code: "", bank_name: "" })}>
                      Trocar banco
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label>Agência</Label>
                      <Input value={form.agency} onChange={e => setForm({ ...form, agency: e.target.value })} required placeholder="Ex: 1234-5" />
                    </div>
                    <div>
                      <Label>Conta</Label>
                      <Input value={form.account_number} onChange={e => setForm({ ...form, account_number: e.target.value })} required placeholder="Ex: 56789-0" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label>Tipo de Conta</Label>
                      <select value={form.account_type} onChange={e => setForm({ ...form, account_type: e.target.value })}
                        className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm">
                        <option value="corrente">Conta Corrente</option>
                        <option value="poupanca">Conta Poupança</option>
                      </select>
                    </div>
                    <div>
                      <Label>Titular (opcional)</Label>
                      <Input value={form.holder_name} onChange={e => setForm({ ...form, holder_name: e.target.value })} placeholder="Nome do titular" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
                    <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
                  </div>
                </>
              )}
            </form>
          </CardContent>
        </Card>
      )}

      {accounts.length === 0 && !editing ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
          Nenhuma conta bancária cadastrada. Clique em "Nova Conta" para começar.
        </CardContent></Card>
      ) : (
        <div className="space-y-4">
          {Object.values(banksMap).map(group => (
            <Card key={group.bank_code}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3 pb-3 border-b">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Landmark className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{group.bank_name}</p>
                    <p className="text-xs text-muted-foreground">Código: {group.bank_code} · {group.accounts.length} conta(s)</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {group.accounts.map(acc => (
                    <div key={acc.id} className="flex items-center justify-between p-2.5 rounded-lg border hover:bg-muted/30">
                      <div className="flex items-center gap-3">
                        <Badge variant={acc.account_type === 'corrente' ? 'default' : 'secondary'} className="text-xs">
                          {acc.account_type === 'corrente' ? 'Corrente' : 'Poupança'}
                        </Badge>
                        <div>
                          <p className="text-sm font-medium">Ag: {acc.agency} · Conta: {acc.account_number}</p>
                          {acc.holder_name && <p className="text-xs text-muted-foreground">{acc.holder_name}</p>}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => startEdit(acc)}><Pencil className="w-4 h-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => handleDelete(acc.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
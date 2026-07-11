import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Search, X, Landmark } from "lucide-react";

export default function EditTransactionModal({ tx, userEmail, onClose, onSaved }) {
  const [description, setDescription] = useState(tx.description || "");
  const [amount, setAmount] = useState(tx.amount || "");
  const [type, setType] = useState(tx.type || "expense");
  const [category, setCategory] = useState(tx.category || "");
  const [launchDate, setLaunchDate] = useState(
    tx.launch_date ? new Date(tx.launch_date).toISOString().slice(0, 10) : ""
  );
  const [dueDate, setDueDate] = useState(
    tx.due_date ? new Date(tx.due_date).toISOString().slice(0, 10) : ""
  );
  const [contacts, setContacts] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContact, setSelectedContact] = useState(
    tx.contact_id ? { id: tx.contact_id, razao_social: tx.contact_name || "" } : null
  );
  const [showDropdown, setShowDropdown] = useState(false);
  const [costCenters, setCostCenters] = useState([]);
  const [selectedCostCenter, setSelectedCostCenter] = useState(tx.cost_center_id || "");
  const [bankAccounts, setBankAccounts] = useState([]);
  const [selectedBank, setSelectedBank] = useState(tx.bank_account_id || "");
  const [status, setStatus] = useState(tx.status || "pending");
  const [saving, setSaving] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    loadContacts();
    loadCostCenters();
    loadBankAccounts();
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const loadContacts = async () => {
    try {
      const res = await base44.functions.invoke("portalAuth", { operation: "getContacts", email: userEmail });
      setContacts(res.data.contacts || []);
    } catch (e) { console.error(e); }
  };

  const loadCostCenters = async () => {
    try {
      const res = await base44.functions.invoke("portalAuth", { operation: "getCostCenters", email: userEmail });
      setCostCenters(res.data.costCenters || []);
    } catch (e) { console.error(e); }
  };

  const loadBankAccounts = async () => {
    try {
      const res = await base44.functions.invoke("portalAuth", { operation: "getBankAccounts", email: userEmail });
      setBankAccounts(res.data.bankAccounts || []);
    } catch (e) { console.error(e); }
  };

  const filteredContacts = contacts.filter((c) => {
    if (!searchQuery) return contacts;
    const q = searchQuery.toLowerCase();
    return c.razao_social?.toLowerCase().includes(q) || c.cnpj?.includes(q);
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await base44.functions.invoke("portalAuth", {
        operation: "updateTransaction",
        email: userEmail,
        transaction_id: tx.id,
        description,
        amount: parseFloat(amount),
        type,
        category: category || undefined,
        launch_date: launchDate ? new Date(launchDate + "T00:00:00").toISOString() : undefined,
        due_date: dueDate ? new Date(dueDate + "T00:00:00").toISOString() : undefined,
        contact_id: selectedContact?.id || undefined,
        contact_name: selectedContact?.razao_social || undefined,
        cost_center_id: selectedCostCenter || undefined,
        cost_center_name: costCenters.find((c) => c.id === selectedCostCenter)?.name || undefined,
        bank_account_id: selectedBank || undefined,
        bank_name: bankAccounts.find((b) => b.id === selectedBank)?.bank_name || undefined,
        status,
      });
      onSaved();
    } catch (err) {
      alert("Erro ao salvar alterações");
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <Card className="w-full max-w-lg my-8">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Editar Movimentação</CardTitle>
          <Button type="button" variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <Label>Descrição</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} required />
            </div>

            {/* Contact search */}
            <div className="relative" ref={dropdownRef}>
              <Label>Cliente / Fornecedor</Label>
              {selectedContact ? (
                <div className="flex items-center justify-between h-9 px-3 rounded-md border border-input bg-muted/30">
                  <span className="text-sm font-medium truncate">{selectedContact.razao_social}</span>
                  <button type="button" onClick={() => setSelectedContact(null)} className="text-muted-foreground hover:text-destructive">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setShowDropdown(true); }}
                    onFocus={() => setShowDropdown(true)}
                    placeholder="Buscar por nome ou CNPJ..."
                    className="pl-8"
                  />
                  {showDropdown && (
                    <div className="absolute z-10 w-full mt-1 max-h-52 overflow-y-auto rounded-md border bg-popover shadow-lg">
                      {filteredContacts.length === 0 ? (
                        <p className="px-3 py-2 text-sm text-muted-foreground">Nenhum resultado</p>
                      ) : (
                        filteredContacts.map((c) => (
                          <button key={c.id} type="button" onClick={() => { setSelectedContact(c); setSearchQuery(""); setShowDropdown(false); }}
                            className="w-full text-left px-3 py-2 hover:bg-accent text-sm border-b last:border-0">
                            <div className="font-medium truncate">{c.razao_social}</div>
                            {c.cnpj && <div className="text-xs text-muted-foreground">CNPJ: {c.cnpj}</div>}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Cost Center + Bank Account */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Centro de Custo</Label>
                <select value={selectedCostCenter} onChange={(e) => setSelectedCostCenter(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm">
                  <option value="">Nenhum</option>
                  {costCenters.map((cc) => (
                    <option key={cc.id} value={cc.id}>{cc.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Conta Bancária</Label>
                <select value={selectedBank} onChange={(e) => setSelectedBank(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm">
                  <option value="">Nenhum</option>
                  {bankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>{b.bank_name} — Ag {b.agency} / {b.account_number}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor (R$)</Label>
                <Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required />
              </div>
              <div>
                <Label>Tipo</Label>
                <select value={type} onChange={(e) => setType(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm">
                  <option value="expense">Despesa</option>
                  <option value="income">Receita</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data de Lançamento</Label>
                <Input type="date" value={launchDate} onChange={(e) => setLaunchDate(e.target.value)} required />
              </div>
              <div>
                <Label>Data de Vencimento</Label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Categoria</Label>
                <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Ex: Alimentação" />
              </div>
              <div>
                <Label>Status</Label>
                <select value={status} onChange={(e) => setStatus(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm">
                  <option value="pending">Pendente</option>
                  <option value="settled">Baixado</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Salvando..." : "Salvar Alterações"}
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
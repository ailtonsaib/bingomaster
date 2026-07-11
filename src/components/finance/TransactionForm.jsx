import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, X } from "lucide-react";

export default function TransactionForm({ userEmail, onSave, onCancel }) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState("expense");
  const [category, setCategory] = useState("");
  const [launchDate, setLaunchDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [contacts, setContacts] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContact, setSelectedContact] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [saving, setSaving] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    loadContacts();
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
      const res = await base44.functions.invoke("portalAuth", {
        operation: "getContacts",
        email: userEmail,
      });
      setContacts(res.data.contacts || []);
    } catch (e) {
      console.error("Erro ao carregar contatos:", e);
    }
  };

  const filteredContacts = contacts.filter((c) => {
    if (!searchQuery) return contacts;
    const q = searchQuery.toLowerCase();
    return (
      c.razao_social?.toLowerCase().includes(q) ||
      c.nome_fantasia?.toLowerCase().includes(q) ||
      c.cnpj?.includes(q)
    );
  });

  const handleSelectContact = (contact) => {
    setSelectedContact(contact);
    setSearchQuery("");
    setShowDropdown(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onSave({
      description,
      amount: parseFloat(amount),
      type,
      category: category || undefined,
      launch_date: launchDate ? new Date(launchDate + "T00:00:00").toISOString() : undefined,
      due_date: dueDate ? new Date(dueDate + "T00:00:00").toISOString() : undefined,
      contact_id: selectedContact?.id || undefined,
      contact_name: selectedContact?.razao_social || undefined,
    });
    setSaving(false);
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-base">Nova Movimentação</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label>Descrição</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              placeholder="Ex: Venda de produto"
            />
          </div>

          {/* Contact search */}
          <div className="relative" ref={dropdownRef}>
            <Label>Cliente / Fornecedor</Label>
            {selectedContact ? (
              <div className="flex items-center justify-between h-9 px-3 rounded-md border border-input bg-muted/30">
                <span className="text-sm font-medium truncate">
                  {selectedContact.razao_social}
                  {selectedContact.cnpj && ` — ${selectedContact.cnpj}`}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedContact(null)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowDropdown(true);
                  }}
                  onFocus={() => setShowDropdown(true)}
                  placeholder="Buscar por nome ou CNPJ..."
                  className="pl-8"
                />
                {showDropdown && (
                  <div className="absolute z-10 w-full mt-1 max-h-52 overflow-y-auto rounded-md border bg-popover shadow-lg">
                    {filteredContacts.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-muted-foreground">
                        {contacts.length === 0
                          ? "Nenhum contato cadastrado"
                          : "Nenhum resultado"}
                      </p>
                    ) : (
                      filteredContacts.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => handleSelectContact(c)}
                          className="w-full text-left px-3 py-2 hover:bg-accent text-sm border-b last:border-0"
                        >
                          <div className="font-medium truncate">{c.razao_social}</div>
                          {c.cnpj && (
                            <div className="text-xs text-muted-foreground">
                              CNPJ: {c.cnpj}
                            </div>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Valor (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div>
              <Label>Tipo</Label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="expense">Despesa</option>
                <option value="income">Receita</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Data de Lançamento</Label>
              <Input
                type="date"
                value={launchDate}
                onChange={(e) => setLaunchDate(e.target.value)}
                required
              />
            </div>
            <div>
              <Label>Data de Vencimento</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label>Categoria (opcional)</Label>
            <Input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Ex: Alimentação"
            />
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
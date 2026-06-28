import { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Pencil, Trash2, UserCheck, X, Check, Share2, Receipt } from "lucide-react";
import { maskPhone } from "@/lib/utils";
import ShareSellLinkModal from "@/components/bingo/ShareSellLinkModal";
import SellerReceiptModal from "@/components/bingo/SellerReceiptModal";

function SellerFormModal({ seller, onClose, onSaved }) {
  const [name, setName] = useState(seller?.name || "");
  const [phone, setPhone] = useState(seller?.phone || "");
  const [email, setEmail] = useState(seller?.email || "");
  const [address, setAddress] = useState(seller?.address || "");
  const [city, setCity] = useState(seller?.city || "");
  const [state, setState] = useState(seller?.state || "");
  const [notes, setNotes] = useState(seller?.notes || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const data = {
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      address: address.trim(),
      city: city.trim(),
      state: state.trim().toUpperCase(),
      notes: notes.trim(),
      is_active: seller?.is_active ?? true,
    };
    if (seller) {
      await base44.entities.Seller.update(seller.id, data);
    } else {
      await base44.entities.Seller.create(data);
    }
    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-background rounded-xl shadow-2xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-bold text-base font-heading">
            {seller ? "Editar Vendedor" : "Novo Vendedor"}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="space-y-1.5">
            <Label>Nome *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome completo" autoFocus />
          </div>

          <div className="space-y-1.5">
            <Label>E-mail</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Telefone / WhatsApp</Label>
              <Input value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} placeholder="(00) 00000-0000" inputMode="numeric" />
            </div>
            <div className="space-y-1.5">
              <Label>Estado (UF)</Label>
              <Input value={state} onChange={(e) => setState(e.target.value)} placeholder="SP" maxLength={2} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Endereço</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Rua, número, bairro..." />
          </div>

          <div className="space-y-1.5">
            <Label>Cidade</Label>
            <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Cidade" />
          </div>

          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observações opcionais..." />
          </div>

          <div className="flex gap-3 pt-1">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button className="flex-1 gap-2" onClick={handleSave} disabled={!name.trim() || saving}>
              {saving ? "Salvando..." : <><Check className="w-4 h-4" /> Salvar</>}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Sellers() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSeller, setEditingSeller] = useState(null);
  const [shareSeller, setShareSeller] = useState(null);
  const [receiptSeller, setReceiptSeller] = useState(null);
  const [search, setSearch] = useState("");

  const { data: sellers = [], isLoading } = useQuery({
    queryKey: ["sellers"],
    queryFn: () => base44.entities.Seller.list("-created_date"),
  });

  const handleDelete = async (id) => {
    if (!confirm("Excluir este vendedor?")) return;
    await base44.entities.Seller.delete(id);
    queryClient.invalidateQueries({ queryKey: ["sellers"] });
  };

  const handleToggleActive = async (seller) => {
    await base44.entities.Seller.update(seller.id, { is_active: !seller.is_active });
    queryClient.invalidateQueries({ queryKey: ["sellers"] });
  };

  const filtered = sellers.filter((s) =>
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.phone?.includes(search) ||
    s.city?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-2">
              <ArrowLeft className="w-4 h-4" /> Voltar
            </Link>
            <h1 className="text-2xl font-bold font-heading flex items-center gap-2">
              <UserCheck className="w-6 h-6 text-primary" /> Vendedores
            </h1>
          </div>
          <Button onClick={() => { setEditingSeller(null); setModalOpen(true); }} className="gap-2">
            <Plus className="w-4 h-4" /> Novo Vendedor
          </Button>
        </div>

        {/* Search */}
        <Input
          placeholder="Buscar por nome, telefone ou cidade..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-6"
        />

        {/* Stats */}
        <div className="flex gap-3 mb-6">
          <Badge variant="outline" className="text-sm">{sellers.length} total</Badge>
          <Badge variant="outline" className="text-sm bg-green-50 text-green-700 border-green-200">
            {sellers.filter((s) => s.is_active !== false).length} ativos
          </Badge>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
              <UserCheck className="w-12 h-12 mb-3 opacity-30" />
              <p>{search ? "Nenhum vendedor encontrado." : "Nenhum vendedor cadastrado ainda."}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((seller) => (
              <Card key={seller.id} className={`transition-all ${seller.is_active === false ? "opacity-60" : ""}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold font-heading">{seller.name}</span>
                        {seller.is_active === false && (
                          <Badge variant="outline" className="text-xs text-muted-foreground">Inativo</Badge>
                        )}
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground space-y-0.5">
                        {seller.phone && <div>📞 {seller.phone}</div>}
                        {(seller.address || seller.city) && (
                          <div>📍 {[seller.address, seller.city, seller.state].filter(Boolean).join(", ")}</div>
                        )}
                        {seller.notes && <div className="text-xs italic">💬 {seller.notes}</div>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        onClick={() => setReceiptSeller(seller)}
                        title="Emitir recibo"
                      >
                        <Receipt className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-green-600 hover:text-green-700 hover:bg-green-50"
                        onClick={() => setShareSeller(seller)}
                        title="Enviar link do app"
                      >
                        <Share2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => handleToggleActive(seller)}
                        title={seller.is_active === false ? "Ativar" : "Desativar"}
                      >
                        <UserCheck className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => { setEditingSeller(seller); setModalOpen(true); }}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(seller.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {receiptSeller && (
        <SellerReceiptModal
          seller={receiptSeller}
          onClose={() => setReceiptSeller(null)}
        />
      )}

      {shareSeller && (
        <ShareSellLinkModal
          seller={shareSeller}
          onClose={() => setShareSeller(null)}
        />
      )}

      {modalOpen && (
        <SellerFormModal
          seller={editingSeller}
          onClose={() => setModalOpen(false)}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ["sellers"] })}
        />
      )}
    </div>
  );
}
import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { X } from "lucide-react";

export default function RifaFormModal({ rifa, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: rifa?.name || "",
    description: rifa?.description || "",
    prize: rifa?.prize || "",
    ticket_price: rifa?.ticket_price ?? 5,
    total_tickets: rifa?.total_tickets ?? 100,
    event_date: rifa?.event_date ? rifa.event_date.substring(0, 10) : "",
    event_location: rifa?.event_location || "",
    organizer_name: rifa?.organizer_name || "",
    organizer_phone: rifa?.organizer_phone || "",
    tickets_per_page: rifa?.tickets_per_page ?? 10,
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name || !form.total_tickets || !form.ticket_price) return;
    setSaving(true);
    const data = {
      ...form,
      ticket_price: Number(form.ticket_price),
      total_tickets: Number(form.total_tickets),
      tickets_per_page: Number(form.tickets_per_page),
      event_date: form.event_date || null,
    };
    if (rifa?.id) {
      await base44.entities.Rifa.update(rifa.id, data);
    } else {
      await base44.entities.Rifa.create(data);
    }
    setSaving(false);
    onSaved();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{rifa ? "Editar Rifa" : "Nova Rifa"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 gap-3">
            <div>
              <Label>Nome da Rifa *</Label>
              <Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Ex: Rifa do Churrasco" />
            </div>
            <div>
              <Label>Prêmio</Label>
              <Input value={form.prize} onChange={e => set("prize", e.target.value)} placeholder="Ex: TV 55 polegadas" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={form.description} onChange={e => set("description", e.target.value)} placeholder="Detalhes adicionais..." rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Total de Números *</Label>
                <Input type="number" min={1} value={form.total_tickets} onChange={e => set("total_tickets", e.target.value)} />
              </div>
              <div>
                <Label>Valor por Número (R$) *</Label>
                <Input type="number" min={0} step={0.5} value={form.ticket_price} onChange={e => set("ticket_price", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data do Sorteio</Label>
                <Input type="date" value={form.event_date} onChange={e => set("event_date", e.target.value)} />
              </div>
              <div>
                <Label>Local do Sorteio</Label>
                <Input value={form.event_location} onChange={e => set("event_location", e.target.value)} placeholder="Ex: Clube Municipal" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nome do Organizador</Label>
                <Input value={form.organizer_name} onChange={e => set("organizer_name", e.target.value)} placeholder="Seu nome" />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input value={form.organizer_phone} onChange={e => set("organizer_phone", e.target.value)} placeholder="(00) 00000-0000" />
              </div>
            </div>
            <div>
              <Label>Canhotos por página (impressão)</Label>
              <Input type="number" min={1} max={20} value={form.tickets_per_page} onChange={e => set("tickets_per_page", e.target.value)} />
              <p className="text-xs text-muted-foreground mt-1">Define quantos bilhetes aparecem por página ao imprimir</p>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !form.name}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
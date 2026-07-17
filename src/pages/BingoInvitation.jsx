import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Printer, Plus, Trash2, Gift, MapPin, Calendar, Clock, Sparkles, Candy, Loader2, FileDown } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";

export default function BingoInvitation() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedGameId, setSelectedGameId] = useState(null);
  const [treatInput, setTreatInput] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: games = [], isLoading } = useQuery({
    queryKey: ["bingo-games-invite"],
    queryFn: () => base44.entities.BingoGame.filter({}, "-created_date"),
  });

  const selectedGame = games.find((g) => g.id === selectedGameId) || games[0] || null;

  const updateField = async (field, value) => {
    if (!selectedGame) return;
    setSaving(true);
    try {
      await base44.entities.BingoGame.update(selectedGame.id, { [field]: value });
      await queryClient.invalidateQueries({ queryKey: ["bingo-games-invite"] });
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  };

  const addTreat = async () => {
    if (!treatInput.trim() || !selectedGame) return;
    const current = selectedGame.event_treats || [];
    await updateField("event_treats", [...current, treatInput.trim()]);
    setTreatInput("");
  };

  const removeTreat = async (index) => {
    if (!selectedGame) return;
    const current = selectedGame.event_treats || [];
    await updateField("event_treats", current.filter((_, i) => i !== index));
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    if (!selectedGame) return;
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = 210;
    const margin = 18;
    let y = 0;

    // ── Header banner ──
    doc.setFillColor(124, 58, 237); // primary purple
    doc.rect(0, 0, pageW, 50, "F");
    doc.setFillColor(91, 33, 182);
    doc.rect(0, 44, pageW, 6, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(32);
    doc.text("BINGO", pageW / 2, 24, { align: "center" });
    doc.setFontSize(13);
    doc.setFont("helvetica", "normal");
    doc.text(selectedGame.name || "Convite Especial", pageW / 2, 36, { align: "center" });
    y = 64;

    // ── Section helper ──
    const sectionTitle = (icon, title, color) => {
      doc.setFillColor(color[0], color[1], color[2]);
      doc.roundedRect(margin, y - 5, 5, 5, 1, 1, "F");
      doc.setTextColor(color[0], color[1], color[2]);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(title, margin + 8, y);
      doc.setTextColor(30, 30, 30);
      y += 8;
    };

    // ── Date & Time ──
    sectionTitle("", "DATA E HORARIO", [124, 58, 237]);
    if (eventDate) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text(
        format(eventDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR }),
        margin,
        y
      );
      y += 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(90, 90, 90);
      doc.text(`Horario: ${format(eventDate, "HH:mm", { locale: ptBR })}h`, margin, y);
      y += 8;
    } else {
      doc.setFontSize(11);
      doc.setFont("helvetica", "italic");
      doc.text("Data a definir", margin, y);
      y += 8;
    }
    y += 4;

    // ── Location ──
    sectionTitle("", "LOCAL DO EVENTO", [37, 99, 235]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(selectedGame.event_location || "A definir", margin, y);
    y += 6;
    if (selectedGame.event_address) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(90, 90, 90);
      const addrLines = doc.splitTextToSize(selectedGame.event_address, pageW - margin * 2);
      doc.text(addrLines, margin, y);
      y += addrLines.length * 5 + 2;
    } else {
      y += 2;
    }
    y += 6;

    // ── Prizes ──
    sectionTitle("", "PREMIOS DO SORTEIO", [217, 119, 6]);
    doc.setFillColor(255, 251, 235);
    doc.roundedRect(margin - 2, y - 4, pageW - margin * 2 + 4, 8 + (selectedGame.prizes?.length || 1) * 9, 2, 2, "F");
    if (selectedGame.prizes && selectedGame.prizes.length > 0) {
      selectedGame.prizes.forEach((prize, i) => {
        doc.setFillColor(245, 158, 11);
        doc.circle(margin + 2, y - 1, 2, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.text(String(i + 1), margin + 2, y, { align: "center" });

        doc.setTextColor(120, 53, 15);
        doc.setFontSize(11);
        doc.text(prize.name || `Premio ${i + 1}`, margin + 8, y);
        y += 5;
        if (prize.description) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);
          doc.setTextColor(161, 98, 7);
          const descLines = doc.splitTextToSize(prize.description, pageW - margin * 2 - 10);
          doc.text(descLines, margin + 8, y);
          y += descLines.length * 4 + 1;
        }
        y += 3;
      });
    } else {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(10);
      doc.setTextColor(161, 98, 7);
      doc.text("Premios a definir", margin, y + 2);
      y += 8;
    }
    y += 6;

    // ── Treats ──
    if (selectedGame.event_treats && selectedGame.event_treats.length > 0) {
      if (y > 250) { doc.addPage(); y = 20; }
      sectionTitle("", "GULOSEIMAS", [219, 39, 119]);
      doc.setFillColor(253, 242, 248);
      doc.roundedRect(margin - 2, y - 4, pageW - margin * 2 + 4, 14, 2, 2, "F");
      doc.setTextColor(157, 47, 96);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const treatsText = selectedGame.event_treats.join("  -  ");
      const treatLines = doc.splitTextToSize(treatsText, pageW - margin * 2 - 4);
      doc.text(treatLines, margin, y + 2);
      y += treatLines.length * 5 + 8;
    }

    // ── Price ──
    if (selectedGame.event_price) {
      if (y > 260) { doc.addPage(); y = 20; }
      doc.setFillColor(243, 232, 255);
      doc.roundedRect(margin - 2, y - 4, pageW - margin * 2 + 4, 14, 2, 2, "F");
      doc.setTextColor(124, 58, 237);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("VALOR DA CARTELA", margin, y + 2);
      doc.setFontSize(14);
      doc.text(selectedGame.event_price, pageW - margin, y + 2, { align: "right" });
      y += 16;
    }

    // ── Footer ──
    const pageH = doc.internal.pageSize.getHeight();
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(margin, pageH - 18, pageW - margin, pageH - 18);
    doc.setTextColor(120, 120, 120);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Venha se divertir e concorrer aos premios!", pageW / 2, pageH - 11, { align: "center" });
    doc.setFontSize(8);
    doc.setTextColor(160, 160, 160);
    doc.text("BingoPremier - Convite gerado em " + format(new Date(), "dd/MM/yyyy 'as' HH:mm"), pageW / 2, pageH - 6, { align: "center" });

    const fileName = `convite-bingo-${(selectedGame.name || "evento").toLowerCase().replace(/[^a-z0-9]/g, "-")}.pdf`;
    doc.save(fileName);
  };

  const eventDate = selectedGame?.event_date ? new Date(selectedGame.event_date) : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Toolbar (no-print) */}
      <div className="no-print sticky top-0 z-40 bg-card/80 backdrop-blur border-b">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="gap-2" onClick={() => navigate("/app")}>
              <ArrowLeft className="w-4 h-4" /> Voltar
            </Button>
            <span className="font-heading font-bold text-sm">Convite do Bingo</span>
            {saving && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
          </div>
          <div className="flex items-center gap-2">
            {games.length > 1 && (
              <select
                value={selectedGameId || ""}
                onChange={(e) => setSelectedGameId(e.target.value)}
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
              >
                {games.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            )}
            <Button size="sm" variant="outline" className="gap-2" onClick={handleDownloadPDF} disabled={!selectedGame}>
              <FileDown className="w-4 h-4" /> PDF
            </Button>
            <Button size="sm" className="gap-2" onClick={handlePrint} disabled={!selectedGame}>
              <Printer className="w-4 h-4" /> Imprimir
            </Button>
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}

      {!isLoading && !selectedGame && (
        <div className="max-w-md mx-auto text-center py-20 px-4">
          <Gift className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Nenhum jogo de bingo cadastrado ainda. Crie um jogo primeiro.</p>
          <Link to="/app">
            <Button className="mt-4">Ir para o painel</Button>
          </Link>
        </div>
      )}

      {selectedGame && (
        <div className="max-w-5xl mx-auto px-4 py-6 grid lg:grid-cols-2 gap-6">
          {/* ── Invitation Preview ── */}
          <div id="print-area" className="bg-white rounded-3xl shadow-xl overflow-hidden border-2 border-primary/10">
            {/* Header */}
            <div className="relative px-8 py-10 text-center text-white overflow-hidden">
              <img
                src="https://images.unsplash.com/photo-1530023367847-a683933f4172?w=800&q=80"
                alt="Bingo"
                className="absolute inset-0 w-full h-full object-cover"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
              <div className="absolute inset-0 bg-gradient-to-br from-primary/85 via-primary/80 to-purple-900/85" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.2),transparent_50%)]" />
              <div className="absolute top-4 left-4 text-4xl opacity-30">🎯</div>
              <div className="absolute top-4 right-4 text-4xl opacity-30">🎪</div>
              <div className="relative">
                <p className="text-sm font-medium uppercase tracking-widest opacity-90">Você está convidado!</p>
                <h1 className="text-4xl md:text-5xl font-bold font-heading mt-2">BINGO</h1>
                <p className="text-lg mt-1 opacity-95">{selectedGame.name}</p>
              </div>
            </div>

            {/* Body */}
            <div className="px-8 py-8 space-y-6">
              {/* Date & Time */}
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Data e Hora</p>
                  {eventDate ? (
                    <>
                      <p className="text-base font-bold text-foreground">
                        {format(eventDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                      </p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> {format(eventDate, "HH:mm", { locale: ptBR })}h
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">Data a definir</p>
                  )}
                </div>
              </div>

              {/* Location */}
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Local</p>
                  <p className="text-base font-bold text-foreground">{selectedGame.event_location || "A definir"}</p>
                  {selectedGame.event_address && (
                    <p className="text-sm text-muted-foreground">{selectedGame.event_address}</p>
                  )}
                </div>
              </div>

              {/* Prizes */}
              <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-200 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Gift className="w-5 h-5 text-amber-600" />
                  <p className="text-sm font-bold uppercase text-amber-800 tracking-wide">Prêmios</p>
                </div>
                {selectedGame.prizes && selectedGame.prizes.length > 0 ? (
                  <ul className="space-y-2">
                    {selectedGame.prizes.map((prize, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center mt-0.5">
                          {i + 1}
                        </span>
                        <div>
                          <p className="font-semibold text-amber-900 text-sm">{prize.name}</p>
                          {prize.description && (
                            <p className="text-xs text-amber-700">{prize.description}</p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-amber-600 italic">Prêmios a definir</p>
                )}
              </div>

              {/* Treats */}
              {selectedGame.event_treats && selectedGame.event_treats.length > 0 && (
                <div className="rounded-2xl bg-gradient-to-br from-pink-50 to-rose-50 border border-pink-200 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Candy className="w-5 h-5 text-pink-600" />
                    <p className="text-sm font-bold uppercase text-pink-800 tracking-wide">Guloseimas</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedGame.event_treats.map((treat, i) => (
                      <span key={i} className="px-3 py-1.5 rounded-full bg-white border border-pink-200 text-sm text-pink-700 font-medium shadow-sm">
                        {treat}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Price */}
              {selectedGame.event_price && (
                <div className="flex items-center gap-3 rounded-xl bg-primary/5 border border-primary/10 p-4">
                  <Sparkles className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Valor da Cartela</p>
                    <p className="text-xl font-bold text-primary">{selectedGame.event_price}</p>
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="text-center pt-2 border-t border-dashed border-muted">
                <p className="text-sm text-muted-foreground">🎯 Venha se divertir e concorrer aos prêmios! 🎉</p>
              </div>
            </div>
          </div>

          {/* ── Edit Panel (no-print) ── */}
          <div className="no-print space-y-4">
            <div className="bg-card rounded-2xl border p-5 space-y-4">
              <h2 className="font-heading font-bold text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" /> Editar Convite
              </h2>

              <div>
                <Label className="text-xs font-medium">Nome do evento</Label>
                <Input
                  defaultValue={selectedGame.name}
                  onBlur={(e) => e.target.value !== selectedGame.name && updateField("name", e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-xs font-medium">Data e hora</Label>
                <Input
                  type="datetime-local"
                  value={selectedGame.event_date ? selectedGame.event_date.slice(0, 16) : ""}
                  onChange={(e) => updateField("event_date", e.target.value ? new Date(e.target.value).toISOString() : undefined)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-xs font-medium">Local (nome do salão)</Label>
                <Input
                  defaultValue={selectedGame.event_location || ""}
                  onBlur={(e) => e.target.value !== selectedGame.event_location && updateField("event_location", e.target.value)}
                  className="mt-1"
                  placeholder="Ex: Salão Paroquial São João"
                />
              </div>

              <div>
                <Label className="text-xs font-medium">Endereço</Label>
                <Input
                  defaultValue={selectedGame.event_address || ""}
                  onBlur={(e) => e.target.value !== selectedGame.event_address && updateField("event_address", e.target.value)}
                  className="mt-1"
                  placeholder="Rua, número, bairro, cidade"
                />
              </div>

              <div>
                <Label className="text-xs font-medium">Valor da cartela</Label>
                <Input
                  defaultValue={selectedGame.event_price || ""}
                  onBlur={(e) => e.target.value !== selectedGame.event_price && updateField("event_price", e.target.value)}
                  className="mt-1"
                  placeholder="Ex: R$ 20,00"
                />
              </div>
            </div>

            {/* Treats editor */}
            <div className="bg-card rounded-2xl border p-5 space-y-3">
              <h2 className="font-heading font-bold text-sm flex items-center gap-2">
                <Candy className="w-4 h-4 text-pink-600" /> Guloseimas
              </h2>
              <p className="text-xs text-muted-foreground">Adicione os comes e bebes que serão servidos no evento.</p>

              <div className="flex gap-2">
                <Input
                  value={treatInput}
                  onChange={(e) => setTreatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTreat())}
                  placeholder="Ex: Pipoca, refrigerante, doces..."
                  className="flex-1"
                />
                <Button size="icon" onClick={addTreat} disabled={!treatInput.trim()}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              {selectedGame.event_treats && selectedGame.event_treats.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {selectedGame.event_treats.map((treat, i) => (
                    <span key={i} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-pink-50 border border-pink-200 text-sm text-pink-700 font-medium">
                      {treat}
                      <button onClick={() => removeTreat(i)} className="hover:text-red-500 transition-colors">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Prizes info */}
            <div className="bg-amber-50 rounded-2xl border border-amber-200 p-4">
              <p className="text-xs text-amber-800">
                <strong>💡 Dica:</strong> Os prêmios são gerenciados no painel do jogo. Para adicionar ou editar prêmios, acesse a aba "Novo Jogo" ou "Prêmios & Vencedores".
              </p>
              <Link to="/winners" className="inline-flex items-center gap-1 text-xs text-amber-700 font-semibold hover:underline mt-2">
                <Gift className="w-3.5 h-3.5" /> Gerenciar prêmios
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
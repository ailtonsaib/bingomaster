import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader as UiCardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Printer, Trash2, User, Zap, CheckSquare, Square, XCircle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { generateBingoGrid, generateThreeGrids } from "@/lib/bingoUtils";
import BingoGrid from "@/components/bingo/BingoGrid";
import BulkGenerateModal from "@/components/bingo/BulkGenerateModal";
import CardHeader from "@/components/bingo/CardHeader";
import CardFooter from "@/components/bingo/CardFooter";
import { motion } from "framer-motion";

export default function GameCards() {
  const { gameId } = useParams();
  const queryClient = useQueryClient();
  const [playerName, setPlayerName] = useState("");
  const [playerPhone, setPlayerPhone] = useState("");
  const [playerCity, setPlayerCity] = useState("");
  const [playerState, setPlayerState] = useState("");
  const [chances, setChances] = useState("1");
  const [quantity, setQuantity] = useState("1");
  const [generating, setGenerating] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [deleting, setDeleting] = useState(false);
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const [showRangeDelete, setShowRangeDelete] = useState(false);

  const { data: game } = useQuery({
    queryKey: ["game", gameId],
    queryFn: () => base44.entities.BingoGame.filter({ id: gameId }),
    select: (data) => data[0],
  });

  const { data: cards = [], isLoading } = useQuery({
    queryKey: ["cards", gameId],
    queryFn: () => base44.entities.BingoCard.filter({ game_id: String(gameId) }),
  });

  const handleGenerate = async () => {
    if (!playerName.trim()) return;
    setGenerating(true);
    const qty = Math.min(Math.max(parseInt(quantity) || 1, 1), 20);
    const chancesNum = parseInt(chances);
    const nextNum = cards.length > 0 ? Math.max(...cards.map((c) => c.card_number || 0)) + 1 : 1;

    const newCards = [];
    for (let i = 0; i < qty; i++) {
      const [g1a, g1b, g1c] = generateThreeGrids();
      const cardData = {
        game_id: String(gameId),
        player_name: playerName.trim(),
        player_phone: playerPhone.trim(),
        player_city: playerCity.trim(),
        player_state: playerState.trim(),
        chances: chancesNum,
        grid_1a: g1a, grid_1b: g1b, grid_1c: g1c,
        grid_1: g1a, // legacy compat
        card_number: nextNum + i,
      };
      if (chancesNum === 2) {
        const [g2a, g2b, g2c] = generateThreeGrids();
        cardData.grid_2a = g2a; cardData.grid_2b = g2b; cardData.grid_2c = g2c;
        cardData.grid_2 = g2a; // legacy compat
      }
      newCards.push(cardData);
    }

    await base44.entities.BingoCard.bulkCreate(newCards);
    queryClient.invalidateQueries({ queryKey: ["cards", gameId] });
    setPlayerName("");
    setPlayerPhone("");
    setPlayerCity("");
    setPlayerState("");
    setGenerating(false);
  };

  const handleBulkGenerate = async ({ quantity, chances, prefix }) => {
    setGenerating(true);
    const nextNum = cards.length > 0 ? Math.max(...cards.map((c) => c.card_number || 0)) + 1 : 1;
    const BATCH_SIZE = 200;
    for (let batch = 0; batch < quantity; batch += BATCH_SIZE) {
      const batchCount = Math.min(BATCH_SIZE, quantity - batch);
      const newCards = [];
      for (let i = 0; i < batchCount; i++) {
        const idx = batch + i;
        const [g1a, g1b, g1c] = generateThreeGrids();
        const cardData = {
          game_id: String(gameId),
          player_name: `${prefix} ${nextNum + idx}`,
          chances,
          grid_1a: g1a, grid_1b: g1b, grid_1c: g1c,
          grid_1: g1a,
          card_number: nextNum + idx,
        };
        if (chances === 2) {
          const [g2a, g2b, g2c] = generateThreeGrids();
          cardData.grid_2a = g2a; cardData.grid_2b = g2b; cardData.grid_2c = g2c;
          cardData.grid_2 = g2a;
        }
        newCards.push(cardData);
      }
      await base44.entities.BingoCard.bulkCreate(newCards);
    }
    queryClient.invalidateQueries({ queryKey: ["cards", gameId] });
    setGenerating(false);
    setBulkOpen(false);
  };

  const handleDelete = async (id) => {
    try {
      await base44.entities.BingoCard.delete(id);
    } catch (e) {
      // ignore
    }
    queryClient.invalidateQueries({ queryKey: ["cards", gameId] });
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(cards.map((c) => c.id)));
  const clearSelection = () => setSelectedIds(new Set());

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    setDeleting(true);
    for (const id of selectedIds) {
      try { await base44.entities.BingoCard.delete(id); } catch (e) { /* ignore */ }
    }
    setSelectedIds(new Set());
    setDeleting(false);
    queryClient.invalidateQueries({ queryKey: ["cards", gameId] });
  };

  const handleDeleteRange = async () => {
    const from = parseInt(rangeFrom);
    const to = parseInt(rangeTo);
    if (isNaN(from) || isNaN(to) || from > to) return;
    setDeleting(true);
    const toDelete = cards.filter((c) => c.card_number >= from && c.card_number <= to);
    for (const card of toDelete) {
      try { await base44.entities.BingoCard.delete(card.id); } catch (e) { /* ignore */ }
    }
    setRangeFrom(""); setRangeTo("");
    setShowRangeDelete(false);
    setDeleting(false);
    queryClient.invalidateQueries({ queryKey: ["cards", gameId] });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link to={game ? `/game/${game.id}` : "/"} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-2">
              <ArrowLeft className="w-4 h-4" /> Voltar ao Jogo
            </Link>
            <h1 className="text-2xl font-bold font-heading">
              Cartelas {game ? `- ${game.name}` : ""}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => setBulkOpen(true)}
            >
              <Zap className="w-4 h-4 text-primary" /> Geração em Lote
            </Button>
            {cards.length > 0 && (
              <Link to={`/print/${gameId}`}>
                <Button variant="outline" className="gap-2">
                  <Printer className="w-4 h-4 text-primary" /> Imprimir A4
                </Button>
              </Link>
            )}
            <Badge variant="outline" className="text-sm">
              {cards.length} cartelas
            </Badge>
          </div>
        </div>

        <BulkGenerateModal
          open={bulkOpen}
          onClose={() => setBulkOpen(false)}
          onGenerate={handleBulkGenerate}
          generating={generating}
        />

        {/* Generate form */}
        <Card className="mb-8">
          <UiCardHeader className="pb-3">
            <CardTitle className="text-lg font-heading flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" /> Gerar Cartelas
            </CardTitle>
          </UiCardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4 items-end">
              <div className="space-y-1.5">
                <Label className="text-sm">Nome do Jogador</Label>
                <Input
                  placeholder="Nome"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">Telefone</Label>
                <Input
                  placeholder="(00) 00000-0000"
                  value={playerPhone}
                  onChange={(e) => setPlayerPhone(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">Cidade</Label>
                <Input
                  placeholder="Cidade"
                  value={playerCity}
                  onChange={(e) => setPlayerCity(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">Estado</Label>
                <Input
                  placeholder="UF"
                  maxLength={2}
                  value={playerState}
                  onChange={(e) => setPlayerState(e.target.value.toUpperCase())}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-4 items-end mt-4">
              <div className="md:col-span-1" />
              <div className="space-y-1.5">
                <Label className="text-sm">Chances</Label>
                <RadioGroup value={chances} onValueChange={setChances} className="flex gap-4 pt-1">
                  <div className="flex items-center gap-1.5">
                    <RadioGroupItem value="1" id="c1" />
                    <Label htmlFor="c1" className="text-sm cursor-pointer">1 chance</Label>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <RadioGroupItem value="2" id="c2" />
                    <Label htmlFor="c2" className="text-sm cursor-pointer">2 chances</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">Quantidade</Label>
                <Input
                  type="number"
                  min="1"
                  max="20"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>

              <Button onClick={handleGenerate} disabled={!playerName.trim() || generating} className="gap-1.5">
                {generating ? "Gerando..." : <><Plus className="w-4 h-4" /> Gerar</>}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Selection toolbar */}
        {cards.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={selectedIds.size === cards.length ? clearSelection : selectAll}>
              {selectedIds.size === cards.length ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
              {selectedIds.size === cards.length ? "Desmarcar todas" : "Selecionar todas"}
            </Button>

            {selectedIds.size > 0 && (
              <>
                <span className="text-sm text-muted-foreground">{selectedIds.size} selecionada(s)</span>
                <Button
                  variant="destructive"
                  size="sm"
                  className="gap-1.5"
                  onClick={handleDeleteSelected}
                  disabled={deleting}
                >
                  <Trash2 className="w-4 h-4" />
                  {deleting ? "Excluindo..." : `Excluir ${selectedIds.size} selecionada(s)`}
                </Button>
                <Button variant="ghost" size="sm" onClick={clearSelection}>
                  <XCircle className="w-4 h-4" /> Limpar seleção
                </Button>
              </>
            )}

            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 ml-auto"
              onClick={() => setShowRangeDelete((v) => !v)}
            >
              <Trash2 className="w-4 h-4 text-destructive" /> Excluir por intervalo
            </Button>
          </div>
        )}

        {/* Range delete */}
        {showRangeDelete && (
          <div className="flex items-end gap-3 mb-4 p-4 border rounded-xl bg-muted/40">
            <div className="space-y-1">
              <Label className="text-xs">Cartela nº (de)</Label>
              <Input type="number" min="1" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} className="w-28" placeholder="Ex: 1" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cartela nº (até)</Label>
              <Input type="number" min="1" value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} className="w-28" placeholder="Ex: 100" />
            </div>
            <Button variant="destructive" size="sm" onClick={handleDeleteRange} disabled={deleting || !rangeFrom || !rangeTo}>
              {deleting ? "Excluindo..." : "Excluir intervalo"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowRangeDelete(false)}>Cancelar</Button>
            {rangeFrom && rangeTo && !isNaN(parseInt(rangeFrom)) && !isNaN(parseInt(rangeTo)) && (
              <span className="text-xs text-muted-foreground self-center">
                {cards.filter((c) => c.card_number >= parseInt(rangeFrom) && c.card_number <= parseInt(rangeTo)).length} cartelas serão excluídas
              </span>
            )}
          </div>
        )}

        {/* Cards list */}
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-80 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : cards.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <p>Nenhuma cartela gerada ainda.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {cards.map((card, idx) => (
              <motion.div
                key={card.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
              >
                <Card className={`overflow-hidden transition-all ${selectedIds.has(card.id) ? "ring-2 ring-primary" : ""}`}>
                  <UiCardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={selectedIds.has(card.id)}
                          onCheckedChange={() => toggleSelect(card.id)}
                          className="shrink-0"
                        />
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="w-3.5 h-3.5 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{card.player_name}</p>
                          <p className="text-xs text-muted-foreground">
                            Cartela #{card.card_number} · {card.chances === 2 ? "2 chances" : "1 chance"}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(card.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </UiCardHeader>
                  <CardContent>
                    <CardHeader game={game} card={card} />
                    <div className={`flex ${card.chances === 2 ? "gap-3 justify-center" : "justify-center"}`}>
                      <BingoGrid
                        numbers={card.grid_1}
                        drawnNumbers={game?.drawn_numbers || []}
                        label={card.chances === 2 ? "Chance 1" : undefined}
                        compact={card.chances === 2}
                      />
                      {card.chances === 2 && card.grid_2 && (
                        <BingoGrid
                          numbers={card.grid_2}
                          drawnNumbers={game?.drawn_numbers || []}
                          label="Chance 2"
                          compact
                        />
                      )}
                    </div>
                    <CardFooter card={card} />
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
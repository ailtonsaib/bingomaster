import { useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader as UiCardHeader, CardTitle } from "@/components/ui/card";
// CardHeader/CardFooter/BingoGrid removed — grid view only
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Printer, Trash2, User, Zap, CheckSquare, Square, XCircle, Upload, Filter, FileText } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { generateBingoGrid, checkBingo } from "@/lib/bingoUtils";
import BulkGenerateModal from "@/components/bingo/BulkGenerateModal";
import SellCardModal from "@/components/bingo/SellCardModal";
import { motion } from "framer-motion";
import { useMemo } from "react";

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
  const [sellCard, setSellCard] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [sellerFilter, setSellerFilter] = useState("");
  const fileInputRef = useRef(null);

  const { data: game } = useQuery({
    queryKey: ["game", gameId],
    queryFn: () => base44.entities.BingoGame.filter({ id: gameId }),
    select: (data) => data[0],
  });

  const { data: cards = [], isLoading } = useQuery({
    queryKey: ["cards", gameId],
    queryFn: () => base44.entities.BingoCard.filter({ game_id: String(gameId) }),
  });

  const { data: sellers = [] } = useQuery({
    queryKey: ["sellers"],
    queryFn: () => base44.entities.Seller.list(),
  });

  const drawnSet = useMemo(() => new Set(game?.drawn_numbers || []), [game?.drawn_numbers]);

  const isCardWinner = (card) => {
    if (!game?.drawn_numbers?.length) return false;
    const grids = [card.grid_1a, card.grid_1b, card.grid_1c, card.grid_2a, card.grid_2b, card.grid_2c, card.grid_3a, card.grid_3b, card.grid_3c, card.grid_1, card.grid_2, card.grid_3].filter(Boolean);
    return grids.some((g) => checkBingo(g, drawnSet, "full")) || card.is_winner;
  };

  const filteredCards = useMemo(() => {
    let result = [...cards];
    if (sellerFilter) {
      const seller = sellers.find((s) => s.id === sellerFilter);
      if (seller) {
        result = result.filter((c) => c.player_phone === seller.phone || c.player_city === seller.city);
      }
    }
    return result.sort((a, b) => (a.card_number || 0) - (b.card_number || 0));
  }, [cards, sellers, sellerFilter]);

  const handleGenerate = async () => {
    if (!playerName.trim()) return;
    setGenerating(true);
    const qty = Math.min(Math.max(parseInt(quantity) || 1, 1), 20);
    const chancesNum = parseInt(chances);
    const nextNum = cards.length > 0 ? Math.max(...cards.map((c) => c.card_number || 0)) + 1 : 1;

    const newCards = [];
    for (let i = 0; i < qty; i++) {
      const g1a = generateBingoGrid();
      const cardData = {
        game_id: String(gameId),
        player_name: playerName.trim(),
        player_phone: playerPhone.trim(),
        player_city: playerCity.trim(),
        player_state: playerState.trim(),
        chances: chancesNum,
        grid_1a: g1a, grid_1b: g1a, grid_1c: g1a,
        grid_1: g1a, // legacy compat
        card_number: nextNum + i,
      };
      if (chancesNum >= 2) {
        const g2a = generateBingoGrid();
        cardData.grid_2a = g2a; cardData.grid_2b = g2a; cardData.grid_2c = g2a;
        cardData.grid_2 = g2a;
      }
      if (chancesNum >= 3) {
        const g3a = generateBingoGrid();
        cardData.grid_3a = g3a; cardData.grid_3b = g3a; cardData.grid_3c = g3a;
        cardData.grid_3 = g3a;
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
        const g1a = generateBingoGrid();
        const cardData = {
          game_id: String(gameId),
          player_name: `${prefix} ${nextNum + idx}`,
          chances,
          grid_1a: g1a, grid_1b: g1a, grid_1c: g1a,
          grid_1: g1a,
          card_number: nextNum + idx,
        };
        if (chances >= 2) {
          const g2a = generateBingoGrid();
          cardData.grid_2a = g2a; cardData.grid_2b = g2a; cardData.grid_2c = g2a;
          cardData.grid_2 = g2a;
        }
        if (chances >= 3) {
          const g3a = generateBingoGrid();
          cardData.grid_3a = g3a; cardData.grid_3b = g3a; cardData.grid_3c = g3a;
          cardData.grid_3 = g3a;
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

  const handleDeleteSold = async () => {
    if (!window.confirm(`Deseja excluir ${cards.filter((c) => c.player_phone || c.player_city).length} cartela(s) vendida(s)?`)) return;
    setDeleting(true);
    const toDelete = cards.filter((c) => c.player_phone || c.player_city);
    for (const card of toDelete) {
      try { await base44.entities.BingoCard.delete(card.id); } catch (e) { /* ignore */ }
    }
    setDeleting(false);
    queryClient.invalidateQueries({ queryKey: ["cards", gameId] });
  };

  const handleGenerateReport = async () => {
    try {
      const response = await base44.functions.invoke('generateDistributionReport', {});
      const binaryString = atob(response.data.pdf);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `relatorio_distribuicao_${new Date().toISOString().split('T')[0]}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      alert('Erro ao gerar relatório. Tente novamente.');
    }
  };

  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (!Array.isArray(data)) {
          alert("Formato de arquivo inválido");
          return;
        }

        const newCards = [];
        for (const item of data) {
          const g1a = generateBingoGrid();
          const cardData = {
            game_id: String(gameId),
            player_name: item.player_name || "",
            player_phone: item.player_phone || "",
            player_city: item.player_city || "",
            player_state: item.player_state || "",
            chances: item.chances || 1,
            grid_1a: g1a, grid_1b: g1a, grid_1c: g1a,
            grid_1: g1a,
            card_number: item.card_number || (cards.length + newCards.length + 1),
          };
          if (item.chances >= 2) {
            const g2a = generateBingoGrid();
            cardData.grid_2a = g2a; cardData.grid_2b = g2a; cardData.grid_2c = g2a;
            cardData.grid_2 = g2a;
          }
          if (item.chances >= 3) {
            const g3a = generateBingoGrid();
            cardData.grid_3a = g3a; cardData.grid_3b = g3a; cardData.grid_3c = g3a;
            cardData.grid_3 = g3a;
          }
          newCards.push(cardData);
        }

        await base44.entities.BingoCard.bulkCreate(newCards);
        queryClient.invalidateQueries({ queryKey: ["cards", gameId] });
        setShowImport(false);
        alert(`${newCards.length} cartela(s) importada(s) com sucesso!`);
      } catch (error) {
        alert("Erro ao importar arquivo: " + error.message);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-2">
              <ArrowLeft className="w-4 h-4" /> Voltar ao Painel
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
            <Button
              variant="outline"
              className="gap-2"
              onClick={handleGenerateReport}
            >
              <FileText className="w-4 h-4 text-primary" /> Relatório
            </Button>
            <Badge variant="outline" className="text-sm">
              {filteredCards.length} cartelas{sellerFilter ? ` (${cards.length} total)` : ""}
            </Badge>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => setShowImport(true)}
            >
              <Upload className="w-4 h-4 text-primary" /> Importar
            </Button>
          </div>
        </div>

        {sellCard && (
          <SellCardModal
            card={sellCard}
            onClose={() => setSellCard(null)}
            onSaved={() => queryClient.invalidateQueries({ queryKey: ["cards", gameId] })}
          />
        )}

        <BulkGenerateModal
          open={bulkOpen}
          onClose={() => setBulkOpen(false)}
          onGenerate={handleBulkGenerate}
          generating={generating}
          nextCardNumber={cards.length > 0 ? Math.max(...cards.map((c) => c.card_number || 0)) + 1 : 1}
        />

        {showImport && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-background rounded-xl max-w-md w-full p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold font-heading">Importar Cartelas</h2>
                <button onClick={() => setShowImport(false)} className="text-muted-foreground">
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-muted-foreground">
                Selecione um arquivo JSON exportado com cartelas vendidas
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImportFile}
                className="hidden"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                className="w-full gap-2"
              >
                <Upload className="w-4 h-4" />
                Selecionar Arquivo
              </Button>
              <div className="text-xs text-muted-foreground bg-muted p-3 rounded-lg">
                <p className="font-medium mb-1">Formato esperado:</p>
                <p>Arquivo JSON com array de cartelas contendo: card_number, player_name, player_phone, player_city, player_state, chances</p>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setShowImport(false)} className="flex-1">
                  Cancelar
                </Button>
              </div>
            </div>
          </div>
        )}

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
                  <div className="flex items-center gap-1.5">
                    <RadioGroupItem value="3" id="c3" />
                    <Label htmlFor="c3" className="text-sm cursor-pointer">3 chances</Label>
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
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <Label className="text-sm">Filtrar por vendedor:</Label>
              <select
                value={sellerFilter}
                onChange={(e) => setSellerFilter(e.target.value)}
                className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Todos os vendedores</option>
                {sellers.map((seller) => (
                  <option key={seller.id} value={seller.id}>
                    {seller.name}
                  </option>
                ))}
              </select>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={selectedIds.size === filteredCards.length ? clearSelection : selectAll}>
              {selectedIds.size === filteredCards.length ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
              {selectedIds.size === filteredCards.length ? "Desmarcar todas" : "Selecionar todas"}
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
              className="gap-1.5"
              onClick={handleDeleteSold}
              disabled={deleting || cards.filter((c) => c.player_phone || c.player_city).length === 0}
            >
              <Trash2 className="w-4 h-4 text-destructive" /> Excluir vendidas ({cards.filter((c) => c.player_phone || c.player_city).length})
            </Button>
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
          <div className="grid gap-3 grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
            {[...Array(20)].map((_, i) => (
              <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : cards.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <p>Nenhuma cartela gerada ainda.</p>
          </div>
        ) : (
          <div className="grid gap-2 grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12">
            {filteredCards.map((card) => {
              const winner = isCardWinner(card);
              return (
                <div
                  key={card.id}
                  className={`relative group flex flex-col items-center justify-center rounded-lg border p-2 cursor-pointer transition-all select-none
                    ${selectedIds.has(card.id) ? "bg-primary text-primary-foreground border-primary ring-2 ring-primary" :
                      winner ? "bg-yellow-50 border-yellow-400 ring-1 ring-yellow-300 dark:bg-yellow-900/20 dark:border-yellow-500" :
                      card.player_phone || card.player_city ? "bg-green-50 border-green-300 dark:bg-green-900/20 dark:border-green-700" :
                      "bg-card hover:bg-muted/60 border-border"}`}
                  onClick={() => setSellCard(card)}
                >
                  {winner && (
                    <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 text-[9px] font-bold bg-yellow-400 text-yellow-900 px-1 rounded-full leading-4 whitespace-nowrap">
                      🏆 Premiada
                    </span>
                  )}
                  <span className={`text-xs font-bold leading-none ${winner ? "mt-1" : ""}`}>
                    {String(card.card_number || "").padStart(3, "0")}
                  </span>
                  <span className="text-[10px] text-current opacity-60 mt-0.5 truncate w-full text-center">
                    {card.player_name}
                  </span>
                  <button
                    className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 text-destructive"
                    onClick={(e) => { e.stopPropagation(); handleDelete(card.id); }}
                    title="Excluir"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
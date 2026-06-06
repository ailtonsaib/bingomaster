import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronDown, Search } from "lucide-react";

export default function AddSellerSection({ sellers, cards, assigned, onAdd }) {
  const [search, setSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedSeller, setSelectedSeller] = useState(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return sellers;
    const q = search.toLowerCase();
    return sellers.filter((s) => s.name.toLowerCase().includes(q));
  }, [sellers, search]);

  const fromN = parseInt(from) || null;
  const toN = parseInt(to) || null;
  const valid = selectedSeller && fromN && toN && fromN <= toN;
  const count = valid ? toN - fromN + 1 : 0;

  // Build list of already-taken card ranges
  const takenRanges = useMemo(() => {
    const ranges = [];
    // Ranges from current session (assigned) — exclude current seller's own range
    (assigned || []).forEach((a) => {
      if (selectedSeller && a.seller.id === selectedSeller.id) return;
      ranges.push({ from: a.from, to: a.to, label: a.seller.name });
    });
    // Ranges from cards already saved in DB with player_name set
    // Group consecutive card numbers by seller
    const dbCards = cards
      .filter((c) => c.player_name)
      .sort((a, b) => (a.card_number || 0) - (b.card_number || 0));

    if (dbCards.length > 0) {
      let currentRange = null;
      dbCards.forEach((c) => {
        const num = c.card_number || 0;
        const name = c.player_name;
        if (currentRange && currentRange.label === name && num === currentRange.to + 1) {
          currentRange.to = num;
        } else {
          if (currentRange) ranges.push(currentRange);
          currentRange = { from: num, to: num, label: name };
        }
      });
      if (currentRange) ranges.push(currentRange);
    }
    return ranges;
  }, [assigned, cards, selectedSeller]);

  // Check if current range overlaps with any taken range
  const overlapError = useMemo(() => {
    if (!valid) return null;
    const overlap = takenRanges.find((r) => fromN <= r.to && toN >= r.from);
    return overlap ? `Conflito: cartelas ${overlap.from}-${overlap.to} já foram distribuídas para ${overlap.label}` : null;
  }, [valid, fromN, toN, takenRanges]);

  // Find already assigned cards to this seller for this game
  const sellerCards = selectedSeller
    ? cards.filter((c) => c.player_name === selectedSeller.name || c.player_phone === selectedSeller.phone)
    : [];

  const handleAdd = () => {
    if (!valid || overlapError) return;
    onAdd(selectedSeller, fromN, toN);
    setSelectedSeller(null);
    setSearch("");
    setFrom("");
    setTo("");
    setShowDropdown(false);
  };

  return (
    <div className="px-5 py-4 border-b space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold flex items-center gap-1.5">
          <span className="text-primary text-base">+</span> Adicionar Vendedor
        </p>
        {count > 0 && (
          <span className="text-sm font-bold text-green-600">{count} cartela(s)</span>
        )}
      </div>

      <div className="space-y-2">
        {/* Seller dropdown */}
        <div className="relative">
          <button
            type="button"
            className="w-full flex items-center justify-between h-11 px-3 rounded-lg border-2 border-purple-400 bg-background text-sm hover:bg-accent transition-colors"
            onClick={() => setShowDropdown((v) => !v)}
          >
            <span className={selectedSeller ? "text-foreground font-medium" : "text-muted-foreground"}>
              {selectedSeller ? selectedSeller.name : "Escolha um vendedor cadastrado..."}
            </span>
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </button>

          {showDropdown && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-background border rounded-xl shadow-lg max-h-56 overflow-auto">
              <div className="p-2 border-b sticky top-0 bg-background">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Buscar vendedor..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-9 text-sm pl-8"
                    autoFocus
                  />
                </div>
              </div>
              {filtered.length === 0 ? (
                <div className="text-xs text-muted-foreground text-center py-4">Nenhum vendedor encontrado</div>
              ) : (
                filtered.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent transition-colors flex items-center justify-between"
                    onClick={() => {
                      setSelectedSeller(s);
                      setSearch("");
                      setShowDropdown(false);
                    }}
                  >
                    <span className="font-medium">{s.name}</span>
                    {selectedSeller?.id === s.id && (
                      <span className="text-primary text-xs font-bold">✓</span>
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Range inputs */}
        <div className="flex gap-2 items-center">
          <Input
            type="number"
            inputMode="numeric"
            className="flex-1 text-center text-sm font-bold"
            placeholder="Cartela De (nº)"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <span className="text-muted-foreground text-sm">até</span>
          <Input
            type="number"
            inputMode="numeric"
            className="flex-1 text-center text-sm font-bold"
            placeholder="Cartela Até (nº)"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
          <Button
            className="bg-purple-600 hover:bg-purple-700 text-white gap-1.5 whitespace-nowrap"
            onClick={handleAdd}
            disabled={!valid || !!overlapError}
          >
            <span className="text-lg leading-none">+</span> Adicionar
          </Button>
        </div>

        {/* Overlap error */}
        {overlapError && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
            {overlapError}
          </div>
        )}
      </div>

      {/* Show already assigned cards for selected seller */}
      {selectedSeller && sellerCards.length > 0 && (
        <div className="bg-purple-50 rounded-lg px-3 py-2 text-xs text-purple-700">
          Já possui <strong>{sellerCards.length}</strong> cartela(s) distribuída(s) neste evento
        </div>
      )}
    </div>
  );
}
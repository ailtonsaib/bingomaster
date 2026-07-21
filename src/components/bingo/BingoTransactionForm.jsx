import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

const INCOME_CATEGORIES = [
  { value: "venda_cartelas", label: "Venda de Cartelas" },
  { value: "venda_ingressos", label: "Venda de Ingressos" },
  { value: "doacao", label: "Doação" },
  { value: "outra_receita", label: "Outra Receita" },
];

const EXPENSE_CATEGORIES = [
  { value: "papel", label: "Papel" },
  { value: "impressao", label: "Impressão de Cartelas" },
  { value: "propaganda", label: "Propaganda / Divulgação" },
  { value: "bebidas", label: "Bebidas" },
  { value: "salgados", label: "Salgados" },
  { value: "alimentacao", label: "Alimentação (geral)" },
  { value: "material_escritorio", label: "Material de Escritório" },
  { value: "premios", label: "Prêmios" },
  { value: "aluguel", label: "Aluguel do Espaço" },
  { value: "decoracao", label: "Decoração" },
  { value: "som_iluminacao", label: "Som e Iluminação" },
  { value: "transporte", label: "Transporte" },
  { value: "outra_despesa", label: "Outra Despesa" },
];

const PAYMENT_METHODS = [
  { value: "dinheiro", label: "Dinheiro" },
  { value: "pix", label: "PIX" },
  { value: "cartao", label: "Cartão" },
  { value: "boleto", label: "Boleto" },
  { value: "transferencia", label: "Transferência" },
];

export default function BingoTransactionForm({ games, onSave, onClose }) {
  const today = new Date().toISOString().slice(0, 10);
  const [type, setType] = useState("income");
  const [category, setCategory] = useState("venda_cartelas");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [date, setDate] = useState(today);
  const [paymentMethod, setPaymentMethod] = useState("dinheiro");
  const [supplier, setSupplier] = useState("");
  const [gameId, setGameId] = useState("");
  const [saving, setSaving] = useState(false);

  const categories = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const handleTypeChange = (newType) => {
    setType(newType);
    setCategory(newType === "income" ? "venda_cartelas" : "papel");
  };

  // Calcula valor total automaticamente quando quantidade e preço unitário são preenchidos
  const handleQuantityChange = (val) => {
    setQuantity(val);
    const q = parseFloat(val) || 0;
    const u = parseFloat(unitPrice) || 0;
    if (q > 0 && u > 0) setAmount((q * u).toFixed(2));
  };

  const handleUnitPriceChange = (val) => {
    setUnitPrice(val);
    const q = parseFloat(quantity) || 0;
    const u = parseFloat(val) || 0;
    if (q > 0 && u > 0) setAmount((q * u).toFixed(2));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!description.trim() || !numAmount || numAmount <= 0) return;

    setSaving(true);
    const selectedGame = games?.find((g) => String(g.id) === String(gameId));
    await onSave({
      type,
      category,
      description: description.trim(),
      amount: numAmount,
      quantity: parseFloat(quantity) || 0,
      unit_price: parseFloat(unitPrice) || 0,
      date: new Date(date).toISOString(),
      payment_method: paymentMethod,
      supplier: supplier.trim(),
      game_id: gameId || "",
      game_name: selectedGame?.name || "",
    });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-background rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-background flex items-center justify-between p-5 border-b z-10">
          <h2 className="text-lg font-bold font-heading">Nova Movimentação</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Tipo */}
          <div>
            <Label className="mb-2 block text-sm font-medium">Tipo de Movimentação</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleTypeChange("income")}
                className={`rounded-xl px-4 py-3 text-sm font-bold transition-all border ${
                  type === "income"
                    ? "bg-emerald-500 border-emerald-500 text-white"
                    : "bg-muted border-border text-muted-foreground hover:bg-muted/70"
                }`}
              >
                Receita
              </button>
              <button
                type="button"
                onClick={() => handleTypeChange("expense")}
                className={`rounded-xl px-4 py-3 text-sm font-bold transition-all border ${
                  type === "expense"
                    ? "bg-red-500 border-red-500 text-white"
                    : "bg-muted border-border text-muted-foreground hover:bg-muted/70"
                }`}
              >
                Despesa
              </button>
            </div>
          </div>

          {/* Categoria */}
          <div>
            <Label className="mb-1.5 block text-sm font-medium">Categoria</Label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            >
              {categories.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* Descrição */}
          <div>
            <Label className="mb-1.5 block text-sm font-medium">Descrição *</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={type === "income" ? "Ex: Venda de 50 cartelas no evento" : "Ex: Compra de papel A4 para impressão"}
              required
            />
          </div>

          {/* Jogo vinculado */}
          {games && games.length > 0 && (
            <div>
              <Label className="mb-1.5 block text-sm font-medium">Jogo Vinculado (opcional)</Label>
              <select
                value={gameId}
                onChange={(e) => setGameId(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="">Nenhum jogo específico</option>
                {games.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Quantidade e Preço Unitário */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block text-sm font-medium">Quantidade</Label>
              <Input
                type="number"
                min="0"
                step="1"
                value={quantity}
                onChange={(e) => handleQuantityChange(e.target.value)}
                placeholder="Ex: 50"
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-sm font-medium">Preço Unitário (R$)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={unitPrice}
                onChange={(e) => handleUnitPriceChange(e.target.value)}
                placeholder="Ex: 2.50"
              />
            </div>
          </div>

          {/* Valor Total */}
          <div>
            <Label className="mb-1.5 block text-sm font-medium">Valor Total (R$) *</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
              required
            />
            {quantity && unitPrice && (
              <p className="text-xs text-muted-foreground mt-1">
                Calculado automaticamente: {parseFloat(quantity) || 0} × R$ {(parseFloat(unitPrice) || 0).toFixed(2)}
              </p>
            )}
          </div>

          {/* Data e Forma de Pagamento */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block text-sm font-medium">Data</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-sm font-medium">Forma de Pagamento</Label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Fornecedor (apenas para despesas) */}
          {type === "expense" && (
            <div>
              <Label className="mb-1.5 block text-sm font-medium">Fornecedor / Estabelecimento</Label>
              <Input
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="Ex: Gráfica Silva, Mercado São João"
              />
            </div>
          )}

          {/* Botões */}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              className={`flex-1 ${type === "income" ? "bg-emerald-500 hover:bg-emerald-600" : "bg-red-500 hover:bg-red-600"}`}
              disabled={saving || !description.trim() || !amount}
            >
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
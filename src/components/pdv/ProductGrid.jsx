import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Search, Package } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function ProductGrid({ user, onAddToCart }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const loadProducts = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const items = await base44.entities.PDVProduct.filter(
        { user_email: user.email, is_active: true },
        "-created_date",
        200
      );
      setProducts(items);
    } catch (e) {
      console.error("Erro ao carregar produtos:", e);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  const filtered = products.filter(p =>
    !search ||
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.barcode && p.barcode.includes(search))
  );

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && filtered.length === 1) {
      onAddToCart(filtered[0]);
      setSearch("");
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pl-10 h-11"
            placeholder="Buscar produto ou código de barras (Enter para adicionar)"
            autoFocus
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-2 border-gray-300 border-t-orange-500 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-400">
            <Package className="w-8 h-8 mb-2" />
            <p className="text-sm">Nenhum produto encontrado</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {filtered.map(p => (
              <button
                key={p.id}
                onClick={() => onAddToCart(p)}
                disabled={p.stock <= 0}
                className="flex flex-col items-center p-3 rounded-lg border bg-white hover:border-orange-400 hover:shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Package className="w-8 h-8 text-orange-500 mb-2" />
                <p className="text-xs font-medium text-center line-clamp-2 mb-1">{p.name}</p>
                <p className="text-sm font-bold text-orange-600">
                  R$ {p.price.toFixed(2).replace(".", ",")}
                </p>
                <p className={`text-xs ${p.stock > 0 ? "text-gray-400" : "text-red-400"}`}>
                  Estoque: {p.stock}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
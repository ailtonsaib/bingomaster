import { useMemo } from "react";
import { fmtMoney, typeLabel, typeColor, fmtDate } from "@/lib/erpUtils";
import { Package, AlertTriangle, TrendingUp, Factory, ShoppingCart, Boxes, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";

export default function ErpDashboard({ products, purchases, productions }) {
  const stats = useMemo(() => {
    const stockValue = products.reduce((s, p) => s + (Number(p.stock) || 0) * (Number(p.cost_price) || 0), 0);
    const lowStock = products.filter(p => Number(p.stock || 0) <= Number(p.min_stock || 0) && p.product_type !== "servico");
    const openPurchases = purchases.filter(p => p.status === "enviada" || p.status === "recebida_parcial");
    const openProductions = productions.filter(p => p.status === "em_producao");
    const purchasesValue = openPurchases.reduce((s, p) => s + (Number(p.total_value) || 0), 0);
    const byType = {};
    products.forEach(p => { byType[p.product_type] = (byType[p.product_type] || 0) + 1; });
    return { stockValue, lowStock, openPurchases, openProductions, purchasesValue, byType, totalProducts: products.length };
  }, [products, purchases, productions]);

  const cards = [
    { label: "Produtos cadastrados", value: stats.totalProducts, icon: Boxes, color: "text-blue-600 bg-blue-50" },
    { label: "Valor em estoque", value: fmtMoney(stats.stockValue), icon: TrendingUp, color: "text-emerald-600 bg-emerald-50" },
    { label: "Itens em falta", value: stats.lowStock.length, icon: AlertTriangle, color: "text-amber-600 bg-amber-50" },
    { label: "Compras em aberto", value: stats.openPurchases.length, icon: ShoppingCart, color: "text-indigo-600 bg-indigo-50" },
    { label: "Produções ativas", value: stats.openProductions.length, icon: Factory, color: "text-purple-600 bg-purple-50" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {cards.map(c => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="bg-white rounded-xl border p-4">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2 ${c.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <p className="text-xs text-gray-500">{c.label}</p>
              <p className="text-lg font-bold">{c.value}</p>
            </div>
          );
        })}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Estoque baixo */}
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="flex items-center gap-2 p-3 border-b bg-amber-50">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <h3 className="font-semibold text-sm">Estoque baixo ({stats.lowStock.length})</h3>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {stats.lowStock.length === 0 ? (
              <p className="p-4 text-sm text-gray-400 text-center">Nenhum item em falta.</p>
            ) : stats.lowStock.map(p => (
              <div key={p.id} className="flex items-center justify-between px-3 py-2 border-b text-sm">
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-gray-500">{typeLabel(p.product_type)} • {p.code || "—"}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-amber-700">{p.stock} {p.unit}</p>
                  <p className="text-xs text-gray-400">mín. {p.min_stock}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Distribuição por tipo */}
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="flex items-center gap-2 p-3 border-b bg-blue-50">
            <Package className="w-4 h-4 text-blue-600" />
            <h3 className="font-semibold text-sm">Produtos por tipo</h3>
          </div>
          <div className="p-3 space-y-2">
            {Object.entries(stats.byType).length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Nenhum produto cadastrado.</p>
            ) : Object.entries(stats.byType).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between">
                <span className={`text-xs px-2 py-1 rounded-full border ${typeColor(k)}`}>{typeLabel(k)}</span>
                <span className="font-bold text-sm">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Produções ativas */}
      {stats.openProductions.length > 0 && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="flex items-center gap-2 p-3 border-b bg-purple-50">
            <Factory className="w-4 h-4 text-purple-600" />
            <h3 className="font-semibold text-sm">Ordens de produção em andamento</h3>
          </div>
          <div className="divide-y">
            {stats.openProductions.map(op => (
              <div key={op.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <div>
                  <p className="font-medium">{op.order_number} — {op.output_product_name}</p>
                  <p className="text-xs text-gray-500">Início: {fmtDate(op.start_date)} • Planejado: {op.output_quantity} {op.bom_items?.length || 0} insumo(s)</p>
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">Em produção</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
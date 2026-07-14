import { Trash2, ShoppingCart, Minus, Plus } from "lucide-react";

export default function CartPanel({ cart, onRemove, onQtyChange, onCheckout, onClear }) {
  const subtotal = cart.reduce((s, i) => s + i.total, 0);
  const itemCount = cart.reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b bg-orange-50">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-orange-500" />
            Carrinho
          </h3>
          {cart.length > 0 && (
            <button onClick={onClear} className="text-xs text-red-500 hover:text-red-700">
              Limpar
            </button>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-1">{itemCount} {itemCount === 1 ? "item" : "itens"}</p>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-300">
            <ShoppingCart className="w-12 h-12 mb-2" />
            <p className="text-sm">Carrinho vazio</p>
          </div>
        ) : (
          cart.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2 p-2 border-b">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.product_name}</p>
                <p className="text-xs text-gray-500">
                  R$ {item.unit_price.toFixed(2).replace(".", ",")} cada
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => onQtyChange(idx, -1)} className="p-1 rounded hover:bg-gray-100">
                  <Minus className="w-3 h-3" />
                </button>
                <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                <button onClick={() => onQtyChange(idx, 1)} className="p-1 rounded hover:bg-gray-100">
                  <Plus className="w-3 h-3" />
                </button>
              </div>
              <div className="text-right w-20">
                <p className="text-sm font-bold">
                  R$ {item.total.toFixed(2).replace(".", ",")}
                </p>
              </div>
              <button onClick={() => onRemove(idx)} className="p-1 text-red-400 hover:text-red-600">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
      <div className="p-3 border-t bg-white">
        <div className="flex items-center justify-between mb-3">
          <span className="text-lg font-semibold">Total:</span>
          <span className="text-2xl font-bold text-orange-600">
            R$ {subtotal.toFixed(2).replace(".", ",")}
          </span>
        </div>
        <button
          onClick={onCheckout}
          disabled={cart.length === 0}
          className="w-full h-12 text-base font-medium text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          style={{ backgroundColor: "#EA580C" }}
        >
          Finalizar Venda
        </button>
      </div>
    </div>
  );
}
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { ArrowLeft, ShoppingCart, Package, Receipt, LogOut, Building2, Users, FileInput, Percent, FileOutput, FileCheck, Scale, FileBarChart, Settings } from "lucide-react";
import { getPortalUser, clearPortalUser } from "@/lib/portalSession";
import ProductGrid from "@/components/pdv/ProductGrid";
import CartPanel from "@/components/pdv/CartPanel";
import CheckoutModal from "@/components/pdv/CheckoutModal";
import ProductManager from "@/components/pdv/ProductManager";
import SalesHistory from "@/components/pdv/SalesHistory";
import SupplierManager from "@/components/pdv/SupplierManager";
import CustomerManager from "@/components/pdv/CustomerManager";
import EntryOperations from "@/components/pdv/EntryOperations";
import TaxParameterManager from "@/components/pdv/TaxParameterManager";
import ExitOrderManager from "@/components/pdv/ExitOrderManager";
import ExitTaxParameterManager from "@/components/pdv/ExitTaxParameterManager";
import MonofasicTaxManager from "@/components/pdv/MonofasicTaxManager";
import TaxReportPanel from "@/components/pdv/TaxReportPanel";
import CompanyConfigModal from "@/components/pdv/CompanyConfigModal";

export default function PDV() {
  const navigate = useNavigate();
  const [user, setUser] = useState(getPortalUser());
  const [cart, setCart] = useState([]);
  const [showCheckout, setShowCheckout] = useState(false);
  const [activeTab, setActiveTab] = useState("caixa");
  const [showCompanyConfig, setShowCompanyConfig] = useState(false);

  useEffect(() => {
    if (!user) navigate("/pdv");
  }, [user, navigate]);

  if (!user) return null;

  const handleLogout = () => {
    clearPortalUser();
    navigate("/pdv");
  };

  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.findIndex(i => i.product_id === product.id);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing].quantity += 1;
        updated[existing].total = updated[existing].quantity * updated[existing].unit_price;
        return updated;
      }
      return [...prev, {
        product_id: product.id,
        product_name: product.name,
        barcode: product.barcode || "",
        quantity: 1,
        unit_price: product.price,
        total: product.price,
      }];
    });
  };

  const handleQtyChange = (idx, delta) => {
    setCart(prev => {
      const updated = [...prev];
      updated[idx].quantity += delta;
      if (updated[idx].quantity <= 0) {
        return updated.filter((_, i) => i !== idx);
      }
      updated[idx].total = updated[idx].quantity * updated[idx].unit_price;
      return updated;
    });
  };

  const handleRemove = (idx) => {
    setCart(prev => prev.filter((_, i) => i !== idx));
  };

  const total = cart.reduce((s, i) => s + i.total, 0);

  const handleCheckout = async (payment) => {
    const sale = {
      user_email: user.email,
      operator_name: user.name,
      items: cart,
      subtotal: total,
      discount: 0,
      total,
      payment_method: payment.payment_method,
      payment_amount: payment.payment_amount,
      change_amount: payment.change_amount,
      status: "concluida",
      sale_date: new Date().toISOString(),
    };
    await base44.entities.PDVSale.create(sale);
    // Decrement stock
    for (const item of cart) {
      try {
        const product = await base44.entities.PDVProduct.get(item.product_id);
        await base44.entities.PDVProduct.update(item.product_id, {
          stock: Math.max(0, (product.stock || 0) - item.quantity),
        });
      } catch (e) { console.error("Erro ao atualizar estoque:", e); }
    }
    setCart([]);
    setShowCheckout(false);
    setActiveTab("vendas");
  };

  const tabs = [
    { id: "caixa", label: "Caixa", icon: ShoppingCart },
    { id: "produtos", label: "Produtos", icon: Package },
    { id: "vendas", label: "Vendas", icon: Receipt },
    { id: "entradas", label: "Entradas", icon: FileInput },
    { id: "saidas", label: "Saídas", icon: FileOutput },
    { id: "trib-entrada", label: "Trib. Entrada", icon: Percent },
    { id: "trib-saida", label: "Trib. Saída", icon: FileCheck },
    { id: "monofasicos", label: "Monofásicos", icon: Scale },
    { id: "relatorio-trib", label: "Rel. Tributário", icon: FileBarChart },
    { id: "fornecedores", label: "Fornecedores", icon: Building2 },
    { id: "clientes", label: "Clientes", icon: Users },
  ];

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/portal")} className="p-1 hover:bg-gray-100 rounded">
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </button>
          <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
            <ShoppingCart className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h1 className="font-bold text-lg">PDV — Frente de Caixa</h1>
            <p className="text-xs text-gray-500">{user.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowCompanyConfig(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
            <Settings className="w-4 h-4" /> Empresa
          </button>
          <button onClick={handleLogout} className="flex items-center gap-1 text-sm text-gray-500 hover:text-red-500">
            <LogOut className="w-4 h-4" /> Sair
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b px-4 flex gap-1 flex-shrink-0">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === t.id
                  ? "border-orange-500 text-orange-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "caixa" && (
          <div className="flex h-full">
            <div className="flex-1 border-r overflow-hidden">
              <ProductGrid user={user} onAddToCart={addToCart} />
            </div>
            <div className="w-80 sm:w-96 flex-shrink-0 bg-white">
              <CartPanel
                cart={cart}
                onRemove={handleRemove}
                onQtyChange={handleQtyChange}
                onCheckout={() => setShowCheckout(true)}
                onClear={() => setCart([])}
              />
            </div>
          </div>
        )}
        {activeTab === "produtos" && <ProductManager user={user} />}
        {activeTab === "vendas" && <SalesHistory user={user} />}
        {activeTab === "entradas" && <EntryOperations user={user} />}
        {activeTab === "saidas" && <ExitOrderManager user={user} />}
        {activeTab === "fornecedores" && <SupplierManager user={user} />}
        {activeTab === "clientes" && <CustomerManager user={user} />}
        {activeTab === "trib-entrada" && <TaxParameterManager user={user} />}
        {activeTab === "trib-saida" && <ExitTaxParameterManager user={user} />}
        {activeTab === "monofasicos" && <MonofasicTaxManager user={user} />}
        {activeTab === "relatorio-trib" && <TaxReportPanel user={user} />}
      </div>

      {showCheckout && (
        <CheckoutModal
          total={total}
          onClose={() => setShowCheckout(false)}
          onConfirm={handleCheckout}
        />
      )}
      {showCompanyConfig && (
        <CompanyConfigModal
          user={user}
          onClose={() => setShowCompanyConfig(false)}
        />
      )}
    </div>
  );
}
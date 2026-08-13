import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { ArrowLeft, Factory, LogOut, LayoutDashboard, Package, Truck, ShoppingCart, Boxes } from "lucide-react";
import { getPortalUser, clearPortalUser } from "@/lib/portalSession";
import ErpDashboard from "@/components/erp/ErpDashboard";
import ErpProductManager from "@/components/erp/ErpProductManager";
import ErpSupplierManager from "@/components/erp/ErpSupplierManager";
import ErpPurchasePanel from "@/components/erp/ErpPurchasePanel";
import ErpProductionPanel from "@/components/erp/ErpProductionPanel";

export default function Erp() {
  const navigate = useNavigate();
  const [user, setUser] = useState(getPortalUser());
  const [activeTab, setActiveTab] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [productions, setProductions] = useState([]);

  const loadDashboard = async () => {
    if (!user) return;
    try {
      const [p, pc, op] = await Promise.all([
        base44.entities.ErpProduct.filter({ user_email: user.email }, "-created_date", 500),
        base44.entities.ErpPurchaseOrder.filter({ user_email: user.email }, "-emission_date", 500),
        base44.entities.ErpProductionOrder.filter({ user_email: user.email }, "-emission_date", 500),
      ]);
      setProducts(p); setPurchases(pc); setProductions(op);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => {
    if (!user) { navigate("/erp"); return; }
    loadDashboard();
  }, [user, navigate]);

  if (!user) return null;

  const handleLogout = () => { clearPortalUser(); navigate("/erp"); };

  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "produtos", label: "Produtos", icon: Package },
    { id: "fornecedores", label: "Fornecedores", icon: Truck },
    { id: "compras", label: "Compras", icon: ShoppingCart },
    { id: "producao", label: "Produção", icon: Factory },
  ];

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <header className="bg-white border-b px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/portal")} className="p-1 hover:bg-gray-100 rounded"><ArrowLeft className="w-5 h-5 text-gray-500" /></button>
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center"><Factory className="w-5 h-5 text-emerald-600" /></div>
          <div>
            <h1 className="font-bold text-lg">ERP — Indústria & Comércio</h1>
            <p className="text-xs text-gray-500">{user.name} • Plano {user.erp_plan || "free"}</p>
          </div>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-1 text-sm text-gray-500 hover:text-red-500"><LogOut className="w-4 h-4" /> Sair</button>
      </header>

      <div className="bg-white border-b px-4 flex gap-1 flex-shrink-0 overflow-x-auto">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === t.id ? "border-emerald-500 text-emerald-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === "dashboard" && (loading ? <div className="flex justify-center py-16"><Boxes className="w-8 h-8 animate-spin text-emerald-600" /></div> : <ErpDashboard products={products} purchases={purchases} productions={productions} />)}
        {activeTab === "produtos" && <ErpProductManager user={user} />}
        {activeTab === "fornecedores" && <ErpSupplierManager user={user} />}
        {activeTab === "compras" && <ErpPurchasePanel user={user} />}
        {activeTab === "producao" && <ErpProductionPanel user={user} />}
      </div>
    </div>
  );
}
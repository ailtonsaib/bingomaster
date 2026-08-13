import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { ArrowLeft, ShoppingCart, Package, Receipt, LogOut, Users, FileInput, Percent, FileOutput, FileCheck, Scale, FileBarChart, Settings, Bell, Wallet, CalendarClock } from "lucide-react";
import { getPortalUser, clearPortalUser } from "@/lib/portalSession";
import ProductGrid from "@/components/pdv/ProductGrid";
import CartPanel from "@/components/pdv/CartPanel";
import CheckoutModal from "@/components/pdv/CheckoutModal";
import ProductManager from "@/components/pdv/ProductManager";
import SalesHistory from "@/components/pdv/SalesHistory";
import ContactManager from "@/components/pdv/ContactManager";
import EntryOperations from "@/components/pdv/EntryOperations";
import TaxParameterManager from "@/components/pdv/TaxParameterManager";
import ExitOrderManager from "@/components/pdv/ExitOrderManager";
import ExitTaxParameterManager from "@/components/pdv/ExitTaxParameterManager";
import MonofasicTaxManager from "@/components/pdv/MonofasicTaxManager";
import OperationManager from "@/components/pdv/OperationManager";
import TaxReportPanel from "@/components/pdv/TaxReportPanel";
import TaxAlertPanel from "@/components/pdv/TaxAlertPanel";
import CompanyConfigModal from "@/components/pdv/CompanyConfigModal";
import FinancePanel from "@/components/pdv/FinancePanel";
import ForecastReport from "@/components/pdv/ForecastReport";
import CupomResultModal from "@/components/pdv/CupomResultModal";
import DanfePrint from "@/components/pdv/DanfePrint";
import { buildFiscalItem, computeTotals } from "@/lib/pdvTaxCalc";

export default function PDV() {
  const navigate = useNavigate();
  const [user, setUser] = useState(getPortalUser());
  const [cart, setCart] = useState([]);
  const [showCheckout, setShowCheckout] = useState(false);
  const [activeTab, setActiveTab] = useState("caixa");
  const [showCompanyConfig, setShowCompanyConfig] = useState(false);
  const [companyConfig, setCompanyConfig] = useState(null);
  const [taxParams, setTaxParams] = useState([]);
  const [monofasicTaxes, setMonofasicTaxes] = useState([]);
  const [cupom, setCupom] = useState(null);
  const [cupomOrder, setCupomOrder] = useState(null);
  const [showDanfe, setShowDanfe] = useState(false);

  useEffect(() => {
    if (!user) { navigate("/pdv"); return; }
    (async () => {
      try {
        const [list, taxes, monofasic] = await Promise.all([
          base44.entities.PDVCompanyConfig.filter({ user_email: user.email }),
          base44.entities.PDVExitTaxParameter.filter({ user_email: user.email }),
          base44.entities.PDVMonofasicTax.filter({ user_email: user.email }),
        ]);
        if (list.length > 0) setCompanyConfig(list[0]);
        setTaxParams(taxes);
        setMonofasicTaxes(monofasic);
      } catch (e) { console.error(e); }
    })();
  }, [user, navigate]);

  const reloadCompanyConfig = async () => {
    try {
      const list = await base44.entities.PDVCompanyConfig.filter({ user_email: user.email });
      if (list.length > 0) setCompanyConfig(list[0]);
    } catch (e) { console.error(e); }
  };

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
        ncm: product.ncm || "",
        unit: product.unit || "UN",
        monofasic: product.monofasic === true,
        category: product.category || "",
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

    // Emissão de cupom fiscal (NFC-e) imediata
    if (payment.emit_nfce && companyConfig?.cnpj && companyConfig?.ie && companyConfig?.ibge_code) {
      const nfce = { number: null, serie: null, key: null, protocol: null, status: null, authorized: false, error: null };
      try {
        const fiscalItems = cart.map(i => buildFiscalItem(i, { companyConfig, taxParams, monofasicTaxes, customer: null, defaultCfop: "5102" }));
        const totals = computeTotals(fiscalItems);
        const order = await base44.entities.PDVExitOrder.create({
          user_email: user.email,
          customer_name: "Consumidor Final",
          order_number: `PDV-${Date.now()}`,
          order_date: new Date().toISOString(),
          cfop: "5102",
          nature_operation: "Venda de mercadoria",
          items: fiscalItems,
          total_products: totals.total_products,
          total_icms: totals.total_icms,
          total_ipi: totals.total_ipi,
          total_pis: totals.total_pis,
          total_cofins: totals.total_cofins,
          total_nota: totals.total_nota,
          status: "rascunho",
          payment_method: "0",
          buyer_type: "consumidor_final",
          notes: "Venda PDV — Cupom Fiscal",
        });
        const gen = await base44.functions.invoke("gerarNfeSaida", { order_id: order.id, modelo: "65" });
        if (gen.data?.success) {
          nfce.number = gen.data.nfe_number;
          nfce.serie = gen.data.nfe_series;
          nfce.key = gen.data.nfe_key;
          nfce.status = "NFC-e gerada — aguardando transmissão";
          const tr = await base44.functions.invoke("transmitirNfe", { order_id: order.id });
          const td = tr.data || {};
          if (td.success) {
            nfce.authorized = true;
            nfce.protocol = td.nProt;
            nfce.status = `${td.cStat} - ${td.xMotivo}`;
          } else {
            nfce.status = "Transmissão pendente: " + (td.statusText || td.error || "erro");
          }
        } else {
          nfce.error = gen.data?.error || "Erro ao gerar NFC-e";
          nfce.status = "Falha: " + nfce.error;
        }
        setCupomOrder(await base44.entities.PDVExitOrder.get(order.id));
      } catch (e) {
        nfce.status = "Erro: " + (e?.message || e);
        nfce.error = e?.message;
      }
      setCupom({ saleOk: true, nfce });
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
    { id: "operacoes", label: "Operações", icon: Settings },
    { id: "trib-entrada", label: "Trib. Entrada", icon: Percent },
    { id: "trib-saida", label: "Trib. Saída", icon: FileCheck },
    { id: "monofasicos", label: "Monofásicos", icon: Scale },
    { id: "relatorio-trib", label: "Rel. Tributário", icon: FileBarChart },
    { id: "alertas", label: "Alertas Trib.", icon: Bell },
    { id: "financeiro", label: "Financeiro", icon: Wallet },
    { id: "previsao", label: "Previsão", icon: CalendarClock },
    { id: "contatos", label: "Contatos", icon: Users },
  ];

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/portal")} className="p-1 hover:bg-gray-100 rounded">
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </button>
          {companyConfig?.logo_url ? (
            <div className="h-10 flex items-center">
              <img src={companyConfig.logo_url} alt="Logo" className="max-h-10 max-w-[160px] object-contain" />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-orange-600" />
            </div>
          )}
          <div>
            <h1 className="font-bold text-lg">{companyConfig?.nome_fantasia || companyConfig?.razao_social || "ERP — COMERCIAL"}</h1>
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
    {activeTab === "operacoes" && <OperationManager user={user} />}
        {activeTab === "contatos" && <ContactManager user={user} />}
        {activeTab === "trib-entrada" && <TaxParameterManager user={user} />}
        {activeTab === "trib-saida" && <ExitTaxParameterManager user={user} />}
        {activeTab === "monofasicos" && <MonofasicTaxManager user={user} />}
        {activeTab === "relatorio-trib" && <TaxReportPanel user={user} />}
        {activeTab === "alertas" && <TaxAlertPanel user={user} />}
        {activeTab === "financeiro" && <FinancePanel user={user} />}
        {activeTab === "previsao" && <ForecastReport user={user} />}
      </div>

      {showCheckout && (
        <CheckoutModal
          total={total}
          companyConfig={companyConfig}
          onClose={() => setShowCheckout(false)}
          onConfirm={handleCheckout}
        />
      )}
      {showCompanyConfig && (
        <CompanyConfigModal
          user={user}
          onClose={() => setShowCompanyConfig(false)}
          onSaved={reloadCompanyConfig}
        />
      )}
      {cupom && (
        <CupomResultModal
          result={cupom}
          onClose={() => { setCupom(null); setCupomOrder(null); }}
          onPrint={() => setShowDanfe(true)}
        />
      )}
      {showDanfe && cupomOrder && (
        <DanfePrint
          order={cupomOrder}
          company={companyConfig}
          onClose={() => setShowDanfe(false)}
        />
      )}
    </div>
  );
}
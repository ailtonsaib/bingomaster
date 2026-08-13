import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2, Search, Receipt, Send, UploadCloud, Download, Printer,
  CheckCircle2, AlertTriangle, Clock, XCircle, RefreshCw, Building,
  ChevronDown, ChevronRight
} from "lucide-react";
import DanfePrint from "@/components/pdv/DanfePrint";
import CompanyConfigModal from "@/components/pdv/CompanyConfigModal";
import { buildFiscalItem, computeTotals } from "@/lib/pdvTaxCalc";

const STATUS = {
  sem_nfce:    { label: "Sem NFC-e",      cls: "bg-gray-100 text-gray-600",     icon: Clock },
  gerando:     { label: "Gerando…",        cls: "bg-amber-100 text-amber-700",   icon: Loader2 },
  gerada:      { label: "Aguard. SEFAZ",  cls: "bg-blue-100 text-blue-700",     icon: UploadCloud },
  transmitindo:{ label: "Enviando…",       cls: "bg-blue-200 text-blue-800",     icon: Loader2 },
  autorizada:  { label: "Autorizada",      cls: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  rejeitada:   { label: "Rejeitada",       cls: "bg-red-100 text-red-600",       icon: XCircle },
};

function StatusBadge({ s }) {
  const cfg = STATUS[s] || STATUS.sem_nfce;
  const Icon = cfg.icon;
  const spin = s === "gerando" || s === "transmitindo";
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${cfg.cls}`}>
      <Icon className={`w-3 h-3 ${spin ? "animate-spin" : ""}`} />
      {cfg.label}
    </span>
  );
}

function getRowStatus(sale) {
  if (!sale._nfce_order_id) return "sem_nfce";
  if (!sale._nfce_key) return "sem_nfce";
  if (sale._nfce_protocol) return "autorizada";
  if (sale._nfce_status?.startsWith("Falha") || sale._nfce_status?.startsWith("Erro")) return "rejeitada";
  if (sale._nfce_status) return "gerada";
  return "sem_nfce";
}

export default function NfcePainel({ user }) {
  const [sales, setSales] = useState([]);
  const [orders, setOrders] = useState([]); // PDVExitOrders model=65
  const [taxParams, setTaxParams] = useState([]);
  const [monofasicTaxes, setMonofasicTaxes] = useState([]);
  const [companyConfig, setCompanyConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [working, setWorking] = useState({}); // saleId -> "gerando"|"transmitindo"
  const [expanded, setExpanded] = useState(null);
  const [printOrder, setPrintOrder] = useState(null);
  const [showConfig, setShowConfig] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [salesList, orderList, taxes, monofasic, configs] = await Promise.all([
        base44.entities.PDVSale.filter({ user_email: user.email }, "-sale_date", 100),
        base44.entities.PDVExitOrder.filter({ user_email: user.email, nfe_model: "65" }, "-order_date", 200),
        base44.entities.PDVExitTaxParameter.filter({ user_email: user.email }),
        base44.entities.PDVMonofasicTax.filter({ user_email: user.email }),
        base44.entities.PDVCompanyConfig.filter({ user_email: user.email }),
      ]);
      setTaxParams(taxes);
      setMonofasicTaxes(monofasic);
      setCompanyConfig(configs[0] || null);

      // Merge: link each sale with its NFC-e order (by sale_date proximity or order notes)
      // Orders com PDV-{saleId} no order_number são exatamente do checkout automático.
      // Para os demais, tentamos pelo número de pedido ou data.
      const byNote = {};
      orderList.forEach(o => {
        // order_number format: PDV-{timestamp}
        if (o.order_number?.startsWith("PDV-")) byNote[o.order_number] = o;
      });

      const merged = salesList.map(s => {
        // Attempt to find the NFC-e order created right around the same sale timestamp
        const saleTs = new Date(s.sale_date).getTime();
        const match = orderList.find(o => {
          const oTs = new Date(o.order_date).getTime();
          return Math.abs(oTs - saleTs) < 5000; // within 5s
        });
        return {
          ...s,
          _nfce_order_id: match?.id || null,
          _nfce_number: match?.nfe_number || null,
          _nfce_serie: match?.nfe_series || null,
          _nfce_key: match?.nfe_key || null,
          _nfce_protocol: match?.nfe_protocol || null,
          _nfce_status: match?.nfe_status || null,
          _nfce_order: match || null,
        };
      });
      setSales(merged);
      setOrders(orderList);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [user.email]);

  useEffect(() => { load(); }, [load]);

  const canEmit = !!(companyConfig?.cnpj && companyConfig?.ie && companyConfig?.ibge_code);

  // Build fiscal items from a PDVSale's cart items using stored tax params
  const buildFiscalItems = (sale) => {
    return (sale.items || []).map(i => buildFiscalItem(
      { ...i, id: i.product_id, price: i.unit_price, quantity: i.quantity },
      { companyConfig, taxParams, monofasicTaxes, customer: null, defaultCfop: "5102" }
    ));
  };

  const emitirNfce = async (sale) => {
    if (!canEmit) { setShowConfig(true); return; }
    setWorking(w => ({ ...w, [sale.id]: "gerando" }));
    try {
      // 1 — Build fiscal items from sale
      const fiscalItems = buildFiscalItems(sale);
      const totals = computeTotals(fiscalItems);

      // 2 — Create PDVExitOrder (model 65)
      const order = await base44.entities.PDVExitOrder.create({
        user_email: user.email,
        customer_name: "Consumidor Final",
        order_number: `PDV-NFC-${sale.id.slice(-8)}-${Date.now()}`,
        order_date: sale.sale_date || new Date().toISOString(),
        cfop: "5102",
        nature_operation: "Venda de mercadoria",
        items: fiscalItems,
        total_products: totals.total_products,
        total_icms: totals.total_icms,
        total_ipi: totals.total_ipi,
        total_pis: totals.total_pis,
        total_cofins: totals.total_cofins,
        total_nota: totals.total_nota,
        nfe_model: "65",
        status: "rascunho",
        payment_method: "0",
        buyer_type: "consumidor_final",
        notes: `Venda PDV — ${sale.id}`,
      });

      // 3 — Gerar NFC-e (XML + assinatura)
      const gen = await base44.functions.invoke("gerarNfeSaida", { order_id: order.id, modelo: "65" });
      if (!gen.data?.success) {
        await base44.entities.PDVExitOrder.update(order.id, { nfe_status: "Falha: " + (gen.data?.error || "erro") });
        setWorking(w => ({ ...w, [sale.id]: null }));
        load();
        return;
      }

      // 4 — Transmitir à SEFAZ
      setWorking(w => ({ ...w, [sale.id]: "transmitindo" }));
      await base44.functions.invoke("transmitirNfe", { order_id: order.id });
    } catch (e) {
      console.error(e);
    }
    setWorking(w => ({ ...w, [sale.id]: null }));
    load();
  };

  const retransmitir = async (sale) => {
    if (!sale._nfce_order_id) return;
    setWorking(w => ({ ...w, [sale.id]: "transmitindo" }));
    try {
      await base44.functions.invoke("transmitirNfe", { order_id: sale._nfce_order_id });
    } catch (e) { console.error(e); }
    setWorking(w => ({ ...w, [sale.id]: null }));
    load();
  };

  const downloadXml = (sale) => {
    if (!sale._nfce_order?.nfe_xml) return;
    const blob = new Blob([sale._nfce_order.nfe_xml], { type: "application/xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `NFCe_${sale._nfce_number || sale.id}.xml`;
    a.click();
  };

  const fmtDate = (d) => { try { return new Date(d).toLocaleString("pt-BR"); } catch { return d; } };
  const fmtMoney = (v) => "R$ " + (Number(v) || 0).toFixed(2).replace(".", ",");

  const filtered = sales.filter(s =>
    !search ||
    (s.items || []).some(i => i.product_name?.toLowerCase().includes(search.toLowerCase())) ||
    s._nfce_number?.includes(search) ||
    s._nfce_key?.includes(search)
  );

  const stats = {
    total: sales.length,
    autorizada: sales.filter(s => getRowStatus(s) === "autorizada").length,
    pendente: sales.filter(s => ["sem_nfce", "gerada"].includes(getRowStatus(s))).length,
    rejeitada: sales.filter(s => getRowStatus(s) === "rejeitada").length,
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Receipt className="w-5 h-5 text-teal-600" />
          <h2 className="text-lg font-bold">Painel NFC-e</h2>
          <span className="text-sm text-gray-400">Cupom Fiscal Eletrônico</span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} className="gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowConfig(true)} className="gap-1.5">
            <Building className="w-3.5 h-3.5" /> Empresa
            {canEmit && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
          </Button>
        </div>
      </div>

      {/* Alerta empresa */}
      {!canEmit && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 flex items-center gap-2 text-sm">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <span className="text-amber-700">Configure <b>CNPJ, IE e código IBGE</b> da empresa emitente antes de emitir NFC-e.</span>
          <Button size="sm" variant="outline" onClick={() => setShowConfig(true)} className="ml-auto shrink-0">Configurar</Button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Vendas", value: stats.total, cls: "bg-gray-50 border-gray-200" },
          { label: "Autorizadas", value: stats.autorizada, cls: "bg-emerald-50 border-emerald-200 text-emerald-700" },
          { label: "Pendentes", value: stats.pendente, cls: "bg-amber-50 border-amber-200 text-amber-700" },
          { label: "Rejeitadas", value: stats.rejeitada, cls: "bg-red-50 border-red-200 text-red-600" },
        ].map(s => (
          <div key={s.label} className={`border rounded-lg p-3 text-center ${s.cls}`}>
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-xs mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar produto, número, chave…" className="pl-9 h-9" />
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-teal-600" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Receipt className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p>Nenhuma venda encontrada</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(sale => {
            const status = working[sale.id] ? (working[sale.id] === "gerando" ? "gerando" : "transmitindo") : getRowStatus(sale);
            const isWorking = !!working[sale.id];
            const isAuthorized = status === "autorizada";
            const hasOrder = !!sale._nfce_order_id;
            const hasXml = !!sale._nfce_order?.nfe_xml;
            const needsRetransmit = hasOrder && !sale._nfce_protocol && !isWorking && status !== "sem_nfce";

            return (
              <div key={sale.id} className="bg-white rounded-lg border overflow-hidden">
                <div
                  className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50"
                  onClick={() => setExpanded(expanded === sale.id ? null : sale.id)}
                >
                  {expanded === sale.id ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                  <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3 items-center">
                    <div>
                      <p className="text-xs text-gray-400">Venda</p>
                      <p className="text-sm font-medium truncate">{fmtDate(sale.sale_date)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Itens</p>
                      <p className="text-sm font-medium">{sale.items?.length || 0} produto(s)</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Total</p>
                      <p className="text-sm font-bold text-teal-700">{fmtMoney(sale.total)}</p>
                    </div>
                    <div>
                      <StatusBadge s={status} />
                      {sale._nfce_number && (
                        <p className="text-xs text-gray-500 mt-0.5">NFC-e {sale._nfce_number}/{sale._nfce_serie}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                    {!hasOrder && !isWorking && canEmit && (
                      <Button size="sm" onClick={() => emitirNfce(sale)} className="h-8 gap-1 bg-teal-600 hover:bg-teal-700 text-xs">
                        <Send className="w-3.5 h-3.5" /> Emitir NFC-e
                      </Button>
                    )}
                    {!hasOrder && !isWorking && !canEmit && (
                      <Button size="sm" variant="outline" onClick={() => setShowConfig(true)} className="h-8 text-xs">
                        Configurar empresa
                      </Button>
                    )}
                    {isWorking && (
                      <Button size="sm" disabled className="h-8 text-xs gap-1">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        {working[sale.id] === "gerando" ? "Gerando…" : "Enviando…"}
                      </Button>
                    )}
                    {needsRetransmit && (
                      <Button size="sm" onClick={() => retransmitir(sale)} className="h-8 gap-1 bg-blue-600 hover:bg-blue-700 text-xs">
                        <UploadCloud className="w-3.5 h-3.5" /> Retransmitir
                      </Button>
                    )}
                    {hasXml && (
                      <Button size="sm" variant="outline" onClick={() => downloadXml(sale)} className="h-8 text-xs gap-1">
                        <Download className="w-3.5 h-3.5" /> XML
                      </Button>
                    )}
                    {isAuthorized && sale._nfce_order && (
                      <Button size="sm" variant="outline" onClick={() => setPrintOrder(sale._nfce_order)} className="h-8 text-xs gap-1">
                        <Printer className="w-3.5 h-3.5" /> Cupom
                      </Button>
                    )}
                  </div>
                </div>

                {expanded === sale.id && (
                  <div className="border-t bg-gray-50 p-3 space-y-2 text-xs">
                    {/* Sale items */}
                    <div>
                      <p className="font-semibold text-gray-600 mb-1">Itens da venda</p>
                      <table className="w-full text-xs border rounded overflow-hidden">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="p-1.5 text-left">Produto</th>
                            <th className="p-1.5 text-right">Qtd</th>
                            <th className="p-1.5 text-right">Unit.</th>
                            <th className="p-1.5 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(sale.items || []).map((item, i) => (
                            <tr key={i} className="border-t">
                              <td className="p-1.5">{item.product_name}</td>
                              <td className="p-1.5 text-right">{item.quantity}</td>
                              <td className="p-1.5 text-right">{fmtMoney(item.unit_price)}</td>
                              <td className="p-1.5 text-right font-medium">{fmtMoney(item.total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* NFC-e details */}
                    {sale._nfce_order && (
                      <div className="bg-white border rounded p-2 space-y-1">
                        <p className="font-semibold text-gray-600">NFC-e</p>
                        {sale._nfce_key && (
                          <p><b>Chave:</b> <span className="font-mono break-all">{sale._nfce_key}</span></p>
                        )}
                        {sale._nfce_protocol && (
                          <p className="text-emerald-700"><b>Protocolo SEFAZ:</b> {sale._nfce_protocol}</p>
                        )}
                        {sale._nfce_status && (
                          <p><b>Status:</b> {sale._nfce_status}</p>
                        )}
                        <p><b>Ambiente:</b> {sale._nfce_order?.nfe_environment === "1" ? "Produção" : "Homologação"}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {printOrder && (
        <DanfePrint order={printOrder} company={companyConfig} onClose={() => setPrintOrder(null)} />
      )}
      {showConfig && (
        <CompanyConfigModal user={user} onClose={() => setShowConfig(false)} onSaved={load} />
      )}
    </div>
  );
}
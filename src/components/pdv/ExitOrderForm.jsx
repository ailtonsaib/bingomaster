import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Loader2, Search, Trash2, Plus, ShoppingCart, AlertTriangle } from "lucide-react";

const num = (v) => Number(v) || 0;

export default function ExitOrderForm({ user, onClose, onSaved }) {
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [taxParams, setTaxParams] = useState([]);
  const [monofasicTaxes, setMonofasicTaxes] = useState([]);
  const [companyConfig, setCompanyConfig] = useState(null);
  const [saving, setSaving] = useState(false);

  const [customerId, setCustomerId] = useState("");
  const [customer, setCustomer] = useState(null);
  const [search, setSearch] = useState("");
  const [items, setItems] = useState([]);
  const [natureOp, setNatureOp] = useState("Venda de mercadoria");
  const [cfop, setCfop] = useState("5102");
  const [paymentMethod, setPaymentMethod] = useState("0");
  const [notes, setNotes] = useState("");
  const [operations, setOperations] = useState([]);
  const [selectedOperationId, setSelectedOperationId] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [custs, prods, taxes, monofasic, configs, ops] = await Promise.all([
          base44.entities.PDVContact.filter({ user_email: user.email, is_active: true, is_cliente: true }),
          base44.entities.PDVProduct.filter({ user_email: user.email, is_active: true }),
          base44.entities.PDVExitTaxParameter.filter({ user_email: user.email }),
          base44.entities.PDVMonofasicTax.filter({ user_email: user.email }),
          base44.entities.PDVCompanyConfig.filter({ user_email: user.email }),
          base44.entities.PDVOperation.filter({ user_email: user.email, operation_type: "saida", is_active: true }),
        ]);
        setCustomers(custs);
        setProducts(prods);
        setTaxParams(taxes);
        setMonofasicTaxes(monofasic);
        setCompanyConfig(configs[0] || null);
        setOperations(ops || []);
      } catch (e) { console.error(e); }
    })();
  }, [user.email]);

  // Configuração de impostos conforme regime da empresa
  const isSimples = companyConfig?.crt === 1 || companyConfig?.crt === 2;
  const isRegimeNormal = companyConfig?.crt === 3;
  const isRegimeCaixa = isRegimeNormal && companyConfig?.regime_caixa === true;
  const isLucroPresumido = isRegimeNormal && companyConfig?.lucro_type === "presumido";

  // Alíquotas PIS/COFINS por tipo de lucro (Regime Normal)
  // Lucro Presumido: PIS 0,65% / COFINS 3,00%
  // Lucro Real: PIS 1,65% / COFINS 7,60%
  const PIS_NORMAL_RATE = isLucroPresumido ? 0.65 : 1.65;
  const COFINS_NORMAL_RATE = isLucroPresumido ? 3.00 : 7.60;

  useEffect(() => {
    if (customerId) {
      const c = customers.find(c => c.id === customerId);
      setCustomer(c);
    } else {
      setCustomer(null);
    }
  }, [customerId, customers]);

  const lookupTaxParam = (ncm, uf) => {
    if (!ncm) return null;
    // Try exact match NCM + UF
    let param = taxParams.find(p => p.ncm === ncm && p.uf === uf && p.is_active !== false);
    // Try NCM + * (all UFs)
    if (!param) param = taxParams.find(p => p.ncm === ncm && p.uf === "*" && p.is_active !== false);
    return param;
  };

  const filteredProducts = search
    ? products.filter(p =>
        p.name?.toLowerCase().includes(search.toLowerCase()) ||
        p.barcode?.includes(search)
      )
    : products.slice(0, 12);

  const addItem = (product) => {
    const existing = items.findIndex(i => i.product_id === product.id);
    if (existing >= 0) {
      setItems(prev => {
        const updated = [...prev];
        updated[existing].quantity += 1;
        recalcItem(updated[existing]);
        return updated;
      });
      return;
    }
    const uf = customer?.uf || "";
    const taxParam = lookupTaxParam(product.ncm, uf);
    const isMonofasic = product.monofasic === true;
    const monofasicTax = isMonofasic ? monofasicTaxes.find(m => m.ncm === product.ncm && m.is_active !== false) : null;
    const isBifasico = isMonofasic && monofasicTax?.tax_regime === "bifasico";
    const isDistributor = (customer?.buyer_type || "consumidor_final") === "distribuidor";
    // Bifásico: venda a distribuidor usa alíquota reduzida (CST 02); venda a consumidor/varejista usa 0% (CST 04)
    // Monofásico: sempre 0% na revenda (CST 04 ou 07 para combustíveis)
    const useDistributorRates = isBifasico && isDistributor;
    const newItem = {
      product_id: product.id,
      product_code: product.barcode || product.id,
      barcode: product.barcode || "",
      product_name: product.name,
      ncm: product.ncm || "",
      cfop: taxParam?.cfop_default || cfop,
      unit: product.unit || "UN",
      quantity: 1,
      unit_price: product.price,
      total: product.price,
      origin: taxParam?.origin || 0,
      monofasic: isMonofasic,
      tax_regime: monofasicTax?.tax_regime || null,
      product_category: monofasicTax?.product_category || null,
      csosn: taxParam?.csosn || "102",
      cst_icms: taxParam?.cst_icms || "00",
      icms_rate: num(taxParam?.icms_rate),
      icms_value: 0,
      cst_ipi: isMonofasic ? (monofasicTax?.cst_ipi || "99") : (taxParam?.cst_ipi || "99"),
      ipi_rate: isMonofasic ? num(monofasicTax?.effective_ipi_rate) : num(taxParam?.ipi_rate),
      ipi_value: 0,
      // PIS: monofásico usa CST 04/06/07 (alíquota zero na revenda — Lei 13.097)
      // Simples Nacional: CST 49, alíquota zero (recolhido via DAS)
      // Regime Normal + Competência: CST 01/02 do parâmetro tributário, alíquota conforme lucro
      // Regime Normal + Caixa: CST 98, alíquota conforme lucro
      cst_pis: isMonofasic
        ? (useDistributorRates ? (monofasicTax?.cst_pis_distributor || "02") : (monofasicTax?.cst_pis || "04"))
        : isSimples
          ? "49"
          : isRegimeCaixa
            ? "98"
            : (taxParam?.cst_pis || "01"),
      pis_rate: isMonofasic
        ? (useDistributorRates ? num(monofasicTax?.pis_rate_distributor) : num(monofasicTax?.effective_pis_rate))
        : isSimples
          ? 0
          : PIS_NORMAL_RATE,
      pis_value: 0,
      // COFINS: mesma lógica do PIS
      cst_cofins: isMonofasic
        ? (useDistributorRates ? (monofasicTax?.cst_cofins_distributor || "02") : (monofasicTax?.cst_cofins || "04"))
        : isSimples
          ? "49"
          : isRegimeCaixa
            ? "98"
            : (taxParam?.cst_cofins || "01"),
      cofins_rate: isMonofasic
        ? (useDistributorRates ? num(monofasicTax?.cofins_rate_distributor) : num(monofasicTax?.effective_cofins_rate))
        : isSimples
          ? 0
          : COFINS_NORMAL_RATE,
      cofins_value: 0,
    };
    recalcItem(newItem);
    setItems(prev => [...prev, newItem]);
  };

  const recalcItem = (item) => {
    item.total = num(item.quantity) * num(item.unit_price);
    item.icms_value = item.total * num(item.icms_rate) / 100;
    item.ipi_value = item.total * num(item.ipi_rate) / 100;
    item.pis_value = item.total * num(item.pis_rate) / 100;
    item.cofins_value = item.total * num(item.cofins_rate) / 100;
  };

  const updateItem = (idx, field, value) => {
    setItems(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: field === "quantity" || field === "unit_price" || field === "icms_rate" || field === "ipi_rate" || field === "pis_rate" || field === "cofins_rate" ? num(value) : value };
      recalcItem(updated[idx]);
      return updated;
    });
  };

  const removeItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx));

  const totals = items.reduce((acc, item) => {
    acc.total_products += item.total;
    acc.total_icms += item.icms_value;
    acc.total_ipi += item.ipi_value;
    acc.total_pis += item.pis_value;
    acc.total_cofins += item.cofins_value;
    return acc;
  }, { total_products: 0, total_icms: 0, total_ipi: 0, total_pis: 0, total_cofins: 0 });
  totals.total_nota = totals.total_products + totals.total_ipi;

  const save = async () => {
    if (!customer) { alert("Selecione um cliente!"); return; }
    if (items.length === 0) { alert("Adicione pelo menos um item!"); return; }
    setSaving(true);
    try {
      await base44.entities.PDVExitOrder.create({
        user_email: user.email,
        customer_id: customer.id,
        customer_name: customer.name,
        customer_cpf_cnpj: customer.cpf_cnpj || "",
        customer_ie: customer.ie || "",
        customer_uf: customer.uf || "",
        customer_city: customer.city || "",
        customer_ibge_code: customer.ibge_code || "",
        customer_cep: customer.cep || "",
        customer_address: customer.address || "",
        customer_number: customer.number || "",
        customer_district: customer.district || "",
        order_number: `PED-${Date.now()}`,
        order_date: new Date().toISOString(),
        cfop,
        nature_operation: natureOp,
        items,
        total_products: totals.total_products,
        total_icms: totals.total_icms,
        total_ipi: totals.total_ipi,
        total_pis: totals.total_pis,
        total_cofins: totals.total_cofins,
        total_nota: totals.total_nota,
        status: "rascunho",
        payment_method: paymentMethod,
        buyer_type: customer.buyer_type || "consumidor_final",
        notes,
      });
      onSaved?.();
      onClose();
    } catch (e) { alert("Erro ao salvar pedido: " + e.message); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
          <h3 className="font-bold flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-orange-600" /> Novo Pedido de Saída
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 space-y-4">
          {/* Indicador do regime tributário da empresa */}
          {companyConfig ? (
            <div className="bg-gray-50 border rounded-lg p-2 flex items-center gap-2 flex-wrap text-xs">
              <span className="font-medium text-gray-700">Regime:</span>
              <span className={`px-2 py-0.5 rounded font-medium ${isSimples ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>
                {isSimples ? "Simples Nacional" : `Regime Normal (${isLucroPresumido ? "Presumido" : "Real"})`}
              </span>
              {isRegimeNormal && (
                <span className={`px-2 py-0.5 rounded font-medium ${isRegimeCaixa ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"}`}>
                  PIS/COFINS: {isRegimeCaixa ? "Caixa (CST 98)" : "Competência (CST 01)"}
                </span>
              )}
              {isSimples && (
                <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-600 font-medium">
                  PIS/COFINS: DAS (CST 49)
                </span>
              )}
              <span className="text-gray-400">·</span>
              <span className="text-gray-500">PIS {isSimples ? "0%" : `${PIS_NORMAL_RATE}%`} / COFINS {isSimples ? "0%" : `${COFINS_NORMAL_RATE}%`}</span>
              <span className="text-gray-400">·</span>
              <span className="text-indigo-600">Monofásicos (Lei 13.097): CST 04</span>
            </div>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-700">
              ⚠ Configure os dados da empresa (regime tributário) para cálculo correto dos impostos.
            </div>
          )}
          {/* Customer + info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Cliente *</Label>
              <select value={customerId} onChange={e => setCustomerId(e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                <option value="">Selecione um cliente...</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name} {c.cpf_cnpj ? `(${c.cpf_cnpj})` : ""}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <Label>Modelo de Operação</Label>
              <select
                value={selectedOperationId}
                onChange={e => {
                  const opId = e.target.value;
                  setSelectedOperationId(opId);
                  const op = operations.find(o => o.id === opId);
                  if (op) {
                    if (op.nature_operation) setNatureOp(op.nature_operation);
                    if (op.cfop_default) setCfop(op.cfop_default);
                  }
                }}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="">Selecionar manualmente...</option>
                {operations.map(op => (
                  <option key={op.id} value={op.id}>{op.name} {op.cfop_default ? `— CFOP ${op.cfop_default}` : ""}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Natureza da Operação</Label>
              <Input value={natureOp} onChange={e => setNatureOp(e.target.value)} className="h-9" />
            </div>
            <div>
              <Label>CFOP Principal</Label>
              <Input value={cfop} onChange={e => setCfop(e.target.value)} className="h-9 font-mono" placeholder="5102" />
            </div>
            <div>
              <Label>Forma de Pagamento</Label>
              <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                <option value="0">À Vista</option>
                <option value="1">A Prazo</option>
              </select>
            </div>
          </div>

          {customer && (
            <div className={`rounded-lg p-2 flex items-center gap-2 ${customer.buyer_type === "distribuidor" ? "bg-amber-50 border border-amber-300" : "bg-gray-50 border border-gray-200"}`}>
              {customer.buyer_type === "distribuidor" && <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />}
              <p className="text-xs text-gray-600">
                <b>Tipo de Cliente:</b> {customer.buyer_type === "distribuidor" ? "Distribuidor / Atacadista" : customer.buyer_type === "revendedor" ? "Revendedor / Varejista" : "Consumidor Final"}
                {customer.buyer_type === "distribuidor" && " — Regime Bifásico ativo: alíquota reduzida de PIS (1,86%) e COFINS (8,54%) com CST 02 para produtos monofásicos bifásicos (Lei 13.097 art. 14)."}
              </p>
            </div>
          )}

          {/* Product search */}
          <div className="border rounded-lg p-3 bg-gray-50">
            <div className="relative mb-2">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar produto por nome ou código..." className="pl-9 h-9" autoFocus />
            </div>
            <div className="max-h-32 overflow-y-auto grid grid-cols-2 md:grid-cols-3 gap-2">
              {filteredProducts.map(p => (
              <button
                key={p.id}
                onClick={() => addItem(p)}
                className="text-left p-2 bg-white border rounded-md hover:border-orange-400 hover:bg-orange-50/50 transition-colors text-xs relative"
              >
                <p className="font-medium truncate">{p.name}</p>
                <p className="text-gray-500">R$ {num(p.price).toFixed(2)} {p.ncm ? `· NCM ${p.ncm}` : ""}</p>
                {p.monofasic && <span className="absolute top-1 right-1 text-[9px] bg-indigo-600 text-white px-1 rounded">LEI 13.097</span>}
              </button>
              ))}
              {filteredProducts.length === 0 && <p className="text-xs text-gray-400 col-span-full text-center py-2">Nenhum produto encontrado</p>}
            </div>
          </div>

          {/* Items table */}
          {items.length > 0 && (
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="p-2 text-left">Produto</th>
                    <th className="p-2 text-center">NCM</th>
                    <th className="p-2 text-center">CFOP</th>
                    <th className="p-2 text-right">Qtd</th>
                    <th className="p-2 text-right">V. Unit</th>
                    <th className="p-2 text-right">Total</th>
                    <th className="p-2 text-right">ICMS%</th>
                    <th className="p-2 text-right">IPI%</th>
                    <th className="p-2 text-center"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => (
                    <tr key={i} className="border-b">
                      <td className="p-2">
                        {item.product_name}
                        {item.monofasic && <span className="ml-1 text-[9px] bg-indigo-600 text-white px-1 rounded align-middle">MONOFÁSICO</span>}
                      </td>
                      <td className="p-2 text-center font-mono">{item.ncm || "—"}</td>
                      <td className="p-2 text-center">
                        <input type="text" value={item.cfop} onChange={e => updateItem(i, "cfop", e.target.value)} className="w-12 text-center border rounded h-7 text-xs" />
                      </td>
                      <td className="p-2 text-right">
                        <input type="number" step="0.0001" value={item.quantity} onChange={e => updateItem(i, "quantity", e.target.value)} className="w-16 text-right border rounded h-7 text-xs" />
                      </td>
                      <td className="p-2 text-right">
                        <input type="number" step="0.01" value={item.unit_price} onChange={e => updateItem(i, "unit_price", e.target.value)} className="w-20 text-right border rounded h-7 text-xs" />
                      </td>
                      <td className="p-2 text-right font-medium">{item.total.toFixed(2)}</td>
                      <td className="p-2 text-right">
                        <input type="number" step="0.01" value={item.icms_rate} onChange={e => updateItem(i, "icms_rate", e.target.value)} className="w-14 text-right border rounded h-7 text-xs" />
                      </td>
                      <td className="p-2 text-right">
                        <input type="number" step="0.01" value={item.ipi_rate} onChange={e => updateItem(i, "ipi_rate", e.target.value)} className="w-14 text-right border rounded h-7 text-xs" />
                      </td>
                      <td className="p-2 text-center">
                        <button onClick={() => removeItem(i)} className="p-1 text-gray-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Totals */}
          {items.length > 0 && (
            <div className="bg-orange-50 rounded-lg p-3 grid grid-cols-3 md:grid-cols-6 gap-2 text-center text-xs">
              <div><p className="text-gray-500">Produtos</p><p className="font-bold">R$ {totals.total_products.toFixed(2)}</p></div>
              <div><p className="text-gray-500">ICMS</p><p className="font-bold">R$ {totals.total_icms.toFixed(2)}</p></div>
              <div><p className="text-gray-500">IPI</p><p className="font-bold">R$ {totals.total_ipi.toFixed(2)}</p></div>
              <div><p className="text-gray-500">PIS</p><p className="font-bold">R$ {totals.total_pis.toFixed(2)}</p></div>
              <div><p className="text-gray-500">COFINS</p><p className="font-bold">R$ {totals.total_cofins.toFixed(2)}</p></div>
              <div><p className="text-gray-500">Total NF</p><p className="font-bold text-orange-700 text-sm">R$ {totals.total_nota.toFixed(2)}</p></div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 p-4 border-t sticky bottom-0 bg-white">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving} className="bg-orange-600 hover:bg-orange-700 gap-1.5">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Salvar Pedido
          </Button>
        </div>
      </div>
    </div>
  );
}
import { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { X, Upload, Loader2, FileText, CheckCircle2, AlertTriangle, PackagePlus } from "lucide-react";
import SupplierFormModal from "@/components/pdv/SupplierFormModal";
import ProductForm from "@/components/pdv/ProductForm";

// Parse NF-e XML using browser DOMParser
function parseNfeXml(xmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "text/xml");
  const parseError = doc.querySelector("parsererror");
  if (parseError) throw new Error("XML inválido ou mal formatado.");

  // Handle namespaced XML — use getElementByTagName or wildcard
  const getText = (parent, tag) => {
    if (!parent) return "";
    const el = parent.getElementsByTagName(tag)[0] || parent.getElementsByTagName(`*:${tag}`)[0];
    return el?.textContent?.trim() || "";
  };

  const infNFe = doc.getElementsByTagName("infNFe")[0] || doc.getElementsByTagName("*:infNFe")[0];
  if (!infNFe) throw new Error("Registro infNFe não encontrado. Verifique se é um XML de NF-e válido.");

  const ide = infNFe.getElementsByTagName("ide")[0] || infNFe.getElementsByTagName("*:ide")[0];
  const emit = infNFe.getElementsByTagName("emit")[0] || infNFe.getElementsByTagName("*:emit")[0];
  const total = infNFe.getElementsByTagName("total")[0] || infNFe.getElementsByTagName("*:total")[0];
  const icmsTot = total?.getElementsByTagName("ICMSTot")[0] || total?.getElementsByTagName("*:ICMSTot")[0];

  const detNodes = infNFe.getElementsByTagName("det");

  const items = [];
  for (let i = 0; i < detNodes.length; i++) {
    const det = detNodes[i];
    const prod = det.getElementsByTagName("prod")[0] || det.getElementsByTagName("*:prod")[0];
    const imposto = det.getElementsByTagName("imposto")[0] || det.getElementsByTagName("*:imposto")[0];

    // ICMS — pode estar dentro de ICMS00, ICMS10, ICMS20, ICMS40, etc.
    const icmsNode = imposto?.getElementsByTagName("ICMS")[0] || imposto?.getElementsByTagName("*:ICMS")[0];
    const icmsChild = icmsNode?.firstElementChild;
    const cstIcms = icmsChild ? getText(icmsChild, "CST") || getText(icmsChild, "CSOSN") : "";

    // IPI
    const ipiNode = imposto?.getElementsByTagName("IPI")[0] || imposto?.getElementsByTagName("*:IPI")[0];
    const ipiChild = ipiNode?.firstElementChild;

    // PIS
    const pisNode = imposto?.getElementsByTagName("PIS")[0] || imposto?.getElementsByTagName("*:PIS")[0];
    const pisChild = pisNode?.firstElementChild;

    // COFINS
    const cofinsNode = imposto?.getElementsByTagName("COFINS")[0] || imposto?.getElementsByTagName("*:COFINS")[0];
    const cofinsChild = cofinsNode?.firstElementChild;

    items.push({
      product_code: getText(prod, "cProd"),
      barcode: getText(prod, "cEAN"),
      product_name: getText(prod, "xProd"),
      ncm: getText(prod, "NCM"),
      cfop: getText(prod, "CFOP"),
      unit: getText(prod, "uCom"),
      quantity: parseFloat(getText(prod, "qCom").replace(",", ".")) || 0,
      unit_price: parseFloat(getText(prod, "vUnCom").replace(",", ".")) || 0,
      total: parseFloat(getText(prod, "vProd").replace(",", ".")) || 0,
      icms_rate: parseFloat(getText(icmsChild, "pICMS").replace(",", ".")) || 0,
      icms_value: parseFloat(getText(icmsChild, "vICMS").replace(",", ".")) || 0,
      ipi_rate: parseFloat(getText(ipiChild, "pIPI")?.replace(",", ".") || getText(ipiChild, "pIPI").replace(",", ".")) || 0,
      ipi_value: parseFloat(getText(ipiChild, "vIPI").replace(",", ".")) || 0,
      pis_rate: parseFloat(getText(pisChild, "pPIS").replace(",", ".")) || 0,
      pis_value: parseFloat(getText(pisChild, "vPIS").replace(",", ".")) || 0,
      cofins_rate: parseFloat(getText(cofinsChild, "pCOFINS").replace(",", ".")) || 0,
      cofins_value: parseFloat(getText(cofinsChild, "vCOFINS").replace(",", ".")) || 0,
      cst_icms: cstIcms,
    });
  }

  return {
    supplier: {
      name: getText(emit, "xNome"),
      cpf_cnpj: getText(emit, "CNPJ") || getText(emit, "CPF"),
      ie: getText(emit, "IE"),
      address: getText(emit, "xLgr"),
      number: getText(emit, "nro"),
      district: getText(emit, "xBairro"),
      city: getText(emit, "xMun"),
      uf: getText(emit, "UF"),
      cep: getText(emit, "CEP"),
    },
    nota: {
      number: getText(ide, "nNF"),
      series: getText(ide, "serie"),
      model: getText(ide, "mod"),
      issue_date: getText(ide, "dhEmi"),
      nature_operation: getText(ide, "natOp"),
      cfop: items[0]?.cfop || "",
    },
    totals: {
      total_products: parseFloat(getText(icmsTot, "vProd").replace(",", ".")) || 0,
      total_icms: parseFloat(getText(icmsTot, "vICMS").replace(",", ".")) || 0,
      total_ipi: parseFloat(getText(icmsTot, "vIPI").replace(",", ".")) || 0,
      total_pis: parseFloat(getText(icmsTot, "vPIS").replace(",", ".")) || 0,
      total_cofins: parseFloat(getText(icmsTot, "vCOFINS").replace(",", ".")) || 0,
      total_nota: parseFloat(getText(icmsTot, "vNF").replace(",", ".")) || 0,
    },
    items,
  };
}

export default function ImportXmlModal({ user, onClose, onSaved }) {
  const [parsing, setParsing] = useState(false);
  const [parsedData, setParsedData] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [createProducts, setCreateProducts] = useState(true);
  const [createSupplier, setCreateSupplier] = useState(true);
  const [updateStock, setUpdateStock] = useState(true);
  const [companyConfig, setCompanyConfig] = useState(null);
  const [editSupplier, setEditSupplier] = useState(null);
  const [categories, setCategories] = useState([]);
  const [editProduct, setEditProduct] = useState(null);
  const [pendingProducts, setPendingProducts] = useState([]);
  const fileRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const [configs, cats] = await Promise.all([
          base44.entities.PDVCompanyConfig.filter({ user_email: user.email }),
          base44.entities.PDVCategory.filter({ user_email: user.email }),
        ]);
        setCompanyConfig(configs[0] || null);
        setCategories(cats || []);
      } catch (e) { console.error(e); }
    })();
  }, [user.email]);

  const isSimples = companyConfig?.crt === 1 || companyConfig?.crt === 2;

  const finishImport = async (d, supplierId) => {
    // Create products and update stock
    const processedItems = [];
    const newProducts = [];
    for (const item of d.items) {
      if (createProducts) {
        const existingProd = await base44.entities.PDVProduct.filter({
          user_email: user.email,
          barcode: item.barcode || item.product_code,
        });
        if (existingProd.length > 0) {
          const prod = existingProd[0];
          if (updateStock) {
            await base44.entities.PDVProduct.update(prod.id, {
              stock: (prod.stock || 0) + item.quantity,
              cost: item.unit_price,
            });
          }
          if (!prod.ncm && item.ncm) {
            await base44.entities.PDVProduct.update(prod.id, { ncm: item.ncm });
          }
        } else if (item.product_name) {
          const newProd = await base44.entities.PDVProduct.create({
            name: item.product_name,
            barcode: item.barcode || "",
            description: item.product_name,
            price: item.unit_price * 1.3,
            cost: item.unit_price,
            stock: updateStock ? item.quantity : 0,
            unit: item.unit || "UN",
            ncm: item.ncm,
            cfop_default: item.cfop,
            user_email: user.email,
            is_active: true,
          });
          newProducts.push(newProd);
        }
      }
      processedItems.push(item);
    }

    // Create entry operation
    await base44.entities.PDVEntryOperation.create({
      user_email: user.email,
      supplier_id: supplierId,
      supplier_name: d.supplier.name,
      supplier_cnpj: d.supplier.cnpj,
      supplier_uf: d.supplier.uf,
      nota_number: d.nota.number,
      nota_series: d.nota.series,
      nota_model: d.nota.model,
      issue_date: d.nota.issue_date ? new Date(d.nota.issue_date).toISOString() : new Date().toISOString(),
      entry_date: new Date().toISOString(),
      cfop: d.nota.cfop,
      nature_operation: d.nota.nature_operation,
      total_products: d.totals.total_products,
      total_icms: d.totals.total_icms,
      total_ipi: d.totals.total_ipi,
      total_pis: d.totals.total_pis,
      total_cofins: d.totals.total_cofins,
      total_nota: d.totals.total_nota,
      items: processedItems,
      status: "registrada",
    });

    return newProducts;
  };

  const handleSupplierSaved = async (updatedSupplier) => {
    setSaving(true);
    setEditSupplier(null);
    try {
      const newProducts = await finishImport(parsedData, updatedSupplier.id);
      onSaved?.();
      if (newProducts.length > 0) {
        setPendingProducts(newProducts);
        setEditProduct(newProducts[0]);
        setSaving(false);
      } else {
        onClose();
      }
    } catch (e) {
      setError("Erro ao finalizar importação: " + e.message);
    }
    setSaving(false);
  };

  const handleProductSaved = () => {
    // Move to next pending product, or close
    const remaining = pendingProducts.slice(1);
    setPendingProducts(remaining);
    if (remaining.length > 0) {
      setEditProduct(remaining[0]);
    } else {
      setEditProduct(null);
      onClose();
    }
  };

  const handleFile = async (file) => {
    setError("");
    setParsedData(null);
    setParsing(true);
    try {
      const text = await file.text();
      const data = parseNfeXml(text);
      setParsedData(data);
    } catch (e) {
      setError(e.message || "Erro ao processar XML.");
    }
    setParsing(false);
  };

  const handleConfirm = async () => {
    if (!parsedData) return;
    setSaving(true);
    try {
      const d = parsedData;
      let supplierId = null;

      // Create or find supplier
      if (createSupplier && d.supplier.cnpj) {
        const existing = await base44.entities.PDVSupplier.filter({
          user_email: user.email,
          cpf_cnpj: d.supplier.cnpj,
        });
        if (existing.length > 0) {
          supplierId = existing[0].id;
        } else {
          const supp = await base44.entities.PDVSupplier.create({
            ...d.supplier,
            user_email: user.email,
            is_active: true,
          });
          supplierId = supp.id;
          // Open supplier form to adjust info before finishing import
          setEditSupplier(supp);
          setSaving(false);
          return;
        }
      }

      const newProducts = await finishImport(d, supplierId);

      onSaved?.();
      if (newProducts.length > 0) {
        setPendingProducts(newProducts);
        setEditProduct(newProducts[0]);
        setSaving(false);
      } else {
        onClose();
      }
    } catch (e) {
      setError("Erro ao salvar: " + e.message);
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
          <h3 className="font-bold flex items-center gap-2">
            <Upload className="w-5 h-5 text-orange-600" /> Importar Nota Fiscal (XML)
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 space-y-4">
          {/* Indicador do regime da empresa para creditabilidade */}
          {companyConfig && (
            <div className={`border rounded-lg p-2 flex items-center gap-2 text-xs ${isSimples ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-green-50 border-green-200 text-green-700"}`}>
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>
                <b>{isSimples ? "Simples Nacional" : `Regime Normal (${companyConfig.lucro_type === "presumido" ? "Presumido" : "Real"})`}:</b>{" "}
                {isSimples
                  ? "ICMS/PIS/COFINS da entrada NÃO são creditáveis (recolhidos via DAS). Valores são informativos."
                  : "ICMS/PIS/COFINS da entrada são creditáveis conforme CST do fornecedor."}
              </span>
            </div>
          )}
          {/* Upload area */}
          {!parsedData && (
            <div className="space-y-3">
              <div
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-orange-400 hover:bg-orange-50/50 transition-colors"
              >
                {parsing ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="w-10 h-10 animate-spin text-orange-600" />
                    <p className="text-sm text-gray-500">Processando XML...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="w-10 h-10 text-gray-400" />
                    <p className="text-sm font-medium">Clique para selecionar o arquivo XML da NF-e</p>
                    <p className="text-xs text-gray-400">Formato: .xml (Nota Fiscal Eletrônica - modelo 55)</p>
                  </div>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xml"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                />
              </div>
              {error && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                  <AlertTriangle className="w-4 h-4" /> {error}
                </div>
              )}
            </div>
          )}

          {/* Preview */}
          {parsedData && (
            <div className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                  <AlertTriangle className="w-4 h-4" /> {error}
                </div>
              )}

              {/* Supplier info */}
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <h4 className="text-sm font-semibold">Fornecedor</h4>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                  <div><span className="text-gray-500">Nome:</span> <b>{parsedData.supplier.name}</b></div>
                  <div><span className="text-gray-500">CNPJ:</span> {parsedData.supplier.cnpj}</div>
                  <div><span className="text-gray-500">UF:</span> {parsedData.supplier.uf}</div>
                  <div><span className="text-gray-500">IE:</span> {parsedData.supplier.ie}</div>
                  <div><span className="text-gray-500">Cidade:</span> {parsedData.supplier.city}</div>
                </div>
              </div>

              {/* Nota info */}
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <h4 className="text-sm font-semibold">Dados da Nota</h4>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                  <div><span className="text-gray-500">Número:</span> <b>{parsedData.nota.number}</b></div>
                  <div><span className="text-gray-500">Série:</span> {parsedData.nota.series}</div>
                  <div><span className="text-gray-500">Modelo:</span> {parsedData.nota.model}</div>
                  <div><span className="text-gray-500">CFOP:</span> {parsedData.nota.cfop}</div>
                  <div className="col-span-2"><span className="text-gray-500">Natureza:</span> {parsedData.nota.nature_operation}</div>
                </div>
              </div>

              {/* Items */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-3 py-2 border-b">
                  <h4 className="text-sm font-semibold">Itens ({parsedData.items.length})</h4>
                </div>
                <div className="overflow-x-auto max-h-48">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 border-b sticky top-0">
                      <tr>
                        <th className="p-2 text-left">Produto</th>
                        <th className="p-2 text-center">NCM</th>
                        <th className="p-2 text-center">CFOP</th>
                        <th className="p-2 text-right">Qtd</th>
                        <th className="p-2 text-right">V. Unit.</th>
                        <th className="p-2 text-right">Total</th>
                        <th className="p-2 text-right">ICMS%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedData.items.map((item, i) => (
                        <tr key={i} className="border-b">
                          <td className="p-2">{item.product_name}</td>
                          <td className="p-2 text-center font-mono">{item.ncm}</td>
                          <td className="p-2 text-center">{item.cfop}</td>
                          <td className="p-2 text-right">{item.quantity}</td>
                          <td className="p-2 text-right">{item.unit_price.toFixed(2)}</td>
                          <td className="p-2 text-right font-medium">{item.total.toFixed(2)}</td>
                          <td className="p-2 text-right">{item.icms_rate.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals */}
              <div className="bg-orange-50 rounded-lg p-3 grid grid-cols-3 md:grid-cols-6 gap-2 text-center text-xs">
                <div><p className="text-gray-500">Produtos</p><p className="font-bold">R$ {parsedData.totals.total_products.toFixed(2)}</p></div>
                <div><p className="text-gray-500">ICMS</p><p className="font-bold">R$ {parsedData.totals.total_icms.toFixed(2)}</p></div>
                <div><p className="text-gray-500">IPI</p><p className="font-bold">R$ {parsedData.totals.total_ipi.toFixed(2)}</p></div>
                <div><p className="text-gray-500">PIS</p><p className="font-bold">R$ {parsedData.totals.total_pis.toFixed(2)}</p></div>
                <div><p className="text-gray-500">COFINS</p><p className="font-bold">R$ {parsedData.totals.total_cofins.toFixed(2)}</p></div>
                <div><p className="text-gray-500">Total NF</p><p className="font-bold text-orange-700">R$ {parsedData.totals.total_nota.toFixed(2)}</p></div>
              </div>

              {/* Options */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold flex items-center gap-1"><PackagePlus className="w-4 h-4" /> Opções de Importação</h4>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={createProducts} onChange={e => setCreateProducts(e.target.checked)} className="w-4 h-4 accent-orange-600" />
                  Criar/atualizar produtos automaticamente (preço de venda = custo + 30%)
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={updateStock} onChange={e => setUpdateStock(e.target.checked)} className="w-4 h-4 accent-orange-600" />
                  Atualizar estoque dos produtos com as quantidades da nota
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={createSupplier} onChange={e => setCreateSupplier(e.target.checked)} className="w-4 h-4 accent-orange-600" />
                  Cadastrar fornecedor (se não existir)
                </label>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 p-4 border-t sticky bottom-0 bg-white">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          {parsedData && (
            <Button onClick={handleConfirm} disabled={saving} className="bg-orange-600 hover:bg-orange-700 gap-1.5">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Confirmar Importação
            </Button>
          )}
        </div>
        </div>

        {editSupplier && (
        <SupplierFormModal
          user={user}
          supplier={editSupplier}
          title="Ajustar Dados do Fornecedor"
          onClose={() => { setEditSupplier(null); onSaved?.(); onClose(); }}
          onSaved={handleSupplierSaved}
        />
        )}

        {editProduct && (
        <ProductForm
          user={user}
          categories={categories}
          product={editProduct}
          onClose={handleProductSaved}
          onSaved={handleProductSaved}
        />
        )}
        </div>
        );
        }
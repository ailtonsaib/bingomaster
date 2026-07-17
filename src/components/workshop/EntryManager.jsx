import { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Plus, Trash2, Loader2, FileText, Search, ArrowDownToLine,
  Upload, CheckCircle2, AlertTriangle, X, Wrench, FileUp, ChevronDown
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { maskCpfCnpj, maskPhone, maskCep } from "@/lib/brMasks";
import NfseImporter from "@/components/workshop/NfseImporter";

const formatCurrency = (v) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const formatDate = (d) => d ? new Date(d).toLocaleDateString("pt-BR") : "—";

const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

// Parse NF-e XML using browser DOMParser
function parseNfeXml(xmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "text/xml");
  const parseError = doc.querySelector("parsererror");
  if (parseError) throw new Error("XML inválido ou mal formatado.");

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
    const icmsNode = imposto?.getElementsByTagName("ICMS")[0] || imposto?.getElementsByTagName("*:ICMS")[0];
    const icmsChild = icmsNode?.firstElementChild;
    const ipiNode = imposto?.getElementsByTagName("IPI")[0] || imposto?.getElementsByTagName("*:IPI")[0];
    const ipiChild = ipiNode?.firstElementChild;

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
      ipi_rate: parseFloat(getText(ipiChild, "pIPI")?.replace(",", ".") || "0") || 0,
      ipi_value: parseFloat(getText(ipiChild, "vIPI").replace(",", ".")) || 0,
      cst_icms: icmsChild ? (getText(icmsChild, "CST") || getText(icmsChild, "CSOSN")) : "",
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
      total_nota: parseFloat(getText(icmsTot, "vNF").replace(",", ".")) || 0,
    },
    items,
  };
}

export default function EntryManager({ userEmail }) {
  const { toast } = useToast();
  const [entries, setEntries] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusMenuId, setStatusMenuId] = useState(null);

  // XML import modal (NF-e)
  const [showXmlImport, setShowXmlImport] = useState(false);

  // NFS-e import modal
  const [showNfseImport, setShowNfseImport] = useState(false);

  // Manual entry modal
  const [showManualForm, setShowManualForm] = useState(false);

  // Supplier modal (when supplier not found in manual entry)
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [supplierForm, setSupplierForm] = useState(null);
  const [pendingEntryData, setPendingEntryData] = useState(null);

  const fileRef = useRef(null);

  const load = async () => {
    try {
      const [data, sups] = await Promise.all([
        base44.entities.DiagnosticEntryOperation.filter({ user_email: userEmail }, "-created_date"),
        base44.entities.DiagnosticSupplier.filter({ user_email: userEmail, is_active: true }, "-created_date"),
      ]);
      setEntries(data);
      setSuppliers(sups);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = entries.filter(e => {
    const typeMatch = typeFilter === "all" || e.entry_type === typeFilter;
    const searchMatch = !search ||
      e.nota_number?.includes(search) ||
      e.supplier_name?.toLowerCase().includes(search.toLowerCase()) ||
      e.service_description?.toLowerCase().includes(search.toLowerCase());
    return typeMatch && searchMatch;
  });

  // ===== XML IMPORT =====
  const handleXmlFile = async (file, dueDate) => {
    try {
      const text = await file.text();
      const data = parseNfeXml(text);

      // Find or create supplier
      let supplierId = null;
      let supplierName = data.supplier.name;
      let supplierCnpj = data.supplier.cpf_cnpj;
      let supplierUf = data.supplier.uf;
      let supplierCity = data.supplier.city;

      if (data.supplier.cpf_cnpj) {
        const existing = suppliers.filter(s => s.cpf_cnpj === data.supplier.cpf_cnpj);
        if (existing.length > 0) {
          supplierId = existing[0].id;
          supplierName = existing[0].name;
          toast({ title: "Fornecedor encontrado", description: `${supplierName} já cadastrado.` });
        } else {
          // Auto-create supplier from XML data
          const newSupplier = await base44.entities.DiagnosticSupplier.create({
            user_email: userEmail,
            name: data.supplier.name,
            cpf_cnpj: data.supplier.cpf_cnpj,
            ie: data.supplier.ie,
            cep: data.supplier.cep,
            address: data.supplier.address,
            number: data.supplier.number,
            district: data.supplier.district,
            city: data.supplier.city,
            uf: data.supplier.uf,
            category: "Peças",
            is_active: true,
          });
          supplierId = newSupplier.id;
          toast({ title: "Fornecedor cadastrado", description: `${supplierName} adicionado automaticamente do XML.` });
        }
      }

      // Upload XML file
      let xmlUrl = "";
      try {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        xmlUrl = file_url;
      } catch { /* non-critical */ }

      const dueDateIso = dueDate ? new Date(dueDate + "T12:00:00").toISOString() : new Date(Date.now() + 30 * 86400000).toISOString();

      // Create entry operation as "pendente" — stock and finance are generated when the operator clicks "Atualizar"
      await base44.entities.DiagnosticEntryOperation.create({
        user_email: userEmail,
        entry_type: "nota_fiscal",
        origin: "xml",
        supplier_id: supplierId,
        supplier_name: supplierName,
        supplier_cnpj: supplierCnpj,
        supplier_uf: supplierUf,
        supplier_city: supplierCity,
        nota_number: data.nota.number,
        nota_series: data.nota.series,
        nota_model: data.nota.model,
        issue_date: data.nota.issue_date ? new Date(data.nota.issue_date).toISOString() : new Date().toISOString(),
        entry_date: new Date().toISOString(),
        cfop: data.nota.cfop,
        nature_operation: data.nota.nature_operation,
        items: data.items,
        total_products: data.totals.total_products,
        total_icms: data.totals.total_icms,
        total_ipi: data.totals.total_ipi,
        total_nota: data.totals.total_nota,
        xml_file_url: xmlUrl,
        due_date: dueDateIso,
        payment_status: "aberto",
        status: "pendente",
      });

      toast({ title: "Entrada importada", description: `NF ${data.nota.number} — ${formatCurrency(data.totals.total_nota)}. Pendente: clique na situação para gerar estoque e financeiro.` });
      setShowXmlImport(false);
      load();
    } catch (e) {
      toast({ title: "Erro ao importar XML", description: e.message || "Não foi possível processar o arquivo.", variant: "destructive" });
    }
  };

  // ===== MANUAL ENTRY =====
  const handleManualSave = async (formData) => {
    try {
      // Check if supplier exists by CNPJ
      let supplierId = formData.supplier_id;
      let supplierName = formData.supplier_name;
      let supplierCnpj = formData.supplier_cnpj;
      let supplierUf = formData.supplier_uf;
      let supplierCity = formData.supplier_city;

      // If CNPJ provided but no supplier selected, check if exists
      if (!supplierId && formData.supplier_cnpj) {
        const existing = suppliers.filter(s => s.cpf_cnpj === formData.supplier_cnpj);
        if (existing.length > 0) {
          supplierId = existing[0].id;
          supplierName = existing[0].name;
        } else {
          // CNPJ not found — open supplier modal to register
          setPendingEntryData(formData);
          setSupplierForm({
            name: formData.supplier_name || "",
            cpf_cnpj: formData.supplier_cnpj || "",
          });
          setShowSupplierForm(true);
          setShowManualForm(false);
          toast({ title: "Fornecedor não cadastrado", description: "Preencha os dados do fornecedor para continuar." });
          return;
        }
      }

      // If no supplier at all but name typed, open supplier modal
      if (!supplierId && !formData.supplier_cnpj && formData.supplier_name) {
        setPendingEntryData(formData);
        setSupplierForm({ name: formData.supplier_name });
        setShowSupplierForm(true);
        setShowManualForm(false);
        toast({ title: "Fornecedor não cadastrado", description: "Cadastre o fornecedor para continuar." });
        return;
      }

      await createEntry(formData, supplierId, supplierName, supplierCnpj, supplierUf, supplierCity);
    } catch (e) {
      toast({ title: "Erro", description: "Não foi possível salvar a entrada.", variant: "destructive" });
    }
  };

  const createEntry = async (formData, supplierId, supplierName, supplierCnpj, supplierUf, supplierCity) => {
    const isServico = formData.entry_type === "servico";
    await base44.entities.DiagnosticEntryOperation.create({
      user_email: userEmail,
      entry_type: formData.entry_type || "nota_fiscal",
      origin: "manual",
      supplier_id: supplierId,
      supplier_name: supplierName,
      supplier_cnpj: supplierCnpj,
      supplier_uf: supplierUf,
      supplier_city: supplierCity,
      nota_number: formData.nota_number || "",
      nota_series: formData.nota_series || "",
      nota_model: formData.nota_model || "",
      issue_date: formData.issue_date ? new Date(formData.issue_date).toISOString() : new Date().toISOString(),
      entry_date: new Date().toISOString(),
      cfop: formData.cfop || "",
      nature_operation: formData.nature_operation || "",
      service_description: isServico ? formData.service_description : "",
      items: [],
      total_products: Number(formData.total_nota) || 0,
      total_icms: 0,
      total_ipi: 0,
      total_nota: Number(formData.total_nota) || 0,
      payment_method: formData.payment_method || "",
      due_date: formData.due_date ? new Date(formData.due_date).toISOString() : null,
      payment_status: formData.payment_status || "aberto",
      status: "registrada",
      notes: formData.notes || "",
    });

    toast({ title: "Entrada registrada", description: `${supplierName} — ${formatCurrency(Number(formData.total_nota) || 0)}` });
    setShowManualForm(false);
    setPendingEntryData(null);
    load();
  };

  // After supplier is saved from modal, continue with the pending entry
  const handleSupplierSaved = async (savedSupplier) => {
    setShowSupplierForm(false);
    if (pendingEntryData) {
      await createEntry(
        pendingEntryData,
        savedSupplier.id,
        savedSupplier.name,
        savedSupplier.cpf_cnpj,
        savedSupplier.uf,
        savedSupplier.city
      );
    }
  };

  const handleDelete = async (entry) => {
    if (!confirm(`Excluir a entrada ${entry.nota_number || entry.service_description?.slice(0, 30)}?`)) return;
    try {
      await base44.entities.DiagnosticEntryOperation.delete(entry.id);
      toast({ title: "Excluído", description: "Entrada removida." });
      load();
    } catch {
      toast({ title: "Erro", description: "Não foi possível excluir.", variant: "destructive" });
    }
  };

  const togglePaymentStatus = async (entry) => {
    try {
      await base44.entities.DiagnosticEntryOperation.update(entry.id, {
        payment_status: entry.payment_status === "pago" ? "aberto" : "pago",
      });
      load();
    } catch {
      toast({ title: "Erro", description: "Não foi possível atualizar.", variant: "destructive" });
    }
  };

  // Atualizar entrada pendente → processa estoque + gera financeiro + marca como "registrada"
  const handleUpdateEntry = async (entry) => {
    try {
      // Processa estoque (cadastra/atualiza peças)
      let newPartsCount = 0;
      let updatedPartsCount = 0;
      if (entry.items && entry.items.length > 0) {
        for (const item of entry.items) {
          if (!item.product_name) continue;
          const existingParts = await base44.entities.DiagnosticPart.filter({
            user_email: userEmail,
            code: item.product_code,
          });
          if (existingParts.length > 0) {
            const part = existingParts[0];
            await base44.entities.DiagnosticPart.update(part.id, {
              stock: (part.stock || 0) + item.quantity,
              cost_price: item.unit_price || part.cost_price,
              supplier: entry.supplier_name,
            });
            updatedPartsCount++;
          } else {
            await base44.entities.DiagnosticPart.create({
              user_email: userEmail,
              name: item.product_name,
              code: item.product_code || "",
              barcode: item.barcode || "",
              ncm: item.ncm || "",
              unit: item.unit || "UN",
              cost_price: item.unit_price || 0,
              sale_price: (item.unit_price || 0) * 1.3,
              stock: item.quantity || 0,
              min_stock: 0,
              supplier: entry.supplier_name,
              is_active: true,
            });
            newPartsCount++;
          }
        }
      }

      // Gera título a pagar no financeiro
      await base44.entities.PortalFinanceTransaction.create({
        user_email: userEmail,
        description: `NF-e ${entry.nota_number} — ${entry.supplier_name}`.trim(),
        amount: entry.total_nota,
        type: "expense",
        source_module: "workshop",
        category: "Entrada de Mercadoria",
        date: new Date().toISOString(),
        launch_date: new Date().toISOString(),
        due_date: entry.due_date || new Date(Date.now() + 30 * 86400000).toISOString(),
        contact_name: entry.supplier_name,
        status: "pending",
      });

      // Atualiza status da entrada para "registrada"
      await base44.entities.DiagnosticEntryOperation.update(entry.id, {
        status: "registrada",
      });

      const partsMsg = newPartsCount > 0 || updatedPartsCount > 0
        ? ` • ${newPartsCount} peça(s) cadastrada(s), ${updatedPartsCount} atualizada(s)`
        : "";
      toast({ title: "Entrada atualizada", description: `NF ${entry.nota_number} — ${formatCurrency(entry.total_nota)}${partsMsg} • Título financeiro gerado.` });
      load();
    } catch {
      toast({ title: "Erro", description: "Não foi possível atualizar a entrada.", variant: "destructive" });
    }
  };

  // Cancelar entrada pendente → marca como "cancelada", sem gerar estoque ou financeiro
  const handleCancelEntry = async (entry) => {
    if (!confirm(`Cancelar a entrada NF ${entry.nota_number || entry.service_description?.slice(0, 30)}? Nenhum financeiro ou estoque será gerado.`)) return;
    try {
      await base44.entities.DiagnosticEntryOperation.update(entry.id, {
        status: "cancelada",
      });
      toast({ title: "Entrada cancelada", description: "A nota foi marcada como cancelada." });
      load();
    } catch {
      toast({ title: "Erro", description: "Não foi possível cancelar.", variant: "destructive" });
    }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <ArrowDownToLine className="w-5 h-5 text-blue-600" /> Entradas ({entries.length})
        </h3>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => setShowXmlImport(true)} className="gap-1 border-green-200 text-green-600 hover:bg-green-50">
            <FileUp className="w-4 h-4" /> Importar NF-e
          </Button>
          <Button type="button" variant="outline" onClick={() => setShowNfseImport(true)} className="gap-1 border-purple-200 text-purple-600 hover:bg-purple-50">
            <Wrench className="w-4 h-4" /> Importar NFS-e
          </Button>
          <Button type="button" onClick={() => setShowManualForm(true)} className="gap-1 text-white" style={{ backgroundColor: "#2563EB" }}>
            <Plus className="w-4 h-4" /> Nova Entrada
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <div className="flex gap-1.5">
          {[
            { v: "all", l: "Todas" },
            { v: "nota_fiscal", l: "Notas Fiscais" },
            { v: "servico", l: "Serviços" },
          ].map(f => (
            <button
              key={f.v}
              type="button"
              onClick={() => setTypeFilter(f.v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                typeFilter === f.v ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {f.l}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nota, fornecedor ou serviço..." className="pl-9 h-9" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <ArrowDownToLine className="w-12 h-12 mx-auto mb-2 text-gray-300" />
          <p>{search || typeFilter !== "all" ? "Nenhuma entrada encontrada." : "Nenhuma entrada registrada."}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="p-3 font-medium">Tipo</th>
                <th className="p-3 font-medium">Fornecedor</th>
                <th className="p-3 font-medium">Nota/Serviço</th>
                <th className="p-3 font-medium">Emissão</th>
                <th className="p-3 font-medium text-right">Total</th>
                <th className="p-3 font-medium">Situação</th>
                <th className="p-3 font-medium text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => (
                <tr key={e.id} className="border-t border-gray-100 hover:bg-blue-50/30">
                  <td className="p-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      e.entry_type === "servico" ? "bg-purple-50 text-purple-600" : "bg-blue-50 text-blue-600"
                    }`}>
                      {e.entry_type === "servico" ? <><Wrench className="w-3 h-3" /> Serviço</> : <><FileText className="w-3 h-3" /> Nota Fiscal</>}
                    </span>
                    {e.origin === "xml" && <span className="ml-1 text-[10px] text-green-500">XML</span>}
                  </td>
                  <td className="p-3 font-medium">{e.supplier_name || "—"}</td>
                  <td className="p-3 text-gray-500 text-xs">
                    {e.entry_type === "servico"
                      ? (e.service_description?.slice(0, 40) || "—")
                      : (<><span className="font-mono">{e.nota_number || "—"}</span>{e.nota_series && ` / ${e.nota_series}`}</>)
                    }
                  </td>
                  <td className="p-3 text-gray-400 text-xs">{formatDate(e.issue_date)}</td>
                  <td className="p-3 text-right font-medium text-red-600">{formatCurrency(e.total_nota)}</td>
                  <td className="p-3 relative">
                    {(!e.status || e.status === "pendente") ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setStatusMenuId(statusMenuId === e.id ? null : e.id)}
                          className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-600 inline-flex items-center gap-0.5"
                        >
                          Pendente <ChevronDown className="w-3 h-3" />
                        </button>
                        {statusMenuId === e.id && (
                          <div className="absolute z-30 mt-1 right-0 w-44 bg-white rounded-lg border border-gray-200 shadow-lg py-1 text-left">
                            <button type="button" onClick={() => { setStatusMenuId(null); handleUpdateEntry(e); }} className="w-full px-3 py-1.5 text-xs hover:bg-green-50 text-green-600 font-medium flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Atualizar (gerar)
                            </button>
                            <button type="button" onClick={() => { setStatusMenuId(null); handleCancelEntry(e); }} className="w-full px-3 py-1.5 text-xs hover:bg-red-50 text-red-600 font-medium flex items-center gap-1.5">
                              <X className="w-3.5 h-3.5" /> Cancelar documento
                            </button>
                          </div>
                        )}
                      </>
                    ) : e.status === "cancelada" ? (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600">Cancelada</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => togglePaymentStatus(e)}
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          e.payment_status === "pago" ? "bg-green-50 text-green-600" : "bg-blue-50 text-blue-600"
                        }`}
                      >
                        {e.payment_status === "pago" ? "Pago" : "Registrada"}
                      </button>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    <button type="button" onClick={() => handleDelete(e)} className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* XML Import Modal (NF-e) */}
      {showXmlImport && (
        <XmlImportModal
          onClose={() => setShowXmlImport(false)}
          onFile={handleXmlFile}
          fileRef={fileRef}
        />
      )}

      {/* NFS-e Import Modal */}
      {showNfseImport && (
        <NfseImporter
          userEmail={userEmail}
          suppliers={suppliers}
          onClose={() => setShowNfseImport(false)}
          onSaved={load}
        />
      )}

      {/* Manual Entry Form */}
      {showManualForm && (
        <ManualEntryForm
          userEmail={userEmail}
          suppliers={suppliers}
          onClose={() => setShowManualForm(false)}
          onSave={handleManualSave}
        />
      )}

      {/* Supplier Form Modal (when supplier not found) */}
      {showSupplierForm && (
        <SupplierQuickForm
          userEmail={userEmail}
          initialData={supplierForm}
          onClose={() => { setShowSupplierForm(false); setPendingEntryData(null); }}
          onSaved={handleSupplierSaved}
        />
      )}
    </div>
  );
}

// ===== XML Import Modal =====
function XmlImportModal({ onClose, onFile, fileRef }) {
  const [dragging, setDragging] = useState(false);
  const [dueDate, setDueDate] = useState("");

  // Calcula vencimento padrão: 30 dias a partir de hoje (formato YYYY-MM-DD)
  const defaultDue = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

  const handleFileWithDue = (file) => {
    onFile(file, dueDate || defaultDue);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <FileUp className="w-5 h-5 text-green-600" /> Importar Nota Fiscal (XML)
          </h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700">
            Ao importar o XML da NF-e, o sistema <b>cadastra automaticamente o fornecedor</b> e armazena a entrada como <b>pendente</b>.
            O estoque e o título financeiro só serão gerados quando você clicar em <b>Atualizar</b> na situação da nota.
          </p>
        </div>

        {/* Data de vencimento */}
        <div className="mb-4">
          <Label className="text-sm">Data de Vencimento (Financeiro)</Label>
          <Input
            type="date"
            value={dueDate || defaultDue}
            onChange={e => setDueDate(e.target.value)}
            className="mt-1"
          />
          <p className="text-xs text-gray-400 mt-1">O título a pagar será criado no módulo financeiro com este vencimento.</p>
        </div>

        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) handleFileWithDue(f); }}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
            dragging ? "border-green-400 bg-green-50" : "border-gray-300 hover:border-green-400 hover:bg-green-50/50"
          }`}
        >
          <Upload className="w-10 h-10 text-gray-400 mx-auto mb-2" />
          <p className="text-sm font-medium">Clique ou arraste o arquivo XML</p>
          <p className="text-xs text-gray-400 mt-1">Formato: .xml (NF-e modelo 55)</p>
          <input ref={fileRef} type="file" accept=".xml" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFileWithDue(f); }} />
        </div>
      </div>
    </div>
  );
}

// ===== Manual Entry Form =====
function ManualEntryForm({ userEmail, suppliers, onClose, onSave }) {
  const [form, setForm] = useState({
    entry_type: "nota_fiscal",
    supplier_id: "",
    supplier_name: "",
    supplier_cnpj: "",
    supplier_uf: "",
    supplier_city: "",
    nota_number: "",
    nota_series: "",
    nota_model: "",
    issue_date: "",
    cfop: "",
    nature_operation: "",
    service_description: "",
    total_nota: "",
    payment_method: "0",
    due_date: "",
    payment_status: "aberto",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [supplierSearch, setSupplierSearch] = useState("");
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);

  const filteredSuppliers = suppliers.filter(s =>
    s.name?.toLowerCase().includes(supplierSearch.toLowerCase()) ||
    s.cpf_cnpj?.includes(supplierSearch)
  );

  const selectSupplier = (s) => {
    setForm(prev => ({
      ...prev,
      supplier_id: s.id,
      supplier_name: s.name,
      supplier_cnpj: s.cpf_cnpj || "",
      supplier_uf: s.uf || "",
      supplier_city: s.city || "",
    }));
    setSupplierSearch(s.name);
    setShowSupplierDropdown(false);
  };

  const handleSubmit = () => {
    if (!form.supplier_name && !supplierSearch) {
      alert("Informe o fornecedor!");
      return;
    }
    // If user typed a name but didn't select from dropdown, pass the typed name
    if (!form.supplier_id) {
      form.supplier_name = supplierSearch;
    }
    setSaving(true);
    onSave(form);
  };

  const isServico = form.entry_type === "servico";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">Nova Entrada</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        {/* Entry type selector */}
        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => setForm({ ...form, entry_type: "nota_fiscal" })}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
              form.entry_type === "nota_fiscal" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            <FileText className="w-4 h-4 inline mr-1" /> Nota Fiscal
          </button>
          <button
            type="button"
            onClick={() => setForm({ ...form, entry_type: "servico" })}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
              form.entry_type === "servico" ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            <Wrench className="w-4 h-4 inline mr-1" /> Serviço
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Supplier search */}
          <div className="md:col-span-2 relative">
            <Label className="text-sm">Fornecedor *</Label>
            <Input
              value={supplierSearch}
              onChange={e => {
                setSupplierSearch(e.target.value);
                setShowSupplierDropdown(true);
                setForm(prev => ({ ...prev, supplier_id: "", supplier_name: e.target.value }));
              }}
              onFocus={() => setShowSupplierDropdown(true)}
              onBlur={() => setTimeout(() => setShowSupplierDropdown(false), 200)}
              className="mt-1"
              placeholder="Digite o nome ou CNPJ do fornecedor..."
            />
            {showSupplierDropdown && filteredSuppliers.length > 0 && (
              <div className="absolute z-30 mt-1 w-full bg-white rounded-lg border border-gray-200 shadow-lg max-h-48 overflow-y-auto">
                {filteredSuppliers.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    onMouseDown={() => selectSupplier(s)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50"
                  >
                    <div className="font-medium">{s.name}</div>
                    {s.cpf_cnpj && <div className="text-xs text-gray-400">{maskCpfCnpj(s.cpf_cnpj)}</div>}
                  </button>
                ))}
              </div>
            )}
            {showSupplierDropdown && supplierSearch && filteredSuppliers.length === 0 && (
              <div className="absolute z-30 mt-1 w-full bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs text-amber-700">
                Fornecedor não encontrado. O sistema abrirá o cadastro ao salvar.
              </div>
            )}
          </div>

          {!isServico && (
            <>
              <div>
                <Label className="text-sm">Número da Nota</Label>
                <Input value={form.nota_number} onChange={e => setForm({ ...form, nota_number: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label className="text-sm">Série</Label>
                <Input value={form.nota_series} onChange={e => setForm({ ...form, nota_series: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label className="text-sm">Modelo</Label>
                <Input value={form.nota_model} onChange={e => setForm({ ...form, nota_model: e.target.value })} className="mt-1" placeholder="55, 65..." />
              </div>
              <div>
                <Label className="text-sm">Data de Emissão</Label>
                <Input type="date" value={form.issue_date} onChange={e => setForm({ ...form, issue_date: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label className="text-sm">CFOP</Label>
                <Input value={form.cfop} onChange={e => setForm({ ...form, cfop: e.target.value })} className="mt-1" placeholder="Ex: 1102" />
              </div>
              <div>
                <Label className="text-sm">Natureza da Operação</Label>
                <Input value={form.nature_operation} onChange={e => setForm({ ...form, nature_operation: e.target.value })} className="mt-1" />
              </div>
            </>
          )}

          {isServico && (
            <div className="md:col-span-2">
              <Label className="text-sm">Descrição do Serviço *</Label>
              <textarea
                value={form.service_description}
                onChange={e => setForm({ ...form, service_description: e.target.value })}
                rows={3}
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 mt-1 text-sm"
                placeholder="Ex: Retífica de cabeçote, serviço de funilaria..."
              />
            </div>
          )}

          <div>
            <Label className="text-sm">Valor Total *</Label>
            <Input type="number" step="0.01" value={form.total_nota} onChange={e => setForm({ ...form, total_nota: e.target.value })} className="mt-1" />
          </div>
          <div>
            <Label className="text-sm">Data de Vencimento</Label>
            <Input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} className="mt-1" />
          </div>
          <div>
            <Label className="text-sm">Forma de Pagamento</Label>
            <select value={form.payment_method} onChange={e => setForm({ ...form, payment_method: e.target.value })} className="w-full h-9 rounded-md border border-input bg-transparent px-3 mt-1 text-sm">
              <option value="0">À vista</option>
              <option value="1">A prazo</option>
            </select>
          </div>
          <div>
            <Label className="text-sm">Status do Pagamento</Label>
            <select value={form.payment_status} onChange={e => setForm({ ...form, payment_status: e.target.value })} className="w-full h-9 rounded-md border border-input bg-transparent px-3 mt-1 text-sm">
              <option value="aberto">Em aberto</option>
              <option value="pago">Pago</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <Label className="text-sm">Observações</Label>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full rounded-md border border-input bg-transparent px-3 py-2 mt-1 text-sm" />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="button" onClick={handleSubmit} disabled={saving} className="text-white" style={{ backgroundColor: "#2563EB" }}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ===== Supplier Quick Form (when supplier not found) =====
function SupplierQuickForm({ userEmail, initialData, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: initialData?.name || "",
    trade_name: "",
    cpf_cnpj: initialData?.cpf_cnpj || "",
    ie: "",
    contact_person: "",
    phone: "",
    whatsapp: "",
    email: "",
    website: "",
    cep: "",
    address: "",
    number: "",
    complement: "",
    district: "",
    city: "",
    uf: "",
    payment_terms: "",
    delivery_time: "",
    category: "",
    notes: "",
    is_active: true,
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.name.trim()) { alert("Informe a razão social!"); return; }
    setSaving(true);
    try {
      const data = { ...form, user_email: userEmail };
      const result = await base44.entities.DiagnosticSupplier.create(data);
      onSaved(result);
    } catch (e) {
      alert("Erro ao salvar: " + e.message);
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold">Cadastrar Fornecedor</h3>
            <p className="text-xs text-amber-600 mt-1">⚠ Fornecedor não encontrado — cadastre para continuar.</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <Label className="text-sm">Razão Social *</Label>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="mt-1" />
          </div>
          <div>
            <Label className="text-sm">Nome Fantasia</Label>
            <Input value={form.trade_name} onChange={e => setForm({ ...form, trade_name: e.target.value })} className="mt-1" />
          </div>
          <div>
            <Label className="text-sm">CNPJ / CPF</Label>
            <Input value={maskCpfCnpj(form.cpf_cnpj)} onChange={e => setForm({ ...form, cpf_cnpj: e.target.value.replace(/\D/g, "").slice(0, 14) })} className="mt-1" placeholder="00.000.000/0000-00" />
          </div>
          <div>
            <Label className="text-sm">IE</Label>
            <Input value={form.ie} onChange={e => setForm({ ...form, ie: e.target.value })} className="mt-1" />
          </div>
          <div>
            <Label className="text-sm">Categoria</Label>
            <Input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="mt-1" placeholder="Peças, Óleos..." />
          </div>
          <div>
            <Label className="text-sm">Contato</Label>
            <Input value={form.contact_person} onChange={e => setForm({ ...form, contact_person: e.target.value })} className="mt-1" />
          </div>
          <div>
            <Label className="text-sm">Telefone</Label>
            <Input value={maskPhone(form.phone)} onChange={e => setForm({ ...form, phone: e.target.value.replace(/\D/g, "").slice(0, 11) })} className="mt-1" placeholder="(00) 0000-0000" />
          </div>
          <div>
            <Label className="text-sm">WhatsApp</Label>
            <Input value={maskPhone(form.whatsapp)} onChange={e => setForm({ ...form, whatsapp: e.target.value.replace(/\D/g, "").slice(0, 11) })} className="mt-1" placeholder="(00) 00000-0000" />
          </div>
          <div>
            <Label className="text-sm">Email</Label>
            <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="mt-1" />
          </div>
          <div>
            <Label className="text-sm">CEP</Label>
            <Input value={maskCep(form.cep)} onChange={e => setForm({ ...form, cep: e.target.value.replace(/\D/g, "").slice(0, 8) })} className="mt-1" placeholder="00000-000" />
          </div>
          <div className="md:col-span-2">
            <Label className="text-sm">Logradouro</Label>
            <Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="mt-1" />
          </div>
          <div>
            <Label className="text-sm">Número</Label>
            <Input value={form.number} onChange={e => setForm({ ...form, number: e.target.value })} className="mt-1" />
          </div>
          <div>
            <Label className="text-sm">Bairro</Label>
            <Input value={form.district} onChange={e => setForm({ ...form, district: e.target.value })} className="mt-1" />
          </div>
          <div className="md:col-span-2">
            <Label className="text-sm">Município</Label>
            <Input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} className="mt-1" />
          </div>
          <div>
            <Label className="text-sm">UF</Label>
            <select value={form.uf} onChange={e => setForm({ ...form, uf: e.target.value })} className="w-full h-9 rounded-md border border-input bg-transparent px-3 mt-1 text-sm">
              <option value="">—</option>
              {UFS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-sm">Condições de Pagamento</Label>
            <Input value={form.payment_terms} onChange={e => setForm({ ...form, payment_terms: e.target.value })} className="mt-1" placeholder="Ex: 30 dias" />
          </div>
          <div>
            <Label className="text-sm">Prazo de Entrega</Label>
            <Input value={form.delivery_time} onChange={e => setForm({ ...form, delivery_time: e.target.value })} className="mt-1" placeholder="Ex: 3 dias úteis" />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="button" onClick={save} disabled={saving} className="text-white" style={{ backgroundColor: "#2563EB" }}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Cadastrar e Salvar Entrada"}
          </Button>
        </div>
      </div>
    </div>
  );
}
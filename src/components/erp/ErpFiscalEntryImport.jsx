import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { X, Upload, Loader2, FileText, CheckCircle2, AlertTriangle, ArrowDownToLine, Keyboard, Plus, Trash2, Link2, UserPlus, Package, Truck } from "lucide-react";
import { parseFiscalXml } from "@/lib/erpXmlParse";
import { fmtMoney, fmtDate } from "@/lib/erpUtils";
import { maskCpfCnpj } from "@/lib/brMasks";
import { lookupCnpj } from "@/lib/cnpjLookup";
import { computeErpFiscalItem } from "@/lib/erpTaxCalc";
import ErpProductFormModal from "@/components/erp/ErpProductFormModal";
import ErpManualInstallments from "@/components/erp/ErpManualInstallments";
import ErpApportionmentEditor from "@/components/erp/ErpApportionmentEditor";
import ErpFiscalItemTaxes from "@/components/erp/ErpFiscalItemTaxes";
import ErpFiscalCapaTaxes from "@/components/erp/ErpFiscalCapaTaxes";
import { lancarEntradaNF } from "@/lib/erpDespesa";

const digits = (v) => String(v || "").replace(/\D/g, "");
const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

// Modal de entrada de documento (NF-e/NFS-e por XML ou digitação manual).
// XML: cadastra o fornecedor automaticamente se não existir, e vincula cada item
// ao produto meu através do código do fornecedor (cProd). Se não houver vínculo
// e o usuário não informar um produto destino, cria o produto e o vínculo.
export default function ErpFiscalEntryImport({ user, onClose, onSaved, onGoToProducts }) {
  const [mode, setMode] = useState("xml");
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [orders, setOrders] = useState([]);
  const [operations, setOperations] = useState([]);
  const [taxRules, setTaxRules] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [links, setLinks] = useState([]);
  const [poId, setPoId] = useState("");
  const [opId, setOpId] = useState("");
  const [departments, setDepartments] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [manualApportionments, setManualApportionments] = useState([]);
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  // Vínculo por item (XML): product_id selecionado, "new" para criar novo, ou "" (auto = cria novo)
  const [itemChoices, setItemChoices] = useState([]);
  const [supplierStatus, setSupplierStatus] = useState(""); // "exists" | "will_create" | ""
  // Digitação manual: consulta Receita ao informar CNPJ e modal de cadastro de produto
  const [supplierLookup, setSupplierLookup] = useState({ busy: false, msg: "", status: "", data: null });
  const [productModal, setProductModal] = useState(null);
  const lastCnpjLookup = useRef("");
  // Parcelas/vencimentos do financeiro (digitação manual)
  const [manualInstallments, setManualInstallments] = useState([{ due_date: new Date().toISOString().slice(0, 10), amount: "" }]);
  // Frete (CT-e/NF-e/NFS-e): documento separado que compõe o custo dos produtos
  const [freteXml, setFreteXml] = useState(null);
  const [freteParsing, setFreteParsing] = useState(false);
  const [freteError, setFreteError] = useState("");
  const [freteOpId, setFreteOpId] = useState("");
  const [freteCfop, setFreteCfop] = useState("");
  const [companyUF, setCompanyUF] = useState("");
  const freteFileRef = useRef(null);
  const fileRef = useRef(null);

  const [manual, setManual] = useState({
    nota_number: "",
    issue_date: new Date().toISOString().slice(0, 10), nature_operation: "", cfop: "", total_nota: "",
    dif_aliquota_value: "", despesas_value: "", descontos_value: "", ciap_curto_value: "", ciap_longo_value: "",
    icms_frete_value: "", pis_frete_value: "", cofins_frete_value: "",
  });
  const [manualItems, setManualItems] = useState([{ product_name: "", product_id: "", quantity: 1, unit_price: 0 }]);
  const setM = (k, v) => setManual(p => ({ ...p, [k]: v }));
  // Impostos da capa — devem fechar com a soma dos itens
  const [capa, setCapa] = useState({ base_icms: "", aliq_icms: "", aliq_reducao_icms: "", base_pis_cofins: "", aliq_pis_cofins: "", pauta_pis_cofins: "", difal_value: "" });

  // Fornecedor da entrada (passo 2): pesquisável no cadastro ou informado por CNPJ.
  // CNPJ não cadastrado → consulta a Receita Federal e cadastra ao dar entrada.
  const [forn, setForn] = useState({ id: "", name: "", cnpj: "", uf: "" });
  const setF = (patch) => setForn(p => ({ ...p, ...patch }));
  const pickForn = (id) => {
    const s = suppliers.find(x => x.id === id);
    if (!s) { setForn({ id: "", name: "", cnpj: "", uf: "" }); setSupplierLookup({ busy: false, msg: "", status: "", data: null }); return; }
    setForn({ id: s.id, name: s.name, cnpj: maskCpfCnpj(String(s.document || "")), uf: s.uf || "" });
    setSupplierLookup({ busy: false, status: "exists", msg: `Fornecedor cadastrado: ${s.name}`, data: null });
  };
  const handleFornCnpj = async (raw) => {
    const masked = maskCpfCnpj(raw);
    setF({ cnpj: masked });
    const doc = digits(masked);
    if (doc.length !== 14) { setSupplierLookup({ busy: false, msg: "", status: "", data: null }); return; }
    if (doc === lastCnpjLookup.current) return;
    lastCnpjLookup.current = doc;
    const existing = suppliers.find(s => s.document === doc);
    if (existing) {
      setSupplierLookup({ busy: false, status: "exists", msg: `Fornecedor já cadastrado: ${existing.name}`, data: null });
      setForn(p => ({ id: existing.id, name: existing.name, cnpj: masked, uf: existing.uf || p.uf }));
      return;
    }
    setSupplierLookup({ busy: true, status: "", msg: "Consultando CNPJ na Receita Federal...", data: null });
    const res = await lookupCnpj(doc);
    if (res?.error) {
      setSupplierLookup({ busy: false, status: "", msg: `CNPJ não cadastrado — não foi possível consultar a Receita Federal (${res.error}). O fornecedor será criado com os dados informados.`, data: null });
      return;
    }
    setForn(p => ({ id: "", name: p.name || res.razao_social, cnpj: masked, uf: p.uf || res.uf || "" }));
    setSupplierLookup({ busy: false, status: "new", msg: `Dados obtidos da Receita Federal — o fornecedor "${res.razao_social}" será cadastrado automaticamente ao dar entrada.`, data: res });
  };

  // Descrição do item (manual): sugere produtos já cadastrados e vincula quando o nome coincide
  const onManualItemName = (i, value) => setManualItems(p => p.map((x, idx) => idx === i
    ? { ...x, product_name: value, product_id: products.find(pr => pr.name === value)?.id || "" } : x));

  // Abre o cadastro de produto e aguarda (resolve com o produto criado ou null se cancelado)
  const askNewProduct = (draft) => new Promise(resolve => setProductModal({ draft, resolve }));

  // Ao adicionar parcela: redistribui o total do documento igualmente com
  // vencimentos mensais a partir do primeiro (ajustável depois pelo usuário)
  const addParcela = () => {
    setManualInstallments(prev => {
      const qty = prev.length + 1;
      const firstDate = prev[0]?.due_date || new Date().toISOString().slice(0, 10);
      const base = Number(manual.total_nota) || 0;
      const per = Math.round((base / qty) * 100) / 100;
      return Array.from({ length: qty }, (_, i) => {
        const d = new Date(`${firstDate}T12:00:00`);
        d.setMonth(d.getMonth() + i);
        return {
          due_date: d.toISOString().slice(0, 10),
          amount: base > 0 ? (i === qty - 1 ? Math.round((base - per * (qty - 1)) * 100) / 100 : per) : "",
        };
      });
    });
  };

  // Calcula os impostos do item pela regra fiscal da operação de entrada selecionada
  const calcManualItem = (it) => {
    const op = operations.find(o => o.id === opId);
    if (!op) return null;
    return computeErpFiscalItem(
      { ncm: "", quantity: Number(it.quantity) || 0, unit_price: Number(it.unit_price) || 0 },
      { rules: taxRules, operation: op, customerUF: forn.uf }
    );
  };

  // Troca de operação: re-aplica a regra fiscal — limpa os impostos calculados
  // automaticamente (mantém os editados manualmente) e zera a capa para re-preencher
  const handleOpChange = (value) => {
    setOpId(value);
    setError("");
    setCapa({ base_icms: "", aliq_icms: "", aliq_reducao_icms: "", base_pis_cofins: "", aliq_pis_cofins: "", pauta_pis_cofins: "", difal_value: "" });
    setManualItems(prev => prev.map(it => it._taxEdited ? it : {
      ...it,
      cst_icms: "", base_icms: "", icms_rate: "", aliq_reducao_icms: "", icms_value: "", difal_value: "",
      cst_pis: "", cst_cofins: "", base_pis_cofins: "", aliq_pis_cofins: "", pauta_pis_cofins: "",
      aliq_pis: "", aliq_cofins: "", pauta_pis: "", pauta_cofins: "", pis_value: "", cofins_value: "",
      cst_cbs: "", cbs_rate: "", cbs_value: "", cst_ibs: "", ibs_rate: "", ibs_value: "",
    }));
  };

  useEffect(() => {
    Promise.all([
      base44.entities.ErpPurchaseOrder.filter({ user_email: user.email, status: { $ne: "cancelada" } }, "-emission_date", 200),
      base44.entities.ErpOperation.filter({ user_email: user.email, type: "entrada", is_active: true }, "name", 200),
      base44.entities.ErpPartner.filter({ user_email: user.email, partner_type: { $in: ["fornecedor", "ambos"] } }, "-created_date", 500),
      base44.entities.ErpProduct.filter({ user_email: user.email }, "-created_date", 500),
      base44.entities.ErpProductSupplier.filter({ user_email: user.email }, "-created_date", 500),
      base44.entities.ErpDepartment.filter({ user_email: user.email, is_active: true }, "name", 500),
      base44.entities.ErpChartAccount.filter({ user_email: user.email, accepts_entries: true }, "code", 500),
      base44.entities.ErpTaxRule.filter({ user_email: user.email }, "-created_date", 500),
      base44.entities.ErpSector.filter({ user_email: user.email, is_active: true }, "name", 500),
    ]).then(([o, op, s, p, l, d, acc, tr, sec]) => { setOrders(o); setOperations(op); setSuppliers(s); setProducts(p); setLinks(l); setDepartments(d); setAccounts(acc); setTaxRules(tr); setSectors(sec); }).catch(() => {});
  }, [user.email]);

  // UF da empresa — base do CFOP do frete (mesma UF → 1xxx, fora → 2xxx)
  useEffect(() => {
    base44.entities.ErpCompany.filter({ user_email: user.email }, "-created_date", 20)
      .then(list => setCompanyUF((list.find(c => c.is_main) || list[0] || {}).uf || ""))
      .catch(() => setCompanyUF(""));
  }, [user.email]);

  const selectedPo = orders.find(o => o.id === poId);
  const nfTotal = mode === "xml" ? parsed?.totals.total_nota : Number(manual.total_nota || 0);
  const diff = selectedPo ? nfTotal - (selectedPo.total_value || 0) : 0;
  const match = selectedPo ? Math.abs(diff) < 0.01 : false;

  // CFOP da operação pela UF do fornecedor: mesma UF da empresa → dentro do estado; fora → fora do estado; EX → importação
  const selectedOp = operations.find(o => o.id === opId);
  const cfopAuto = (() => {
    if (!selectedOp || !forn.uf) return "";
    if (forn.uf === "EX") return selectedOp.cfop_importacao || "";
    return companyUF && forn.uf === companyUF ? (selectedOp.cfop_dentro_estado || "") : (selectedOp.cfop_fora_estado || "");
  })();

  // Resolve fornecedor e vínculos por item quando o XML é parseado
  useEffect(() => {
    if (mode !== "xml" || !parsed) { setSupplierStatus(""); setItemChoices([]); return; }
    const doc = digits(parsed.supplier.cpf_cnpj);
    const existing = suppliers.find(s => s.document === doc);
    setSupplierStatus(existing ? "exists" : "will_create");
    // Pré-vincula itens que já tenham link (supplier_document + supplier_product_code)
    const docLinks = links.filter(l => digits(l.supplier_document) === doc);
    setItemChoices(parsed.items.map(it => {
      const lk = docLinks.find(l => l.supplier_product_code === it.product_code);
      return lk?.product_id || "new";
    }));
  }, [parsed, mode, suppliers, links]);

  // XML parseado: preenche o fornecedor da entrada com o emitente da nota
  useEffect(() => {
    if (!parsed) return;
    const existing = suppliers.find(s => s.document === digits(parsed.supplier.cpf_cnpj));
    setForn({ id: existing?.id || "", name: parsed.supplier.name, cnpj: parsed.supplier.cpf_cnpj, uf: parsed.supplier.uf || "" });
  }, [parsed]);

  // OC selecionada (digitação manual): traz os produtos do pedido para a entrada
  useEffect(() => {
    if (mode !== "manual" || !poId || !selectedPo) return;
    if (!(selectedPo.items || []).length) return;
    setManualItems(selectedPo.items.map(it => ({
      product_id: it.product_id || "",
      product_name: it.product_name || "",
      quantity: it.quantity || 1,
      unit_price: it.unit_cost || 0,
    })));
  }, [poId, mode]);

  // Soma dos impostos dos itens — base de comparação com a capa
  const taxSums = (() => {
    const s = (k) => manualItems.reduce((a, it) => a + (Number(it[k]) || 0), 0);
    return {
      base_icms: Math.round(s("base_icms") * 100) / 100,
      icms_value: Math.round(s("icms_value") * 100) / 100,
      base_pis_cofins: Math.round(s("base_pis_cofins") * 100) / 100,
      pis_value: Math.round(s("pis_value") * 100) / 100,
      cofins_value: Math.round(s("cofins_value") * 100) / 100,
      difal_value: Math.round(s("difal_value") * 100) / 100,
      cbs_value: Math.round(s("cbs_value") * 100) / 100,
      ibs_value: Math.round(s("ibs_value") * 100) / 100,
    };
  })();

  // Preenche os impostos de cada item pela regra fiscal da operação (digitação
  // manual) — depois o usuário mantém os campos por item (base/alíquota/valores/CST)
  const itemsSignature = manualItems.map(it => `${it.product_id}|${it.product_name}|${it.quantity}|${it.unit_price}`).join(";");
  useEffect(() => {
    if (mode !== "manual" || !opId) return;
    setManualItems(prev => {
      let changed = false;
      const next = prev.map(it => {
        if (it._taxEdited) return it;
        const hasTaxes = ["base_icms", "icms_value", "pis_value", "cofins_value", "difal_value"].some(k => it[k] !== undefined && it[k] !== "" && Number(it[k]) !== 0);
        if (hasTaxes) return it;
        const calc = calcManualItem(it);
        if (!calc || !(calc.icms_value || calc.pis_value || calc.cofins_value || calc.ipi_value || calc.difal)) return it;
        changed = true;
        return {
          ...it,
          cst_icms: calc.cst_icms || "",
          base_icms: Math.round((calc.icms_base || 0) * 100) / 100,
          icms_rate: calc.icms_rate || 0,
          aliq_reducao_icms: 0,
          icms_value: Math.round((calc.icms_value || 0) * 100) / 100,
          difal_value: Math.round((calc.difal?.difal_total || 0) * 100) / 100,
          cst_pis: calc.cst_pis || "",
          cst_cofins: calc.cst_cofins || "",
          base_pis_cofins: Math.round((calc.pis_base || 0) * 100) / 100,
          aliq_pis_cofins: calc.pis_rate || 0,
          aliq_pis: calc.pis_rate || 0,
          aliq_cofins: calc.cofins_rate || 0,
          pis_value: Math.round((calc.pis_value || 0) * 100) / 100,
          cofins_value: Math.round((calc.cofins_value || 0) * 100) / 100,
          cst_cbs: calc.cst_cbs || "",
          cbs_rate: calc.cbs_rate || 0,
          cbs_value: Math.round((calc.cbs_value || 0) * 100) / 100,
          cst_ibs: calc.cst_ibs || "",
          ibs_rate: calc.ibs_rate || 0,
          ibs_value: Math.round((calc.ibs_value || 0) * 100) / 100,
        };
      });
      return changed ? next : prev;
    });
  }, [opId, forn.uf, taxRules, manualItems.length, mode, itemsSignature]);

  // Capa: alíquotas preenchidas automaticamente pela regra fiscal da operação e
  // bases/DIFAL pela soma dos impostos calculados nos itens — o preenchido pelo
  // usuário é preservado, os campos vazios podem ser mantidos para ajuste manual
  useEffect(() => {
    if (mode !== "manual" || !opId) return;
    const first = manualItems.find(it => it.product_name?.trim() && (Number(it.quantity) || 0) > 0);
    if (!first) return;
    const calc = calcManualItem(first);
    setCapa(prev => {
      const isEmpty = (v) => v === undefined || v === null || String(v).trim() === "";
      const next = {};
      if (isEmpty(prev.base_icms) && taxSums.base_icms > 0) next.base_icms = taxSums.base_icms;
      if (isEmpty(prev.aliq_icms) && (calc?.icms_rate || 0) > 0) next.aliq_icms = calc.icms_rate;
      if (isEmpty(prev.base_pis_cofins) && taxSums.base_pis_cofins > 0) next.base_pis_cofins = taxSums.base_pis_cofins;
      if (isEmpty(prev.aliq_pis_cofins) && (calc?.pis_rate || 0) > 0) next.aliq_pis_cofins = calc.pis_rate;
      if (isEmpty(prev.difal_value) && taxSums.difal_value > 0) next.difal_value = taxSums.difal_value;
      if (Object.keys(next).length === 0) return prev;
      return { ...prev, ...next };
    });
  }, [opId, mode, taxSums.base_icms, taxSums.base_pis_cofins, taxSums.difal_value, manualItems.length, itemsSignature]);

  const handleFile = async (file) => {
    setError(""); setParsed(null); setParsing(true);
    try {
      const p = parseFiscalXml(await file.text());
      if (p.model === "57") throw new Error("Este é um XML de CT-e (frete) — importe-o na seção Frete.");
      setParsed(p);
    }
    catch (e) { setError(e.message || "Erro ao processar XML."); }
    setParsing(false);
  };

  // XML do frete (CT-e/NF-e/NFS-e): parseia e sugere o CFOP pela UF da transportadora
  // (mesma UF da empresa → inicia com 1; fora da UF → inicia com 2)
  const handleFreteFile = async (file) => {
    setFreteError(""); setFreteParsing(true);
    try {
      const p = parseFiscalXml(await file.text());
      setFreteXml(p);
      const uf = p.supplier?.uf || "";
      setFreteCfop(uf && companyUF && uf === companyUF ? "1351" : "2351");
    } catch (e) { setFreteError(e.message || "Erro ao processar XML do frete."); }
    setFreteParsing(false);
  };

  // Impostos do frete: valores do XML; quando zerados, calculados pela operação do frete
  const freteTaxes = (() => {
    if (!freteXml) return null;
    const t = freteXml.totals || {};
    const icms = Number(t.total_icms) || 0;
    const pis = Number(t.total_pis) || 0;
    const cofins = Number(t.total_cofins) || 0;
    if (icms > 0 || pis > 0 || cofins > 0) return { icms, pis, cofins, source: "xml" };
    const op = operations.find(o => o.id === freteOpId);
    if (!op) return null;
    const c = computeErpFiscalItem({ ncm: "", quantity: 1, unit_price: Number(t.total_nota) || 0 }, { rules: taxRules, operation: op, customerUF: freteXml.supplier?.uf });
    return c ? { icms: c.icms_value || 0, pis: c.pis_value || 0, cofins: c.cofins_value || 0, source: "calc" } : null;
  })();

  // CFOP do frete: prioriza os CFOPs cadastrados na operação do frete (dentro/fora/importação);
  // sem operação selecionada, sugere pela UF da transportadora (mesma UF → 1, fora → 2, EX → 3)
  useEffect(() => {
    if (!freteXml) return;
    const uf = freteXml.supplier?.uf || "";
    const op = operations.find(o => o.id === freteOpId);
    const dentro = uf && companyUF && uf === companyUF;
    const importacao = !uf || uf === "EX";
    const fromOp = op
      ? (importacao ? op.cfop_importacao : dentro ? op.cfop_dentro_estado : op.cfop_fora_estado) || (dentro ? op.cfop_fora_estado : op.cfop_dentro_estado) || ""
      : "";
    if (fromOp) { setFreteCfop(fromOp); return; }
    setFreteCfop(importacao ? "3351" : dentro ? "1351" : "2351");
  }, [freteOpId, freteXml, companyUF, operations]);

  // Cria/atualiza fornecedor a partir do documento; retorna o registro ErpPartner
  const ensureSupplier = async (name, docRaw, uf, address, city, extra) => {
    const doc = digits(docRaw);
    if (!doc) return null;
    const existing = suppliers.find(s => s.document === doc);
    if (existing) return existing;
    const created = await base44.entities.ErpPartner.create({
      user_email: user.email,
      partner_type: "fornecedor",
      document_type: doc.length <= 11 ? "cpf" : "cnpj",
      document: doc,
      name: name || "Fornecedor sem nome",
      uf: uf || undefined,
      address: address || undefined,
      city: city || undefined,
      ...(extra?.nome_fantasia ? { nome_fantasia: extra.nome_fantasia } : {}),
      ...(extra?.cep ? { cep: extra.cep } : {}),
      ...(extra?.district ? { district: extra.district } : {}),
      ...(extra?.phone ? { phone: extra.phone } : {}),
      ...(extra?.email ? { email: extra.email } : {}),
      is_active: true,
    });
    setSuppliers(p => [...p, created]);
    return created;
  };

  // Cria um novo produto a partir do item da NF
  const createProductFromItem = async (it) => {
    const code = it.product_code || `NF${Date.now().toString().slice(-6)}`;
    const barcode = it.barcode && /^\d+$/.test(it.barcode) ? it.barcode : undefined;
    const created = await base44.entities.ErpProduct.create({
      user_email: user.email,
      code, barcode,
      name: it.product_name || "Produto sem descrição",
      product_type: "mercadoria",
      ncm: it.ncm || undefined,
      unit: it.unit || "UN",
      cost_price: it.unit_price || 0,
      sale_price: 0,
      is_active: true,
      notes: "Cadastrado automaticamente na entrada de NF — ajuste categoria e contas.",
    });
    setProducts(p => [...p, created]);
    return created;
  };

  // Cria/atualiza o vínculo fornecedor↔produto (cProd)
  const ensureLink = async (supplier, product, item) => {
    const doc = digits(supplier.document);
    const existing = links.find(l => digits(l.supplier_document) === doc && l.product_id === product.id);
    if (existing) {
      const updated = await base44.entities.ErpProductSupplier.update(existing.id, {
        supplier_product_code: item.product_code || existing.supplier_product_code,
        supplier_product_name: item.product_name || existing.supplier_product_name,
        unit: item.unit || existing.unit,
        last_unit_cost: item.unit_price || existing.last_unit_cost,
        last_purchased_date: new Date().toISOString(),
      });
      setLinks(p => p.map(l => l.id === updated.id ? updated : l));
      return updated;
    }
    const created = await base44.entities.ErpProductSupplier.create({
      user_email: user.email,
      product_id: product.id,
      product_code: product.code,
      product_name: product.name,
      supplier_id: supplier.id,
      supplier_name: supplier.name,
      supplier_document: supplier.document,
      supplier_product_code: item.product_code || "",
      supplier_product_name: item.product_name || "",
      unit: item.unit || "UN",
      last_unit_cost: item.unit_price || 0,
      last_purchased_date: new Date().toISOString(),
    });
    setLinks(p => [...p, created]);
    return created;
  };

  const handleSave = async () => {
    setError("");
    const hasPo = !!poId;
    const po = selectedPo;
    const op = operations.find(o => o.id === opId);
    // A operação de entrada é obrigatória — base do cálculo dos impostos
    if (!op) { setError("Selecione a operação de entrada — ela define os impostos e o custo do produto."); return; }
    // Operação com ordem de compra obrigatória: não permite entrada sem OC
    if (op.exige_ordem_compra && !poId) { setError("Esta operação exige ordem de compra — selecione o pedido (os produtos e o rateio vêm da OC)."); return; }
    setSaving(true);
    try {
      // 1. Garante o fornecedor (pesquisado no cadastro ou informado por CNPJ no passo 2)
      let supplier = null;
      if (forn.name.trim() || digits(forn.cnpj)) {
        const rd = supplierLookup.data;
        const addr = mode === "xml" && parsed
          ? { address: parsed.supplier.address, city: parsed.supplier.city }
          : { address: rd?.address, city: rd?.city };
        supplier = await ensureSupplier(forn.name, forn.cnpj, forn.uf, addr.address, addr.city, mode === "xml" ? null : rd);
      }

      let payload;
      let newProductsCount = 0;

      if (mode === "xml") {
        if (!parsed) { setSaving(false); setError("Importe um XML."); return; }
        // 2. Resolve cada item → produto meu + vínculo
        const resolvedItems = [];
        for (let i = 0; i < parsed.items.length; i++) {
          const it = parsed.items[i];
          const choice = itemChoices[i] || "new";
          let product = null;
          if (choice === "new") {
            product = await createProductFromItem(it);
            newProductsCount++;
          } else {
            product = products.find(p => p.id === choice) || null;
          }
          if (supplier && product) {
            await ensureLink(supplier, product, it);
          }
          resolvedItems.push({
            ...it,
            product_id: product?.id || undefined,
            product_code: product?.code || it.product_code,
            base_icms: r2(it.base_icms), icms_value: r2(it.icms_value), difal_value: r2(it.difal_value),
            base_pis_cofins: r2(it.base_pis_cofins), pis_value: r2(it.pis_value), cofins_value: r2(it.cofins_value),
            ipi_value: r2(it.ipi_value),
          });
        }
        const valueDiff = parsed.totals.total_nota - (po?.total_value || 0);
        const valuesMatch = Math.abs(valueDiff) < 0.01;
        payload = {
          user_email: user.email,
          nota_model: parsed.nota.model,
          nota_number: parsed.nota.number,
          nota_series: parsed.nota.series,
          chave_acesso: parsed.nota.chave_acesso,
          issue_date: parsed.nota.issue_date ? new Date(parsed.nota.issue_date).toISOString() : new Date().toISOString(),
          entry_date: new Date().toISOString(),
          due_date: dueDate ? new Date(dueDate).toISOString() : undefined,
          supplier_name: forn.name || parsed.supplier.name,
          supplier_cnpj: forn.cnpj || parsed.supplier.cpf_cnpj,
          supplier_uf: forn.uf || parsed.supplier.uf,
          nature_operation: parsed.nota.nature_operation,
          cfop: parsed.nota.cfop,
          total_products: parsed.totals.total_products,
          total_nota: parsed.totals.total_nota,
          total_icms: r2(parsed.totals.total_icms),
          total_ipi: r2(parsed.totals.total_ipi),
          total_pis: r2(parsed.totals.total_pis),
          total_cofins: r2(parsed.totals.total_cofins),
          base_icms: r2((parsed.items || []).reduce((s, it) => s + (Number(it.icms_rate) > 0 ? (Number(it.icms_value) || 0) / (Number(it.icms_rate) / 100) : 0), 0)),
          despesas_value: parsed.totals.despesas || 0,
          descontos_value: parsed.totals.descontos || 0,
          items: resolvedItems,
          purchase_order_id: hasPo ? po.id : undefined,
          purchase_order_number: hasPo ? po.order_number : undefined,
          po_total_value: hasPo ? (po.total_value || 0) : 0,
          value_diff: hasPo ? valueDiff : 0,
          values_match: hasPo ? valuesMatch : true,
          operation_id: op?.id || undefined,
          operation_name: op?.name || undefined,
          apportionments: hasPo ? (po.apportionments || []) : manualApportionments,
          status: !hasPo || valuesMatch ? "aprovada" : "pendente",
          approval_status: !hasPo || valuesMatch ? "nao_aplica" : "aguardando_aprovacao",
        };
      } else {
        if (!manual.nota_number.trim()) { setSaving(false); setError("Informe o número do documento."); return; }
        if (!forn.name.trim()) { setSaving(false); setError("Informe o fornecedor (passo 2) — pesquise no cadastro ou informe o CNPJ."); return; }
        if (!manual.total_nota || Number(manual.total_nota) <= 0) { setSaving(false); setError("Informe o total do documento."); return; }
        if (!hasPo) {
          const validItems = manualItems.filter(it => it.product_name.trim() && (Number(it.quantity) || 0) > 0);
          if (validItems.length === 0) { setSaving(false); setError("Informe ao menos um item — busque um produto cadastrado ou digite a descrição do item."); return; }
        }
        const total = Number(manual.total_nota);
        // Itens sem produto cadastrado: pergunta se quer cadastrar agora (abre o
        // cadastro de produto); se não, mantém apenas a descrição no item
        const updatedItems = [...manualItems];
        for (let i = 0; i < updatedItems.length; i++) {
          const it = updatedItems[i];
          if (!it.product_name.trim() || (Number(it.quantity) || 0) <= 0 || it.product_id) continue;
          const cadastrar = window.confirm(`O produto "${it.product_name}" não está no cadastro.\n\nOK = cadastrar agora (abre o cadastro de produtos)\nCancelar = manter apenas a descrição no item`);
          if (!cadastrar) continue;
          const created = await askNewProduct({ name: it.product_name });
          if (created) {
            updatedItems[i] = { ...it, product_id: created.id, product_name: created.name || it.product_name };
            setProducts(p => p.some(x => x.id === created.id) ? p : [...p, created]);
          }
        }
        setManualItems(updatedItems);
        // Parcelas informadas: exige vencimento em todas e soma igual ao total do documento
        const hasInstValues = manualInstallments.some(it => String(it.amount).trim() !== "" && (Number(it.amount) || 0) > 0);
        if (hasInstValues) {
          if (manualInstallments.some(it => !it.due_date)) { setSaving(false); setError("Informe o vencimento de todas as parcelas."); return; }
          const sumInst = manualInstallments.reduce((s, it) => s + (Number(it.amount) || 0), 0);
          if (total > 0 && Math.abs(sumInst - total) > 0.01) { setSaving(false); setError(`A soma das parcelas (${fmtMoney(sumInst)}) deve ser igual ao total do documento (${fmtMoney(total)}).`); return; }
        }
        // Impostos por item: usados os campos mantidos pelo usuário (base/alíquota/
        // valores/CST); sem digitação, preenchidos pela regra fiscal da operação.
        // Gravados no item para gerar os créditos e o custo do produto sem os impostos.
        const taxOr = (v, fb) => (v !== undefined && v !== "" && Number(v) !== 0) ? r2(v) : r2(fb);
        const items = updatedItems.filter(it => it.product_name.trim() && it.quantity > 0).map(it => {
          const calc = calcManualItem(it);
          const qty = Number(it.quantity) || 0;
          const unit = Number(it.unit_price) || 0;
          return {
            product_name: it.product_name, product_id: it.product_id || undefined,
            product_code: it.product_id ? (products.find(p => p.id === it.product_id)?.code || "") : "",
            quantity: qty,
            unit_price: unit,
            total: qty * unit,
            ncm: "", cfop: calc?.cfop || "", unit: "UN",
            cst_icms: it.cst_icms || calc?.cst_icms || "",
            base_icms: taxOr(it.base_icms, calc?.icms_base),
            icms_rate: taxOr(it.icms_rate, calc?.icms_rate),
            aliq_reducao_icms: Number(it.aliq_reducao_icms) || 0,
            icms_value: taxOr(it.icms_value, calc?.icms_value),
            difal_value: taxOr(it.difal_value, calc?.difal?.difal_total),
            cst_pis: it.cst_pis || calc?.cst_pis || "",
            cst_cofins: it.cst_cofins || calc?.cst_cofins || "",
            base_pis_cofins: taxOr(it.base_pis_cofins, calc?.pis_base),
            aliq_pis_cofins: taxOr(it.aliq_pis_cofins, calc?.pis_rate),
            aliq_pis: taxOr(it.aliq_pis, calc?.pis_rate),
            aliq_cofins: taxOr(it.aliq_cofins, calc?.cofins_rate),
            pauta_pis_cofins: Number(it.pauta_pis_cofins) || 0,
            pauta_pis: Number(it.pauta_pis) || 0,
            pauta_cofins: Number(it.pauta_cofins) || 0,
            pis_value: taxOr(it.pis_value, calc?.pis_value),
            cofins_value: taxOr(it.cofins_value, calc?.cofins_value),
            cst_cbs: it.cst_cbs || calc?.cst_cbs || "",
            cbs_rate: taxOr(it.cbs_rate, calc?.cbs_rate),
            cbs_value: taxOr(it.cbs_value, calc?.cbs_value),
            cst_ibs: it.cst_ibs || calc?.cst_ibs || "",
            ibs_rate: taxOr(it.ibs_rate, calc?.ibs_rate),
            ibs_value: taxOr(it.ibs_value, calc?.ibs_value),
            ipi_value: calc?.ipi_value || 0,
          };
        });
        // Capa x itens: os valores dos impostos da capa devem fechar com a soma dos itens
        const taxSumOf = (k) => items.reduce((s, it) => s + (Number(it[k]) || 0), 0);
        const capaNum = {
          base_icms: Number(capa.base_icms) || 0,
          base_pis_cofins: Number(capa.base_pis_cofins) || 0,
          difal_value: Number(capa.difal_value) || 0,
        };
        for (const [k, label] of [["base_icms", "Base de cálculo do ICMS"], ["base_pis_cofins", "Base de PIS/COFINS"], ["difal_value", "DIFAL"]]) {
          if (capaNum[k] > 0 && Math.abs(capaNum[k] - taxSumOf(k)) > 0.01) {
            setSaving(false); setError(`${label} da capa (${fmtMoney(capaNum[k])}) não fecha com a soma dos itens (${fmtMoney(taxSumOf(k))}).`); return;
          }
        }
        const valueDiff = total - (po?.total_value || 0);
        const valuesMatch = Math.abs(valueDiff) < 0.01;
        payload = {
          user_email: user.email,
          nota_model: "NDF",
          nota_number: manual.nota_number,
          nota_series: "",
          chave_acesso: "",
          issue_date: manual.issue_date ? new Date(manual.issue_date).toISOString() : new Date().toISOString(),
          entry_date: new Date().toISOString(),
          due_date: manualInstallments[0]?.due_date ? new Date(`${manualInstallments[0].due_date}T12:00:00`).toISOString() : (dueDate ? new Date(dueDate).toISOString() : undefined),
          installments: hasInstValues ? manualInstallments.map(it => ({
            due_date: it.due_date ? new Date(`${it.due_date}T12:00:00`).toISOString() : undefined,
            amount: Number(it.amount) || 0,
          })) : undefined,
          supplier_name: forn.name,
          supplier_cnpj: forn.cnpj,
          supplier_uf: forn.uf,
          nature_operation: manual.nature_operation || "Documento Não Fiscal",
          cfop: manual.cfop || cfopAuto || undefined,
          total_products: items.reduce((a, it) => a + it.total, 0),
          total_nota: total,
          total_icms: items.reduce((s, it) => s + (it.icms_value || 0), 0),
          total_ipi: items.reduce((s, it) => s + (it.ipi_value || 0), 0),
          total_pis: items.reduce((s, it) => s + (it.pis_value || 0), 0),
          total_cofins: items.reduce((s, it) => s + (it.cofins_value || 0), 0),
          total_cbs: items.reduce((s, it) => s + (it.cbs_value || 0), 0),
          total_ibs: items.reduce((s, it) => s + (it.ibs_value || 0), 0),
          base_icms: capaNum.base_icms > 0 ? capaNum.base_icms : Math.round(taxSumOf("base_icms") * 100) / 100,
          aliq_icms: Number(capa.aliq_icms) || 0,
          aliq_reducao_icms: Number(capa.aliq_reducao_icms) || 0,
          base_pis_cofins: capaNum.base_pis_cofins > 0 ? capaNum.base_pis_cofins : Math.round(taxSumOf("base_pis_cofins") * 100) / 100,
          aliq_pis_cofins: Number(capa.aliq_pis_cofins) || 0,
          pauta_pis_cofins: Number(capa.pauta_pis_cofins) || 0,
          difal_value: capaNum.difal_value > 0 ? capaNum.difal_value : Math.round(taxSumOf("difal_value") * 100) / 100,
          dif_aliquota_value: Number(manual.dif_aliquota_value) || 0,
          despesas_value: Number(manual.despesas_value) || 0,
          descontos_value: Number(manual.descontos_value) || 0,
          ciap_curto_value: Number(manual.ciap_curto_value) || 0,
          ciap_longo_value: Number(manual.ciap_longo_value) || 0,
          icms_frete_value: Number(manual.icms_frete_value) || 0,
          pis_frete_value: Number(manual.pis_frete_value) || 0,
          cofins_frete_value: Number(manual.cofins_frete_value) || 0,
          items,
          purchase_order_id: hasPo ? po.id : undefined,
          purchase_order_number: hasPo ? po.order_number : undefined,
          po_total_value: hasPo ? (po.total_value || 0) : 0,
          value_diff: hasPo ? valueDiff : 0,
          values_match: hasPo ? valuesMatch : true,
          operation_id: op?.id || undefined,
          operation_name: op?.name || undefined,
          apportionments: hasPo ? (po.apportionments || []) : manualApportionments,
          status: !hasPo || valuesMatch ? "aprovada" : "pendente",
          approval_status: !hasPo || valuesMatch ? "nao_aplica" : "aguardando_aprovacao",
        };
      }

      // Entrada sem OC: itens com produto cadastrado trazem a própria conta contábil e
      // setor para o rateio do lançamento (rateio automático); itens não cadastrados
      // exigem o rateio informado manualmente (setor + conta contábil)
      if (!hasPo) {
        const entryItems = payload.items || [];
        const totalItems = entryItems.reduce((s, it) => s + (Number(it.total) || (Number(it.quantity) || 0) * (Number(it.unit_price) || 0)), 0);
        const manualFilled = (payload.apportionments || []).some(a => a.department_id && a.account_id);
        const autoAps = [];
        let missing = false;
        let pctSumAuto = 0;
        entryItems.forEach(it => {
          const prod = (it.product_id && products.find(p => p.id === it.product_id)) || null;
          const sector = prod?.stock_sector_id ? sectors.find(s => s.id === prod.stock_sector_id) : null;
          if (!prod?.account_estoque_id || !sector?.department_id) { missing = true; return; }
          const gross = Number(it.total) || (Number(it.quantity) || 0) * (Number(it.unit_price) || 0);
          const pct = totalItems > 0 ? Math.round((gross / totalItems) * 10000) / 100 : 0;
          pctSumAuto += pct;
          const acc = accounts.find(a => a.id === prod.account_estoque_id);
          autoAps.push({
            department_id: sector.department_id, department_name: sector.department_name,
            account_id: prod.account_estoque_id, account_code: acc?.code || "", account_name: prod.account_estoque_name || acc?.name || "",
            rateio_type: "percent", percent: pct, value: 0,
          });
        });
        if (!missing && autoAps.length > 0 && !manualFilled) {
          autoAps[autoAps.length - 1].percent = Math.round((autoAps[autoAps.length - 1].percent + (100 - pctSumAuto)) * 100) / 100;
          payload.apportionments = autoAps;
        } else {
          const aps = (payload.apportionments || []).filter(a => a.department_id && a.account_id);
          if (aps.length === 0) { setSaving(false); setError("Há item sem produto cadastrado (conta contábil + setor): informe o rateio do lançamento abaixo ou cadastre/vincule o produto."); return; }
          const pctSum = aps.reduce((s, a) => s + (Number(a.percent) || 0), 0);
          if (Math.abs(pctSum - 100) > 0.01) { setSaving(false); setError(`A soma do rateio (${pctSum.toFixed(2)}%) deve ser 100%.`); return; }
        }
      }

      // CFOP da operação: resolvido pela UF do fornecedor (mesma UF da empresa → dentro
      // do estado; fora → fora do estado; EX → importação). Operação fiscal exige CFOP.
      if (!payload.cfop && op) {
        const uf = forn.uf || parsed?.supplier?.uf || "";
        const cfopOp = (!uf || uf === "EX") ? (op.cfop_importacao || "") : cfopAuto;
        if (cfopOp) payload.cfop = cfopOp;
        else if (op.flag_fiscal) { setSaving(false); setError("Operação fiscal exige CFOP — cadastre o CFOP (dentro/fora do estado ou importação) no cadastro da operação."); return; }
      }

      // Frete importado: exige operação e CFOP; a transportadora é cadastrada como fornecedor
      if (freteXml) {
        if (!freteOpId) { setSaving(false); setError("Selecione a operação do frete — ela define os impostos e o custo."); return; }
        if (!String(freteCfop || "").trim()) { setSaving(false); setError("Informe o CFOP do frete."); return; }
        const fOp = operations.find(o => o.id === freteOpId);
        const ft = freteTaxes || { icms: 0, pis: 0, cofins: 0 };
        await ensureSupplier(freteXml.supplier.name, freteXml.supplier.cpf_cnpj, freteXml.supplier.uf, freteXml.supplier.address, freteXml.supplier.city);
        payload.freight = {
          doc_model: freteXml.nota.model,
          doc_number: freteXml.nota.number,
          doc_series: freteXml.nota.series,
          chave_acesso: freteXml.nota.chave_acesso,
          issue_date: freteXml.nota.issue_date ? new Date(freteXml.nota.issue_date).toISOString() : undefined,
          supplier_name: freteXml.supplier.name,
          supplier_cnpj: freteXml.supplier.cpf_cnpj,
          supplier_uf: freteXml.supplier.uf,
          value: Number(freteXml.totals.total_nota) || 0,
          icms_value: ft.icms || 0,
          pis_value: ft.pis || 0,
          cofins_value: ft.cofins || 0,
          operation_id: freteOpId,
          operation_name: fOp?.name || "",
          cfop: String(freteCfop).trim(),
        };
      }

      const entry = await base44.entities.ErpFiscalEntry.create(payload);
      // Lançamento automático (movimento contábil + estoque + financeiro) quando a
      // entrada já vem aprovada (sem OC ou valores conferem). Caso contrário segue
      // aguardando aprovação do admin no painel.
      if (payload.status === "aprovada") {
        try { await lancarEntradaNF(user, entry, accounts); }
        catch (e) { console.error("Falha ao gerar lançamento contábil automático:", e); alert(`Lançamento contábil não gerado: ${e.message}`); }
      }
      onSaved?.();
      onClose();
      if (newProductsCount > 0 && onGoToProducts) {
        alert(`${newProductsCount} produto(s) cadastrado(s) automaticamente a partir da NF. Abrindo o Cadastro de Produtos para ajustes.`);
        onGoToProducts();
      }
    } catch (e) { setError(e.message); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
          <h3 className="font-bold flex items-center gap-2"><Upload className="w-5 h-5 text-indigo-600" /> Entrada de Documento Fiscal</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 space-y-4">
          {/* 1º passo: operação de entrada — base do cálculo dos impostos */}
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 space-y-1.5">
            <label className="text-sm font-semibold text-indigo-900 flex items-center gap-2"><ArrowDownToLine className="w-4 h-4" /> 1. Operação de Entrada *</label>
            <select value={opId} onChange={e => handleOpChange(e.target.value)} className="w-full h-9 rounded-md border border-input bg-white px-3 text-sm">
              <option value="">Selecione a operação de entrada usada no cálculo dos impostos...</option>
              {operations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
            <p className="text-xs text-indigo-600">A operação define as regras fiscais (ICMS/IPI/PIS/COFINS) e o custo do produto — deduzidos os impostos a creditar. Selecione-a antes de importar o XML ou digitar o documento.</p>
          </div>

          {/* 2º passo: fornecedor — pesquisar no cadastro ou informar CNPJ (cadastra se não existir) */}
          {opId && (
            <div className="bg-white border rounded-lg p-3 space-y-2">
              <label className="text-sm font-semibold flex items-center gap-2"><UserPlus className="w-4 h-4 text-indigo-600" /> 2. Fornecedor *</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-medium text-gray-600">Pesquisar fornecedor cadastrado</label>
                  <select value={forn.id} onChange={e => pickForn(e.target.value)} className="w-full h-9 rounded-md border border-input bg-white px-3 text-sm">
                    <option value="">— Outro / informar CNPJ abaixo —</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}{s.document ? ` — ${maskCpfCnpj(String(s.document))}` : ""}{s.uf ? ` (${s.uf})` : ""}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">CNPJ/CPF</label>
                  <input value={forn.cnpj} onChange={e => handleFornCnpj(e.target.value)} className="w-full h-9 rounded-md border border-input px-3 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">UF</label>
                  <input value={forn.uf} onChange={e => setF({ uf: e.target.value.toUpperCase().slice(0, 2) })} className="w-full h-9 rounded-md border border-input px-3 text-sm" />
                </div>
                <div className="col-span-2 md:col-span-4">
                  <label className="text-xs font-medium text-gray-600">Fornecedor (Razão Social) *</label>
                  <input value={forn.name} onChange={e => setF({ name: e.target.value, id: "" })} className="w-full h-9 rounded-md border border-input px-3 text-sm" />
                </div>
              </div>
              {supplierLookup.msg && (
                <div className={`flex items-center gap-2 rounded-lg border p-2 text-xs ${supplierLookup.status === "exists" ? "bg-emerald-50 border-emerald-200 text-emerald-700" : supplierLookup.status === "new" ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-amber-50 border-amber-200 text-amber-700"}`}>
                  {supplierLookup.busy ? <Loader2 className="w-4 h-4 animate-spin" /> : supplierLookup.status === "exists" ? <CheckCircle2 className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                  {supplierLookup.msg}
                </div>
              )}
              {cfopAuto ? (
                <div className="rounded-lg border bg-emerald-50 border-emerald-200 p-2 text-xs text-emerald-800 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 mt-0.5" />
                  <span>Fornecedor {companyUF && forn.uf === companyUF ? `da mesma UF da empresa (${companyUF})` : `de outra UF (${forn.uf} ≠ ${companyUF || "não cadastrada"})`} — o CFOP <b>{cfopAuto}</b> ({companyUF && forn.uf === companyUF ? "dentro do estado" : "fora do estado"}) da operação será usado automaticamente.</span>
                </div>
              ) : selectedOp?.flag_fiscal && forn.uf ? (
                <div className="rounded-lg border bg-amber-50 border-amber-200 p-2 text-xs text-amber-700 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5" />
                  <span>Operação fiscal sem CFOP cadastrado para {companyUF && forn.uf === companyUF ? "dentro" : "fora"} do estado — cadastre o CFOP no cadastro da operação.</span>
                </div>
              ) : null}
            </div>
          )}

          {opId && (
          <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
            <button onClick={() => { setMode("xml"); setError(""); }} className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${mode === "xml" ? "bg-white text-indigo-700 shadow-sm" : "text-gray-500"}`}><FileText className="w-4 h-4" /> Importar XML</button>
            <button onClick={() => { setMode("manual"); setError(""); }} className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${mode === "manual" ? "bg-white text-indigo-700 shadow-sm" : "text-gray-500"}`}><Keyboard className="w-4 h-4" /> Digitação Manual</button>
          </div>
          )}

          {error && <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3"><AlertTriangle className="w-4 h-4" /> {error}</div>}

          {/* === MODO XML === */}
          {opId && mode === "xml" && !parsed && (
            <div onClick={() => fileRef.current?.click()} className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/50 transition-colors">
              {parsing ? (
                <div className="flex flex-col items-center gap-2"><Loader2 className="w-10 h-10 animate-spin text-indigo-600" /><p className="text-sm text-gray-500">Processando XML...</p></div>
              ) : (
                <div className="flex flex-col items-center gap-2"><FileText className="w-10 h-10 text-gray-400" /><p className="text-sm font-medium">Clique para selecionar o XML da NF-e ou NFS-e</p><p className="text-xs text-gray-400">Formatos: .xml (NF-e modelo 55, NFC-e 65 ou NFS-e ABRASF)</p></div>
              )}
              <input ref={fileRef} type="file" accept=".xml" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            </div>
          )}

          {opId && mode === "xml" && parsed && (
            <div className="space-y-4">
              {/* Status do fornecedor */}
              <div className={`rounded-lg p-2.5 border flex items-center gap-2 text-xs ${supplierStatus === "exists" ? "bg-emerald-50 border-emerald-200 text-emerald-700" : supplierStatus === "will_create" ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-gray-50 border-gray-200 text-gray-500"}`}>
                {supplierStatus === "exists" ? <CheckCircle2 className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                {supplierStatus === "exists" ? `Fornecedor já cadastrado: ${parsed.supplier.name}` : supplierStatus === "will_create" ? `Fornecedor não cadastrado — será criado automaticamente: ${parsed.supplier.name} (CNPJ ${parsed.supplier.cpf_cnpj})` : "Analisando fornecedor..."}
              </div>

              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" /><h4 className="text-sm font-semibold">Dados da Nota ({parsed.nota.model === "NFSe" ? "NFS-e" : `NF-e mod ${parsed.nota.model}`})</h4></div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                  <div><span className="text-gray-500">Número:</span> <b>{parsed.nota.number}</b></div>
                  <div><span className="text-gray-500">Série:</span> {parsed.nota.series || "—"}</div>
                  <div><span className="text-gray-500">Emissão:</span> {fmtDate(parsed.nota.issue_date)}</div>
                  <div><span className="text-gray-500">Total NF:</span> <b className="text-indigo-700">{fmtMoney(parsed.totals.total_nota)}</b></div>
                  <div className="col-span-2"><span className="text-gray-500">Emitente:</span> {parsed.supplier.name}</div>
                  <div><span className="text-gray-500">CNPJ:</span> {parsed.supplier.cpf_cnpj}</div>
                  <div><span className="text-gray-500">UF:</span> {parsed.supplier.uf}</div>
                </div>
              </div>

              {/* Itens com vínculo de produto destino */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-3 py-2 border-b flex items-center gap-2"><Link2 className="w-4 h-4 text-indigo-600" /><h4 className="text-sm font-semibold">Itens ({parsed.items.length}) — Vínculo de Produto</h4></div>
                <div className="overflow-x-auto max-h-64">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 border-b sticky top-0"><tr><th className="p-2 text-left">Produto do Fornecedor (cProd)</th><th className="p-2 text-left w-56">Produto Meu (destino)</th><th className="p-2 text-right">Qtd</th><th className="p-2 text-right">Total</th></tr></thead>
                    <tbody>
                      {parsed.items.map((it, i) => {
                        const choice = itemChoices[i] || "new";
                        const matched = choice !== "new" && choice !== "";
                        return (
                          <tr key={i} className="border-b">
                            <td className="p-2">
                              <div className="font-mono text-[11px] text-gray-500">{it.product_code}</div>
                              <div className="text-gray-800">{it.product_name}</div>
                              <div className="text-[10px] text-gray-400">NCM {it.ncm} • CFOP {it.cfop}</div>
                            </td>
                            <td className="p-2">
                              <select value={choice} onChange={e => setItemChoices(p => p.map((c, idx) => idx === i ? e.target.value : c))} className={`w-full h-9 rounded-md border px-2 text-xs ${matched ? "border-emerald-300 bg-emerald-50" : "border-input"}`}>
                                <option value="new">+ Criar novo produto</option>
                                {products.map(p => <option key={p.id} value={p.id}>{p.code ? `${p.code} — ` : ""}{p.name}</option>)}
                              </select>
                              {matched && <span className="text-[10px] text-emerald-600 flex items-center gap-1 mt-0.5"><Link2 className="w-3 h-3" /> vinculado</span>}
                            </td>
                            <td className="p-2 text-right">{it.quantity}</td>
                            <td className="p-2 text-right font-medium">{it.total.toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="bg-gray-50 px-3 py-2 border-t text-[11px] text-gray-500 flex items-center gap-1.5"><Package className="w-3.5 h-3.5" /> Itens sem vínculo criarão um novo produto automaticamente vinculado ao código do fornecedor. Na próxima NF deste fornecedor, o sistema reconhecerá o produto pelo cProd.</div>
              </div>
            </div>
          )}

          {/* === MODO MANUAL === */}
          {opId && mode === "manual" && (
            <div className="space-y-3">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-xs text-blue-700">Use este modo para documentos não fiscais (recibo, cupom, fatura manual, etc.). O fornecedor é informado na etapa 2 — se o CNPJ não estiver cadastrado, os dados são buscados na Receita Federal e ele é cadastrado automaticamente ao dar entrada.</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div><label className="text-xs font-medium text-gray-600">Número do Doc. *</label><input value={manual.nota_number} onChange={e => setM("nota_number", e.target.value)} className="w-full h-9 rounded-md border border-input px-3 text-sm" /></div>
                <div><label className="text-xs font-medium text-gray-600">Data de Emissão</label><input type="date" value={manual.issue_date} onChange={e => setM("issue_date", e.target.value)} className="w-full h-9 rounded-md border border-input px-3 text-sm" /></div>
                <div><label className="text-xs font-medium text-gray-600">Total (R$) *</label><input type="number" step="0.01" value={manual.total_nota} onChange={e => setM("total_nota", e.target.value)} className="w-full h-9 rounded-md border border-input px-3 text-sm" /></div>
                <div>
                  <label className="text-xs font-medium text-gray-600">CFOP {cfopAuto && <span className="text-emerald-600 font-normal">(automático — {companyUF && forn.uf === companyUF ? "mesma UF" : "UF diferente"})</span>}</label>
                  <input value={manual.cfop || cfopAuto} onChange={e => setM("cfop", e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder={cfopAuto ? "" : "Definido pela UF do fornecedor"} className={`w-full h-9 rounded-md border px-3 text-sm ${cfopAuto ? "border-emerald-300 bg-emerald-50" : "border-input"}`} />
                  {cfopAuto && <p className="text-[10px] text-emerald-600 mt-0.5">CFOP {companyUF && forn.uf === companyUF ? "dentro" : "fora"} do estado — conforme a UF do fornecedor ({forn.uf})</p>}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Outros valores (opcional) — contabilizados nas contas da parametrização da operação</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-1">
                  <div><input type="number" step="0.01" value={manual.dif_aliquota_value} onChange={e => setM("dif_aliquota_value", e.target.value)} placeholder="Dif. Alíquota" className="w-full h-9 rounded-md border border-input px-3 text-sm" /><p className="text-[10px] text-gray-400 mt-0.5">Dif. Alíquota</p></div>
                  <div><input type="number" step="0.01" value={manual.despesas_value} onChange={e => setM("despesas_value", e.target.value)} placeholder="Despesas" className="w-full h-9 rounded-md border border-input px-3 text-sm" /><p className="text-[10px] text-gray-400 mt-0.5">Despesas Acessórias</p></div>
                  <div><input type="number" step="0.01" value={manual.descontos_value} onChange={e => setM("descontos_value", e.target.value)} placeholder="Descontos" className="w-full h-9 rounded-md border border-input px-3 text-sm" /><p className="text-[10px] text-gray-400 mt-0.5">Descontos</p></div>
                  <div><input type="number" step="0.01" value={manual.ciap_curto_value} onChange={e => setM("ciap_curto_value", e.target.value)} placeholder="CIAP curto" className="w-full h-9 rounded-md border border-input px-3 text-sm" /><p className="text-[10px] text-gray-400 mt-0.5">CIAP Curto Prazo</p></div>
                  <div><input type="number" step="0.01" value={manual.ciap_longo_value} onChange={e => setM("ciap_longo_value", e.target.value)} placeholder="CIAP longo" className="w-full h-9 rounded-md border border-input px-3 text-sm" /><p className="text-[10px] text-gray-400 mt-0.5">CIAP Longo Prazo</p></div>
                  <div><input type="number" step="0.01" value={manual.icms_frete_value} onChange={e => setM("icms_frete_value", e.target.value)} placeholder="ICMS frete" className="w-full h-9 rounded-md border border-input px-3 text-sm" /><p className="text-[10px] text-gray-400 mt-0.5">ICMS Frete</p></div>
                  <div><input type="number" step="0.01" value={manual.pis_frete_value} onChange={e => setM("pis_frete_value", e.target.value)} placeholder="PIS frete" className="w-full h-9 rounded-md border border-input px-3 text-sm" /><p className="text-[10px] text-gray-400 mt-0.5">PIS s/ Frete</p></div>
                  <div><input type="number" step="0.01" value={manual.cofins_frete_value} onChange={e => setM("cofins_frete_value", e.target.value)} placeholder="COFINS frete" className="w-full h-9 rounded-md border border-input px-3 text-sm" /><p className="text-[10px] text-gray-400 mt-0.5">COFINS s/ Frete</p></div>
                </div>
              </div>
              {/* Capa dos impostos — acima dos itens */}
              <ErpFiscalCapaTaxes capa={capa} onChange={(k, v) => setCapa(p => ({ ...p, [k]: v }))} sums={taxSums} />
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-3 py-2 border-b flex items-center justify-between">
                  <h4 className="text-sm font-semibold">Itens</h4>
                  <Button type="button" variant="outline" size="sm" onClick={() => setManualItems(p => [...p, { product_name: "", quantity: 1, unit_price: 0 }])} className="gap-1"><Plus className="w-3.5 h-3.5" /> Item</Button>
                </div>
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b"><tr><th className="p-2 text-left">Descrição</th><th className="p-2 text-right w-20">Qtd</th><th className="p-2 text-right w-28">V. Unit.</th><th className="p-2 text-right w-24">Total</th><th className="p-2 w-10"></th></tr></thead>
                  <tbody>
                    {manualItems.map((it, i) => (
                      <tr key={i} className="border-b">
                        <td className="p-2">
                          <input list="manual-products-list" value={it.product_name} onChange={e => onManualItemName(i, e.target.value)} placeholder="Descrição — busque produto cadastrado" className="w-full h-8 rounded border border-input px-2 text-xs" />
                          {it.product_id && <span className="text-[10px] text-emerald-600 flex items-center gap-1 mt-0.5"><Link2 className="w-3 h-3" /> produto cadastrado</span>}
                        </td>
                        <td className="p-2"><input type="number" step="0.01" value={it.quantity} onChange={e => setManualItems(p => p.map((x, idx) => idx === i ? { ...x, quantity: Number(e.target.value) || 0 } : x))} className="w-16 h-8 rounded border border-input px-2 text-right text-xs" /></td>
                        <td className="p-2"><input type="number" step="0.01" value={it.unit_price} onChange={e => setManualItems(p => p.map((x, idx) => idx === i ? { ...x, unit_price: Number(e.target.value) || 0 } : x))} className="w-24 h-8 rounded border border-input px-2 text-right text-xs" /></td>
                        <td className="p-2 text-right font-medium">{fmtMoney((it.quantity || 0) * (it.unit_price || 0))}</td>
                        <td className="p-2 text-center">{manualItems.length > 1 && <button type="button" onClick={() => setManualItems(p => p.filter((_, idx) => idx !== i))} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5 text-red-500" /></button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <datalist id="manual-products-list">
                  {products.map(p => <option key={p.id} value={p.name}>{p.code ? `${p.code} — ` : ""}{p.name}</option>)}
                </datalist>
              </div>
              <ErpFiscalItemTaxes items={manualItems} onChange={(i, patch) => setManualItems(p => p.map((x, idx) => idx === i ? { ...x, ...patch } : x))} />
            </div>
          )}

          {/* === FRETE (opcional) === */}
          {opId && (mode === "xml" ? parsed : mode === "manual") && (
            <div className="rounded-lg border border-sky-200 bg-sky-50/50 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold flex items-center gap-2"><Truck className="w-4 h-4 text-sky-600" /> Frete (opcional) — compõe o custo dos produtos</h4>
                {freteXml && <button type="button" onClick={() => { setFreteXml(null); setFreteCfop(""); setFreteError(""); }} className="text-xs text-red-600 hover:underline">Remover</button>}
              </div>
              {!freteXml ? (
                <div>
                  <div onClick={() => freteFileRef.current?.click()} className="border-2 border-dashed border-sky-300 rounded-lg p-4 text-center cursor-pointer hover:bg-sky-50">
                    {freteParsing ? (
                      <div className="flex items-center justify-center gap-2 text-sm text-gray-500"><Loader2 className="w-4 h-4 animate-spin" /> Processando XML do frete...</div>
                    ) : (
                      <p className="text-sm text-sky-800">Clique para importar o XML do Frete (CT-e, NF-e ou NFS-e)</p>
                    )}
                    <input ref={freteFileRef} type="file" accept=".xml" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFreteFile(f); }} />
                  </div>
                  {freteError && <p className="text-xs text-red-600 mt-1">{freteError}</p>}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm bg-white rounded-md border p-2">
                    <div><span className="text-gray-500 text-xs">Documento:</span> <b>{freteXml.nota.model === "57" ? "CT-e" : freteXml.nota.model === "NFSe" ? "NFS-e" : "NF-e"} {freteXml.nota.number || "—"}</b></div>
                    <div className="col-span-2"><span className="text-gray-500 text-xs">Transportadora:</span> {freteXml.supplier.name}</div>
                    <div><span className="text-gray-500 text-xs">UF:</span> {freteXml.supplier.uf || "—"}</div>
                    <div><span className="text-gray-500 text-xs">Total:</span> <b className="text-sky-700">{fmtMoney(freteXml.totals.total_nota)}</b></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-medium text-gray-600">Operação do Frete *</label>
                      <select value={freteOpId} onChange={e => setFreteOpId(e.target.value)} className="w-full h-9 rounded-md border border-input bg-white px-3 text-sm mt-1">
                        <option value="">Selecione a operação...</option>
                        {operations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600">CFOP do Frete *</label>
                      <input value={freteCfop} onChange={e => setFreteCfop(e.target.value)} className="w-full h-9 rounded-md border border-input px-3 text-sm mt-1" />
                      <p className="text-[10px] text-gray-400 mt-0.5">Mesma UF da empresa ({companyUF || "não cadastrada"}) → inicia com 1 (ex: 1351); fora da UF → inicia com 2 (ex: 2351).</p>
                    </div>
                  </div>
                  {freteTaxes && (
                    <div className="rounded-md border bg-emerald-50 border-emerald-200 p-2 text-xs text-emerald-800 flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 mt-0.5" />
                      <span>
                        Impostos do frete ({freteTaxes.source === "xml" ? "do XML" : "calculados pela operação"}): ICMS <b>{fmtMoney(freteTaxes.icms)}</b> • PIS <b>{fmtMoney(freteTaxes.pis)}</b> • COFINS <b>{fmtMoney(freteTaxes.cofins)}</b> — o valor líquido será rateado no custo dos produtos e gera contas a pagar para a transportadora.
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* === OC e Conferência (comum) === */}
          {opId && (mode === "xml" ? parsed : mode === "manual") && (
            <div className="space-y-3">
              {mode === "xml" ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600">Vencimento (financeiro)</label>
                    <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full h-9 rounded-md border border-input px-3 text-sm" />
                  </div>
                </div>
              ) : (
                <ErpManualInstallments value={manualInstallments} onChange={setManualInstallments} onAdd={addParcela} total={Number(manual.total_nota) || 0} />
              )}
              <div className="rounded-lg border border-indigo-200 bg-indigo-50/60 p-2 text-xs text-indigo-800">
                <b>Operação selecionada:</b> {operations.find(o => o.id === opId)?.name || "—"} — os impostos e o custo dos produtos são calculados pelas regras fiscais desta operação.
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Ordem de Compra {selectedOp?.exige_ordem_compra ? "*" : "(opcional)"}</label>
                <select value={poId} onChange={e => setPoId(e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm">
                  <option value="">Sem ordem de compra (despesa/serviço)</option>
                  {orders.map(o => <option key={o.id} value={o.id}>{o.order_number} — {o.supplier_name || "—"} ({fmtMoney(o.total_value)})</option>)}
                </select>
                {!poId && (selectedOp?.exige_ordem_compra
                  ? <p className="text-[11px] text-red-600 mt-1">Obrigatória nesta operação — selecione o pedido: os produtos e o rateio (contas + setor) vêm da ordem de compra.</p>
                  : <p className="text-[11px] text-amber-600 mt-1">Entrada avulsa: informe ao menos um item — produtos cadastrados trazem a conta contábil e o setor automaticamente; itens não cadastrados exigem o rateio abaixo.</p>)}
              </div>

              {selectedPo && (
                <div className={`rounded-lg p-3 border ${match ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
                  <div className="flex items-center gap-2 mb-1">
                    {match ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-amber-600" />}
                    <h4 className="text-sm font-semibold">Conferência Documento x OC</h4>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div><p className="text-xs text-gray-500">Total da OC</p><p className="font-medium">{fmtMoney(selectedPo.total_value)}</p></div>
                    <div><p className="text-xs text-gray-500">Total do Doc.</p><p className="font-medium">{fmtMoney(nfTotal)}</p></div>
                    <div><p className="text-xs text-gray-500">Diferença</p><p className={`font-medium ${match ? "text-emerald-700" : "text-amber-700"}`}>{fmtMoney(diff)}</p></div>
                  </div>
                  <p className={`text-xs mt-2 ${match ? "text-emerald-700" : "text-amber-700"}`}>
                    {match ? "Valores conferem — a entrada será aprovada automaticamente e poderá ser lançada." : "Valores divergem — a entrada ficará aguardando aprovação do administrador."}
                  </p>
                </div>
              )}

              {!poId && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                    <AlertTriangle className="w-4 h-4" />
                    Entrada sem ordem de compra — informe ao menos um item. Itens com produto cadastrado trazem a conta contábil e o setor automaticamente para o lançamento; itens não cadastrados exigem o rateio abaixo.
                  </div>
                  <ErpApportionmentEditor
                    apportionments={manualApportionments}
                    onChange={setManualApportionments}
                    setores={departments}
                    accounts={accounts}
                    accent="amber"
                    title="Rateio do Lançamento (Setor / Conta Contábil)"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 p-4 border-t sticky bottom-0 bg-white">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          {opId && (mode === "xml" ? parsed : true) && (
            <Button onClick={handleSave} disabled={saving || (selectedOp?.exige_ordem_compra && !poId)} className="bg-indigo-600 hover:bg-indigo-700 gap-1.5">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowDownToLine className="w-4 h-4" />} Dar Entrada
            </Button>
          )}
        </div>
      </div>

      {productModal && (
        <ErpProductFormModal
          user={user}
          product={productModal.draft}
          onSaved={(saved) => productModal.resolve(saved || null)}
          onClose={() => { productModal.resolve(null); setProductModal(null); }}
        />
      )}
    </div>
  );
}
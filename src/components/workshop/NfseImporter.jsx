import { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import {
  X, Upload, Loader2, FileText, CheckCircle2, AlertTriangle, Wrench, FileUp
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { maskCpfCnpj, maskPhone, maskCep } from "@/lib/brMasks";

const formatCurrency = (v) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Parse NFS-e XML (padrão ABRASF)
// Tenta múltiplas variações de tags pois cada prefeitura pode ter pequenas diferenças
function parseNfseXml(xmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "text/xml");
  const parseError = doc.querySelector("parsererror");
  if (parseError) throw new Error("XML inválido ou mal formatado.");

  const getText = (parent, tag, nsPrefix) => {
    if (!parent) return "";
    // tenta com e sem namespace
    let el = parent.getElementsByTagName(tag)[0]
      || parent.getElementsByTagName(`*:${tag}`)[0];
    if (!el && nsPrefix) {
      el = parent.getElementsByTagName(`${nsPrefix}:${tag}`)[0];
    }
    return el?.textContent?.trim() || "";
  };

  const getChild = (parent, tag) => {
    if (!parent) return null;
    return parent.getElementsByTagName(tag)[0]
      || parent.getElementsByTagName(`*:${tag}`)[0]
      || null;
  };

  // Localizar o nó InfNfse (pode estar em Nfse/InfNfse ou CompNfse/Nfse/InfNfse)
  let infNfse = getChild(doc.documentElement, "InfNfse");
  if (!infNfse) {
    // Tenta buscar por Nfse dentro de CompNfse (lote de RPS)
    const nfseNode = getChild(doc.documentElement, "Nfse");
    if (nfseNode) infNfse = getChild(nfseNode, "InfNfse");
  }
  if (!infNfse) throw new Error("Registro InfNfse não encontrado. Verifique se é um XML de NFS-e (Nota Fiscal de Serviço Eletrônica).");

  // Prestador do serviço = fornecedor (quem emitiu a NFS-e)
  const prestador = getChild(infNfse, "PrestadorServico") || getChild(infNfse, "Prestador");
  // Tomador do serviço = cliente da oficina (nós)
  const tomador = getChild(infNfse, "TomadorServico") || getChild(infNfse, "Tomador");
  // Serviço
  const servico = getChild(infNfse, "Servico");

  // Identificação do Prestador
  const idPrestador = getChild(prestador, "IdentificacaoPrestador") || prestador;
  const prestadorCnpj = getText(idPrestador, "Cnpj");
  const prestadorIM = getText(idPrestador, "InscricaoMunicipal");
  const prestadorNome = getText(prestador, "RazaoSocial");
  const prestadorEnd = getChild(prestador, "Endereco");

  // Identificação do Tomador
  const idTomador = getChild(tomador, "IdentificacaoTomador") || tomador;
  const tomadorCpfCnpjNode = getChild(idTomador, "CpfCnpj");
  const tomadorCpfCnpj = tomadorCpfCnpjNode
    ? (getText(tomadorCpfCnpjNode, "Cnpj") || getText(tomadorCpfCnpjNode, "Cpf"))
    : "";
  const tomadorNome = getText(tomador, "RazaoSocial");
  const tomadorEnd = getChild(tomador, "Endereco");

  // Valores do Serviço
  const valores = getChild(servico, "Valores");

  // Natureza da operação (código)
  const natOp = getText(infNfse, "NaturezaOperacao");

  // Código do município do prestador (para buscar nome da cidade)
  const codMunPrest = getText(getChild(servico, "MunicipioPrestacaoServico"), "CodigoMunicipio");

  const supplier = {
    name: prestadorNome,
    cpf_cnpj: prestadorCnpj,
    ie: getText(prestador, "InscricaoEstadual") || prestadorIM,
    im: prestadorIM,
    address: getText(prestadorEnd, "Endereco") || getText(prestadorEnd, "Logradouro"),
    number: getText(prestadorEnd, "Numero"),
    district: getText(prestadorEnd, "Bairro"),
    city: getText(prestadorEnd, "Municipio") || getText(prestadorEnd, "xMunicipio"),
    uf: getText(prestadorEnd, "Uf") || getText(prestadorEnd, "UF"),
    cep: getText(prestadorEnd, "Cep"),
    phone: getText(getChild(prestador, "Contato"), "Telefone"),
    email: getText(getChild(prestador, "Contato"), "Email"),
  };

  const nota = {
    number: getText(infNfse, "Numero"),
    verification_code: getText(infNfse, "CodigoVerificacao"),
    issue_date: getText(infNfse, "DataEmissao"),
    nature_operation: natOp,
    item_lista_servico: getText(servico, "ItemListaServico"),
    codigo_cnae: getText(servico, "CodigoCnae"),
    discriminacao: getText(servico, "Discriminacao"),
  };

  const totals = {
    valor_servicos: parseFloat(getText(valores, "ValorServicos").replace(",", ".")) || 0,
    valor_deducoes: parseFloat(getText(valores, "ValorDeducoes").replace(",", ".")) || 0,
    valor_iss: parseFloat(getText(valores, "ValorIss").replace(",", ".")) || 0,
    aliquota: parseFloat(getText(valores, "Aliquota").replace(",", ".")) || 0,
    base_calculo: parseFloat(getText(valores, "BaseCalculo").replace(",", ".")) || 0,
    valor_liquido: parseFloat(getText(valores, "ValorLiquidoNfse").replace(",", ".")) || 0,
    iss_retido: parseFloat(getText(valores, "IssRetido").replace(",", ".")) || 0,
  };

  // Tomador info (cache para exibição)
  const tomadorInfo = {
    name: tomadorNome,
    cpf_cnpj: tomadorCpfCnpj,
    city: getText(tomadorEnd, "Municipio") || getText(tomadorEnd, "xMunicipio"),
    uf: getText(tomadorEnd, "Uf") || getText(tomadorEnd, "UF"),
  };

  return { supplier, nota, totals, tomadorInfo };
}

// Mapa de códigos de natureza da operação (NFS-e ABRASF)
const NATUREZA_OPERACAO_LABELS = {
  "1": "Tributação no município",
  "2": "Tributação fora do município",
  "3": "Isenção",
  "4": "Imune",
  "5": "Exigibilidade suspensa por decisão judicial",
  "6": "Exigibilidade suspensa por procedimento administrativo",
};

export default function NfseImporter({ userEmail, suppliers, onClose, onSaved }) {
  const { toast } = useToast();
  const [parsing, setParsing] = useState(false);
  const [parsedData, setParsedData] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  const handleFile = async (file) => {
    setError("");
    setParsedData(null);
    setParsing(true);
    try {
      const text = await file.text();
      const data = parseNfseXml(text);
      setParsedData(data);
    } catch (e) {
      setError(e.message || "Erro ao processar XML da NFS-e.");
    }
    setParsing(false);
  };

  const handleConfirm = async () => {
    if (!parsedData) return;
    setSaving(true);
    setError("");
    try {
      const d = parsedData;
      let supplierId = null;
      let supplierName = d.supplier.name;
      let supplierCnpj = d.supplier.cpf_cnpj;
      let supplierUf = d.supplier.uf;
      let supplierCity = d.supplier.city;

      // Buscar ou cadastrar fornecedor pelo CNPJ
      if (d.supplier.cpf_cnpj) {
        const existing = suppliers.filter(s => s.cpf_cnpj === d.supplier.cpf_cnpj);
        if (existing.length > 0) {
          supplierId = existing[0].id;
          supplierName = existing[0].name;
          toast({ title: "Fornecedor encontrado", description: `${supplierName} já cadastrado.` });
        } else {
          // Cadastrar fornecedor automaticamente a partir do XML
          const newSupplier = await base44.entities.DiagnosticSupplier.create({
            user_email: userEmail,
            name: d.supplier.name,
            cpf_cnpj: d.supplier.cpf_cnpj,
            ie: d.supplier.ie || "",
            phone: d.supplier.phone || "",
            whatsapp: d.supplier.phone || "",
            email: d.supplier.email || "",
            cep: d.supplier.cep || "",
            address: d.supplier.address || "",
            number: d.supplier.number || "",
            district: d.supplier.district || "",
            city: d.supplier.city || "",
            uf: d.supplier.uf || "",
            category: "Serviços",
            is_active: true,
          });
          supplierId = newSupplier.id;
          toast({ title: "Fornecedor cadastrado", description: `${supplierName} adicionado automaticamente do XML da NFS-e.` });
        }
      }

      // Upload do arquivo XML (opcional)
      const file = fileRef.current?.files?.[0];
      let xmlUrl = "";
      if (file) {
        try {
          const { file_url } = await base44.integrations.Core.UploadFile({ file });
          xmlUrl = file_url;
        } catch { /* non-critical */ }
      }

      // Criar a entrada (tipo servico, origem xml)
      await base44.entities.DiagnosticEntryOperation.create({
        user_email: userEmail,
        entry_type: "servico",
        origin: "xml",
        supplier_id: supplierId,
        supplier_name: supplierName,
        supplier_cnpj: supplierCnpj,
        supplier_uf: supplierUf,
        supplier_city: supplierCity,
        nota_number: d.nota.number,
        nota_series: "",
        nota_model: "NFSe",
        issue_date: d.nota.issue_date ? new Date(d.nota.issue_date).toISOString() : new Date().toISOString(),
        entry_date: new Date().toISOString(),
        cfop: "",
        nature_operation: NATUREZA_OPERACAO_LABELS[d.nota.nature_operation] || d.nota.nature_operation || "",
        service_description: d.nota.discriminacao || `NFS-e ${d.nota.number} — Item Lista ${d.nota.item_lista_servico || "—"}`,
        items: [],
        total_products: d.totals.valor_servicos,
        total_icms: 0,
        total_ipi: 0,
        total_nota: d.totals.valor_liquido || d.totals.valor_servicos,
        xml_file_url: xmlUrl,
        payment_status: "aberto",
        status: "registrada",
        notes: d.totals.iss_retido > 0
          ? `ISS retido: ${formatCurrency(d.totals.iss_retido)} | Alíquota: ${d.totals.aliquota}%`
          : `ISS: ${formatCurrency(d.totals.valor_iss)} | Alíquota: ${d.totals.aliquota}%`,
      });

      toast({ title: "NFS-e importada", description: `${d.nota.number} — ${supplierName} — ${formatCurrency(d.totals.valor_liquido || d.totals.valor_servicos)}` });
      onSaved?.();
      onClose();
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
            <FileUp className="w-5 h-5 text-purple-600" /> Importar NFS-e (Nota Fiscal de Serviço)
          </h3>
          <button type="button" onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 space-y-4">
          {/* Info banner */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-purple-700">
              Ao importar o XML da NFS-e (padrão ABRASF), o sistema <b>cadastra automaticamente o fornecedor</b> (prestador do serviço)
              se ainda não estiver registrado, e cria uma entrada do tipo <b>Serviço</b> com os valores de ISS, alíquota e discriminação.
            </p>
          </div>

          {/* Upload area */}
          {!parsedData && (
            <div className="space-y-3">
              <div
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-purple-400 hover:bg-purple-50/50 transition-colors"
              >
                {parsing ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="w-10 h-10 animate-spin text-purple-600" />
                    <p className="text-sm text-gray-500">Processando XML da NFS-e...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="w-10 h-10 text-gray-400" />
                    <p className="text-sm font-medium">Clique para selecionar o arquivo XML da NFS-e</p>
                    <p className="text-xs text-gray-400">Formato: .xml (Nota Fiscal de Serviço Eletrônica — padrão ABRASF)</p>
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

              {/* Prestador (Fornecedor) */}
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <h4 className="text-sm font-semibold">Prestador do Serviço (Fornecedor)</h4>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                  <div className="col-span-2"><span className="text-gray-500">Razão Social:</span> <b>{parsedData.supplier.name}</b></div>
                  <div><span className="text-gray-500">CNPJ:</span> {maskCpfCnpj(parsedData.supplier.cpf_cnpj)}</div>
                  <div><span className="text-gray-500">IE/IM:</span> {parsedData.supplier.ie || parsedData.supplier.im || "—"}</div>
                  <div><span className="text-gray-500">Cidade:</span> {parsedData.supplier.city}</div>
                  <div><span className="text-gray-500">UF:</span> {parsedData.supplier.uf}</div>
                  <div><span className="text-gray-500">Telefone:</span> {maskPhone(parsedData.supplier.phone)}</div>
                </div>
              </div>

              {/* Nota info */}
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Wrench className="w-4 h-4 text-purple-600" />
                  <h4 className="text-sm font-semibold">Dados da NFS-e</h4>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                  <div><span className="text-gray-500">Número:</span> <b>{parsedData.nota.number}</b></div>
                  <div><span className="text-gray-500">Emissão:</span> {parsedData.nota.issue_date ? new Date(parsedData.nota.issue_date).toLocaleDateString("pt-BR") : "—"}</div>
                  <div><span className="text-gray-500">Natureza:</span> {NATUREZA_OPERACAO_LABELS[parsedData.nota.nature_operation] || parsedData.nota.nature_operation || "—"}</div>
                  <div><span className="text-gray-500">Item Lista:</span> {parsedData.nota.item_lista_servico || "—"}</div>
                  <div><span className="text-gray-500">CNAE:</span> {parsedData.nota.codigo_cnae || "—"}</div>
                </div>
                {parsedData.nota.discriminacao && (
                  <div className="mt-2 p-2 bg-white border rounded text-sm">
                    <span className="text-gray-500 text-xs">Discriminação:</span><br />
                    <p className="mt-1 whitespace-pre-wrap">{parsedData.nota.discriminacao}</p>
                  </div>
                )}
              </div>

              {/* Totais */}
              <div className="bg-purple-50 rounded-lg p-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-center text-xs">
                <div>
                  <p className="text-gray-500">Valor dos Serviços</p>
                  <p className="font-bold">{formatCurrency(parsedData.totals.valor_servicos)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Deduções</p>
                  <p className="font-bold">{formatCurrency(parsedData.totals.valor_deducoes)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Base de Cálculo</p>
                  <p className="font-bold">{formatCurrency(parsedData.totals.base_calculo)}</p>
                </div>
                <div>
                  <p className="text-gray-500">ISS {parsedData.totals.iss_retido > 0 ? "(Retido)" : ""}</p>
                  <p className="font-bold">{formatCurrency(parsedData.totals.valor_iss)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Alíquota</p>
                  <p className="font-bold">{parsedData.totals.aliquota}%</p>
                </div>
                <div className="col-span-2">
                  <p className="text-gray-500">Valor Líquido da NFS-e</p>
                  <p className="font-bold text-purple-700 text-lg">{formatCurrency(parsedData.totals.valor_liquido || parsedData.totals.valor_servicos)}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 p-4 border-t sticky bottom-0 bg-white">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          {parsedData && (
            <Button type="button" onClick={handleConfirm} disabled={saving} className="bg-purple-600 hover:bg-purple-700 gap-1.5 text-white">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Confirmar Importação
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
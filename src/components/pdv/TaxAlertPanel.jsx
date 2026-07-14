import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, CheckCircle2, Package, Users, Building, RefreshCw, ChevronDown, ChevronRight } from "lucide-react";

export default function TaxAlertPanel({ user }) {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [exitTaxParams, setExitTaxParams] = useState([]);
  const [monofasicTaxes, setMonofasicTaxes] = useState([]);
  const [companyConfig, setCompanyConfig] = useState(null);
  const [expandedProduct, setExpandedProduct] = useState(null);
  const [expandedCustomer, setExpandedCustomer] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [prods, custs, taxes, monofasic, configs] = await Promise.all([
        base44.entities.PDVProduct.filter({ user_email: user.email, is_active: true }),
        base44.entities.PDVCustomer.filter({ user_email: user.email, is_active: true }),
        base44.entities.PDVExitTaxParameter.filter({ user_email: user.email, is_active: true }),
        base44.entities.PDVMonofasicTax.filter({ user_email: user.email, is_active: true }),
        base44.entities.PDVCompanyConfig.filter({ user_email: user.email }),
      ]);
      setProducts(prods);
      setCustomers(custs);
      setExitTaxParams(taxes);
      setMonofasicTaxes(monofasic);
      setCompanyConfig(configs[0] || null);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [user.email]);

  useEffect(() => { load(); }, [load]);

  // --- Verificações de PRODUTOS ---
  const productIssues = products.map(p => {
    const issues = [];
    if (!p.ncm) issues.push({ field: "NCM", message: "Produto sem NCM cadastrado — impossível calcular impostos." });
    if (!p.cfop_default) issues.push({ field: "CFOP", message: "Produto sem CFOP padrão de saída definido." });
    if (p.monofasic) {
      const hasMonofasicConfig = monofasicTaxes.some(m => m.ncm === p.ncm);
      if (!hasMonofasicConfig) issues.push({ field: "Monofásico", message: "Produto marcado como monofásico mas sem configuração de alíquotas na tabela de monofásicos (Lei 13.097)." });
    } else if (p.ncm) {
      const hasExitTax = exitTaxParams.some(t => t.ncm === p.ncm);
      if (!hasExitTax) issues.push({ field: "Trib. Saída", message: "Sem parâmetro tributário de saída cadastrado para o NCM deste produto (ICMS/IPI/PIS/COFINS)." });
    }
    if (!p.unit) issues.push({ field: "Unidade", message: "Produto sem unidade de medida definida." });
    return { product: p, issues };
  }).filter(p => p.issues.length > 0);

  // --- Verificações de CLIENTES ---
  const customerIssues = customers.map(c => {
    const issues = [];
    if (!c.cpf_cnpj) issues.push({ field: "CPF/CNPJ", message: "Cliente sem CPF/CNPJ — obrigatório para emissão de NF-e." });
    if (!c.uf) issues.push({ field: "UF", message: "Cliente sem UF de destino — necessário para definir CFOP e alíquota de ICMS interestadual." });
    if (!c.city) issues.push({ field: "Município", message: "Cliente sem município cadastrado." });
    if (!c.ibge_code) issues.push({ field: "Cód. IBGE", message: "Cliente sem código IBGE do município — obrigatório na NF-e." });
    if (!c.cep) issues.push({ field: "CEP", message: "Cliente sem CEP cadastrado." });
    if (!c.address) issues.push({ field: "Endereço", message: "Cliente sem logradouro cadastrado." });
    if (!c.buyer_type) issues.push({ field: "Tipo Comprador", message: "Cliente sem tipo de comprador definido (consumidor final, revendedor ou distribuidor) — afeta cálculo de PIS/COFINS em produtos bifásicos." });
    if ((c.buyer_type === "revendedor" || c.buyer_type === "distribuidor") && !c.ie) {
      issues.push({ field: "IE", message: `Cliente ${c.buyer_type === "distribuidor" ? "distribuidor" : "revendedor"} sem Inscrição Estadual — obrigatória para venda a contribuinte do ICMS.` });
    }
    return { customer: c, issues };
  }).filter(c => c.issues.length > 0);

  // --- Verificações de EMPRESA ---
  const companyIssues = [];
  if (!companyConfig) {
    companyIssues.push({ field: "Cadastro", message: "Empresa não cadastrada — configure os dados da empresa antes de emitir notas." });
  } else {
    if (!companyConfig.cnpj) companyIssues.push({ field: "CNPJ", message: "Empresa sem CNPJ cadastrado." });
    if (!companyConfig.ie) companyIssues.push({ field: "IE", message: "Empresa sem Inscrição Estadual — obrigatória para NF-e." });
    if (!companyConfig.ibge_code) companyIssues.push({ field: "Cód. IBGE", message: "Empresa sem código IBGE do município — obrigatório na NF-e." });
    if (!companyConfig.uf) companyIssues.push({ field: "UF", message: "Empresa sem UF cadastrada." });
    if (companyConfig.crt === 3 && companyConfig.lucro_type === "nao_se_aplica") {
      companyIssues.push({ field: "Lucro", message: "Regime Normal selecionado mas tipo de lucro não definido (Real ou Presumido)." });
    }
    if (!companyConfig.responsible_name) companyIssues.push({ field: "Responsável", message: "Dados do responsável pela empresa não preenchidos." });
  }

  const totalIssues = productIssues.length + customerIssues.length + companyIssues.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      {/* Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className={`rounded-xl border p-4 ${totalIssues === 0 ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
          <div className="flex items-center gap-2">
            {totalIssues === 0 ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertTriangle className="w-5 h-5 text-red-600" />}
            <span className="text-sm font-semibold text-gray-700">Status Geral</span>
          </div>
          <p className={`text-2xl font-bold mt-1 ${totalIssues === 0 ? "text-emerald-700" : "text-red-700"}`}>
            {totalIssues === 0 ? "Tudo OK" : `${totalIssues} alerta(s)`}
          </p>
        </div>
        <div className="rounded-xl border p-4 bg-blue-50 border-blue-200">
          <div className="flex items-center gap-2">
            <Building className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-semibold text-gray-700">Empresa</span>
          </div>
          <p className="text-2xl font-bold mt-1 text-blue-700">{companyIssues.length}</p>
        </div>
        <div className="rounded-xl border p-4 bg-amber-50 border-amber-200">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-amber-600" />
            <span className="text-sm font-semibold text-gray-700">Produtos</span>
          </div>
          <p className="text-2xl font-bold mt-1 text-amber-700">{productIssues.length}</p>
        </div>
        <div className="rounded-xl border p-4 bg-purple-50 border-purple-200">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-600" />
            <span className="text-sm font-semibold text-gray-700">Clientes</span>
          </div>
          <p className="text-2xl font-bold mt-1 text-purple-700">{customerIssues.length}</p>
        </div>
      </div>

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={load} className="gap-1.5">
          <RefreshCw className="w-4 h-4" /> Atualizar
        </Button>
      </div>

      {/* Alertas de Empresa */}
      {companyIssues.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl overflow-hidden">
          <div className="px-4 py-2 bg-red-100 border-b border-red-200 flex items-center gap-2">
            <Building className="w-4 h-4 text-red-600" />
            <h3 className="text-sm font-bold text-red-800">Alertas da Empresa ({companyIssues.length})</h3>
          </div>
          <div className="divide-y divide-red-100">
            {companyIssues.map((issue, i) => (
              <div key={i} className="px-4 py-2 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-xs font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded mr-1">{issue.field}</span>
                  <span className="text-sm text-gray-700">{issue.message}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alertas de Produtos */}
      {productIssues.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
          <div className="px-4 py-2 bg-amber-100 border-b border-amber-200 flex items-center gap-2">
            <Package className="w-4 h-4 text-amber-600" />
            <h3 className="text-sm font-bold text-amber-800">Produtos sem Configuração Tributária ({productIssues.length})</h3>
          </div>
          <div className="divide-y divide-amber-100">
            {productIssues.map(({ product, issues }, idx) => (
              <div key={idx} className="px-4 py-2">
                <button
                  onClick={() => setExpandedProduct(expandedProduct === idx ? null : idx)}
                  className="flex items-center gap-2 w-full text-left"
                >
                  {expandedProduct === idx ? <ChevronDown className="w-4 h-4 text-amber-600" /> : <ChevronRight className="w-4 h-4 text-amber-600" />}
                  <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  <span className="text-sm font-medium text-gray-800">{product.name}</span>
                  <span className="text-xs text-gray-400">NCM: {product.ncm || "—"}</span>
                  <span className="ml-auto text-xs text-amber-600 font-medium">{issues.length} problema(s)</span>
                </button>
                {expandedProduct === idx && (
                  <div className="mt-1 ml-6 space-y-1">
                    {issues.map((issue, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-sm">
                        <span className="text-xs font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded flex-shrink-0">{issue.field}</span>
                        <span className="text-gray-600">{issue.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alertas de Clientes */}
      {customerIssues.length > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl overflow-hidden">
          <div className="px-4 py-2 bg-purple-100 border-b border-purple-200 flex items-center gap-2">
            <Users className="w-4 h-4 text-purple-600" />
            <h3 className="text-sm font-bold text-purple-800">Clientes sem Configuração Completa ({customerIssues.length})</h3>
          </div>
          <div className="divide-y divide-purple-100">
            {customerIssues.map(({ customer, issues }, idx) => (
              <div key={idx} className="px-4 py-2">
                <button
                  onClick={() => setExpandedCustomer(expandedCustomer === idx ? null : idx)}
                  className="flex items-center gap-2 w-full text-left"
                >
                  {expandedCustomer === idx ? <ChevronDown className="w-4 h-4 text-purple-600" /> : <ChevronRight className="w-4 h-4 text-purple-600" />}
                  <AlertTriangle className="w-4 h-4 text-purple-500 flex-shrink-0" />
                  <span className="text-sm font-medium text-gray-800">{customer.name}</span>
                  <span className="text-xs text-gray-400">CPF/CNPJ: {customer.cpf_cnpj || "—"}</span>
                  <span className="ml-auto text-xs text-purple-600 font-medium">{issues.length} problema(s)</span>
                </button>
                {expandedCustomer === idx && (
                  <div className="mt-1 ml-6 space-y-1">
                    {issues.map((issue, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-sm">
                        <span className="text-xs font-bold text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded flex-shrink-0">{issue.field}</span>
                        <span className="text-gray-600">{issue.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tudo OK */}
      {totalIssues === 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-8 text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-2" />
          <h3 className="text-lg font-bold text-emerald-800">Tudo configurado!</h3>
          <p className="text-sm text-emerald-600 mt-1">Todos os produtos, clientes e dados da empresa possuem configuração tributária adequada para emissão de NF-e.</p>
        </div>
      )}
    </div>
  );
}
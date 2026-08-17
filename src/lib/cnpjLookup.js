import { base44 } from "@/api/base44Client";

/**
 * Consulta CNPJ na Receita Federal via backend function e retorna dados mapeados.
 * @param {string} cnpj - CNPJ (apenas números ou formatado)
 * @returns {Promise<Object|null>} dados mapeados ou null se erro
 */
export async function lookupCnpj(cnpj) {
  const clean = (cnpj || "").replace(/\D/g, "");
  if (clean.length !== 14) return { error: "CNPJ deve ter 14 dígitos." };

  try {
    const resp = await base44.functions.invoke("consultaCnpj", { cnpj: clean });
    const data = resp.data;
    if (!data?.success || !data?.dados) {
      return { error: data?.error || "Não foi possível obter os dados do CNPJ." };
    }

    const d = data.dados;
    return {
      razao_social: d.razao_social || "",
      nome_fantasia: d.nome_fantasia || "",
      cep: d.cep || "",
      address: [d.descricao_tipo_de_logradouro, d.logradouro].filter(Boolean).join(" "),
      number: d.numero || "",
      complement: d.complemento || "",
      district: d.bairro || "",
      city: d.municipio || "",
      uf: d.uf || "",
      ibge_code: d.codigo_ibge_municipio ? String(d.codigo_ibge_municipio) : "",
      phone: d.telefone || "",
      email: d.email || "",
      cnae: d.cnae_fiscal != null && d.cnae_fiscal !== "" ? String(d.cnae_fiscal) : "",
      cnae_descricao: d.cnae_fiscal_descricao || "",
      natureza_juridica: d.natureza_juridica || "",
      porte: d.porte || "",
      matriz_filial: d.matriz_filial || "",
      abertura: d.abertura || "",
    };
  } catch (e) {
    const msg = e?.response?.data?.error || e?.message || "Erro ao consultar CNPJ.";
    return { error: msg };
  }
}
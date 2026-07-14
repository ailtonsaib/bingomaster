import { base44 } from "@/api/base44Client";

/**
 * Consulta CNPJ na Receita Federal via backend function e retorna dados mapeados.
 * @param {string} cnpj - CNPJ (apenas números ou formatado)
 * @returns {Promise<Object|null>} dados mapeados ou null se erro
 */
export async function lookupCnpj(cnpj) {
  const clean = (cnpj || "").replace(/\D/g, "");
  if (clean.length !== 14) return null;

  try {
    const resp = await base44.functions.invoke("consultaCnpj", { cnpj: clean });
    const data = resp.data;
    if (!data?.success || !data?.dados) return null;

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
    };
  } catch (e) {
    console.error("Erro ao consultar CNPJ:", e);
    return null;
  }
}
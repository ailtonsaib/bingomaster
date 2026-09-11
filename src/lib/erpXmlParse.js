// Parser de XML fiscal (NF-e / NFC-e / CT-e / NFS-e ABRASF / NFS-e Nacional SPED v1.01) para o navegador.
// Retorna estrutura normalizada { model, nota, supplier, totals, items }.

function getText(parent, tag) {
  if (!parent) return "";
  const el = parent.getElementsByTagName(tag)[0] || parent.getElementsByTagName(`*:${tag}`)[0];
  return el?.textContent?.trim() || "";
}

function num(v) {
  return parseFloat(String(v || "0").replace(",", ".")) || 0;
}

// Extrai valores de retenções (IRRF, PIS, COFINS, CSLL, INSS, ISS) de um elemento de valores.
// `candidates` mapeia tipo -> lista de tags candidatas (em ordem de prioridade).
function extractRetentions(valoresEl, candidates) {
  const r = { irrf: 0, pis: 0, cofins: 0, csll: 0, inss: 0, iss: 0 };
  if (!valoresEl) return r;
  for (const [type, tags] of Object.entries(candidates)) {
    for (const t of tags) { const x = getText(valoresEl, t); if (x) { r[type] = num(x); break; } }
  }
  return r;
}

function parseNfe(doc) {
  const infNFe = doc.getElementsByTagName("infNFe")[0] || doc.getElementsByTagName("*:infNFe")[0];
  if (!infNFe) throw new Error("Registro infNFe não encontrado. Verifique se é um XML de NF-e válido.");

  const ide = infNFe.getElementsByTagName("ide")[0] || infNFe.getElementsByTagName("*:ide")[0];
  const emit = infNFe.getElementsByTagName("emit")[0] || infNFe.getElementsByTagName("*:emit")[0];
  const total = infNFe.getElementsByTagName("total")[0] || infNFe.getElementsByTagName("*:total")[0];
  const icmsTot = total?.getElementsByTagName("ICMSTot")[0] || total?.getElementsByTagName("*:ICMSTot")[0];
  const detNodes = infNFe.getElementsByTagName("det");

  // Chave de acesso (atributo Id)
  const idAttr = infNFe.getAttribute("Id") || "";
  const chave = /^NFe\d{44}$/.test(idAttr) ? idAttr.substring(3) : "";

  const items = [];
  for (let i = 0; i < detNodes.length; i++) {
    const det = detNodes[i];
    const prod = det.getElementsByTagName("prod")[0] || det.getElementsByTagName("*:prod")[0];
    const imposto = det.getElementsByTagName("imposto")[0] || det.getElementsByTagName("*:imposto")[0];
    const icmsNode = imposto?.getElementsByTagName("ICMS")[0] || imposto?.getElementsByTagName("*:ICMS")[0];
    const icmsChild = icmsNode?.firstElementChild;
    const cstIcms = icmsChild ? getText(icmsChild, "CST") || getText(icmsChild, "CSOSN") : "";
    const ipiNode = imposto?.getElementsByTagName("IPI")[0] || imposto?.getElementsByTagName("*:IPI")[0];
    const ipiChild = ipiNode?.firstElementChild;
    const pisNode = imposto?.getElementsByTagName("PIS")[0] || imposto?.getElementsByTagName("*:PIS")[0];
    const pisChild = pisNode?.firstElementChild;
    const cofinsNode = imposto?.getElementsByTagName("COFINS")[0] || imposto?.getElementsByTagName("*:COFINS")[0];
    const cofinsChild = cofinsNode?.firstElementChild;

    items.push({
      product_code: getText(prod, "cProd"),
      barcode: getText(prod, "cEAN"),
      product_name: getText(prod, "xProd"),
      ncm: getText(prod, "NCM"),
      cfop: getText(prod, "CFOP"),
      unit: getText(prod, "uCom"),
      quantity: num(getText(prod, "qCom")),
      unit_price: num(getText(prod, "vUnCom")),
      total: num(getText(prod, "vProd")),
      cst_icms: cstIcms,
      icms_rate: num(getText(icmsChild, "pICMS")),
      icms_value: num(getText(icmsChild, "vICMS")),
      ipi_value: num(getText(ipiChild, "vIPI")),
      pis_value: num(getText(pisChild, "vPIS")),
      cofins_value: num(getText(cofinsChild, "vCOFINS")),
    });
  }

  return {
    model: getText(ide, "mod") || "55",
    nota: {
      number: getText(ide, "nNF"),
      series: getText(ide, "serie"),
      model: getText(ide, "mod") || "55",
      issue_date: getText(ide, "dhEmi"),
      nature_operation: getText(ide, "natOp"),
      cfop: items[0]?.cfop || "",
      chave_acesso: chave,
    },
    supplier: {
      name: getText(emit, "xNome"),
      cpf_cnpj: getText(emit, "CNPJ") || getText(emit, "CPF"),
      ie: getText(emit, "IE"),
      nome_fantasia: getText(emit, "xFant"),
      address: getText(emit, "xLgr"),
      number: getText(emit, "nro"),
      district: getText(emit, "xBairro"),
      city: getText(emit, "xMun"),
      uf: getText(emit, "UF"),
      cep: getText(emit, "CEP"),
      phone: getText(emit, "fone"),
      email: getText(emit, "email"),
    },
    totals: {
      total_products: num(getText(icmsTot, "vProd")),
      total_icms: num(getText(icmsTot, "vICMS")),
      total_ipi: num(getText(icmsTot, "vIPI")),
      total_pis: num(getText(icmsTot, "vPIS")),
      total_cofins: num(getText(icmsTot, "vCOFINS")),
      total_nota: num(getText(icmsTot, "vNF")),
      despesas: num(getText(icmsTot, "vOutro")) + num(getText(icmsTot, "vSeg")),
      descontos: num(getText(icmsTot, "vDesc")),
    },
    retentions: { irrf: 0, pis: 0, cofins: 0, csll: 0, inss: 0, iss: 0 },
    items,
  };
}

// NFS-e Nacional (padrão SPED/Receita Federal v1.01) — raiz <NFSe> com <infNFSe> e <DPS>.
function parseNfseNacional(doc) {
  const inf = doc.getElementsByTagName("infNFSe")[0] || doc.getElementsByTagName("*:infNFSe")[0];
  if (!inf) throw new Error("Registro infNFSe não encontrado (NFS-e Nacional).");

  const emit = inf.getElementsByTagName("emit")[0] || inf.getElementsByTagName("*:emit")[0];
  const endNac = emit?.getElementsByTagName("enderNac")[0] || emit?.getElementsByTagName("*:enderNac")[0];
  const valores = inf.getElementsByTagName("valores")[0] || inf.getElementsByTagName("*:valores")[0];
  const dps = inf.getElementsByTagName("DPS")[0] || inf.getElementsByTagName("*:DPS")[0];
  const infDPS = dps?.getElementsByTagName("infDPS")[0] || dps?.getElementsByTagName("*:infDPS")[0];
  const serv = infDPS?.getElementsByTagName("serv")[0] || infDPS?.getElementsByTagName("*:serv")[0];
  const cServ = serv?.getElementsByTagName("cServ")[0] || serv?.getElementsByTagName("*:cServ")[0];
  const dpsValores = infDPS?.getElementsByTagName("valores")[0] || infDPS?.getElementsByTagName("*:valores")[0];

  const vLiq = num(getText(valores, "vLiq"));
  const vServ = num(getText(dpsValores?.getElementsByTagName("vServPrest")[0] || dpsValores?.getElementsByTagName("*:vServPrest")[0], "vServ")) || vLiq;
  const xDescServ = getText(cServ, "xDescServ");
  const xTribNac = getText(inf, "xTribNac");
  const cNBS = getText(cServ, "cNBS");
  const idAttr = inf.getAttribute("Id") || "";

  const retNac = extractRetentions(dpsValores, {
    irrf: ["vIRRF"],
    pis: ["vPISRet"],
    cofins: ["vCOFINSRet"],
    csll: ["vCSLLRet"],
    inss: ["vINSSRet", "vRetCP"],
    iss: ["vISSRet", "vISS"],
  });

  return {
    model: "NFSe",
    nota: {
      number: getText(inf, "nNFSe"),
      series: "",
      model: "NFSe",
      issue_date: getText(inf, "dhProc") || getText(infDPS, "dhEmi"),
      nature_operation: `Prestação de Serviço — ${xTribNac || "NFS-e Nacional"}`,
      cfop: "",
      chave_acesso: idAttr,
    },
    supplier: {
      name: getText(emit, "xNome"),
      cpf_cnpj: getText(emit, "CNPJ") || getText(emit, "CPF"),
      ie: "",
      address: getText(endNac, "xLgr"),
      number: getText(endNac, "nro"),
      district: getText(endNac, "xBairro"),
      city: getText(inf, "xLocEmi"),
      uf: getText(endNac, "UF"),
      cep: getText(endNac, "CEP"),
    },
    totals: {
      total_products: vServ,
      total_icms: 0,
      total_ipi: 0,
      total_pis: 0,
      total_cofins: 0,
      total_nota: vLiq,
    },
    retentions: retNac,
    items: [{
      product_code: cNBS,
      barcode: "",
      product_name: xDescServ || xTribNac || "Serviço",
      ncm: "",
      cfop: "",
      unit: "UN",
      quantity: 1,
      unit_price: vServ,
      total: vServ,
      cst_icms: "",
      icms_rate: 0,
      icms_value: 0,
      ipi_value: 0,
      pis_value: 0,
      cofins_value: 0,
    }],
  };
}

function parseNfse(doc) {
  const inf = doc.getElementsByTagName("InfNfse")[0] || doc.getElementsByTagName("*:InfNfse")[0];
  if (!inf) throw new Error("Registro InfNfse não encontrado (NFS-e).");

  const prestador = inf.getElementsByTagName("Prestador")[0] || inf.getElementsByTagName("*:Prestador")[0];
  const servico = inf.getElementsByTagName("Servico")[0] || inf.getElementsByTagName("*:Servico")[0];
  const valores = servico?.getElementsByTagName("Valores")[0] || inf.getElementsByTagName("Valores")[0];
  const endPrest = prestador?.getElementsByTagName("Endereco")[0] || prestador?.getElementsByTagName("*:Endereco")[0];

  const valorServicos = num(getText(valores, "ValorServicos"));
  const valorLiquido = num(getText(inf, "ValorLiquidoNfse")) || valorServicos;
  const discriminacao = getText(servico, "Discriminacao");
  const itemLista = getText(servico, "ItemListaServico");
  const retAbr = extractRetentions(valores, {
    irrf: ["ValorIr", "ValorIRRFRetido"],
    pis: ["ValorPis", "ValorPISRetido"],
    cofins: ["ValorCofins", "ValorCOFINSRetido"],
    csll: ["ValorCsll", "ValorCSLLRetido"],
    inss: ["ValorInss", "ValorINSSRetido"],
    iss: ["ValorIssRetido", "ValorIss"],
  });

  return {
    model: "NFSe",
    nota: {
      number: getText(inf, "Numero"),
      series: "",
      model: "NFSe",
      issue_date: getText(inf, "DataEmissao"),
      nature_operation: "Prestação de Serviço",
      cfop: "",
      chave_acesso: "",
    },
    supplier: {
      name: getText(prestador, "RazaoSocial") || getText(prestador, "Nome"),
      cpf_cnpj: getText(prestador, "Cnpj") || getText(prestador, "Cpf"),
      ie: getText(prestador, "InscricaoMunicipal"),
      address: getText(endPrest, "Endereco") || getText(endPrest, "xLgr"),
      number: getText(endPrest, "Numero") || getText(endPrest, "nro"),
      district: getText(endPrest, "Bairro") || getText(endPrest, "xBairro"),
      city: getText(endPrest, "Municipio") || getText(endPrest, "xMun"),
      uf: getText(endPrest, "Uf") || getText(endPrest, "UF"),
      cep: getText(endPrest, "Cep") || getText(endPrest, "CEP"),
    },
    totals: {
      total_products: valorServicos,
      total_icms: 0,
      total_ipi: 0,
      total_pis: 0,
      total_cofins: 0,
      total_nota: valorLiquido,
    },
    retentions: retAbr,
    items: [{
      product_code: itemLista,
      barcode: "",
      product_name: discriminacao || `Serviço ${itemLista}`,
      ncm: "",
      cfop: "",
      unit: "UN",
      quantity: 1,
      unit_price: valorServicos,
      total: valorServicos,
      cst_icms: "",
      icms_rate: 0,
      icms_value: 0,
      ipi_value: 0,
      pis_value: 0,
      cofins_value: 0,
    }],
  };
}

// CT-e (modelo 57) — Conhecimento de Transporte eletrônico (raiz cteProc/CTe).
// Normaliza para a mesma estrutura de NF-e: transportadora como "supplier" e
// o valor da prestação (vTPrest) como total do documento.
function parseCte(doc) {
  const infCte = doc.getElementsByTagName("infCte")[0] || doc.getElementsByTagName("*:infCte")[0];
  if (!infCte) throw new Error("Registro infCte não encontrado. Verifique se é um XML de CT-e válido.");
  const ide = infCte.getElementsByTagName("ide")[0] || infCte.getElementsByTagName("*:ide")[0];
  const emit = infCte.getElementsByTagName("emit")[0] || infCte.getElementsByTagName("*:emit")[0];
  const enderEmit = emit?.getElementsByTagName("enderEmit")[0] || emit?.getElementsByTagName("*:enderEmit")[0];
  const imp = infCte.getElementsByTagName("imp")[0] || infCte.getElementsByTagName("*:imp")[0];
  const idAttr = infCte.getAttribute("Id") || "";
  const chave = /^CTe\d{44}$/.test(idAttr) ? idAttr.substring(3) : "";
  const vTPrest = num(getText(infCte, "vTPrest"));

  return {
    model: "57",
    nota: {
      number: getText(ide, "nCT"),
      series: getText(ide, "serie") || getText(ide, "nSerie"),
      model: "57",
      issue_date: getText(ide, "dhEmi"),
      nature_operation: getText(ide, "natOp") || "Prestação de Serviço de Transporte",
      cfop: getText(ide, "CFOP"),
      chave_acesso: chave,
    },
    supplier: {
      name: getText(emit, "xNome"),
      cpf_cnpj: getText(emit, "CNPJ") || getText(emit, "CPF"),
      ie: getText(emit, "IE"),
      city: getText(enderEmit, "xMun"),
      uf: getText(enderEmit, "UF"),
    },
    totals: {
      total_products: vTPrest,
      total_icms: num(getText(imp, "vICMS")) + num(getText(imp, "vICMSOutraUF")),
      total_ipi: 0,
      total_pis: num(getText(imp, "vPIS")),
      total_cofins: num(getText(imp, "vCOFINS")),
      total_nota: vTPrest,
      despesas: 0,
      descontos: 0,
    },
    retentions: { irrf: 0, pis: 0, cofins: 0, csll: 0, inss: 0, iss: 0 },
    items: [],
  };
}

export function parseFiscalXml(xmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "text/xml");
  if (doc.querySelector("parsererror")) throw new Error("XML inválido ou mal formatado.");

  // Detecta NF-e/NFC-e, CT-e, NFS-e Nacional (SPED) ou NFS-e ABRASF
  const hasNfe = doc.getElementsByTagName("infNFe").length > 0 || doc.getElementsByTagName("*:infNFe").length > 0;
  const hasCte = doc.getElementsByTagName("infCte").length > 0 || doc.getElementsByTagName("*:infCte").length > 0;
  const hasNfseNacional = doc.getElementsByTagName("infNFSe").length > 0 || doc.getElementsByTagName("*:infNFSe").length > 0;
  const hasNfse = doc.getElementsByTagName("InfNfse").length > 0 || doc.getElementsByTagName("*:InfNfse").length > 0;

  if (hasNfe) return parseNfe(doc);
  if (hasCte) return parseCte(doc);
  if (hasNfseNacional) return parseNfseNacional(doc);
  if (hasNfse) return parseNfse(doc);
  throw new Error("XML não reconhecido como NF-e/NFC-e, CT-e ou NFS-e.");
}
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { XMLParser } from 'npm:fast-xml-parser@4.5.1';

// ===================== HELPERS =====================

function validarDigitoCpf(cpf) {
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  let s = 0;
  for (let i = 0; i < 9; i++) s += parseInt(cpf[i], 10) * (10 - i);
  let dv1 = (s * 10) % 11; if (dv1 === 10) dv1 = 0;
  if (dv1 !== parseInt(cpf[9], 10)) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += parseInt(cpf[i], 10) * (11 - i);
  let dv2 = (s * 10) % 11; if (dv2 === 10) dv2 = 0;
  return dv2 === parseInt(cpf[10], 10);
}

function validarDigitoCnpj(cnpj) {
  const p1 = [5,4,3,2,9,8,7,6,5,4,3,2], p2 = [6,5,4,3,2,9,8,7,6,5,4,3,2];
  let s = 0; for (let i = 0; i < 12; i++) s += parseInt(cnpj[i], 10) * p1[i];
  let dv1 = s % 11; dv1 = dv1 < 2 ? 0 : 11 - dv1;
  if (dv1 !== parseInt(cnpj[12], 10)) return false;
  s = 0; for (let i = 0; i < 13; i++) s += parseInt(cnpj[i], 10) * p2[i];
  let dv2 = s % 11; dv2 = dv2 < 2 ? 0 : 11 - dv2;
  return dv2 === parseInt(cnpj[13], 10);
}

function validarCpfCnpj(docRaw, idx, secao, erros) {
  if (!docRaw) return;
  const doc = String(docRaw).replace(/\D/g, '');
  if (doc.length === 11) {
    if (!validarDigitoCpf(doc)) erros.push({ linha: idx, registro: secao, mensagem: `CPF inválido: "${docRaw}" (dígitos verificadores não conferem).`, severidade: 'erro' });
  } else if (doc.length === 14) {
    if (!validarDigitoCnpj(doc)) erros.push({ linha: idx, registro: secao, mensagem: `CNPJ inválido: "${docRaw}" (dígitos verificadores não conferem).`, severidade: 'erro' });
  } else {
    erros.push({ linha: idx, registro: secao, mensagem: `CPF/CNPJ inválido: "${docRaw}" (esperado 11 ou 14 dígitos, encontrado ${doc.length}).`, severidade: 'erro' });
  }
}

function chkObrig(obj, campo, idx, secao, erros, parent) {
  if (!obj || obj[campo] === undefined || obj[campo] === null || String(obj[campo]).trim() === '') {
    erros.push({ linha: idx, registro: secao, mensagem: `${secao}: <${parent ? parent + '/' : ''}${campo}> obrigatório não informado.`, severidade: 'erro' });
  }
}
function chkEnum(obj, campo, vals, idx, secao, erros, label) {
  if (obj && obj[campo] !== undefined && obj[campo] !== null && String(obj[campo]).trim() !== '' && !vals.map(String).includes(String(obj[campo]))) {
    erros.push({ linha: idx, registro: secao, mensagem: `${secao}: <${label || campo}> inválido: "${obj[campo]}" (deve ser: ${vals.join(', ')}).`, severidade: 'erro' });
  }
}
function chkNum(obj, campo, idx, secao, erros) {
  if (obj && obj[campo] !== undefined && obj[campo] !== null && String(obj[campo]).trim() !== '') {
    if (isNaN(parseFloat(String(obj[campo]).replace(',', '.')))) {
      erros.push({ linha: idx, registro: secao, mensagem: `${secao}: <${campo}> valor numérico inválido: "${obj[campo]}".`, severidade: 'erro' });
    }
  }
}

// ===================== VALIDAÇÃO NF-e =====================

const MOD_NFE_VALIDOS = ['55'];
const MOD_NFCE_VALIDOS = ['65'];
const TP_AMB_VALIDOS = ['1', '2'];
const TP_NF_VALIDOS = ['0', '1'];
const TP_EMIS_VALIDOS = ['1', '2', '3', '4', '5', '6', '7'];
const FIN_NFE_VALIDOS = ['1', '2', '3', '4'];
const IND_FINAL_VALIDOS = ['0', '1'];
const IND_PRES_VALIDOS = ['0', '1', '2', '3', '4', '5', '9'];
const IND_IE_DEST_VALIDOS = ['1', '2', '9'];
const MOD_FRETE_VALIDOS = ['0', '1', '2', '3', '4', '9'];
const CRT_VALIDOS = ['1', '2', '3'];
const TP_PAG_VALIDOS = ['01','02','03','04','05','10','11','12','13','14','15','16','17','18','19','20','21','22','23','90','99'];

function validarNFe(nfe, idx, erros, avisos) {
  const infNFe = nfe.infNFe;
  if (!infNFe) { erros.push({ linha: idx, registro: 'NF-e', mensagem: 'Elemento <infNFe> obrigatório não encontrado.', severidade: 'erro' }); return; }

  // Atributo Id (formato NFe + 44 dígitos)
  const idAttr = infNFe['@_Id'] || infNFe['@_id'];
  if (!idAttr) {
    erros.push({ linha: idx, registro: 'NF-e', mensagem: 'Atributo "Id" da <infNFe> obrigatório não encontrado.', severidade: 'erro' });
  } else if (!/^NFe\d{44}$/.test(String(idAttr))) {
    erros.push({ linha: idx, registro: 'NF-e', mensagem: `Atributo "Id" inválido: "${idAttr}" (deve seguir o formato NFe + 44 dígitos da chave de acesso).`, severidade: 'erro' });
  }
  // versao
  const versao = infNFe['@_versao'] || infNFe['@_version'];
  if (!versao) { avisos.push({ linha: idx, registro: 'NF-e', mensagem: 'Atributo "versao" da <infNFe> não informado.', severidade: 'aviso' }); }

  // --- ide ---
  const ide = infNFe.ide;
  chkObrig(infNFe, 'ide', idx, 'NF-e/ide', erros);
  if (ide) {
    chkObrig(ide, 'cUF', idx, 'NF-e/ide', erros);
    chkEnum(ide, 'cUF', ['11','12','13','14','15','16','17','21','22','23','24','25','26','27','28','29','31','32','33','35','41','42','43','50','51','52','53'], idx, 'NF-e/ide', erros, 'cUF (código da UF)');
    chkObrig(ide, 'natOp', idx, 'NF-e/ide', erros);
    chkObrig(ide, 'mod', idx, 'NF-e/ide', erros);
    chkEnum(ide, 'mod', ['55','65'], idx, 'NF-e/ide', erros, 'mod (55=NF-e, 65=NFC-e)');
    chkObrig(ide, 'serie', idx, 'NF-e/ide', erros);
    chkObrig(ide, 'nNF', idx, 'NF-e/ide', erros);
    chkObrig(ide, 'dhEmi', idx, 'NF-e/ide', erros);
    chkObrig(ide, 'tpNF', idx, 'NF-e/ide', erros);
    chkEnum(ide, 'tpNF', TP_NF_VALIDOS, idx, 'NF-e/ide', erros, 'tpNF (0=Entrada, 1=Saída)');
    chkObrig(ide, 'cMunFG', idx, 'NF-e/ide', erros);
    chkObrig(ide, 'tpImp', idx, 'NF-e/ide', erros);
    chkEnum(ide, 'tpImp', ['1','2','3','4','5'], idx, 'NF-e/ide', erros, 'tpImp (1=Retrato, 2=Paisagem, 3=Simplificado, 4=NFC-e, 5=NFC-e simplificado)');
    chkObrig(ide, 'tpEmis', idx, 'NF-e/ide', erros);
    chkEnum(ide, 'tpEmis', TP_EMIS_VALIDOS, idx, 'NF-e/ide', erros, 'tpEmis (1=Normal, 2=Contingência FS-IA, 3=SCAN, 4=DPEC, 5=FS-DA, 6=SVC-AN, 7=SVC-RS)');
    chkObrig(ide, 'cDV', idx, 'NF-e/ide', erros);
    chkObrig(ide, 'tpAmb', idx, 'NF-e/ide', erros);
    chkEnum(ide, 'tpAmb', TP_AMB_VALIDOS, idx, 'NF-e/ide', erros, 'tpAmb (1=Produção, 2=Homologação)');
    chkObrig(ide, 'finNFe', idx, 'NF-e/ide', erros);
    chkEnum(ide, 'finNFe', FIN_NFE_VALIDOS, idx, 'NF-e/ide', erros, 'finNFe (1=Normal, 2=Complementar, 3=Ajuste, 4=Devolução)');
    chkObrig(ide, 'indFinal', idx, 'NF-e/ide', erros);
    chkEnum(ide, 'indFinal', IND_FINAL_VALIDOS, idx, 'NF-e/ide', erros, 'indFinal (0=Não, 1=Consumidor final)');
    chkObrig(ide, 'indPres', idx, 'NF-e/ide', erros);
    chkEnum(ide, 'indPres', IND_PRES_VALIDOS, idx, 'NF-e/ide', erros, 'indPres (0=Não se aplica, 1=Presencial, 2=Internet, 3=Telefônica, 4=Domicílio, 5=Presencial foras estab., 9=Outros)');
    chkObrig(ide, 'procEmi', idx, 'NF-e/ide', erros);
    chkEnum(ide, 'procEmi', ['0','1','2','3'], idx, 'NF-e/ide', erros, 'procEmi (0=Contribuinte App, 1=Avulsa Fisco, 2=AvulsaContrib, 3=Contribuinte Fisco)');
    chkObrig(ide, 'verProc', idx, 'NF-e/ide', erros);
  }

  // --- emit ---
  const emit = infNFe.emit;
  chkObrig(infNFe, 'emit', idx, 'NF-e/emit', erros);
  if (emit) {
    if (emit.CNPJ) validarCpfCnpj(emit.CNPJ, idx, 'NF-e/emit', erros);
    else if (emit.CPF) validarCpfCnpj(emit.CPF, idx, 'NF-e/emit', erros);
    else erros.push({ linha: idx, registro: 'NF-e/emit', mensagem: 'NF-e/emit: <CNPJ> ou <CPF> obrigatório não informado.', severidade: 'erro' });
    chkObrig(emit, 'xNome', idx, 'NF-e/emit', erros);
    chkObrig(emit, 'IE', idx, 'NF-e/emit', erros);
    chkEnum(emit, 'CRT', CRT_VALIDOS, idx, 'NF-e/emit', erros, 'CRT (1=Simples Nacional, 2=Simples Nacional excesso sublimite, 3=Regime Normal)');
    const endEmit = emit.enderEmit;
    chkObrig(emit, 'enderEmit', idx, 'NF-e/emit', erros);
    if (endEmit) {
      chkObrig(endEmit, 'xLgr', idx, 'NF-e/emit', erros, 'enderEmit');
      chkObrig(endEmit, 'nro', idx, 'NF-e/emit', erros, 'enderEmit');
      chkObrig(endEmit, 'xBairro', idx, 'NF-e/emit', erros, 'enderEmit');
      chkObrig(endEmit, 'cMun', idx, 'NF-e/emit', erros, 'enderEmit');
      chkObrig(endEmit, 'xMun', idx, 'NF-e/emit', erros, 'enderEmit');
      chkObrig(endEmit, 'UF', idx, 'NF-e/emit', erros, 'enderEmit');
      chkObrig(endEmit, 'CEP', idx, 'NF-e/emit', erros, 'enderEmit');
    }
  }

  // --- dest ---
  const dest = infNFe.dest;
  if (!dest) {
    avisos.push({ linha: idx, registro: 'NF-e/dest', mensagem: 'Elemento <dest> (destinatário) não encontrado — obrigatório exceto para NFC-e de consumidor não identificado.', severidade: 'aviso' });
  } else {
    if (dest.CNPJ) validarCpfCnpj(dest.CNPJ, idx, 'NF-e/dest', erros);
    else if (dest.CPF) validarCpfCnpj(dest.CPF, idx, 'NF-e/dest', erros);
    chkObrig(dest, 'xNome', idx, 'NF-e/dest', erros);
    chkEnum(dest, 'indIEDest', IND_IE_DEST_VALIDOS, idx, 'NF-e/dest', erros, 'indIEDest (1=Contribuinte ICMS, 2=Isento, 9=Não contribuinte)');
    const endDest = dest.enderDest;
    if (!endDest) {
      erros.push({ linha: idx, registro: 'NF-e/dest', mensagem: 'NF-e/dest: <enderDest> obrigatório não encontrado.', severidade: 'erro' });
    } else {
      chkObrig(endDest, 'xLgr', idx, 'NF-e/dest', erros, 'enderDest');
      chkObrig(endDest, 'cMun', idx, 'NF-e/dest', erros, 'enderDest');
      chkObrig(endDest, 'xMun', idx, 'NF-e/dest', erros, 'enderDest');
      chkObrig(endDest, 'UF', idx, 'NF-e/dest', erros, 'enderDest');
    }
  }

  // --- det (itens) ---
  const dets = infNFe.det;
  if (!dets) {
    erros.push({ linha: idx, registro: 'NF-e/det', mensagem: 'Nenhum item <det> encontrado na NF-e — deve haver pelo menos 1 item.', severidade: 'erro' });
  } else {
    const detArr = Array.isArray(dets) ? dets : [dets];
    for (let i = 0; i < detArr.length; i++) {
      const det = detArr[i]; if (!det) continue;
      const nItem = det['@_nItem'] || (i + 1);
      const prod = det.prod;
      if (!prod) {
        erros.push({ linha: idx, registro: `NF-e/det[${nItem}]`, mensagem: `<prod> obrigatório não encontrado no item ${nItem}.`, severidade: 'erro' });
      } else {
        chkObrig(prod, 'cProd', idx, `NF-e/det[${nItem}]/prod`, erros);
        chkObrig(prod, 'xProd', idx, `NF-e/det[${nItem}]/prod`, erros);
        chkObrig(prod, 'CFOP', idx, `NF-e/det[${nItem}]/prod`, erros);
        chkObrig(prod, 'uCom', idx, `NF-e/det[${nItem}]/prod`, erros);
        chkObrig(prod, 'qCom', idx, `NF-e/det[${nItem}]/prod`, erros);
        chkObrig(prod, 'vUnCom', idx, `NF-e/det[${nItem}]/prod`, erros);
        chkObrig(prod, 'vProd', idx, `NF-e/det[${nItem}]/prod`, erros);
        chkNum(prod, 'vProd', idx, `NF-e/det[${nItem}]/prod`, erros);
        chkNum(prod, 'qCom', idx, `NF-e/det[${nItem}]/prod`, erros);
        chkNum(prod, 'vUnCom', idx, `NF-e/det[${nItem}]/prod`, erros);
        // NCM: 8 dígitos (4 dígitos aceito para SH não-NBM)
        if (prod.NCM && !/^\d{2}(\d{2})?(\d{2})?(\d{2})?$/.test(String(prod.NCM))) {
          erros.push({ linha: idx, registro: `NF-e/det[${nItem}]/prod`, mensagem: `<NCM> inválido: "${prod.NCM}" (deve conter 2, 4, 6 ou 8 dígitos numéricos).`, severidade: 'erro' });
        }
      }
      const imposto = det.imposto;
      if (!imposto) {
        erros.push({ linha: idx, registro: `NF-e/det[${nItem}]`, mensagem: `<imposto> obrigatório não encontrado no item ${nItem}.`, severidade: 'erro' });
      } else {
        // ICMS deve existir (mesmo que CSOSN/CST isento)
        if (!imposto.ICMS) {
          erros.push({ linha: idx, registro: `NF-e/det[${nItem}]/imposto`, mensagem: `<ICMS> obrigatório não encontrado no item ${nItem}.`, severidade: 'erro' });
        }
        // IPI é obrigatório apenas para contribuintes do IPI — apenas avisa
        if (!imposto.IPI) {
          avisos.push({ linha: idx, registro: `NF-e/det[${nItem}]/imposto`, mensagem: `<IPI> não informado no item ${nItem} (obrigatório apenas para contribuintes do IPI).`, severidade: 'aviso' });
        }
      }
    }
  }

  // --- total ---
  const total = infNFe.total;
  if (!total) {
    erros.push({ linha: idx, registro: 'NF-e/total', mensagem: 'Elemento <total> obrigatório não encontrado.', severidade: 'erro' });
  } else {
    const icmstot = total.ICMSTot;
    if (!icmstot) {
      erros.push({ linha: idx, registro: 'NF-e/total', mensagem: '<ICMSTot> obrigatório não encontrado em <total>.', severidade: 'erro' });
    } else {
      chkObrig(icmstot, 'vNF', idx, 'NF-e/total/ICMSTot', erros);
      chkNum(icmstot, 'vNF', idx, 'NF-e/total/ICMSTot', erros);
      chkObrig(icmstot, 'vProd', idx, 'NF-e/total/ICMSTot', erros);
      chkNum(icmstot, 'vProd', idx, 'NF-e/total/ICMSTot', erros);
    }
  }

  // --- transp ---
  const transp = infNFe.transp;
  if (!transp) {
    erros.push({ linha: idx, registro: 'NF-e/transp', mensagem: 'Elemento <transp> obrigatório não encontrado.', severidade: 'erro' });
  } else {
    chkEnum(transp, 'modFrete', MOD_FRETE_VALIDOS, idx, 'NF-e/transp', erros, 'modFrete (0=Por conta emitente, 1=Por conta destinatário, 2=Por conta terceiros, 3=Sem transporte, 4=Por conta remetente, 9=Sem frete)');
  }

  // --- pag ---
  const pag = infNFe.pag;
  if (!pag) {
    erros.push({ linha: idx, registro: 'NF-e/pag', mensagem: 'Elemento <pag> obrigatório não encontrado (NT 2013/005).', severidade: 'erro' });
  } else {
    const detPags = pag.detPag ? (Array.isArray(pag.detPag) ? pag.detPag : [pag.detPag]) : [];
    if (detPags.length === 0) {
      erros.push({ linha: idx, registro: 'NF-e/pag', mensagem: '<detPag> obrigatório não encontrado em <pag>.', severidade: 'erro' });
    }
    for (const dp of detPags) {
      if (!dp) continue;
      chkObrig(dp, 'tPag', idx, 'NF-e/pag/detPag', erros);
      chkEnum(dp, 'tPag', TP_PAG_VALIDOS, idx, 'NF-e/pag/detPag', erros, 'tPag (01=Dinheiro, 02=Cheque, 03=Cartão Crédito, 04=Cartão Débito, 05=Crédito Loja, 10=Vale Alimentação, 11=Vale Refeição, 12=Vale Presente, 13=Vale Combustível, 14=Duplicata Mercantil, 15=Boleto Bancário, 16=Depósito Bancário, 17=Pagamento Instantâneo PIX, 18=Transferência bancária, 19=Programa fidelidade, 20=Sem pagamento, 21=Permuta, 22=Carteira Digital, 23=Carteira Digital criptográfica, 90=Outros, 99=Não informado)');
      chkObrig(dp, 'vPag', idx, 'NF-e/pag/detPag', erros);
      chkNum(dp, 'vPag', idx, 'NF-e/pag/detPag', erros);
    }
  }
}

// ===================== EXTRAÇÃO DE DADOS NF-e =====================

function extrairDoc(emitOrDest) {
  if (!emitOrDest) return null;
  const doc = emitOrDest.CNPJ || emitOrDest.CPF || '';
  const end = emitOrDest.enderEmit || emitOrDest.enderDest || null;
  return {
    tipo_doc: emitOrDest.CNPJ ? 'CNPJ' : (emitOrDest.CPF ? 'CPF' : ''),
    documento: String(doc).replace(/\D/g, ''),
    nome: emitOrDest.xNome || '',
    ie: emitOrDest.IE || '',
    uf: (end && end.UF) || (emitOrDest.UF) || '',
    municipio: (end && end.xMun) || (emitOrDest.xMun) || '',
    cMun: (end && end.cMun) || (emitOrDest.cMun) || '',
    cep: (end && end.CEP) || '',
    endereco: end ? {
      logradouro: end.xLgr || '',
      numero: end.nro || '',
      bairro: end.xBairro || '',
      complemento: end.xCpl || '',
      cMun: end.cMun || '',
      xMun: end.xMun || '',
      uf: end.UF || '',
      cep: end.CEP || '',
    } : null,
    crt: emitOrDest.CRT || '',
    indIEDest: emitOrDest.indIEDest || '',
  };
}

function extrairTotais(icmstot) {
  if (!icmstot) return null;
  return {
    vProd: parseFloat(String(icmstot.vProd || '0').replace(',', '.')) || 0,
    vNF: parseFloat(String(icmstot.vNF || '0').replace(',', '.')) || 0,
    vDesc: parseFloat(String(icmstot.vDesc || '0').replace(',', '.')) || 0,
    vFrete: parseFloat(String(icmstot.vFrete || '0').replace(',', '.')) || 0,
    vSeg: parseFloat(String(icmstot.vSeg || '0').replace(',', '.')) || 0,
    vOutro: parseFloat(String(icmstot.vOutro || '0').replace(',', '.')) || 0,
    vBC: parseFloat(String(icmstot.vBC || '0').replace(',', '.')) || 0,
    vICMS: parseFloat(String(icmstot.vICMS || '0').replace(',', '.')) || 0,
    vBCST: parseFloat(String(icmstot.vBCST || '0').replace(',', '.')) || 0,
    vST: parseFloat(String(icmstot.vST || '0').replace(',', '.')) || 0,
    vIPI: parseFloat(String(icmstot.vIPI || '0').replace(',', '.')) || 0,
    vPIS: parseFloat(String(icmstot.vPIS || '0').replace(',', '.')) || 0,
    vCOFINS: parseFloat(String(icmstot.vCOFINS || '0').replace(',', '.')) || 0,
    vFCP: parseFloat(String(icmstot.vFCP || '0').replace(',', '.')) || 0,
    vFCPST: parseFloat(String(icmstot.vFCPST || '0').replace(',', '.')) || 0,
    vFCPSTRet: parseFloat(String(icmstot.vFCPSTRet || '0').replace(',', '.')) || 0,
  };
}

function extrairIde(ide) {
  if (!ide) return null;
  return {
    cUF: ide.cUF || '',
    natOp: ide.natOp || '',
    modelo: ide.mod || '',
    serie: ide.serie || '',
    numero: ide.nNF || '',
    dhEmi: ide.dhEmi || '',
    tpNF: ide.tpNF === '0' ? 'Entrada' : (ide.tpNF === '1' ? 'Saída' : ''),
    tpAmb: ide.tpAmb === '1' ? 'Produção' : (ide.tpAmb === '2' ? 'Homologação' : ''),
    finNFe: ide.finNFe === '1' ? 'Normal' : (ide.finNFe === '2' ? 'Complementar' : (ide.finNFe === '3' ? 'Ajuste' : (ide.finNFe === '4' ? 'Devolução' : ''))),
    indFinal: ide.indFinal === '1' ? 'Consumidor Final' : (ide.indFinal === '0' ? 'Não Consumidor Final' : ''),
    indPres: ide.indPres || '',
    chave_acesso: '',
  };
}

function extrairDadosNFe(nfe, idx, erros, avisos) {
  const infNFe = nfe.infNFe;
  if (!infNFe) return null;

  const dados = {
    ide: extrairIde(infNFe.ide),
    emitente: extrairDoc(infNFe.emit),
    destinatario: extrairDoc(infNFe.dest),
    totais: null,
    itens: [],
    chave_acesso: '',
    total_itens: 0,
    soma_vProd_itens: 0,
  };

  // Chave de acesso
  const idAttr = infNFe['@_Id'] || infNFe['@_id'];
  if (idAttr && /^NFe\d{44}$/.test(String(idAttr))) {
    dados.chave_acesso = String(idAttr).substring(3);
    if (dados.ide) dados.ide.chave_acesso = dados.chave_acesso;
  }

  // Itens
  const dets = infNFe.det;
  if (dets) {
    const detArr = Array.isArray(dets) ? dets : [dets];
    for (const det of detArr) {
      if (!det || !det.prod) continue;
      const prod = det.prod;
      const vProd = parseFloat(String(prod.vProd || '0').replace(',', '.')) || 0;
      dados.itens.push({
        nItem: det['@_nItem'] || (dados.itens.length + 1),
        cProd: prod.cProd || '',
        xProd: prod.xProd || '',
        NCM: prod.NCM || '',
        CFOP: prod.CFOP || '',
        uCom: prod.uCom || '',
        qCom: parseFloat(String(prod.qCom || '0').replace(',', '.')) || 0,
        vUnCom: parseFloat(String(prod.vUnCom || '0').replace(',', '.')) || 0,
        vProd: vProd,
        vDesc: parseFloat(String(prod.vDesc || '0').replace(',', '.')) || 0,
        vFrete: parseFloat(String(prod.vFrete || '0').replace(',', '.')) || 0,
        vSeg: parseFloat(String(prod.vSeg || '0').replace(',', '.')) || 0,
        vOutro: parseFloat(String(prod.vOutro || '0').replace(',', '.')) || 0,
        indTot: prod.indTot || '',
      });
      dados.soma_vProd_itens += vProd;
    }
  }
  dados.total_itens = dados.itens.length;

  // Totais
  const icmstot = infNFe.total && infNFe.total.ICMSTot;
  dados.totais = extrairTotais(icmstot);

  // === Validação cruzada: soma dos itens vs total ===
  if (dados.totais) {
    const diff = Math.abs(dados.soma_vProd_itens - dados.totais.vProd);
    if (diff > 0.01) {
      erros.push({
        linha: idx, registro: 'NF-e/total/ICMSTot',
        mensagem: `Soma dos valores dos itens (vProd: ${dados.soma_vProd_itens.toFixed(2)}) não confere com o total da nota (vProd: ${dados.totais.vProd.toFixed(2)}). Diferença: ${diff.toFixed(2)}.`,
        severidade: 'erro'
      });
    }

    // vNF = vProd - vDesc + vFrete + vSeg + vOutro + vST + vIPI + vFCPST + vFCPSTRet
    const vNFCalculado = dados.totais.vProd
      - dados.totais.vDesc
      + dados.totais.vFrete
      + dados.totais.vSeg
      + dados.totais.vOutro
      + dados.totais.vST
      + dados.totais.vIPI
      + dados.totais.vFCPST
      + dados.totais.vFCPSTRet;
    const diffNF = Math.abs(vNFCalculado - dados.totais.vNF);
    if (diffNF > 0.01) {
      erros.push({
        linha: idx, registro: 'NF-e/total/ICMSTot',
        mensagem: `Valor total da nota (vNF: ${dados.totais.vNF.toFixed(2)}) não confere com o valor calculado (${vNFCalculado.toFixed(2)} = vProd - vDesc + vFrete + vSeg + vOutro + vST + vIPI + vFCPST + vFCPSTRet). Diferença: ${diffNF.toFixed(2)}.`,
        severidade: 'erro'
      });
    }
  }

  return dados;
}

// ===================== VALIDAÇÃO CT-e =====================

const MOD_CTE_VALIDOS = ['57'];
const TP_CTE_VALIDOS = ['0', '1', '2', '3'];
const TP_SERV_VALIDOS = ['0', '1', '2', '3'];
const RETIRA_VALIDOS = ['0', '1'];
const TOMBA_VALIDOS = ['0', '1', '2', '3'];
const MODAL_VALIDOS = ['01', '02', '03', '04', '05', '06'];

function validarCTe(cte, idx, erros, avisos) {
  const infCte = cte.infCte;
  if (!infCte) { erros.push({ linha: idx, registro: 'CT-e', mensagem: 'Elemento <infCte> obrigatório não encontrado.', severidade: 'erro' }); return; }

  const idAttr = infCte['@_Id'] || infCte['@_id'];
  if (!idAttr) {
    erros.push({ linha: idx, registro: 'CT-e', mensagem: 'Atributo "Id" da <infCte> obrigatório não encontrado.', severidade: 'erro' });
  } else if (!/^CTe\d{44}$/.test(String(idAttr))) {
    erros.push({ linha: idx, registro: 'CT-e', mensagem: `Atributo "Id" inválido: "${idAttr}" (deve seguir o formato CTe + 44 dígitos da chave de acesso).`, severidade: 'erro' });
  }
  const versao = infCte['@_versao'] || infCte['@_version'];
  if (!versao) { avisos.push({ linha: idx, registro: 'CT-e', mensagem: 'Atributo "versao" da <infCte> não informado.', severidade: 'aviso' }); }

  // --- ide ---
  const ide = infCte.ide;
  chkObrig(infCte, 'ide', idx, 'CT-e/ide', erros);
  if (ide) {
    chkObrig(ide, 'cUF', idx, 'CT-e/ide', erros);
    chkObrig(ide, 'CFOP', idx, 'CT-e/ide', erros);
    chkObrig(ide, 'natOp', idx, 'CT-e/ide', erros);
    chkObrig(ide, 'mod', idx, 'CT-e/ide', erros);
    chkEnum(ide, 'mod', MOD_CTE_VALIDOS, idx, 'CT-e/ide', erros, 'mod (57=CT-e)');
    chkObrig(ide, 'serie', idx, 'CT-e/ide', erros);
    chkObrig(ide, 'nCT', idx, 'CT-e/ide', erros);
    chkObrig(ide, 'dhEmi', idx, 'CT-e/ide', erros);
    chkObrig(ide, 'tpImp', idx, 'CT-e/ide', erros);
    chkEnum(ide, 'tpImp', ['1','2'], idx, 'CT-e/ide', erros, 'tpImp (1=Retrato, 2=Paisagem)');
    chkObrig(ide, 'tpEmis', idx, 'CT-e/ide', erros);
    chkEnum(ide, 'tpEmis', TP_EMIS_VALIDOS, idx, 'CT-e/ide', erros, 'tpEmis (1=Normal, 2=Contingência, etc.)');
    chkObrig(ide, 'cDV', idx, 'CT-e/ide', erros);
    chkObrig(ide, 'tpAmb', idx, 'CT-e/ide', erros);
    chkEnum(ide, 'tpAmb', TP_AMB_VALIDOS, idx, 'CT-e/ide', erros, 'tpAmb (1=Produção, 2=Homologação)');
    chkObrig(ide, 'tpCTe', idx, 'CT-e/ide', erros);
    chkEnum(ide, 'tpCTe', TP_CTE_VALIDOS, idx, 'CT-e/ide', erros, 'tpCTe (0=Normal, 1=Complementar, 2=Anulação, 3=Substituto)');
    chkObrig(ide, 'procEmi', idx, 'CT-e/ide', erros);
    chkEnum(ide, 'procEmi', ['0','1','2','3'], idx, 'CT-e/ide', erros, 'procEmi (0=Contribuinte App, 1=Avulso Fisco, 2=Avulso Contrib, 3=Contrib Fisco)');
    chkObrig(ide, 'verProc', idx, 'CT-e/ide', erros);
    chkObrig(ide, 'modal', idx, 'CT-e/ide', erros);
    chkEnum(ide, 'modal', MODAL_VALIDOS, idx, 'CT-e/ide', erros, 'modal (01=Rodoviário, 02=Aéreo, 03=Aquaviário, 04=Ferroviário, 05=Dutoviário, 06=Multimodal)');
    chkObrig(ide, 'tpServ', idx, 'CT-e/ide', erros);
    chkEnum(ide, 'tpServ', TP_SERV_VALIDOS, idx, 'CT-e/ide', erros, 'tpServ (0=Normal, 1=Subcontratação, 2=Redespacho, 3=Redespacho Intermediário)');
    chkObrig(ide, 'cMunIni', idx, 'CT-e/ide', erros);
    chkObrig(ide, 'xMunIni', idx, 'CT-e/ide', erros);
    chkObrig(ide, 'UFIni', idx, 'CT-e/ide', erros);
    chkObrig(ide, 'cMunFim', idx, 'CT-e/ide', erros);
    chkObrig(ide, 'xMunFim', idx, 'CT-e/ide', erros);
    chkObrig(ide, 'UFFim', idx, 'CT-e/ide', erros);
    chkEnum(ide, 'retira', RETIRA_VALIDOS, idx, 'CT-e/ide', erros, 'retira (0=Retira, 1=Não retira)');
    chkObrig(ide, 'cMunEnv', idx, 'CT-e/ide', erros);
    chkObrig(ide, 'xMunEnv', idx, 'CT-e/ide', erros);
    chkObrig(ide, 'UFEnv', idx, 'CT-e/ide', erros);
  }

  // --- emit ---
  const emit = infCte.emit;
  chkObrig(infCte, 'emit', idx, 'CT-e/emit', erros);
  if (emit) {
    if (emit.CNPJ) validarCpfCnpj(emit.CNPJ, idx, 'CT-e/emit', erros);
    else erros.push({ linha: idx, registro: 'CT-e/emit', mensagem: 'CT-e/emit: <CNPJ> obrigatório não informado.', severidade: 'erro' });
    chkObrig(emit, 'xNome', idx, 'CT-e/emit', erros);
    chkObrig(emit, 'IE', idx, 'CT-e/emit', erros);
    const endEmit = emit.enderEmit;
    chkObrig(emit, 'enderEmit', idx, 'CT-e/emit', erros);
    if (endEmit) {
      chkObrig(endEmit, 'xLgr', idx, 'CT-e/emit', erros, 'enderEmit');
      chkObrig(endEmit, 'cMun', idx, 'CT-e/emit', erros, 'enderEmit');
      chkObrig(endEmit, 'xMun', idx, 'CT-e/emit', erros, 'enderEmit');
      chkObrig(endEmit, 'UF', idx, 'CT-e/emit', erros, 'enderEmit');
    }
  }

  // --- rem (remetente) ---
  const rem = infCte.rem;
  chkObrig(infCte, 'rem', idx, 'CT-e/rem', erros);
  if (rem) {
    if (rem.CNPJ) validarCpfCnpj(rem.CNPJ, idx, 'CT-e/rem', erros);
    else if (rem.CPF) validarCpfCnpj(rem.CPF, idx, 'CT-e/rem', erros);
    chkObrig(rem, 'xNome', idx, 'CT-e/rem', erros);
    chkObrig(rem, 'cMun', idx, 'CT-e/rem', erros);
    chkObrig(rem, 'xMun', idx, 'CT-e/rem', erros);
    chkObrig(rem, 'UF', idx, 'CT-e/rem', erros);
  }

  // --- dest (destinatário) ---
  const dest = infCte.dest;
  chkObrig(infCte, 'dest', idx, 'CT-e/dest', erros);
  if (dest) {
    if (dest.CNPJ) validarCpfCnpj(dest.CNPJ, idx, 'CT-e/dest', erros);
    else if (dest.CPF) validarCpfCnpj(dest.CPF, idx, 'CT-e/dest', erros);
    chkObrig(dest, 'xNome', idx, 'CT-e/dest', erros);
    chkObrig(dest, 'cMun', idx, 'CT-e/dest', erros);
    chkObrig(dest, 'xMun', idx, 'CT-e/dest', erros);
    chkObrig(dest, 'UF', idx, 'CT-e/dest', erros);
  }

  // --- vPrest (valores do serviço) ---
  const vPrest = infCte.vPrest;
  chkObrig(infCte, 'vPrest', idx, 'CT-e/vPrest', erros);
  if (vPrest) {
    chkObrig(vPrest, 'vTPrest', idx, 'CT-e/vPrest', erros);
    chkNum(vPrest, 'vTPrest', idx, 'CT-e/vPrest', erros);
    chkObrig(vPrest, 'vRec', idx, 'CT-e/vPrest', erros);
    chkNum(vPrest, 'vRec', idx, 'CT-e/vPrest', erros);
  }

  // --- imp (impostos) ---
  const imp = infCte.imp;
  chkObrig(infCte, 'imp', idx, 'CT-e/imp', erros);
  if (imp) {
    const icms = imp.ICMS;
    if (!icms) {
      erros.push({ linha: idx, registro: 'CT-e/imp', mensagem: '<ICMS> obrigatório não encontrado em <imp>.', severidade: 'erro' });
    }
  }

  // --- infCTeNorm (informações do CT-e Normal) ---
  if (String(ide && ide.tpCTe) === '0') {
    if (!infCte.infCTeNorm) {
      avisos.push({ linha: idx, registro: 'CT-e', mensagem: '<infCTeNorm> não encontrado — obrigatório para CT-e Normal (tpCTe=0) com grupos de informações específicas.', severidade: 'aviso' });
    }
  }
}

// ===================== FUNÇÃO PRINCIPAL =====================

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { conteudo, nomeArquivo } = body;

    if (!conteudo || typeof conteudo !== 'string') {
      return Response.json({ success: false, error: 'Conteúdo do arquivo não fornecido.' }, { status: 400 });
    }

    const erros = [];
    const avisos = [];
    const estatisticas = { totalDocumentos: 0, documentos: {}, linhasComErro: 0, linhasComAviso: 0 };

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      parseTagValue: false,
      parseAttributeValue: false,
      trimValues: true
    });

    let xmlDoc;
    try { xmlDoc = parser.parse(conteudo); } catch (e) {
      return Response.json({ success: false, error: `Erro ao parsear XML: ${e.message}` }, { status: 400 });
    }

    // Detectar tipo: NF-e ou CT-e
    const nfeProc = xmlDoc.nfeProc || xmlDoc.NFe;
    const cteProc = xmlDoc.cteProc || xmlDoc.CTe;
    const nfes = [], ctes = [];
    let tipoDetectado = 'DESCONHECIDO';

    if (nfeProc) {
      tipoDetectado = 'NFE';
      const infNFeList = nfeProc.NFe ? (Array.isArray(nfeProc.NFe) ? nfeProc.NFe : [nfeProc.NFe]) : [nfeProc];
      for (const n of infNFeList) { if (n && n.infNFe) nfes.push(n); }
      // Também pode vir direto como <NFe><infNFe>
      if (nfes.length === 0 && nfeProc.infNFe) nfes.push(nfeProc);
    }
    if (cteProc) {
      tipoDetectado = 'CTE';
      const infCteList = cteProc.CTe ? (Array.isArray(cteProc.CTe) ? cteProc.CTe : [cteProc.CTe]) : [cteProc];
      for (const c of infCteList) { if (c && c.infCte) ctes.push(c); }
      if (ctes.length === 0 && cteProc.infCte) ctes.push(cteProc);
    }

    if (nfes.length === 0 && ctes.length === 0) {
      // Verificar se é um lote
      const enviNFe = xmlDoc.enviNFe;
      const enviCTe = xmlDoc.enviCTe;
      if (enviNFe) {
        tipoDetectado = 'NFE';
        const arr = enviNFe.NFe ? (Array.isArray(enviNFe.NFe) ? enviNFe.NFe : [enviNFe.NFe]) : [];
        for (const n of arr) { if (n && n.infNFe) nfes.push(n); }
      }
      if (enviCTe) {
        tipoDetectado = 'CTE';
        const arr = enviCTe.CTe ? (Array.isArray(enviCTe.CTe) ? enviCTe.CTe : [enviCTe.CTe]) : [];
        for (const c of arr) { if (c && c.infCte) ctes.push(c); }
      }
    }

    if (nfes.length === 0 && ctes.length === 0) {
      return Response.json({
        success: false,
        error: 'Arquivo XML não contém NF-e (<NFe>/<infNFe>) ou CT-e (<CTe>/<infCte>). Verifique se o arquivo está no formato correto.'
      }, { status: 400 });
    }

    // Validar NF-e
    for (let i = 0; i < nfes.length; i++) {
      validarNFe(nfes[i], i + 1, erros, avisos);
      estatisticas.documentos[`NF-e ${i + 1}`] = 1;
    }
    // Validar CT-e
    for (let i = 0; i < ctes.length; i++) {
      validarCTe(ctes[i], i + 1, erros, avisos);
      estatisticas.documentos[`CT-e ${i + 1}`] = 1;
    }

    // Extrair dados estruturados das NF-e
    const documentosExtraidos = [];
    for (let i = 0; i < nfes.length; i++) {
      const dadosExtraidos = extrairDadosNFe(nfes[i], i + 1, erros, avisos);
      if (dadosExtraidos) documentosExtraidos.push(dadosExtraidos);
    }

    estatisticas.totalDocumentos = nfes.length + ctes.length;
    estatisticas.linhasComErro = erros.length;
    estatisticas.linhasComAviso = avisos.length;

    return Response.json({
      success: true,
      nomeArquivo: nomeArquivo || 'documento_fiscal.xml',
      tipoDetectado,
      isValid: erros.length === 0,
      erros,
      avisos,
      estatisticas,
      documentos: documentosExtraidos,
      resumo: {
        totalDocumentos: estatisticas.totalDocumentos,
        totalErros: erros.length,
        totalAvisos: avisos.length,
        nfes: nfes.length,
        ctes: ctes.length
      }
    });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});
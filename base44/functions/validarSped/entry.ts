import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { XMLParser } from 'npm:fast-xml-parser@4.5.1';
import { validarDimeSC } from './dime_sc.ts';
import { validarDetalheContribuicoes, validarCruzadaContribuicoes, corrigirContribuicoes } from './contribuicoes_rules.ts';

// ===================== REGISTROS REINF (XML) =====================
// Validação conforme Guia Prático da EFD-REINF

const EVENTOS_REINF = ['R-1000','R-1070','R-2010','R-2020','R-2030','R-2040','R-2050','R-2060','R-2070','R-2098','R-2099','R-3010','R-5001','R-9000'];
const EVENTOS_PERIODICOS = ['R-2010','R-2020','R-2030','R-2040','R-2050','R-2060','R-2070','R-2098','R-2099'];
const CLASS_TRIB_VALIDAS = ['03','04','05','06','07','08','09','99'];

function parseXMLEventTag(tagName) {
  const m = tagName.match(/^evtR?(\d{4})$/i);
  if (!m) return null;
  const num = m[1];
  if (num === '1000' || num === '1070' || num.startsWith('20') || num.startsWith('30') || num.startsWith('50') || num.startsWith('90')) return `R-${num}`;
  return null;
}

// Helper: verifica campo obrigatório em XML
function chkObrig(obj, campo, idx, reg, erros, parent) {
  if (!obj || obj[campo] === undefined || obj[campo] === null || String(obj[campo]).trim() === '') {
    erros.push({ linha: idx, registro: reg, mensagem: `Evento ${reg}: <${parent ? parent + '/' : ''}${campo}> obrigatório não informado.`, severidade: 'erro' });
  }
}
// Helper: valida enum em XML
function chkEnum(obj, campo, vals, idx, reg, erros, label) {
  if (obj && obj[campo] !== undefined && !vals.map(String).includes(String(obj[campo]))) {
    erros.push({ linha: idx, registro: reg, mensagem: `Evento ${reg}: <${label || campo}> inválido: "${obj[campo]}" (deve ser: ${vals.join(', ')}).`, severidade: 'erro' });
  }
}
// Helper: valida numérico em XML
function chkNum(obj, campo, idx, reg, erros) {
  if (obj && obj[campo] !== undefined && obj[campo] !== null && String(obj[campo]).trim() !== '') {
    if (isNaN(parseFloat(String(obj[campo]).replace(',', '.')))) {
      erros.push({ linha: idx, registro: reg, mensagem: `Evento ${reg}: <${campo}> valor numérico inválido: "${obj[campo]}".`, severidade: 'erro' });
    }
  }
}
// Helper: valida período AAAA-MM
function chkPeriodo(val, idx, reg, erros, campo) {
  if (val && !/^\d{4}-(0[1-9]|1[0-2])$/.test(String(val))) {
    erros.push({ linha: idx, registro: reg, mensagem: `Evento ${reg}: <${campo}> formato inválido: "${val}" (esperado AAAA-MM).`, severidade: 'erro' });
  }
}

function validarReinf(conteudo, nomeArquivo, autoFix) {
  const erros = [];
  const avisos = [];
  const estatisticas = { totalLinhas: 0, blocos: {}, registros: {}, linhasComErro: 0, linhasComAviso: 0 };
  const eventosEncontrados = [];

  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', parseTagValue: true, parseAttributeValue: true, trimValues: true });
  let xmlDoc;
  try { xmlDoc = parser.parse(conteudo); } catch (e) {
    return Response.json({ success: false, error: `Erro ao parsear XML do REINF: ${e.message}` }, { status: 400 });
  }

  const reinfRoot = xmlDoc.Reinf || xmlDoc.reinf;
  if (!reinfRoot) {
    return Response.json({ success: false, error: 'Arquivo XML não possui elemento raiz <Reinf>. Não é um arquivo REINF válido.' }, { status: 400 });
  }

  const coletarEventos = (obj, depth = 0) => {
    if (depth > 10 || !obj || typeof obj !== 'object') return;
    for (const key of Object.keys(obj)) {
      const evento = parseXMLEventTag(key);
      if (evento) eventosEncontrados.push({ tag: key, tipo: evento, dados: obj[key] });
      if (typeof obj[key] === 'object' && obj[key] !== null) coletarEventos(obj[key], depth + 1);
    }
  };

  const lote = reinfRoot.loteEventos || reinfRoot.LoteEventos;
  if (lote) {
    const evs = lote.evento || lote.Evento;
    const arr = Array.isArray(evs) ? evs : [evs];
    for (const ev of arr) { if (ev && typeof ev === 'object') coletarEventos(ev); }
  } else { coletarEventos(reinfRoot); }

  estatisticas.totalLinhas = eventosEncontrados.length;
  if (eventosEncontrados.length === 0) {
    erros.push({ linha: 0, registro: 'XML', mensagem: 'Nenhum evento REINF (evtR1000, evtR2010, etc.) encontrado no arquivo XML.', severidade: 'erro' });
  }

  let idx = 0;
  for (const ev of eventosEncontrados) {
    idx++;
    estatisticas.registros[ev.tipo] = (estatisticas.registros[ev.tipo] || 0) + 1;
    if (!EVENTOS_REINF.includes(ev.tipo)) { avisos.push({ linha: idx, registro: ev.tipo, mensagem: `Evento "${ev.tipo}" não é reconhecido na estrutura REINF vigente.`, severidade: 'aviso' }); continue; }
    const d = ev.dados || {};

    // --- Atributo Id ---
    const idAttr = d['@_id'] || d['@_Id'];
    if (!idAttr) { erros.push({ linha: idx, registro: ev.tipo, mensagem: `Evento ${ev.tipo}: atributo "Id" obrigatório não encontrado.`, severidade: 'erro' }); }
    else if (!/^ID\d{12,}$/.test(String(idAttr))) { avisos.push({ linha: idx, registro: ev.tipo, mensagem: `Evento ${ev.tipo}: atributo "Id" com formato suspeito: "${idAttr}".`, severidade: 'aviso' }); }

    // --- ideEvento ---
    const ie = d.ideEvento;
    if (!ie) { erros.push({ linha: idx, registro: ev.tipo, mensagem: `Evento ${ev.tipo}: <ideEvento> obrigatório não encontrado.`, severidade: 'erro' }); }
    else {
      chkObrig(ie, 'indRetif', idx, ev.tipo, erros);
      chkEnum(ie, 'indRetif', ['1','2'], idx, ev.tipo, erros, 'indRetif (1=Original, 2=Retificadora)');
      if (String(ie.indRetif) === '2' && !ie.nrRecibo) { erros.push({ linha: idx, registro: ev.tipo, mensagem: `Evento ${ev.tipo}: <nrRecibo> é obrigatório quando indRetif=2 (retificadora).`, severidade: 'erro' }); }
      chkObrig(ie, 'tpAmb', idx, ev.tipo, erros);
      chkEnum(ie, 'tpAmb', ['1','2'], idx, ev.tipo, erros, 'tpAmb (1=Produção, 2=Produção Restrita)');
      chkObrig(ie, 'procEmi', idx, ev.tipo, erros);
      chkEnum(ie, 'procEmi', ['1','2'], idx, ev.tipo, erros, 'procEmi (1=App Contribuinte, 2=App Governamental)');
      chkObrig(ie, 'verProc', idx, ev.tipo, erros);
      if (EVENTOS_PERIODICOS.includes(ev.tipo)) {
        chkObrig(ie, 'perApur', idx, ev.tipo, erros);
        if (ie.perApur) {
          const per = String(ie.perApur);
          if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(per) && !(ev.tipo === 'R-2099' && /^\d{4}$/.test(per))) {
            erros.push({ linha: idx, registro: ev.tipo, mensagem: `Evento ${ev.tipo}: <perApur> formato inválido: "${per}". Esperado AAAA-MM${ev.tipo === 'R-2099' ? ' ou AAAA' : ''}.`, severidade: 'erro' });
          }
        }
      }
    }

    // --- ideContri ---
    const ic = d.ideContri;
    if (!ic && ev.tipo !== 'R-9000') { erros.push({ linha: idx, registro: ev.tipo, mensagem: `Evento ${ev.tipo}: <ideContri> obrigatório não encontrado.`, severidade: 'erro' }); }
    else if (ic) {
      chkObrig(ic, 'tpInsc', idx, ev.tipo, erros);
      chkEnum(ic, 'tpInsc', ['1','2'], idx, ev.tipo, erros, 'tpInsc (1=CNPJ, 2=CPF)');
      chkObrig(ic, 'nrInsc', idx, ev.tipo, erros);
      if (ic.nrInsc) {
        const doc = String(ic.nrInsc).replace(/\D/g, '');
        if (String(ic.tpInsc) === '1') {
          if (doc.length !== 14) { erros.push({ linha: idx, registro: ev.tipo, mensagem: `Evento ${ev.tipo}: CNPJ inválido em <nrInsc>: "${ic.nrInsc}" (esperado 14 dígitos, encontrado ${doc.length}).`, severidade: 'erro' }); }
          else if (!validarDigitoCnpj(doc)) { erros.push({ linha: idx, registro: ev.tipo, mensagem: `Evento ${ev.tipo}: CNPJ inválido em <nrInsc>: "${ic.nrInsc}" (dígitos verificadores não conferem).`, severidade: 'erro' }); }
        } else if (String(ic.tpInsc) === '2') {
          if (doc.length !== 11) { erros.push({ linha: idx, registro: ev.tipo, mensagem: `Evento ${ev.tipo}: CPF inválido em <nrInsc>: "${ic.nrInsc}" (esperado 11 dígitos, encontrado ${doc.length}).`, severidade: 'erro' }); }
          else if (!validarDigitoCpf(doc)) { erros.push({ linha: idx, registro: ev.tipo, mensagem: `Evento ${ev.tipo}: CPF inválido em <nrInsc>: "${ic.nrInsc}" (dígitos verificadores não conferem).`, severidade: 'erro' }); }
        }
      }
    }

    // --- Validações específicas por evento ---
    if (ev.tipo === 'R-1000') {
      const info = d.infoContri; chkObrig(d, 'infoContri', idx, 'R-1000', erros);
      if (info) {
        const op = info.inclusao || info.alteracao || info.exclusao;
        if (!op) { erros.push({ linha: idx, registro: 'R-1000', mensagem: 'Evento R-1000: <infoContri> deve conter <inclusao>, <alteracao> ou <exclusao>.', severidade: 'erro' }); }
        if (op) {
          const ip = op.idePeriodo; chkObrig(op, 'idePeriodo', idx, 'R-1000', erros);
          if (ip) { chkObrig(ip, 'iniValid', idx, 'R-1000', erros, 'idePeriodo'); chkPeriodo(ip.iniValid, idx, 'R-1000', erros, 'iniValid'); if (ip.fimValid) chkPeriodo(ip.fimValid, idx, 'R-1000', erros, 'fimValid'); }
          if (info.inclusao || info.alteracao) {
            const cad = op.infoCadastro; chkObrig(op, 'infoCadastro', idx, 'R-1000', erros);
            if (cad) {
              chkObrig(cad, 'classTrib', idx, 'R-1000', erros, 'infoCadastro');
              if (cad.classTrib && !CLASS_TRIB_VALIDAS.includes(String(cad.classTrib))) { erros.push({ linha: idx, registro: 'R-1000', mensagem: `Evento R-1000: <classTrib> inválido: "${cad.classTrib}" (03=Presumido, 04=Real, 05=Real Arbitr, 06=Presumido Arbitr, 07=Simples, 08=Imune, 09=Refis, 99=Não Tributado).`, severidade: 'erro' }); }
              chkObrig(cad, 'indEscrituracao', idx, 'R-1000', erros, 'infoCadastro');
              chkEnum(cad, 'indEscrituracao', ['1','2'], idx, 'R-1000', erros, 'indEscrituracao (1=ECD, 2=Livros Fiscais)');
              chkEnum(cad, 'indDesoneracao', ['0','1','2'], idx, 'R-1000', erros, 'indDesoneracao');
              chkEnum(cad, 'indAcordoIsenMulta', ['0','1'], idx, 'R-1000', erros, 'indAcordoIsenMulta');
              if (['03','04'].includes(String(cad.classTrib))) { chkObrig(cad, 'indSitPJ', idx, 'R-1000', erros, 'infoCadastro'); chkEnum(cad, 'indSitPJ', ['0','1','2','3','4'], idx, 'R-1000', erros, 'indSitPJ (0=Normal, 1=Extinção, 2=Fusão, 3=Cisão, 4=Incorporação)'); }
              const ct = cad.contato;
              if (!ct) { erros.push({ linha: idx, registro: 'R-1000', mensagem: 'Evento R-1000: <contato> obrigatório não encontrado em <infoCadastro>.', severidade: 'erro' }); }
              else { chkObrig(ct, 'email', idx, 'R-1000', erros, 'contato'); chkObrig(ct, 'telefone', idx, 'R-1000', erros, 'contato'); if (ct.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(ct.email))) { erros.push({ linha: idx, registro: 'R-1000', mensagem: `Evento R-1000: <email> inválido: "${ct.email}".`, severidade: 'erro' }); } }
            }
          }
        }
      }
    }

    if (ev.tipo === 'R-1070') {
      const info = d.infoProcesso; chkObrig(d, 'infoProcesso', idx, 'R-1070', erros);
      if (info) {
        const op = info.inclusao || info.alteracao || info.exclusao;
        if (!op) { erros.push({ linha: idx, registro: 'R-1070', mensagem: 'Evento R-1070: <infoProcesso> deve conter <inclusao>, <alteracao> ou <exclusao>.', severidade: 'erro' }); }
        if (op) {
          const ip = op.ideProcesso; chkObrig(op, 'ideProcesso', idx, 'R-1070', erros);
          if (ip) { chkObrig(ip, 'tpProc', idx, 'R-1070', erros, 'ideProcesso'); chkEnum(ip, 'tpProc', ['1','2'], idx, 'R-1070', erros, 'tpProc (1=Administrativo, 2=Judicial)'); chkObrig(ip, 'nrProc', idx, 'R-1070', erros, 'ideProcesso'); chkObrig(ip, 'iniValid', idx, 'R-1070', erros, 'ideProcesso'); chkPeriodo(ip.iniValid, idx, 'R-1070', erros, 'iniValid'); if (ip.fimValid) chkPeriodo(ip.fimValid, idx, 'R-1070', erros, 'fimValid'); }
          if (info.inclusao || info.alteracao) {
            const dp = op.dadosProc; chkObrig(op, 'dadosProc', idx, 'R-1070', erros);
            if (dp) { chkObrig(dp, 'indAutoria', idx, 'R-1070', erros, 'dadosProc'); chkEnum(dp, 'indAutoria', ['1','2'], idx, 'R-1070', erros, 'indAutoria (1=Próprio, 2=Terceiro)'); if (String(ip && ip.tpProc) === '2') { const dj = dp.dadosProcJud; if (!dj) { erros.push({ linha: idx, registro: 'R-1070', mensagem: 'Evento R-1070: <dadosProcJud> obrigatório quando tpProc=2 (Judicial).', severidade: 'erro' }); } else { chkNum(dj, 'vlrCausa', idx, 'R-1070', erros); chkObrig(dj, 'ufVara', idx, 'R-1070', erros, 'dadosProcJud'); chkObrig(dj, 'codMunic', idx, 'R-1070', erros, 'dadosProcJud'); chkObrig(dj, 'ideVara', idx, 'R-1070', erros, 'dadosProcJud'); } } }
          }
        }
      }
    }

    if (ev.tipo === 'R-2010') {
      const it = d.infoTomador; chkObrig(d, 'infoTomador', idx, 'R-2010', erros);
      if (it) { const ie2 = it.ideEstab; chkObrig(it, 'ideEstab', idx, 'R-2010', erros); if (ie2) { const eo = ie2.ideEstabObra; chkObrig(ie2, 'ideEstabObra', idx, 'R-2010', erros); if (eo) { chkObrig(eo, 'tpInscEstab', idx, 'R-2010', erros, 'ideEstabObra'); chkObrig(eo, 'nrInscEstab', idx, 'R-2010', erros, 'ideEstabObra'); chkEnum(eo, 'indObra', ['0','1','2'], idx, 'R-2010', erros, 'indObra'); } const nfs = ie2.nfs; if (!nfs) { avisos.push({ linha: idx, registro: 'R-2010', mensagem: 'Evento R-2010: <nfs> não encontrado em <ideEstab>.', severidade: 'aviso' }); } else { const arr = Array.isArray(nfs) ? nfs : [nfs]; for (const nf of arr) { if (!nf) continue; chkObrig(nf, 'serie', idx, 'R-2010', erros, 'nfs'); chkObrig(nf, 'numDocto', idx, 'R-2010', erros, 'nfs'); chkObrig(nf, 'dtEmissaoNF', idx, 'R-2010', erros, 'nfs'); chkNum(nf, 'vlrBruto', idx, 'R-2010', erros); chkNum(nf, 'vlrBaseRet', idx, 'R-2010', erros); chkNum(nf, 'vlrRetencao', idx, 'R-2010', erros); chkEnum(nf, 'indCPRB', ['0','1'], idx, 'R-2010', erros, 'indCPRB (0=Não, 1=Sim)'); } } } }
    }

    if (ev.tipo === 'R-2020') {
      const ip = d.infoPrestador; chkObrig(d, 'infoPrestador', idx, 'R-2020', erros);
      if (ip) { const ie2 = ip.ideEstabPrest; chkObrig(ip, 'ideEstabPrest', idx, 'R-2020', erros); if (ie2) { const np = ie2.nfsPrem; if (!np) { avisos.push({ linha: idx, registro: 'R-2020', mensagem: 'Evento R-2020: <nfsPrem> não encontrado.', severidade: 'aviso' }); } else { const arr = Array.isArray(np) ? np : [np]; for (const nf of arr) { if (!nf) continue; chkObrig(nf, 'serie', idx, 'R-2020', erros, 'nfsPrem'); chkObrig(nf, 'numDocto', idx, 'R-2020', erros, 'nfsPrem'); chkNum(nf, 'vlrBruto', idx, 'R-2020', erros); chkNum(nf, 'vlrBaseRet', idx, 'R-2020', erros); chkNum(nf, 'vlrRetencao', idx, 'R-2020', erros); } } } }
    }

    if (ev.tipo === 'R-2030') {
      const ir = d.infoRecurso; chkObrig(d, 'infoRecurso', idx, 'R-2030', erros);
      if (ir) { const ie2 = ir.ideEstab; chkObrig(ir, 'ideEstab', idx, 'R-2030', erros); const rp = ie2 && (ie2.recursosRep || ie2.repasse); const arr = rp ? (Array.isArray(rp) ? rp : [rp]) : []; if (arr.length === 0) { avisos.push({ linha: idx, registro: 'R-2030', mensagem: 'Evento R-2030: <recursosRep> não encontrado ou vazio.', severidade: 'aviso' }); } for (const r of arr) { if (!r) continue; chkObrig(r, 'cnpjEstab', idx, 'R-2030', erros, 'recursosRep'); chkNum(r, 'vlrRecurso', idx, 'R-2030', erros); chkNum(r, 'vlrRetencao', idx, 'R-2030', erros); chkNum(r, 'vlrBaseRet', idx, 'R-2030', erros); } }
    }

    if (ev.tipo === 'R-2040') {
      const ic2 = d.infoComProd; chkObrig(d, 'infoComProd', idx, 'R-2040', erros);
      if (ic2) { const ie2 = ic2.ideEstab; chkObrig(ic2, 'ideEstab', idx, 'R-2040', erros); const tc = ie2 && ie2.tipoComerc; const arr = tc ? (Array.isArray(tc) ? tc : [tc]) : []; if (arr.length === 0) { avisos.push({ linha: idx, registro: 'R-2040', mensagem: 'Evento R-2040: <tipoComerc> não encontrado ou vazio.', severidade: 'aviso' }); } for (const t of arr) { if (!t) continue; chkObrig(t, 'indTipCom', idx, 'R-2040', erros, 'tipoComerc'); chkNum(t, 'vlrRecBruta', idx, 'R-2040', erros); chkNum(t, 'vlrRetencao', idx, 'R-2040', erros); chkNum(t, 'vlrBaseRet', idx, 'R-2040', erros); } }
    }

    if (ev.tipo === 'R-2050') {
      const it = d.infoComProdTerceiro; chkObrig(d, 'infoComProdTerceiro', idx, 'R-2050', erros);
      if (it) { const ie2 = it.ideEstab; chkObrig(it, 'ideEstab', idx, 'R-2050', erros); const tc = ie2 && ie2.tipoComerc; const arr = tc ? (Array.isArray(tc) ? tc : [tc]) : []; if (arr.length === 0) { avisos.push({ linha: idx, registro: 'R-2050', mensagem: 'Evento R-2050: <tipoComerc> não encontrado ou vazio.', severidade: 'aviso' }); } for (const t of arr) { if (!t) continue; chkObrig(t, 'indTipCom', idx, 'R-2050', erros, 'tipoComerc'); chkNum(t, 'vlrRecBruta', idx, 'R-2050', erros); chkNum(t, 'vlrRetencao', idx, 'R-2050', erros); } }
    }

    if (ev.tipo === 'R-2060') {
      const icprb = d.infoCPRB; chkObrig(d, 'infoCPRB', idx, 'R-2060', erros);
      if (icprb) { const ie2 = icprb.ideEstab; chkObrig(icprb, 'ideEstab', idx, 'R-2060', erros); if (ie2) { const tc = ie2.tipoCod; const arr = tc ? (Array.isArray(tc) ? tc : [tc]) : []; if (arr.length === 0) { erros.push({ linha: idx, registro: 'R-2060', mensagem: 'Evento R-2060: <tipoCod> obrigatório não encontrado em <ideEstab>.', severidade: 'erro' }); } for (const t of arr) { if (!t) continue; if (t.tipoCod !== undefined) { const v = parseInt(String(t.tipoCod), 10); if (isNaN(v) || v < 0 || v > 14) { erros.push({ linha: idx, registro: 'R-2060', mensagem: `Evento R-2060: <tipoCod> inválido: "${t.tipoCod}" (deve estar entre 0 e 14).`, severidade: 'erro' }); } } chkNum(t, 'vlrRecBrutaTotal', idx, 'R-2060', erros); chkNum(t, 'vlrCPApur', idx, 'R-2060', erros); chkNum(t, 'vlrCPRBApur', idx, 'R-2060', erros); } const ta = ie2.tipoAjustes; if (ta) { const aa = Array.isArray(ta) ? ta : [ta]; for (const a of aa) { if (!a) continue; chkEnum(a, 'tpAjuste', ['0','1'], idx, 'R-2060', erros, 'tpAjuste (0=Redução, 1=Adição)'); chkObrig(a, 'codAjuste', idx, 'R-2060', erros, 'tipoAjustes'); chkNum(a, 'vlrAjuste', idx, 'R-2060', erros); chkObrig(a, 'dtAjuste', idx, 'R-2060', erros, 'tipoAjustes'); } } } }
    }

    if (ev.tipo === 'R-2070') {
      const ipb = d.infoPagtoBenef; chkObrig(d, 'infoPagtoBenef', idx, 'R-2070', erros);
      if (ipb) { const ie2 = ipb.ideEstab; chkObrig(ipb, 'ideEstab', idx, 'R-2070', erros); const ib = ie2 && ie2.ideBenef; if (!ib) { avisos.push({ linha: idx, registro: 'R-2070', mensagem: 'Evento R-2070: <ideBenef> não encontrado.', severidade: 'aviso' }); } const ipe = ib && (ib.idePgtoExt || ib.infoPgtoExt); const arr = ipe ? (Array.isArray(ipe) ? ipe : [ipe]) : []; if (arr.length === 0) { avisos.push({ linha: idx, registro: 'R-2070', mensagem: 'Evento R-2070: <idePgtoExt> não encontrado ou vazio.', severidade: 'aviso' }); } for (const p of arr) { if (!p) continue; chkObrig(p, 'indNatBene', idx, 'R-2070', erros, 'idePgtoExt'); chkObrig(p, 'natRend', idx, 'R-2070', erros, 'idePgtoExt'); chkNum(p, 'vlrPgto', idx, 'R-2070', erros); chkNum(p, 'vlrRet', idx, 'R-2070', erros); } }
    }

    if (ev.tipo === 'R-2098') {
      const ir = d.infoReab; chkObrig(d, 'infoReab', idx, 'R-2098', erros);
      if (ir) { const ic2 = ir.ideContri; chkObrig(ir, 'ideContri', idx, 'R-2098', erros, 'infoReab'); if (ic2) { chkObrig(ic2, 'tpInsc', idx, 'R-2098', erros, 'infoReab/ideContri'); chkObrig(ic2, 'nrInsc', idx, 'R-2098', erros, 'infoReab/ideContri'); } }
    }

    if (ev.tipo === 'R-2099') {
      const inf = d.infoFechamento; chkObrig(d, 'infoFechamento', idx, 'R-2099', erros);
      if (inf) { const ef = inf.evtFech; if (!ef) { erros.push({ linha: idx, registro: 'R-2099', mensagem: 'Evento R-2099: <evtFech> obrigatório não encontrado em <infoFechamento>.', severidade: 'erro' }); } else { chkObrig(ef, 'indExcApuracao', idx, 'R-2099', erros); chkEnum(ef, 'indExcApuracao', ['1','2'], idx, 'R-2099', erros, 'indExcApuracao (1=Sem apuração, 2=Com apuração)'); } }
    }

    if (ev.tipo === 'R-3010') {
      const ir = d.infoRecurso; chkObrig(d, 'infoRecurso', idx, 'R-3010', erros);
      if (ir) { const ie2 = ir.ideEstab; chkObrig(ir, 'ideEstab', idx, 'R-3010', erros); const rp = ie2 && (ie2.recursosRep || ie2.repasseEstab); const arr = rp ? (Array.isArray(rp) ? rp : [rp]) : []; if (arr.length === 0) { avisos.push({ linha: idx, registro: 'R-3010', mensagem: 'Evento R-3010: <recursosRep> não encontrado ou vazio.', severidade: 'aviso' }); } for (const r of arr) { if (!r) continue; chkObrig(r, 'cnpjEstab', idx, 'R-3010', erros, 'recursosRep'); chkNum(r, 'vlrRecurso', idx, 'R-3010', erros); chkNum(r, 'vlrRetencao', idx, 'R-3010', erros); chkNum(r, 'vlrBaseRet', idx, 'R-3010', erros); } }
    }

    if (ev.tipo === 'R-5001') { if (!d.infoBase) { avisos.push({ linha: idx, registro: 'R-5001', mensagem: 'Evento R-5001: <infoBase> não encontrado (consulta de bases e tributos).', severidade: 'aviso' }); } }

    if (ev.tipo === 'R-9000') {
      const ie2 = d.infoExclusao; chkObrig(d, 'infoExclusao', idx, 'R-9000', erros);
      if (ie2) { chkObrig(ie2, 'tpEvento', idx, 'R-9000', erros, 'infoExclusao'); if (ie2.tpEvento && !EVENTOS_REINF.includes(String(ie2.tpEvento))) { erros.push({ linha: idx, registro: 'R-9000', mensagem: `Evento R-9000: <tpEvento> inválido: "${ie2.tpEvento}" (deve ser um evento REINF válido: ${EVENTOS_REINF.join(', ')}).`, severidade: 'erro' }); } chkObrig(ie2, 'nrReciboEvento', idx, 'R-9000', erros, 'infoExclusao'); }
    }
  }

  // --- Validações estruturais ---
  const temPeriodicos = eventosEncontrados.some((e) => ['R-2010','R-2020','R-2030','R-2040','R-2050','R-2060','R-2070'].includes(e.tipo));
  if (temPeriodicos && !eventosEncontrados.some((e) => e.tipo === 'R-2099')) {
    erros.push({ linha: 0, registro: 'R-2099', mensagem: 'Evento de Fechamento (R-2099) é obrigatório quando há eventos periódicos (R-2010 a R-2070).', severidade: 'erro' });
  }
  if (temPeriodicos) {
    let pos2099 = -1;
    for (let i = 0; i < eventosEncontrados.length; i++) { if (eventosEncontrados[i].tipo === 'R-2099') pos2099 = i; }
    if (pos2099 >= 0) {
      for (let i = pos2099 + 1; i < eventosEncontrados.length; i++) {
        if (['R-2010','R-2020','R-2030','R-2040','R-2050','R-2060','R-2070'].includes(eventosEncontrados[i].tipo)) {
          erros.push({ linha: i + 1, registro: eventosEncontrados[i].tipo, mensagem: `Evento ${eventosEncontrados[i].tipo} aparece após o R-2099 (Fechamento). O fechamento deve ser o último evento periódico.`, severidade: 'erro' });
        }
      }
    }
  }

  estatisticas.linhasComErro = erros.length;
  estatisticas.linhasComAviso = avisos.length;
  const resultadoReinf = {
    success: true, nomeArquivo: nomeArquivo || 'arquivo_reinf.xml', tipoDetectado: 'REINF', isValid: erros.length === 0,
    erros, avisos, estatisticas,
    resumo: { totalLinhas: eventosEncontrados.length, totalErros: erros.length, totalAvisos: avisos.length, blocosEncontrados: [...new Set(eventosEncontrados.map((e) => e.tipo.substring(0, 3)))], registrosUnicos: Object.keys(estatisticas.registros).length }
  };
  if (autoFix && (erros.length > 0 || avisos.length > 0)) { resultadoReinf.conteudo_corrigido = corrigirConteudo(conteudo, 'REINF'); }
  return Response.json(resultadoReinf);
}

// ===================== REGISTROS CONHECIDOS POR TIPO =====================

const REG_FISCAL = [
  '0000','0001','0002','0005','0015','0100','0150','0175','0190','0200','0205','0206','0210','0220','0221',
  '0300','0305','0400','0450','0460','0500','0600','0990',
  '1001','1010','1020','1050','1100','1105','1110','1115','1120','1150','1160','1165','1200','1210','1220','1300','1310','1320','1350','1360','1370','1390','1400','1500','1510','1600','1601','1700','1800','1900','1990',
  'B001','B020','B025','B030','B035','B350','B420','B440','B460','B470','B500','B510','B990',
  'C001','C100','C101','C105','C106','C107','C108','C109','C110','C111','C112','C113','C114','C115','C116','C117','C118','C119','C120','C130','C140','C141','C160','C165','C170','C171','C172','C173',
  'C174','C175','C176','C177','C178','C179','C180','C181','C185','C186','C190','C191','C195','C197','C500','C510','C520','C530','C590','C700','C790','C800','C810','C850','C860','C880','C890','C990',
  'D001','D010','D100','D101','D110','D120','D130','D140','D150','D160','D161','D162','D170','D180','D190','D195','D197','D300','D301','D310','D350','D360','D370','D390','D400','D410','D411','D420','D500','D510','D520','D530','D590','D990',
  'E001','E100','E110','E111','E112','E113','E115','E116','E200','E210','E220','E230','E240',
  'E250','E300','E310','E311','E312','E313','E316','E500','E510','E520','E530','E531','E990',
  'G001','G110','G125','G126','G130','G140','G990',
  'H001','H005','H010','H020','H030','H990',
  'K001','K010','K100','K200','K210','K215','K220','K230','K235','K250','K255','K260','K265','K270','K275','K280','K990',
  '9001','9900','9990','9999'
];

const REG_CONTRIBUICOES = [
  // Bloco 0: Abertura, Identificação e Referências
  '0000','0001','0035','0100','0110','0111','0120','0140','0145','0150','0190','0200','0205','0206','0208',
  '0400','0450','0500','0600','0900','0990',
  // Bloco A: Documentos Fiscais – Serviços (ISS)
  'A001','A010','A100','A110','A111','A120','A170','A990',
  // Bloco C: Documentos Fiscais I – Mercadorias (ICMS/IPI)
  'C001','C010','C100','C110','C111','C120','C170','C175','C180','C181','C185','C188','C190','C191','C195','C198','C199',
  'C380','C381','C385','C395','C396','C400','C405','C481','C485','C489','C490','C491','C495','C499',
  'C500','C501','C505','C509','C600','C601','C605','C609','C800','C810','C820','C830','C860','C870','C880','C890','C990',
  // Bloco D: Documentos Fiscais II – Serviços (ICMS)
  'D001','D010','D100','D101','D105','D111','D200','D201','D205','D209','D300','D309','D350','D359',
  'D500','D501','D505','D509','D600','D601','D605','D609','D990',
  // Bloco F: Demais Documentos e Operações
  'F001','F010','F100','F111','F120','F129','F130','F139','F150','F200','F205','F210','F211',
  'F500','F509','F510','F519','F525','F550','F559','F560','F569','F600','F700','F800','F990',
  // Bloco I: Instituições Financeiras e Assemelhadas
  'I001','I010','I100','I199','I200','I299','I300','I399','I990',
  // Bloco M: Apuração da Contribuição (PIS/COFINS)
  'M001','M100','M105','M110','M115','M200','M205','M210','M211','M215','M220','M225','M230',
  'M300','M350','M400','M410','M500','M505','M510','M515','M600','M605','M610','M611','M615',
  'M620','M625','M630','M700','M800','M810','M990',
  // Bloco P: Apuração da Contribuição Previdenciária sobre a Receita Bruta
  'P001','P010','P100','P110','P199','P200','P210','P990',
  // Bloco 1: Complemento da Escrituração – Controle de Saldos
  '1001','1010','1011','1020','1050','1100','1101','1102','1200','1210','1220','1300',
  '1500','1501','1502','1600','1610','1620','1700','1800','1809','1900','1990',
  // Bloco 9: Controle e Encerramento
  '9001','9900','9990','9999'
];

const REG_ECD = [
  // Bloco 0: Abertura, Identificação e Referências
  '0000','0001','0007','0020','0100','0150','0175','0180','0200','0205','0990',
  // Bloco I: Lançamentos Contábeis
  'I001','I010','I012','I015','I020','I030','I050','I051','I052','I053','I075','I100','I150','I151','I155',
  'I157','I200','I250','I300','I310','I350','I355','I500','I510','I550','I555','I990',
  // Bloco J: Demonstrações Contábeis
  'J001','J005','J100','J150','J200','J210','J215','J300','J310','J400',
  'J410','J420','J430','J435','J450','J460','J470','J480','J500','J510','J520','J530','J532','J800','J801',
  'J900','J930','J932','J935','J990',
  // Bloco K: Conglomerados Econômicos
  'K001','K030','K100','K110','K115','K200','K210','K220','K230','K240','K250','K260','K270','K275','K280','K990',
  // Bloco 9: Controle e Encerramento
  '9001','9900','9990','9999'
];

const REG_ECF = [
  // Bloco 0: Abertura, Identificação e Referências
  '0000','0001','0010','0020','0021','0030','0035','0930','0990',
  // Bloco C: Informações Recuperadas da ECD (Referencial)
  'C001','C040','C050','C051','C053','C100','C150','C155','C157','C350','C355','C990',
  // Bloco E: Saldos Recuperados da ECF Anterior
  'E001','E010','E015','E020','E030','E155','E355','E990',
  // Bloco J: Plano de Contas do Contribuinte
  'J001','J050','J051','J053','J100','J990',
  // Bloco K: Saldos Contábeis (Depois do Encerramento do Resultado)
  'K001','K030','K155','K156','K355','K356','K915','K935','K990',
  // Bloco L: Lucro Líquido - Lucro Real (Balanço, DRE)
  'L001','L010','L030','L100','L200','L210','L300','L990',
  // Bloco M: e-Lalur e e-Lacs
  'M001','M010','M030','M100','M200','M300','M350','M400','M410','M500','M510','M550','M600','M700','M800','M810','M990',
  // Bloco N: e-Lalur/e-Lacs Parte B (Controle de Saldos)
  'N001','N010','N030','N600','N610','N630','N650','N660','N670','N680','N990',
  // Bloco P: Lucro Presumido (Balanço, DRE)
  'P001','P030','P100','P200','P990',
  // Bloco Q: Livro Caixa (Lucro Presumido sem ECD)
  'Q001','Q010','Q100','Q200','Q990',
  // Bloco T: Lucro Arbitrado (Balanço, DRE)
  'T001','T010','T020','T030','T990',
  // Bloco U: Imunes e Isentas
  'U001','U010','U030','U040','U080','U081','U100','U150','U180','U990',
  // Bloco V: Derex
  'V001','V010','V020','V030','V990',
  // Bloco W: Declaração País-a-País (CBC Report)
  'W001','W100','W200','W300','W990',
  // Bloco X: Informações Econômicas
  'X001','X280','X293','X312','X320','X330','X340','X350','X351','X352','X353','X354','X355','X356','X390',
  'X400','X410','X420','X430','X450','X460','X470','X480','X490','X500','X510','X520','X530','X550','X560',
  'X590','X600','X700','X790','X800','X990',
  // Bloco Y: Informações Gerais
  'Y001','Y010','Y020','Y030','Y040','Y050','Y530','Y540','Y550','Y560','Y570','Y580','Y590','Y600','Y612',
  'Y620','Y630','Y640','Y650','Y660','Y665','Y670','Y680','Y690','Y720','Y730','Y750','Y760','Y800','Y820','Y990',
  // Bloco 9: Controle e Encerramento
  '9001','9900','9990','9999'
];

// Mapeia tipo detectado → conjunto de registros válidos
const REGISTROS_POR_TIPO = {
  FISCAL: REG_FISCAL,
  CONTRIBUICOES: REG_CONTRIBUICOES,
  ECD: REG_ECD,
  ECF: REG_ECF
};

// Sequência oficial de blocos por tipo de SPED (EFD-ICMS/IPI, Contribuições, ECD, ECF)
const BLOCOS_POR_TIPO = {
  FISCAL: ['0','B','C','D','E','G','H','K','1','9'],
  CONTRIBUICOES: ['0','A','C','D','F','I','M','P','1','9'],
  ECD: ['0','I','J','K','9'],
  ECF: ['0','C','E','J','K','L','M','N','P','Q','T','U','V','W','X','Y','9']
};

// ===================== VALIDADORES DE REGISTRO =====================

function validarValorNumerico(campos, inicio, fim, registro, linhaAtual, erros) {
  for (let i = inicio; i < Math.min(campos.length, fim); i++) {
    if (campos[i] && campos[i].length > 0) {
      const valor = campos[i].replace(',', '.');
      if (isNaN(parseFloat(valor))) {
        erros.push({
          linha: linhaAtual,
          registro,
          mensagem: `Valor numérico inválido no campo ${i + 1}: "${campos[i]}".`,
          severidade: 'erro'
        });
      }
    }
  }
}

function validarData8(dig, registro, linhaAtual, erros) {
  if (dig && !/^\d{8}$/.test(dig)) {
    erros.push({
      linha: linhaAtual,
      registro,
      mensagem: `Data inválida: "${dig}" (formato esperado: DDMMAAAA).`,
      severidade: 'erro'
    });
  }
}

function validarDigitoCpf(cpf) {
  if (!/^(\d)\1{10}$/.test(cpf)) {
    let soma = 0;
    for (let i = 0; i < 9; i++) soma += parseInt(cpf[i], 10) * (10 - i);
    let dv1 = (soma * 10) % 11;
    if (dv1 === 10) dv1 = 0;
    if (dv1 !== parseInt(cpf[9], 10)) return false;
    soma = 0;
    for (let i = 0; i < 10; i++) soma += parseInt(cpf[i], 10) * (11 - i);
    let dv2 = (soma * 10) % 11;
    if (dv2 === 10) dv2 = 0;
    if (dv2 !== parseInt(cpf[10], 10)) return false;
  }
  return true;
}

function validarDigitoCnpj(cnpj) {
  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let soma = 0;
  for (let i = 0; i < 12; i++) soma += parseInt(cnpj[i], 10) * pesos1[i];
  let dv1 = soma % 11;
  dv1 = dv1 < 2 ? 0 : 11 - dv1;
  if (dv1 !== parseInt(cnpj[12], 10)) return false;
  soma = 0;
  for (let i = 0; i < 13; i++) soma += parseInt(cnpj[i], 10) * pesos2[i];
  let dv2 = soma % 11;
  dv2 = dv2 < 2 ? 0 : 11 - dv2;
  if (dv2 !== parseInt(cnpj[13], 10)) return false;
  return true;
}

function validarCpfCnpj(docRaw, registro, linhaAtual, erros, campo) {
  if (docRaw && docRaw.length > 0) {
    const doc = docRaw.replace(/\D/g, '');
    if (doc.length !== 11 && doc.length !== 14) {
      erros.push({
        linha: linhaAtual,
        registro,
        mensagem: `CPF/CNPJ inválido${campo ? ` no campo ${campo}` : ''}: "${docRaw}" (esperado 11 dígitos para CPF ou 14 para CNPJ, encontrado ${doc.length}).`,
        severidade: 'erro'
      });
    } else if (doc.length === 11) {
      if (!validarDigitoCpf(doc)) {
        erros.push({
          linha: linhaAtual,
          registro,
          mensagem: `CPF inválido${campo ? ` no campo ${campo}` : ''}: "${docRaw}" (dígitos verificadores não conferem).`,
          severidade: 'erro'
        });
      }
    } else if (doc.length === 14) {
      if (!validarDigitoCnpj(doc)) {
        erros.push({
          linha: linhaAtual,
          registro,
          mensagem: `CNPJ inválido${campo ? ` no campo ${campo}` : ''}: "${docRaw}" (dígitos verificadores não conferem).`,
          severidade: 'erro'
        });
      }
    }
  }
}

// ===================== VALIDAÇÃO ECF (data-driven) =====================
// Tipos: D=Data8, E=enum(vals[],nome), C=CpfCnpj(label), F=CPF11(label), R=regex(padrao,nome), X=DC(nome), N=num(ini,fim)
const ECF_RULES = {
  '0000': { min: 11, c: [[1,'E',['LECF'],'NOME_ESC'],[3,'C','CNPJ'],[5,'E',['0','1','2','3','4','5','6','7'],'IND_SIT_INI_PER'],[6,'E',['0','1','2','3','4','5','6','7','8','9'],'SIT_ESPECIAL'],[9,'D'],[10,'D'],[11,'E',['S','N','F'],'RETIFICADORA'],[13,'E',['0','1','2'],'TIP_ECF']] },
  '0010': { min: 4, c: [[1,'E',['T','A'],'FORMA_APUR'],[2,'E',['1','2','3','4','5','6'],'FORMA_TRIB']] },
  '0020': { min: 3, c: [[1,'E',['1','2','3','4','5'],'IND_QUALIF_PJ']] },
  '0930': { min: 5, c: [[2,'F','CPF do signatário'],[4,'E',['1','2','3','4','5','6','7','8','9'],'COD_ASSIN']] },
  'C050': { min: 8, c: [[1,'D'],[2,'R','^0[1-9]$|^10$','COD_NAT'],[3,'E',['S','A'],'IND_CTA']] },
  'C155': { min: 7, c: [[6,'X','IND_DC_INI'],[10,'X','IND_DC_FIN'],[5,'N',5,6],[7,'N',7,10]] },
  'E020': { min: 3, c: [[1,'E',['R','C'],'IND_GRP_SLD'],[2,'D']] },
  'E155': { min: 7, c: [[6,'X','IND_DC_INI'],[10,'X','IND_DC_FIN'],[5,'N',5,6],[7,'N',7,10]] },
  'E355': { min: 4, c: [[3,'X','IND_DC'],[2,'N',2,3]] },
  'J050': { min: 8, c: [[1,'D'],[2,'R','^0[1-9]$|^10$','COD_NAT'],[3,'E',['S','A'],'IND_CTA']] },
  'K030': { min: 4, c: [[1,'D'],[2,'D'],[3,'R','^A(0[0]|0[1-9]|1[0-2])$|^T0[1-4]$','PER_APUR']] },
  'K155': { min: 5, c: [[4,'X','IND_DC'],[3,'N',3,4]] },
  'K355': { min: 4, c: [[3,'X','IND_DC'],[2,'N',2,3]] },
  'L030': { min: 4, c: [[1,'D'],[2,'D'],[3,'R','^A(0[0]|0[1-9]|1[0-2])$|^T0[1-4]$','PER_APUR']] },
  'L100': { min: 11, c: [[3,'E',['S','A'],'TIPO'],[8,'X','IND_VAL_CTA_REF_INI'],[10,'X','IND_VAL_CTA_REF_FIN'],[7,'N',7,8],[9,'N',9,10]] },
  'L200': { min: 2, c: [[1,'E',['1','2','3','4','5','6','7'],'IND_AVAL_ESTOQ']] },
  'M010': { min: 9, c: [[3,'D'],[5,'D'],[6,'E',['I','C'],'COD_TRIBUTO'],[8,'X','IND_VL_SALDO_INI'],[7,'N',7,8]] },
  'M030': { min: 4, c: [[1,'D'],[2,'D'],[3,'R','^A(0[0]|0[1-9]|1[0-2])$|^T0[1-4]$','PER_APUR']] },
  'M300': { min: 4, c: [[3,'X','IND_VAL_LALUR'],[2,'N',2,3]] },
  'M350': { min: 4, c: [[3,'X','IND_VAL_LACS'],[2,'N',2,3]] },
  'M410': { min: 4, c: [[3,'X','IND_DC'],[2,'N',2,3]] },
  'M500': { min: 4, c: [[3,'X','IND_DC'],[2,'N',2,3]] },
  'P030': { min: 4, c: [[1,'D'],[2,'D'],[3,'R','^A(0[0]|0[1-9]|1[0-2])$|^T0[1-4]$','PER_APUR']] },
  'P100': { min: 11, c: [[3,'E',['S','A'],'TIPO'],[8,'X','IND_VAL_CTA_REF_INI'],[10,'X','IND_VAL_CTA_REF_FIN'],[7,'N',7,8],[9,'N',9,10]] },
  'P200': { min: 4, c: [[1,'D'],[2,'D'],[3,'R','^A(0[0]|0[1-9]|1[0-2])$|^T0[1-4]$','PER_APUR']] },
  'Q100': { min: 6, c: [[1,'D'],[5,'X','IND_SLD_FIN'],[2,'N',2,5]] },
  'T020': { min: 2, c: [[1,'E',['1','2','3','4','5','6','7'],'IND_AVAL_ESTOQ']] },
  'T030': { min: 4, c: [[1,'D'],[2,'D'],[3,'R','^A(0[0]|0[1-9]|1[0-2])$|^T0[1-4]$','PER_APUR']] },
  'U030': { min: 2, c: [[1,'E',['1','2','3'],'IND_FORMA_APUR']] },
  'U100': { min: 5, c: [[4,'X','IND_DC'],[3,'N',3,4]] },
  'U150': { min: 5, c: [[4,'X','IND_DC'],[3,'N',3,4]] },
  'U180': { min: 5, c: [[4,'X','IND_DC'],[3,'N',3,4]] },
  'Y612': { min: 4, c: [[3,'N',3,4]] },
  'Y620': { min: 6, c: [[4,'X','IND_VAL_LUCRO'],[3,'N',3,4]] },
  'Y650': { min: 4, c: [[3,'N',3,4]] },
  'Y672': { min: 4, c: [[3,'N',3,4]] }
};

function validarEcfRegistro(reg, campos, linhaAtual, erros, avisos) {
  const rule = ECF_RULES[reg];
  if (!rule) return;
  if (campos.length < rule.min) {
    avisos.push({ linha: linhaAtual, registro: reg, mensagem: `Registro ${reg} incompleto: esperado mínimo de ${rule.min} campos, encontrado ${campos.length}.`, severidade: 'aviso' });
  }
  if (!rule.c) return;
  for (const chk of rule.c) {
    const [idx, type] = chk;
    const val = campos[idx];
    if (!val && type !== 'N') continue;
    if (type === 'D') { validarData8(val, reg, linhaAtual, erros); }
    else if (type === 'E') {
      const vals = chk[2]; const name = chk[3] || reg;
      if (!vals.includes(val)) { erros.push({ linha: linhaAtual, registro: reg, mensagem: `${name} inválido: "${val}" (deve ser um de: ${vals.join(', ')}).`, severidade: 'erro' }); }
    }
    else if (type === 'C') { validarCpfCnpj(val, reg, linhaAtual, erros, chk[2] || 'CPF/CNPJ'); }
    else if (type === 'F') {
      const cpf = val.replace(/\D/g, '');
      if (cpf.length !== 11) { erros.push({ linha: linhaAtual, registro: reg, mensagem: `${chk[2] || 'CPF'} inválido: "${val}" (esperado 11 dígitos, encontrado ${cpf.length}).`, severidade: 'erro' }); }
    }
    else if (type === 'R') {
      if (!new RegExp(chk[2]).test(val)) { erros.push({ linha: linhaAtual, registro: reg, mensagem: `${chk[3] || reg} inválido: "${val}".`, severidade: 'erro' }); }
    }
    else if (type === 'X') {
      if (!['D','C'].includes(val)) { erros.push({ linha: linhaAtual, registro: reg, mensagem: `${chk[2] || 'IND_DC'} inválido: "${val}" (deve ser D=Devedor ou C=Credor).`, severidade: 'erro' }); }
    }
    else if (type === 'N') { validarValorNumerico(campos, chk[2], chk[3], reg, linhaAtual, erros); }
  }
}

// validarDimeSC is imported from ./dime_sc.ts (fixed-width layout per Anexo II Portaria SEF SC)

// ===================== CORREÇÃO AUTOMÁTICA =====================

function corrigirConteudo(conteudo, tipoDetectado) {
  if (tipoDetectado === 'REINF') {
    // Add missing indRetif and tpAmb in ideEvento blocks
    return conteudo.replace(/<ideEvento(\s[^>]*)?>([\s\S]*?)<\/ideEvento>/g, (match, attrs, inner) => {
      let fixed = inner;
      if (!/<indRetif>/.test(fixed)) fixed = '<indRetif>1</indRetif>' + fixed;
      if (!/<tpAmb>/.test(fixed)) fixed = fixed + '<tpAmb>2</tpAmb>';
      return '<ideEvento' + (attrs || '') + '>' + fixed + '</ideEvento>';
    });
  }

  // Pipe-delimited (SPED and DIME-SC)
  let linhas = conteudo.split(/\r?\n/).filter(l => l.trim().length > 0);

  // Fix line formatting - ensure each line starts and ends with |
  linhas = linhas.map(linha => {
    let c = linha.trim();
    if (!c.startsWith('|')) c = '|' + c;
    if (!c.endsWith('|')) c = c + '|';
    return c;
  });

  // Field-level fixes for SPED Contribuições (PVA rules)
  if (tipoDetectado === 'CONTRIBUICOES') {
    linhas = corrigirContribuicoes(linhas);
  }

  // Collect record counts
  const registros = {};
  for (const linha of linhas) {
    const campos = linha.split('|').filter(c => c !== '');
    if (campos.length === 0) continue;
    registros[campos[0]] = (registros[campos[0]] || 0) + 1;
  }

  // SPED: rebuild 9900 totalizers and fix 9999 counter
  const sem9900 = linhas.filter(linha => {
    const campos = linha.split('|').filter(c => c !== '');
    return campos[0] !== '9900';
  });

  const novas9900 = [];
  for (const [reg, qtd] of Object.entries(registros)) {
    if (['9900', '9999', '9001', '9990'].includes(reg)) continue;
    novas9900.push('|9900|' + reg + '|' + qtd + '|');
  }
  const total9900Entries = novas9900.length + 2;
  novas9900.push('|9900|9900|' + total9900Entries + '|');
  novas9900.push('|9900|9999|1|');

  const novoTotal = sem9900.length + novas9900.length;

  // Ordem correta do bloco 9: |9001| → |9900|...| → |9990| → |9999|
  // Os registros 9900 devem vir ANTES do 9990 (encerramento do bloco 9)
  const resultado = [];
  for (const linha of sem9900) {
    const campos = linha.split('|').filter(c => c !== '');
    if (campos[0] === '9990') {
      // Insere os registros 9900 antes do 9990
      resultado.push.apply(resultado, novas9900);
      // Atualiza a quantidade de linhas do bloco 9 (9001 + 9900s + 9990)
      campos[1] = String(novas9900.length + 2);
      resultado.push('|' + campos.join('|') + '|');
    } else if (campos[0] === '9999') {
      campos[1] = String(novoTotal);
      resultado.push('|' + campos.join('|') + '|');
    } else {
      resultado.push(linha);
    }
  }
  // PVA exige CRLF (Windows) e a última linha também deve terminar com terminador
  return resultado.join('\r\n') + '\r\n';
}

// ===================== FUNÇÃO PRINCIPAL =====================

// Retorna a posição canônica do bloco na sequência oficial do SPED:
// 0 → blocos alfabéticos (A-Z) → 1 → 9
// Isso garante que "1" venha após todos os blocos alfabéticos (ex: P vem antes de 1)
function blocoOrdem(bloco) {
  if (bloco === '0') return 0;
  if (bloco === '9') return 99;
  if (bloco === '1') return 50;
  if (/[A-Z]/.test(bloco)) return bloco.charCodeAt(0) - 54; // A=11, Z=36
  return 50;
}

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

    const linhas = conteudo.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (linhas.length === 0) {
      return Response.json({ success: false, error: 'Arquivo vazio ou sem linhas válidas.' }, { status: 400 });
    }

    // --- Detecção de REINF (formato XML) ---
    const conteudoTrim = conteudo.trim();
    if (conteudoTrim.startsWith('<?xml') || conteudoTrim.startsWith('<Reinf') || conteudoTrim.startsWith('<reinf')) {
      return validarReinf(conteudo, nomeArquivo, body.autoFix);
    }

    // --- Detecção de DIME-SC (formato fixed-width, Anexo II - Portaria SEF SC) ---
    // DIME-SC: arquivo de posição fixa, começa com "20" (Contabilista) ou "21" (Início Declaração)
    // e NÃO contém pipes (|)
    const primeirosTipos = linhas[0].substring(0, 2);
    const temPipes = linhas[0].includes('|');
    if (!temPipes && (primeirosTipos === '20' || primeirosTipos === '21')) {
      return validarDimeSC(linhas, nomeArquivo, body.autoFix, conteudo);
    }

    const erros = [];
    const avisos = [];
    const estatisticas = {
      totalLinhas: linhas.length,
      blocos: {},
      registros: {},
      linhasComErro: 0,
      linhasComAviso: 0
    };

    // --- 1. Verificar abertura e encerramento do arquivo ---
    const camposPrimeira = linhas[0].split('|').filter((c) => c !== '');
    if (camposPrimeira[0] !== '0000') {
      erros.push({
        linha: 1,
        registro: camposPrimeira[0] || '?',
        mensagem: 'O arquivo deve começar com o registro |0000| (Abertura do arquivo digital).',
        severidade: 'erro'
      });
    }

    const camposUltima = linhas[linhas.length - 1].split('|').filter((c) => c !== '');
    if (camposUltima[0] !== '9999') {
      erros.push({
        linha: linhas.length,
        registro: camposUltima[0] || '?',
        mensagem: 'O arquivo deve terminar com o registro |9999| (Encerramento do arquivo digital).',
        severidade: 'erro'
      });
    }

    // --- 1a. Verificar unicidade de 0000 e 9999 ---
    const count0000 = linhas.filter((l) => l.split('|').filter((c) => c !== '')[0] === '0000').length;
    const count9999 = linhas.filter((l) => l.split('|').filter((c) => c !== '')[0] === '9999').length;
    if (count0000 > 1) {
      erros.push({
        linha: 0, registro: '0000',
        mensagem: `Existe mais de um registro |0000| no arquivo (${count0000} ocorrências). Deve haver exatamente um.`,
        severidade: 'erro'
      });
    }
    if (count9999 > 1) {
      erros.push({
        linha: 0, registro: '9999',
        mensagem: `Existe mais de um registro |9999| no arquivo (${count9999} ocorrências). Deve haver exatamente um.`,
        severidade: 'erro'
      });
    }

    // --- 2. Primeira passada: coletar estatísticas e detectar tipo ---
    let linhaAtual = 0;
    let blocoAnterior = '';
    let entrouBloco9 = false;
    const registros9900 = [];
    for (const linha of linhas) {
      linhaAtual++;
      const campos = linha.split('|').filter((c) => c !== '');
      if (campos.length === 0) continue;
      const registro = campos[0];
      const bloco = registro.charAt(0);

      estatisticas.blocos[bloco] = (estatisticas.blocos[bloco] || 0) + 1;
      estatisticas.registros[registro] = (estatisticas.registros[registro] || 0) + 1;

      // Validar estrutura básica da linha
      if (!linha.startsWith('|') || !linha.endsWith('|')) {
        erros.push({
          linha: linhaAtual,
          registro,
          mensagem: 'Linha mal formatada: deve iniciar e terminar com o caractere | (pipe).',
          severidade: 'erro'
        });
      }

      // Validar tamanho máximo da linha (Guia Prático SPED: 4500 caracteres)
      if (linha.length > 4500) {
        erros.push({
          linha: linhaAtual,
          registro,
          mensagem: `Linha excede o limite máximo de 4500 caracteres estabelecido pelo Guia Prático do SPED (encontrados ${linha.length} caracteres).`,
          severidade: 'erro'
        });
      }

      // Validar ordenação de blocos (sequência oficial do SPED: 0 → A-Z → 1 → 9)
      if (entrouBloco9 && bloco !== '9') {
        erros.push({
          linha: linhaAtual,
          registro,
          mensagem: `Registro "${registro}" do bloco "${bloco}" aparece após o início do bloco 9. O bloco 9 deve ser o último do arquivo.`,
          severidade: 'erro'
        });
      }
      if (bloco === '9') {
        entrouBloco9 = true;
      } else if (!entrouBloco9 && blocoAnterior && blocoOrdem(bloco) < blocoOrdem(blocoAnterior)) {
        erros.push({
          linha: linhaAtual,
          registro,
          mensagem: `Bloco "${bloco}" aparece após o bloco "${blocoAnterior}". Os blocos devem seguir a sequência oficial do SPED (0 → A-Z → 1 → 9).`,
          severidade: 'erro'
        });
      }
      if (!entrouBloco9 && (!blocoAnterior || blocoOrdem(bloco) > blocoOrdem(blocoAnterior))) {
        blocoAnterior = bloco;
      }

      // Coletar registros 9900 para validação cruzada
      if (registro === '9900') {
        registros9900.push({ registroDeclarado: campos[1], qtdDeclarada: parseInt(campos[2], 10) || 0 });
      }

      // Validar contador do registro 9999
      if (registro === '9999') {
        const totalDeclarado = parseInt(campos[1], 10);
        if (!isNaN(totalDeclarado) && totalDeclarado !== linhas.length) {
          erros.push({
            linha: linhaAtual,
            registro: '9999',
            mensagem: `Contador de registros no registro 9999 (${totalDeclarado}) não confere com o total de linhas processadas (${linhas.length}).`,
            severidade: 'erro'
          });
        }
      }
    }

    // --- 3. Detectar tipo de SPED ---
    // ECF deve ser verificado ANTES de ECD, pois ambos podem ter bloco J (J050/J100)
    // ECF: registros L100, M010, M030, M300, P100, P200, T020, U100, U150, Y612, 0010
    // ECD: registros I030, I050, I200, I250, J900 (bloco I é exclusivo da ECD)
    let tipoDetectado = 'FISCAL';
    if (estatisticas.registros['L100'] || estatisticas.registros['M010'] || estatisticas.registros['M030'] || estatisticas.registros['M300'] ||
        estatisticas.registros['P100'] || estatisticas.registros['P200'] || estatisticas.registros['T020'] ||
        estatisticas.registros['U100'] || estatisticas.registros['U150'] || estatisticas.registros['Y612'] || estatisticas.registros['0010']) {
      tipoDetectado = 'ECF';
    } else if (estatisticas.registros['I030'] || estatisticas.registros['I050'] || estatisticas.registros['I200'] || estatisticas.registros['I250'] || estatisticas.registros['J900']) {
      tipoDetectado = 'ECD';
    } else {
      const temBlocoA = !!estatisticas.blocos['A'];
      const temBlocoF = !!estatisticas.blocos['F'];
      const temBlocoM = !!estatisticas.registros['M001'] || !!estatisticas.registros['M200'];
      const temBlocoP = !!estatisticas.blocos['P'];
      const temBlocoI = !!estatisticas.blocos['I'];
      const tem0110 = !!estatisticas.registros['0110'];
      if (estatisticas.registros['M200'] || estatisticas.registros['M600'] || estatisticas.registros['F100'] || estatisticas.registros['A100'] ||
          temBlocoA || temBlocoF || temBlocoM || temBlocoP || temBlocoI || tem0110) {
        tipoDetectado = 'CONTRIBUICOES';
      }
    }

    const registrosValidos = REGISTROS_POR_TIPO[tipoDetectado] || REG_FISCAL;

    // --- 3b. Extrair CNPJ do registro 0000 e verificar/cadastrar cliente automaticamente ---
    const campos0000 = linhas[0].split('|').filter((c) => c !== '');
    let cnpjArquivo = '';
    let razaoSocialArquivo = '';
    if (tipoDetectado === 'ECD' || tipoDetectado === 'ECF') {
      cnpjArquivo = (campos0000[5] || '').replace(/\D/g, '');
      razaoSocialArquivo = campos0000[4] || '';
    } else {
      cnpjArquivo = (campos0000[6] || '').replace(/\D/g, '');
      razaoSocialArquivo = campos0000[5] || '';
    }

    let clienteInfo = null;
    if (cnpjArquivo.length === 14) {
      try {
        const clientesExistentes = await base44.asServiceRole.entities.ClienteSped.filter({ cnpj: cnpjArquivo });
        if (clientesExistentes && clientesExistentes.length > 0) {
          clienteInfo = { ...clientesExistentes[0], auto_cadastrado: false };
        } else {
          // Buscar dados na Receita Federal via BrasilAPI
          const apiResp = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjArquivo}`, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            signal: AbortSignal.timeout(10000)
          });
          if (apiResp.ok) {
            const dadosReceita = await apiResp.json();
            const isSimples = dadosReceita.opcao_pelo_simples && !dadosReceita.opcao_pelo_simples.data_exclusao;
            const ie = dadosReceita.inscricoes_estaduais && Array.isArray(dadosReceita.inscricoes_estaduais) && dadosReceita.inscricoes_estaduais.length > 0
              ? (dadosReceita.inscricoes_estaduais[0].inscricao_estadual || '')
              : '';
            const novoCliente = await base44.asServiceRole.entities.ClienteSped.create({
              razao_social: dadosReceita.razao_social || razaoSocialArquivo || '',
              cnpj: cnpjArquivo,
              ie: ie || '',
              uf: dadosReceita.uf || '',
              municipio: dadosReceita.codigo_municipio || '',
              regime: isSimples ? 'SIMPLES' : 'NORMAL',
              perfil: 'PRESUMIDO'
            });
            clienteInfo = { ...novoCliente, auto_cadastrado: true };
          }
        }
      } catch (e) {
        // Falha no cadastro do cliente não é crítica para a validação
      }
    }

    // --- 3a. Validar blocos válidos e sequência para o tipo detectado ---
    const blocosEsperados = BLOCOS_POR_TIPO[tipoDetectado] || BLOCOS_POR_TIPO.FISCAL;
    const blocosEncontradosLista = Object.keys(estatisticas.blocos);
    for (const bloco of blocosEncontradosLista) {
      if (!blocosEsperados.includes(bloco)) {
        erros.push({
          linha: 0,
          registro: bloco,
          mensagem: `Bloco "${bloco}" não é válido para SPED ${tipoDetectado}. Blocos válidos: ${blocosEsperados.join(' → ')}.`,
          severidade: 'erro'
        });
      }
    }

    // --- 4. Segunda passada: validações específicas por registro ---
    linhaAtual = 0;
    for (const linha of linhas) {
      linhaAtual++;
      const campos = linha.split('|').filter((c) => c !== '');
      if (campos.length === 0) continue;
      const registro = campos[0];

      // === Registros comuns a todos os tipos ===

      if (registro === '0000') {
        if (campos.length < 10) {
          avisos.push({
            linha: linhaAtual, registro: '0000',
            mensagem: `Registro 0000 incompleto: esperado mínimo de 10 campos, encontrado ${campos.length}.`,
            severidade: 'aviso'
          });
        }
        // Posições de CNPJ e datas variam conforme o tipo de SPED
        if (tipoDetectado === 'ECD') {
          // |0000|LECD|DT_INI|DT_FIN|NOME|CNPJ|UF|...  → DT_INI=idx2, DT_FIN=idx3, CNPJ=idx5
          validarCpfCnpj(campos[5], '0000', linhaAtual, erros, 'CPF/CNPJ');
          validarData8(campos[2], '0000', linhaAtual, erros);
          validarData8(campos[3], '0000', linhaAtual, erros);
        } else if (tipoDetectado === 'ECF') {
          // |0000|COD_SIT|DT_INI|DT_FIN|NOME|CNPJ|UF|...  → DT_INI=idx2, DT_FIN=idx3, CNPJ=idx5
          validarCpfCnpj(campos[5], '0000', linhaAtual, erros, 'CPF/CNPJ');
          validarData8(campos[2], '0000', linhaAtual, erros);
          validarData8(campos[3], '0000', linhaAtual, erros);
        } else {
          // Fiscal / Contribuições: |0000|COD_VER|COD_FIN|DT_INI|DT_FIN|NOME|CNPJ|...  → DT_INI=idx3, DT_FIN=idx4, CNPJ=idx6
          validarCpfCnpj(campos[6], '0000', linhaAtual, erros, 'CPF/CNPJ');
          validarData8(campos[3], '0000', linhaAtual, erros);
          validarData8(campos[4], '0000', linhaAtual, erros);
        }
      }

      if (registro === '0150') {
        if (campos.length < 6) {
          avisos.push({
            linha: linhaAtual, registro: '0150',
            mensagem: `Registro 0150 incompleto: esperado mínimo de 6 campos, encontrado ${campos.length}.`,
            severidade: 'aviso'
          });
        }
        validarCpfCnpj(campos[4], '0150', linhaAtual, erros, 'CPF/CNPJ');
      }

      if (registro === '0200') {
        if (campos.length < 5) {
          avisos.push({
            linha: linhaAtual, registro: '0200',
            mensagem: `Registro 0200 incompleto: esperado mínimo de 5 campos, encontrado ${campos.length}.`,
            severidade: 'aviso'
          });
        }
      }

      // === SPED FISCAL e CONTRIBUIÇÕES: C100 / C170 ===

      if (registro === 'C100' && (tipoDetectado === 'FISCAL' || tipoDetectado === 'CONTRIBUICOES')) {
        // C100 possui campos opcionais vazios — split SEM filtro para preservar índices e contagem correta
        const cC100 = linha.split('|');
        const fC100 = cC100.slice(1, cC100[cC100.length - 1] === '' ? -1 : undefined);
        if (fC100.length < 29) {
          avisos.push({
            linha: linhaAtual, registro: 'C100',
            mensagem: `Registro C100 com campos insuficientes: esperado mínimo de 29 campos, encontrado ${fC100.length}.`,
            severidade: 'aviso'
          });
        }
        if (fC100[1] && fC100[1] !== '0' && fC100[1] !== '1') {
          erros.push({
            linha: linhaAtual, registro: 'C100',
            mensagem: `IND_OPER inválido: "${fC100[1]}" (deve ser 0=Entrada ou 1=Saída).`,
            severidade: 'erro'
          });
        }
        const codSitValidos = ['00','01','02','03','04','05','06','07','08'];
        if (fC100[5] && !codSitValidos.includes(fC100[5])) {
          erros.push({
            linha: linhaAtual, registro: 'C100',
            mensagem: `COD_SIT inválido: "${fC100[5]}" (deve ser um dos códigos: ${codSitValidos.join(', ')}).`,
            severidade: 'erro'
          });
        }
        if (fC100[12]) {
          const valor = fC100[12].replace(',', '.');
          if (isNaN(parseFloat(valor))) {
            erros.push({
              linha: linhaAtual, registro: 'C100',
              mensagem: `VL_DOC inválido: "${fC100[12]}" não é um valor numérico válido.`,
              severidade: 'erro'
            });
          }
        }
      }

      if (registro === 'C170' && (tipoDetectado === 'FISCAL' || tipoDetectado === 'CONTRIBUICOES')) {
        if (campos.length < 4) {
          avisos.push({
            linha: linhaAtual, registro: 'C170',
            mensagem: `Registro C170 com campos insuficientes: ${campos.length} campos.`,
            severidade: 'aviso'
          });
        }
        if (tipoDetectado === 'CONTRIBUICOES') {
          validarDetalheContribuicoes('C170', linha, campos, linhaAtual, erros, avisos);
        }
      }

      if (registro === 'E110' && tipoDetectado === 'FISCAL') {
        if (campos.length < 15) {
          avisos.push({
            linha: linhaAtual, registro: 'E110',
            mensagem: `Registro E110 incompleto: esperado mínimo de 15 campos, encontrado ${campos.length}.`,
            severidade: 'aviso'
          });
        }
        validarValorNumerico(campos, 2, 14, 'E110', linhaAtual, erros);
      }

      // === SPED FISCAL: Bloco B (Documentos Fiscais - Serviços/ISS) ===

      if (registro === 'B020' && tipoDetectado === 'FISCAL') {
        // |B020|IND_OPER|COD_PART|COD_MOD|COD_SIT|SER|NUM_DOC|DT_DOC|VL_DOC|VL_DESC|...
        if (campos.length < 10) {
          avisos.push({ linha: linhaAtual, registro: 'B020', mensagem: `Registro B020 incompleto: esperado mínimo de 10 campos, encontrado ${campos.length}.`, severidade: 'aviso' });
        }
        if (campos[1] && !['0','1'].includes(campos[1])) {
          erros.push({ linha: linhaAtual, registro: 'B020', mensagem: `IND_OPER inválido: "${campos[1]}" (deve ser 0=Entrada ou 1=Saída).`, severidade: 'erro' });
        }
        validarValorNumerico(campos, 8, 10, 'B020', linhaAtual, erros);
      }

      if (registro === 'B350' && tipoDetectado === 'FISCAL') {
        // |B350|COD_PART|DT_DOC|VL_BC_ISS|ALIQ_ISS|VL_ISS|...
        if (campos.length < 6) {
          avisos.push({ linha: linhaAtual, registro: 'B350', mensagem: `Registro B350 incompleto: esperado mínimo de 6 campos, encontrado ${campos.length}.`, severidade: 'aviso' });
        }
        validarValorNumerico(campos, 3, 6, 'B350', linhaAtual, erros);
      }

      // === SPED FISCAL: Bloco D (Documentos Fiscais - Serviços/ICMS) ===

      if (registro === 'D100' && tipoDetectado === 'FISCAL') {
        // |D100|IND_OPER|IND_EMIT|COD_PART|COD_MOD|COD_SIT|SER|SUB|NUM_DOC|CHV_DOC|DT_DOC|DT_AP|VL_DOC|...
        if (campos.length < 14) {
          avisos.push({ linha: linhaAtual, registro: 'D100', mensagem: `Registro D100 incompleto: esperado mínimo de 14 campos, encontrado ${campos.length}.`, severidade: 'aviso' });
        }
        if (campos[1] && !['0','1'].includes(campos[1])) {
          erros.push({ linha: linhaAtual, registro: 'D100', mensagem: `IND_OPER inválido: "${campos[1]}" (deve ser 0=Entrada ou 1=Saída).`, severidade: 'erro' });
        }
        if (campos[2] && !['0','1'].includes(campos[2])) {
          erros.push({ linha: linhaAtual, registro: 'D100', mensagem: `IND_EMIT inválido: "${campos[2]}" (deve ser 0=Emissão própria ou 1=Terceiros).`, severidade: 'erro' });
        }
        const codSitValidosD = ['00','01','02','03','06','07','08'];
        if (campos[5] && !codSitValidosD.includes(campos[5])) {
          erros.push({ linha: linhaAtual, registro: 'D100', mensagem: `COD_SIT inválido: "${campos[5]}" (deve ser: ${codSitValidosD.join(', ')}).`, severidade: 'erro' });
        }
        if (campos[12]) {
          const valor = campos[12].replace(',', '.');
          if (isNaN(parseFloat(valor))) {
            erros.push({ linha: linhaAtual, registro: 'D100', mensagem: `VL_DOC inválido: "${campos[12]}" não é um valor numérico válido.`, severidade: 'erro' });
          }
        }
      }

      if (registro === 'D500' && tipoDetectado === 'FISCAL') {
        // |D500|IND_OPER|IND_EMIT|COD_PART|COD_MOD|COD_SIT|SER|SUB|NUM_DOC|DT_DOC|DT_AP|VL_DOC|...
        if (campos.length < 13) {
          avisos.push({ linha: linhaAtual, registro: 'D500', mensagem: `Registro D500 incompleto: esperado mínimo de 13 campos, encontrado ${campos.length}.`, severidade: 'aviso' });
        }
        if (campos[1] && !['0','1'].includes(campos[1])) {
          erros.push({ linha: linhaAtual, registro: 'D500', mensagem: `IND_OPER inválido: "${campos[1]}" (deve ser 0=Entrada ou 1=Saída).`, severidade: 'erro' });
        }
        validarValorNumerico(campos, 11, 13, 'D500', linhaAtual, erros);
      }

      // === SPED FISCAL: Bloco G (CIAP - Ativo Permanente) ===

      if (registro === 'G110' && tipoDetectado === 'FISCAL') {
        // |G110|DT_INI|DT_FIN|SALDO_IN_ICMS|SOM_PARC|VL_IMOB_ICMS_OP|VL_IMOB_ICMS_ST|VL_IMOB_ICMS_FRT|VL_IMOB_ICMS_DIF|...
        if (campos.length < 8) {
          avisos.push({ linha: linhaAtual, registro: 'G110', mensagem: `Registro G110 incompleto: esperado mínimo de 8 campos, encontrado ${campos.length}.`, severidade: 'aviso' });
        }
        validarData8(campos[1], 'G110', linhaAtual, erros);
        validarData8(campos[2], 'G110', linhaAtual, erros);
        validarValorNumerico(campos, 3, 8, 'G110', linhaAtual, erros);
      }

      if (registro === 'G125' && tipoDetectado === 'FISCAL') {
        // |G125|COD_IND_BEM|DT_MOV|TIPO_MOV|VL_IMOB_ICMS_OP|VL_IMOB_ICMS_ST|VL_IMOB_ICMS_FRT|VL_IMOB_ICMS_DIF|NUM_PARC|VL_PARC_PASS|...
        if (campos.length < 10) {
          avisos.push({ linha: linhaAtual, registro: 'G125', mensagem: `Registro G125 incompleto: esperado mínimo de 10 campos, encontrado ${campos.length}.`, severidade: 'aviso' });
        }
        validarData8(campos[2], 'G125', linhaAtual, erros);
        // TIPO_MOV (índice 3): CI=Imobilização, MP=Manual, etc.
        const tiposMovValidos = ['CI','MP','MC','IA','ST','DT','BA','OT','PE'];
        if (campos[3] && !tiposMovValidos.includes(campos[3])) {
          erros.push({ linha: linhaAtual, registro: 'G125', mensagem: `TIPO_MOV inválido: "${campos[3]}" (deve ser um de: ${tiposMovValidos.join(', ')}).`, severidade: 'erro' });
        }
        validarValorNumerico(campos, 4, 10, 'G125', linhaAtual, erros);
      }

      // === SPED FISCAL: Bloco H (Estoque) ===

      if (registro === 'H005' && tipoDetectado === 'FISCAL') {
        // |H005|DT_INV|VL_INV|...
        if (campos.length < 3) {
          avisos.push({ linha: linhaAtual, registro: 'H005', mensagem: `Registro H005 incompleto: esperado mínimo de 3 campos, encontrado ${campos.length}.`, severidade: 'aviso' });
        }
        validarData8(campos[1], 'H005', linhaAtual, erros);
        validarValorNumerico(campos, 2, 3, 'H005', linhaAtual, erros);
      }

      if (registro === 'H010' && tipoDetectado === 'FISCAL') {
        // |H010|COD_ITEM|UNID|QTD|VL_UNIT|VL_ITEM|IND_PROP|COD_PART|TXT_COMPL|COD_CTA|...
        if (campos.length < 7) {
          avisos.push({ linha: linhaAtual, registro: 'H010', mensagem: `Registro H010 incompleto: esperado mínimo de 7 campos, encontrado ${campos.length}.`, severidade: 'aviso' });
        }
        validarValorNumerico(campos, 3, 6, 'H010', linhaAtual, erros);
        // IND_PROP (índice 6): 0=Informante, 1=Terceiros em poder do informante, 2=Do informante em poder de terceiros
        if (campos[6] && !['0','1','2'].includes(campos[6])) {
          erros.push({ linha: linhaAtual, registro: 'H010', mensagem: `IND_PROP inválido: "${campos[6]}" (deve ser 0=Informante, 1=Em poder de terceiros ou 2=Em poder do informante).`, severidade: 'erro' });
        }
      }

      // === SPED FISCAL: Bloco 1 (Outras Informações) ===

      if (registro === '1100' && tipoDetectado === 'FISCAL') {
        // |1100|COD_IND_BEM|DT_MOV|TIPO_MOV|VL_IMOB_ICMS_OP|VL_IMOB_ICMS_ST|VL_IMOB_ICMS_FRT|VL_IMOB_ICMS_DIF|NUM_PARC|VL_PARC_PASS|...
        if (campos.length < 10) {
          avisos.push({ linha: linhaAtual, registro: '1100', mensagem: `Registro 1100 incompleto: esperado mínimo de 10 campos, encontrado ${campos.length}.`, severidade: 'aviso' });
        }
        validarData8(campos[2], '1100', linhaAtual, erros);
        validarValorNumerico(campos, 4, 10, '1100', linhaAtual, erros);
      }

      if (registro === '1600' && tipoDetectado === 'FISCAL') {
        // |1600|COD_PART|TOT_CREDITO|TOT_DEBITO|...
        if (campos.length < 4) {
          avisos.push({ linha: linhaAtual, registro: '1600', mensagem: `Registro 1600 incompleto: esperado mínimo de 4 campos, encontrado ${campos.length}.`, severidade: 'aviso' });
        }
        validarValorNumerico(campos, 2, 4, '1600', linhaAtual, erros);
      }

      // === SPED FISCAL: Bloco K (Controle de Produção e Estoque) ===

      if (registro === 'K200' && tipoDetectado === 'FISCAL') {
        // |K200|DT_EST|COD_ITEM|QTD|IND_EST|COD_PART|...
        if (campos.length < 5) {
          avisos.push({ linha: linhaAtual, registro: 'K200', mensagem: `Registro K200 incompleto: esperado mínimo de 5 campos, encontrado ${campos.length}.`, severidade: 'aviso' });
        }
        validarData8(campos[1], 'K200', linhaAtual, erros);
        validarValorNumerico(campos, 3, 4, 'K200', linhaAtual, erros);
        // IND_EST (índice 4): 0=Estoque próprio, 1=Estoque de terceiros em poder do informante, 2=Estoque do informante em poder de terceiros
        if (campos[4] && !['0','1','2'].includes(campos[4])) {
          erros.push({ linha: linhaAtual, registro: 'K200', mensagem: `IND_EST inválido: "${campos[4]}" (deve ser 0, 1 ou 2).`, severidade: 'erro' });
        }
      }

      // === SPED CONTRIBUIÇÕES: 0110, 0140, A010, C010, D100, F500, F600, M100, M500, P100, P200, 1100, 1500 ===

      if (registro === '0110' && tipoDetectado === 'CONTRIBUICOES') {
        // |0110|COD_INC_TRIB|COD_TIPO_CONT|IND_REG_CUM|...
        if (campos.length < 4) {
          avisos.push({
            linha: linhaAtual, registro: '0110',
            mensagem: `Registro 0110 incompleto: esperado mínimo de 4 campos, encontrado ${campos.length}.`,
            severidade: 'aviso'
          });
        }
        // COD_INC_TRIB (índice 1): 1=Cumulativo, 2=Não-cumulativo, 3=Ambos
        if (campos[1] && !['1','2','3'].includes(campos[1])) {
          erros.push({
            linha: linhaAtual, registro: '0110',
            mensagem: `COD_INC_TRIB inválido: "${campos[1]}" (deve ser 1=Cumulativo, 2=Não-cumulativo ou 3=Ambos).`,
            severidade: 'erro'
          });
        }
        // COD_TIPO_CONT (índice 2): 1=Aliq. Base faturamento, 2=Aliq. Receita bruta
        if (campos[2] && !['1','2'].includes(campos[2])) {
          erros.push({
            linha: linhaAtual, registro: '0110',
            mensagem: `COD_TIPO_CONT inválido: "${campos[2]}" (deve ser 1 ou 2).`,
            severidade: 'erro'
          });
        }
        // IND_REG_CUM (índice 3): 1=Reg. Caixa, 2=Reg. Competência
        if (campos[3] && !['1','2'].includes(campos[3])) {
          erros.push({
            linha: linhaAtual, registro: '0110',
            mensagem: `IND_REG_CUM inválido: "${campos[3]}" (deve ser 1=Caixa ou 2=Competência).`,
            severidade: 'erro'
          });
        }
      }

      if (registro === '0140' && tipoDetectado === 'CONTRIBUICOES') {
        // |0140|COD_ESTAB|NOME|CNPJ|UF|IE|COD_MUN|...
        if (campos.length < 7) {
          avisos.push({
            linha: linhaAtual, registro: '0140',
            mensagem: `Registro 0140 incompleto: esperado mínimo de 7 campos, encontrado ${campos.length}.`,
            severidade: 'aviso'
          });
        }
        validarCpfCnpj(campos[3], '0140', linhaAtual, erros, 'CNPJ estabelecimento');
        validarDetalheContribuicoes('0140', linha, campos, linhaAtual, erros, avisos);
      }

      if (registro === 'A010' && tipoDetectado === 'CONTRIBUICOES') {
        validarCpfCnpj(campos[1], 'A010', linhaAtual, erros, 'CNPJ estabelecimento');
      }

      if (registro === 'C010' && tipoDetectado === 'CONTRIBUICOES') {
        validarCpfCnpj(campos[1], 'C010', linhaAtual, erros, 'CNPJ estabelecimento');
      }

      if (registro === 'D100' && tipoDetectado === 'CONTRIBUICOES') {
        // |D100|IND_OPER|IND_EMIT|COD_PART|COD_MOD|COD_SIT|SER|SUB|NUM_DOC|CHV_DOC|DT_DOC|DT_AP|VL_DOC|...
        if (campos.length < 14) {
          avisos.push({
            linha: linhaAtual, registro: 'D100',
            mensagem: `Registro D100 incompleto: esperado mínimo de 14 campos, encontrado ${campos.length}.`,
            severidade: 'aviso'
          });
        }
        if (campos[1] && !['0','1'].includes(campos[1])) {
          erros.push({
            linha: linhaAtual, registro: 'D100',
            mensagem: `IND_OPER inválido: "${campos[1]}" (deve ser 0=Entrada ou 1=Saída).`,
            severidade: 'erro'
          });
        }
        if (campos[2] && !['0','1'].includes(campos[2])) {
          erros.push({
            linha: linhaAtual, registro: 'D100',
            mensagem: `IND_EMIT inválido: "${campos[2]}" (deve ser 0=Emissão própria ou 1=Terceiros).`,
            severidade: 'erro'
          });
        }
        if (campos[12]) {
          const valor = campos[12].replace(',', '.');
          if (isNaN(parseFloat(valor))) {
            erros.push({
              linha: linhaAtual, registro: 'D100',
              mensagem: `VL_DOC inválido: "${campos[12]}" não é um valor numérico válido.`,
              severidade: 'erro'
            });
          }
        }
      }

      if (registro === 'F500' && tipoDetectado === 'CONTRIBUICOES') {
        // |F500|COD_REC|VL_REC|...
        if (campos.length < 4) {
          avisos.push({
            linha: linhaAtual, registro: 'F500',
            mensagem: `Registro F500 incompleto: esperado mínimo de 4 campos, encontrado ${campos.length}.`,
            severidade: 'aviso'
          });
        }
        validarValorNumerico(campos, 2, 3, 'F500', linhaAtual, erros);
        validarDetalheContribuicoes('F500', linha, campos, linhaAtual, erros, avisos);
      }

      if (registro === 'F600' && tipoDetectado === 'CONTRIBUICOES') {
        // |F600|IND_NAT_REC|COD_REC|VL_CONT|...
        if (campos.length < 4) {
          avisos.push({
            linha: linhaAtual, registro: 'F600',
            mensagem: `Registro F600 incompleto: esperado mínimo de 4 campos, encontrado ${campos.length}.`,
            severidade: 'aviso'
          });
        }
        // IND_NAT_REC (índice 1): 01-12
        if (campos[1] && !/^0[1-9]$|^1[0-2]$/.test(campos[1])) {
          erros.push({
            linha: linhaAtual, registro: 'F600',
            mensagem: `IND_NAT_REC inválido: "${campos[1]}" (deve estar entre 01 e 12).`,
            severidade: 'erro'
          });
        }
        validarValorNumerico(campos, 3, 4, 'F600', linhaAtual, erros);
      }

      // Validação M100/M500 consolidada conforme Guia Prático EFD-Contribuições (Tabelas 4.3.6, regras de cálculo)
      const validarM100M500 = (reg, f, camposBase) => {
        const tributo = reg === 'M100' ? 'PIS' : 'COFINS';
        const labelBc = reg === 'M100' ? 'VL_BC_PIS' : 'VL_BC_COFINS';
        const labelAliq = reg === 'M100' ? 'ALIQ_PIS' : 'ALIQ_COFINS';
        const labelQtdBc = reg === 'M100' ? 'QUANT_BC_PIS' : 'QUANT_BC_COFINS';
        const labelAliqQtd = reg === 'M100' ? 'ALIQ_PIS_QUANT' : 'ALIQ_COFINS_QUANT';
        const labelCred = reg === 'M100' ? 'VL_CRED' : 'VL_CRED';

        // M100/M500: 15 campos (REG + 14 campos de dados) conforme manual
        if (f.length < 15) {
          avisos.push({
            linha: linhaAtual, registro: reg,
            mensagem: `Registro ${reg} incompleto: esperado mínimo de 15 campos, encontrado ${f.length}.`,
            severidade: 'aviso'
          });
        }

        // COD_CRED (índice 1): obrigatório, 3 dígitos, faixa 100-399 conforme Tabela 4.3.6
        // 100-199: Crédito sobre Operações Próprias
        // 200-299: Crédito Transferido
        // 300-399: Crédito Decorrente de Incorporação/Cisão/Fusão
        if (!f[1]) {
          erros.push({
            linha: linhaAtual, registro: reg,
            mensagem: `COD_CRED obrigatório não informado (Tabela 4.3.6: 100-199=Operações próprias, 200-299=Transferido, 300-399=Incorporação/cisão/fusão).`,
            severidade: 'erro'
          });
        } else if (!/^\d{3}$/.test(f[1])) {
          erros.push({
            linha: linhaAtual, registro: reg,
            mensagem: `COD_CRED inválido: "${f[1]}" (deve ter 3 dígitos numéricos conforme Tabela 4.3.6).`,
            severidade: 'erro'
          });
        } else {
          const codCred = parseInt(f[1], 10);
          if (codCred < 100 || codCred > 399) {
            erros.push({
              linha: linhaAtual, registro: reg,
              mensagem: `COD_CRED fora da faixa válida: "${f[1]}" (deve estar entre 100 e 399 conforme Tabela 4.3.6).`,
              severidade: 'erro'
            });
          }
          // IND_CRED_ORI (índice 2) deve ser coerente com o COD_CRED
          // 300-399 exige IND_CRED_ORI=1 (Incorporação/cisão/fusão)
          // 100-199 exige IND_CRED_ORI=0 (Operações próprias)
        }

        // IND_CRED_ORI (índice 2): obrigatório, 0=Oper. próprio, 1=Incorporação/cisão/fusão
        if (f[2] === undefined || f[2] === '') {
          erros.push({
            linha: linhaAtual, registro: reg,
            mensagem: `IND_CRED_ORI obrigatório não informado (deve ser 0=Operações próprias ou 1=Incorporação/cisão/fusão).`,
            severidade: 'erro'
          });
        } else if (!['0','1'].includes(f[2])) {
          erros.push({
            linha: linhaAtual, registro: reg,
            mensagem: `IND_CRED_ORI inválido: "${f[2]}" (deve ser 0=Operações próprias ou 1=Incorporação/cisão/fusão).`,
            severidade: 'erro'
          });
        }
        // Validação cruzada: COD_CRED 300-399 deve ter IND_CRED_ORI=1
        if (f[1] && /^\d{3}$/.test(f[1])) {
          const codCred = parseInt(f[1], 10);
          if (codCred >= 300 && codCred <= 399 && f[2] === '0') {
            erros.push({
              linha: linhaAtual, registro: reg,
              mensagem: `IND_CRED_ORI inconsistente: COD_CRED "${f[1]}" (faixa 300-399) exige IND_CRED_ORI=1 (Incorporação/cisão/fusão).`,
              severidade: 'erro'
            });
          }
          if (codCred >= 100 && codCred <= 199 && f[2] === '1') {
            erros.push({
              linha: linhaAtual, registro: reg,
              mensagem: `IND_CRED_ORI inconsistente: COD_CRED "${f[1]}" (faixa 100-199) exige IND_CRED_ORI=0 (Operações próprias).`,
              severidade: 'erro'
            });
          }
        }

        // Campos numéricos: VL_BC(3), ALIQ(4), QUANT_BC(5), ALIQ_QUANT(6), VL_CRED(7), VL_AJUS_ACRES(8), VL_AJUS_REDUC(9), VL_CRED_DIF(10), VL_CRED_DISP(11)
        validarValorNumerico(f, 3, 12, reg, linhaAtual, erros);
        // VL_CRED_DESC(13), SLD_CRED(14)
        validarValorNumerico(f, 13, 15, reg, linhaAtual, erros);

        // VL_CRED (índice 7): obrigatório
        if (f[7] === undefined || f[7] === '') {
          erros.push({
            linha: linhaAtual, registro: reg,
            mensagem: `${labelCred} (índice 7) obrigatório não informado.`,
            severidade: 'erro'
          });
        }

        // VL_CRED_DISP (índice 11): obrigatório
        if (f[11] === undefined || f[11] === '') {
          erros.push({
            linha: linhaAtual, registro: reg,
            mensagem: `VL_CRED_DISP (índice 11) obrigatório não informado.`,
            severidade: 'erro'
          });
        }

        // Validação de base de cálculo: deve har VL_BC+ALIQ OU QUANT_BC+ALIQ_QUANT
        const vlBc = f[3] ? parseFloat(f[3].replace(',', '.')) : 0;
        const aliq = f[4] ? parseFloat(f[4].replace(',', '.')) : 0;
        const qtdBc = f[5] ? parseFloat(f[5].replace(',', '.')) : 0;
        const aliqQtd = f[6] ? parseFloat(f[6].replace(',', '.')) : 0;
        const temBaseValor = (vlBc > 0 && aliq > 0);
        const temBaseQuant = (qtdBc > 0 && aliqQtd > 0);
        if (!temBaseValor && !temBaseQuant) {
          avisos.push({
            linha: linhaAtual, registro: reg,
            mensagem: `Nenhuma base de cálculo informada: deve preencher ${labelBc}+${labelAliq} (valor) ou ${labelQtdBc}+${labelAliqQtd} (quantidade).`,
            severidade: 'aviso'
          });
        }

        // IND_DESC_CRED (índice 12): obrigatório, 0=Total, 1=Parcial
        if (f[12] === undefined || f[12] === '') {
          erros.push({
            linha: linhaAtual, registro: reg,
            mensagem: `IND_DESC_CRED obrigatório não informado (deve ser 0=Total ou 1=Parcial).`,
            severidade: 'erro'
          });
        } else if (!['0','1'].includes(f[12])) {
          erros.push({
            linha: linhaAtual, registro: reg,
            mensagem: `IND_DESC_CRED inválido: "${f[12]}" (deve ser 0=Total ou 1=Parcial).`,
            severidade: 'erro'
          });
        }

        // VL_CRED_DESC (índice 13): obrigatório quando IND_DESC_CRED=1 (desc. parcial)
        if (f[12] === '1' && (!f[13] || parseFloat(f[13].replace(',', '.')) === 0)) {
          erros.push({
            linha: linhaAtual, registro: reg,
            mensagem: `VL_CRED_DESC obrigatório quando IND_DESC_CRED=1 (desc. parcial) e deve ser maior que zero.`,
            severidade: 'erro'
          });
        }
        // VL_CRED_DESC não pode ser maior que VL_CRED_DISP
        if (f[11] && f[13]) {
          const disp = parseFloat(f[11].replace(',', '.'));
          const desc = parseFloat(f[13].replace(',', '.'));
          if (!isNaN(disp) && !isNaN(desc) && desc > disp) {
            erros.push({
              linha: linhaAtual, registro: reg,
              mensagem: `VL_CRED_DESC (${f[13]}) maior que VL_CRED_DISP (${f[11]}). O valor de crédito utilizado não pode exceder o crédito disponível.`,
              severidade: 'erro'
            });
          }
        }

        // SLD_CRED (índice 14): obrigatório
        if (f[14] === undefined || f[14] === '') {
          erros.push({
            linha: linhaAtual, registro: reg,
            mensagem: `SLD_CRED (índice 14) obrigatório não informado.`,
            severidade: 'erro'
          });
        }
        // Validação de consistência: SLD_CRED = VL_CRED_DISP - VL_CRED_DESC (aproximadamente)
        if (f[11] && f[13] && f[14]) {
          const disp = parseFloat(f[11].replace(',', '.'));
          const desc = parseFloat(f[13].replace(',', '.'));
          const sld = parseFloat(f[14].replace(',', '.'));
          if (!isNaN(disp) && !isNaN(desc) && !isNaN(sld)) {
            const sldEsperado = disp - desc;
            const diff = Math.abs(sld - sldEsperado);
            if (diff > 0.02) {
              avisos.push({
                linha: linhaAtual, registro: reg,
                mensagem: `SLD_CRED (${f[14]}) diverge de VL_CRED_DISP - VL_CRED_DESC (${sldEsperado.toFixed(2)}). Diferença: ${diff.toFixed(2)}.`,
                severidade: 'aviso'
              });
            }
          }
        }
      };

      if (registro === 'M105' && tipoDetectado === 'CONTRIBUICOES') {
        // M105 possui campos opcionais vazios — split SEM filtro para preservar índices e contagem
        const cM105 = linha.split('|');
        const fM105 = cM105.slice(1, cM105[cM105.length - 1] === '' ? -1 : undefined);
        if (fM105.length < 9) {
          avisos.push({
            linha: linhaAtual, registro: 'M105',
            mensagem: `Registro M105 incompleto: esperado mínimo de 9 campos, encontrado ${fM105.length}.`,
            severidade: 'aviso'
          });
        }
        // VL_BC_PIS (índice 3), VL_BC_PIS_NC (4), VL_BC_PIS_CUM (5), VL_BC_PIS_TOT (6), QUANT_BC_PIS (7), QUANT_BC_PIS_TOT (8)
        validarValorNumerico(fM105, 3, 9, 'M105', linhaAtual, erros);
      }

      if (registro === 'M100' && tipoDetectado === 'CONTRIBUICOES') {
        // M100: split SEM filtro para preservar índices (campos opcionais vazios)
        // Layout oficial: |M100|COD_CRED|IND_CRED_ORI|VL_BC_PIS|ALIQ_PIS|QUANT_BC_PIS|ALIQ_PIS_QUANT|VL_CRED|VL_AJUS_ACRES|VL_AJUS_REDUC|VL_CRED_DIF|VL_CRED_DISP|IND_DESC_CRED|VL_CRED_DESC|SLD_CRED|
        const cM100 = linha.split('|');
        const f = cM100.slice(1, cM100[cM100.length - 1] === '' ? -1 : undefined);
        validarM100M500('M100', f);
      }

      if (registro === 'M500' && tipoDetectado === 'CONTRIBUICOES') {
        // M500: split SEM filtro para preservar índices (campos opcionais vazios)
        // Layout oficial: |M500|COD_CRED|IND_CRED_ORI|VL_BC_COFINS|ALIQ_COFINS|QUANT_BC_COFINS|ALIQ_COFINS_QUANT|VL_CRED|VL_AJUS_ACRES|VL_AJUS_REDUC|VL_CRED_DIF|VL_CRED_DISP|IND_DESC_CRED|VL_CRED_DESC|SLD_CRED|
        const cM500 = linha.split('|');
        const f = cM500.slice(1, cM500[cM500.length - 1] === '' ? -1 : undefined);
        validarM100M500('M500', f);
      }

      if (registro === 'P100' && tipoDetectado === 'CONTRIBUICOES') {
        // |P100|DT_INI|DT_FIN|VL_REC|VL_REC_SEN|VL_BRT_NC|...
        if (campos.length < 7) {
          avisos.push({
            linha: linhaAtual, registro: 'P100',
            mensagem: `Registro P100 incompleto: esperado mínimo de 7 campos, encontrado ${campos.length}.`,
            severidade: 'aviso'
          });
        }
        validarData8(campos[1], 'P100', linhaAtual, erros);
        validarData8(campos[2], 'P100', linhaAtual, erros);
        validarValorNumerico(campos, 3, 6, 'P100', linhaAtual, erros);
      }

      if (registro === 'P200' && tipoDetectado === 'CONTRIBUICOES') {
        // |P200|DT_INI|DT_FIN|VL_CONT|...
        if (campos.length < 4) {
          avisos.push({
            linha: linhaAtual, registro: 'P200',
            mensagem: `Registro P200 incompleto: esperado mínimo de 4 campos, encontrado ${campos.length}.`,
            severidade: 'aviso'
          });
        }
        validarData8(campos[1], 'P200', linhaAtual, erros);
        validarData8(campos[2], 'P200', linhaAtual, erros);
        validarValorNumerico(campos, 3, 4, 'P200', linhaAtual, erros);
      }

      if (registro === '1100' && tipoDetectado === 'CONTRIBUICOES') {
        // |1100|COD_CRED|IND_CRED_ORI|VL_BC_PIS|ALIQ_PIS|VL_PIS|...
        if (campos.length < 8) {
          avisos.push({
            linha: linhaAtual, registro: '1100',
            mensagem: `Registro 1100 incompleto: esperado mínimo de 8 campos, encontrado ${campos.length}.`,
            severidade: 'aviso'
          });
        }
        validarValorNumerico(campos, 3, 6, '1100', linhaAtual, erros);
      }

      if (registro === '1500' && tipoDetectado === 'CONTRIBUICOES') {
        // |1500|COD_CRED|IND_CRED_ORI|VL_BC_COFINS|ALIQ_COFINS|VL_COFINS|...
        if (campos.length < 8) {
          avisos.push({
            linha: linhaAtual, registro: '1500',
            mensagem: `Registro 1500 incompleto: esperado mínimo de 8 campos, encontrado ${campos.length}.`,
            severidade: 'aviso'
          });
        }
        validarValorNumerico(campos, 3, 6, '1500', linhaAtual, erros);
      }

      // === SPED CONTRIBUIÇÕES: A100, A170, F100, F200, M200, M600, M400, M800 ===

      if (registro === 'A100' && tipoDetectado === 'CONTRIBUICOES') {
        // A100 possui campos opcionais vazios (SUB, CHV_NFSE, etc.) — split SEM filtro para preservar índices
        // Layout: |A100|IND_OPER|IND_EMIT|COD_PART|COD_SIT|SER|SUB|NUM_DOC|CHV_NFSE|DT_DOC|DT_EXE_SERV|VL_DOC|IND_PGTO|VL_DESC|VL_BC_PIS|VL_PIS|VL_BC_COFINS|VL_COFINS|VL_PIS_RET|VL_COFINS_RET|VL_ISS|
        const c = linha.split('|'); // ['', 'A100', '0', '1', 'F8955', '00', 'U', '', '27', '', '13052026', ...]
        // Remove primeiro e último elemento (sempre vazios por causa dos pipes delimitadores)
        const f = c.slice(1, c[c.length - 1] === '' ? -1 : undefined);
        if (f.length < 13) {
          avisos.push({
            linha: linhaAtual, registro: 'A100',
            mensagem: `Registro A100 incompleto: esperado mínimo de 13 campos, encontrado ${f.length}.`,
            severidade: 'aviso'
          });
        }
        // IND_OPER (índice 1): 0=Serviço Contratado, 1=Serviço Prestado
        if (f[1] && !['0','1'].includes(f[1])) {
          erros.push({
            linha: linhaAtual, registro: 'A100',
            mensagem: `IND_OPER inválido: "${f[1]}" (deve ser 0=Serviço Contratado ou 1=Serviço Prestado).`,
            severidade: 'erro'
          });
        }
        // IND_EMIT (índice 2): 0=Emissão Própria, 1=Emissão de Terceiros
        if (f[2] && !['0','1'].includes(f[2])) {
          erros.push({
            linha: linhaAtual, registro: 'A100',
            mensagem: `IND_EMIT inválido: "${f[2]}" (deve ser 0=Emissão Própria ou 1=Emissão de Terceiros).`,
            severidade: 'erro'
          });
        }
        // COD_SIT (índice 4): 00=Regular, 02=Cancelado, 03=Denegado, 04=Inutilizado
        const codSitA100 = ['00','02','03','04'];
        if (f[4] && !codSitA100.includes(f[4])) {
          erros.push({
            linha: linhaAtual, registro: 'A100',
            mensagem: `COD_SIT inválido: "${f[4]}" (deve ser 00=Regular, 02=Cancelado, 03=Denegado ou 04=Inutilizado).`,
            severidade: 'erro'
          });
        }
        // DT_DOC (índice 9) e DT_EXE_SERV (índice 10)
        validarData8(f[9], 'A100', linhaAtual, erros);
        validarData8(f[10], 'A100', linhaAtual, erros);
        // VL_DOC (índice 11)
        validarValorNumerico(f, 11, 12, 'A100', linhaAtual, erros);
        // IND_PGTO (índice 12): 0=À vista, 1=A prazo, 9=Sem pagamento
        if (f[12] && !['0','1','9'].includes(f[12])) {
          erros.push({
            linha: linhaAtual, registro: 'A100',
            mensagem: `IND_PGTO inválido: "${f[12]}" (deve ser 0=À vista, 1=A prazo ou 9=Sem pagamento).`,
            severidade: 'erro'
          });
        }
        // VL_DESC (índice 13, opcional), VL_BC_PIS (14), VL_PIS (15), VL_BC_COFINS (16), VL_COFINS (17)
        validarValorNumerico(f, 13, 18, 'A100', linhaAtual, erros);
      }

      if (registro === 'A170' && tipoDetectado === 'CONTRIBUICOES') {
        // A170 também possui campos opcionais vazios — split SEM filtro para preservar índices
        // Layout: |A170|NUM_ITEM|COD_ITEM|DESCR_COMPL|VL_ITEM|VL_DESC|NAT_BC_CRED|IND_ORIG_CRED|CST_PIS|VL_BC_PIS|ALIQ_PIS|VL_PIS|CST_COFINS|VL_BC_COFINS|ALIQ_COFINS|VL_COFINS|COD_CTA|COD_CCUS|
        const c2 = linha.split('|');
        const f = c2.slice(1, c2[c2.length - 1] === '' ? -1 : undefined);
        if (f.length < 6) {
          avisos.push({
            linha: linhaAtual, registro: 'A170',
            mensagem: `Registro A170 incompleto: esperado mínimo de 6 campos, encontrado ${f.length}.`,
            severidade: 'aviso'
          });
        }
        // NUM_ITEM (índice 1): numérico
        validarValorNumerico(f, 1, 2, 'A170', linhaAtual, erros);
        // VL_ITEM (índice 4) e VL_DESC (índice 5, opcional)
        validarValorNumerico(f, 4, 6, 'A170', linhaAtual, erros);
        // IND_ORIG_CRED (índice 7, opcional): 0=Mercado Interno, 1=Importação
        if (f[7] && !['0','1'].includes(f[7])) {
          erros.push({
            linha: linhaAtual, registro: 'A170',
            mensagem: `IND_ORIG_CRED inválido: "${f[7]}" (deve ser 0=Operação no Mercado Interno ou 1=Operação de Importação).`,
            severidade: 'erro'
          });
        }
        // CST_PIS (índice 8) e CST_COFINS (índice 12): obrigatórios, 2 dígitos
        if (f[8] && !/^\d{2}$/.test(f[8])) {
          erros.push({
            linha: linhaAtual, registro: 'A170',
            mensagem: `CST_PIS inválido: "${f[8]}" (deve ter 2 dígitos numéricos conforme Tabela 4.3.3).`,
            severidade: 'erro'
          });
        }
        if (f[12] && !/^\d{2}$/.test(f[12])) {
          erros.push({
            linha: linhaAtual, registro: 'A170',
            mensagem: `CST_COFINS inválido: "${f[12]}" (deve ter 2 dígitos numéricos conforme Tabela 4.3.4).`,
            severidade: 'erro'
          });
        }
        // VL_BC_PIS (9), ALIQ_PIS (10), VL_PIS (11), VL_BC_COFINS (13), ALIQ_COFINS (14), VL_COFINS (15)
        validarValorNumerico(f, 9, 12, 'A170', linhaAtual, erros);
        validarValorNumerico(f, 13, 16, 'A170', linhaAtual, erros);
        validarDetalheContribuicoes('A170', linha, campos, linhaAtual, erros, avisos);
      }

      if (registro === 'F100' && tipoDetectado === 'CONTRIBUICOES') {
        if (campos.length < 14) {
          avisos.push({
            linha: linhaAtual, registro: 'F100',
            mensagem: `Registro F100 incompleto: esperado mínimo de 14 campos, encontrado ${campos.length}.`,
            severidade: 'aviso'
          });
        }
        // COD_CONT campo 3 (índice 2), VL_CONT campo 7 (índice 6)
        validarValorNumerico(campos, 6, 8, 'F100', linhaAtual, erros);
      }

      if (registro === 'F200' && tipoDetectado === 'CONTRIBUICOES') {
        if (campos.length < 15) {
          avisos.push({
            linha: linhaAtual, registro: 'F200',
            mensagem: `Registro F200 incompleto: esperado mínimo de 15 campos, encontrado ${campos.length}.`,
            severidade: 'aviso'
          });
        }
        // VL_REC campo 4 (índice 3)
        validarValorNumerico(campos, 3, 5, 'F200', linhaAtual, erros);
      }

      if (registro === 'M210' && tipoDetectado === 'CONTRIBUICOES') {
        // M210 possui campos opcionais vazios — split SEM filtro para preservar índices e contagem
        const cM210 = linha.split('|');
        const fM210 = cM210.slice(1, cM210[cM210.length - 1] === '' ? -1 : undefined);
        if (fM210.length < 11) {
          avisos.push({
            linha: linhaAtual, registro: 'M210',
            mensagem: `Registro M210 incompleto: esperado mínimo de 11 campos, encontrado ${fM210.length}.`,
            severidade: 'aviso'
          });
        }
        // VL_BC_CONT (3), ALIQ_CONT (4), VL_CONT_APUR (5), VL_AJUS_ACRES (6), VL_AJUS_REDUC (7), VL_CONT_DIFER (8), VL_CONT_DEV (9)
        validarValorNumerico(fM210, 3, 10, 'M210', linhaAtual, erros);
      }

      if (registro === 'M200' && tipoDetectado === 'CONTRIBUICOES') {
        // Apuração PIS — campos numéricos de VL_CONT_APUR até VL_OUT_CRED
        if (campos.length < 12) {
          avisos.push({
            linha: linhaAtual, registro: 'M200',
            mensagem: `Registro M200 incompleto: esperado mínimo de 12 campos, encontrado ${campos.length}.`,
            severidade: 'aviso'
          });
        }
        validarValorNumerico(campos, 2, 11, 'M200', linhaAtual, erros);
      }

      if (registro === 'M600' && tipoDetectado === 'CONTRIBUICOES') {
        // Apuração COFINS
        if (campos.length < 12) {
          avisos.push({
            linha: linhaAtual, registro: 'M600',
            mensagem: `Registro M600 incompleto: esperado mínimo de 12 campos, encontrado ${campos.length}.`,
            severidade: 'aviso'
          });
        }
        validarValorNumerico(campos, 2, 11, 'M600', linhaAtual, erros);
      }

      if (registro === 'M400' && tipoDetectado === 'CONTRIBUICOES') {
        // M400 possui campos opcionais vazios — split SEM filtro para preservar índices e contagem
        const cM400 = linha.split('|');
        const fM400 = cM400.slice(1, cM400[cM400.length - 1] === '' ? -1 : undefined);
        if (fM400.length < 5) {
          avisos.push({
            linha: linhaAtual, registro: 'M400',
            mensagem: `Registro M400 incompleto: esperado mínimo de 5 campos, encontrado ${fM400.length}.`,
            severidade: 'aviso'
          });
        }
        validarValorNumerico(fM400, 3, 4, 'M400', linhaAtual, erros);
      }

      if (registro === 'M410' && tipoDetectado === 'CONTRIBUICOES') {
        // M410 possui campos opcionais vazios — split SEM filtro
        const cM410 = linha.split('|');
        const fM410 = cM410.slice(1, cM410[cM410.length - 1] === '' ? -1 : undefined);
        if (fM410.length < 4) {
          avisos.push({
            linha: linhaAtual, registro: 'M410',
            mensagem: `Registro M410 incompleto: esperado mínimo de 4 campos, encontrado ${fM410.length}.`,
            severidade: 'aviso'
          });
        }
        validarValorNumerico(fM410, 3, 4, 'M410', linhaAtual, erros);
      }

      if (registro === 'M800' && tipoDetectado === 'CONTRIBUICOES') {
        // M800 possui campos opcionais vazios — split SEM filtro para preservar índices e contagem
        const cM800 = linha.split('|');
        const fM800 = cM800.slice(1, cM800[cM800.length - 1] === '' ? -1 : undefined);
        if (fM800.length < 5) {
          avisos.push({
            linha: linhaAtual, registro: 'M800',
            mensagem: `Registro M800 incompleto: esperado mínimo de 5 campos, encontrado ${fM800.length}.`,
            severidade: 'aviso'
          });
        }
        validarValorNumerico(fM800, 3, 4, 'M800', linhaAtual, erros);
      }

      if (registro === 'M810' && tipoDetectado === 'CONTRIBUICOES') {
        // M810 possui campos opcionais vazios — split SEM filtro
        const cM810 = linha.split('|');
        const fM810 = cM810.slice(1, cM810[cM810.length - 1] === '' ? -1 : undefined);
        if (fM810.length < 4) {
          avisos.push({
            linha: linhaAtual, registro: 'M810',
            mensagem: `Registro M810 incompleto: esperado mínimo de 4 campos, encontrado ${fM810.length}.`,
            severidade: 'aviso'
          });
        }
        validarValorNumerico(fM810, 3, 4, 'M810', linhaAtual, erros);
      }

      // === SPED ECD: I010, I012, I030, I050, I051, I100, I150, I155, I200, I250, I300, I310, I350, I355 ===

      if (registro === 'I010' && tipoDetectado === 'ECD') {
        // |I010|IND_ESC|COD_VER_LC|
        if (campos.length < 3) {
          avisos.push({
            linha: linhaAtual, registro: 'I010',
            mensagem: `Registro I010 (identificação da escrituração) incompleto: esperado mínimo de 3 campos, encontrado ${campos.length}.`,
            severidade: 'aviso'
          });
        }
        // IND_ESC (índice 1): G, R, A, B ou Z
        if (campos[1] && !['G','R','A','B','Z'].includes(campos[1])) {
          erros.push({
            linha: linhaAtual, registro: 'I010',
            mensagem: `IND_ESC inválido: "${campos[1]}" (deve ser G=Diário Completo, R=Diário Resumido, A=Diário Auxiliar, B=Balancetes Diários ou Z=Razão Auxiliar).`,
            severidade: 'erro'
          });
        }
      }

      if (registro === 'I012' && tipoDetectado === 'ECD') {
        // |I012|NUM_ORD|NAT_LIVR|TIPO|COD_HASH_AUX|
        if (campos.length < 5) {
          avisos.push({
            linha: linhaAtual, registro: 'I012',
            mensagem: `Registro I012 (livros auxiliares) incompleto: esperado mínimo de 5 campos, encontrado ${campos.length}.`,
            severidade: 'aviso'
          });
        }
        // TIPO (índice 3): 0=Digital, 1=Outros
        if (campos[3] && !['0','1'].includes(campos[3])) {
          erros.push({
            linha: linhaAtual, registro: 'I012',
            mensagem: `TIPO inválido: "${campos[3]}" (deve ser 0=Digital ou 1=Outros).`,
            severidade: 'erro'
          });
        }
      }

      if (registro === 'I030' && tipoDetectado === 'ECD') {
        // Termo de abertura: |I030|NUM_ORD|NAT_LIVRO|TIPO_ESCRIT|DATA_INI|DATA_FIN|NOME|CNPJ|...
        if (campos.length < 12) {
          avisos.push({
            linha: linhaAtual, registro: 'I030',
            mensagem: `Registro I030 (termo de abertura) incompleto: esperado mínimo de 12 campos, encontrado ${campos.length}.`,
            severidade: 'aviso'
          });
        }
        validarData8(campos[4], 'I030', linhaAtual, erros);
        validarData8(campos[5], 'I030', linhaAtual, erros);
        validarCpfCnpj(campos[7], 'I030', linhaAtual, erros, 'CPF/CNPJ');
      }

      if (registro === 'I050' && tipoDetectado === 'ECD') {
        // |I050|DT_ALT|COD_NAT|IND_CTA|NIVEL|COD_CTA|COD_CTA_SUP|CTA|
        if (campos.length < 8) {
          avisos.push({
            linha: linhaAtual, registro: 'I050',
            mensagem: `Registro I050 (plano de contas) incompleto: esperado mínimo de 8 campos, encontrado ${campos.length}.`,
            severidade: 'aviso'
          });
        }
        // DT_ALT (índice 1)
        validarData8(campos[1], 'I050', linhaAtual, erros);
        // COD_NAT (índice 2): 01-10 (natureza da conta)
        if (campos[2] && !/^0[1-9]$|^10$/.test(campos[2])) {
          erros.push({
            linha: linhaAtual, registro: 'I050',
            mensagem: `COD_NAT inválido: "${campos[2]}" (deve estar entre 01 e 10).`,
            severidade: 'erro'
          });
        }
        // IND_CTA (índice 3): S=Sintética, A=Analítica
        if (campos[3] && !['S','A'].includes(campos[3])) {
          erros.push({
            linha: linhaAtual, registro: 'I050',
            mensagem: `IND_CTA inválido: "${campos[3]}" (deve ser S=Sintética ou A=Analítica).`,
            severidade: 'erro'
          });
        }
      }

      if (registro === 'I051' && tipoDetectado === 'ECD') {
        // |I051|COD_ENT_REF|COD_CCUS|COD_CTA_REF|...
        if (campos.length < 4) {
          avisos.push({
            linha: linhaAtual, registro: 'I051',
            mensagem: `Registro I051 (plano de contas referencial) incompleto: esperado mínimo de 4 campos, encontrado ${campos.length}.`,
            severidade: 'aviso'
          });
        }
      }

      if (registro === 'I100' && tipoDetectado === 'ECD') {
        // |I100|DT_ALT|COD_CCUS|CCUS|
        if (campos.length < 4) {
          avisos.push({
            linha: linhaAtual, registro: 'I100',
            mensagem: `Registro I100 (centro de custos) incompleto: esperado mínimo de 4 campos, encontrado ${campos.length}.`,
            severidade: 'aviso'
          });
        }
        validarData8(campos[1], 'I100', linhaAtual, erros);
      }

      if (registro === 'I150' && tipoDetectado === 'ECD') {
        // |I150|DT_INI|DT_FIN|
        if (campos.length < 3) {
          avisos.push({
            linha: linhaAtual, registro: 'I150',
            mensagem: `Registro I150 (saldos periódicos) incompleto: esperado mínimo de 3 campos, encontrado ${campos.length}.`,
            severidade: 'aviso'
          });
        }
        validarData8(campos[1], 'I150', linhaAtual, erros);
        validarData8(campos[2], 'I150', linhaAtual, erros);
      }

      if (registro === 'I155' && tipoDetectado === 'ECD') {
        // |I155|COD_CTA|COD_CCUS|DT_INI|DT_FIN|VL_SLD_INI|IND_DC_INI|VL_DEB|VL_CRED|VL_SLD_FIN|IND_DC_FIN|
        if (campos.length < 7) {
          avisos.push({
            linha: linhaAtual, registro: 'I155',
            mensagem: `Registro I155 (detalhes de saldos) incompleto: esperado mínimo de 7 campos, encontrado ${campos.length}.`,
            severidade: 'aviso'
          });
        }
        // IND_DC_INI (índice 6) e IND_DC_FIN (índice 9) devem ser D ou C
        if (campos[6] && !['D','C'].includes(campos[6])) {
          erros.push({
            linha: linhaAtual, registro: 'I155',
            mensagem: `IND_DC_INI inválido: "${campos[6]}" (deve ser D=Devedor ou C=Credor).`,
            severidade: 'erro'
          });
        }
        if (campos[10] && !['D','C'].includes(campos[10])) {
          erros.push({
            linha: linhaAtual, registro: 'I155',
            mensagem: `IND_DC_FIN inválido: "${campos[10]}" (deve ser D=Devedor ou C=Credor).`,
            severidade: 'erro'
          });
        }
        // VL_SLD_INI (índice 5), VL_DEB (índice 7), VL_CRED (índice 8), VL_SLD_FIN (índice 9)
        validarValorNumerico(campos, 5, 6, 'I155', linhaAtual, erros);
        validarValorNumerico(campos, 7, 10, 'I155', linhaAtual, erros);
      }

      if (registro === 'I200' && tipoDetectado === 'ECD') {
        // |I200|NUM_LCTO|DT_LCTO|IND_LCTO|HIST|VL_LCTO|IND_DC|...
        if (campos.length < 5) {
          avisos.push({
            linha: linhaAtual, registro: 'I200',
            mensagem: `Registro I200 (lançamento contábil) incompleto: esperado mínimo de 5 campos, encontrado ${campos.length}.`,
            severidade: 'aviso'
          });
        }
        // DT_LCTO (índice 2)
        validarData8(campos[2], 'I200', linhaAtual, erros);
        // IND_LCTO (índice 3): N=Normal, E=Exttemporal, R=Reclassificação
        if (campos[3] && !['N','E','R'].includes(campos[3])) {
          erros.push({
            linha: linhaAtual, registro: 'I200',
            mensagem: `IND_LCTO inválido: "${campos[3]}" (deve ser N=Normal, E=Extemporal ou R=Reclassificação).`,
            severidade: 'erro'
          });
        }
        // VL_LCTO (índice 5) e IND_DC (índice 6)
        validarValorNumerico(campos, 5, 6, 'I200', linhaAtual, erros);
        if (campos[6] && !['D','C'].includes(campos[6])) {
          erros.push({
            linha: linhaAtual, registro: 'I200',
            mensagem: `IND_DC inválido: "${campos[6]}" (deve ser D=Devedor ou C=Credor).`,
            severidade: 'erro'
          });
        }
      }

      if (registro === 'I250' && tipoDetectado === 'ECD') {
        // |I250|COD_CTA|COD_CCUS|VL_LCTO|IND_DC|NUM_LCTO|HIST|COD_PART|
        if (campos.length < 5) {
          avisos.push({
            linha: linhaAtual, registro: 'I250',
            mensagem: `Registro I250 (partidas do lançamento) incompleto: esperado mínimo de 5 campos, encontrado ${campos.length}.`,
            severidade: 'aviso'
          });
        }
        // IND_DC (índice 4) deve ser D ou C
        if (campos[4] && !['D','C'].includes(campos[4])) {
          erros.push({
            linha: linhaAtual, registro: 'I250',
            mensagem: `IND_DC inválido: "${campos[4]}" (deve ser D=Devedor ou C=Credor).`,
            severidade: 'erro'
          });
        }
        // VL_LCTO (índice 3)
        validarValorNumerico(campos, 3, 4, 'I250', linhaAtual, erros);
      }

      if (registro === 'I300' && tipoDetectado === 'ECD') {
        // |I300|DT_BCTE|
        if (campos.length < 2) {
          avisos.push({
            linha: linhaAtual, registro: 'I300',
            mensagem: `Registro I300 (balancetes diários) incompleto: esperado mínimo de 2 campos, encontrado ${campos.length}.`,
            severidade: 'aviso'
          });
        }
        validarData8(campos[1], 'I300', linhaAtual, erros);
      }

      if (registro === 'I310' && tipoDetectado === 'ECD') {
        // |I310|COD_CTA|COD_CCUS|VL_SLD_FIN|IND_DC|
        if (campos.length < 5) {
          avisos.push({
            linha: linhaAtual, registro: 'I310',
            mensagem: `Registro I310 (detalhes do balancete diário) incompleto: esperado mínimo de 5 campos, encontrado ${campos.length}.`,
            severidade: 'aviso'
          });
        }
        if (campos[4] && !['D','C'].includes(campos[4])) {
          erros.push({
            linha: linhaAtual, registro: 'I310',
            mensagem: `IND_DC inválido: "${campos[4]}" (deve ser D=Devedor ou C=Credor).`,
            severidade: 'erro'
          });
        }
        validarValorNumerico(campos, 3, 4, 'I310', linhaAtual, erros);
      }

      if (registro === 'I350' && tipoDetectado === 'ECD') {
        // |I350|DT_RES|
        if (campos.length < 2) {
          avisos.push({
            linha: linhaAtual, registro: 'I350',
            mensagem: `Registro I350 (saldos de resultado antes do encerramento) incompleto: esperado mínimo de 2 campos, encontrado ${campos.length}.`,
            severidade: 'aviso'
          });
        }
        validarData8(campos[1], 'I350', linhaAtual, erros);
      }

      if (registro === 'I355' && tipoDetectado === 'ECD') {
        // |I355|COD_CTA|VL_CTA|IND_DC|
        if (campos.length < 4) {
          avisos.push({
            linha: linhaAtual, registro: 'I355',
            mensagem: `Registro I355 (detalhes dos saldos de resultado) incompleto: esperado mínimo de 4 campos, encontrado ${campos.length}.`,
            severidade: 'aviso'
          });
        }
        if (campos[3] && !['D','C'].includes(campos[3])) {
          erros.push({
            linha: linhaAtual, registro: 'I355',
            mensagem: `IND_DC inválido: "${campos[3]}" (deve ser D=Devedor ou C=Credor).`,
            severidade: 'erro'
          });
        }
        validarValorNumerico(campos, 2, 3, 'I355', linhaAtual, erros);
      }

      // === SPED ECD: J005, J100, J150, J200, J210, J900, J930, J932, J935 ===

      if (registro === 'J005' && tipoDetectado === 'ECD') {
        // |J005|DT_INI|DT_FIN|COD_DEM|...
        if (campos.length < 4) {
          avisos.push({
            linha: linhaAtual, registro: 'J005',
            mensagem: `Registro J005 (demonstrações contábeis) incompleto: esperado mínimo de 4 campos, encontrado ${campos.length}.`,
            severidade: 'aviso'
          });
        }
        validarData8(campos[1], 'J005', linhaAtual, erros);
        validarData8(campos[2], 'J005', linhaAtual, erros);
        // COD_DEM (índice 3): 1=Balanço, 2=DRE, 3=DLPA/DMPL, 4=Fluxo de Caixa, 5=Valor Adicionado
        if (campos[3] && !['1','2','3','4','5'].includes(campos[3])) {
          erros.push({
            linha: linhaAtual, registro: 'J005',
            mensagem: `COD_DEM inválido: "${campos[3]}" (deve ser 1=Balanço, 2=DRE, 3=DLPA/DMPL, 4=Fluxo de Caixa ou 5=Valor Adicionado).`,
            severidade: 'erro'
          });
        }
      }

      if (registro === 'J100' && tipoDetectado === 'ECD') {
        // |J100|DT_INI|DT_FIN|COD_CTA|COD_CTA_RES|VL_SLD_FIN|IND_DC|...
        if (campos.length < 7) {
          avisos.push({
            linha: linhaAtual, registro: 'J100',
            mensagem: `Registro J100 (balanço patrimonial) incompleto: esperado mínimo de 7 campos, encontrado ${campos.length}.`,
            severidade: 'aviso'
          });
        }
        validarData8(campos[1], 'J100', linhaAtual, erros);
        validarData8(campos[2], 'J100', linhaAtual, erros);
        if (campos[6] && !['D','C'].includes(campos[6])) {
          erros.push({
            linha: linhaAtual, registro: 'J100',
            mensagem: `IND_DC inválido: "${campos[6]}" (deve ser D=Devedor ou C=Credor).`,
            severidade: 'erro'
          });
        }
        validarValorNumerico(campos, 5, 6, 'J100', linhaAtual, erros);
        validarValorNumerico(campos, 7, 8, 'J100', linhaAtual, erros);
      }

      if (registro === 'J150' && tipoDetectado === 'ECD') {
        // |J150|DT_INI|DT_FIN|COD_CTA|COD_CTA_RES|VL_DEB|VL_CRED|IND_VL|...
        if (campos.length < 8) {
          avisos.push({
            linha: linhaAtual, registro: 'J150',
            mensagem: `Registro J150 (DRE) incompleto: esperado mínimo de 8 campos, encontrado ${campos.length}.`,
            severidade: 'aviso'
          });
        }
        validarData8(campos[1], 'J150', linhaAtual, erros);
        validarData8(campos[2], 'J150', linhaAtual, erros);
        if (campos[7] && !['D','C'].includes(campos[7])) {
          erros.push({
            linha: linhaAtual, registro: 'J150',
            mensagem: `IND_VL inválido: "${campos[7]}" (deve ser D=Despesa ou C=Receita).`,
            severidade: 'erro'
          });
        }
        validarValorNumerico(campos, 5, 7, 'J150', linhaAtual, erros);
        validarValorNumerico(campos, 8, 9, 'J150', linhaAtual, erros);
      }

      if (registro === 'J200' && tipoDetectado === 'ECD') {
        // |J200|COD_AGL|IND_GRP|DESC_COD_AGL|VL_AGL|
        if (campos.length < 5) {
          avisos.push({
            linha: linhaAtual, registro: 'J200',
            mensagem: `Registro J200 (aglutinação) incompleto: esperado mínimo de 5 campos, encontrado ${campos.length}.`,
            severidade: 'aviso'
          });
        }
        // IND_GRP (índice 2): A=Ativo, P=Passivo, R=Receita, D=Despesa
        if (campos[2] && !['A','P','R','D'].includes(campos[2])) {
          erros.push({
            linha: linhaAtual, registro: 'J200',
            mensagem: `IND_GRP inválido: "${campos[2]}" (deve ser A=Ativo, P=Passivo, R=Receita ou D=Despesa).`,
            severidade: 'erro'
          });
        }
        validarValorNumerico(campos, 4, 5, 'J200', linhaAtual, erros);
      }

      if (registro === 'J210' && tipoDetectado === 'ECD') {
        // |J210|DT_INI|DT_FIN|COD_AGL|IND_GRP|DESC_COD_AGL|VL_AGL|
        if (campos.length < 7) {
          avisos.push({
            linha: linhaAtual, registro: 'J210',
            mensagem: `Registro J210 (DLPA/DMPL) incompleto: esperado mínimo de 7 campos, encontrado ${campos.length}.`,
            severidade: 'aviso'
          });
        }
        validarData8(campos[1], 'J210', linhaAtual, erros);
        validarData8(campos[2], 'J210', linhaAtual, erros);
        validarValorNumerico(campos, 6, 7, 'J210', linhaAtual, erros);
      }

      if (registro === 'J900' && tipoDetectado === 'ECD') {
        // |J900|NUM_ORD|NAT_LIVR|DT_INI|DT_FIN|NOME|CNPJ|...
        if (campos.length < 7) {
          avisos.push({
            linha: linhaAtual, registro: 'J900',
            mensagem: `Registro J900 (termo de encerramento) incompleto: esperado mínimo de 7 campos, encontrado ${campos.length}.`,
            severidade: 'aviso'
          });
        }
        validarData8(campos[3], 'J900', linhaAtual, erros);
        validarData8(campos[4], 'J900', linhaAtual, erros);
        validarCpfCnpj(campos[6], 'J900', linhaAtual, erros, 'CNPJ');
      }

      if (registro === 'J930' && tipoDetectado === 'ECD') {
        // |J930|NOME|CPF|IDENT_QUALIF|QUALIF|COD_ASSIN|...
        if (campos.length < 6) {
          avisos.push({
            linha: linhaAtual, registro: 'J930',
            mensagem: `Registro J930 (signatários da escrituração) incompleto: esperado mínimo de 6 campos, encontrado ${campos.length}.`,
            severidade: 'aviso'
          });
        }
        if (campos[2]) {
          const cpf = campos[2].replace(/\D/g, '');
          if (cpf.length !== 11) {
            erros.push({
              linha: linhaAtual, registro: 'J930',
              mensagem: `CPF inválido no registro J930: "${campos[2]}" (esperado 11 dígitos).`,
              severidade: 'erro'
            });
          }
        }
        // COD_ASSIN (índice 5): deve estar entre 1 e 9
        if (campos[5] && !['1','2','3','4','5','6','7','8','9'].includes(campos[5])) {
          erros.push({
            linha: linhaAtual, registro: 'J930',
            mensagem: `COD_ASSIN inválido: "${campos[5]}" (deve estar entre 1 e 9).`,
            severidade: 'erro'
          });
        }
      }

      if (registro === 'J932' && tipoDetectado === 'ECD') {
        // |J932|NOME|CPF|IDENT_QUALIF|QUALIF|COD_ASSIN|...
        if (campos.length < 6) {
          avisos.push({
            linha: linhaAtual, registro: 'J932',
            mensagem: `Registro J932 (signatários do termo de verificação) incompleto: esperado mínimo de 6 campos, encontrado ${campos.length}.`,
            severidade: 'aviso'
          });
        }
        if (campos[2]) {
          const cpf = campos[2].replace(/\D/g, '');
          if (cpf.length !== 11) {
            erros.push({
              linha: linhaAtual, registro: 'J932',
              mensagem: `CPF inválido no registro J932: "${campos[2]}" (esperado 11 dígitos).`,
              severidade: 'erro'
            });
          }
        }
      }

      if (registro === 'J935' && tipoDetectado === 'ECD') {
        // |J935|CPF_CNPJ|NOME|COD_QUALIF|...
        if (campos.length < 4) {
          avisos.push({
            linha: linhaAtual, registro: 'J935',
            mensagem: `Registro J935 (identificação dos auditores independentes) incompleto: esperado mínimo de 4 campos, encontrado ${campos.length}.`,
            severidade: 'aviso'
          });
        }
        validarCpfCnpj(campos[1], 'J935', linhaAtual, erros, 'CPF/CNPJ do auditor');
      }

      // === SPED ECD: K030, K100, K110, K200 ===

      if (registro === 'K030' && tipoDetectado === 'ECD') {
        // |K030|DT_INI|DT_FIN|
        if (campos.length < 3) {
          avisos.push({
            linha: linhaAtual, registro: 'K030',
            mensagem: `Registro K030 (período da escrituração consolidada) incompleto: esperado mínimo de 3 campos, encontrado ${campos.length}.`,
            severidade: 'aviso'
          });
        }
        validarData8(campos[1], 'K030', linhaAtual, erros);
        validarData8(campos[2], 'K030', linhaAtual, erros);
      }

      if (registro === 'K100' && tipoDetectado === 'ECD') {
        // |K100|COD_PAIS|EMP_COD|CNPJ|NOME|PER_PART|EVENTO|PER_CONS|DATA_INI_EMP|DATA_FIN_EMP|
        if (campos.length < 10) {
          avisos.push({
            linha: linhaAtual, registro: 'K100',
            mensagem: `Registro K100 (empresas consolidadas) incompleto: esperado mínimo de 10 campos, encontrado ${campos.length}.`,
            severidade: 'aviso'
          });
        }
        // EVENTO (índice 6): S=Sim, N=Não
        if (campos[6] && !['S','N'].includes(campos[6])) {
          erros.push({
            linha: linhaAtual, registro: 'K100',
            mensagem: `EVENTO inválido: "${campos[6]}" (deve ser S=Sim ou N=Não).`,
            severidade: 'erro'
          });
        }
        validarData8(campos[8], 'K100', linhaAtual, erros);
        validarData8(campos[9], 'K100', linhaAtual, erros);
      }

      if (registro === 'K110' && tipoDetectado === 'ECD') {
        // |K110|EVENTO|DT_EVENTO|
        if (campos.length < 3) {
          avisos.push({
            linha: linhaAtual, registro: 'K110',
            mensagem: `Registro K110 (eventos societários) incompleto: esperado mínimo de 3 campos, encontrado ${campos.length}.`,
            severidade: 'aviso'
          });
        }
        // EVENTO (índice 1): 1-8
        if (campos[1] && !['1','2','3','4','5','6','7','8'].includes(campos[1])) {
          erros.push({
            linha: linhaAtual, registro: 'K110',
            mensagem: `EVENTO inválido: "${campos[1]}" (deve estar entre 1=Aquisição e 8=Constituição).`,
            severidade: 'erro'
          });
        }
        validarData8(campos[2], 'K110', linhaAtual, erros);
      }

      if (registro === 'K200' && tipoDetectado === 'ECD') {
        // |K200|COD_NAT|IND_CTA|NIVEL|COD_CTA|COD_CTA_SUP|CTA|
        if (campos.length < 7) {
          avisos.push({
            linha: linhaAtual, registro: 'K200',
            mensagem: `Registro K200 (plano de contas consolidado) incompleto: esperado mínimo de 7 campos, encontrado ${campos.length}.`,
            severidade: 'aviso'
          });
        }
        // IND_CTA (índice 2): S=Sintética, A=Analítica
        if (campos[2] && !['S','A'].includes(campos[2])) {
          erros.push({
            linha: linhaAtual, registro: 'K200',
            mensagem: `IND_CTA inválido: "${campos[2]}" (deve ser S=Sintética ou A=Analítica).`,
            severidade: 'erro'
          });
        }
      }

      // === SPED ECF: Validação data-driven conforme leiaute oficial ===
      if (tipoDetectado === 'ECF') {
        validarEcfRegistro(registro, campos, linhaAtual, erros, avisos);
      }

      // === Verificar registro desconhecido para o tipo detectado ===
      // Alerta se o registro não pertence ao conjunto válido do tipo detectado.
      {
        const blocoReg = registro.charAt(0);
        const blocosValidosTipo = BLOCOS_POR_TIPO[tipoDetectado] || BLOCOS_POR_TIPO.FISCAL;
        if (!blocosValidosTipo.includes(blocoReg) && registro !== '9999') {
          // já reportado no teste de blocos (seção 3a) — não duplica o erro aqui
        } else if (!registrosValidos.includes(registro) && !['9900','9999','9001','9990'].includes(registro)) {
          avisos.push({
            linha: linhaAtual,
            registro,
            mensagem: `Registro "${registro}" não é reconhecido no leiaute do SPED ${tipoDetectado}. Verifique se o arquivo está no formato correto.`,
            severidade: 'aviso'
          });
        }
      }
    }

    // --- 4b. Validações cruzadas PVA Contribuições ---
    if (tipoDetectado === 'CONTRIBUICOES') {
      validarCruzadaContribuicoes(linhas, estatisticas, erros, avisos);
    }

    // --- 5. Consistência de blocos (abertura/encerramento) ---
    const blocosEncontrados = Object.keys(estatisticas.blocos);
    for (const bloco of blocosEncontrados) {
      if (bloco === '9' && !estatisticas.registros['9999'] && !estatisticas.registros['9001']) continue;
      const abertura = `${bloco}001`;
      const encerramento = `${bloco}990`;
      const temAbertura = !!estatisticas.registros[abertura] || bloco === '0';
      const temEncerramento = !!estatisticas.registros[encerramento];

      if (estatisticas.blocos[bloco] > 0) {
        if (!temAbertura && !['0','9'].includes(bloco)) {
          erros.push({
            linha: 0,
            registro: abertura,
            mensagem: `Bloco ${bloco} possui registros mas não possui o registro de abertura |${abertura}| (obrigatório conforme leiaute SPED).`,
            severidade: 'erro'
          });
        }
        if (!temEncerramento && !['9'].includes(bloco)) {
          erros.push({
            linha: 0,
            registro: encerramento,
            mensagem: `Bloco ${bloco} possui registros mas não possui o registro de encerramento |${encerramento}| (obrigatório conforme leiaute SPED).`,
            severidade: 'erro'
          });
        }
      }
    }

    // --- 5a. Validar bloco 0 obrigatório ---
    if (!estatisticas.registros['0001']) {
      erros.push({
        linha: 0, registro: '0001',
        mensagem: 'Registro |0001| (abertura do bloco 0) é obrigatório e não foi encontrado.',
        severidade: 'erro'
      });
    }
    if (!estatisticas.registros['0990']) {
      erros.push({
        linha: 0, registro: '0990',
        mensagem: 'Registro |0990| (encerramento do bloco 0) é obrigatório e não foi encontrado.',
        severidade: 'erro'
      });
    }

    // --- 5b. Validar registro 9900 (totalizadores por tipo de registro) ---
    if (registros9900.length === 0) {
      erros.push({
        linha: 0, registro: '9900',
        mensagem: 'Registro |9900| (totalizadores) não foi encontrado. É obrigatório informar os totais de cada tipo de registro.',
        severidade: 'erro'
      });
    } else {
      for (const item of registros9900) {
        const qtdReal = estatisticas.registros[item.registroDeclarado] || 0;
        if (qtdReal !== item.qtdDeclarada) {
          erros.push({
            linha: 0, registro: '9900',
            mensagem: `Contador do registro 9900 para "${item.registroDeclarado}" (${item.qtdDeclarada}) não confere com a quantidade real encontrada (${qtdReal}).`,
            severidade: 'erro'
          });
        }
      }
      // Verificar se todos os registros presentes estão declarados no 9900
      for (const [reg, qtd] of Object.entries(estatisticas.registros)) {
        if (reg === '9900' || reg === '9999' || reg === '9001' || reg === '9990') continue;
        const declarado = registros9900.find((r) => r.registroDeclarado === reg);
        if (!declarado) {
          avisos.push({
            linha: 0, registro: '9900',
            mensagem: `Registro "${reg}" aparece ${qtd} vez(es) no arquivo mas não está declarado no registro 9900.`,
            severidade: 'aviso'
          });
        }
      }
    }

    // --- 5c. Validar bloco 9 obrigatório (9001, 9990, 9900, 9999) ---
    if (!estatisticas.registros['9001']) {
      erros.push({
        linha: 0, registro: '9001',
        mensagem: 'Registro |9001| (abertura do bloco 9) é obrigatório e não foi encontrado.',
        severidade: 'erro'
      });
    }
    if (!estatisticas.registros['9990']) {
      erros.push({
        linha: 0, registro: '9990',
        mensagem: 'Registro |9990| (encerramento do bloco 9) é obrigatório e não foi encontrado.',
        severidade: 'erro'
      });
    }

    estatisticas.linhasComErro = erros.length;
    estatisticas.linhasComAviso = avisos.length;

    const isValid = erros.length === 0;

    const resultadoSped = {
      success: true,
      nomeArquivo: nomeArquivo || 'arquivo_sped.txt',
      tipoDetectado,
      isValid,
      erros,
      avisos,
      estatisticas,
      cliente: clienteInfo,
      regime: clienteInfo?.regime || null,
      resumo: {
        totalLinhas: linhas.length,
        totalErros: erros.length,
        totalAvisos: avisos.length,
        blocosEncontrados: Object.keys(estatisticas.blocos).sort(),
        registrosUnicos: Object.keys(estatisticas.registros).length
      }
    };
    if (body.autoFix && (erros.length > 0 || avisos.length > 0)) {
      resultadoSped.conteudo_corrigido = corrigirConteudo(conteudo, tipoDetectado);
    }
    return Response.json(resultadoSped);
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});
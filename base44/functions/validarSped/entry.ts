import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { XMLParser } from 'npm:fast-xml-parser@4.5.1';

// ===================== REGISTROS REINF (XML) =====================

const EVENTOS_REINF = [
  'R-1000','R-1070','R-2010','R-2020','R-2030','R-2040',
  'R-2050','R-2060','R-2070','R-2098','R-2099',
  'R-3010','R-5001','R-9000'
];

function parseXMLEventTag(tagName) {
  // evtR1000 -> R-1000, evtR2060 -> R-2060, evtR2099 -> R-2099
  const m = tagName.match(/^evtR?(\d{4})$/i);
  if (!m) return null;
  const num = m[1];
  if (num === '1000' || num === '1070') return `R-${num}`;
  if (num.startsWith('20')) return `R-${num}`;
  if (num.startsWith('30')) return `R-${num}`;
  if (num.startsWith('50')) return `R-${num}`;
  if (num.startsWith('90')) return `R-${num}`;
  return null;
}

function validarReinf(conteudo, nomeArquivo, autoFix) {
  const erros = [];
  const avisos = [];
  const estatisticas = {
    totalLinhas: 0,
    blocos: {},
    registros: {},
    linhasComErro: 0,
    linhasComAviso: 0
  };
  const eventosEncontrados = [];

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    parseTagValue: true,
    parseAttributeValue: true,
    trimValues: true
  });

  let xmlDoc;
  try {
    xmlDoc = parser.parse(conteudo);
  } catch (e) {
    return Response.json({
      success: false,
      error: `Erro ao parsear XML do REINF: ${e.message}`
    }, { status: 400 });
  }

  // O REINF pode vir como <Reinf><evtR1000>...</evtR1000></Reinf>
  // ou como <Reinf><loteEventos><evento>...</evento></loteEventos></Reinf>
  // ou múltiplos eventos Raiz
  const reinfRoot = xmlDoc.Reinf || xmlDoc.reinf;
  if (!reinfRoot) {
    return Response.json({
      success: false,
      error: 'Arquivo XML não possui elemento raiz <Reinf>. Não é um arquivo REINF válido.'
    }, { status: 400 });
  }

  // Coleta todos os elementos de evento (evtRxxxx)
  const coletarEventos = (obj, depth = 0) => {
    if (depth > 10 || !obj || typeof obj !== 'object') return;
    for (const key of Object.keys(obj)) {
      const evento = parseXMLEventTag(key);
      if (evento) {
        eventosEncontrados.push({ tag: key, tipo: evento, dados: obj[key] });
      }
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        coletarEventos(obj[key], depth + 1);
      }
    }
  };

  // Processar loteEventos se existir
  const lote = reinfRoot.loteEventos || reinfRoot.LoteEventos;
  if (lote) {
    const eventos = lote.evento || lote.Evento;
    const arr = Array.isArray(eventos) ? eventos : [eventos];
    for (const ev of arr) {
      if (!ev || typeof ev !== 'object') continue;
      coletarEventos(ev);
    }
  } else {
    coletarEventos(reinfRoot);
  }

  estatisticas.totalLinhas = eventosEncontrados.length;

  if (eventosEncontrados.length === 0) {
    erros.push({
      linha: 0, registro: 'XML',
      mensagem: 'Nenhum evento REINF (evtR1000, evtR2010, etc.) encontrado no arquivo XML.',
      severidade: 'erro'
    });
  }

  let idx = 0;
  for (const ev of eventosEncontrados) {
    idx++;
    estatisticas.registros[ev.tipo] = (estatisticas.registros[ev.tipo] || 0) + 1;

    if (!EVENTOS_REINF.includes(ev.tipo)) {
      avisos.push({
        linha: idx, registro: ev.tipo,
        mensagem: `Evento "${ev.tipo}" não é reconhecido na estrutura REINF vigente.`,
        severidade: 'aviso'
      });
      continue;
    }

    const d = ev.dados || {};

    // --- Validar ideEvento (presente em todos os eventos) ---
    const ideEvento = d.ideEvento;
    if (!ideEvento) {
      erros.push({
        linha: idx, registro: ev.tipo,
        mensagem: `Evento ${ev.tipo}: elemento <ideEvento> obrigatório não encontrado.`,
        severidade: 'erro'
      });
    } else {
      // indRetif: 1=original, 2=retificadora
      if (ideEvento.indRetif === undefined) {
        avisos.push({
          linha: idx, registro: ev.tipo,
          mensagem: `Evento ${ev.tipo}: <indRetif> não informado em ideEvento.`,
          severidade: 'aviso'
        });
      }
      // tpAmb: 1=produção, 2=produção restrita
      if (ideEvento.tpAmb === undefined) {
        erros.push({
          linha: idx, registro: ev.tipo,
          mensagem: `Evento ${ev.tipo}: <tpAmb> (tipo de ambiente) obrigatório não informado em ideEvento.`,
          severidade: 'erro'
        });
      }
      // Para eventos periódicos: perApur (período de apuração)
      if (['R-2010','R-2020','R-2030','R-2040','R-2050','R-2060','R-2070','R-2099'].includes(ev.tipo)) {
        if (!ideEvento.perApur) {
          erros.push({
            linha: idx, registro: ev.tipo,
            mensagem: `Evento ${ev.tipo}: <perApur> (período de apuração) obrigatório não informado em ideEvento.`,
            severidade: 'erro'
          });
        } else {
          // Formato esperado: AAAA-MM (mensal) ou AAAA (anual para R-2099)
          const per = String(ideEvento.perApur);
          const regexMensal = /^\d{4}-(0[1-9]|1[0-2])$/;
          const regexAnual = /^\d{4}$/;
          if (!regexMensal.test(per) && !(ev.tipo === 'R-2099' && regexAnual.test(per))) {
            erros.push({
              linha: idx, registro: ev.tipo,
              mensagem: `Evento ${ev.tipo}: <perApur> com formato inválido: "${per}". Esperado AAAA-MM.`,
              severidade: 'erro'
            });
          }
        }
      }
    }

    // --- Validar ideContri (identificação do contribuinte) ---
    const ideContri = d.ideContri;
    if (!ideContri) {
      if (!['R-9000'].includes(ev.tipo)) {
        erros.push({
          linha: idx, registro: ev.tipo,
          mensagem: `Evento ${ev.tipo}: elemento <ideContri> obrigatório não encontrado.`,
          severidade: 'erro'
        });
      }
    } else {
      // tpInsc: 1=CNPJ, 2=CPF
      if (ideContri.tpInsc === undefined) {
        erros.push({
          linha: idx, registro: ev.tipo,
          mensagem: `Evento ${ev.tipo}: <tpInsc> obrigatório não informado em ideContri.`,
          severidade: 'erro'
        });
      }
      if (!ideContri.nrInsc) {
        erros.push({
          linha: idx, registro: ev.tipo,
          mensagem: `Evento ${ev.tipo}: <nrInsc> (CNPJ/CPF do contribuinte) obrigatório não informado em ideContri.`,
          severidade: 'erro'
        });
      } else {
        const doc = String(ideContri.nrInsc).replace(/\D/g, '');
        const tpInsc = String(ideContri.tpInsc);
        if (tpInsc === '1' && doc.length !== 14) {
          erros.push({
            linha: idx, registro: ev.tipo,
            mensagem: `Evento ${ev.tipo}: CNPJ inválido em <nrInsc>: "${ideContri.nrInsc}" (esperado 14 dígitos, encontrado ${doc.length}).`,
            severidade: 'erro'
          });
        }
        if (tpInsc === '2' && doc.length !== 11) {
          erros.push({
            linha: idx, registro: ev.tipo,
            mensagem: `Evento ${ev.tipo}: CPF inválido em <nrInsc>: "${ideContri.nrInsc}" (esperado 11 dígitos, encontrado ${doc.length}).`,
            severidade: 'erro'
          });
        }
      }
    }

    // --- Validações específicas por evento ---

    if (ev.tipo === 'R-1000') {
      const infoContri = d.infoContri;
      if (!infoContri) {
        erros.push({
          linha: idx, registro: 'R-1000',
          mensagem: 'Evento R-1000: <infoContri> obrigatório não encontrado.',
          severidade: 'erro'
        });
      } else {
        // Deve ter inclusao, alteracao ou exclusao
        if (!infoContri.inclusao && !infoContri.alteracao && !infoContri.exclusao) {
          erros.push({
            linha: idx, registro: 'R-1000',
            mensagem: 'Evento R-1000: <infoContri> deve conter <inclusao>, <alteracao> ou <exclusao>.',
            severidade: 'erro'
          });
        }
        const operacao = infoContri.inclusao || infoContri.alteracao || infoContri.exclusao;
        if (operacao && !operacao.idePeriodo) {
          erros.push({
            linha: idx, registro: 'R-1000',
            mensagem: 'Evento R-1000: <idePeriodo> (período de validade) obrigatório não encontrado.',
            severidade: 'erro'
          });
        }
      }
    }

    if (ev.tipo === 'R-2010') {
      if (!d.infoTomador) {
        erros.push({
          linha: idx, registro: 'R-2010',
          mensagem: 'Evento R-2010: <infoTomador> obrigatório não encontrado.',
          severidade: 'erro'
        });
      }
    }

    if (ev.tipo === 'R-2020') {
      if (!d.infoPrestador) {
        erros.push({
          linha: idx, registro: 'R-2020',
          mensagem: 'Evento R-2020: <infoPrestador> obrigatório não encontrado.',
          severidade: 'erro'
        });
      }
    }

    if (ev.tipo === 'R-2060') {
      if (!d.infoCPRB) {
        erros.push({
          linha: idx, registro: 'R-2060',
          mensagem: 'Evento R-2060: <infoCPRB> obrigatório não encontrado.',
          severidade: 'erro'
        });
      }
    }

    if (ev.tipo === 'R-2099') {
      if (!d.infoFechamento) {
        erros.push({
          linha: idx, registro: 'R-2099',
          mensagem: 'Evento R-2099: <infoFechamento> obrigatório não encontrado.',
          severidade: 'erro'
        });
      } else {
        const fech = d.infoFechamento;
        // evtFech tem indExcApuracao: 1=sim, 2=não
        if (fech.fechFisco === undefined && fech.evtFech === undefined) {
          avisos.push({
            linha: idx, registro: 'R-2099',
            mensagem: 'Evento R-2099: detalhes do fechamento podem estar incompletos.',
            severidade: 'aviso'
          });
        }
      }
    }

    // Validar atributo Id do evento (formato ID1XXXXXXXXXXX)
    const idAttr = d['@_id'] || d['@_Id'];
    if (!idAttr) {
      avisos.push({
        linha: idx, registro: ev.tipo,
        mensagem: `Evento ${ev.tipo}: atributo "id" não encontrado no elemento do evento.`,
        severidade: 'aviso'
      });
    }
  }

  // --- Verificar presença de R-2099 (fechamento) ---
  if (eventosEncontrados.length > 0 && !eventosEncontrados.some((e) => e.tipo === 'R-2099')) {
    avisos.push({
      linha: 0, registro: 'R-2099',
      mensagem: 'Evento de Fechamento (R-2099) não encontrado. É obrigatório para fechamento do período.',
      severidade: 'aviso'
    });
  }

  estatisticas.linhasComErro = erros.length;
  estatisticas.linhasComAviso = avisos.length;

  const resultadoReinf = {
    success: true,
    nomeArquivo: nomeArquivo || 'arquivo_reinf.xml',
    tipoDetectado: 'REINF',
    isValid: erros.length === 0,
    erros,
    avisos,
    estatisticas,
    resumo: {
      totalLinhas: eventosEncontrados.length,
      totalErros: erros.length,
      totalAvisos: avisos.length,
      blocosEncontrados: [...new Set(eventosEncontrados.map((e) => e.tipo.substring(0, 3)))],
      registrosUnicos: Object.keys(estatisticas.registros).length
    }
  };
  if (autoFix && (erros.length > 0 || avisos.length > 0)) {
    resultadoReinf.conteudo_corrigido = corrigirConteudo(conteudo, 'REINF');
  }
  return Response.json(resultadoReinf);
}

// ===================== REGISTROS CONHECIDOS POR TIPO =====================

const REG_FISCAL = [
  '0000','0001','0002','0005','0015','0100','0150','0175','0190','0200','0205','0206','0210','0220',
  '0300','0305','0400','0450','0460','0500','0600','0990',
  '1001','1010','1020','1050','1100','1105','1110','1115','1120','1150','1160','1165','1200','1210','1220','1250','1255','1300','1310','1320','1350','1360','1370','1390','1400','1500','1510','1520','1600','1601','1700','1800','1809','1900','1990',
  'B001','B020','B025','B030','B035','B350','B420','B440','B460','B470','B500','B510','B990',
  'C001','C100','C101','C105','C106','C107','C108','C109','C110','C111','C112','C113','C114','C115','C116','C117','C118','C119','C120','C130','C140','C160','C165','C170','C171','C172','C173',
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
  '0000','0001','0035','0100','0110','0111','0120','0140','0150','0175','0180','0190','0200','0205','0206','0208','0210','0220',
  '0300','0305','0400','0450','0460','0500','0600','0990',
  // Bloco A: Documentos Fiscais – Serviços (ISS)
  'A001','A010','A100','A110','A111','A112','A120','A170','A990',
  // Bloco C: Documentos Fiscais I – Mercadorias (ICMS/IPI)
  'C001','C010','C100','C110','C111','C112','C113','C114','C115','C116','C117','C118','C119','C120','C130','C140','C141',
  'C160','C165','C170','C171','C172','C173','C174','C175','C176','C177','C178','C179','C180','C181','C185','C188',
  'C190','C191','C195','C198','C199','C380','C381','C385','C390','C395','C396','C400','C405','C410','C420','C425',
  'C460','C465','C470','C490','C495','C500','C510','C590','C600','C601','C610','C690','C700','C800','C810','C850',
  'C860','C890','C990',
  // Bloco D: Documentos Fiscais II – Serviços (ICMS)
  'D001','D010','D100','D101','D110','D120','D130','D140','D150','D160','D161','D162','D170','D180','D190',
  'D195','D197','D198','D199','D300','D301','D310','D350','D360','D370','D390','D400','D410','D411','D420',
  'D500','D501','D510','D520','D530','D590','D990',
  // Bloco F: Outras Receitas e Operações
  'F001','F010','F100','F111','F120','F130','F150','F200','F205','F210','F211','F500','F510','F525','F530',
  'F550','F560','F570','F580','F590','F600','F700','F800','F990',
  // Bloco I: Instituições Financeiras e Assemelhadas
  'I001','I010','I100','I200','I300','I990',
  // Bloco M: Apuração da Contribuição (PIS/COFINS)
  'M001','M010','M100','M105','M110','M115','M200','M205','M210','M211','M215','M220','M225','M230','M300','M350','M400',
  'M410','M500','M505','M510','M515','M600','M605','M610','M611','M615','M620','M625','M630','M700','M800','M810','M990',
  // Bloco P: Apuração da Contribuição Previdenciária sobre a Receita Bruta
  'P001','P010','P100','P110','P199','P200','P210','P220','P230','P990',
  // Bloco 1: Controle de Saldos
  '1001','1010','1020','1050','1100','1101','1105','1110','1115','1120','1150','1160','1165','1200','1210','1220',
  '1250','1255','1300','1310','1320','1350','1360','1370','1390','1400','1500','1501','1505','1510','1520',
  '1600','1601','1700','1800','1900','1990',
  '1C001','1C010','1C100','1C110','1C120','1C170','1C180','1C190','1C300','1C310','1C350','1C500','1C990',
  '1D001','1D010','1D100','1D300','1D350','1D500','1D990',
  // Bloco 9: Encerramento
  '9001','9900','9990','9999'
];

const REG_ECD = [
  '0000','0001','0007','0020','0100','0150','0180','0200','0205','0990',
  'I001','I010','I012','I015','I020','I030','I050','I051','I052','I053','I075','I100','I150','I151','I155',
  'I157','I200','I250','I300','I310','I350','I355','I990',
  'J001','J005','J030','J050','J051','J052','J053','J100','J150','J200','J210','J215','J300','J310','J400',
  'J410','J420','J430','J435','J450','J460','J470','J480','J500','J510','J520','J530','J532','J800','J801',
  'J900','J930','J932','J990',
  'K001','K100','K200','K300','K990',
  '9001','9900','9990','9999'
];

const REG_ECF = [
  '0000','0001','0010','0020','0021','0030','0040','0045','0050','0060','0070','0080','0090','0100','0110',
  '0120','0140','0150','0175','0180','0190','0200','0205','0208','0400','0450','0500','0600','0990',
  'A001','A010','A100','A110','A111','A120','A170','A990',
  'C001','C010','C100','C110','C120','C130','C140','C150','C160','C170','C180','C190','C195','C197','C990',
  'E001','E010','E020','E030','E040','E050','E060','E080','E090','E100','E110','E111','E115','E116','E200',
  'E210','E220','E230','E240','E250','E300','E310','E311','E312','E313','E316','E500','E510','E520','E530','E990',
  'G001','G110','G125','G130','G140','G990',
  'K001','K030','K100','K155','K156','K200','K990',
  'L001','L010','L030','L100','L200','L210','L300','L990',
  'M001','M010','M030','M100','M200','M300','M350','M400','M410','M500','M510','M550','M600','M700','M800','M810','M990',
  'P001','P030','P100','P200','P990',
  'Q001','Q010','Q100','Q200','Q990',
  'T001','T010','T020','T030','T990',
  'U001','U010','U030','U040','U080','U081','U100','U150','U180','U990',
  'Y001','Y010','Y020','Y030','Y040','Y050','Y530','Y540','Y550','Y560','Y570','Y580','Y590','Y600','Y612',
  'Y620','Y630','Y640','Y650','Y660','Y665','Y670','Y680','Y690','Y720','Y730','Y750','Y760','Y800','Y820','Y990',
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
  ECD: ['0','I','J','9'],
  ECF: ['0','A','C','E','G','K','L','M','P','Q','T','U','Y','9']
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

// ===================== VALIDAÇÃO DIME-SC =====================

const REG_DIMESC = [
  '01','03','04','05','11','14',
  '20','21','30','31','35',
  '45','46','50','51',
  '80','81','90'
];

function isNumDime(val) {
  if (!val || val.length === 0) return true;
  return !isNaN(parseFloat(val.replace(',', '.')));
}

function validarDimeSC(linhas, nomeArquivo, autoFix, conteudoOriginal) {
  const erros = [];
  const avisos = [];
  const estatisticas = {
    totalLinhas: linhas.length,
    registros: {},
    linhasComErro: 0,
    linhasComAviso: 0
  };

  // Abertura e encerramento
  const camposPrim = linhas[0].split('|').filter((c) => c !== '');
  if (camposPrim[0] !== '01') {
    erros.push({
      linha: 1, registro: camposPrim[0] || '?',
      mensagem: 'O arquivo DIME-SC deve começar com o registro |01| (Identificação do Contribuinte).',
      severidade: 'erro'
    });
  }
  const camposUlt = linhas[linhas.length - 1].split('|').filter((c) => c !== '');
  if (camposUlt[0] !== '90') {
    erros.push({
      linha: linhas.length, registro: camposUlt[0] || '?',
      mensagem: 'O arquivo DIME-SC deve terminar com o registro |90| (Encerramento).',
      severidade: 'erro'
    });
  }

  let linhaAtual = 0;
  let regAnterior = '';

  for (const linha of linhas) {
    linhaAtual++;
    const campos = linha.split('|').filter((c) => c !== '');
    if (campos.length === 0) continue;
    const reg = campos[0];

    estatisticas.registros[reg] = (estatisticas.registros[reg] || 0) + 1;

    // Formato: deve iniciar e terminar com pipe
    if (!linha.startsWith('|') || !linha.endsWith('|')) {
      erros.push({
        linha: linhaAtual, registro: reg,
        mensagem: 'Linha mal formatada: deve iniciar e terminar com o caractere | (pipe).',
        severidade: 'erro'
      });
    }

    // Ordenação: registros devem estar em ordem não-decrescente
    if (regAnterior && reg < regAnterior) {
      erros.push({
        linha: linhaAtual, registro: reg,
        mensagem: `Registro "${reg}" aparece após "${regAnterior}". Os registros da DIME-SC devem seguir ordem crescente.`,
        severidade: 'erro'
      });
    }
    if (reg > regAnterior) regAnterior = reg;

    // --- Registro 01: Identificação do Contribuinte ---
    if (reg === '01') {
      // |01|CNPJ/CPF|IE|RazaoSocial|UF|Municipio|Regime|MesAno|...
      if (campos.length < 8) {
        avisos.push({
          linha: linhaAtual, registro: '01',
          mensagem: `Registro 01 incompleto: esperado mínimo de 8 campos, encontrado ${campos.length}.`,
          severidade: 'aviso'
        });
      }
      // CNPJ (14 dígitos) ou CPF (11 dígitos)
      if (campos[1]) {
        const doc = campos[1].replace(/\D/g, '');
        if (doc.length !== 14 && doc.length !== 11) {
          erros.push({
            linha: linhaAtual, registro: '01',
            mensagem: `CNPJ/CPF inválido: "${campos[1]}" (esperado 11 ou 14 dígitos, encontrado ${doc.length}).`,
            severidade: 'erro'
          });
        }
      }
      // UF deve ter 2 caracteres
      if (campos[4] && campos[4].length !== 2) {
        erros.push({
          linha: linhaAtual, registro: '01',
          mensagem: `UF inválida: "${campos[4]}" (deve ter 2 caracteres).`,
          severidade: 'erro'
        });
      }
      // Mês/Ano de apuração (MMAAAA) — aceita 6 dígitos ou formato MM/AAAA
      if (campos[7]) {
        const ma = campos[7].replace(/\D/g, '');
        if (ma.length !== 6) {
          erros.push({
            linha: linhaAtual, registro: '01',
            mensagem: `Mês/Ano de apuração inválido: "${campos[7]}" (formato esperado: MMAAAA).`,
            severidade: 'erro'
          });
        } else {
          const mes = parseInt(ma.substring(0, 2), 10);
          if (mes < 1 || mes > 12) {
            erros.push({
              linha: linhaAtual, registro: '01',
              mensagem: `Mês de apuração inválido: ${mes} (deve estar entre 01 e 12).`,
              severidade: 'erro'
            });
          }
        }
      }
    }

    // --- Registro 03: Apuração do ICMS (normal) ---
    if (reg === '03') {
      // Campos 2+ são valores numéricos de débitos/créditos
      for (let i = 2; i < campos.length; i++) {
        if (!isNumDime(campos[i])) {
          erros.push({
            linha: linhaAtual, registro: '03',
            mensagem: `Valor numérico inválido no campo ${i + 1}: "${campos[i]}".`,
            severidade: 'erro'
          });
        }
      }
    }

    // --- Registro 04: Operações próprias por CFOP ---
    if (reg === '04') {
      // |04|CFOP|ValorContabil|BaseCalculo|ImpostoDebitado|IsentasNaoTrib|Outras|
      if (campos.length < 7) {
        avisos.push({
          linha: linhaAtual, registro: '04',
          mensagem: `Registro 04 incompleto: esperado mínimo de 7 campos, encontrado ${campos.length}.`,
          severidade: 'aviso'
        });
      }
      // CFOP deve ter 4 dígitos
      if (campos[1] && !/^\d{4}$/.test(campos[1])) {
        erros.push({
          linha: linhaAtual, registro: '04',
          mensagem: `CFOP inválido: "${campos[1]}" (deve ter 4 dígitos numéricos).`,
          severidade: 'erro'
        });
      }
      // Validar valores numéricos (campos 2-6)
      for (let i = 2; i < Math.min(campos.length, 7); i++) {
        if (!isNumDime(campos[i])) {
          erros.push({
            linha: linhaAtual, registro: '04',
            mensagem: `Valor numérico inválido no campo ${i + 1}: "${campos[i]}".`,
            severidade: 'erro'
          });
        }
      }
    }

    // --- Registro 05: Apuração da Substituição Tributária ---
    if (reg === '05') {
      for (let i = 2; i < campos.length; i++) {
        if (!isNumDime(campos[i])) {
          erros.push({
            linha: linhaAtual, registro: '05',
            mensagem: `Valor numérico inválido no campo ${i + 1}: "${campos[i]}".`,
            severidade: 'erro'
          });
        }
      }
    }

    // --- Registro 90: Encerramento ---
    if (reg === '90') {
      if (campos[1]) {
        const totalDeclarado = parseInt(campos[1], 10);
        if (!isNaN(totalDeclarado) && totalDeclarado !== linhas.length) {
          erros.push({
            linha: linhaAtual, registro: '90',
            mensagem: `Total de registros no registro 90 (${totalDeclarado}) não confere com o total de linhas processadas (${linhas.length}).`,
            severidade: 'erro'
          });
        }
      }
    }

    // Registro desconhecido
    if (!REG_DIMESC.includes(reg)) {
      avisos.push({
        linha: linhaAtual, registro: reg,
        mensagem: `Registro "${reg}" não é reconhecido na estrutura DIME-SC.`,
        severidade: 'aviso'
      });
    }
  }

  // Unicidade de 01 e 90
  if ((estatisticas.registros['01'] || 0) > 1) {
    erros.push({
      linha: 0, registro: '01',
      mensagem: `Existe mais de um registro |01| no arquivo (${estatisticas.registros['01']} ocorrências). Deve haver exatamente um.`,
      severidade: 'erro'
    });
  }
  if ((estatisticas.registros['90'] || 0) > 1) {
    erros.push({
      linha: 0, registro: '90',
      mensagem: `Existe mais de um registro |90| no arquivo (${estatisticas.registros['90']} ocorrências). Deve haver exatamente um.`,
      severidade: 'erro'
    });
  }

  estatisticas.linhasComErro = erros.length;
  estatisticas.linhasComAviso = avisos.length;

  const resultadoDime = {
    success: true,
    nomeArquivo: nomeArquivo || 'arquivo_dime.txt',
    tipoDetectado: 'DIME-SC',
    isValid: erros.length === 0,
    erros,
    avisos,
    estatisticas,
    resumo: {
      totalLinhas: linhas.length,
      totalErros: erros.length,
      totalAvisos: avisos.length,
      blocosEncontrados: [],
      registrosUnicos: Object.keys(estatisticas.registros).length
    }
  };
  if (autoFix && (erros.length > 0 || avisos.length > 0)) {
    resultadoDime.conteudo_corrigido = corrigirConteudo(conteudoOriginal || linhas.join('\n'), 'DIME-SC');
  }
  return Response.json(resultadoDime);
}

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

  // Collect record counts
  const registros = {};
  for (const linha of linhas) {
    const campos = linha.split('|').filter(c => c !== '');
    if (campos.length === 0) continue;
    registros[campos[0]] = (registros[campos[0]] || 0) + 1;
  }

  if (tipoDetectado === 'DIME-SC') {
    // Fix 90 counter to match actual line count
    const total = linhas.length;
    linhas = linhas.map(linha => {
      const campos = linha.split('|').filter(c => c !== '');
      if (campos[0] === '90' && campos.length >= 2) {
        campos[1] = String(total);
        return '|' + campos.join('|') + '|';
      }
      return linha;
    });
    return linhas.join('\n');
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

  const resultado = [];
  for (const linha of sem9900) {
    const campos = linha.split('|').filter(c => c !== '');
    if (campos[0] === '9999') {
      resultado.push.apply(resultado, novas9900);
      campos[1] = String(novoTotal);
      resultado.push('|' + campos.join('|') + '|');
    } else {
      resultado.push(linha);
    }
  }
  return resultado.join('\n');
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

    // --- Detecção de DIME-SC (formato estadual de Santa Catarina) ---
    // DIME-SC: primeiro registro é "01" (não "0000" como no SPED)
    const camposDetect = linhas[0].split('|').filter((c) => c !== '');
    if (camposDetect[0] === '01') {
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
    let tipoDetectado = 'FISCAL';
    // SPED Contribuiões: presença de registros característicos (A100, F100, M200, M600)
    // ou blocos específicos (A, F, I, M, P) sem blocos fiscais (B, E, G, H, K)
    const temBlocoA = !!estatisticas.blocos['A'];
    const temBlocoF = !!estatisticas.blocos['F'];
    const temBlocoM = !!estatisticas.registros['M001'] || !!estatisticas.registros['M200'];
    const temBlocoP = !!estatisticas.blocos['P'];
    const temBlocoI = !!estatisticas.blocos['I'];
    const temBlocoB = !!estatisticas.blocos['B'];
    const temBlocoE = !!estatisticas.registros['E001'] || !!estatisticas.registros['E110'];
    const tem0110 = !!estatisticas.registros['0110'];
    if (estatisticas.registros['M200'] || estatisticas.registros['M600'] || estatisticas.registros['F100'] || estatisticas.registros['A100'] ||
        temBlocoA || temBlocoF || temBlocoM || temBlocoP || temBlocoI || tem0110) {
      // Distingue Contribuições de ECF: ECF tem U100/Y612/0010, Contribuições tem F100/F200/M200/M600
      if (estatisticas.registros['U100'] || estatisticas.registros['Y612'] || estatisticas.registros['0010']) {
        tipoDetectado = 'ECF';
      } else {
        tipoDetectado = 'CONTRIBUICOES';
      }
    } else if (estatisticas.registros['I030'] || estatisticas.registros['I050'] || estatisticas.registros['J100'] || estatisticas.registros['J930']) {
      tipoDetectado = 'ECD';
    } else if (estatisticas.registros['Y612'] || estatisticas.registros['U100'] || estatisticas.registros['U150']) {
      tipoDetectado = 'ECF';
    }

    const registrosValidos = REGISTROS_POR_TIPO[tipoDetectado] || REG_FISCAL;

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
        if (campos.length < 29) {
          avisos.push({
            linha: linhaAtual, registro: 'C100',
            mensagem: `Registro C100 com campos insuficientes: esperado mínimo de 29 campos, encontrado ${campos.length}.`,
            severidade: 'aviso'
          });
        }
        if (campos[1] && campos[1] !== '0' && campos[1] !== '1') {
          erros.push({
            linha: linhaAtual, registro: 'C100',
            mensagem: `IND_OPER inválido: "${campos[1]}" (deve ser 0=Entrada ou 1=Saída).`,
            severidade: 'erro'
          });
        }
        const codSitValidos = ['00','01','02','03','04','05','06','07','08'];
        if (campos[5] && !codSitValidos.includes(campos[5])) {
          erros.push({
            linha: linhaAtual, registro: 'C100',
            mensagem: `COD_SIT inválido: "${campos[5]}" (deve ser um dos códigos: ${codSitValidos.join(', ')}).`,
            severidade: 'erro'
          });
        }
        if (campos[12]) {
          const valor = campos[12].replace(',', '.');
          if (isNaN(parseFloat(valor))) {
            erros.push({
              linha: linhaAtual, registro: 'C100',
              mensagem: `VL_DOC inválido: "${campos[12]}" não é um valor numérico válido.`,
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
        // |0140|CNPJ|NOME|...
        if (campos.length < 3) {
          avisos.push({
            linha: linhaAtual, registro: '0140',
            mensagem: `Registro 0140 incompleto: esperado mínimo de 3 campos, encontrado ${campos.length}.`,
            severidade: 'aviso'
          });
        }
        validarCpfCnpj(campos[1], '0140', linhaAtual, erros, 'CNPJ estabelecimento');
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

      if (registro === 'M100' && tipoDetectado === 'CONTRIBUICOES') {
        // |M100|COD_CRED|IND_CRED_ORI|VL_BC_PIS|ALIQ_PIS|VL_PIS|...
        if (campos.length < 8) {
          avisos.push({
            linha: linhaAtual, registro: 'M100',
            mensagem: `Registro M100 incompleto: esperado mínimo de 8 campos, encontrado ${campos.length}.`,
            severidade: 'aviso'
          });
        }
        // COD_CRED (índice 1): 1-7
        if (campos[1] && !['1','2','3','4','5','6','7'].includes(campos[1])) {
          erros.push({
            linha: linhaAtual, registro: 'M100',
            mensagem: `COD_CRED inválido: "${campos[1]}" (deve estar entre 1 e 7).`,
            severidade: 'erro'
          });
        }
        // IND_CRED_ORI (índice 2): 0=Oper. próprio, 1=Eventos extemporâneos
        if (campos[2] && !['0','1'].includes(campos[2])) {
          erros.push({
            linha: linhaAtual, registro: 'M100',
            mensagem: `IND_CRED_ORI inválido: "${campos[2]}" (deve ser 0 ou 1).`,
            severidade: 'erro'
          });
        }
        validarValorNumerico(campos, 3, 6, 'M100', linhaAtual, erros);
      }

      if (registro === 'M500' && tipoDetectado === 'CONTRIBUICOES') {
        // |M500|COD_CRED|IND_CRED_ORI|VL_BC_COFINS|ALIQ_COFINS|VL_COFINS|...
        if (campos.length < 8) {
          avisos.push({
            linha: linhaAtual, registro: 'M500',
            mensagem: `Registro M500 incompleto: esperado mínimo de 8 campos, encontrado ${campos.length}.`,
            severidade: 'aviso'
          });
        }
        if (campos[1] && !['1','2','3','4','5','6','7'].includes(campos[1])) {
          erros.push({
            linha: linhaAtual, registro: 'M500',
            mensagem: `COD_CRED inválido: "${campos[1]}" (deve estar entre 1 e 7).`,
            severidade: 'erro'
          });
        }
        if (campos[2] && !['0','1'].includes(campos[2])) {
          erros.push({
            linha: linhaAtual, registro: 'M500',
            mensagem: `IND_CRED_ORI inválido: "${campos[2]}" (deve ser 0 ou 1).`,
            severidade: 'erro'
          });
        }
        validarValorNumerico(campos, 3, 6, 'M500', linhaAtual, erros);
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
        if (campos.length < 14) {
          avisos.push({
            linha: linhaAtual, registro: 'A100',
            mensagem: `Registro A100 incompleto: esperado mínimo de 14 campos, encontrado ${campos.length}.`,
            severidade: 'aviso'
          });
        }
        // IND_OPER campo 3 (índice 2)
        if (campos[2] && !['0','1'].includes(campos[2])) {
          erros.push({
            linha: linhaAtual, registro: 'A100',
            mensagem: `IND_OPER inválido: "${campos[2]}" (deve ser 0=Entrada ou 1=Saída).`,
            severidade: 'erro'
          });
        }
        validarCpfCnpj(campos[4], 'A100', linhaAtual, erros, 'CPF/CNPJ participante');
      }

      if (registro === 'A170' && tipoDetectado === 'CONTRIBUICOES') {
        if (campos.length < 6) {
          avisos.push({
            linha: linhaAtual, registro: 'A170',
            mensagem: `Registro A170 incompleto: esperado mínimo de 6 campos, encontrado ${campos.length}.`,
            severidade: 'aviso'
          });
        }
        // VL_ITEM campo 4 (índice 3), VL_DESC campo 5 (índice 4)
        validarValorNumerico(campos, 3, 5, 'A170', linhaAtual, erros);
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
        // Receitas isentas PIS
        if (campos.length < 5) {
          avisos.push({
            linha: linhaAtual, registro: 'M400',
            mensagem: `Registro M400 incompleto: esperado mínimo de 5 campos, encontrado ${campos.length}.`,
            severidade: 'aviso'
          });
        }
        validarValorNumerico(campos, 3, 4, 'M400', linhaAtual, erros);
      }

      if (registro === 'M800' && tipoDetectado === 'CONTRIBUICOES') {
        // Receitas isentas COFINS
        if (campos.length < 5) {
          avisos.push({
            linha: linhaAtual, registro: 'M800',
            mensagem: `Registro M800 incompleto: esperado mínimo de 5 campos, encontrado ${campos.length}.`,
            severidade: 'aviso'
          });
        }
        validarValorNumerico(campos, 3, 4, 'M800', linhaAtual, erros);
      }

      // === SPED ECD: I030, I050, I150, I155, I200, I250, J005, J100, J930 ===

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
        // Plano de contas
        if (campos.length < 8) {
          avisos.push({
            linha: linhaAtual, registro: 'I050',
            mensagem: `Registro I050 (plano de contas) incompleto: esperado mínimo de 8 campos, encontrado ${campos.length}.`,
            severidade: 'aviso'
          });
        }
        // DT_ALT (índice 1)
        validarData8(campos[1], 'I050', linhaAtual, erros);
        // IND_NAT (índice 4) deve ser 01-10
        if (campos[4] && !/^0[1-9]$|^10$/.test(campos[4])) {
          erros.push({
            linha: linhaAtual, registro: 'I050',
            mensagem: `IND_NAT_GRUPO inválido: "${campos[4]}" (deve estar entre 01 e 10).`,
            severidade: 'erro'
          });
        }
      }

      if (registro === 'I155' && tipoDetectado === 'ECD') {
        // Detalhes de saldos
        if (campos.length < 7) {
          avisos.push({
            linha: linhaAtual, registro: 'I155',
            mensagem: `Registro I155 (detalhes de saldos) incompleto: esperado mínimo de 7 campos, encontrado ${campos.length}.`,
            severidade: 'aviso'
          });
        }
        // IND_DC (índice 6) deve ser D ou C
        if (campos[6] && !['D','C'].includes(campos[6])) {
          erros.push({
            linha: linhaAtual, registro: 'I155',
            mensagem: `IND_DC inválido: "${campos[6]}" (deve ser D=Devedor ou C=Credor).`,
            severidade: 'erro'
          });
        }
        validarValorNumerico(campos, 5, 6, 'I155', linhaAtual, erros);
      }

      if (registro === 'I250' && tipoDetectado === 'ECD') {
        // Lançamento contábil
        if (campos.length < 5) {
          avisos.push({
            linha: linhaAtual, registro: 'I250',
            mensagem: `Registro I250 (lançamento contábil) incompleto: esperado mínimo de 5 campos, encontrado ${campos.length}.`,
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

      if (registro === 'J100' && tipoDetectado === 'ECD') {
        // |J100|DT_INI|DT_FIN|COD_CTA|COD_CTA_RES|VL_SLD_FIN|IND_DC|...
        if (campos.length < 7) {
          avisos.push({
            linha: linhaAtual, registro: 'J100',
            mensagem: `Registro J100 (balancete) incompleto: esperado mínimo de 7 campos, encontrado ${campos.length}.`,
            severidade: 'aviso'
          });
        }
        if (campos[6] && !['D','C'].includes(campos[6])) {
          erros.push({
            linha: linhaAtual, registro: 'J100',
            mensagem: `IND_DC inválido: "${campos[6]}" (deve ser D=Devedor ou C=Credor).`,
            severidade: 'erro'
          });
        }
        validarValorNumerico(campos, 5, 6, 'J100', linhaAtual, erros);
      }

      if (registro === 'J150' && tipoDetectado === 'ECD') {
        // |J150|DT_INI|DT_FIN|COD_CTA|COD_CTA_RES|VL_DEB|VL_CRED|IND_VL|...
        if (campos.length < 8) {
          avisos.push({
            linha: linhaAtual, registro: 'J150',
            mensagem: `Registro J150 (demonstração do resultado) incompleto: esperado mínimo de 8 campos, encontrado ${campos.length}.`,
            severidade: 'aviso'
          });
        }
        if (campos[7] && !['D','C'].includes(campos[7])) {
          erros.push({
            linha: linhaAtual, registro: 'J150',
            mensagem: `IND_VL inválido: "${campos[7]}" (deve ser D=Despesa ou C=Receita).`,
            severidade: 'erro'
          });
        }
        validarValorNumerico(campos, 5, 7, 'J150', linhaAtual, erros);
      }

      if (registro === 'J930' && tipoDetectado === 'ECD') {
        // |J930|NOME|CPF|IDENT_QUALIF|QUALIF|COD_ASSIN|...
        if (campos.length < 6) {
          avisos.push({
            linha: linhaAtual, registro: 'J930',
            mensagem: `Registro J930 (signatários) incompleto: esperado mínimo de 6 campos, encontrado ${campos.length}.`,
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
      }

      // === SPED ECF: 0010, U100, U150, U180, Y612, Y620, Y650 ===

      if (registro === '0010' && tipoDetectado === 'ECF') {
        // Parâmetros de tributação
        if (campos.length < 4) {
          avisos.push({
            linha: linhaAtual, registro: '0010',
            mensagem: `Registro 0010 (parâmetros) incompleto: esperado mínimo de 4 campos, encontrado ${campos.length}.`,
            severidade: 'aviso'
          });
        }
        // FORMA_APUR (índice 1) deve ser 1-4
        if (campos[1] && !['1','2','3','4'].includes(campos[1])) {
          erros.push({
            linha: linhaAtual, registro: '0010',
            mensagem: `FORMA_APUR inválido: "${campos[1]}" (deve ser 1 a 4).`,
            severidade: 'erro'
          });
        }
      }

      if (registro === 'U100' && tipoDetectado === 'ECF') {
        // |U100|COD_CCUS|COD_CTA_B|VL_SLD_FIN|IND_DC|...
        if (campos.length < 5) {
          avisos.push({
            linha: linhaAtual, registro: 'U100',
            mensagem: `Registro U100 (LALUR parte A) incompleto: esperado mínimo de 5 campos, encontrado ${campos.length}.`,
            severidade: 'aviso'
          });
        }
        if (campos[4] && !['D','C'].includes(campos[4])) {
          erros.push({
            linha: linhaAtual, registro: 'U100',
            mensagem: `IND_DC inválido: "${campos[4]}" (deve ser D=Devedor ou C=Credor).`,
            severidade: 'erro'
          });
        }
        validarValorNumerico(campos, 3, 4, 'U100', linhaAtual, erros);
      }

      if (registro === 'U150' && tipoDetectado === 'ECF') {
        // |U150|COD_CCUS|COD_CTA_B|VL_SLD_FIN|IND_DC|...
        if (campos.length < 5) {
          avisos.push({
            linha: linhaAtual, registro: 'U150',
            mensagem: `Registro U150 (contas parte B) incompleto: esperado mínimo de 5 campos, encontrado ${campos.length}.`,
            severidade: 'aviso'
          });
        }
        if (campos[4] && !['D','C'].includes(campos[4])) {
          erros.push({
            linha: linhaAtual, registro: 'U150',
            mensagem: `IND_DC inválido: "${campos[4]}" (deve ser D=Devedor ou C=Credor).`,
            severidade: 'erro'
          });
        }
        validarValorNumerico(campos, 3, 4, 'U150', linhaAtual, erros);
      }

      if (registro === 'U180' && tipoDetectado === 'ECF') {
        // |U180|COD_CCUS|COD_CTA_B|VL_SLD_FIN|IND_DC|
        if (campos.length < 5) {
          avisos.push({
            linha: linhaAtual, registro: 'U180',
            mensagem: `Registro U180 (saldos finais) incompleto: esperado mínimo de 5 campos, encontrado ${campos.length}.`,
            severidade: 'aviso'
          });
        }
        if (campos[4] && !['D','C'].includes(campos[4])) {
          erros.push({
            linha: linhaAtual, registro: 'U180',
            mensagem: `IND_DC inválido: "${campos[4]}" (deve ser D=Devedor ou C=Credor).`,
            severidade: 'erro'
          });
        }
        validarValorNumerico(campos, 3, 4, 'U180', linhaAtual, erros);
      }

      if (registro === 'Y612' && tipoDetectado === 'ECF') {
        // Detalhamento de receitas
        if (campos.length < 4) {
          avisos.push({
            linha: linhaAtual, registro: 'Y612',
            mensagem: `Registro Y612 (detalhamento de receitas) incompleto: esperado mínimo de 4 campos, encontrado ${campos.length}.`,
            severidade: 'aviso'
          });
        }
        validarValorNumerico(campos, 3, 4, 'Y612', linhaAtual, erros);
      }

      if (registro === 'Y620' && tipoDetectado === 'ECF') {
        // Demonstração do lucro real
        if (campos.length < 6) {
          avisos.push({
            linha: linhaAtual, registro: 'Y620',
            mensagem: `Registro Y620 (lucro real) incompleto: esperado mínimo de 6 campos, encontrado ${campos.length}.`,
            severidade: 'aviso'
          });
        }
        validarValorNumerico(campos, 4, 5, 'Y620', linhaAtual, erros);
      }

      if (registro === 'Y650' && tipoDetectado === 'ECF') {
        // Informações econômicas
        if (campos.length < 4) {
          avisos.push({
            linha: linhaAtual, registro: 'Y650',
            mensagem: `Registro Y650 incompleto: esperado mínimo de 4 campos, encontrado ${campos.length}.`,
            severidade: 'aviso'
          });
        }
        validarValorNumerico(campos, 3, 4, 'Y650', linhaAtual, erros);
      }

      // === Verificar registro desconhecido para o tipo detectado ===
      // Apenas alerta se o bloco do registro não pertencer ao conjunto válido do tipo detectado.
      // Registros individuais não listados são aceitos silenciosamente, pois o leiaute oficial
      // do SPED possui centenas de registros e nem todos estão catalogados nesta lista.
      {
        const blocoReg = registro.charAt(0);
        const blocosValidosTipo = BLOCOS_POR_TIPO[tipoDetectado] || BLOCOS_POR_TIPO.FISCAL;
        if (!blocosValidosTipo.includes(blocoReg) && registro !== '9999') {
          // já reportado no teste de blocos (seção 3a) — não duplica o erro aqui
        }
      }
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
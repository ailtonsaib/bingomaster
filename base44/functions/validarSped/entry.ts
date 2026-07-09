import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ===================== REGISTROS CONHECIDOS POR TIPO =====================

const REG_FISCAL = [
  '0000','0001','0005','0015','0100','0150','0175','0190','0200','0205','0206','0210','0220',
  '0300','0305','0400','0450','0460','0500','0600','0990',
  '1001','1010','1100','1105','1110','1150','1160','1990',
  'C001','C100','C110','C115','C120','C130','C140','C160','C165','C170','C171','C172','C173',
  'C174','C175','C176','C177','C178','C179','C190','C195','C197','C990',
  'D001','D100','D110','D120','D130','D140','D150','D160','D170','D180','D190','D195','D300',
  'D310','D350','D360','D370','D390','D400','D410','D420','D500','D510','D530','D590','D990',
  'E001','E100','E110','E111','E112','E113','E115','E116','E200','E210','E220','E230','E240',
  'E250','E300','E310','E311','E312','E313','E316','E500','E510','E520','E530','E531','E990',
  'G001','G110','G125','G126','G130','G140','G990',
  'H001','H005','H010','H020','H990',
  'K001','K100','K200','K210','K215','K220','K230','K235','K250','K255','K260','K265','K270','K275','K280','K990',
  '9001','9900','9990','9999'
];

const REG_CONTRIBUICOES = [
  '0000','0001','0035','0100','0150','0175','0190','0200','0205','0206','0208','0210','0220',
  '0300','0305','0400','0450','0460','0500','0600','0990',
  'A001','A010','A100','A110','A111','A120','A170','A990',
  'C001','C010','C100','C110','C120','C130','C140','C160','C165','C170','C171','C172','C173','C174','C175',
  'C176','C177','C178','C179','C180','C190','C195','C197','C990',
  'D001','D010','D100','D101','D110','D120','D130','D140','D150','D160','D161','D162','D170','D180','D190',
  'D195','D300','D301','D310','D350','D360','D370','D390','D400','D410','D411','D420','D500','D510','D520',
  'D530','D590','D990',
  'F001','F010','F100','F111','F120','F130','F150','F200','F500','F525','F550','F560','F600','F700','F800','F990',
  'M001','M010','M100','M105','M110','M115','M200','M205','M210','M215','M220','M225','M230','M300','M350','M400',
  'M410','M500','M505','M510','M515','M520','M525','M530','M550','M600','M700','M800','M810','M990',
  '1001','1010','1020','1050','1100','1105','1110','1115','1120','1500','1501','1505','1510','1700','1800','1900','1990',
  '1C001','1C010','1C100','1C110','1C120','1C170','1C180','1C190','1C300','1C310','1C350','1C500','1C990',
  '1D001','1D010','1D100','1D300','1D350','1D500','1D990',
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

function validarCnpj(cnpjRaw, registro, linhaAtual, erros, campo) {
  if (cnpjRaw && cnpjRaw.length > 0) {
    const cnpj = cnpjRaw.replace(/\D/g, '');
    if (cnpj.length !== 14) {
      erros.push({
        linha: linhaAtual,
        registro,
        mensagem: `CNPJ inválido${campo ? ` no campo ${campo}` : ''}: "${cnpjRaw}" (esperado 14 dígitos, encontrado ${cnpj.length}).`,
        severidade: 'erro'
      });
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

    const linhas = conteudo.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (linhas.length === 0) {
      return Response.json({ success: false, error: 'Arquivo vazio ou sem linhas válidas.' }, { status: 400 });
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

      // Validar ordenação de blocos (ordem alfabética crescente; bloco 9 é sempre o último)
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
      } else if (!entrouBloco9 && blocoAnterior && bloco < blocoAnterior) {
        erros.push({
          linha: linhaAtual,
          registro,
          mensagem: `Bloco "${bloco}" aparece após o bloco "${blocoAnterior}". Os blocos devem seguir a ordem alfabética crescente conforme o leiaute do SPED.`,
          severidade: 'erro'
        });
      }
      if (!entrouBloco9 && (!blocoAnterior || bloco > blocoAnterior)) {
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
    if (estatisticas.registros['M200'] || estatisticas.registros['M600'] || estatisticas.registros['F100'] || estatisticas.registros['A100']) {
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
          validarCnpj(campos[5], '0000', linhaAtual, erros, 'CNPJ');
          validarData8(campos[2], '0000', linhaAtual, erros);
          validarData8(campos[3], '0000', linhaAtual, erros);
        } else if (tipoDetectado === 'ECF') {
          // |0000|COD_SIT|DT_INI|DT_FIN|NOME|CNPJ|UF|...  → DT_INI=idx2, DT_FIN=idx3, CNPJ=idx5
          validarCnpj(campos[5], '0000', linhaAtual, erros, 'CNPJ');
          validarData8(campos[2], '0000', linhaAtual, erros);
          validarData8(campos[3], '0000', linhaAtual, erros);
        } else {
          // Fiscal / Contribuições: |0000|COD_VER|COD_FIN|DT_INI|DT_FIN|NOME|CNPJ|...  → DT_INI=idx3, DT_FIN=idx4, CNPJ=idx6
          validarCnpj(campos[6], '0000', linhaAtual, erros, 'CNPJ');
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
        validarCnpj(campos[4], '0150', linhaAtual, erros, 'CNPJ');
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
        validarCnpj(campos[4], 'A100', linhaAtual, erros, 'CNPJ participante');
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
        validarCnpj(campos[7], 'I030', linhaAtual, erros, 'CNPJ');
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
      if (!registrosValidos.includes(registro) && registro !== '9999') {
        avisos.push({
          linha: linhaAtual,
          registro,
          mensagem: `Registro "${registro}" não é reconhecido na estrutura SPED ${tipoDetectado}.`,
          severidade: 'aviso'
        });
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

    return Response.json({
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
    });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

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
      linhasComAviso: 0,
    };

    // --- Validações estruturais ---

    // 1. Verificar se o arquivo começa com registro 0000
    const primeiraLinha = linhas[0];
    const camposPrimeira = primeiraLinha.split('|').filter((c) => c !== '');
    if (camposPrimeira[0] !== '0000') {
      erros.push({
        linha: 1,
        registro: camposPrimeira[0] || '?',
        mensagem: 'O arquivo deve começar com o registro |0000| (Abertura do arquivo digital).',
        severidade: 'erro',
      });
    }

    // 2. Verificar se termina com 9999
    const ultimaLinha = linhas[linhas.length - 1];
    const camposUltima = ultimaLinha.split('|').filter((c) => c !== '');
    if (camposUltima[0] !== '9999') {
      erros.push({
        linha: linhas.length,
        registro: camposUltima[0] || '?',
        mensagem: 'O arquivo deve terminar com o registro |9999| (Encerramento do arquivo digital).',
        severidade: 'erro',
      });
    }

    // 3. Validar cada linha
    let linhaAtual = 0;
    let contadorRegistros = 0;
    let blocoAtual = null;

    for (const linha of linhas) {
      linhaAtual++;
      const campos = linha.split('|').filter((c) => c !== '');

      if (campos.length === 0) continue;

      const registro = campos[0];
      const bloco = registro.charAt(0);

      // Atualizar bloco atual quando encontrar registro de abertura de bloco
      if (registro.match(/^0\d{3}$/) && registro !== '0000' && registro !== '0001' && registro !== '0990') {
        // Registro de abertura de bloco 0XXX
      }
      if (registro.match(/^\d001$/)) {
        // Abertura de bloco (ex: 0001, C001, E001, 9001)
      }
      if (registro.match(/^\d990$/)) {
        // Encerramento de bloco (ex: 0990, C990, E990, 9990)
      }
      if (registro === '9999') {
        // Último registro - contador de linhas
        const totalDeclarado = parseInt(campos[1], 10);
        if (!isNaN(totalDeclarado) && totalDeclarado !== linhas.length) {
          erros.push({
            linha: linhaAtual,
            registro: '9999',
            mensagem: `Contador de registros no registro 9999 (${totalDeclarado}) não confere com o total de linhas processadas (${linhas.length}).`,
            severidade: 'erro',
          });
        }
        continue;
      }

      // Estatísticas por bloco e registro
      estatisticas.blocos[bloco] = (estatisticas.blocos[bloco] || 0) + 1;
      estatisticas.registros[registro] = (estatisticas.registros[registro] || 0) + 1;
      contadorRegistros++;

      // Validar estrutura da linha: deve começar e terminar com |
      if (!linha.startsWith('|') || !linha.endsWith('|')) {
        erros.push({
          linha: linhaAtual,
          registro,
          mensagem: 'Linha mal formatada: deve iniciar e terminar com o caractere | (pipe).',
          severidade: 'erro',
        });
        continue;
      }

      // Validações específicas por registro
      if (registro === '0000') {
        if (campos.length < 10) {
          erros.push({
            linha: linhaAtual,
            registro: '0000',
            mensagem: `Registro 0000 incompleto: esperado mínimo de 10 campos, encontrado ${campos.length}.`,
            severidade: 'erro',
          });
        }
        // Validar CNPJ (campo 7, índice 6)
        if (campos[6]) {
          const cnpj = campos[6].replace(/\D/g, '');
          if (cnpj.length !== 14) {
            erros.push({
              linha: linhaAtual,
              registro: '0000',
              mensagem: `CNPJ inválido no registro 0000: "${campos[6]}" (esperado 14 dígitos, encontrado ${cnpj.length}).`,
              severidade: 'erro',
            });
          }
        }
        // Validar datas (campos 4 e 5 - DT_INI e DT_FIN)
        if (campos[3] && !/^\d{8}$/.test(campos[3])) {
          erros.push({
            linha: linhaAtual,
            registro: '0000',
            mensagem: `Data inicial inválida: "${campos[3]}" (formato esperado: DDMMAAAA).`,
            severidade: 'erro',
          });
        }
        if (campos[4] && !/^\d{8}$/.test(campos[4])) {
          erros.push({
            linha: linhaAtual,
            registro: '0000',
            mensagem: `Data final inválida: "${campos[4]}" (formato esperado: DDMMAAAA).`,
            severidade: 'erro',
          });
        }
      }

      // Validar registro C100 - notas fiscais
      if (registro === 'C100') {
        if (campos.length < 29) {
          avisos.push({
            linha: linhaAtual,
            registro: 'C100',
            mensagem: `Registro C100 com campos insuficientes: esperado mínimo de 29 campos, encontrado ${campos.length}.`,
            severidade: 'aviso',
          });
        }
        // Validar IND_OPER (campo 2, índice 1) deve ser 0 ou 1
        if (campos[1] && campos[1] !== '0' && campos[1] !== '1') {
          erros.push({
            linha: linhaAtual,
            registro: 'C100',
            mensagem: `IND_OPER inválido: "${campos[1]}" (deve ser 0=Entrada ou 1=Saída).`,
            severidade: 'erro',
          });
        }
        // Validar COD_SIT (campo 6, índice 5)
        const codSitValidos = ['00', '01', '02', '03', '04', '05', '06', '07', '08'];
        if (campos[5] && !codSitValidos.includes(campos[5])) {
          erros.push({
            linha: linhaAtual,
            registro: 'C100',
            mensagem: `COD_SIT inválido: "${campos[5]}" (deve ser um dos códigos: ${codSitValidos.join(', ')}).`,
            severidade: 'erro',
          });
        }
        // Validar valor numérico de VL_DOC (campo 13, índice 12)
        if (campos[12]) {
          const valor = campos[12].replace(',', '.');
          if (isNaN(parseFloat(valor))) {
            erros.push({
              linha: linhaAtual,
              registro: 'C100',
              mensagem: `VL_DOC inválido: "${campos[12]}" não é um valor numérico válido.`,
              severidade: 'erro',
            });
          }
        }
      }

      // Validar registro C170 - itens
      if (registro === 'C170') {
        if (campos.length < 4) {
          avisos.push({
            linha: linhaAtual,
            registro: 'C170',
            mensagem: `Registro C170 com campos insuficientes: ${campos.length} campos.`,
            severidade: 'aviso',
          });
        }
      }

      // Validar registro 0150 - participantes
      if (registro === '0150') {
        if (campos.length < 6) {
          avisos.push({
            linha: linhaAtual,
            registro: '0150',
            mensagem: `Registro 0150 incompleto: esperado mínimo de 6 campos, encontrado ${campos.length}.`,
            severidade: 'aviso',
          });
        }
        // Validar CNPJ se presente (campo 5, índice 4)
        if (campos[4] && campos[4].length > 0) {
          const cnpjPart = campos[4].replace(/\D/g, '');
          if (cnpjPart.length !== 14) {
            erros.push({
              linha: linhaAtual,
              registro: '0150',
              mensagem: `CNPJ inválido no registro 0150: "${campos[4]}" (esperado 14 dígitos).`,
              severidade: 'erro',
            });
          }
        }
      }

      // Validar registro 0200 - produtos
      if (registro === '0200') {
        if (campos.length < 5) {
          avisos.push({
            linha: linhaAtual,
            registro: '0200',
            mensagem: `Registro 0200 incompleto: esperado mínimo de 5 campos, encontrado ${campos.length}.`,
            severidade: 'aviso',
          });
        }
      }

      // Validar registro E110 - apuração
      if (registro === 'E110') {
        if (campos.length < 15) {
          avisos.push({
            linha: linhaAtual,
            registro: 'E110',
            mensagem: `Registro E110 incompleto: esperado mínimo de 15 campos, encontrado ${campos.length}.`,
            severidade: 'aviso',
          });
        }
        // Validar valores numéricos
        for (let i = 1; i < Math.min(campos.length, 14); i++) {
          if (campos[i] && campos[i].length > 0) {
            const valor = campos[i].replace(',', '.');
            if (isNaN(parseFloat(valor))) {
              erros.push({
                linha: linhaAtual,
                registro: 'E110',
                mensagem: `Valor numérico inválido no campo ${i + 1}: "${campos[i]}".`,
                severidade: 'erro',
              });
            }
          }
        }
      }

      // Verificar registros desconhecidos
      const registrosConhecidos = [
        '0000', '0001', '0005', '0015', '0100', '0150', '0175', '0190', '0200', '0205',
        '0206', '0210', '0220', '0300', '0305', '0400', '0450', '0460', '0500', '0600',
        '0990', '1001', '1010', '1100', '1105', '1110', '1150', '1160', '1990', 'C001',
        'C100', 'C110', 'C115', 'C120', 'C130', 'C140', 'C160', 'C165', 'C170', 'C171',
        'C172', 'C173', 'C174', 'C175', 'C176', 'C177', 'C178', 'C179', 'C190', 'C195',
        'C197', 'C990', 'D001', 'D100', 'D110', 'D120', 'D130', 'D140', 'D150', 'D160',
        'D170', 'D180', 'D190', 'D195', 'D300', 'D310', 'D350', 'D360', 'D370', 'D390',
        'D400', 'D410', 'D420', 'D500', 'D510', 'D530', 'D590', 'D990', 'E001', 'E100',
        'E110', 'E111', 'E112', 'E113', 'E115', 'E116', 'E200', 'E210', 'E220', 'E230',
        'E240', 'E250', 'E300', 'E310', 'E311', 'E312', 'E313', 'E316', 'E500', 'E510',
        'E520', 'E530', 'E531', 'E990', 'G001', 'G110', 'G125', 'G126', 'G130', 'G140',
        'G990', 'H001', 'H005', 'H010', 'H020', 'H990', 'K001', 'K100', 'K200', 'K210',
        'K215', 'K220', 'K230', 'K235', 'K250', 'K255', 'K260', 'K265', 'K270', 'K275',
        'K280', 'K990', '9001', '9900', '9990', '9999'
      ];
      if (!registrosConhecidos.includes(registro)) {
        avisos.push({
          linha: linhaAtual,
          registro,
          mensagem: `Registro "${registro}" não reconhecido na estrutura SPED padrão.`,
          severidade: 'aviso',
        });
      }
    }

    // 4. Verificar consistência de blocos (abertura e encerramento)
    const blocosEsperados = ['0', 'C', 'E', '9'];
    for (const bloco of blocosEsperados) {
      const abertura = `${bloco}001`;
      const encerramento = `${bloco}990`;
      const temAbertura = linhas.some((l) => {
        const c = l.split('|').filter((x) => x !== '');
        return c[0] === abertura;
      });
      const temEncerramento = linhas.some((l) => {
        const c = l.split('|').filter((x) => x !== '');
        return c[0] === encerramento;
      });

      if (estatisticas.blocos[bloco] && estatisticas.blocos[bloco] > 0) {
        if (!temAbertura) {
          avisos.push({
            linha: 0,
            registro: abertura,
            mensagem: `Bloco ${bloco} possui registros mas não possui o registro de abertura |${abertura}|.`,
            severidade: 'aviso',
          });
        }
        if (!temEncerramento) {
          avisos.push({
            linha: 0,
            registro: encerramento,
            mensagem: `Bloco ${bloco} possui registros mas não possui o registro de encerramento |${encerramento}|.`,
            severidade: 'aviso',
          });
        }
      }
    }

    estatisticas.linhasComErro = erros.length;
    estatisticas.linhasComAviso = avisos.length;

    // Detectar tipo de SPED baseado nos registros
    let tipoDetectado = 'FISCAL';
    if (estatisticas.registros['M001'] || estatisticas.registros['M200'] || estatisticas.registros['M400']) {
      tipoDetectado = 'CONTRIBUICOES';
    } else if (estatisticas.registros['J001'] || estatisticas.registros['J100'] || estatisticas.registros['J200']) {
      tipoDetectado = 'ECD';
    } else if (estatisticas.registros['Y001'] || estatisticas.registros['Y612']) {
      tipoDetectado = 'ECF';
    }

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
        registrosUnicos: Object.keys(estatisticas.registros).length,
      },
    });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});
// ===================== VALIDAÇÃO DIME-SC =====================
// Layout oficial: Anexo II - Portaria SEF SC
// A DIME é um arquivo de POSIÇÃO FIXA (fixed-width), NÃO pipe-delimitado.
// Registro 20 = Contabilista (obrigatório, único, primeiro)
// Registro 21 = Início de declaração (obrigatório, um por declaração)
// Registro 98 = Fim da declaração (obrigatório, um por declaração)
// Registro 99 = Fechamento do arquivo (obrigatório, único, último)

export const REG_DIMESC = [
  '20','21','22','23','24','25','26','30','31','32','33','35','36','37',
  '41','42','46','47','48','49','50','51',
  '80','81','82','83','84','85',
  '98','99'
];

// Tamanhos mínimos de cada tipo de registro conforme layout DIME-SC
const DIME_REG_TAMANHO = {
  '20': 79,   // Dados do Contabilista
  '21': 85,   // Dados iniciais da declaração
  '22': 145,  // Valores Fiscais Entradas
  '23': 145,  // Valores Fiscais Saídas
  '24': 24,   // Resumo dos Valores Fiscais
  '25': 24,   // Resumo Apuração Débitos
  '26': 24,   // Resumo Apuração Créditos
  '30': 24,   // Cálculo do Imposto a Pagar ou Saldo Credor
  '31': 24,   // Débitos específicos
  '32': 24,   // Substituição Tributária
  '33': 54,   // Discriminação dos Pagamentos
  '35': 24,   // Crédito Presumido (DAICP)
  '36': 168,  // Fundos (FUMDES/Fundo Social)
  '37': 24,   // Apuração Fundos
  '41': 24,   // Créditos Acumulados
  '42': 24,   // Débitos por Reserva Crédito Acumulado
  '46': 41,   // Créditos por Autorizações Especiais
  '47': 26,   // Entradas de Extratores/Produtores
  '48': 29,   // Rateio do Valor Adicionado
  '49': 91,   // Entradas por UF
  '50': 108,  // Saídas por UF
  '51': 24,   // Exclusões do Valor Adicionado
  '80': 24,   // Resumo Livro Inventário/Receita Bruta
  '81': 24,   // Ativo
  '82': 24,   // Passivo
  '83': 24,   // Demonstração de Resultado
  '84': 24,   // Detalhamento das Despesas
  '85': 24,   // Contribuições FIA/FEI
  '98': 9,    // Encerramento da Declaração
  '99': 14    // Fechamento do Arquivo
};

export function validarDimeSC(linhas, nomeArquivo, autoFix, conteudoOriginal) {
  const erros = [];
  const avisos = [];
  const estatisticas = {
    totalLinhas: linhas.length,
    registros: {},
    linhasComErro: 0,
    linhasComAviso: 0
  };

  // --- 1. Verificar primeiro registro (deve ser "20" - Contabilista) ---
  const primeiraLinha = linhas[0];
  const tipoReg0 = primeiraLinha.substring(0, 2);
  if (tipoReg0 !== '20') {
    erros.push({
      linha: 1, registro: tipoReg0 || '?',
      mensagem: `O arquivo DIME-SC deve começar com o registro tipo "20" (Dados do Contabilista), encontrado: "${tipoReg0}".`,
      severidade: 'erro'
    });
  }

  // --- 2. Verificar último registro (deve ser "99" - Fechamento) ---
  const ultimaLinha = linhas[linhas.length - 1];
  const tipoRegUlt = ultimaLinha.substring(0, 2);
  if (tipoRegUlt !== '99') {
    erros.push({
      linha: linhas.length, registro: tipoRegUlt || '?',
      mensagem: `O arquivo DIME-SC deve terminar com o registro tipo "99" (Fechamento do Arquivo), encontrado: "${tipoRegUlt}".`,
      severidade: 'erro'
    });
  }

  let linhaAtual = 0;
  let declaracoesAbertas = 0;
  let declaracoesEncerradas = 0;

  for (const linha of linhas) {
    linhaAtual++;
    if (linha.trim().length === 0) continue;

    const tipoReg = linha.substring(0, 2);
    estatisticas.registros[tipoReg] = (estatisticas.registros[tipoReg] || 0) + 1;

    // Verificar tamanho esperado do registro
    const tamanhoEsperado = DIME_REG_TAMANHO[tipoReg];
    if (tamanhoEsperado && linha.length < tamanhoEsperado) {
      avisos.push({
        linha: linhaAtual, registro: tipoReg,
        mensagem: `Registro ${tipoReg} com tamanho insuficiente: esperado mínimo ${tamanhoEsperado} caracteres, encontrado ${linha.length}.`,
        severidade: 'aviso'
      });
    }

    // Registro desconhecido
    if (!REG_DIMESC.includes(tipoReg)) {
      avisos.push({
        linha: linhaAtual, registro: tipoReg,
        mensagem: `Registro "${tipoReg}" não é reconhecido no layout da DIME-SC (Anexo II - Portaria SEF SC).`,
        severidade: 'aviso'
      });
      continue;
    }

    // --- Registro 20: Dados do Contabilista ---
    // Campos: TipoReg(1-2) | Quadro/Brancos(3-4) | CPF(5-15) | Nome(16-65) | DataHora(66-79)
    if (tipoReg === '20') {
      if (linha.length >= 15) {
        const cpf = linha.substring(4, 15).trim();
        if (cpf.length > 0 && !/^\d{11}$/.test(cpf)) {
          erros.push({
            linha: linhaAtual, registro: '20',
            mensagem: `CPF do contabilista inválido: "${cpf}" (deve ter exatamente 11 dígitos numéricos, posições 5-15).`,
            severidade: 'erro'
          });
        }
      }
      if (linha.length >= 79) {
        const dataHora = linha.substring(65, 79).trim();
        if (dataHora.length > 0 && !/^\d{14}$/.test(dataHora)) {
          erros.push({
            linha: linhaAtual, registro: '20',
            mensagem: `Data/Hora inválida: "${dataHora}" (formato esperado: AAAAMMDDHHMMSS, 14 dígitos, posições 66-79).`,
            severidade: 'erro'
          });
        }
      }
    }

    // --- Registro 21: Dados iniciais da declaração ---
    // TipoReg(1-2) | Quadro(3-4) | Inscricao(5-13) | Nome(14-63) | Periodo(64-69) | TipoDecl(70) | Regime(71) | Porte(72) | Consolidada(73) | Centralizada(74) | TransfCredito(75) | CreditoPresumido(76) | CreditoIncentivo(77) | Movimento(78) | Substituto(79) | EscritaContabil(80) | QtdTrabalhadores(81-85)
    if (tipoReg === '21') {
      declaracoesAbertas++;
      if (linha.length >= 69) {
        const periodo = linha.substring(63, 69).trim();
        if (periodo.length > 0 && !/^\d{6}$/.test(periodo)) {
          erros.push({
            linha: linhaAtual, registro: '21',
            mensagem: `Período de referência inválido: "${periodo}" (formato esperado: MMAAAA, posições 64-69).`,
            severidade: 'erro'
          });
        } else if (periodo.length === 6) {
          const mes = parseInt(periodo.substring(0, 2), 10);
          if (mes < 1 || mes > 12) {
            erros.push({
              linha: linhaAtual, registro: '21',
              mensagem: `Mês do período inválido: ${mes} (deve estar entre 01 e 12).`,
              severidade: 'erro'
            });
          }
        }
      }
      if (linha.length >= 70) {
        const tipoDecl = linha.substring(69, 70).trim();
        if (tipoDecl && !['1','2','4'].includes(tipoDecl)) {
          erros.push({
            linha: linhaAtual, registro: '21',
            mensagem: `Tipo de declaração inválido: "${tipoDecl}" (deve ser 1=Normal, 2=Encerramento de Atividades, 4=Enquadramento no Simples Nacional, posição 70).`,
            severidade: 'erro'
          });
        }
      }
      if (linha.length >= 71) {
        const regime = linha.substring(70, 71).trim();
        if (regime && !['2','9'].includes(regime)) {
          erros.push({
            linha: linhaAtual, registro: '21',
            mensagem: `Regime de apuração inválido: "${regime}" (deve ser 2=Normal ou 9=Produtor Primário, posição 71).`,
            severidade: 'erro'
          });
        }
      }
      if (linha.length >= 78) {
        const movimento = linha.substring(77, 78).trim();
        if (movimento && !['1','2','3'].includes(movimento)) {
          erros.push({
            linha: linhaAtual, registro: '21',
            mensagem: `Campo Movimento inválido: "${movimento}" (deve ser 1=Sem movimento/sem saldos, 2=Sem movimento/com saldos, 3=Com movimento, posição 78).`,
            severidade: 'erro'
          });
        }
      }
      if (linha.length >= 79) {
        const substituto = linha.substring(78, 79).trim();
        if (substituto && !['1','2','3'].includes(substituto)) {
          erros.push({
            linha: linhaAtual, registro: '21',
            mensagem: `Substituto tributário inválido: "${substituto}" (deve ser 1=Sim, 2=Não, 3=Substituído Solidário, posição 79).`,
            severidade: 'erro'
          });
        }
      }
    }

    // --- Registro 22: Valores Fiscais Entradas ---
    // TipoReg(1-2) | Quadro(3-4) | CFOP(5-9) | ValorContabil(10-26) | BC(27-43) | ImpostoCreditado(44-60) | Isentas(61-77) | Outras(78-94) | BCRetido(95-111) | ImpostoRetido(112-128) | DifAliquota(129-145)
    if (tipoReg === '22') {
      if (linha.length >= 9) {
        const cfop = linha.substring(4, 9).trim();
        if (cfop && !/^\d{5}$/.test(cfop)) {
          erros.push({
            linha: linhaAtual, registro: '22',
            mensagem: `CFOP inválido: "${cfop}" (deve ter 5 dígitos numéricos, posições 5-9).`,
            severidade: 'erro'
          });
        }
        // Quadro deve ser "01"
        const quadro = linha.substring(2, 4).trim();
        if (quadro && quadro !== '01') {
          avisos.push({
            linha: linhaAtual, registro: '22',
            mensagem: `Quadro inválido: "${quadro}" (esperado "01" para Valores Fiscais Entradas, posições 3-4).`,
            severidade: 'aviso'
          });
        }
      }
    }

    // --- Registro 23: Valores Fiscais Saídas ---
    if (tipoReg === '23') {
      if (linha.length >= 9) {
        const cfop = linha.substring(4, 9).trim();
        if (cfop && !/^\d{5}$/.test(cfop)) {
          erros.push({
            linha: linhaAtual, registro: '23',
            mensagem: `CFOP inválido: "${cfop}" (deve ter 5 dígitos numéricos, posições 5-9).`,
            severidade: 'erro'
          });
        }
        const quadro = linha.substring(2, 4).trim();
        if (quadro && quadro !== '02') {
          avisos.push({
            linha: linhaAtual, registro: '23',
            mensagem: `Quadro inválido: "${quadro}" (esperado "02" para Valores Fiscais Saídas, posições 3-4).`,
            severidade: 'aviso'
          });
        }
      }
    }

    // --- Registro 33: Discriminação dos Pagamentos ---
    // TipoReg(1-2) | Quadro(3-4) | OrigemRecolhimento(5) | CodReceita(6-9) | Data(10-17) | Valor(18-34) | ClasseVencimento(35-39) | NumAcordo(40-54)
    if (tipoReg === '33') {
      if (linha.length >= 5) {
        const origem = linha.substring(4, 5).trim();
        if (origem && !['1','2','3'].includes(origem)) {
          erros.push({
            linha: linhaAtual, registro: '33',
            mensagem: `Origem do recolhimento inválida: "${origem}" (deve ser 1=Imposto, 2=Substituição Tributária, 3=Débitos Específicos, posição 5).`,
            severidade: 'erro'
          });
        }
      }
      if (linha.length >= 17) {
        const data = linha.substring(9, 17).trim();
        if (data && data !== '00000000' && !/^\d{8}$/.test(data)) {
          erros.push({
            linha: linhaAtual, registro: '33',
            mensagem: `Data de vencimento inválida: "${data}" (formato esperado: DDMMAAAA, posições 10-17).`,
            severidade: 'erro'
          });
        }
      }
    }

    // --- Registro 98: Encerramento da Declaração ---
    // TipoReg(1-2) | Brancos(3-4) | QtdRegistros(5-9)
    if (tipoReg === '98') {
      declaracoesEncerradas++;
      if (linha.length >= 9) {
        const qtd = linha.substring(4, 9).trim();
        if (qtd && !/^\d+$/.test(qtd)) {
          avisos.push({
            linha: linhaAtual, registro: '98',
            mensagem: `Quantidade de registros no encerramento inválida: "${qtd}" (deve ser numérico com 5 dígitos, posições 5-9).`,
            severidade: 'aviso'
          });
        }
      }
    }

    // --- Registro 99: Fechamento do Arquivo ---
    // TipoReg(1-2) | Brancos(3-4) | QtdRegistros(5-9) | QtdDeclaracoes(10-14)
    if (tipoReg === '99') {
      if (linha.length >= 9) {
        const qtdDeclarado = parseInt(linha.substring(4, 9).trim(), 10);
        if (!isNaN(qtdDeclarado) && qtdDeclarado !== linhas.length) {
          erros.push({
            linha: linhaAtual, registro: '99',
            mensagem: `Quantidade de registros no fechamento (${qtdDeclarado}) não confere com o total de linhas do arquivo (${linhas.length}).`,
            severidade: 'erro'
          });
        }
      }
      if (linha.length >= 14) {
        const qtdDeclaracoes = parseInt(linha.substring(9, 14).trim(), 10);
        if (!isNaN(qtdDeclaracoes) && qtdDeclaracoes !== declaracoesAbertas) {
          erros.push({
            linha: linhaAtual, registro: '99',
            mensagem: `Quantidade de declarações no fechamento (${qtdDeclaracoes}) não confere com o número de registros tipo 21 encontrados (${declaracoesAbertas}).`,
            severidade: 'erro'
          });
        }
      }
    }
  }

  // --- 3. Validações estruturais globais ---

  if ((estatisticas.registros['20'] || 0) > 1) {
    erros.push({
      linha: 0, registro: '20',
      mensagem: `Mais de um registro tipo 20 (Contabilista) no arquivo (${estatisticas.registros['20']} ocorrências). Deve haver exatamente um.`,
      severidade: 'erro'
    });
  }
  if (!estatisticas.registros['20']) {
    erros.push({
      linha: 0, registro: '20',
      mensagem: 'Registro tipo 20 (Dados do Contabilista) não encontrado. É obrigatório e deve ser o primeiro registro.',
      severidade: 'erro'
    });
  }
  if ((estatisticas.registros['99'] || 0) > 1) {
    erros.push({
      linha: 0, registro: '99',
      mensagem: `Mais de um registro tipo 99 (Fechamento) no arquivo (${estatisticas.registros['99']} ocorrências). Deve haver exatamente um.`,
      severidade: 'erro'
    });
  }
  if (!estatisticas.registros['99']) {
    erros.push({
      linha: 0, registro: '99',
      mensagem: 'Registro tipo 99 (Fechamento do Arquivo) não encontrado. É obrigatório e deve ser o último registro.',
      severidade: 'erro'
    });
  }
  if (declaracoesAbertas === 0) {
    erros.push({
      linha: 0, registro: '21',
      mensagem: 'Nenhum registro tipo 21 (Início de Declaração) encontrado. É obrigatório pelo menos uma declaração.',
      severidade: 'erro'
    });
  }
  if (declaracoesAbertas !== declaracoesEncerradas) {
    erros.push({
      linha: 0, registro: '98',
      mensagem: `Declarações abertas (tipo 21: ${declaracoesAbertas}) diferem das encerradas (tipo 98: ${declaracoesEncerradas}). Cada declaração deve ter um par 21/98.`,
      severidade: 'erro'
    });
  }

  estatisticas.linhasComErro = erros.length;
  estatisticas.linhasComAviso = avisos.length;

  return Response.json({
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
      registrosUnicos: Object.keys(estatisticas.registros).length,
      declaracoesEncontradas: declaracoesAbertas
    }
  });
}
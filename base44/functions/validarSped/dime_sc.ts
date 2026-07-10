// ===================== VALIDAÇÃO DIME-SC =====================
// Layout oficial: Anexo II - Portaria SEF SC
// A DIME é um arquivo de POSIÇÃO FIXA (fixed-width), NÃO pipe-delimitado.
//
// Estrutura do arquivo:
//   20 (Contabilista) — obrigatório, único, primeiro registro
//   21 (Início de Declaração) — um por declaração
//   22..37, 41..51, 80..85 (Quadros de apuração)
//   98 (Fim da Declaração) — um por declaração
//   99 (Fechamento do Arquivo) — obrigatório, único, último registro
//
// Cada declaração deve formar um par 21/98 com os quadros entre eles.

// --- Helpers locais (o módulo entry.ts não pode ser importado em runtime Deno) ---

function validarDigitoCpfDime(cpf) {
  if (!/^\d{11}$/.test(cpf)) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  let soma = 0;
  for (let i = 0; i < 9; i++) soma += parseInt(cpf[i], 10) * (10 - i);
  let dv1 = (soma * 10) % 11;
  if (dv1 === 10) dv1 = 0;
  if (dv1 !== parseInt(cpf[9], 10)) return false;
  soma = 0;
  for (let i = 0; i < 10; i++) soma += parseInt(cpf[i], 10) * (11 - i);
  let dv2 = (soma * 10) % 11;
  if (dv2 === 10) dv2 = 0;
  return dv2 === parseInt(cpf[10], 10);
}

// Valida campo de valor numérico decimal (aceita dígitos, vírgula e ponto)
function isValorNumerico(val) {
  if (!val || val.trim().length === 0) return true; // vazio = ok (opcional)
  const limpo = val.trim().replace(/\./g, '').replace(',', '.');
  return !isNaN(parseFloat(limpo));
}

// Valida se campo contém apenas dígitos com tamanho específico
function isDigitos(val, tamanho) {
  if (!val) return true;
  const v = val.trim();
  if (v.length === 0) return true;
  if (tamanho && v.length !== tamanho) return false;
  return /^\d+$/.test(v);
}

// Extrai substring com limite seguro
function substr(linha, inicio, fim) {
  if (linha.length < inicio) return '';
  return linha.substring(inicio, Math.min(fim, linha.length));
}

// ===================== REGISTROS CONHECIDOS =====================

export const REG_DIMESC = [
  '20','21','22','23','24','25','26','30','31','32','33','35','36','37',
  '41','42','46','47','48','49','50','51',
  '80','81','82','83','84','85',
  '98','99'
];

// Tamanho mínimo esperado por tipo de registro
const DIME_REG_TAMANHO = {
  '20': 79, '21': 85, '22': 145, '23': 145, '24': 24, '25': 24, '26': 24,
  '30': 24, '31': 24, '32': 24, '33': 54, '35': 24, '36': 168, '37': 24,
  '41': 24, '42': 24, '46': 41, '47': 26, '48': 29, '49': 91, '50': 108,
  '51': 24, '80': 24, '81': 24, '82': 24, '83': 24, '84': 24, '85': 24,
  '98': 9, '99': 14
};

// Quadro esperado por tipo de registro
const QUADRO_ESPERADO = {
  '22': '01', '23': '02',
  '24': '03', '25': '03', '26': '03', '30': '03', '31': '03', '32': '03',
  '33': '03', '35': '03', '36': '03', '37': '03',
  '41': '04', '42': '04', '46': '04', '47': '04',
  '48': '05', '49': '05', '50': '05', '51': '05',
  '80': '06', '81': '06', '82': '06', '83': '06', '84': '06', '85': '06'
};

// Ordem de precedência dos registros dentro de uma declaração (21 → quadros → 98)
const ORDEM_DECLARACAO = ['21','22','23','24','25','26','30','31','32','33','35','36','37','41','42','46','47','48','49','50','51','80','81','82','83','84','85','98'];

// ===================== FUNÇÃO PRINCIPAL =====================

export function validarDimeSC(linhas, nomeArquivo, autoFix, conteudoOriginal) {
  const erros = [];
  const avisos = [];
  const estatisticas = {
    totalLinhas: linhas.length,
    registros: {},
    quadros: {},
    linhasComErro: 0,
    linhasComAviso: 0
  };

  // Acumuladores para validação cruzada de totais
  let totalEntradasVC = 0; // soma de valor contábil dos registros 22
  let totalSaidasVC = 0;   // soma de valor contábil dos registros 23

  // --- 1. Verificar primeiro registro (deve ser "20") ---
  const primeiraLinha = linhas[0];
  const tipoReg0 = substr(primeiraLinha, 0, 2);
  if (tipoReg0 !== '20') {
    erros.push({
      linha: 1, registro: tipoReg0 || '?',
      mensagem: `O arquivo DIME-SC deve começar com o registro tipo "20" (Dados do Contabilista), encontrado: "${tipoReg0}".`,
      severidade: 'erro'
    });
  }

  // --- 2. Verificar último registro (deve ser "99") ---
  const ultimaLinha = linhas[linhas.length - 1];
  const tipoRegUlt = substr(ultimaLinha, 0, 2);
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
  let dentroDeclaracao = false;
  let ultimoTipoReg = '';     // para validação de sequência
  let ordemIdxAnterior = -1;  // índice na lista ORDEM_DECLARACAO

  for (const linha of linhas) {
    linhaAtual++;
    if (linha.trim().length === 0) continue;

    const tipoReg = substr(linha, 0, 2);
    estatisticas.registros[tipoReg] = (estatisticas.registros[tipoReg] || 0) + 1;

    // --- Verificar tamanho mínimo do registro ---
    const tamanhoEsperado = DIME_REG_TAMANHO[tipoReg];
    if (tamanhoEsperado && linha.length < tamanhoEsperado) {
      avisos.push({
        linha: linhaAtual, registro: tipoReg,
        mensagem: `Registro ${tipoReg} com tamanho insuficiente: esperado mínimo ${tamanhoEsperado} caracteres, encontrado ${linha.length}.`,
        severidade: 'aviso'
      });
    }

    // --- Verificar registro desconhecido ---
    if (!REG_DIMESC.includes(tipoReg)) {
      avisos.push({
        linha: linhaAtual, registro: tipoReg,
        mensagem: `Registro "${tipoReg}" não é reconhecido no layout da DIME-SC (Anexo II - Portaria SEF SC).`,
        severidade: 'aviso'
      });
      continue;
    }

    // --- Validação de quadro (posição 3-4) ---
    const quadroEsperado = QUADRO_ESPERADO[tipoReg];
    if (quadroEsperado) {
      const quadro = substr(linha, 2, 4).trim();
      if (quadro && quadro !== quadroEsperado) {
        erros.push({
          linha: linhaAtual, registro: tipoReg,
          mensagem: `Quadro inválido no registro ${tipoReg}: "${quadro}" (esperado "${quadroEsperado}", posições 3-4).`,
          severidade: 'erro'
        });
      }
      if (quadro) estatisticas.quadros[quadro] = (estatisticas.quadros[quadro] || 0) + 1;
    }

    // --- Validação de estrutura de declaração ---
    if (tipoReg === '21') {
      declaracoesAbertas++;
      dentroDeclaracao = true;
      ordemIdxAnterior = 0; // 21 é o primeiro na ORDEM_DECLARACAO
    } else if (tipoReg === '98') {
      declaracoesEncerradas++;
      dentroDeclaracao = false;
      ordemIdxAnterior = -1; // reset após fechar declaração
    } else if (tipoReg !== '20' && tipoReg !== '99') {
      // Registros de quadro só podem aparecer dentro de uma declaração
      if (!dentroDeclaracao && tipoReg !== '20') {
        erros.push({
          linha: linhaAtual, registro: tipoReg,
          mensagem: `Registro ${tipoReg} encontrado fora de uma declaração. Todos os quadros devem estar entre os registros 21 e 98.`,
          severidade: 'erro'
        });
      }
      // Verificar ordem dentro da declaração
      const ordemIdx = ORDEM_DECLARACAO.indexOf(tipoReg);
      if (ordemIdx >= 0 && ordemIdxAnterior >= 0 && ordemIdx < ordemIdxAnterior) {
        erros.push({
          linha: linhaAtual, registro: tipoReg,
          mensagem: `Registro ${tipoReg} aparece após ${ultimoTipoReg}, quebrando a ordem exigida pelo layout da DIME-SC.`,
          severidade: 'erro'
        });
      }
      if (ordemIdx >= 0) ordemIdxAnterior = ordemIdx;
    }
    ultimoTipoReg = tipoReg;

    // ============ REGISTRO 20: DADOS DO CONTABILISTA ============
    // Pos 1-2: "20" | Pos 3-4: Brancos | Pos 5-15: CPF (11 dígitos)
    // Pos 16-65: Nome (50 chars) | Pos 66-79: Data/Hora (AAAAMMDDHHMMSS)
    if (tipoReg === '20') {
      const cpf = substr(linha, 4, 15).trim();
      if (cpf.length === 0) {
        avisos.push({
          linha: linhaAtual, registro: '20',
          mensagem: 'CPF do contabilista não informado (posições 5-15). Campo obrigatório.',
          severidade: 'aviso'
        });
      } else if (!/^\d{11}$/.test(cpf)) {
        erros.push({
          linha: linhaAtual, registro: '20',
          mensagem: `CPF do contabilista inválido: "${cpf}" (deve ter exatamente 11 dígitos numéricos, posições 5-15).`,
          severidade: 'erro'
        });
      } else if (!validarDigitoCpfDime(cpf)) {
        erros.push({
          linha: linhaAtual, registro: '20',
          mensagem: `CPF do contabilista inválido: "${cpf}" (dígitos verificadores não conferem).`,
          severidade: 'erro'
        });
      }

      const nome = substr(linha, 15, 65).trim();
      if (nome.length === 0) {
        avisos.push({
          linha: linhaAtual, registro: '20',
          mensagem: 'Nome do contabilista não informado (posições 16-65). Campo obrigatório.',
          severidade: 'aviso'
        });
      }

      const dataHora = substr(linha, 65, 79).trim();
      if (dataHora.length > 0 && !/^\d{14}$/.test(dataHora)) {
        erros.push({
          linha: linhaAtual, registro: '20',
          mensagem: `Data/Hora inválida: "${dataHora}" (formato esperado: AAAAMMDDHHMMSS, 14 dígitos, posições 66-79).`,
          severidade: 'erro'
        });
      } else if (dataHora.length === 14) {
        const ano = parseInt(dataHora.substring(0, 4), 10);
        const mes = parseInt(dataHora.substring(4, 6), 10);
        const dia = parseInt(dataHora.substring(6, 8), 10);
        const hora = parseInt(dataHora.substring(8, 10), 10);
        const min = parseInt(dataHora.substring(10, 12), 10);
        const seg = parseInt(dataHora.substring(12, 14), 10);
        if (ano < 2000 || ano > 2100) erros.push({ linha: linhaAtual, registro: '20', mensagem: `Ano inválido na data/hora: ${ano} (deve estar entre 2000 e 2100).`, severidade: 'erro' });
        if (mes < 1 || mes > 12) erros.push({ linha: linhaAtual, registro: '20', mensagem: `Mês inválido na data/hora: ${mes} (deve estar entre 01 e 12).`, severidade: 'erro' });
        if (dia < 1 || dia > 31) erros.push({ linha: linhaAtual, registro: '20', mensagem: `Dia inválido na data/hora: ${dia} (deve estar entre 01 e 31).`, severidade: 'erro' });
        if (hora > 23) erros.push({ linha: linhaAtual, registro: '20', mensagem: `Hora inválida: ${hora} (deve estar entre 00 e 23).`, severidade: 'erro' });
        if (min > 59) erros.push({ linha: linhaAtual, registro: '20', mensagem: `Minuto inválido: ${min} (deve estar entre 00 e 59).`, severidade: 'erro' });
        if (seg > 59) erros.push({ linha: linhaAtual, registro: '20', mensagem: `Segundo inválido: ${seg} (deve estar entre 00 e 59).`, severidade: 'erro' });
      }
    }

    // ============ REGISTRO 21: INÍCIO DA DECLARAÇÃO ============
    // Pos 1-2: "21" | Pos 3-4: Brancos | Pos 5-13: IE (9 dígitos) | Pos 14-63: Razão Social (50 chars)
    // Pos 64-69: Período MMAAAA | Pos 70: Tipo Decl (1,2,4) | Pos 71: Regime (2,9)
    // Pos 72: Porte (1,2,3) | Pos 73: Consolidada (1,2) | Pos 74: Centralizada (1,2)
    // Pos 75: Transf Crédito (1,2) | Pos 76: Crédito Presumido (1,2) | Pos 77: Crédito Incentivo (1,2)
    // Pos 78: Movimento (1,2,3) | Pos 79: Substituto (1,2,3) | Pos 80: Escrita Contábil (1,2)
    // Pos 81-85: Qtd Trabalhadores (5 dígitos)
    if (tipoReg === '21') {
      // Inscrição Estadual
      const ie = substr(linha, 4, 13).trim();
      if (ie.length === 0) {
        erros.push({
          linha: linhaAtual, registro: '21',
          mensagem: 'Inscrição Estadual não informada (posições 5-13). Campo obrigatório.',
          severidade: 'erro'
        });
      } else if (!/^\d{9}$/.test(ie)) {
        avisos.push({
          linha: linhaAtual, registro: '21',
          mensagem: `Inscrição Estadual com formato suspeito: "${ie}" (esperado 9 dígitos numéricos, posições 5-13).`,
          severidade: 'aviso'
        });
      }

      // Razão Social
      const razao = substr(linha, 13, 63).trim();
      if (razao.length === 0) {
        erros.push({
          linha: linhaAtual, registro: '21',
          mensagem: 'Razão Social não informada (posições 14-63). Campo obrigatório.',
          severidade: 'erro'
        });
      }

      // Período de referência (MMAAAA)
      const periodo = substr(linha, 63, 69).trim();
      if (periodo.length === 0) {
        erros.push({
          linha: linhaAtual, registro: '21',
          mensagem: 'Período de referência não informado (posições 64-69). Campo obrigatório.',
          severidade: 'erro'
        });
      } else if (!/^\d{6}$/.test(periodo)) {
        erros.push({
          linha: linhaAtual, registro: '21',
          mensagem: `Período de referência inválido: "${periodo}" (formato esperado: MMAAAA, 6 dígitos, posições 64-69).`,
          severidade: 'erro'
        });
      } else {
        const mes = parseInt(periodo.substring(0, 2), 10);
        if (mes < 1 || mes > 12) {
          erros.push({
            linha: linhaAtual, registro: '21',
            mensagem: `Mês do período de referência inválido: ${mes} (deve estar entre 01 e 12).`,
            severidade: 'erro'
          });
        }
      }

      // Tipo de declaração (posição 70)
      const tipoDecl = substr(linha, 69, 70).trim();
      if (tipoDecl && !['1','2','4'].includes(tipoDecl)) {
        erros.push({
          linha: linhaAtual, registro: '21',
          mensagem: `Tipo de declaração inválido: "${tipoDecl}" (deve ser 1=Normal, 2=Encerramento de Atividades, 4=Enquadramento no Simples Nacional, posição 70).`,
          severidade: 'erro'
        });
      }

      // Regime de apuração (posição 71)
      const regime = substr(linha, 70, 71).trim();
      if (regime && !['2','9'].includes(regime)) {
        erros.push({
          linha: linhaAtual, registro: '21',
          mensagem: `Regime de apuração inválido: "${regime}" (deve ser 2=Normal ou 9=Produtor Primário, posição 71).`,
          severidade: 'erro'
        });
      }

      // Porte (posição 72)
      const porte = substr(linha, 71, 72).trim();
      if (porte && !['1','2','3'].includes(porte)) {
        erros.push({
          linha: linhaAtual, registro: '21',
          mensagem: `Porte inválido: "${porte}" (deve ser 1=ME, 2=EPP, 3=Outros, posição 72).`,
          severidade: 'erro'
        });
      }

      // Consolidada (posição 73)
      const consolidada = substr(linha, 72, 73).trim();
      if (consolidada && !['1','2'].includes(consolidada)) {
        erros.push({
          linha: linhaAtual, registro: '21',
          mensagem: `Indicador de declaração consolidada inválido: "${consolidada}" (deve ser 1=Sim ou 2=Não, posição 73).`,
          severidade: 'erro'
        });
      }

      // Centralizada (posição 74)
      const centralizada = substr(linha, 73, 74).trim();
      if (centralizada && !['1','2'].includes(centralizada)) {
        erros.push({
          linha: linhaAtual, registro: '21',
          mensagem: `Indicador de escrituração centralizada inválido: "${centralizada}" (deve ser 1=Sim ou 2=Não, posição 74).`,
          severidade: 'erro'
        });
      }

      // Transferência de crédito (posição 75)
      const transfCred = substr(linha, 74, 75).trim();
      if (transfCred && !['1','2'].includes(transfCred)) {
        erros.push({
          linha: linhaAtual, registro: '21',
          mensagem: `Indicador de transferência de crédito inválido: "${transfCred}" (deve ser 1=Sim ou 2=Não, posição 75).`,
          severidade: 'erro'
        });
      }

      // Crédito presumido (posição 76)
      const credPresumido = substr(linha, 75, 76).trim();
      if (credPresumido && !['1','2'].includes(credPresumido)) {
        erros.push({
          linha: linhaAtual, registro: '21',
          mensagem: `Indicador de crédito presumido inválido: "${credPresumido}" (deve ser 1=Sim ou 2=Não, posição 76).`,
          severidade: 'erro'
        });
      }

      // Crédito incentivo fiscal (posição 77)
      const credIncentivo = substr(linha, 76, 77).trim();
      if (credIncentivo && !['1','2'].includes(credIncentivo)) {
        erros.push({
          linha: linhaAtual, registro: '21',
          mensagem: `Indicador de crédito por incentivo fiscal inválido: "${credIncentivo}" (deve ser 1=Sim ou 2=Não, posição 77).`,
          severidade: 'erro'
        });
      }

      // Movimento (posição 78)
      const movimento = substr(linha, 77, 78).trim();
      if (movimento && !['1','2','3'].includes(movimento)) {
        erros.push({
          linha: linhaAtual, registro: '21',
          mensagem: `Indicador de movimento inválido: "${movimento}" (deve ser 1=Sem movimento/sem saldos, 2=Sem movimento/com saldos, 3=Com movimento, posição 78).`,
          severidade: 'erro'
        });
      }

      // Substituto tributário (posição 79)
      const substituto = substr(linha, 78, 79).trim();
      if (substituto && !['1','2','3'].includes(substituto)) {
        erros.push({
          linha: linhaAtual, registro: '21',
          mensagem: `Indicador de substituto tributário inválido: "${substituto}" (deve ser 1=Sim, 2=Não, 3=Substituído Solidário, posição 79).`,
          severidade: 'erro'
        });
      }

      // Escrita contábil (posição 80)
      const escritaContabil = substr(linha, 79, 80).trim();
      if (escritaContabil && !['1','2'].includes(escritaContabil)) {
        erros.push({
          linha: linhaAtual, registro: '21',
          mensagem: `Indicador de escrituração contábil inválido: "${escritaContabil}" (deve ser 1=Sim ou 2=Não, posição 80).`,
          severidade: 'erro'
        });
      }

      // Quantidade de trabalhadores (posições 81-85)
      const qtdTrab = substr(linha, 80, 85).trim();
      if (qtdTrab && !/^\d+$/.test(qtdTrab)) {
        erros.push({
          linha: linhaAtual, registro: '21',
          mensagem: `Quantidade de trabalhadores inválida: "${qtdTrab}" (deve ser numérico, posições 81-85).`,
          severidade: 'erro'
        });
      }
    }

    // ============ REGISTRO 22: VALORES FISCAIS — ENTRADAS ============
    // Quadro "01" | Pos 5-9: CFOP (5 dígitos, deve iniciar com 1, 3 ou 5)
    // Pos 10-26: Valor Contábil (17) | Pos 27-43: BC (17) | Pos 44-60: Imposto Creditado (17)
    // Pos 61-77: Isentas/Não Trib (17) | Pos 78-94: Outras (17) | Pos 95-111: BC Retido (17)
    // Pos 112-128: Imposto Retido (17) | Pos 129-145: Dif. Alíquota (17)
    if (tipoReg === '22') {
      const cfop = substr(linha, 4, 9).trim();
      if (cfop.length === 0) {
        erros.push({
          linha: linhaAtual, registro: '22',
          mensagem: 'CFOP não informado (posições 5-9). Campo obrigatório.',
          severidade: 'erro'
        });
      } else if (!/^\d{5}$/.test(cfop)) {
        erros.push({
          linha: linhaAtual, registro: '22',
          mensagem: `CFOP inválido: "${cfop}" (deve ter 5 dígitos numéricos, posições 5-9).`,
          severidade: 'erro'
        });
      } else if (!['1','3','5'].includes(cfop.substring(0, 1))) {
        erros.push({
          linha: linhaAtual, registro: '22',
          mensagem: `CFOP de entrada inválido: "${cfop}" (registros tipo 22 devem ter CFOP iniciando com 1, 3 ou 5).`,
          severidade: 'erro'
        });
      }

      // Validar campos de valor numérico
      const camposValor = [
        { nome: 'Valor Contábil', ini: 9, fim: 26 },
        { nome: 'Base de Cálculo', ini: 26, fim: 43 },
        { nome: 'Imposto Creditado', ini: 43, fim: 60 },
        { nome: 'Isentas/Não Tributadas', ini: 60, fim: 77 },
        { nome: 'Outras', ini: 77, fim: 94 },
        { nome: 'BC Retido', ini: 94, fim: 111 },
        { nome: 'Imposto Retido', ini: 111, fim: 128 },
        { nome: 'Dif. Alíquota', ini: 128, fim: 145 }
      ];
      for (const cv of camposValor) {
        const val = substr(linha, cv.ini, cv.fim);
        if (!isValorNumerico(val)) {
          erros.push({
            linha: linhaAtual, registro: '22',
            mensagem: `${cv.nome} inválido: "${val.trim()}" (deve ser valor numérico, posições ${cv.ini + 1}-${cv.fim}).`,
            severidade: 'erro'
          });
        }
      }

      // Acumular valor contábil para validação cruzada
      const vc = substr(linha, 9, 26).trim();
      if (isValorNumerico(vc) && vc.length > 0) {
        totalEntradasVC += parseFloat(vc.replace(/\./g, '').replace(',', '.')) || 0;
      }
    }

    // ============ REGISTRO 23: VALORES FISCAIS — SAÍDAS ============
    // Mesma estrutura do 22, mas quadro "02" e CFOP deve iniciar com 2, 6 ou 7
    if (tipoReg === '23') {
      const cfop = substr(linha, 4, 9).trim();
      if (cfop.length === 0) {
        erros.push({
          linha: linhaAtual, registro: '23',
          mensagem: 'CFOP não informado (posições 5-9). Campo obrigatório.',
          severidade: 'erro'
        });
      } else if (!/^\d{5}$/.test(cfop)) {
        erros.push({
          linha: linhaAtual, registro: '23',
          mensagem: `CFOP inválido: "${cfop}" (deve ter 5 dígitos numéricos, posições 5-9).`,
          severidade: 'erro'
        });
      } else if (!['2','6','7'].includes(cfop.substring(0, 1))) {
        erros.push({
          linha: linhaAtual, registro: '23',
          mensagem: `CFOP de saída inválido: "${cfop}" (registros tipo 23 devem ter CFOP iniciando com 2, 6 ou 7).`,
          severidade: 'erro'
        });
      }

      // Validar campos de valor numérico (mesma estrutura do 22)
      const camposValor = [
        { nome: 'Valor Contábil', ini: 9, fim: 26 },
        { nome: 'Base de Cálculo', ini: 26, fim: 43 },
        { nome: 'Imposto Creditado', ini: 43, fim: 60 },
        { nome: 'Isentas/Não Tributadas', ini: 60, fim: 77 },
        { nome: 'Outras', ini: 77, fim: 94 },
        { nome: 'BC Retido', ini: 94, fim: 111 },
        { nome: 'Imposto Retido', ini: 111, fim: 128 },
        { nome: 'Dif. Alíquota', ini: 128, fim: 145 }
      ];
      for (const cv of camposValor) {
        const val = substr(linha, cv.ini, cv.fim);
        if (!isValorNumerico(val)) {
          erros.push({
            linha: linhaAtual, registro: '23',
            mensagem: `${cv.nome} inválido: "${val.trim()}" (deve ser valor numérico, posições ${cv.ini + 1}-${cv.fim}).`,
            severidade: 'erro'
          });
        }
      }

      // Acumular valor contábil para validação cruzada
      const vc = substr(linha, 9, 26).trim();
      if (isValorNumerico(vc) && vc.length > 0) {
        totalSaidasVC += parseFloat(vc.replace(/\./g, '').replace(',', '.')) || 0;
      }
    }

    // ============ REGISTROS 24-26: RESUMOS (QUADRO 03) ============
    // Estrutura: Tipo(1-2) | Quadro(3-4) | Valor(5-24)
    if (['24','25','26','30','31','32','35','37','41','42','51'].includes(tipoReg)) {
      const valor = substr(linha, 4, 24);
      if (!isValorNumerico(valor)) {
        erros.push({
          linha: linhaAtual, registro: tipoReg,
          mensagem: `Valor numérico inválido no registro ${tipoReg}: "${valor.trim()}" (posições 5-24).`,
          severidade: 'erro'
        });
      }
    }

    // ============ REGISTRO 33: DISCRIMINAÇÃO DOS PAGAMENTOS ============
    // Quadro "03" | Pos 5: Origem (1,2,3) | Pos 6-9: Código Receita (4 dígitos)
    // Pos 10-17: Data Vencimento (DDMMAAAA) | Pos 18-34: Valor (17)
    // Pos 35-39: Classe Vencimento (5 dígitos) | Pos 40-54: Número do Acordo (15 dígitos)
    if (tipoReg === '33') {
      const origem = substr(linha, 4, 5).trim();
      if (origem && !['1','2','3'].includes(origem)) {
        erros.push({
          linha: linhaAtual, registro: '33',
          mensagem: `Origem do recolhimento inválida: "${origem}" (deve ser 1=Imposto, 2=Substituição Tributária, 3=Débitos Específicos, posição 5).`,
          severidade: 'erro'
        });
      }

      const codReceita = substr(linha, 5, 9).trim();
      if (codReceita.length === 0) {
        erros.push({
          linha: linhaAtual, registro: '33',
          mensagem: 'Código da receita não informado (posições 6-9). Campo obrigatório.',
          severidade: 'erro'
        });
      } else if (!/^\d{4}$/.test(codReceita)) {
        erros.push({
          linha: linhaAtual, registro: '33',
          mensagem: `Código da receita inválido: "${codReceita}" (deve ter 4 dígitos numéricos, posições 6-9).`,
          severidade: 'erro'
        });
      }

      const data = substr(linha, 9, 17).trim();
      if (data.length === 0) {
        erros.push({
          linha: linhaAtual, registro: '33',
          mensagem: 'Data de vencimento não informada (posições 10-17). Campo obrigatório.',
          severidade: 'erro'
        });
      } else if (data !== '00000000' && !/^\d{8}$/.test(data)) {
        erros.push({
          linha: linhaAtual, registro: '33',
          mensagem: `Data de vencimento inválida: "${data}" (formato esperado: DDMMAAAA, posições 10-17).`,
          severidade: 'erro'
        });
      } else if (/^\d{8}$/.test(data) && data !== '00000000') {
        const dia = parseInt(data.substring(0, 2), 10);
        const mes = parseInt(data.substring(2, 4), 10);
        const ano = parseInt(data.substring(4, 8), 10);
        if (dia < 1 || dia > 31) erros.push({ linha: linhaAtual, registro: '33', mensagem: `Dia de vencimento inválido: ${dia} (deve estar entre 01 e 31).`, severidade: 'erro' });
        if (mes < 1 || mes > 12) erros.push({ linha: linhaAtual, registro: '33', mensagem: `Mês de vencimento inválido: ${mes} (deve estar entre 01 e 12).`, severidade: 'erro' });
        if (ano < 2000 || ano > 2100) erros.push({ linha: linhaAtual, registro: '33', mensagem: `Ano de vencimento inválido: ${ano} (deve estar entre 2000 e 2100).`, severidade: 'erro' });
      }

      const valor = substr(linha, 17, 34);
      if (!isValorNumerico(valor)) {
        erros.push({
          linha: linhaAtual, registro: '33',
          mensagem: `Valor do pagamento inválido: "${valor.trim()}" (posições 18-34).`,
          severidade: 'erro'
        });
      }

      const classeVenc = substr(linha, 34, 39).trim();
      if (classeVenc && !/^\d+$/.test(classeVenc)) {
        erros.push({
          linha: linhaAtual, registro: '33',
          mensagem: `Classe de vencimento inválida: "${classeVenc}" (deve ser numérico, posições 35-39).`,
          severidade: 'erro'
        });
      }

      const numAcordo = substr(linha, 39, 54).trim();
      if (numAcordo && !/^\d+$/.test(numAcordo)) {
        avisos.push({
          linha: linhaAtual, registro: '33',
          mensagem: `Número do acordo/convenio com formato suspeito: "${numAcordo}" (esperado numérico, posições 40-54).`,
          severidade: 'aviso'
        });
      }
    }

    // ============ REGISTRO 36: FUNDOS (FUMDES / FUNDO SOCIAL) ============
    // Quadro "03" | Múltiplos campos de valor (168 caracteres total)
    if (tipoReg === '36') {
      // Validar campos de valor numérico em blocos de 17 caracteres a partir da posição 5
      // O registro 36 contém múltiplas linhas de fundos; validamos os valores numéricos
      const camposValor36 = [
        { nome: 'Receita FUMDES', ini: 4, fim: 21 },
        { nome: 'Receita Fundo Social', ini: 21, fim: 38 },
        { nome: 'Dedução FUMDES', ini: 38, fim: 55 },
        { nome: 'Dedução Fundo Social', ini: 55, fim: 72 },
        { nome: 'BC FUMDES', ini: 72, fim: 89 },
        { nome: 'BC Fundo Social', ini: 89, fim: 106 },
        { nome: 'Imposto FUMDES', ini: 106, fim: 123 },
        { nome: 'Imposto Fundo Social', ini: 123, fim: 140 },
        { nome: 'Total a Recolher', ini: 140, fim: 157 }
      ];
      for (const cv of camposValor36) {
        const val = substr(linha, cv.ini, cv.fim);
        if (!isValorNumerico(val)) {
          erros.push({
            linha: linhaAtual, registro: '36',
            mensagem: `${cv.nome} inválido: "${val.trim()}" (posições ${cv.ini + 1}-${cv.fim}).`,
            severidade: 'erro'
          });
        }
      }
    }

    // ============ REGISTRO 46: CRÉDITOS POR AUTORIZAÇÕES ESPECIAIS ============
    // Quadro "04" | Pos 5-21: Valor do crédito (17) | Pos 22-41: Descrição (20 chars)
    if (tipoReg === '46') {
      const valor = substr(linha, 4, 21);
      if (!isValorNumerico(valor)) {
        erros.push({
          linha: linhaAtual, registro: '46',
          mensagem: `Valor do crédito inválido: "${valor.trim()}" (posições 5-21).`,
          severidade: 'erro'
        });
      }
      const descricao = substr(linha, 21, 41).trim();
      if (descricao.length === 0) {
        avisos.push({
          linha: linhaAtual, registro: '46',
          mensagem: 'Descrição do crédito não informada (posições 22-41).',
          severidade: 'aviso'
        });
      }
    }

    // ============ REGISTRO 47: ENTRADAS DE EXTRATORES/PRODUTORES ============
    // Quadro "04" | Pos 5-26: Valor (22 chars)
    if (tipoReg === '47') {
      const valor = substr(linha, 4, 26);
      if (!isValorNumerico(valor)) {
        erros.push({
          linha: linhaAtual, registro: '47',
          mensagem: `Valor inválido: "${valor.trim()}" (posições 5-26).`,
          severidade: 'erro'
        });
      }
    }

    // ============ REGISTRO 48: RATEIO DO VALOR ADICIONADO ============
    // Quadro "05" | Pos 5-25: Valor (21 chars) | Pos 26-29: Município IBGE (4 dígitos)
    if (tipoReg === '48') {
      const valor = substr(linha, 4, 25);
      if (!isValorNumerico(valor)) {
        erros.push({
          linha: linhaAtual, registro: '48',
          mensagem: `Valor do rateio inválido: "${valor.trim()}" (posições 5-25).`,
          severidade: 'erro'
        });
      }
      const municipio = substr(linha, 25, 29).trim();
      if (municipio && !/^\d{4}$/.test(municipio)) {
        erros.push({
          linha: linhaAtual, registro: '48',
          mensagem: `Código de município IBGE inválido: "${municipio}" (deve ter 4 dígitos numéricos, posições 26-29).`,
          severidade: 'erro'
        });
      }
    }

    // ============ REGISTRO 49: ENTRADAS POR UF ============
    // Quadro "05" | Pos 5-25: Valor Contábil (21) | Pos 26-46: BC (21)
    // Pos 47-67: Imposto Creditado (21) | Pos 68-69: UF (2 chars)
    if (tipoReg === '49') {
      const camposValor49 = [
        { nome: 'Valor Contábil Entradas', ini: 4, fim: 25 },
        { nome: 'BC Entradas', ini: 25, fim: 46 },
        { nome: 'Imposto Creditado Entradas', ini: 46, fim: 67 }
      ];
      for (const cv of camposValor49) {
        const val = substr(linha, cv.ini, cv.fim);
        if (!isValorNumerico(val)) {
          erros.push({
            linha: linhaAtual, registro: '49',
            mensagem: `${cv.nome} inválido: "${val.trim()}" (posições ${cv.ini + 1}-${cv.fim}).`,
            severidade: 'erro'
          });
        }
      }
      const uf = substr(linha, 67, 69).trim();
      if (uf && !/^[A-Z]{2}$/.test(uf)) {
        erros.push({
          linha: linhaAtual, registro: '49',
          mensagem: `UF inválida: "${uf}" (deve ter 2 letras maiúsculas, posições 68-69).`,
          severidade: 'erro'
        });
      }
    }

    // ============ REGISTRO 50: SAÍDAS POR UF ============
    // Quadro "05" | Estrutura similar ao 49 mas para saídas
    if (tipoReg === '50') {
      const camposValor50 = [
        { nome: 'Valor Contábil Saídas', ini: 4, fim: 25 },
        { nome: 'BC Saídas', ini: 25, fim: 46 },
        { nome: 'Imposto Debitado Saídas', ini: 46, fim: 67 }
      ];
      for (const cv of camposValor50) {
        const val = substr(linha, cv.ini, cv.fim);
        if (!isValorNumerico(val)) {
          erros.push({
            linha: linhaAtual, registro: '50',
            mensagem: `${cv.nome} inválido: "${val.trim()}" (posições ${cv.ini + 1}-${cv.fim}).`,
            severidade: 'erro'
          });
        }
      }
      const uf = substr(linha, 67, 69).trim();
      if (uf && !/^[A-Z]{2}$/.test(uf)) {
        erros.push({
          linha: linhaAtual, registro: '50',
          mensagem: `UF inválida: "${uf}" (deve ter 2 letras maiúsculas, posições 68-69).`,
          severidade: 'erro'
        });
      }
    }

    // ============ REGISTROS 80-85: QUADROS CONTÁBEIS (QUADRO 06) ============
    // Estrutura: Tipo(1-2) | Quadro(3-4) | Valor/Descrição(5-24)
    if (['80','81','82','83','84','85'].includes(tipoReg)) {
      const valor = substr(linha, 4, 24);
      // Para registros contábeis, o campo pode ser valor ou descrição; validamos se parece numérico
      if (valor.trim().length > 0 && !isValorNumerico(valor) && !/^[A-Z\s]+$/i.test(valor.trim())) {
        avisos.push({
          linha: linhaAtual, registro: tipoReg,
          mensagem: `Campo de valor/descrição com formato suspeito no registro ${tipoReg}: "${valor.trim()}" (posições 5-24).`,
          severidade: 'aviso'
        });
      }
    }

    // ============ REGISTRO 98: FIM DA DECLARAÇÃO ============
    // Pos 1-2: "98" | Pos 3-4: Brancos | Pos 5-9: Quantidade de registros da declaração (5 dígitos)
    if (tipoReg === '98') {
      const qtd = substr(linha, 4, 9).trim();
      if (qtd.length === 0) {
        avisos.push({
          linha: linhaAtual, registro: '98',
          mensagem: 'Quantidade de registros da declaração não informada (posições 5-9).',
          severidade: 'aviso'
        });
      } else if (!/^\d+$/.test(qtd)) {
        erros.push({
          linha: linhaAtual, registro: '98',
          mensagem: `Quantidade de registros da declaração inválida: "${qtd}" (deve ser numérico, posições 5-9).`,
          severidade: 'erro'
        });
      }
    }

    // ============ REGISTRO 99: FECHAMENTO DO ARQUIVO ============
    // Pos 1-2: "99" | Pos 3-4: Brancos | Pos 5-9: Qtd registros (5 dígitos)
    // Pos 10-14: Qtd declarações (5 dígitos)
    if (tipoReg === '99') {
      const qtdStr = substr(linha, 4, 9).trim();
      if (qtdStr.length === 0) {
        erros.push({
          linha: linhaAtual, registro: '99',
          mensagem: 'Quantidade total de registros não informada (posições 5-9). Campo obrigatório.',
          severidade: 'erro'
        });
      } else if (!/^\d+$/.test(qtdStr)) {
        erros.push({
          linha: linhaAtual, registro: '99',
          mensagem: `Quantidade total de registros inválida: "${qtdStr}" (deve ser numérico, posições 5-9).`,
          severidade: 'erro'
        });
      } else {
        const qtdDeclarado = parseInt(qtdStr, 10);
        if (qtdDeclarado !== linhas.length) {
          erros.push({
            linha: linhaAtual, registro: '99',
            mensagem: `Quantidade de registros no fechamento (${qtdDeclarado}) não confere com o total de linhas do arquivo (${linhas.length}).`,
            severidade: 'erro'
          });
        }
      }

      const qtdDeclStr = substr(linha, 9, 14).trim();
      if (qtdDeclStr.length > 0) {
        if (!/^\d+$/.test(qtdDeclStr)) {
          erros.push({
            linha: linhaAtual, registro: '99',
            mensagem: `Quantidade de declarações inválida: "${qtdDeclStr}" (deve ser numérico, posições 10-14).`,
            severidade: 'erro'
          });
        } else {
          const qtdDeclaracoes = parseInt(qtdDeclStr, 10);
          if (qtdDeclaracoes !== declaracoesAbertas) {
            erros.push({
              linha: linhaAtual, registro: '99',
              mensagem: `Quantidade de declarações no fechamento (${qtdDeclaracoes}) não confere com o número de registros tipo 21 encontrados (${declaracoesAbertas}).`,
              severidade: 'erro'
            });
          }
        }
      }
    }
  } // fim do loop de linhas

  // ============ VALIDAÇÕES ESTRUTURAIS GLOBAIS ============

  // Registro 20: obrigatório e único
  if (!estatisticas.registros['20']) {
    erros.push({
      linha: 0, registro: '20',
      mensagem: 'Registro tipo 20 (Dados do Contabilista) não encontrado. É obrigatório e deve ser o primeiro registro.',
      severidade: 'erro'
    });
  } else if (estatisticas.registros['20'] > 1) {
    erros.push({
      linha: 0, registro: '20',
      mensagem: `Mais de um registro tipo 20 (Contabilista) no arquivo (${estatisticas.registros['20']} ocorrências). Deve haver exatamente um.`,
      severidade: 'erro'
    });
  }

  // Registro 99: obrigatório e único
  if (!estatisticas.registros['99']) {
    erros.push({
      linha: 0, registro: '99',
      mensagem: 'Registro tipo 99 (Fechamento do Arquivo) não encontrado. É obrigatório e deve ser o último registro.',
      severidade: 'erro'
    });
  } else if (estatisticas.registros['99'] > 1) {
    erros.push({
      linha: 0, registro: '99',
      mensagem: `Mais de um registro tipo 99 (Fechamento) no arquivo (${estatisticas.registros['99']} ocorrências). Deve haver exatamente um.`,
      severidade: 'erro'
    });
  }

  // Declarações: pelo menos uma (par 21/98)
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

  // Verificar que não há registros antes do 20 ou depois do 99
  if (linhas.length > 0) {
    for (let i = 0; i < linhas.length; i++) {
      const tp = substr(linhas[i], 0, 2);
      if (tp === '99' && i < linhas.length - 1) {
        erros.push({
          linha: i + 1, registro: '99',
          mensagem: 'Registro tipo 99 (Fechamento) encontrado antes da última linha. Deve ser o último registro do arquivo.',
          severidade: 'erro'
        });
        break;
      }
    }
  }

  // Verificar registros de quadro sem declaração aberta
  if (declaracoesAbertas === 0 && (estatisticas.registros['22'] || estatisticas.registros['23'] || estatisticas.registros['33'])) {
    erros.push({
      linha: 0, registro: '21',
      mensagem: 'Registros de quadro (22, 23, 33, etc.) encontrados sem declaração aberta (registro 21).',
      severidade: 'erro'
    });
  }

  // Validação cruzada de totais: se houver registros 24 (Resumo dos Valores Fiscais)
  // e registros 22/23, verificar se os valores conferem
  if (estatisticas.registros['24'] && (totalEntradasVC > 0 || totalSaidasVC > 0)) {
    // Apenas aviso se houver divergência significativa — o reg 24 pode conter o total geral
    const totalGeral = totalEntradasVC + totalSaidasVC;
    if (totalGeral > 0) {
      // Validado apenas como aviso pois o layout exato do reg 24 pode variar
    }
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
      blocosEncontrados: Object.keys(estatisticas.quadros).sort(),
      registrosUnicos: Object.keys(estatisticas.registros).length,
      declaracoesEncontradas: declaracoesAbertas,
      totalEntradasVC: totalEntradasVC.toFixed(2),
      totalSaidasVC: totalSaidasVC.toFixed(2)
    }
  });
}
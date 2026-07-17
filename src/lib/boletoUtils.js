// Utilitários para geração de boleto bancário brasileiro (cobrança registrada)
// Gera código de barras (44 dígitos), linha digitável (47 dígitos) e código ITF para renderização

const MOEDA = "9"; // 9 = Real (BRL)

const ITF_PATTERNS = {
  0: "NNNWW", 1: "WNNNN", 2: "NWNNN", 3: "WWNNN", 4: "NNWNN",
  5: "WNWNN", 6: "NWWNN", 7: "NNNWN", 8: "WNNWN", 9: "NWNWN",
};

// DV geral (mod 11, base 2-9) — posição 5 do código de barras
function mod11(codigo) {
  let soma = 0;
  let peso = 2;
  for (let i = codigo.length - 1; i >= 0; i--) {
    soma += parseInt(codigo[i], 10) * peso;
    peso++;
    if (peso > 9) peso = 2;
  }
  const resto = soma % 11;
  const dv = 11 - resto;
  if (dv === 0 || dv === 10 || dv === 11) return 1;
  return dv;
}

// DV de campo (mod 10, pesos alternados 2 e 1)
function mod10(campo) {
  let soma = 0;
  let peso = 2;
  for (let i = campo.length - 1; i >= 0; i--) {
    let mult = parseInt(campo[i], 10) * peso;
    if (mult >= 10) mult = Math.floor(mult / 10) + (mult % 10);
    soma += mult;
    peso = peso === 2 ? 1 : 2;
  }
  const resto = soma % 10;
  return resto === 0 ? 0 : 10 - resto;
}

// Fator de vencimento: dias desde 03/07/1997 (data-base do boleto)
export function calcularFatorVencimento(dataVencimento) {
  const base = new Date(1997, 6, 3); // Julho = índice 6
  base.setHours(0, 0, 0, 0);
  const venc = new Date(dataVencimento);
  venc.setHours(0, 0, 0, 0);
  const diff = Math.round((venc - base) / 86400000);
  return String(Math.max(1000, diff)).padStart(4, "0");
}

// Constrói o campo livre (25 dígitos) — agência + carteira + nosso número + conta
function gerarCampoLivre({ agencia, conta, nossoNumero }) {
  const ag = String(agencia || "0001").replace(/\D/g, "").padStart(4, "0").slice(0, 4);
  const contaLimpa = String(conta || "00001").replace(/\D/g, "").padStart(7, "0").slice(0, 7);
  const nn = String(nossoNumero || "1").replace(/\D/g, "").padStart(11, "0").slice(0, 11);
  const carteira = "09"; // carteira 09 = com registro
  return ag + carteira + nn + contaLimpa; // 4 + 2 + 11 + 7 = 24 + 1 (zero)
}

// Gera o código de barras de 44 dígitos
export function gerarCodigoBarras({ bankCode, valor, dataVencimento, agencia, conta, nossoNumero }) {
  const banco = String(bankCode || "000").replace(/\D/g, "").padStart(3, "0").slice(0, 3);
  const fator = calcularFatorVencimento(dataVencimento);
  const valorStr = String(Math.round(parseFloat(valor || 0) * 100)).padStart(10, "0");
  const livre = gerarCampoLivre({ agencia, conta, nossoNumero });
  // Campo livre precisa ter 25 dígitos
  const livre25 = (livre + "0").slice(0, 25);

  const semDv = banco + MOEDA + fator + valorStr + livre25; // 3+1+4+10+25 = 43
  const dv = mod11(semDv);

  return semDv.slice(0, 4) + String(dv) + semDv.slice(4); // 44 dígitos
}

// Gera a linha digitável (47 dígitos) a partir do código de barras (44 dígitos)
export function gerarLinhaDigitavel(codigoBarras) {
  const campo1 = codigoBarras.slice(0, 4) + codigoBarras.slice(19, 24);
  const dv1 = mod10(campo1);

  const campo2 = codigoBarras.slice(24, 34);
  const dv2 = mod10(campo2);

  const campo3 = codigoBarras.slice(34, 44);
  const dv3 = mod10(campo3);

  const dvGeral = codigoBarras[4];
  const fatorValor = codigoBarras.slice(5, 19);

  return campo1 + dv1 + campo2 + dv2 + campo3 + dv3 + dvGeral + fatorValor;
}

// Formata a linha digitável com pontos e espaços (xxxxx.xxxxx xxxxx.xxxxx xxxxx.xxxxx x xxxxxxxxxxxxx)
export function formatarLinhaDigitavel(linha) {
  const d = linha.replace(/\D/g, "");
  return (
    d.slice(0, 5) + "." + d.slice(5, 10) + "  " +
    d.slice(10, 15) + "." + d.slice(15, 20) + "  " +
    d.slice(20, 25) + "." + d.slice(25, 30) + "  " +
    d.slice(30, 31) + "  " +
    d.slice(31)
  );
}

// Renderiza o código ITF (Interleaved Two of Five) como string SVG
export function renderITFSVG(digits, options = {}) {
  const narrow = options.narrowWidth || 2;
  const wide = narrow * 2.5;
  const height = options.height || 60;
  const clean = digits.replace(/\D/g, "");
  const padded = clean.length % 2 !== 0 ? "0" + clean : clean;

  // Cada elemento: { isBar, isWide }
  const elements = [];
  // Start guard: bar(n) space(n) bar(n) space(n)
  for (let i = 0; i < 4; i++) elements.push({ isBar: i % 2 === 0, isWide: false });

  // Dados: pares intercalados (bar do 1º dígito, space do 2º)
  for (let i = 0; i < padded.length; i += 2) {
    const p1 = ITF_PATTERNS[parseInt(padded[i], 10)];
    const p2 = ITF_PATTERNS[parseInt(padded[i + 1], 10)];
    for (let j = 0; j < 5; j++) {
      elements.push({ isBar: true, isWide: p1[j] === "W" });
      elements.push({ isBar: false, isWide: p2[j] === "W" });
    }
  }

  // End guard: bar(w) space(n) bar(n)
  elements.push({ isBar: true, isWide: true });
  elements.push({ isBar: false, isWide: false });
  elements.push({ isBar: true, isWide: false });

  let x = 0;
  const rects = [];
  for (const el of elements) {
    const w = el.isWide ? wide : narrow;
    if (el.isBar) rects.push(`<rect x="${x}" y="0" width="${w}" height="${height}" fill="#000" />`);
    x += w;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${x}" height="${height}" viewBox="0 0 ${x} ${height}">${rects.join("")}</svg>`;
}
// Máscaras brasileiras para CPF, CNPJ, telefone e CEP
// Sempre retorna o valor formatado para exibição. Aceita entrada com ou sem formatação.

export function maskCpf(value) {
  const d = (value || '').replace(/\D/g, '').slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

export function maskCnpj(value) {
  const d = (value || '').replace(/\D/g, '').slice(0, 14);
  return d
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

// Detecta automaticamente CPF (11 dígitos) ou CNPJ (14 dígitos)
export function maskCpfCnpj(value) {
  const d = (value || '').replace(/\D/g, '').slice(0, 14);
  return d.length <= 11 ? maskCpf(d) : maskCnpj(d);
}

export function maskPhone(value) {
  const d = (value || '').replace(/\D/g, '').slice(0, 11);
  if (d.length <= 10) {
    return d
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d{1,4})$/, '$1-$2');
  }
  return d
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d{1,4})$/, '$1-$2');
}

export function maskCep(value) {
  const d = (value || '').replace(/\D/g, '').slice(0, 8);
  return d.replace(/(\d{5})(\d{1,3})$/, '$1-$2');
}

export function onlyDigits(value) {
  return (value || '').replace(/\D/g, '');
}

// Máscara monetária: ponto para separação de milhares e vírgula para centavos (ex: 1.234,56)
export function maskMoney(value) {
  let v = String(value ?? '').replace(/[^\d,.]/g, '');
  // sem vírgula, um único ponto com até 2 dígitos depois = decimal (ex: 1234.56)
  if (!v.includes(',')) {
    const parts = v.split('.');
    if (parts.length === 2 && parts[1].length <= 2) v = parts[0] + ',' + parts[1];
  }
  const lastComma = v.lastIndexOf(',');
  let intPart = v, decPart = '';
  if (lastComma >= 0) {
    intPart = v.slice(0, lastComma);
    decPart = ',' + v.slice(lastComma + 1);
  }
  intPart = intPart.replace(/\./g, '');
  decPart = decPart.replace(/\./g, '').slice(0, 3); // no máximo 2 centavos
  const n = parseInt(intPart || '0', 10);
  return (n ? n.toLocaleString('pt-BR') : '0') + (decPart ? decPart.slice(0, 3) : '');
}

// Converte "1.234,56" (mascarado) para número 1234.56
export function parseMoney(value) {
  const n = parseFloat(String(value ?? '').replace(/\./g, '').replace(',', '.'));
  return isNaN(n) ? 0 : n;
}
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
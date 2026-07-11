// Tabelas 4.3.10 e 4.3.11 da EFD-Contribuições
// Fonte: Receita Federal do Brasil (sped.rfb.gov.br)
// 4.3.10: Versão 1.25 — atualizada em 30/03/2026
// 4.3.11: Versão 1.33 — atualizada em 16/04/2026 (Decreto nº 12.875/2026)

// Normaliza NCM removendo pontos, espaços e zeros à esquerda de Ex
function normNcm(ncm) {
  return String(ncm || '').replace(/[.\s]/g, '').replace(/Ex\d*/gi, '').trim();
}

// Verifica se um NCM de 8 dígitos corresponde a um padrão da tabela
// O padrão pode ser 4 dígitos (posição TIPI), 6 ou 8 dígitos
function ncmMatch(ncmArquivo, ncmTabela) {
  const a = normNcm(ncmArquivo);
  const t = normNcm(ncmTabela);
  if (!a || !t) return false;
  if (a === t) return true;
  // Se a tabela tem 4 dígitos (posição), compara os 4 primeiros
  if (t.length <= 4 && a.substring(0, t.length) === t) return true;
  // Se a tabela tem 6 dígitos, compara os 6 primeiros
  if (t.length === 6 && a.substring(0, 6) === t) return true;
  return false;
}

// ===================== TABELA 4.3.10 =====================
// Produtos Sujeitos à Alíquotas Diferenciadas: Incidência Monofásica e por Pauta (Bebidas Frias)
// CST 02 e 04 — alíquotas em PERCENTUAL (%)
export const TABELA_4_3_10 = [
  // Grupo 100 — Combustíveis
  { codigo: '101', descricao: 'Gasolinas, Exceto Gasolina de Aviação', ncms: ['2710.11.59'], pis: 5.08, cofins: 23.44 },
  { codigo: '102', descricao: 'Óleo Diesel', ncms: ['2710.19.21'], pis: 4.21, cofins: 19.42 },
  { codigo: '103', descricao: 'Gás Liquefeito de Petróleo - GLP', ncms: ['2711.19.10'], pis: 10.20, cofins: 47.40 },
  { codigo: '104', descricao: 'Querosene de Aviação', ncms: ['2710.19.11'], pis: 5.00, cofins: 23.20 },
  { codigo: '105', descricao: 'Correntes Destinadas à Formulação de Gasolinas', ncms: ['2710.11.59'], pis: 5.08, cofins: 23.44 },
  { codigo: '106', descricao: 'Correntes Destinadas à Formulação de Óleo Diesel', ncms: ['2710.19.21'], pis: 4.21, cofins: 19.42 },
  { codigo: '107', descricao: 'Nafta Petroquímica para Gasolina ou Diesel', ncms: ['2710.11.41'], pis: 5.08, cofins: 23.44 },
  { codigo: '108', descricao: 'Nafta Petroquímica apenas para Diesel', ncms: ['2710.11.41'], pis: 4.21, cofins: 19.42 },
  { codigo: '109', descricao: 'Biodiesel', ncms: ['3824.90.29'], pis: 6.15, cofins: 28.32 },
  { codigo: '112', descricao: 'Álcool — Venda por Produtor ou Importador', ncms: ['2207.10.00', '2207.20.10', '2208.90.00'], pis: 1.50, cofins: 6.90 },
  { codigo: '113', descricao: 'Álcool — Venda por Distribuidor', ncms: ['2207.10.00', '2207.20.10', '2208.90.00'], pis: 3.75, cofins: 17.25 },
  { codigo: '150', descricao: 'Nafta Petroquímica para Centrais Petroquímicas', ncms: ['2710.11.41'], pis: 1.00, cofins: 4.60 },
  { codigo: '151', descricao: 'Etano, Propano, Butano e Correntes Gasosas', ncms: [], pis: 1.00, cofins: 4.60 },
  // Grupo 200 — Fármacos e Perfumaria
  { codigo: '201', descricao: 'Produtos Farmacêuticos', ncms: ['3001', '3003', '3004', '3002.10', '3002.20', '3006.30', '3002.90.20', '3002.90.92', '3002.90.99', '3005.10.10', '3006.60.00'], pis: 2.10, cofins: 9.90 },
  { codigo: '202', descricao: 'Perfumaria, Toucador ou Higiene Pessoal', ncms: ['3303', '3304', '3305', '3306', '3307', '3401.11.90', '3401.20.10', '9603.21.00'], pis: 2.20, cofins: 10.30 },
  // Grupo 300 — Veículos, Máquinas e Autopeças
  { codigo: '301', descricao: 'Veículos Automotores e Máquinas Agrícolas', ncms: ['8429', '8432.40', '8432.80', '8433.20', '8433.30', '8433.40', '8433.5', '8701', '8702', '8703', '8704', '8705', '8706'], pis: 2.00, cofins: 9.60 },
  { codigo: '302', descricao: 'Autopeças — Vendas para Atacadistas/Varejistas', ncms: [], pis: 2.30, cofins: 10.80 },
  { codigo: '303', descricao: 'Autopeças — Vendas para Fabricantes', ncms: [], pis: 1.65, cofins: 7.60 },
  { codigo: '304', descricao: 'Pneumáticos (Pneus e Câmaras-de-Ar)', ncms: ['4011', '4013'], pis: 2.00, cofins: 9.50 },
  // Grupo 400 — Bebidas Frias
  { codigo: '401', descricao: 'Águas Minerais Artificiais e Gaseificadas', ncms: ['2201.10.00'], pis: 3.50, cofins: 16.65 },
  { codigo: '402', descricao: 'Águas Minerais Naturais', ncms: ['2201.10.00'], pis: 3.50, cofins: 16.65 },
  { codigo: '403', descricao: 'Refrigerantes', ncms: ['2202.10.00'], pis: 3.50, cofins: 16.65 },
  { codigo: '404', descricao: 'Preparações Compostas para Refrigerante', ncms: ['2202.90.00'], pis: 3.50, cofins: 16.65 },
  { codigo: '405', descricao: 'Refrescos, Isotônicos e Energéticos', ncms: ['2202.99.00'], pis: 3.50, cofins: 16.65 },
  { codigo: '406', descricao: 'Cervejas de Malte e Sem Álcool', ncms: ['2203.00.00'], pis: 3.50, cofins: 16.65 },
  { codigo: '407', descricao: 'Chope e Cervejas a Granel', ncms: ['2203.00.00'], pis: 3.50, cofins: 16.65 },
];

// ===================== TABELA 4.3.11 =====================
// Produtos Sujeitos a Alíquotas por Unidade de Medida de Produto
// Incidência Monofásica ou por Pauta — CST 03 e 04
// Alíquotas ad rem (R$ por unidade)
// ATENÇÃO: Valores atualizados pelo Decreto nº 12.875/2026 (óleo diesel)
export const TABELA_4_3_11 = [
  // Grupo 100 — Combustíveis (alíquotas ad rem por m³)
  { codigo: '101', descricao: 'Gasolinas, Exceto Gasolina de Aviação', ncms: ['2710.11.59'], pisAdRem: 158.50, cofinsAdRem: 732.40, unidade: 'm³' },
  { codigo: '102', descricao: 'Óleo Diesel (Decreto 12.875/2026)', ncms: ['2710.19.21'], pisAdRem: 0.01, cofinsAdRem: 0.05, unidade: 'm³' },
  { codigo: '103', descricao: 'Gás Liquefeito de Petróleo - GLP', ncms: ['2711.19.10'], pisAdRem: 0.00, cofinsAdRem: 0.00, unidade: 'kg' },
  { codigo: '104', descricao: 'Querosene de Aviação', ncms: ['2710.19.11'], pisAdRem: 0.00, cofinsAdRem: 0.00, unidade: 'm³' },
  { codigo: '109', descricao: 'Biodiesel', ncms: ['3824.90.29'], pisAdRem: 0.00, cofinsAdRem: 0.00, unidade: 'm³' },
  { codigo: '112', descricao: 'Álcool — Venda por Produtor ou Importador', ncms: ['2207.10.00', '2207.20.10', '2208.90.00'], pisAdRem: 0.00, cofinsAdRem: 0.00, unidade: 'm³' },
  // Grupo 400 — Bebidas Frias (alíquotas ad rem por litro)
  { codigo: '403', descricao: 'Refrigerantes', ncms: ['2202.10.00'], pisAdRem: 0.00, cofinsAdRem: 0.00, unidade: 'litro' },
  { codigo: '406', descricao: 'Cervejas de Malte', ncms: ['2203.00.00'], pisAdRem: 0.00, cofinsAdRem: 0.00, unidade: 'litro' },
];

// Busca produto na Tabela 4.3.10 pelo NCM
export function buscarTabela4310(ncm) {
  if (!ncm) return null;
  for (const prod of TABELA_4_3_10) {
    for (const ncmTabela of prod.ncms) {
      if (ncmMatch(ncm, ncmTabela)) return prod;
    }
  }
  return null;
}

// Busca produto na Tabela 4.3.11 pelo NCM
export function buscarTabela4311(ncm) {
  if (!ncm) return null;
  for (const prod of TABELA_4_3_11) {
    for (const ncmTabela of prod.ncms) {
      if (ncmMatch(ncm, ncmTabela)) return prod;
    }
  }
  return null;
}

// Validação cruzada de alíquotas monofásicas em C170/A170
// Deve ser chamada após o loop principal, com acesso ao catálogo 0200
export function validarAliquotasMonofasicas(linhas, erros, avisos) {
  // 1. Construir mapa COD_ITEM → NCM a partir dos registros 0200
  const itemNcmMap = {};
  for (const linha of linhas) {
    const c = linha.split('|');
    if (c[1] === '0200' && c[3]) {
      // 0200: |0200|COD_ITEM|DESCR_ITEM|COD_BARRA|COD_ANT_ITEM|UNID_INV|TIPO_ITEM|COD_NCM|...
      // partes[2]=COD_ITEM, partes[8]=COD_NCM
      const codItem = c[2];
      const ncm = c[8] || '';
      if (codItem && ncm) itemNcmMap[codItem] = ncm;
    }
  }

  // 2. Percorrer C170 e A170, validando alíquotas para CST 02 e 03
  let currentC100Linha = -1;
  for (let i = 0; i < linhas.length; i++) {
    const c = linhas[i].split('|');
    const reg = c[1] || '';

    if (reg === 'C100' || reg === 'A100') {
      currentC100Linha = i;
    } else if (reg.charAt(0) !== 'C' && reg.charAt(0) !== 'A' && reg !== '') {
      currentC100Linha = -1;
    }

    if (reg === 'C170') {
      // C170: partes[3]=COD_ITEM, partes[25]=CST_PIS, partes[27]=ALIQ_PIS,
      //       partes[28]=QUANT_BC_PIS, partes[29]=ALIQ_PIS_QUANT,
      //       partes[31]=CST_COFINS, partes[33]=ALIQ_COFINS, partes[35]=ALIQ_COFINS_QUANT
      const codItem = c[3] || '';
      const cstPis = c[25] || '';
      const cstCofins = c[31] || '';
      const aliqPis = c[27] || '';
      const aliqCofins = c[33] || '';
      const aliqPisQuant = c[29] || '';
      const aliqCofinsQuant = c[35] || '';
      const ncm = itemNcmMap[codItem] || '';

      // CST 02: alíquota percentual (Tabela 4.3.10)
      if (cstPis === '02' && ncm) {
        const prod = buscarTabela4310(ncm);
        if (prod && aliqPis) {
          const aliqInformada = parseFloat(aliqPis.replace(',', '.'));
          if (!isNaN(aliqInformada) && Math.abs(aliqInformada - prod.pis) > 0.01) {
            avisos.push({
              linha: i + 1,
              registro: 'C170',
              mensagem: `ALIQ_PIS (${aliqInformada}%) diverge da Tabela 4.3.10 para "${prod.descricao}" (esperado ${prod.pis}%). NCM: ${ncm}.`,
              severidade: 'aviso'
            });
          }
        }
      }
      if (cstCofins === '02' && ncm) {
        const prod = buscarTabela4310(ncm);
        if (prod && aliqCofins) {
          const aliqInformada = parseFloat(aliqCofins.replace(',', '.'));
          if (!isNaN(aliqInformada) && Math.abs(aliqInformada - prod.cofins) > 0.01) {
            avisos.push({
              linha: i + 1,
              registro: 'C170',
              mensagem: `ALIQ_COFINS (${aliqInformada}%) diverge da Tabela 4.3.10 para "${prod.descricao}" (esperado ${prod.cofins}%). NCM: ${ncm}.`,
              severidade: 'aviso'
            });
          }
        }
      }

      // CST 03: alíquota ad rem (Tabela 4.3.11)
      if (cstPis === '03' && ncm && aliqPisQuant) {
        const prod = buscarTabela4311(ncm);
        if (prod && prod.pisAdRem > 0) {
          const aliqInformada = parseFloat(aliqPisQuant.replace(',', '.'));
          if (!isNaN(aliqInformada) && Math.abs(aliqInformada - prod.pisAdRem) > 0.001) {
            avisos.push({
              linha: i + 1,
              registro: 'C170',
              mensagem: `ALIQ_PIS_QUANT (R$ ${aliqInformada}/${prod.unidade}) diverge da Tabela 4.3.11 para "${prod.descricao}" (esperado R$ ${prod.pisAdRem}/${prod.unidade}). NCM: ${ncm}.`,
              severidade: 'aviso'
            });
          }
        }
      }
      if (cstCofins === '03' && ncm && aliqCofinsQuant) {
        const prod = buscarTabela4311(ncm);
        if (prod && prod.cofinsAdRem > 0) {
          const aliqInformada = parseFloat(aliqCofinsQuant.replace(',', '.'));
          if (!isNaN(aliqInformada) && Math.abs(aliqInformada - prod.cofinsAdRem) > 0.001) {
            avisos.push({
              linha: i + 1,
              registro: 'C170',
              mensagem: `ALIQ_COFINS_QUANT (R$ ${aliqInformada}/${prod.unidade}) diverge da Tabela 4.3.11 para "${prod.descricao}" (esperado R$ ${prod.cofinsAdRem}/${prod.unidade}). NCM: ${ncm}.`,
              severidade: 'aviso'
            });
          }
        }
      }
    }

    if (reg === 'A170') {
      // A170: partes[3]=COD_ITEM, partes[9]=CST_PIS, partes[11]=ALIQ_PIS,
      //       partes[13]=CST_COFINS, partes[15]=ALIQ_COFINS
      const codItem = c[3] || '';
      const cstPis = c[9] || '';
      const cstCofins = c[13] || '';
      const aliqPis = c[11] || '';
      const aliqCofins = c[15] || '';
      const ncm = itemNcmMap[codItem] || '';

      if (cstPis === '02' && ncm) {
        const prod = buscarTabela4310(ncm);
        if (prod && aliqPis) {
          const aliqInformada = parseFloat(aliqPis.replace(',', '.'));
          if (!isNaN(aliqInformada) && Math.abs(aliqInformada - prod.pis) > 0.01) {
            avisos.push({
              linha: i + 1,
              registro: 'A170',
              mensagem: `ALIQ_PIS (${aliqInformada}%) diverge da Tabela 4.3.10 para "${prod.descricao}" (esperado ${prod.pis}%). NCM: ${ncm}.`,
              severidade: 'aviso'
            });
          }
        }
      }
      if (cstCofins === '02' && ncm) {
        const prod = buscarTabela4310(ncm);
        if (prod && aliqCofins) {
          const aliqInformada = parseFloat(aliqCofins.replace(',', '.'));
          if (!isNaN(aliqInformada) && Math.abs(aliqInformada - prod.cofins) > 0.01) {
            avisos.push({
              linha: i + 1,
              registro: 'A170',
              mensagem: `ALIQ_COFINS (${aliqInformada}%) diverge da Tabela 4.3.10 para "${prod.descricao}" (esperado ${prod.cofins}%). NCM: ${ncm}.`,
              severidade: 'aviso'
            });
          }
        }
      }
    }
  }
}
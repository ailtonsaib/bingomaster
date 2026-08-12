import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ success: false, error: 'Usuário não autenticado.' });

    const body = await req.json();
    const { order_id } = body;

    if (!order_id) {
      return Response.json({ success: false, error: 'ID do pedido não informado.' });
    }

    // Load the exit order
    const order = await base44.entities.PDVExitOrder.get(order_id);
    if (!order) {
      return Response.json({ success: false, error: 'Pedido não encontrado.' });
    }
    // Security: verify the order belongs to the authenticated user's company
    if (order.user_email && order.user_email !== user.email) {
      return Response.json({ success: false, error: 'Acesso negado: pedido não pertence à sua empresa.' });
    }
    if (order.status === 'emitida') {
      return Response.json({ success: false, error: 'NF-e já emitida para este pedido.' });
    }
    if (!order.items || order.items.length === 0) {
      return Response.json({ success: false, error: 'Pedido sem itens.' });
    }

    // Load company config
    const configs = await base44.entities.PDVCompanyConfig.filter({ user_email: user.email });
    const company = configs[0];
    if (!company) {
      return Response.json({ success: false, error: 'Configure os dados da empresa antes de emitir NF-e.' });
    }
    if (!company.cnpj || !company.ie || !company.uf || !company.ibge_code) {
      return Response.json({ success: false, error: 'Dados da empresa incompletos. Preencha CNPJ, IE, UF e código IBGE.' });
    }

    // UF codes (SEFAZ cUF)
    const UF_CODES: Record<string, string> = {
      'AC': '12', 'AL': '27', 'AP': '16', 'AM': '13', 'BA': '29', 'CE': '23',
      'DF': '53', 'ES': '32', 'GO': '52', 'MA': '21', 'MT': '51', 'MS': '50',
      'MG': '31', 'PA': '15', 'PB': '25', 'PR': '41', 'PE': '26', 'PI': '22',
      'RJ': '33', 'RN': '24', 'RS': '43', 'RO': '11', 'RR': '14', 'SC': '42',
      'SP': '35', 'SE': '28', 'TO': '17'
    };

    const cUF = UF_CODES[company.uf] || '42';
    const now = new Date();
    const aamm = String(now.getFullYear()).slice(2) + String(now.getMonth() + 1).padStart(2, '0');
    const cnpjClean = (company.cnpj || '').replace(/\D/g, '').padStart(14, '0').slice(-14);
    const mod = '55';
    const serie = String(company.nfe_series || 1).padStart(3, '0');
    const nNF = String(company.nfe_number_next || 1).padStart(9, '0');
    const tpEmis = '1';
    const cNF = String(Math.floor(Math.random() * 100000000)).padStart(8, '0');

    // Generate chave de acesso
    const chaveSemDV = cUF + aamm + cnpjClean + mod + serie + nNF + tpEmis + cNF;
    
    // Calculate DV (mod 11)
    let soma = 0;
    let peso = 2;
    for (let i = chaveSemDV.length - 1; i >= 0; i--) {
      soma += parseInt(chaveSemDV[i]) * peso;
      peso = peso === 9 ? 2 : peso + 1;
    }
    const resto = soma % 11;
    const dv = resto < 2 ? 0 : 11 - resto;
    const chaveAcesso = chaveSemDV + dv;

    // Format date for NF-e (ISO 8601 with timezone)
    const dhEmi = now.toISOString();

    // Helper to format numbers (NF-e uses . as decimal)
    const fmtN = (v: number, dec = 2): string => (Number(v) || 0).toFixed(dec).replace('.', '.');

    // Determine destination info
    const destUF = order.customer_uf || '';
    const isInterna = destUF === company.uf;
    const idDest = isInterna ? '1' : '2';

    // Build items XML
    let itemsXml = '';
    for (let i = 0; i < order.items.length; i++) {
      const item = order.items[i];
      const nItem = String(i + 1).padStart(3, '0');

      const cProd = (item.product_code || item.product_id || '').substring(0, 60);
      const cEAN = item.barcode ? item.barcode.padStart(14, '0').slice(-14) : 'SEM GTIN';
      const xProd = (item.product_name || '').substring(0, 120).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const ncm = (item.ncm || '99999999').padStart(8, '0').slice(-8);
      const cfop = (item.cfop || order.cfop || '5102').padStart(4, '0').slice(-4);
      const uCom = (item.unit || 'UN').substring(0, 6);
      const qCom = fmtN(item.quantity, 4);
      const vUnCom = fmtN(item.unit_price, 10);
      const vProd = fmtN(item.total);
      const indRegra = '3'; // 3=Arredondamento

      // ICMS block
      const orig = String(item.origin || 0);
      const csosn = item.csosn || '102';
      const cstIcms = item.cst_icms || '00';
      let icmsXml = '';

      // For Simples Nacional (CRT=1), use CSOSN
      if (company.crt === 1) {
        const csosnNode = csosn === '101' || csosn === '201' ? 'CSOSN' + csosn :
          csosn === '102' || csosn === '103' || csosn === '300' || csosn === '400' ? 'CSOSN' + csosn :
          'CSOSN' + csosn;
        icmsXml = `<ICMS><${csosnNode}><orig>${orig}</orig><CSOSN>${csosn}</CSOSN>`;
        if (csosn === '101' || csosn === '201') {
          icmsXml += `<pCredSN>${fmtN(item.icms_rate, 4)}</pCredSN><vCredICMSSN>${fmtN(item.icms_value)}</vCredICMSSN>`;
        }
        icmsXml += `</${csosnNode}></ICMS>`;
      } else {
        // Regime Normal - use CST
        if (cstIcms === '00') {
          icmsXml = `<ICMS><ICMS00><orig>${orig}</orig><CST>00</CST><modBC>3</modBC><vBC>${fmtN(item.total)}</vBC><pICMS>${fmtN(item.icms_rate, 4)}</pICMS><vICMS>${fmtN(item.icms_value)}</vICMS></ICMS00></ICMS>`;
        } else if (cstIcms === '40' || cstIcms === '41' || cstIcms === '50') {
          icmsXml = `<ICMS><ICMS40><orig>${orig}</orig><CST>${cstIcms}</CST></ICMS40></ICMS>`;
        } else {
          icmsXml = `<ICMS><ICMS00><orig>${orig}</orig><CST>00</CST><modBC>3</modBC><vBC>${fmtN(item.total)}</vBC><pICMS>${fmtN(item.icms_rate, 4)}</pICMS><vICMS>${fmtN(item.icms_value)}</vICMS></ICMS00></ICMS>`;
        }
      }

      // IPI block
      const cstIpi = item.cst_ipi || '99';
      let ipiXml = '';
      if (Number(item.ipi_rate) > 0) {
        ipiXml = `<IPI><cEnq>999</cEnq><IPITrib><CST>${cstIpi}</CST><vBC>${fmtN(item.total)}</vBC><pIPI>${fmtN(item.ipi_rate, 4)}</pIPI><vIPI>${fmtN(item.ipi_value)}</vIPI></IPITrib></IPI>`;
      } else {
        ipiXml = `<IPI><cEnq>999</cEnq><IPINT><CST>${cstIpi}</CST></IPINT></IPI>`;
      }

      // PIS block:
      // CST 04-09 = Não Tributada (PISNT) → monofásicos (Lei 13.097)
      // CST 01/02 = Tributada por Alíquota (PISAliq) → Regime Normal + Competência
      // CST 49 = Outras Operações → Simples Nacional (PIS via DAS, valor zero)
      // CST 98 = Outras Operações (Regime de Caixa) → PISOutr com valor
      const cstPis = item.cst_pis || '49';
      let pisXml = '';
      const pisNT = ['04','05','06','07','08','09'].includes(cstPis);
      const pisAliq = ['01','02'].includes(cstPis) && Number(item.pis_rate) > 0;
      if (pisNT) {
        pisXml = `<PIS><PISNT><CST>${cstPis}</CST></PISNT></PIS>`;
      } else if (pisAliq) {
        pisXml = `<PIS><PISAliq><CST>${cstPis}</CST><vBC>${fmtN(item.total)}</vBC><pPIS>${fmtN(item.pis_rate, 4)}</pPIS><vPIS>${fmtN(item.pis_value)}</vPIS></PISAliq></PIS>`;
      } else {
        // CST 49 (Simples, valor 0) ou CST 98 (Caixa, com valor) → PISOutr
        const vBC = Number(item.pis_rate) > 0 ? fmtN(item.total) : '0.00';
        const pPIS = Number(item.pis_rate) > 0 ? fmtN(item.pis_rate, 4) : '0.0000';
        const vPIS = Number(item.pis_rate) > 0 ? fmtN(item.pis_value) : '0.00';
        pisXml = `<PIS><PISOutr><CST>${cstPis}</CST><vBC>${vBC}</vBC><pPIS>${pPIS}</pPIS><vPIS>${vPIS}</vPIS></PISOutr></PIS>`;
      }

      // COFINS block — mesma lógica do PIS
      const cstCofins = item.cst_cofins || '49';
      let cofinsXml = '';
      const cofinsNT = ['04','05','06','07','08','09'].includes(cstCofins);
      const cofinsAliq = ['01','02'].includes(cstCofins) && Number(item.cofins_rate) > 0;
      if (cofinsNT) {
        cofinsXml = `<COFINS><COFINSNT><CST>${cstCofins}</CST></COFINSNT></COFINS>`;
      } else if (cofinsAliq) {
        cofinsXml = `<COFINS><COFINSAliq><CST>${cstCofins}</CST><vBC>${fmtN(item.total)}</vBC><pCOFINS>${fmtN(item.cofins_rate, 4)}</pCOFINS><vCOFINS>${fmtN(item.cofins_value)}</vCOFINS></COFINSAliq></COFINS>`;
      } else {
        const vBC = Number(item.cofins_rate) > 0 ? fmtN(item.total) : '0.00';
        const pCOFINS = Number(item.cofins_rate) > 0 ? fmtN(item.cofins_rate, 4) : '0.0000';
        const vCOFINS = Number(item.cofins_rate) > 0 ? fmtN(item.cofins_value) : '0.00';
        cofinsXml = `<COFINS><COFINSOutr><CST>${cstCofins}</CST><vBC>${vBC}</vBC><pCOFINS>${pCOFINS}</pCOFINS><vCOFINS>${vCOFINS}</vCOFINS></COFINSOutr></COFINS>`;
      }

      itemsXml += `
        <det nItem="${nItem}">
          <prod>
            <cProd>${cProd}</cProd>
            <cEAN>${cEAN}</cEAN>
            <xProd>${xProd}</xProd>
            <NCM>${ncm}</NCM>
            <CFOP>${cfop}</CFOP>
            <uCom>${uCom}</uCom>
            <qCom>${qCom}</qCom>
            <vUnCom>${vUnCom}</vUnCom>
            <vProd>${vProd}</vProd>
            <indRegra>${indRegra}</indRegra>
          </prod>
          <imposto>
            ${icmsXml}
            ${ipiXml}
            ${pisXml}
            ${cofinsXml}
          </imposto>
        </det>`;
    }

    // Destinatário
    const destCnpj = (order.customer_cpf_cnpj || '').replace(/\D/g, '');
    const isCnpj = destCnpj.length === 14;
    const destTag = isCnpj ? 'CNPJ' : 'CPF';
    const destDoc = isCnpj ? destCnpj.padStart(14, '0').slice(-14) : destCnpj.padStart(11, '0').slice(-11);
    const destName = (order.customer_name || '').substring(0, 60).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const indIEDest = isCnpj ? '1' : '9';

    let destXml = '';
    if (destDoc && destDoc !== '00000000000' && destDoc !== '00000000000000') {
      destXml = `
        <dest>
          <${destTag}>${destDoc}</${destTag}>
          <xNome>${destName}</xNome>
          <enderDest>
            <xLgr>${(order.customer_address || 'Nao informado').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</xLgr>
            <nro>${order.customer_number || 'S/N'}</nro>
            <xBairro>${(order.customer_district || 'Centro').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</xBairro>
            <cMun>${order.customer_ibge_code || '9999999'}</cMun>
            <xMun>${(order.customer_city || 'Nao informado').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</xMun>
            <UF>${order.customer_uf || company.uf}</UF>
            <CEP>${(order.customer_cep || '').replace(/\D/g, '').padStart(8, '0').slice(-8)}</CEP>
          </enderDest>
          <indIEDest>${indIEDest}</indIEDest>
        </dest>`;
    }

    // Totals
    const vProd = fmtN(order.total_products);
    const vICMS = fmtN(order.total_icms);
    const vIPI = fmtN(order.total_ipi);
    const vPIS = fmtN(order.total_pis);
    const vCOFINS = fmtN(order.total_cofins);
    const vNF = fmtN(order.total_nota);

    // Payment info
    const tPag = order.payment_method === '1' ? '15' : '01'; // 01=Dinheiro, 15=Boleto
    const vPag = vNF;

    // Build full NF-e XML
    const nfeXml = `<?xml version="1.0" encoding="UTF-8"?>
<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
  <infNFe Id="NFe${chaveAcesso}" versao="4.00">
    <ide>
      <cUF>${cUF}</cUF>
      <natOp>${(order.nature_operation || 'Venda de mercadoria').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</natOp>
      <mod>55</mod>
      <serie>${serie}</serie>
      <nNF>${nNF}</nNF>
      <dhEmi>${dhEmi}</dhEmi>
      <tpNF>1</tpNF>
      <idDest>${idDest}</idDest>
      <cMunFG>${company.ibge_code}</cMunFG>
      <tpImp>1</tpImp>
      <tpEmis>${tpEmis}</tpEmis>
      <cDV>${dv}</cDV>
      <tpAmb>${company.nfe_environment || '2'}</tpAmb>
      <finNFe>1</finNFe>
      <indFinal>1</indFinal>
      <indPres>1</indPres>
      <procEmi>0</procEmi>
    </ide>
    <emit>
      <CNPJ>${cnpjClean}</CNPJ>
      <xNome>${(company.razao_social || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</xNome>
      <xFant>${(company.nome_fantasia || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</xFant>
      <enderEmit>
        <xLgr>${(company.address || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</xLgr>
        <nro>${company.number || 'S/N'}</nro>
        <xBairro>${(company.district || 'Centro').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</xBairro>
        <cMun>${company.ibge_code}</cMun>
        <xMun>${(company.city || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</xMun>
        <UF>${company.uf}</UF>
        <CEP>${(company.cep || '').replace(/\D/g, '').padStart(8, '0').slice(-8)}</CEP>
      </enderEmit>
      <IE>${company.ie}</IE>
      <CRT>${company.crt || 1}</CRT>
    </emit>
    ${destXml}
    ${itemsXml}
    <total>
      <ICMSTot>
        <vProd>${vProd}</vProd>
        <vICMS>${vICMS}</vICMS>
        <vIPI>${vIPI}</vIPI>
        <vPIS>${vPIS}</vPIS>
        <vCOFINS>${vCOFINS}</vCOFINS>
        <vNF>${vNF}</vNF>
      </ICMSTot>
    </total>
    <transp>
      <modFrete>9</modFrete>
    </transp>
    <pag>
      <detPag>
        <tPag>${tPag}</tPag>
        <vPag>${vPag}</vPag>
      </detPag>
    </pag>
  </infNFe>
</NFe>`;

    // Update the order with NF-e data
    await base44.entities.PDVExitOrder.update(order_id, {
      status: 'emitida',
      nfe_number: nNF,
      nfe_series: serie,
      nfe_key: chaveAcesso,
      nfe_xml: nfeXml,
      nfe_issue_date: dhEmi,
    });

    // Increment the NF-e number in company config
    await base44.entities.PDVCompanyConfig.update(company.id, {
      nfe_number_next: (company.nfe_number_next || 1) + 1,
    });

    return Response.json({
      success: true,
      nfe_number: nNF,
      nfe_series: serie,
      nfe_key: chaveAcesso,
      nfe_xml: nfeXml,
      message: `NF-e ${nNF} gerada com sucesso. Chave: ${chaveAcesso}`
    });
  } catch (error) {
    return Response.json({ success: false, error: error.message });
  }
});
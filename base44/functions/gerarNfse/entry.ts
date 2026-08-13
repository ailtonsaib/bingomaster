import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { signElement } from '../../shared/nfeSigner.ts';

const ABRASF_NS = 'http://www.abrasf.org.br/nfse.xsd';

const esc = (s: any): string => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fmtN = (v: number, dec = 2): string => (Number(v) || 0).toFixed(dec);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { operation, email } = body;

    if (!email) return Response.json({ error: 'Email obrigatório' }, { status: 400 });
    const users = await base44.asServiceRole.entities.PortalUser.filter({ email });
    if (users.length === 0) return Response.json({ error: 'Usuário não encontrado' }, { status: 403 });
    if (!users[0].is_active) return Response.json({ error: 'Usuário inativo' }, { status: 403 });

    // ─── LISTAR NFS-e ───
    if (operation === 'list') {
      const list = await base44.asServiceRole.entities.Nfse.filter({ user_email: email }, '-emission_date', 100);
      return Response.json({ success: true, nfses: list });
    }

    // ─── LISTAR OS DISPONÍVEIS (concluídas/entregues) ───
    if (operation === 'listOrders') {
      const orders = await base44.asServiceRole.entities.ServiceOrder.filter({ user_email: email });
      const avail = orders
        .filter((o: any) => o.status === 'concluida' || o.status === 'entregue')
        .map((o: any) => ({
          id: o.id, order_number: o.order_number, client_name: o.client_name,
          total: o.total, labor_total: o.labor_total, parts_total: o.parts_total,
          service_type_name: o.service_type_name, client_cpf_cnpj: o.client_cpf_cnpj,
          client_phone: o.client_phone, completion_date: o.completion_date, delivery_date: o.delivery_date,
        }));
      return Response.json({ success: true, orders: avail });
    }

    // ─── OBTER CONFIG NFS-e ───
    if (operation === 'getConfig') {
      const cfgs = await base44.asServiceRole.entities.DiagnosticCompanyConfig.filter({ user_email: email });
      const c: any = cfgs[0] || null;
      return Response.json({
        success: true,
        config: c ? {
          inscricao_municipal: c.inscricao_municipal || '',
          ibge_code: c.ibge_code || '',
          nfse_webservice_url: c.nfse_webservice_url || '',
          nfse_environment: c.nfse_environment || '2',
          nfse_serie: c.nfse_serie || '1',
          nfse_numero_next: c.nfse_numero_next || 1,
        } : {},
      });
    }

    // ─── ATUALIZAR CONFIG NFS-e ───
    if (operation === 'updateConfig') {
      const { config } = body;
      const cfgs = await base44.asServiceRole.entities.DiagnosticCompanyConfig.filter({ user_email: email });
      if (!cfgs.length) return Response.json({ error: 'Empresa não configurada. Cadastre a oficina primeiro.' }, { status: 400 });
      await base44.asServiceRole.entities.DiagnosticCompanyConfig.update(cfgs[0].id, {
        inscricao_municipal: config.inscricao_municipal || '',
        ibge_code: config.ibge_code || '',
        nfse_webservice_url: config.nfse_webservice_url || '',
        nfse_environment: config.nfse_environment || '2',
        nfse_serie: config.nfse_serie || '1',
      });
      return Response.json({ success: true });
    }

    // ─── GERAR RPS / NFS-e ───
    if (operation === 'generate') {
      const { service_order_id, item_lista_servico, aliquota, valor_deducoes, iss_retido, discriminacao, codigo_tributacao, natureza_operacao, optante_simples } = body;
      if (!service_order_id) return Response.json({ error: 'Ordem de serviço é obrigatória' }, { status: 400 });
      if (!item_lista_servico) return Response.json({ error: 'Item da lista de serviço (código municipal) é obrigatório' }, { status: 400 });

      const cfgs = await base44.asServiceRole.entities.DiagnosticCompanyConfig.filter({ user_email: email });
      const company: any = cfgs[0];
      if (!company) return Response.json({ error: 'Configure os dados da empresa (oficina) antes de emitir NFS-e.' }, { status: 400 });
      if (!company.cnpj || !company.inscricao_municipal || !company.ibge_code) {
        return Response.json({ error: 'CNPJ, Inscrição Municipal e Código IBGE do município são obrigatórios. Configure em "Configurar NFS-e".' }, { status: 400 });
      }

      let order: any = null;
      try { const l = await base44.asServiceRole.entities.ServiceOrder.filter({ id: service_order_id }); if (l.length) order = l[0]; } catch (_) { /* id inválido */ }
      if (!order || order.user_email !== email) return Response.json({ error: 'Ordem de serviço não encontrada' }, { status: 404 });
      if (Number(order.total) <= 0) return Response.json({ error: 'Ordem de serviço sem valor. Total deve ser maior que zero.' }, { status: 400 });

      // Endereço do tomador (best-effort, a partir do cliente)
      let clientAddr: any = null;
      if (order.client_id) {
        try { const cl = await base44.asServiceRole.entities.DiagnosticClient.filter({ id: order.client_id }); if (cl.length) clientAddr = cl[0]; } catch (_) {}
      }

      const valorServicos = Number(order.total);
      const deducoes = Number(valor_deducoes) || 0;
      const aliq = Number(aliquota) || 0;
      const baseCalc = Math.max(0, valorServicos - deducoes);
      const valorIss = Number((baseCalc * aliq / 100).toFixed(2));
      const valorLiquido = valorServicos - deducoes;
      const issRet = iss_retido ? '1' : '2';

      const rpsNumber = String(company.nfse_numero_next || 1).padStart(15, '0');
      const rpsSerie = String(company.nfse_serie || '1');
      const numLote = String(company.nfse_numero_next || 1);
      const dhEmi = new Date().toISOString();
      const natureza = String(natureza_operacao || '1');
      const optante = String(optante_simples || '2');
      const cnpjClean = String(company.cnpj).replace(/\D/g, '').padStart(14, '0').slice(-14);

      const doc = String(order.client_cpf_cnpj || '').replace(/\D/g, '');
      const isCnpj = doc.length === 14;
      const tomadorDoc = isCnpj ? `<Cnpj>${doc.padStart(14, '0').slice(-14)}</Cnpj>` : (doc.length === 11 ? `<Cpf>${doc}</Cpf>` : '');
      let tomadorXml = '';
      if (tomadorDoc) {
        let endXml = '';
        if (clientAddr && clientAddr.address) {
          endXml = `<Endereco><Endereco>${esc(clientAddr.address)}</Endereco><Numero>${esc(clientAddr.number || 'S/N')}</Numero><Bairro>${esc(clientAddr.district || 'Centro')}</Bairro><CodigoMunicipio>${esc(clientAddr.ibge_code || company.ibge_code)}</CodigoMunicipio><Uf>${esc(clientAddr.uf || company.uf)}</Uf><Cep>${String(clientAddr.cep || '').replace(/\D/g, '').padStart(8, '0').slice(-8)}</Cep></Endereco>`;
        }
        tomadorXml = `<Tomador><IdentificacaoTomador><CpfCnpj>${tomadorDoc}</CpfCnpj></IdentificacaoTomador><RazaoSocial>${esc(order.client_name)}</RazaoSocial>${endXml}<Contato><Telefone>${esc(order.client_phone || '')}</Telefone></Contato></Tomador>`;
      }

      const discriminacaoText = esc(discriminacao || `${order.service_type_name || 'Serviço de manutenção automotiva'} — OS ${order.order_number}`.substring(0, 2000));

      const rpsXml = `<?xml version="1.0" encoding="UTF-8"?>
<EnviarLoteRpsEnvio xmlns="${ABRASF_NS}">
  <LoteRps Id="LOTE${numLote}" versao="2.03">
    <NumeroLote>${numLote}</NumeroLote>
    <Cnpj>${cnpjClean}</Cnpj>
    <InscricaoMunicipal>${esc(company.inscricao_municipal)}</InscricaoMunicipal>
    <QuantidadeRps>1</QuantidadeRps>
    <ListaRps>
      <Rps>
        <InfRps Id="RPS${rpsNumber}">
          <IdentificacaoRps>
            <Numero>${rpsNumber}</Numero>
            <Serie>${rpsSerie}</Serie>
            <Tipo>1</Tipo>
          </IdentificacaoRps>
          <DataEmissao>${dhEmi}</DataEmissao>
          <NaturezaOperacao>${natureza}</NaturezaOperacao>
          <OptanteSimplesNacional>${optante}</OptanteSimplesNacional>
          <IncentivadorCultural>2</IncentivadorCultural>
          <Status>1</Status>
          <Servico>
            <Valores>
              <ValorServicos>${fmtN(valorServicos)}</ValorServicos>
              <ValorDeducoes>${fmtN(deducoes)}</ValorDeducoes>
              <ValorPis>0.00</ValorPis>
              <ValorCofins>0.00</ValorCofins>
              <ValorInss>0.00</ValorInss>
              <ValorIr>0.00</ValorIr>
              <ValorCsll>0.00</ValorCsll>
              <IssRetido>${issRet}</IssRetido>
              <ValorIss>${fmtN(valorIss)}</ValorIss>
              <Aliquota>${fmtN(aliq, 4)}</Aliquota>
              <DescontoIncondicionado>0.00</DescontoIncondicionado>
              <DescontoCondicionado>0.00</DescontoCondicionado>
              <BaseCalculo>${fmtN(baseCalc)}</BaseCalculo>
              <ValorLiquidoNfse>${fmtN(valorLiquido)}</ValorLiquidoNfse>
            </Valores>
            <ItemListaServico>${esc(item_lista_servico)}</ItemListaServico>
            ${codigo_tributacao ? `<CodigoTributacaoMunicipio>${esc(codigo_tributacao)}</CodigoTributacaoMunicipio>` : ''}
            <Discriminacao>${discriminacaoText}</Discriminacao>
            <CodigoMunicipio>${company.ibge_code}</CodigoMunicipio>
          </Servico>
          <Prestador>
            <Cnpj>${cnpjClean}</Cnpj>
            <InscricaoMunicipal>${esc(company.inscricao_municipal)}</InscricaoMunicipal>
          </Prestador>
          ${tomadorXml}
        </InfRps>
      </Rps>
    </ListaRps>
  </LoteRps>
</EnviarLoteRpsEnvio>`;

      // Assina o InfRps com certificado A1 ativo (modelos inclui NFSe)
      let signedXml = rpsXml;
      try {
        const certs = await base44.asServiceRole.entities.DigitalCertificate.filter({ user_email: email, is_active: true });
        const cert = certs.find((c: any) => c.modelos && c.modelos.includes('NFSe') && c.valid_to && new Date(c.valid_to) > new Date());
        if (cert) {
          const signed = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: cert.file_uri, expires_in: 120 });
          const resp = await fetch(signed.signed_url);
          if (resp.ok) {
            const bytes = new Uint8Array(await resp.arrayBuffer());
            signedXml = signElement(rpsXml, 'InfRps', ABRASF_NS, bytes, cert.password);
            await base44.asServiceRole.entities.DigitalCertificate.update(cert.id, { last_used_at: new Date().toISOString() });
          }
        }
      } catch (e) { console.log('Falha ao assinar RPS:', (e as Error).message); }

      const created = await base44.asServiceRole.entities.Nfse.create({
        user_email: email,
        service_order_id: order.id,
        order_number: order.order_number,
        rps_number: rpsNumber,
        rps_series: rpsSerie,
        emission_date: dhEmi,
        prestador_cnpj: cnpjClean,
        prestador_im: company.inscricao_municipal,
        prestador_razao: company.razao_social,
        prestador_ibge: company.ibge_code,
        prestador_city: company.city,
        prestador_uf: company.uf,
        tomador_doc: doc,
        tomador_name: order.client_name,
        service_code: item_lista_servico,
        service_discriminacao: discriminacaoText,
        valor_servicos: valorServicos,
        valor_deducoes: deducoes,
        base_calculo: baseCalc,
        aliquota: aliq,
        valor_iss: valorIss,
        iss_retido: !!iss_retido,
        valor_liquido: valorLiquido,
        total_nota: valorLiquido,
        rps_xml: signedXml,
        status: 'rascunho',
        ambiente: String(company.nfse_environment || '2'),
      });

      await base44.asServiceRole.entities.DiagnosticCompanyConfig.update(company.id, {
        nfse_numero_next: (company.nfse_numero_next || 1) + 1,
      });

      return Response.json({ success: true, nfse: created, rps_number: rpsNumber, message: 'RPS gerado. Transmita à prefeitura para obter o número da NFS-e.' });
    }

    return Response.json({ error: 'Operação inválida' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
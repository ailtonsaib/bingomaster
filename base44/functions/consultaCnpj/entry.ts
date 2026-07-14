import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const cnpj = (body.cnpj || '').replace(/\D/g, '');

    if (cnpj.length !== 14) {
      return Response.json({ success: false, error: 'CNPJ deve ter 14 dígitos.' }, { status: 400 });
    }

    // Validação do dígito verificador
    const calcDig = (base: string, pesos: number[]): number => {
      let soma = 0;
      for (let i = 0; i < pesos.length; i++) soma += parseInt(base[i]) * pesos[i];
      const resto = soma % 11;
      return resto < 2 ? 0 : 11 - resto;
    };
    const dig1 = calcDig(cnpj, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
    const dig2 = calcDig(cnpj + dig1, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
    if (parseInt(cnpj[12]) !== dig1 || parseInt(cnpj[13]) !== dig2) {
      return Response.json({ success: false, error: `CNPJ ${cnpj.slice(0,2)}.${cnpj.slice(2,5)}.${cnpj.slice(5,8)}/${cnpj.slice(8,12)}-${cnpj.slice(12)} inválido (dígito verificador incorreto).` }, { status: 400 });
    }

    // Tentativa 1: BrasilAPI
    let dados = null;
    let ultimoErro = null;

    try {
      const resp1 = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(8000)
      });
      if (resp1.ok) {
        const d = await resp1.json();
        dados = {
          razao_social: d.razao_social || '',
          nome_fantasia: d.nome_fantasia || '',
          cep: d.cep || '',
          logradouro: d.logradouro || '',
          descricao_tipo_de_logradouro: d.descricao_tipo_de_logradouro || '',
          numero: d.numero || '',
          complemento: d.complemento || '',
          bairro: d.bairro || '',
          municipio: d.municipio || '',
          uf: d.uf || '',
          codigo_ibge_municipio: d.codigo_ibge_municipio ? String(d.codigo_ibge_municipio) : '',
          telefone: d.telefone || '',
          email: d.email || '',
          fonte: 'brasilapi'
        };
      } else if (resp1.status === 400) {
        // BrasilAPI pode rejeitar CNPJs válidos — tentar fallback antes de descartar
        ultimoErro = 'BrasilAPI rejeitou o CNPJ';
      } else {
        ultimoErro = `BrasilAPI status ${resp1.status}`;
      }
    } catch (e) {
      ultimoErro = `BrasilAPI: ${e.message}`;
    }

    // Tentativa 2: ReceitaWS (fallback)
    if (!dados) {
      try {
        const resp2 = await fetch(`https://receitaws.com.br/v1/cnpj/${cnpj}`, {
          headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
          signal: AbortSignal.timeout(8000)
        });
        if (resp2.ok) {
          const d = await resp2.json();
          if (d?.nome) {
            dados = {
              razao_social: d.nome || '',
              nome_fantasia: d.fantasia || '',
              cep: (d.cep || '').replace(/\./g, ''),
              logradouro: d.logradouro || '',
              descricao_tipo_de_logradouro: '',
              numero: d.numero || '',
              complemento: d.complemento || '',
              bairro: d.bairro || '',
              municipio: d.municipio || '',
              uf: d.uf || '',
              codigo_ibge_municipio: '',
              telefone: d.telefone || '',
              email: d.email || '',
              fonte: 'receitaws'
            };
          } else if (d?.status === 'ERROR') {
            return Response.json({ success: false, error: d.message || 'CNPJ inválido.' }, { status: 400 });
          } else {
            ultimoErro = d?.message || 'ReceitaWS sem dados';
          }
        } else {
          ultimoErro = `ReceitaWS status ${resp2.status}`;
        }
      } catch (e) {
        ultimoErro = `ReceitaWS: ${e.message}`;
      }
    }

    if (!dados) {
      return Response.json({ success: false, error: `Não foi possível consultar o CNPJ. ${ultimoErro || ''}`.trim() }, { status: 502 });
    }

    return Response.json({ success: true, dados });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});
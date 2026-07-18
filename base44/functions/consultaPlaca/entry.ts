import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { createHmac } from 'node:crypto';

// Gera o token SINESP: HMAC-SHA1 da placa com a chave secreta do app
function generateToken(placa: string, secret: string): string {
  return createHmac('sha1', secret).update(placa).digest('hex');
}

// Extrai o conteúdo de uma tag XML via regex
function getTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}>(.*?)</${tag}>`, 'is'));
  return match ? match[1].trim() : '';
}

// Consulta SINESP Cidadão — base pública gratuita do governo, sem token/cadastro
async function consultarSinesp(placa: string): Promise<any> {
  const secret = 'shienshenlhq';
  const token = generateToken(placa, secret);

  // Coordenadas aleatórias (simula o app móvel)
  const lat = ((20000 / 111000.0 * Math.sqrt(Math.random() * 1000)) * Math.sin(2 * Math.PI * Math.random() * 1000) + -38.5290245).toString();
  const lon = ((20000 / 111000.0 * Math.sqrt(Math.random() * 1000)) * Math.cos(2 * Math.PI * Math.random() * 1000) + -3.7506985).toString();

  const soapBody = `<?xml version="1.0" encoding="utf-8" standalone="yes" ?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
<soap:Header>
<dispositivo>GT-S1312L</dispositivo>
<nomeSO>Android</nomeSO>
<versaoAplicativo>1.1.1</versaoAplicativo>
<versaoSO>4.1.4</versaoSO>
<aplicativo>aplicativo</aplicativo>
<ip>177.206.169.90</ip>
<token>${token}</token>
<latitude>${lat}</latitude>
<longitude>${lon}</longitude>
</soap:Header>
<soap:Body>
<webs:getStatus xmlns:webs="http://soap.ws.placa.service.sinesp.serpro.gov.br/">
<placa>${placa}</placa>
</webs:getStatus>
</soap:Body>
</soap:Envelope>`;

  // Tenta múltiplos endpoints — o SINESP muda de URL periodicamente
  const endpoints = [
    'https://cidadao.sinesp.gov.br/sinesp-cidadao/consulta/placa/consultaPlaca',
    'http://sinespcidadao.sinesp.gov.br/sinesp-cidadao/ConsultaPlacaNovo27032014',
    'https://sinespcidadao.sinesp.gov.br/sinesp-cidadao/ConsultaPlacaNovo27032014',
  ];

  let xml = '';
  let lastError = null;
  for (const url of endpoints) {
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'Accept': 'text/plain, */*; q=0.01',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'User-Agent': 'Mozilla/5.0 (Linux; U; Android 4.1.4; pt-br; GT-S1312L Build/IMM76I) AppleWebKit/534.30 (KHTML, like Gecko) Version/4.0 Mobile Safari/534.30',
        },
        body: soapBody,
        signal: AbortSignal.timeout(8000),
      });
      xml = await resp.text();
      if (xml.includes('codigoRetorno') || xml.includes('return')) break;
    } catch (e) {
      lastError = e;
    }
  }

  if (!xml) {
    throw new Error(lastError?.message || 'Não foi possível conectar ao SINESP. O serviço pode estar indisponível ou bloqueando conexões.');
  }

  // DEBUG: se a resposta não contém os campos esperados, retorna o XML bruto para análise
  const codigoRetorno = getTag(xml, 'codigoRetorno');
  if (!codigoRetorno) {
    // Tenta tag alternativa "return" (resposta SINESP legada)
    const returnContent = getTag(xml, 'return');
    if (returnContent) {
      // O conteúdo de return vem com entidades HTML escapadas
      const unescaped = returnContent
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');
      const innerCodigo = getTag(unescaped, 'codigoRetorno');
      if (innerCodigo === '0') {
        return {
          encontrado: true,
          marca: getTag(unescaped, 'marca'),
          modelo: getTag(unescaped, 'modelo'),
          ano: getTag(unescaped, 'ano') || getTag(unescaped, 'anoModelo'),
          cor: getTag(unescaped, 'cor'),
          combustivel: getTag(unescaped, 'combustivel'),
          chassi: getTag(unescaped, 'chassi'),
          municipio: getTag(unescaped, 'municipio'),
          uf: getTag(unescaped, 'uf'),
          situacao: getTag(unescaped, 'situacao'),
        };
      }
      throw new Error(getTag(unescaped, 'mensagemRetorno') || `SINESP retornou código interno ${innerCodigo || 'vazio'}`);
    }
    // Sem return nem codigoRetorno — resposta inesperada
    throw new Error(`Resposta SINESP inesperada: ${xml.substring(0, 500)}`);
  }

  if (codigoRetorno === '0') {
    return {
      encontrado: true,
      marca: getTag(xml, 'marca'),
      modelo: getTag(xml, 'modelo'),
      ano: getTag(xml, 'ano') || getTag(xml, 'anoModelo'),
      cor: getTag(xml, 'cor'),
      combustivel: getTag(xml, 'combustivel'),
      chassi: getTag(xml, 'chassi'),
      municipio: getTag(xml, 'municipio'),
      uf: getTag(xml, 'uf'),
      situacao: getTag(xml, 'situacao'),
    };
  }

  const msg = getTag(xml, 'mensagemRetorno');
  throw new Error(msg || `SINESP retornou código ${codigoRetorno || 'vazio'}`);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const placa = (body.placa || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();

    if (placa.length < 7) {
      return Response.json({ success: false, error: 'Placa inválida. Deve ter 7 caracteres (formato antigo AAA0000 ou Mercosul AAA0A00).' });
    }

    // 1. Tenta SINESP (base pública gratuita do governo)
    try {
      const dados = await consultarSinesp(placa);
      return Response.json({ success: true, ...dados });
    } catch (sinespErr) {
      // 2. Fallback: InvokeLLM com busca na internet
      try {
        const llmResult = await base44.integrations.Core.InvokeLLM({
          prompt: `Busque na internet os dados do veículo brasileiro de placa "${placa}". Consulte sites de anúncios veiculares (Webmotors, OLX, FIPE), sites de leilão e bases públicas. Retorne: marca, modelo, ano, cor, combustível e chassi se encontrar. Se não encontrar dados específicos para esta placa, retorne encontrado=false.`,
          add_context_from_internet: true,
          model: 'gemini_3_flash',
          response_json_schema: {
            type: 'object',
            properties: {
              encontrado: { type: 'boolean' },
              marca: { type: 'string' },
              modelo: { type: 'string' },
              ano: { type: 'string' },
              cor: { type: 'string' },
              combustivel: { type: 'string' },
              chassi: { type: 'string' },
            }
          }
        });

        if (llmResult?.encontrado) {
          return Response.json({
            success: true,
            encontrado: true,
            marca: llmResult.marca || '',
            modelo: llmResult.modelo || '',
            ano: llmResult.ano || '',
            cor: llmResult.cor || '',
            combustivel: llmResult.combustivel || '',
            chassi: llmResult.chassi || '',
          });
        }
      } catch (llmErr) {
        // Ignora erro do LLM e cai no erro final
      }

      return Response.json({
        success: false,
        error: 'Não foi possível consultar a placa no momento. O SINESP Cidadão (base gratuita do governo) está indisponível. Tente novamente mais tarde ou preencha os dados manualmente.'
      });
    }
  } catch (error) {
    return Response.json({ success: false, error: error.message });
  }
});
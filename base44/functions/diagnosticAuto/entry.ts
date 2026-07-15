import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const {
      vehicle_brand, vehicle_model, vehicle_year, vehicle_engine,
      vehicle_mileage, vehicle_fuel, symptoms, description
    } = body;

    if (!vehicle_brand || !vehicle_model || !symptoms || symptoms.length === 0) {
      return Response.json({ error: 'Informe marca, modelo e pelo menos um sintoma.' }, { status: 400 });
    }

    const symptomsText = symptoms.map((s: string, i: number) => `${i + 1}. ${s}`).join('\n');

    const prompt = `Você é um mecânico automotivo experiente e diagnosticsista. Analise os dados do veículo e os sintomas relatados para identificar as possíveis causas do problema.

DADOS DO VEÍCULO:
- Marca: ${vehicle_brand}
- Modelo: ${vehicle_model}
- Ano: ${vehicle_year || 'Não informado'}
- Motor: ${vehicle_engine || 'Não informado'}
- Quilometragem: ${vehicle_mileage || 'Não informada'} km
- Combustível: ${vehicle_fuel || 'Não informado'}

SINTOMAS SELECIONADOS:
${symptomsText}

DESCRIÇÃO ADICIONAL DO PROBLEMA:
${description || 'Nenhuma descrição adicional fornecida.'}

Com base nessas informações, forneça um diagnóstico técnico estruturado identificando as possíveis causas do problema. Considere:
- Falhas comuns para o modelo/ano/motor informado
- Influência da quilometragem no desgaste de componentes
- Interação entre os sintomas (alguns podem ter causa comum)
- Priorize as causas mais prováveis primeiro

Para cada causa, explique brevemente o porquê e dê uma recomendação prática. Seja técnico mas acessível.`;

    const llmResponse = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: "object",
        properties: {
          summary: {
            type: "string",
            description: "Resumo conciso do diagnóstico (2-3 frases)"
          },
          urgency: {
            type: "string",
            enum: ["baixa", "media", "alta"],
            description: "Nível de urgência: alta=não dirija/pare imediatamente, media=procure um mecânico em breve, baixa=manutenção programada"
          },
          possible_causes: {
            type: "array",
            items: {
              type: "object",
              properties: {
                cause: { type: "string", description: "Nome da possível causa" },
                probability: { type: "string", enum: ["alta", "media", "baixa"], description: "Probabilidade dessa ser a causa real" },
                description: { type: "string", description: "Explicação técnica de por que essa causa é provável" },
                recommendation: { type: "string", description: "Recomendação prática de what fazer" }
              }
            },
            description: "Lista de possíveis causas, ordenadas por probabilidade"
          },
          general_recommendation: {
            type: "string",
            description: "Recomendação geral sobre próximos passos"
          }
        }
      }
    });

    // Save diagnostic record
    const record = await base44.entities.DiagnosticRecord.create({
      user_email: user.email,
      vehicle_brand,
      vehicle_model,
      vehicle_year: vehicle_year || '',
      vehicle_engine: vehicle_engine || '',
      vehicle_mileage: vehicle_mileage || 0,
      vehicle_fuel: vehicle_fuel || 'flex',
      symptoms,
      description: description || '',
      summary: llmResponse.summary || '',
      urgency: llmResponse.urgency || 'media',
      possible_causes: llmResponse.possible_causes || [],
      general_recommendation: llmResponse.general_recommendation || ''
    });

    return Response.json({ result: llmResponse, record_id: record.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const {
      vehicle_brand, vehicle_model, vehicle_year, vehicle_engine,
      vehicle_plate, vehicle_mileage, vehicle_fuel, symptoms, description,
      obd2_data, email: rawEmail
    } = body;

    // Resolve email efetivo — usuários de oficina usam owner_email
    let userEmail = rawEmail;
    if (rawEmail) {
      const wsUsers = await base44.asServiceRole.entities.WorkshopUser.filter({ email: rawEmail });
      if (wsUsers.length > 0) {
        userEmail = wsUsers[0].owner_email;
      }
    }
    if (!userEmail) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // If OBD2 data is provided, we can skip the symptoms requirement
    const hasObd2 = obd2_data && obd2_data.dtcs && obd2_data.dtcs.length > 0;
    const hasSymptoms = symptoms && symptoms.length > 0;

    if (!vehicle_brand || !vehicle_model) {
      return Response.json({ error: 'Informe marca e modelo do veículo.' }, { status: 400 });
    }

    if (!hasObd2 && !hasSymptoms) {
      return Response.json({ error: 'Informe os sintomas ou realize uma leitura OBD2.' }, { status: 400 });
    }

    // ─── Plan limit check ───
    const portalUsers = await base44.asServiceRole.entities.PortalUser.filter({ email: userEmail });
    if (portalUsers.length === 0) {
      return Response.json({ error: 'Usuário não encontrado no portal. Contate o administrador.' }, { status: 403 });
    }
    const portalUser = portalUsers[0];
    if (!portalUser.is_admin) {
      const planId = portalUser.diagnostic_plan || 'free';
      const configs = await base44.asServiceRole.entities.DiagnosticPlanConfig.filter({ plan_id: planId, is_active: true });
      const maxDiag = configs.length > 0 ? configs[0].max_diagnostics : (planId === 'master' ? -1 : 5);
      if (maxDiag >= 0) {
        const records = await base44.asServiceRole.entities.DiagnosticRecord.filter({ user_email: userEmail });
        if (records.length >= maxDiag) {
          return Response.json({ error: `Limite de ${maxDiag} diagnósticos atingido no plano ${planId.toUpperCase()}. Faça upgrade para o plano Master.` }, { status: 403 });
        }
      }
    }

    let symptomsText = 'Nenhum sintoma selecionado (diagnóstico baseado em leitura OBD2).';
    if (hasSymptoms) {
      symptomsText = symptoms.map((s: string, i: number) => `${i + 1}. ${s}`).join('\n');
    }

    let obd2Text = 'Nenhuma leitura OBD2 fornecida.';
    if (hasObd2) {
      const dtcList = obd2_data.dtcs.map((d: any) => `  - ${d.code}: ${d.description}`).join('\n');
      const liveDataList = (obd2_data.live_data || obd2_data.liveData || []).map((d: any) => `  - ${d.name}: ${d.value} ${d.unit}`).join('\n');
      obd2Text = `CÓDIGOS DE FALHA (DTCs) LIDOS DA ECU:\n${dtcList}\n\nDADOS DOS SENSORES EM TEMPO REAL:\n${liveDataList}`;
    }

    const prompt = `Você é um mecânico automotivo experiente e diagnósticista. Analise os dados do veículo, os códigos de falha OBD2 (se disponíveis) e os sintomas relatados para identificar as possíveis causas do problema.

DADOS DO VEÍCULO:
- Marca: ${vehicle_brand}
- Modelo: ${vehicle_model}
- Ano: ${vehicle_year || 'Não informado'}
- Motor: ${vehicle_engine || 'Não informado'}
- Quilometragem: ${vehicle_mileage || 'Não informada'} km
- Combustível: ${vehicle_fuel || 'Não informado'}

${obd2Text}

SINTOMAS SELECIONADOS:
${symptomsText}

DESCRIÇÃO ADICIONAL DO PROBLEMA:
${description || 'Nenhuma descrição adicional fornecida.'}

Com base nessas informações, forneça um diagnóstico técnico estruturado identificando as possíveis causas do problema. Considere:
- Os códigos DTC lidos diretamente da ECU (prioridade máxima se disponíveis)
- Falhas comuns para o modelo/ano/motor informado
- Influência da quilometragem no desgaste de componentes
- Interação entre os sintomas e códigos de falha (alguns podem ter causa comum)
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
                recommendation: { type: "string", description: "Recomendação prática do que fazer" }
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
      user_email: userEmail,
      vehicle_brand,
      vehicle_model,
      vehicle_year: vehicle_year || '',
      vehicle_engine: vehicle_engine || '',
      vehicle_plate: vehicle_plate || '',
      vehicle_mileage: vehicle_mileage || 0,
      vehicle_fuel: vehicle_fuel || 'flex',
      symptoms: hasSymptoms ? symptoms : (hasObd2 ? obd2_data.dtcs.map((d: any) => `DTC: ${d.code}`) : []),
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
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

async function getSupabaseConfig(base44) {
  const { accessToken } = await base44.asServiceRole.connectors.getConnection('supabase');
  const projectsRes = await fetch('https://api.supabase.com/v1/projects', { headers: { Authorization: `Bearer ${accessToken}` } });
  const projects = await projectsRes.json();
  const projectRef = projects[0]?.id;
  if (!projectRef) throw new Error('Projeto Supabase não encontrado');

  const keysRes = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/api-keys`, { headers: { Authorization: `Bearer ${accessToken}` } });
  const keys = await keysRes.json();
  const serviceKey = keys.find((k) => k.name === 'service_role')?.api_key;
  if (!serviceKey) throw new Error('service_role key não encontrada');

  return { supabaseUrl: `https://${projectRef}.supabase.co`, serviceKey };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { operation, table, data, filters, select = '*' } = await req.json();

    if (!operation) {
      return Response.json({ error: 'operation é obrigatório (select, insert, update, delete)' }, { status: 400 });
    }
    if (!table) {
      return Response.json({ error: 'table é obrigatório' }, { status: 400 });
    }

    const { supabaseUrl, serviceKey } = await getSupabaseConfig(base44);
    const baseUrl = `${supabaseUrl}/rest/v1/${table}`;

    const headers = {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    };

    let result;

    if (operation === 'select') {
      let url = `${baseUrl}?select=${encodeURIComponent(select)}`;
      if (filters && typeof filters === 'object') {
        for (const [key, value] of Object.entries(filters)) {
          url += `&${key}=eq.${encodeURIComponent(String(value))}`;
        }
      }
      const res = await fetch(url, { method: 'GET', headers });
      if (!res.ok) {
        const errText = await res.text();
        return Response.json({ error: `Supabase error: ${errText}` }, { status: res.status });
      }
      const rows = await res.json();
      result = { rows, rowCount: rows.length };

    } else if (operation === 'insert') {
      if (!data) return Response.json({ error: 'data é obrigatório para insert' }, { status: 400 });
      const body = Array.isArray(data) ? JSON.stringify(data) : JSON.stringify([data]);
      const res = await fetch(baseUrl, {
        method: 'POST',
        headers: { ...headers, 'Prefer': 'return=representation' },
        body,
      });
      if (!res.ok) {
        const errText = await res.text();
        return Response.json({ error: `Supabase error: ${errText}` }, { status: res.status });
      }
      const rows = await res.json();
      result = { rows, rowCount: rows.length };

    } else if (operation === 'update') {
      if (!data) return Response.json({ error: 'data é obrigatório para update' }, { status: 400 });
      if (!filters || Object.keys(filters).length === 0) {
        return Response.json({ error: 'filters é obrigatório para update (segurança)' }, { status: 400 });
      }
      let url = `${baseUrl}?`;
      for (const [key, value] of Object.entries(filters)) {
        url += `&${key}=eq.${encodeURIComponent(String(value))}`;
      }
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { ...headers, 'Prefer': 'return=representation' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const errText = await res.text();
        return Response.json({ error: `Supabase error: ${errText}` }, { status: res.status });
      }
      const rows = await res.json();
      result = { rows, rowCount: rows.length };

    } else if (operation === 'delete') {
      if (!filters || Object.keys(filters).length === 0) {
        return Response.json({ error: 'filters é obrigatório para delete (segurança)' }, { status: 400 });
      }
      let url = `${baseUrl}?`;
      for (const [key, value] of Object.entries(filters)) {
        url += `&${key}=eq.${encodeURIComponent(String(value))}`;
      }
      const res = await fetch(url, {
        method: 'DELETE',
        headers: { ...headers, 'Prefer': 'return=representation' },
      });
      if (!res.ok) {
        const errText = await res.text();
        return Response.json({ error: `Supabase error: ${errText}` }, { status: res.status });
      }
      const rows = await res.json();
      result = { rows, rowCount: rows.length };

    } else {
      return Response.json({ error: `Operação não suportada: ${operation}. Use: select, insert, update, delete` }, { status: 400 });
    }

    return Response.json(result);

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
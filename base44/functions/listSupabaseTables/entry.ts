import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('supabase');

    // 1. List projects to find the ref
    const projectsRes = await fetch('https://api.supabase.com/v1/projects', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const projects = await projectsRes.json();
    const project = projects[0];
    if (!project) {
      return Response.json({ error: 'Nenhum projeto Supabase encontrado' }, { status: 404 });
    }

    const projectRef = project.id;

    // 2. Inspect schema (read-only query endpoint)
    const schemaRes = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query/read-only`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;" }),
    });
    const schemaText = await schemaRes.text();
    let schemaData;
    try { schemaData = JSON.parse(schemaText); } catch { schemaData = { raw: schemaText }; }

    return Response.json({
      project: { name: project.name, ref: projectRef, url: `https://${projectRef}.supabase.co` },
      schema: schemaData,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
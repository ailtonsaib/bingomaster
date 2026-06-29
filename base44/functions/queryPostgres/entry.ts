import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import pg from 'npm:pg@8.11.3';
import tls from 'node:tls';

// Workaround: Deno's TLS polyfill doesn't support rejectUnauthorized.
// Strip it before it reaches Deno.startTls().
const originalConnect = tls.connect;
tls.connect = function (options, ...args) {
  if (options && typeof options === 'object') {
    delete options.rejectUnauthorized;
  }
  return originalConnect.call(this, options, ...args);
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sql, params = [] } = await req.json();

    if (!sql) {
      return Response.json({ error: 'sql é obrigatório' }, { status: 400 });
    }

    const useSsl = Deno.env.get('PGSSL') === 'true';

    const client = new pg.Client({
      host: Deno.env.get('PGHOST'),
      port: Number(Deno.env.get('PGPORT') || 5432),
      user: Deno.env.get('PGUSER'),
      password: Deno.env.get('PGPASSWORD'),
      database: Deno.env.get('PGDATABASE'),
      ssl: useSsl ? true : false,
    });

    await client.connect();
    try {
      const result = await client.query(sql, params);
      return Response.json({
        rows: result.rows,
        rowCount: result.rowCount,
        fields: result.fields.map((f) => f.name),
      });
    } finally {
      await client.end();
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
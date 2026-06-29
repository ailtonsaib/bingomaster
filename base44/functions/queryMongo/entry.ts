import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { MongoClient } from 'npm:mongodb@4.17.2';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { collection, operation, query = {}, data = {}, options = {} } = await req.json();

    if (!collection || !operation) {
      return Response.json({ error: 'collection e operation são obrigatórios' }, { status: 400 });
    }

    const uri = Deno.env.get('MONGODB_URI');
    const dbName = Deno.env.get('MONGODB_DB');

    if (!uri || !dbName) {
      return Response.json({ error: 'MONGODB_URI e MONGODB_DB não configurados' }, { status: 500 });
    }

    const client = new MongoClient(uri);
    await client.connect();

    try {
      const db = client.db(dbName);
      const col = db.collection(collection);

      let result;
      switch (operation) {
        case 'find':
          result = await col.find(query, options).toArray();
          break;
        case 'findOne':
          result = await col.findOne(query, options);
          break;
        case 'insertOne':
          result = await col.insertOne(data);
          break;
        case 'insertMany':
          result = await col.insertMany(data);
          break;
        case 'updateOne':
          result = await col.updateOne(query, data, options);
          break;
        case 'updateMany':
          result = await col.updateMany(query, data, options);
          break;
        case 'deleteOne':
          result = await col.deleteOne(query);
          break;
        case 'deleteMany':
          result = await col.deleteMany(query);
          break;
        case 'count':
          result = await col.countDocuments(query);
          break;
        case 'aggregate':
          result = await col.aggregate(query).toArray();
          break;
        default:
          return Response.json({ error: `Operação não suportada: ${operation}` }, { status: 400 });
      }

      return Response.json({ result });
    } finally {
      await client.close();
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
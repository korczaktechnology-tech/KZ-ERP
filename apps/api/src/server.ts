import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';

const PORT = Number(process.env.PORT ?? 10000);
const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB ?? 'kz_erp';
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? '*';

if (!MONGODB_URI) throw new Error('MONGODB_URI is required');

const mongo = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
await mongo.connect();
const db = mongo.db(MONGODB_DB);

const app = express();
app.disable('x-powered-by');
app.use(cors({ origin: CORS_ORIGIN === '*' ? true : CORS_ORIGIN.split(',').map(v => v.trim()) }));
app.use(express.json({ limit: '1mb' }));

app.get('/health', async (_req, res) => {
  try {
    await db.command({ ping: 1 });
    res.json({ status: 'ok', service: 'kz-erp-api', database: 'ok', version: process.env.APP_VERSION ?? '0.1.0' });
  } catch {
    res.status(503).json({ status: 'degraded', service: 'kz-erp-api', database: 'unavailable' });
  }
});

app.get('/api/v1/system', (_req, res) => {
  res.json({ name: 'KORCZAK ERP', version: process.env.APP_VERSION ?? '0.1.0', integrationNamespaces: ['CORE','WMS','TMS','CRM','FINANCE','FISCAL','PEOPLE','SALES','COMMERCE','QUALITY','MAINTENANCE','DOCUMENTS','ASSETS','FIELD','SERVICE','PROJECTS'] });
});

app.use((_req, res) => res.status(404).json({ error: 'NOT_FOUND' }));
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'INTERNAL_ERROR' });
});

const server = app.listen(PORT, () => console.log(`KZ-ERP API listening on :${PORT}`));

const shutdown = async (signal: string) => {
  console.log(`${signal}: shutting down`);
  server.close(async () => { await mongo.close(); process.exit(0); });
};
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

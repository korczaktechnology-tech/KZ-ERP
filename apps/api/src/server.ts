import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';
import updates from './updates.js';
import { ensureCoreCollections, ensureModuleCollections } from './core/db.js';
import { coreRouter } from './core/routes.js';
import { errorMiddleware, requestId } from './core/api.js';
import { masterDataRouter } from './modules/master-data/routes.js';
import { salesRouter } from './modules/sales/routes.js';

const PORT = Number(process.env.PORT ?? 10000);
const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB ?? 'ERP';
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? '*';
if (!MONGODB_URI) throw new Error('MONGODB_URI is required');

const mongo = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
await mongo.connect();
const db = mongo.db(MONGODB_DB);
await ensureCoreCollections(db);
await ensureModuleCollections(db);

const app = express();
app.disable('x-powered-by');
app.use(requestId);
app.use(cors({ origin: CORS_ORIGIN === '*' ? true : CORS_ORIGIN.split(',').map(v => v.trim()) }));
app.use(express.json({ limit: '1mb' }));

app.get('/health/live', (_req, res) => {
  res.json({ data: { status: 'ok', service: 'kz-erp-api', check: 'live' }, requestId: res.locals.requestId });
});

app.get('/health/ready', async (_req, res) => {
  try {
    await db.command({ ping: 1 });
    res.json({ data: { status: 'ok', service: 'kz-erp-api', database: 'ok', version: process.env.APP_VERSION ?? '0.1.3', check: 'ready' }, requestId: res.locals.requestId });
  } catch {
    res.status(503).json({ error: { code: 'SERVICE_UNAVAILABLE', message: 'Database unavailable' }, requestId: res.locals.requestId });
  }
});

app.get('/health', async (_req, res) => {
  try {
    await db.command({ ping: 1 });
    res.json({ data: { status: 'ok', service: 'kz-erp-api', database: 'ok', version: process.env.APP_VERSION ?? '0.1.3' }, requestId: res.locals.requestId });
  } catch {
    res.status(503).json({ error: { code: 'SERVICE_UNAVAILABLE', message: 'Database unavailable' }, requestId: res.locals.requestId });
  }
});

app.get('/api/v1/system', (_req, res) => res.json({
  data: {
    name: 'KORCZAK ERP',
    version: process.env.APP_VERSION ?? '0.1.3',
    integrationNamespaces: ['CORE','WMS','TMS','CRM','FINANCE','FISCAL','PEOPLE','SALES','COMMERCE','QUALITY','MAINTENANCE','DOCUMENTS','ASSETS','FIELD','SERVICE','PROJECTS']
  },
  requestId: res.locals.requestId
}));
app.use('/api/v1', coreRouter(db));
app.use('/api/v1/master-data', masterDataRouter(db));
app.use('/api/v1/sales', salesRouter(db));
app.use('/api/v1/updates', updates);
app.use((_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Resource not found' }, requestId: res.locals.requestId }));
app.use(errorMiddleware);
const server = app.listen(PORT, () => console.log(`KZ-ERP API listening on :${PORT}`));
const shutdown = async (signal: string) => { console.log(`${signal}: shutting down`); server.close(async () => { await mongo.close(); process.exit(0); }); };
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

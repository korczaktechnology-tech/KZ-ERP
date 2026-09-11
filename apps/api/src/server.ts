import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';
import updates from './updates.js';
import { ensureCoreCollections, ensureModuleCollections } from './core/db.js';
import { coreRouter } from './core/routes.js';
import { errorMiddleware, requestId } from './core/api.js';
import { masterDataRouter } from './modules/master-data/routes.js';
import { ensureMasterDataCollections } from './modules/master-data/collections.js';
import { salesRouter } from './modules/sales/routes.js';

const PORT = Number(process.env.PORT ?? 10000);
const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB ?? 'ERP';
const CORS_ORIGIN = process.env.CORS_ORIGIN;
const AUTH_SECRET = process.env.AUTH_SECRET;
const CORE_BOOTSTRAP_KEY = process.env.CORE_BOOTSTRAP_KEY;
const APP_VERSION = process.env.APP_VERSION ?? '0.1.3';

if (!MONGODB_URI) throw new Error('MONGODB_URI is required');
if (!AUTH_SECRET || AUTH_SECRET.length < 32) throw new Error('AUTH_SECRET must be set and contain at least 32 characters');
if (!CORE_BOOTSTRAP_KEY || CORE_BOOTSTRAP_KEY.length < 32) throw new Error('CORE_BOOTSTRAP_KEY must be set and contain at least 32 characters');
if (!CORS_ORIGIN) throw new Error('CORS_ORIGIN is required');
const configuredCorsOrigins = CORS_ORIGIN.split(',').map(v => v.trim()).filter(Boolean);
if (configuredCorsOrigins.length === 0 || configuredCorsOrigins.includes('*')) throw new Error('CORS_ORIGIN must contain one or more explicit origins');

// Tauri production webviews use a tauri.localhost origin. Keep the configured
// browser origins strict, but always allow the first-party desktop shell.
const desktopOrigins = new Set([
  'http://tauri.localhost',
  'https://tauri.localhost',
  'http://localhost:1420',
]);
const corsOrigins = new Set([...configuredCorsOrigins, ...desktopOrigins]);

const mongo = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
await mongo.connect();
const db = mongo.db(MONGODB_DB);
await ensureCoreCollections(db);
await ensureModuleCollections(db);
await ensureMasterDataCollections(db);

const app = express();
app.disable('x-powered-by');
app.use(requestId);
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || corsOrigins.has(origin)) return callback(null, true);
    return callback(new Error('CORS origin not allowed'));
  },
}));
app.use(express.json({ limit: '1mb' }));

app.get('/health/live', (_req, res) => {
  res.json({ data: { status: 'ok', service: 'kz-erp-api', check: 'live' }, requestId: res.locals.requestId });
});

app.get('/health/ready', async (_req, res) => {
  try {
    await db.command({ ping: 1 });
    res.json({ data: { status: 'ok', service: 'kz-erp-api', database: 'ok', version: APP_VERSION, check: 'ready' }, requestId: res.locals.requestId });
  } catch {
    res.status(503).json({ error: { code: 'SERVICE_UNAVAILABLE', message: 'Database unavailable' }, requestId: res.locals.requestId });
  }
});

app.get('/health', async (_req, res) => {
  try {
    await db.command({ ping: 1 });
    res.json({ data: { status: 'ok', service: 'kz-erp-api', database: 'ok', version: APP_VERSION }, requestId: res.locals.requestId });
  } catch {
    res.status(503).json({ error: { code: 'SERVICE_UNAVAILABLE', message: 'Database unavailable' }, requestId: res.locals.requestId });
  }
});

app.get('/api/v1/system', (_req, res) => res.json({
  data: {
    name: 'KORCZAK ERP',
    version: APP_VERSION,
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

import { Router } from 'express';
import type { Db } from 'mongodb';

export function tenantRouter(_db: Db): Router {
  return Router();
}

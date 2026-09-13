import type { Db } from 'mongodb';
import { Router } from 'express';
import { f2Router } from './f2.js';
import { f2IoRouter } from './f2-io.js';
import { f2ImportRouter } from './f2-import-router.js';
import { f2AttachmentGuardRouter } from './f2-attachment-guard.js';
import { f2DataHealthRouter } from './f2-data-health-router.js';

/** Composition root for the complete F2 surface. Route-specific concerns stay isolated in their modules. */
export function f2ModuleRouter(db: Db): Router {
  const router = Router();
  router.use(f2AttachmentGuardRouter(db));
  router.use(f2DataHealthRouter(db));
  router.use(f2Router(db));
  router.use(f2ImportRouter(db));
  router.use(f2IoRouter(db));
  return router;
}

// Route order is part of the F2 contract: guards/data health first, then CRUD, import and IO.

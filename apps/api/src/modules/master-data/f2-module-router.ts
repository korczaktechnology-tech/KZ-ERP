import type { Db } from 'mongodb';
import { Router } from 'express';
import { f2Router } from './f2.js';
import { f2IoRouter } from './f2-io.js';
import { f2ImportRouter } from './f2-import-router.js';
import { f2AttachmentGuardRouter } from './f2-attachment-guard.js';
import { f2DataHealthRouter } from './f2-data-health-router.js';
import { f2SemanticGuardRouter } from './f2-semantic-guard.js';
import { f2CoreExtensionsRouter } from './f2-core-extensions.js';
import { f2RelationshipUpdateRouter } from './f2-relationship-update-router.js';
/** Composition root for the complete F2 surface. Route order is intentional: policy guards precede mutating routes. */
export function f2ModuleRouter(db:Db):Router{const router=Router();router.use(f2AttachmentGuardRouter(db));router.use(f2DataHealthRouter(db));router.use(f2SemanticGuardRouter(db));router.use(f2CoreExtensionsRouter(db));router.use(f2RelationshipUpdateRouter(db));router.use(f2Router(db));router.use(f2ImportRouter(db));router.use(f2IoRouter(db));return router;}

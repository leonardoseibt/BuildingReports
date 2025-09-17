import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { Express } from 'express';
import { requireModuleAccess } from '../auth';
import { storage } from '../storage';

const originalGetUser = storage.getUser;

type Endpoint = { method: string; path: string; module: string; body?: unknown };

const ENDPOINTS: Endpoint[] = [
  { method: 'GET', path: '/api/users', module: 'users' },
  { method: 'POST', path: '/api/users', module: 'users', body: { fullName: 'John' } },
  { method: 'PUT', path: '/api/users/1', module: 'users', body: { fullName: 'John' } },
  { method: 'DELETE', path: '/api/users/1', module: 'users' },
  { method: 'GET', path: '/api/attributes', module: 'attributes' },
  { method: 'GET', path: '/api/metadata/tables', module: 'attributes' },
  { method: 'GET', path: '/api/typologies', module: 'typologies' },
  { method: 'GET', path: '/api/noise-classes', module: 'noise-classes' },
  { method: 'GET', path: '/api/aggressiveness-classes', module: 'aggressiveness-classes' },
  { method: 'GET', path: '/api/constructive-systems', module: 'constructive-systems' },
  { method: 'GET', path: '/api/requirements', module: 'requirements' },
  { method: 'GET', path: '/api/criteria', module: 'criteria' },
  { method: 'GET', path: '/api/analyses', module: 'analyses' },
  { method: 'GET', path: '/api/parameters', module: 'parameters' },
  { method: 'GET', path: '/api/states', module: 'states' },
  { method: 'GET', path: '/api/cities', module: 'cities' },
  { method: 'GET', path: '/api/bioclimatic-zones', module: 'bioclimatic-zones' },
  { method: 'GET', path: '/api/isopleths', module: 'isopleths' },
];

function makeUser(overrides: Partial<any> = {}) {
  return {
    id: 1,
    email: 'user@example.com',
    fullName: 'User Test',
    phone: null,
    isAdmin: false,
    allowedModules: [] as string[],
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function createApp(routes: Endpoint[] = ENDPOINTS): Express {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = { claims: { sub: 1 } };
    next();
  });
  for (const route of routes) {
    const handler = (_req: any, res: any) => {
      res.json({ ok: true, method: route.method, path: route.path, module: route.module });
    };
    const method = route.method.toLowerCase();
    if (typeof (app as any)[method] !== 'function') {
      throw new Error(`Unsupported method in test: ${route.method}`);
    }
    (app as any)[method](route.path, requireModuleAccess(route.module), handler);
  }
  return app;
}

async function request(app: Express, method: string, path: string, body?: unknown) {
  const server = app.listen(0);
  const { port } = server.address() as any;
  try {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => undefined);
    return { status: res.status, body: data };
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

test('users routes return 403 when module is missing', async (t) => {
  t.after(() => {
    storage.getUser = originalGetUser;
  });
  storage.getUser = async () => makeUser({ isAdmin: false, allowedModules: [] });
  const app = createApp();
  for (const { method, path, body } of ENDPOINTS) {
    const res = await request(app, method, path, body);
    assert.equal(res.status, 403, `${method} ${path} should return 403`);
    assert.deepEqual(res.body, { message: 'Access denied' });
  }
});

test('admin users can access the users routes', async (t) => {
  t.after(() => {
    storage.getUser = originalGetUser;
  });
  storage.getUser = async () => makeUser({ isAdmin: true });
  const app = createApp();
  for (const { method, path, body } of ENDPOINTS) {
    const res = await request(app, method, path, body);
    assert.equal(res.status, 200, `${method} ${path} should return 200`);
    assert.ok(res.body?.ok, 'response should indicate success');
  }
});

test('users with explicit module access can manage users', async (t) => {
  t.after(() => {
    storage.getUser = originalGetUser;
  });
  for (const route of ENDPOINTS) {
    storage.getUser = async () => makeUser({ allowedModules: [route.module] });
    const app = createApp([route]);
    const res = await request(app, route.method, route.path, route.body);
    assert.equal(res.status, 200, `${route.method} ${route.path} should return 200`);
    assert.ok(res.body?.ok, 'response should indicate success');
  }
});

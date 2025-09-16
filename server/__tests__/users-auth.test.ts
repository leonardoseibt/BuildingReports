import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { Express } from 'express';
import { requireModuleAccess } from '../auth';
import { storage } from '../storage';

const originalGetUser = storage.getUser;

const ENDPOINTS: Array<{ method: string; path: string; body?: unknown }> = [
  { method: 'GET', path: '/api/users' },
  { method: 'POST', path: '/api/users', body: { fullName: 'John' } },
  { method: 'PUT', path: '/api/users/1', body: { fullName: 'John' } },
  { method: 'DELETE', path: '/api/users/1' },
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

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = { claims: { sub: 1 } };
    next();
  });
  app.get('/api/users', requireModuleAccess('users'), (_req, res) => {
    res.json({ ok: true, method: 'GET' });
  });
  app.post('/api/users', requireModuleAccess('users'), (_req, res) => {
    res.json({ ok: true, method: 'POST' });
  });
  app.put('/api/users/:id', requireModuleAccess('users'), (_req, res) => {
    res.json({ ok: true, method: 'PUT' });
  });
  app.delete('/api/users/:id', requireModuleAccess('users'), (_req, res) => {
    res.json({ ok: true, method: 'DELETE' });
  });
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
  storage.getUser = async () => makeUser({ allowedModules: ['users'] });
  const app = createApp();
  for (const { method, path, body } of ENDPOINTS) {
    const res = await request(app, method, path, body);
    assert.equal(res.status, 200, `${method} ${path} should return 200`);
    assert.ok(res.body?.ok, 'response should indicate success');
  }
});

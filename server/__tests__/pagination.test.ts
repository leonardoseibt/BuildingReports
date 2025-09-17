import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { getPaginationParams } from '../routes';
import { storage } from '../storage';

interface CallRecord {
  limit: number | undefined;
  offset: number | undefined;
}

test('GET /api/users normalizes negative pagination inputs', async (t) => {
  const originalListUsers = storage.listUsers;
  const callRecords: CallRecord[] = [];
  let capturedParams: { limit: number; offset: number; page: number } | undefined;

  storage.listUsers = async (limit?: number, offset?: number) => {
    callRecords.push({ limit, offset });
    return { items: [], total: 0 };
  };

  t.after(() => {
    storage.listUsers = originalListUsers;
  });

  const app = express();
  app.get('/api/users', async (req, res) => {
    const params = getPaginationParams(req.query);
    capturedParams = params;
    const { items } = await storage.listUsers(params.limit, params.offset);
    res.json(items);
  });

  const server = app.listen(0);
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));

  const { port } = server.address() as any;
  const res = await fetch(`http://127.0.0.1:${port}/api/users?limit=-25&offset=-10&page=-3`);
  assert.equal(res.status, 200);
  await res.json();

  assert.equal(callRecords.length, 1);
  assert.deepEqual(callRecords[0], { limit: 1, offset: 0 });
  assert.deepEqual(capturedParams, { limit: 1, offset: 0, page: 1 });
});

import { test } from 'node:test';
import assert from 'node:assert';
import { EventEmitter } from 'node:events';
import type { Request, Response, NextFunction } from 'express';
import { sanitizeLogData, createLoggingMiddleware } from './index';
import './__tests__/buildings.test.js';
import './__tests__/users-auth.test.ts';
import './__tests__/reports-definitions.test.ts';
import './__tests__/pagination.test.ts';

test('sanitizeLogData removes sensitive fields recursively', () => {
  const input = { passwordHash: 'abc', nested: { token: 'x', value: 1 } };
  const output = sanitizeLogData(input);
  assert.ok(!('passwordHash' in output));
  assert.ok(!('token' in (output as any).nested));
});

test('createLoggingMiddleware omits sensitive data from logs', async () => {
  process.env.LOG_RESPONSES = 'true';
  const logs: string[] = [];
  const middleware = createLoggingMiddleware((line) => logs.push(line));

  const req = { path: '/api/test', method: 'GET' } as unknown as Request;
  const res = new EventEmitter() as unknown as Response;
  res.statusCode = 200;
  res.json = function (body: any) {
    res.emit('finish');
    return body;
  } as any;

  await middleware(req, res, (() => {}) as NextFunction);
  (res as any).json({ ok: true, passwordHash: 'secret' });

  assert.strictEqual(logs.length, 1);
  assert.ok(logs[0].includes('/api/test'));
  assert.ok(!logs[0].includes('passwordHash'));
  delete process.env.LOG_RESPONSES;
});

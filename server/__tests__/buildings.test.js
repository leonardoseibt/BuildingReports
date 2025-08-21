import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

function createApp(storage) {
  const app = express();
  app.use(express.json());

  app.post('/api/buildings', async (req, res) => {
    const { typologyId, noiseClassId, aggressivenessClassId } = req.body;
    if (typologyId) {
      const t = await storage.getTypology(Number(typologyId));
      if (!t) return res.status(400).json({ message: 'Tipo de uso inválido' });
    }
    if (noiseClassId) {
      const n = await storage.getNoiseClass(Number(noiseClassId));
      if (!n) return res.status(400).json({ message: 'Classe de ruído inválida' });
    }
    if (aggressivenessClassId) {
      const a = await storage.getAggressivenessClass(Number(aggressivenessClassId));
      if (!a) return res.status(400).json({ message: 'Classe de agressividade inválida' });
    }
    res.status(200).json({ ok: true });
  });

  app.put('/api/buildings/:id', async (req, res) => {
    const { typologyId, noiseClassId, aggressivenessClassId } = req.body;
    if (typologyId) {
      const t = await storage.getTypology(Number(typologyId));
      if (!t) return res.status(400).json({ message: 'Tipo de uso inválido' });
    }
    if (noiseClassId) {
      const n = await storage.getNoiseClass(Number(noiseClassId));
      if (!n) return res.status(400).json({ message: 'Classe de ruído inválida' });
    }
    if (aggressivenessClassId) {
      const a = await storage.getAggressivenessClass(Number(aggressivenessClassId));
      if (!a) return res.status(400).json({ message: 'Classe de agressividade inválida' });
    }
    res.status(200).json({ ok: true });
  });

  return app;
}

async function request(app, method, path, body) {
  const server = app.listen(0);
  const { port } = server.address();
  const res = await fetch(`http://localhost:${port}${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  server.close();
  return res;
}

test('POST /api/buildings rejects invalid typologyId', async () => {
  const storage = {
    getTypology: async () => undefined,
    getNoiseClass: async () => ({ id: 1 }),
    getAggressivenessClass: async () => ({ id: 1 }),
  };
  const app = createApp(storage);
  const res = await request(app, 'POST', '/api/buildings', { typologyId: 999 });
  assert.equal(res.status, 400);
});

test('POST /api/buildings rejects invalid noiseClassId', async () => {
  const storage = {
    getTypology: async () => ({ id: 1 }),
    getNoiseClass: async () => undefined,
    getAggressivenessClass: async () => ({ id: 1 }),
  };
  const app = createApp(storage);
  const res = await request(app, 'POST', '/api/buildings', { noiseClassId: 999 });
  assert.equal(res.status, 400);
});

test('POST /api/buildings rejects invalid aggressivenessClassId', async () => {
  const storage = {
    getTypology: async () => ({ id: 1 }),
    getNoiseClass: async () => ({ id: 1 }),
    getAggressivenessClass: async () => undefined,
  };
  const app = createApp(storage);
  const res = await request(app, 'POST', '/api/buildings', { aggressivenessClassId: 999 });
  assert.equal(res.status, 400);
});

test('PUT /api/buildings/:id rejects invalid typologyId', async () => {
  const storage = {
    getTypology: async () => undefined,
    getNoiseClass: async () => ({ id: 1 }),
    getAggressivenessClass: async () => ({ id: 1 }),
  };
  const app = createApp(storage);
  const res = await request(app, 'PUT', '/api/buildings/1', { typologyId: 999 });
  assert.equal(res.status, 400);
});

test('PUT /api/buildings/:id rejects invalid noiseClassId', async () => {
  const storage = {
    getTypology: async () => ({ id: 1 }),
    getNoiseClass: async () => undefined,
    getAggressivenessClass: async () => ({ id: 1 }),
  };
  const app = createApp(storage);
  const res = await request(app, 'PUT', '/api/buildings/1', { noiseClassId: 999 });
  assert.equal(res.status, 400);
});

test('PUT /api/buildings/:id rejects invalid aggressivenessClassId', async () => {
  const storage = {
    getTypology: async () => ({ id: 1 }),
    getNoiseClass: async () => ({ id: 1 }),
    getAggressivenessClass: async () => undefined,
  };
  const app = createApp(storage);
  const res = await request(app, 'PUT', '/api/buildings/1', { aggressivenessClassId: 999 });
  assert.equal(res.status, 400);
});

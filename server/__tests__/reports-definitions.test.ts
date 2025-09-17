import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { Server } from 'http';
import { storage, type RequirementWithCriteria } from '../storage';

test('GET /api/reports/definitions returns aggregated requirement payload', async (t) => {
  const definitions: RequirementWithCriteria[] = [
    {
      id: 1,
      code: 'R1',
      label: 'Requisito 1',
      isActive: true,
      createdAt: new Date('2023-01-01T00:00:00.000Z'),
      updatedAt: new Date('2023-01-02T00:00:00.000Z'),
      criteria: [
        {
          id: 10,
          code: 'C1',
          label: 'Critério 1',
          isActive: true,
          createdAt: new Date('2023-01-03T00:00:00.000Z'),
          updatedAt: new Date('2023-01-04T00:00:00.000Z'),
        },
        {
          id: 11,
          code: 'C2',
          label: 'Critério 2',
          isActive: false,
          createdAt: new Date('2023-01-05T00:00:00.000Z'),
          updatedAt: new Date('2023-01-06T00:00:00.000Z'),
        },
      ],
    },
    {
      id: 2,
      code: 'R2',
      label: 'Requisito 2',
      isActive: false,
      createdAt: new Date('2023-02-01T00:00:00.000Z'),
      updatedAt: new Date('2023-02-02T00:00:00.000Z'),
      criteria: [],
    },
  ];

  const listDefinitionsMock = mock.method(storage, 'listRequirementsWithCriteria', async () => definitions);
  const listRequirementsMock = mock.method(storage, 'listRequirements', async () => {
    throw new Error('listRequirements should not be called');
  });
  const listCriteriaMock = mock.method(storage, 'listCriteria', async () => {
    throw new Error('listCriteria should not be called');
  });

  const app = express();
  app.get('/api/reports/definitions', async (_req, res) => {
    try {
      const definitionsData = await storage.listRequirementsWithCriteria();
      res.json(definitionsData);
    } catch (error) {
      console.error('Error fetching report definitions:', error);
      res.status(500).json({ message: 'Failed to fetch report definitions' });
    }
  });

  const server: Server = await new Promise((resolve) => {
    const srv = app.listen(0, () => resolve(srv));
  });

  t.after(async () => {
    listDefinitionsMock.mock.restore();
    listRequirementsMock.mock.restore();
    listCriteriaMock.mock.restore();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  const { port } = server.address() as any;
  const response = await fetch(`http://127.0.0.1:${port}/api/reports/definitions`);
  assert.equal(response.status, 200);
  const payload = await response.json();

  const expected = definitions.map((req) => ({
    ...req,
    createdAt: req.createdAt instanceof Date ? req.createdAt.toISOString() : req.createdAt,
    updatedAt: req.updatedAt instanceof Date ? req.updatedAt.toISOString() : req.updatedAt,
    criteria: req.criteria.map((criterion) => ({
      ...criterion,
      createdAt:
        criterion.createdAt instanceof Date ? criterion.createdAt.toISOString() : criterion.createdAt,
      updatedAt:
        criterion.updatedAt instanceof Date ? criterion.updatedAt.toISOString() : criterion.updatedAt,
    })),
  }));

  assert.deepEqual(payload, expected);
  assert.equal(listDefinitionsMock.mock.callCount(), 1);
});

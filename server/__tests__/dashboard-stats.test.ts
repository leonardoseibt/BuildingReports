import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildings, reports } from '@shared/schema';
import { storage } from '../storage';
import { db } from '../db';

test('getUserStats limits dashboard queries while preserving totals', async (t) => {
  const originalGetBuildingsByUser = storage.getBuildingsByUser;
  const originalGetReportsByUser = storage.getReportsByUser;
  const originalSelect = (db as any).select;

  const fakeRecent = [
    { id: 1, name: 'One' },
    { id: 2, name: 'Two' },
  ] as any[];
  const buildingCalls: Array<{ userId: number; limit: number | undefined; offset: number | undefined }> = [];
  let reportCountQuery: any;
  let selectCallCount = 0;

  (storage as any).getBuildingsByUser = async (userId: number, limit?: number, offset?: number) => {
    buildingCalls.push({ userId, limit, offset });
    return { items: fakeRecent, total: 42 };
  };

  (storage as any).getReportsByUser = async () => {
    throw new Error('getReportsByUser should not be invoked for stats summary');
  };

  (db as any).select = (selection: any) => {
    selectCallCount += 1;
    const state: any = { selection };
    return {
      from(table: any) {
        state.from = table;
        return this;
      },
      leftJoin(joinTable: any, on: any) {
        state.leftJoin = { table: joinTable, on };
        return this;
      },
      where(condition: any) {
        state.where = condition;
        reportCountQuery = state;
        return Promise.resolve([{ value: '17' }]);
      },
    };
  };

  t.after(() => {
    (storage as any).getBuildingsByUser = originalGetBuildingsByUser;
    (storage as any).getReportsByUser = originalGetReportsByUser;
    (db as any).select = originalSelect;
  });

  const stats = await storage.getUserStats(77);

  assert.deepEqual(buildingCalls, [{ userId: 77, limit: 5, offset: 0 }]);
  assert.equal(selectCallCount, 1);
  assert.ok(reportCountQuery);
  assert.equal(reportCountQuery.from, reports);
  assert.equal(reportCountQuery.leftJoin?.table, buildings);
  assert.ok(reportCountQuery.where);
  assert.deepEqual(stats, {
    totalBuildings: 42,
    totalReports: 17,
    recentBuildings: fakeRecent,
  });
});

import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, refreshSession } from "./auth";
import { insertBuildingSchema, updateBuildingSchema, insertStructuralSystemSchema, insertSealingSystemSchema, insertRoofingSystemSchema, insertReportSchema, insertTechnicianSchema, updateTechnicianSchema, insertUserSchema, updateUserSchema, insertTypologySchema, insertNoiseClassSchema, insertAggressivenessClassSchema, insertBioclimaticZoneSchema, insertBioclimaticZoneCoverageSchema, insertStateSchema, insertCitySchema, insertConstructiveSystemSchema, insertRequirementSchema, insertCriterionSchema, insertAnalysisSchema, insertIsoplethSchema } from "@shared/schema";
import { insertParameterSchema, attributeDefinitions } from '@shared/schema';
import { db } from './db';
import { eq } from 'drizzle-orm';
import bcrypt from "bcryptjs";
import { z } from "zod";
import { pool } from './db';

function getPaginationParams(query: any) {
  const limit = Math.min(parseInt(query?.limit as string) || 10, 100);
  const offset = query?.offset !== undefined ? parseInt(query.offset as string) || 0 : undefined;
  const pageParam = query?.page !== undefined ? parseInt(query.page as string) || 1 : undefined;
  const computedOffset = offset ?? ((pageParam && pageParam > 0 ? pageParam - 1 : 0) * limit);
  const currentPage = pageParam ?? Math.floor(computedOffset / limit) + 1;
  return { limit, offset: computedOffset, page: currentPage };
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId: number = Number(req.user.claims.sub);
      const user = await storage.getUser(userId);
      // Attach expiry info (non-sensitive) so client can display timeout / proactive refresh if desired
      const expires_at = (req as any).user?.expires_at;
      res.json({ ...user, expires_at });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Refresh endpoint (rolling renewal) – guarded by auth, returns current/new expiry
  app.post('/api/auth/refresh', isAuthenticated, refreshSession);

  // Dashboard routes
  app.get('/api/dashboard/stats', isAuthenticated, async (req: any, res) => {
    try {
      const userId: number = Number(req.user.claims.sub);
      const stats = await storage.getUserStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  app.get('/api/dashboard/extended-stats', isAuthenticated, async (req: any, res) => {
    try {
      const userId: number = Number(req.user.claims.sub);
      const stats = await storage.getUserExtendedStats(userId);
      res.json(stats);
    } catch (error) {
      console.error('Error fetching extended dashboard stats:', error);
      res.status(500).json({ message: 'Failed to fetch extended dashboard stats' });
    }
  });

  // User management routes
  app.get('/api/users', isAuthenticated, async (req: any, res) => {
    try {
      const { limit, offset, page } = getPaginationParams(req.query);
      const { items, total } = await storage.listUsers(limit, offset);
  // Frontend atualmente espera um array simples. Para paginação futura, alterar client antes.
  res.json(items);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ message: 'Failed to fetch users' });
    }
  });

  // Dynamic metadata: list all user tables (public schema) excluding system/internal ones
  app.get('/api/metadata/tables', isAuthenticated, async (_req, res) => {
    try {
      const result = await pool.query<{ table_name: string }>(
        `select table_name from information_schema.tables
         where table_schema = 'public' and table_type='BASE TABLE'
         order by table_name`);
      const systemPrefixes = ['_drizzle'];
      const blacklist = new Set<string>(['_prisma_migrations']);
      const names = result.rows
        .map(r => r.table_name)
        .filter(n => !systemPrefixes.some(p => n.startsWith(p)))
        .filter(n => !blacklist.has(n));
      res.json(names);
    } catch (err) {
      console.error('Erro ao listar tabelas', err);
      res.status(500).json({ message: 'Falha ao listar tabelas' });
    }
  });

  // Dynamic metadata: list columns for a specific table
  app.get('/api/metadata/tables/:table/columns', isAuthenticated, async (req, res) => {
    try {
      const table = req.params.table;
      if (!/^[a-zA-Z0-9_]+$/.test(table)) return res.status(400).json({ message: 'Tabela inválida' });
      const result = await pool.query<{ column_name: string }>(
        `select column_name from information_schema.columns
         where table_schema='public' and table_name=$1
         order by ordinal_position`, [table]);
      const cols = result.rows.map(r => r.column_name);
      res.json(cols);
    } catch (err) {
      console.error('Erro ao listar colunas', err);
      res.status(500).json({ message: 'Falha ao listar colunas' });
    }
  });

    // Attribute Definitions (independent CRUD for validation phase)
    app.get('/api/attributes', isAuthenticated, async (req, res) => {
      try {
        const dataKind = typeof req.query.dataKind === 'string' ? req.query.dataKind : undefined;
        const valueSource = typeof req.query.valueSource === 'string' ? req.query.valueSource : undefined;
        const activeOnly = req.query.activeOnly === 'true';
        const rows = await storage.listAttributeDefinitions({ dataKind, valueSource, activeOnly });
        res.json(rows);
      } catch (err:any) {
        console.error('Erro ao listar atributos', err); res.status(500).json({ message: 'Falha ao listar atributos' });
      }
    });
    app.post('/api/attributes', isAuthenticated, express.json(), async (req, res) => {
      try {
        const item = req.body || {};
        if (!item.friendlyName || !item.sourceTable || !item.sourceColumn || !item.dataKind) {
          return res.status(400).json({ message: 'Campos obrigatórios ausentes' });
        }
        // Remove any legacy fields that might still be sent by antigos clients
        delete item.code; delete item.description; delete item.unit;
        const row = await storage.createAttributeDefinition(item);
        res.json(row);
      } catch (err:any) {
        if (/(unique|duplicate)/i.test(err?.message)) return res.status(409).json({ message: 'Atributo já existe para esta coluna' });
        res.status(500).json({ message: 'Falha ao criar atributo' });
      }
    });
    app.put('/api/attributes/:id', isAuthenticated, express.json(), async (req, res) => {
      try {
        const id = Number(req.params.id);
        const body = { ...(req.body||{}) };
        // Legacy cleanup
        delete body.code; delete body.description; delete body.unit;
        const row = await storage.updateAttributeDefinition(id, body);
        res.json(row);
      } catch { res.status(500).json({ message: 'Falha ao atualizar atributo' }); }
    });
    app.delete('/api/attributes/:id', isAuthenticated, async (req, res) => {
      try {
        const id = Number(req.params.id);
        const ok = await storage.deleteAttributeDefinition(id);
        res.json({ success: ok });
      } catch { res.status(500).json({ message: 'Falha ao excluir atributo' }); }
    });
  app.get('/api/users/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ message: 'ID inválido' });
      const user = await storage.getUser(id);
      if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });
      res.json(user);
    } catch (error) {
      console.error('Error fetching user:', error);
      res.status(500).json({ message: 'Falha ao buscar usuário' });
    }
  });

  app.post('/api/users', isAuthenticated, express.json(), async (req, res) => {
    try {
      const data = insertUserSchema.parse(req.body);
      const normalizedEmail = data.email.trim().toLowerCase();
      const passwordHash = await bcrypt.hash(data.password, 10);
      const body: any = req.body || {};
      const isAdmin = !!body.isAdmin;
      const allowedModulesInput = Array.isArray(body.allowedModules)
        ? body.allowedModules.filter((x: any) => typeof x === 'string')
        : [];
      const created = await storage.upsertUser({
        email: normalizedEmail,
        fullName: data.fullName,
        passwordHash,
        phone: data.phone,
        emailVerified: true,
        isAdmin,
        allowedModules: allowedModulesInput,
      } as any);
      const {
        id,
        email,
        fullName,
        phone,
        isAdmin: adminFlag,
        allowedModules: allowedModulesDb,
        createdAt,
        updatedAt,
      } = created as any;
      res.json({
        id,
        email,
        fullName,
        phone,
        isAdmin: adminFlag,
        allowedModules: allowedModulesDb,
        createdAt,
        updatedAt,
      });
    } catch (error) {
      console.error('Error creating user:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation error', errors: error.errors });
      }
      if ((error as any)?.code === '23505') {
        return res.status(409).json({ message: 'E-mail já cadastrado.' });
      }
      res.status(500).json({ message: 'Failed to create user' });
    }
  });

  app.put('/api/users/:id', isAuthenticated, express.json(), async (req, res) => {
    try {
      const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ message: 'ID inválido' });
      const data = updateUserSchema.parse(req.body);
      let update: any = { email: data.email.trim().toLowerCase(), fullName: data.fullName, phone: data.phone };
      if (typeof (req.body as any).isAdmin === 'boolean') {
        update.isAdmin = !!(req.body as any).isAdmin;
      }
      if (Array.isArray((req.body as any).allowedModules)) {
        update.allowedModules = (req.body as any).allowedModules.filter((x: any) => typeof x === 'string');
      }
      if (data.password) {
        const passwordHash = await bcrypt.hash(data.password, 10);
        update.passwordHash = passwordHash;
      }
      const saved = await storage.updateUser(id, update);
      const { email, fullName, phone, isAdmin: adminFlag, allowedModules, createdAt, updatedAt } = saved as any;
      res.json({ id, email, fullName, phone, isAdmin: adminFlag, allowedModules, createdAt, updatedAt });
    } catch (error) {
      console.error('Error updating user:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation error', errors: error.errors });
      }
      if ((error as any)?.code === '23505') {
        return res.status(409).json({ message: 'E-mail já cadastrado.' });
      }
      res.status(500).json({ message: 'Falha ao atualizar usuário' });
    }
  });

  app.delete('/api/users/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ message: 'ID inválido' });
      // prevent deleting yourself to avoid locking the session out unexpectedly
      const currentUserId: number = Number(req.user.claims.sub);
      if (id === currentUserId) return res.status(400).json({ message: 'Você não pode excluir o próprio usuário logado.' });

      const ok = await storage.deleteUser(id);
      if (!ok) return res.status(404).json({ message: 'Usuário não encontrado' });
      res.json({ ok: true });
    } catch (error: any) {
      const status = (error as any)?.status || 500;
      const message = (error as any)?.message || 'Falha ao excluir usuário';
      console.error('Error deleting user:', error);
      res.status(status).json({ message });
    }
  });

  // Building routes
  app.post('/api/buildings', isAuthenticated, async (req: any, res) => {
    try {
      const userId: number = Number(req.user.claims.sub);
      const buildingData = insertBuildingSchema.parse({
        ...req.body,
        userId,
      });
      // If technicianId is provided, ensure it exists and belongs to the same user
      // unless the requester has permissions to manage all technicians
      if ((buildingData as any).technicianId) {
        const tech = await storage.getTechnician(Number((buildingData as any).technicianId));
        if (!tech) return res.status(400).json({ message: 'Responsável técnico informado não existe.' });
        const me = await storage.getUser(userId);
        const canManageTechnicians = !!(me && ((me as any).isAdmin || ((me as any).allowedModules || []).includes('technicians')));
        if (tech.userId !== userId && !canManageTechnicians) return res.status(403).json({ message: 'Access denied' });
      }
      // Validate master ids (if provided)
      const { typologyId, noiseClassId, aggressivenessClassId } = buildingData as any;
      if (typologyId) {
        const typology = await storage.getTypology(Number(typologyId));
        if (!typology) return res.status(400).json({ message: 'Tipo de uso inválido' });
      }
      if (noiseClassId) {
        const noiseClass = await storage.getNoiseClass(Number(noiseClassId));
        if (!noiseClass) return res.status(400).json({ message: 'Classe de ruído inválida' });
      }
      if (aggressivenessClassId) {
        const aggressivenessClass = await storage.getAggressivenessClass(Number(aggressivenessClassId));
        if (!aggressivenessClass) return res.status(400).json({ message: 'Classe de agressividade inválida' });
      }

      const building = await storage.createBuilding(buildingData);
      res.json(building);
    } catch (error) {
      console.error("Error creating building:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create building" });
    }
  });

  app.get('/api/buildings', isAuthenticated, async (req: any, res) => {
    try {
      const userId: number = Number(req.user.claims.sub);
      const me = await storage.getUser(userId);
      const { limit, offset } = getPaginationParams(req.query);
      const canViewAll = !!(me && ((me as any).isAdmin || ((me as any).allowedModules || []).includes('buildings')));
      const { items } = canViewAll
        ? await storage.listAllBuildings(limit, offset)
        : await storage.getBuildingsByUser(userId, limit, offset);
      // Client expects a plain array.
      res.json(items);
    } catch (error) {
      console.error("Error fetching buildings:", error);
      res.status(500).json({ message: "Failed to fetch buildings" });
    }
  });

  app.get('/api/buildings/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ message: 'ID inválido' });
      const building = await storage.getBuilding(id);
      if (!building) {
        return res.status(404).json({ message: "Building not found" });
      }
      
      // Check permission: owner OR admin/has module 'buildings'
      const userId: number = Number(req.user.claims.sub);
      const me = await storage.getUser(userId);
      const canManageBuildings = !!(me && ((me as any).isAdmin || ((me as any).allowedModules || []).includes('buildings')));
      if (building.userId !== userId && !canManageBuildings) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      res.json(building);
    } catch (error) {
      console.error("Error fetching building:", error);
      res.status(500).json({ message: "Failed to fetch building" });
    }
  });

  app.put('/api/buildings/:id', isAuthenticated, express.json(), async (req: any, res) => {
    try {
      const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ message: 'ID inválido' });
      const existing = await storage.getBuilding(id);
      if (!existing) return res.status(404).json({ message: 'Edificação não encontrada' });
      const userId: number = Number(req.user.claims.sub);
      const me = await storage.getUser(userId);
      const canManageBuildings = !!(me && ((me as any).isAdmin || ((me as any).allowedModules || []).includes('buildings')));
      const canManageTechnicians = !!(me && ((me as any).isAdmin || ((me as any).allowedModules || []).includes('technicians')));
      if (existing.userId !== userId && !canManageBuildings) return res.status(403).json({ message: 'Access denied' });

      const data = updateBuildingSchema.parse(req.body);
      if ((data as any).technicianId) {
        const tech = await storage.getTechnician(Number((data as any).technicianId));
        if (!tech) return res.status(400).json({ message: 'Responsável técnico informado não existe.' });
        if (tech.userId !== userId && !canManageTechnicians) return res.status(403).json({ message: 'Access denied' });
      }
      // Validate master ids (if provided)
      const { typologyId, noiseClassId, aggressivenessClassId } = data as any;
      if (typologyId) {
        const typology = await storage.getTypology(Number(typologyId));
        if (!typology) return res.status(400).json({ message: 'Tipo de uso inválido' });
      }
      if (noiseClassId) {
        const noiseClass = await storage.getNoiseClass(Number(noiseClassId));
        if (!noiseClass) return res.status(400).json({ message: 'Classe de ruído inválida' });
      }
      if (aggressivenessClassId) {
        const aggressivenessClass = await storage.getAggressivenessClass(Number(aggressivenessClassId));
        if (!aggressivenessClass) return res.status(400).json({ message: 'Classe de agressividade inválida' });
      }
      const saved = await storage.updateBuilding(id, data as any);
      res.json(saved);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation error', errors: error.errors });
      }
      console.error('Error updating building', error);
      res.status(500).json({ message: 'Failed to update building' });
    }
  });

  app.delete('/api/buildings/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ message: 'ID inválido' });
      const existing = await storage.getBuilding(id);
      if (!existing) return res.status(404).json({ message: 'Edificação não encontrada' });
      const userId: number = Number(req.user.claims.sub);
      const me = await storage.getUser(userId);
      const canManageBuildings = !!(me && ((me as any).isAdmin || ((me as any).allowedModules || []).includes('buildings')));
      if (existing.userId !== userId && !canManageBuildings) return res.status(403).json({ message: 'Access denied' });

      const ok = await storage.deleteBuilding(id);
      res.json({ ok });
    } catch (error: any) {
      const status = (error as any)?.status || 500;
      const message = (error as any)?.message || 'Failed to delete building';
      console.error('Error deleting building', error);
      res.status(status).json({ message });
    }
  });

  // Building systems routes
  app.post('/api/buildings/:id/structural-system', isAuthenticated, async (req: any, res) => {
    try {
      const buildingId = Number(req.params.id);
  if (!Number.isFinite(buildingId)) return res.status(400).json({ message: 'ID inválido' });
      const building = await storage.getBuilding(buildingId);
      
      const userId: number = Number(req.user.claims.sub);
      const me = await storage.getUser(userId);
      const canManageBuildings = !!(me && ((me as any).isAdmin || ((me as any).allowedModules || []).includes('buildings')));
      if (!building || (building.userId !== userId && !canManageBuildings)) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const systemData = insertStructuralSystemSchema.parse({
        ...req.body,
        buildingId,
      });
      
      const system = await storage.createStructuralSystem(systemData);
      res.json(system);
    } catch (error) {
      console.error("Error creating structural system:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create structural system" });
    }
  });

  app.post('/api/buildings/:id/sealing-system', isAuthenticated, async (req: any, res) => {
    try {
      const buildingId = Number(req.params.id);
  if (!Number.isFinite(buildingId)) return res.status(400).json({ message: 'ID inválido' });
      const building = await storage.getBuilding(buildingId);
      
      const userId: number = Number(req.user.claims.sub);
      const me = await storage.getUser(userId);
      const canManageBuildings = !!(me && ((me as any).isAdmin || ((me as any).allowedModules || []).includes('buildings')));
      if (!building || (building.userId !== userId && !canManageBuildings)) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const systemData = insertSealingSystemSchema.parse({
        ...req.body,
        buildingId,
      });
      
      const system = await storage.createSealingSystem(systemData);
      res.json(system);
    } catch (error) {
      console.error("Error creating sealing system:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create sealing system" });
    }
  });

  app.post('/api/buildings/:id/roofing-system', isAuthenticated, async (req: any, res) => {
    try {
      const buildingId = Number(req.params.id);
  if (!Number.isFinite(buildingId)) return res.status(400).json({ message: 'ID inválido' });
      const building = await storage.getBuilding(buildingId);
      
      const userId: number = Number(req.user.claims.sub);
      const me = await storage.getUser(userId);
      const canManageBuildings = !!(me && ((me as any).isAdmin || ((me as any).allowedModules || []).includes('buildings')));
      if (!building || (building.userId !== userId && !canManageBuildings)) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const systemData = insertRoofingSystemSchema.parse({
        ...req.body,
        buildingId,
      });
      
      const system = await storage.createRoofingSystem(systemData);
      res.json(system);
    } catch (error) {
      console.error("Error creating roofing system:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create roofing system" });
    }
  });

  // Report routes
  app.post('/api/reports', isAuthenticated, async (req: any, res) => {
    try {
      const reportData = insertReportSchema.parse(req.body);
      
      // Verify user owns the building
      const building = await storage.getBuilding(reportData.buildingId);
      if (!building || building.userId !== Number(req.user.claims.sub)) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const report = await storage.createReport(reportData);
      res.json(report);
    } catch (error) {
      console.error("Error creating report:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create report" });
    }
  });

  app.get('/api/reports', isAuthenticated, async (req: any, res) => {
    try {
      const userId: number = Number(req.user.claims.sub);
      const { limit, offset, page } = getPaginationParams(req.query);
      const { items, total } = await storage.getReportsByUser(userId, limit, offset);
  // Temporarily return a plain array to align with current frontend expectations.
  // (Pagination metadata suppressed until client is updated to consume it.)
  res.json(items);
    } catch (error) {
      console.error("Error fetching reports:", error);
      res.status(500).json({ message: "Failed to fetch reports" });
    }
  });

  app.get('/api/reports/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ message: 'ID inválido' });
      const report = await storage.getReport(id);
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }
      
      // Check if report belongs to user
  const building = await storage.getBuilding(report.buildingId);
  if (!building || building.userId !== Number(req.user.claims.sub)) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      res.json(report);
    } catch (error) {
      console.error("Error fetching report:", error);
      res.status(500).json({ message: "Failed to fetch report" });
    }
  });

  app.put('/api/reports/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ message: 'ID inválido' });
      const data = insertReportSchema.partial().parse(req.body);
      const existing = await storage.getReport(id);
      if (!existing) return res.status(404).json({ message: 'Report not found' });
      const buildingId = data.buildingId ?? existing.buildingId;
      const building = await storage.getBuilding(buildingId);
      if (!building || building.userId !== Number(req.user.claims.sub)) {
        return res.status(403).json({ message: 'Access denied' });
      }
      const updated = await storage.updateReport(id, data as any);
      res.json(updated);
    } catch (error) {
      console.error('Error updating report:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation error', errors: error.errors });
      }
      res.status(500).json({ message: 'Failed to update report' });
    }
  });

  app.delete('/api/reports/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ message: 'ID inválido' });
      const existing = await storage.getReport(id);
      if (!existing) return res.status(404).json({ message: 'Report not found' });
      const building = await storage.getBuilding(existing.buildingId);
      if (!building || building.userId !== Number(req.user.claims.sub)) {
        return res.status(403).json({ message: 'Access denied' });
      }
      const ok = await storage.deleteReport(id);
      res.json({ ok });
    } catch (error) {
      console.error('Error deleting report:', error);
      res.status(500).json({ message: 'Failed to delete report' });
    }
  });

  app.get('/api/reports/definitions', isAuthenticated, async (_req, res) => {
    try {
      const reqs = await storage.listRequirements();
      const result = [] as any[];
      for (const req of reqs) {
        const criteria = await storage.listCriteria(req.id);
        result.push({ ...req, criteria });
      }
      res.json(result);
    } catch (error) {
      console.error('Error fetching report definitions:', error);
      res.status(500).json({ message: 'Failed to fetch report definitions' });
    }
  });

  // CEP lookup route for bioclimatic zone + isopleth determination
  app.get('/api/cep/:cep', isAuthenticated, async (req, res) => {
    try {
      const cep = req.params.cep.replace(/\D/g, '');
      
      // Call ViaCEP API
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();
      
      if (data.erro) {
        return res.status(404).json({ message: "CEP not found" });
      }
  // Determine bioclimatic zone & isopleth code based on DB coverages (city first, then UF)
  const zoneFromDb = await storage.findBioclimaticZoneForLocation(data.uf, data.localidade);
  const bioclimaticZone = zoneFromDb || 'ZB3';
  const isoplethCode = await storage.findIsoplethForLocation(data.uf, data.localidade);
      
      res.json({
        address: data.logradouro || '',
        neighborhood: data.bairro || '',
        city: data.localidade || '',
        state: data.uf || '',
        bioclimaticZone,
        isoplethCode: isoplethCode || null,
      });
    } catch (error) {
      console.error("Error looking up CEP:", error);
      res.status(500).json({ message: "Failed to lookup CEP" });
    }
  });

  // Bioclimatic Zones API
  app.get('/api/bioclimatic-zones', isAuthenticated, async (_req, res) => {
    try { res.json(await storage.listBioclimaticZones()); } catch { res.status(500).json({ message: 'Failed to fetch zones' }); }
  });
  app.post('/api/bioclimatic-zones', isAuthenticated, express.json(), async (req, res) => {
    try { const data = insertBioclimaticZoneSchema.parse(req.body); const row = await storage.createBioclimaticZone(data as any); res.json(row); }
    catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ message: 'Validation error', errors: error.errors }); if ((error as any)?.code === '23505') return res.status(409).json({ message: 'Código já cadastrado.' }); res.status(500).json({ message: 'Failed to create zone' }); }
  });
  app.put('/api/bioclimatic-zones/:id', isAuthenticated, express.json(), async (req, res) => {
    try { const id = Number(req.params.id); if (!Number.isFinite(id)) return res.status(400).json({ message: 'ID inválido' }); const data = insertBioclimaticZoneSchema.partial().parse(req.body); const row = await storage.updateBioclimaticZone(id, data as any); res.json(row); }
    catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ message: 'Validation error', errors: error.errors }); if ((error as any)?.code === '23505') return res.status(409).json({ message: 'Código já cadastrado.' }); res.status(500).json({ message: 'Failed to update zone' }); }
  });
  app.delete('/api/bioclimatic-zones/:id', isAuthenticated, async (req, res) => {
    try { const id = Number(req.params.id); if (!Number.isFinite(id)) return res.status(400).json({ message: 'ID inválido' }); const ok = await storage.deleteBioclimaticZone(id); res.json({ ok }); }
    catch (error: any) { const status = (error as any)?.status || 500; const message = (error as any)?.message || 'Failed to delete zone'; res.status(status).json({ message }); }
  });
  // Coverages
  app.get('/api/bioclimatic-zones/:id/coverages', isAuthenticated, async (req, res) => {
    try { const id = Number(req.params.id); if (!Number.isFinite(id)) return res.status(400).json({ message: 'ID inválido' }); res.json(await storage.listBioclimaticZoneCoverages(id)); }
    catch { res.status(500).json({ message: 'Failed to fetch coverages' }); }
  });
  // Find zones by city name (for filtering zones by city search)
  app.get('/api/bioclimatic-zones/search-by-city', isAuthenticated, async (req, res) => {
    try {
      const q = String((req.query.q ?? '') as string).trim();
      if (!q) return res.json([]);
      const rows = await storage.findZonesByCityName(q);
      res.json(rows);
    } catch {
      res.status(500).json({ message: 'Failed to search zones by city' });
    }
  });
  app.post('/api/bioclimatic-zones/:id/coverages', isAuthenticated, express.json(), async (req, res) => {
    try {
      const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ message: 'ID inválido' });
      const payload = insertBioclimaticZoneCoverageSchema.pick({ cityId: true }).required({ cityId: true }).parse(req.body as any);
      const row = await storage.createBioclimaticZoneCoverage(id, { cityId: (payload as any).cityId } as any);
      res.json(row);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: 'Validation error', errors: error.errors });
      res.status(500).json({ message: 'Failed to create coverage' });
    }
  });
  app.put('/api/bioclimatic-zones/coverages/:coverageId', isAuthenticated, express.json(), async (req, res) => {
    try {
      const coverageId = Number(req.params.coverageId);
  if (!Number.isFinite(coverageId)) return res.status(400).json({ message: 'ID inválido' });
      const payload = insertBioclimaticZoneCoverageSchema.pick({ cityId: true }).partial().parse(req.body as any);
      const row = await storage.updateBioclimaticZoneCoverage(coverageId, payload as any);
      res.json(row);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: 'Validation error', errors: error.errors });
      res.status(500).json({ message: 'Failed to update coverage' });
    }
  });
  app.delete('/api/bioclimatic-zones/coverages/:coverageId', isAuthenticated, async (req, res) => {
    try { const coverageId = Number(req.params.coverageId); if (!Number.isFinite(coverageId)) return res.status(400).json({ message: 'ID inválido' }); const ok = await storage.deleteBioclimaticZoneCoverage(coverageId); res.json({ ok }); }
    catch { res.status(500).json({ message: 'Failed to delete coverage' }); }
  });

  // Isopleths (Isopletas) API
  app.get('/api/isopleths', isAuthenticated, async (_req, res) => {
    try { res.json(await storage.listIsopleths()); } catch { res.status(500).json({ message: 'Failed to fetch isopletas' }); }
  });
  app.post('/api/isopleths', isAuthenticated, express.json(), async (req, res) => {
    try { const data = insertIsoplethSchema.parse(req.body); const row = await storage.createIsopleth(data as any); res.json(row); }
    catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ message: 'Validation error', errors: error.errors }); if ((error as any)?.code === '23505') return res.status(409).json({ message: 'Código já cadastrado.' }); res.status(500).json({ message: 'Failed to create isopleth' }); }
  });
  app.put('/api/isopleths/:id', isAuthenticated, express.json(), async (req, res) => {
    try { const id = Number(req.params.id); if (!Number.isFinite(id)) return res.status(400).json({ message: 'ID inválido' }); const data = insertIsoplethSchema.partial().parse(req.body); const row = await storage.updateIsopleth(id, data as any); res.json(row); }
    catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ message: 'Validation error', errors: error.errors }); if ((error as any)?.code === '23505') return res.status(409).json({ message: 'Código já cadastrado.' }); res.status(500).json({ message: 'Failed to update isopleth' }); }
  });
  app.delete('/api/isopleths/:id', isAuthenticated, async (req, res) => {
    try { const id = Number(req.params.id); if (!Number.isFinite(id)) return res.status(400).json({ message: 'ID inválido' }); const ok = await storage.deleteIsopleth(id); res.json({ ok }); }
    catch { res.status(500).json({ message: 'Failed to delete isopleth' }); }
  });

  // Isopleths coverages
  app.get('/api/isopleths/:id/coverages', isAuthenticated, async (req, res) => {
    try { const id = Number(req.params.id); if (!Number.isFinite(id)) return res.status(400).json({ message: 'ID inválido' }); res.json(await storage.listIsoplethCoverages(id)); }
    catch { res.status(500).json({ message: 'Failed to fetch isopleth coverages' }); }
  });
  app.get('/api/isopleths/coverages-index', isAuthenticated, async (_req, res) => {
    try { res.json(await storage.listIsoplethsCoveragesIndex()); } catch { res.status(500).json({ message: 'Failed to fetch isopleth coverages index' }); }
  });
  app.post('/api/isopleths/:id/coverages', isAuthenticated, express.json(), async (req, res) => {
    try { const id = Number(req.params.id); if (!Number.isFinite(id)) return res.status(400).json({ message: 'ID inválido' }); const payload = { cityId: Number((req.body as any).cityId) }; const row = await storage.createIsoplethCoverage(id, payload as any); res.json(row); }
    catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ message: 'Validation error', errors: error.errors }); res.status(500).json({ message: 'Failed to create isopleth coverage' }); }
  });
  app.delete('/api/isopleths/coverages/:coverageId', isAuthenticated, async (req, res) => {
    try { const coverageId = Number(req.params.coverageId); if (!Number.isFinite(coverageId)) return res.status(400).json({ message: 'ID inválido' }); const ok = await storage.deleteIsoplethCoverage(coverageId); res.json({ ok }); }
    catch { res.status(500).json({ message: 'Failed to delete isopleth coverage' }); }
  });

  // States & Cities endpoints
  app.get('/api/states', isAuthenticated, async (_req, res) => {
    try { res.json(await storage.listStates()); } catch { res.status(500).json({ message: 'Failed to fetch states' }); }
  });
  app.post('/api/states', isAuthenticated, express.json(), async (req, res) => {
    try { const data = insertStateSchema.parse(req.body); const row = await storage.createState(data as any); res.json(row); }
    catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ message: 'Validation error', errors: error.errors }); res.status(500).json({ message: 'Failed to create state' }); }
  });
  app.put('/api/states/:id', isAuthenticated, express.json(), async (req, res) => {
    try { const id = Number(req.params.id); if (!Number.isFinite(id)) return res.status(400).json({ message: 'ID inválido' }); const row = await storage.updateState(id, insertStateSchema.partial().parse(req.body) as any); res.json(row); }
    catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ message: 'Validation error', errors: error.errors }); res.status(500).json({ message: 'Failed to update state' }); }
  });
  app.delete('/api/states/:id', isAuthenticated, async (req, res) => {
    try { const id = Number(req.params.id); if (!Number.isFinite(id)) return res.status(400).json({ message: 'ID inválido' }); const ok = await storage.deleteState(id); res.json({ ok }); }
    catch { res.status(500).json({ message: 'Failed to delete state' }); }
  });
  app.get('/api/states/:stateId/cities', isAuthenticated, async (req, res) => {
    try { const stateId = Number(req.params.stateId); if (!Number.isFinite(stateId)) return res.status(400).json({ message: 'ID inválido' }); res.json(await storage.listCitiesByState(stateId)); }
    catch { res.status(500).json({ message: 'Failed to fetch cities' }); }
  });
  app.get('/api/cities', isAuthenticated, async (_req, res) => {
    try { res.json(await storage.listCities()); } catch { res.status(500).json({ message: 'Failed to fetch cities' }); }
  });
  app.post('/api/cities', isAuthenticated, express.json(), async (req, res) => {
    try { const data = insertCitySchema.parse(req.body); const row = await storage.createCity(data as any); res.json(row); }
    catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ message: 'Validation error', errors: error.errors }); res.status(500).json({ message: 'Failed to create city' }); }
  });
  app.put('/api/cities/:id', isAuthenticated, express.json(), async (req, res) => {
    try { const id = Number(req.params.id); if (!Number.isFinite(id)) return res.status(400).json({ message: 'ID inválido' }); const row = await storage.updateCity(id, insertCitySchema.partial().parse(req.body) as any); res.json(row); }
    catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ message: 'Validation error', errors: error.errors }); res.status(500).json({ message: 'Failed to update city' }); }
  });
  app.delete('/api/cities/:id', isAuthenticated, async (req, res) => {
    try { const id = Number(req.params.id); if (!Number.isFinite(id)) return res.status(400).json({ message: 'ID inválido' }); const ok = await storage.deleteCity(id); res.json({ ok }); }
    catch { res.status(500).json({ message: 'Failed to delete city' }); }
  });

  // Technicians routes
  app.get('/api/technicians', isAuthenticated, async (req: any, res) => {
    try {
      const userId: number = Number(req.user.claims.sub);
      const me = await storage.getUser(userId);
      const { limit, offset } = getPaginationParams(req.query);
      const canViewAll = !!(me && ((me as any).isAdmin || ((me as any).allowedModules || []).includes('technicians')));
      const { items } = canViewAll
        ? await storage.listAllTechnicians(limit, offset)
        : await storage.listTechnicians(userId, limit, offset);
      res.json(items);
    } catch (error) {
      console.error('Error fetching technicians', error);
      res.status(500).json({ message: 'Failed to fetch technicians' });
    }
  });


  app.post('/api/technicians', isAuthenticated, express.json(), async (req: any, res) => {
    try {
      const userId: number = Number(req.user.claims.sub);
      const payload = insertTechnicianSchema.parse({ ...req.body, userId });
      const created = await storage.createTechnician(payload);
      res.json(created);
    } catch (error) {
      console.error('Error creating technician', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation error', errors: error.errors });
      }
      res.status(500).json({ message: 'Failed to create technician' });
    }
  });

  app.get('/api/technicians/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ message: 'ID inválido' });
      const row = await storage.getTechnician(id);
      if (!row) return res.status(404).json({ message: 'Responsável técnico não encontrado' });
      const userId: number = Number(req.user.claims.sub);
      const me = await storage.getUser(userId);
      const canManageTechnicians = !!(me && ((me as any).isAdmin || ((me as any).allowedModules || []).includes('technicians')));
      if (row.userId !== userId && !canManageTechnicians) return res.status(403).json({ message: 'Access denied' });
      res.json(row);
    } catch (error) {
      console.error('Error fetching technician', error);
      res.status(500).json({ message: 'Failed to fetch technician' });
    }
  });

  app.put('/api/technicians/:id', isAuthenticated, express.json(), async (req: any, res) => {
    try {
      const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ message: 'ID inválido' });
      const existing = await storage.getTechnician(id);
      if (!existing) return res.status(404).json({ message: 'Responsável técnico não encontrado' });
      const userId: number = Number(req.user.claims.sub);
      const me = await storage.getUser(userId);
      const canManageTechnicians = !!(me && ((me as any).isAdmin || ((me as any).allowedModules || []).includes('technicians')));
      if (existing.userId !== userId && !canManageTechnicians) return res.status(403).json({ message: 'Access denied' });

      const data = updateTechnicianSchema.parse(req.body);
      const saved = await storage.updateTechnician(id, data as any);
      res.json(saved);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation error', errors: error.errors });
      }
      console.error('Error updating technician', error);
      res.status(500).json({ message: 'Failed to update technician' });
    }
  });

  app.delete('/api/technicians/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ message: 'ID inválido' });
      const existing = await storage.getTechnician(id);
      if (!existing) return res.status(404).json({ message: 'Responsável técnico não encontrado' });
      const userId: number = Number(req.user.claims.sub);
      const me = await storage.getUser(userId);
      const canManageTechnicians = !!(me && ((me as any).isAdmin || ((me as any).allowedModules || []).includes('technicians')));
      if (existing.userId !== userId && !canManageTechnicians) return res.status(403).json({ message: 'Access denied' });
      const ok = await storage.deleteTechnician(id);
      res.json({ ok });
    } catch (error: any) {
      const status = (error as any)?.status || 500;
      const message = (error as any)?.message || 'Falha ao excluir responsável técnico';
      res.status(status).json({ message });
    }
  });

  // Master tables: Typologies
  app.get('/api/typologies', isAuthenticated, async (_req, res) => {
    try { res.json(await storage.listTypologies()); } catch (e) { res.status(500).json({ message: 'Failed to fetch typologies' }); }
  });
  app.post('/api/typologies', isAuthenticated, express.json(), async (req, res) => {
    try { const data = insertTypologySchema.parse(req.body); const row = await storage.createTypology(data as any); res.json(row); }
    catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ message: 'Validation error', errors: error.errors }); if ((error as any)?.code === '23505') return res.status(409).json({ message: 'Código já cadastrado.' }); res.status(500).json({ message: 'Failed to create typology' }); }
  });
  app.put('/api/typologies/:id', isAuthenticated, express.json(), async (req, res) => {
    try { const id = Number(req.params.id); if (!Number.isFinite(id)) return res.status(400).json({ message: 'ID inválido' }); const data = insertTypologySchema.partial().parse(req.body); const row = await storage.updateTypology(id, data as any); res.json(row); }
    catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ message: 'Validation error', errors: error.errors }); if ((error as any)?.code === '23505') return res.status(409).json({ message: 'Código já cadastrado.' }); res.status(500).json({ message: 'Failed to update typology' }); }
  });
  app.delete('/api/typologies/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ message: 'ID inválido' });
      const ok = await storage.deleteTypology(id);
      res.json({ ok });
    } catch (error: any) {
      const status = (error as any)?.status || 500;
      const message = (error as any)?.message || 'Falha ao excluir tipo de uso';
      res.status(status).json({ message });
    }
  });

  // Master tables: Noise classes
  app.get('/api/noise-classes', isAuthenticated, async (_req, res) => {
    try { res.json(await storage.listNoiseClasses()); } catch (e) { res.status(500).json({ message: 'Failed to fetch noise classes' }); }
  });
  app.post('/api/noise-classes', isAuthenticated, express.json(), async (req, res) => {
    try { const data = insertNoiseClassSchema.parse(req.body); const row = await storage.createNoiseClass(data as any); res.json(row); }
    catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ message: 'Validation error', errors: error.errors }); if ((error as any)?.code === '23505') return res.status(409).json({ message: 'Código já cadastrado.' }); res.status(500).json({ message: 'Failed to create noise class' }); }
  });
  app.put('/api/noise-classes/:id', isAuthenticated, express.json(), async (req, res) => {
    try { const id = Number(req.params.id); if (!Number.isFinite(id)) return res.status(400).json({ message: 'ID inválido' }); const data = insertNoiseClassSchema.partial().parse(req.body); const row = await storage.updateNoiseClass(id, data as any); res.json(row); }
    catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ message: 'Validation error', errors: error.errors }); if ((error as any)?.code === '23505') return res.status(409).json({ message: 'Código já cadastrado.' }); res.status(500).json({ message: 'Failed to update noise class' }); }
  });
  app.delete('/api/noise-classes/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ message: 'ID inválido' });
      const ok = await storage.deleteNoiseClass(id);
      res.json({ ok });
    } catch (error: any) {
      const status = (error as any)?.status || 500;
      const message = (error as any)?.message || 'Falha ao excluir classe de ruído';
      res.status(status).json({ message });
    }
  });

  // Master tables: Aggressiveness classes
  app.get('/api/aggressiveness-classes', isAuthenticated, async (_req, res) => {
    try { res.json(await storage.listAggressivenessClasses()); } catch (e) { res.status(500).json({ message: 'Failed to fetch aggressiveness classes' }); }
  });
  app.post('/api/aggressiveness-classes', isAuthenticated, express.json(), async (req, res) => {
    try { const data = insertAggressivenessClassSchema.parse(req.body); const row = await storage.createAggressivenessClass(data as any); res.json(row); }
    catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ message: 'Validation error', errors: error.errors }); if ((error as any)?.code === '23505') return res.status(409).json({ message: 'Código já cadastrado.' }); res.status(500).json({ message: 'Failed to create aggressiveness class' }); }
  });
  app.put('/api/aggressiveness-classes/:id', isAuthenticated, express.json(), async (req, res) => {
    try { const id = Number(req.params.id); if (!Number.isFinite(id)) return res.status(400).json({ message: 'ID inválido' }); const data = insertAggressivenessClassSchema.partial().parse(req.body); const row = await storage.updateAggressivenessClass(id, data as any); res.json(row); }
    catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ message: 'Validation error', errors: error.errors }); if ((error as any)?.code === '23505') return res.status(409).json({ message: 'Código já cadastrado.' }); res.status(500).json({ message: 'Failed to update aggressiveness class' }); }
  });
  app.delete('/api/aggressiveness-classes/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ message: 'ID inválido' });
      const ok = await storage.deleteAggressivenessClass(id);
      res.json({ ok });
    } catch (error: any) {
      const status = (error as any)?.status || 500;
      const message = (error as any)?.message || 'Falha ao excluir classe de agressividade';
      res.status(status).json({ message });
    }
  });

  // Master tables: Constructive systems
  app.get('/api/constructive-systems', isAuthenticated, async (_req, res) => {
    try { res.json(await storage.listConstructiveSystems()); } catch (e) { res.status(500).json({ message: 'Failed to fetch constructive systems' }); }
  });
  app.post('/api/constructive-systems', isAuthenticated, express.json(), async (req, res) => {
    try { const data = insertConstructiveSystemSchema.parse(req.body); const row = await storage.createConstructiveSystem(data as any); res.json(row); }
    catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ message: 'Validation error', errors: error.errors }); if ((error as any)?.code === '23505') return res.status(409).json({ message: 'Código já cadastrado.' }); res.status(500).json({ message: 'Failed to create constructive system' }); }
  });
  app.put('/api/constructive-systems/:id', isAuthenticated, express.json(), async (req, res) => {
    try { const id = Number(req.params.id); if (!Number.isFinite(id)) return res.status(400).json({ message: 'ID inválido' }); const data = insertConstructiveSystemSchema.partial().parse(req.body); const row = await storage.updateConstructiveSystem(id, data as any); res.json(row); }
    catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ message: 'Validation error', errors: error.errors }); if ((error as any)?.code === '23505') return res.status(409).json({ message: 'Código já cadastrado.' }); res.status(500).json({ message: 'Failed to update constructive system' }); }
  });
  app.delete('/api/constructive-systems/:id', isAuthenticated, async (req, res) => {
    try { const id = Number(req.params.id); if (!Number.isFinite(id)) return res.status(400).json({ message: 'ID inválido' }); const ok = await storage.deleteConstructiveSystem(id); res.json({ ok }); }
    catch { res.status(500).json({ message: 'Failed to delete constructive system' }); }
  });

  // Master tables: Requirements
  app.get('/api/requirements', isAuthenticated, async (_req, res) => {
    try { res.json(await storage.listRequirements()); } catch (e) { res.status(500).json({ message: 'Failed to fetch requirements' }); }
  });
  app.post('/api/requirements', isAuthenticated, express.json(), async (req, res) => {
    try { const data = insertRequirementSchema.parse(req.body); const row = await storage.createRequirement(data as any); res.json(row); }
    catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ message: 'Validation error', errors: error.errors }); if ((error as any)?.code === '23505') return res.status(409).json({ message: 'Código já cadastrado.' }); res.status(500).json({ message: 'Failed to create requirement' }); }
  });
  app.put('/api/requirements/:id', isAuthenticated, express.json(), async (req, res) => {
    try { const id = Number(req.params.id); if (!Number.isFinite(id)) return res.status(400).json({ message: 'ID inválido' }); const data = insertRequirementSchema.partial().parse(req.body); const row = await storage.updateRequirement(id, data as any); res.json(row); }
    catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ message: 'Validation error', errors: error.errors }); if ((error as any)?.code === '23505') return res.status(409).json({ message: 'Código já cadastrado.' }); res.status(500).json({ message: 'Failed to update requirement' }); }
  });
  app.delete('/api/requirements/:id', isAuthenticated, async (req, res) => {
    try { const id = Number(req.params.id); if (!Number.isFinite(id)) return res.status(400).json({ message: 'ID inválido' }); const ok = await storage.deleteRequirement(id); res.json({ ok }); }
    catch { res.status(500).json({ message: 'Failed to delete requirement' }); }
  });

  // Criteria (Critérios) endpoints
  app.get('/api/criteria', isAuthenticated, async (req, res) => {
    try {
      const requirementId = req.query.requirementId ? Number(req.query.requirementId) : undefined;
      res.json(await storage.listCriteria(requirementId));
    } catch { res.status(500).json({ message: 'Failed to fetch criteria' }); }
  });
  app.post('/api/requirements/:requirementId/criteria/:criterionId', isAuthenticated, async (req, res) => {
    try {
      const requirementId = Number(req.params.requirementId);
      const criterionId = Number(req.params.criterionId);
      if (!Number.isFinite(requirementId) || !Number.isFinite(criterionId)) return res.status(400).json({ message: 'IDs inválidos' });
      await storage.linkCriterionToRequirement(requirementId, criterionId);
      res.json({ ok: true });
    } catch { res.status(500).json({ message: 'Failed to link criterion to requirement' }); }
  });
  app.delete('/api/requirements/:requirementId/criteria/:criterionId', isAuthenticated, async (req, res) => {
    try {
      const requirementId = Number(req.params.requirementId);
      const criterionId = Number(req.params.criterionId);
      if (!Number.isFinite(requirementId) || !Number.isFinite(criterionId)) return res.status(400).json({ message: 'IDs inválidos' });
      const ok = await storage.unlinkCriterionFromRequirement(requirementId, criterionId);
      res.json({ ok });
    } catch { res.status(500).json({ message: 'Failed to unlink criterion from requirement' }); }
  });
  app.post('/api/criteria', isAuthenticated, express.json(), async (req, res) => {
    try {
      const data = insertCriterionSchema.parse(req.body);
      const row = await storage.createCriterion(data as any);
      res.json(row);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: 'Validation error', errors: error.errors });
      if ((error as any)?.code === '23505') return res.status(409).json({ message: 'Código já cadastrado.' });
      res.status(500).json({ message: 'Failed to create criterion' });
    }
  });
  app.put('/api/criteria/:id', isAuthenticated, express.json(), async (req, res) => {
    try {
      const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ message: 'ID inválido' });
      const row = await storage.updateCriterion(id, insertCriterionSchema.partial().parse(req.body) as any);
      res.json(row);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: 'Validation error', errors: error.errors });
      if ((error as any)?.code === '23505') return res.status(409).json({ message: 'Código já cadastrado.' });
      res.status(500).json({ message: 'Failed to update criterion' });
    }
  });
  app.delete('/api/criteria/:id', isAuthenticated, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ message: 'ID inválido' });
      const ok = await storage.deleteCriterion(id);
      res.json({ ok });
    } catch (error: any) {
      if (error?.status === 409) return res.status(409).json({ message: error.message });
      res.status(500).json({ message: 'Failed to delete criterion' });
    }
  });

  // Analyses endpoints
  app.get('/api/analyses', isAuthenticated, async (req, res) => {
    try {
      const criterionId = req.query.criterionId ? Number(req.query.criterionId) : undefined;
      const requirementId = req.query.requirementId ? Number(req.query.requirementId) : undefined;
      const hasPaging = 'page' in req.query || 'limit' in req.query;
      if (!hasPaging) {
        const rows = await storage.listAnalyses(criterionId, requirementId);
        return res.json(rows);
      }
      const page = req.query.page ? Number(req.query.page) : 1;
      const limit = req.query.limit ? Math.min(Number(req.query.limit), 100) : 250;
      const { items, total } = await storage.listAnalysesPaginated({ criterionId, requirementId, page, limit });
      return res.json({ items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) });
    } catch {
      res.status(500).json({ message: 'Failed to fetch analyses' });
    }
  });
  app.get('/api/analyses/next-code', isAuthenticated, async (req, res) => {
    const requirementId = Number(req.query.requirementId);
    const criterionId = Number(req.query.criterionId);
    if (!Number.isFinite(requirementId) || !Number.isFinite(criterionId)) {
      return res.status(400).json({ message: 'Parâmetros inválidos' });
    }
    try {
      const code = await storage.getNextAnalysisCode(requirementId, criterionId);
      res.json({ code });
    } catch {
      res.status(500).json({ message: 'Failed to generate analysis code' });
    }
  });
  app.post('/api/analyses', isAuthenticated, express.json(), async (req, res) => {
    try {
      const data = insertAnalysisSchema.parse(req.body);
      const row = await storage.createAnalysis(data as any);
      res.json(row);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: 'Validation error', errors: error.errors });
      if ((error as any)?.code === '23505') return res.status(409).json({ message: 'Código já cadastrado.' });
      res.status(500).json({ message: 'Failed to create analysis' });
    }
  });
  app.put('/api/analyses/:id', isAuthenticated, express.json(), async (req, res) => {
    try {
      const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ message: 'ID inválido' });
      const data = insertAnalysisSchema.partial().parse(req.body);
      const row = await storage.updateAnalysis(id, data as any);
      res.json(row);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: 'Validation error', errors: error.errors });
      if ((error as any)?.code === '23505') return res.status(409).json({ message: 'Código já cadastrado.' });
      res.status(500).json({ message: 'Failed to update analysis' });
    }
  });
  app.delete('/api/analyses/:id', isAuthenticated, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ message: 'ID inválido' });
      const ok = await storage.deleteAnalysis(id);
      res.json({ ok });
    } catch (error: any) {
      if (error?.status === 409) return res.status(409).json({ message: error.message });
      res.status(500).json({ message: 'Failed to delete analysis' });
    }
  });

  // Parameters endpoints
  app.get('/api/parameters', isAuthenticated, async (req, res) => {
    try {
      const analysisId = req.query.analysisId ? Number(req.query.analysisId) : undefined;
      const criterionId = req.query.criterionId ? Number(req.query.criterionId) : undefined;
      const requirementId = req.query.requirementId ? Number(req.query.requirementId) : undefined;
      const hasPaging = 'page' in req.query || 'limit' in req.query || 'search' in req.query;
      if (!hasPaging) {
        const rows = await storage.listParameters(analysisId, criterionId, requirementId);
        return res.json(rows);
      }
      const page = req.query.page ? Number(req.query.page) : 1;
      const limit = req.query.limit ? Math.min(Number(req.query.limit), 100) : 250;
      const search = req.query.search ? String(req.query.search) : undefined;
      const { items, total } = await storage.listParametersPaginated({ analysisId, criterionId, requirementId, page, limit, search });
      return res.json({ items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) });
    } catch (err:any) {
      console.error('Erro ao buscar parâmetros', { q: req.query, error: err?.message, stack: err?.stack });
      res.status(500).json({ message: 'Failed to fetch parameters' });
    }
  });
  app.post('/api/parameters', isAuthenticated, express.json(), async (req, res) => {
    try {
      const data = insertParameterSchema.parse(req.body);
      // Nova validação baseada em attributeId
      if ((data as any).attributeId) {
        const attrId = Number((data as any).attributeId);
        const attr = await db.query.attributeDefinitions.findFirst({ where: eq(attributeDefinitions.id, attrId) });
        if (!attr) return res.status(400).json({ message: 'Atributo inválido' });
        const hasLimits = (data as any).minLimit != null || (data as any).maxLimit != null;
        if (attr.dataKind === 'reference') {
          if (hasLimits) return res.status(400).json({ message: 'Atributo de referência não deve ter limites numéricos.' });
          if ((data as any).attributeValueId == null) return res.status(400).json({ message: 'Valor do atributo de referência obrigatório.' });
        } else if (attr.dataKind === 'numeric') {
          if ((data as any).attributeValueId != null) return res.status(400).json({ message: 'Atributo numérico não deve ter valor de item selecionado.' });
          if ((data as any).minLimit != null && (data as any).maxLimit != null) {
            const a = Number((data as any).minLimit); const b = Number((data as any).maxLimit); if (!isNaN(a) && !isNaN(b) && a > b) return res.status(400).json({ message: 'Limite máximo deve ser >= limite mínimo' });
          }
        } else {
          // text / boolean / date -> não aceita limites ou valorId
          if (hasLimits) return res.status(400).json({ message: 'Este tipo de atributo não aceita limites.' });
          if ((data as any).attributeValueId != null) return res.status(400).json({ message: 'Este tipo de atributo não aceita valor selecionado.' });
        }
      }
      const row = await storage.createParameter(data as any);
      res.json(row);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: 'Validation error', errors: error.errors });
      res.status(500).json({ message: 'Failed to create parameter' });
    }
  });
  app.put('/api/parameters/:id', isAuthenticated, express.json(), async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ message: 'ID inválido' });
      const data = insertParameterSchema.partial().parse(req.body);
      if ((data as any).attributeId) {
        const attrId = Number((data as any).attributeId);
        const attr = await db.query.attributeDefinitions.findFirst({ where: eq(attributeDefinitions.id, attrId) });
        if (!attr) return res.status(400).json({ message: 'Atributo inválido' });
        const hasLimits = (data as any).minLimit != null || (data as any).maxLimit != null;
        if (attr.dataKind === 'reference') {
          if (hasLimits) return res.status(400).json({ message: 'Atributo de referência não deve ter limites numéricos.' });
        } else if (attr.dataKind === 'numeric') {
          if ((data as any).attributeValueId != null) return res.status(400).json({ message: 'Atributo numérico não deve ter valor de item selecionado.' });
          if ((data as any).minLimit != null && (data as any).maxLimit != null) {
            const a = Number((data as any).minLimit); const b = Number((data as any).maxLimit); if (!isNaN(a) && !isNaN(b) && a > b) return res.status(400).json({ message: 'Limite máximo deve ser >= limite mínimo' });
          }
        } else {
          if (hasLimits) return res.status(400).json({ message: 'Este tipo de atributo não aceita limites.' });
          if ((data as any).attributeValueId != null) return res.status(400).json({ message: 'Este tipo de atributo não aceita valor selecionado.' });
        }
      }
      const row = await storage.updateParameter(id, data as any);
      res.json(row);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: 'Validation error', errors: error.errors });
      res.status(500).json({ message: 'Failed to update parameter' });
    }
  });
  app.delete('/api/parameters/:id', isAuthenticated, async (req, res) => {
    try { const id = Number(req.params.id); if (!Number.isFinite(id)) return res.status(400).json({ message: 'ID inválido' }); const ok = await storage.deleteParameter(id); res.json({ ok }); }
    catch { res.status(500).json({ message: 'Failed to delete parameter' }); }
  });

  // Unified attribute value options endpoint
  app.get('/api/attributes/:id/values', isAuthenticated, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ message: 'ID inválido' });
      const attr = await db.query.attributeDefinitions.findFirst({ where: eq(attributeDefinitions.id, id) });
      if (!attr) return res.status(404).json({ message: 'Atributo não encontrado' });
      if (attr.dataKind !== 'reference') return res.json([]);
      const table = attr.valueSource; // e.g. 'typologies'
      if (!table) return res.json([]);
      // Basic whitelist to avoid SQL injection; could instead query attributeValueSourceEnum
      const allowed = new Set(['typologies','noise_classes','aggressiveness_classes','bioclimatic_zones','isopleths']);
      if (!allowed.has(table)) return res.status(400).json({ message: 'Fonte não suportada' });
      // Validate identifier names against information_schema
      const identRe = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
      const idField = (attr.valueIdField || 'id');
      const labelField = (attr.valueLabelField || 'label');
      if (!identRe.test(idField) || !identRe.test(labelField)) {
        return res.status(400).json({ message: 'Campos de identificador inválidos' });
      }
      const colsRes = await pool.query<{ column_name: string }>(
        `select column_name from information_schema.columns where table_schema='public' and table_name=$1`,
        [table]
      );
      const colSet = new Set(colsRes.rows.map(r => r.column_name));
      if (!colSet.has(idField) || !colSet.has(labelField)) {
        return res.status(400).json({ message: 'Campos não encontrados na tabela de origem' });
      }
      // Build dynamic SQL selecting id + label and include code when present (identifiers validated)
      const hasCode = colSet.has('code');
      const selectFields = `${idField} as id, ${labelField} as label${hasCode ? ', code' : ''}`;
      const sqlText = `select ${selectFields} from ${table} where is_active is distinct from false order by 1 limit 500`;
      const rows = await pool.query(sqlText);
      res.json(rows.rows);
    } catch (e:any) {
      console.error('Erro /api/attributes/:id/values', e);
      res.status(500).json({ message: 'Falha ao listar valores' });
    }
  });

  // Integração attributeId concluída.

  const httpServer = createServer(app);
  return httpServer;
}

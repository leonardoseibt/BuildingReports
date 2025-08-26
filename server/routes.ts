import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, refreshSession } from "./auth";
import { insertBuildingSchema, updateBuildingSchema, insertStructuralSystemSchema, insertSealingSystemSchema, insertRoofingSystemSchema, insertPerformanceEvaluationSchema, insertReportSchema, insertTechnicianSchema, updateTechnicianSchema, insertUserSchema, updateUserSchema, insertTypologySchema, insertNoiseClassSchema, insertAggressivenessClassSchema, insertBioclimaticZoneSchema, insertBioclimaticZoneCoverageSchema, insertStateSchema, insertCitySchema, insertConstructiveSystemSchema, insertRequirementSchema, insertCriterionSchema, insertAnalysisSchema } from "@shared/schema";
import { insertParameterSchema } from '@shared/schema';
import bcrypt from "bcryptjs";
import { z } from "zod";

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

  // User management routes
  app.get('/api/users', isAuthenticated, async (_req, res) => {
    try {
      const list = await storage.listUsers();
      res.json(list);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ message: 'Failed to fetch users' });
    }
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
      const created = await storage.upsertUser({
        email: normalizedEmail,
        fullName: data.fullName,
        passwordHash,
        phone: data.phone,
        emailVerified: true,
      } as any);
      const { id, email, fullName, phone, createdAt, updatedAt } = created as any;
      res.json({ id, email, fullName, phone, createdAt, updatedAt });
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
      if (data.password) {
        const passwordHash = await bcrypt.hash(data.password, 10);
        update.passwordHash = passwordHash;
      }
      const saved = await storage.updateUser(id, update);
      const { email, fullName, phone, createdAt, updatedAt } = saved as any;
      res.json({ id, email, fullName, phone, createdAt, updatedAt });
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
      if ((buildingData as any).technicianId) {
        const tech = await storage.getTechnician(Number((buildingData as any).technicianId));
        if (!tech) return res.status(400).json({ message: 'Responsável técnico informado não existe.' });
        if (tech.userId !== userId) return res.status(403).json({ message: 'Access denied' });
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
      const buildings = await storage.getBuildingsByUser(userId);
      res.json(buildings);
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
      
      // Check if building belongs to user
      if (building.userId !== Number(req.user.claims.sub)) {
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
      if (existing.userId !== Number(req.user.claims.sub)) return res.status(403).json({ message: 'Access denied' });

      const data = updateBuildingSchema.parse(req.body);
      if ((data as any).technicianId) {
        const tech = await storage.getTechnician(Number((data as any).technicianId));
        if (!tech) return res.status(400).json({ message: 'Responsável técnico informado não existe.' });
        if (tech.userId !== Number(req.user.claims.sub)) return res.status(403).json({ message: 'Access denied' });
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
      if (existing.userId !== Number(req.user.claims.sub)) return res.status(403).json({ message: 'Access denied' });

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
      
  if (!building || building.userId !== Number(req.user.claims.sub)) {
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
      
  if (!building || building.userId !== Number(req.user.claims.sub)) {
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
      
  if (!building || building.userId !== Number(req.user.claims.sub)) {
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

  // Performance evaluation routes
  app.post('/api/buildings/:id/evaluation', isAuthenticated, async (req: any, res) => {
    try {
      const buildingId = Number(req.params.id);
  if (!Number.isFinite(buildingId)) return res.status(400).json({ message: 'ID inválido' });
      const building = await storage.getBuilding(buildingId);
      
  if (!building || building.userId !== Number(req.user.claims.sub)) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const evaluationData = insertPerformanceEvaluationSchema.parse({
        ...req.body,
        buildingId,
      });
      
      const evaluation = await storage.createPerformanceEvaluation(evaluationData);
      res.json(evaluation);
    } catch (error) {
      console.error("Error creating performance evaluation:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create performance evaluation" });
    }
  });

  app.get('/api/buildings/:id/evaluation', isAuthenticated, async (req: any, res) => {
    try {
      const buildingId = Number(req.params.id);
  if (!Number.isFinite(buildingId)) return res.status(400).json({ message: 'ID inválido' });
      const building = await storage.getBuilding(buildingId);
      
  if (!building || building.userId !== Number(req.user.claims.sub)) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const evaluation = await storage.getPerformanceEvaluation(buildingId);
      res.json(evaluation);
    } catch (error) {
      console.error("Error fetching performance evaluation:", error);
      res.status(500).json({ message: "Failed to fetch performance evaluation" });
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
      const reports = await storage.getReportsByUser(userId);
      res.json(reports);
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

  // CEP lookup route for bioclimatic zone determination
  app.get('/api/cep/:cep', isAuthenticated, async (req, res) => {
    try {
      const cep = req.params.cep.replace(/\D/g, '');
      
      // Call ViaCEP API
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();
      
      if (data.erro) {
        return res.status(404).json({ message: "CEP not found" });
      }
      // Determine bioclimatic zone based on DB coverages (city first, then UF)
      const zoneFromDb = await storage.findBioclimaticZoneForLocation(data.uf, data.localidade);
      const bioclimaticZone = zoneFromDb || 'ZB3';
      
      res.json({
        address: data.logradouro || '',
        neighborhood: data.bairro || '',
        city: data.localidade || '',
        state: data.uf || '',
        bioclimaticZone,
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
      const list = await storage.listTechnicians(userId);
      res.json(list);
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
      if (row.userId !== Number(req.user.claims.sub)) return res.status(403).json({ message: 'Access denied' });
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
      if (existing.userId !== Number(req.user.claims.sub)) return res.status(403).json({ message: 'Access denied' });

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
      if (existing.userId !== Number(req.user.claims.sub)) return res.status(403).json({ message: 'Access denied' });

      const ok = await storage.deleteTechnician(id);
      res.json({ ok });
    } catch (error) {
      console.error('Error deleting technician', error);
      res.status(500).json({ message: 'Failed to delete technician' });
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
  app.delete('/api/typologies/:id', isAuthenticated, async (req, res) => {
    try { const id = Number(req.params.id); if (!Number.isFinite(id)) return res.status(400).json({ message: 'ID inválido' }); const ok = await storage.deleteTypology(id); res.json({ ok }); }
    catch { res.status(500).json({ message: 'Failed to delete typology' }); }
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
  app.delete('/api/noise-classes/:id', isAuthenticated, async (req, res) => {
    try { const id = Number(req.params.id); if (!Number.isFinite(id)) return res.status(400).json({ message: 'ID inválido' }); const ok = await storage.deleteNoiseClass(id); res.json({ ok }); }
    catch { res.status(500).json({ message: 'Failed to delete noise class' }); }
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
  app.delete('/api/aggressiveness-classes/:id', isAuthenticated, async (req, res) => {
    try { const id = Number(req.params.id); if (!Number.isFinite(id)) return res.status(400).json({ message: 'ID inválido' }); const ok = await storage.deleteAggressivenessClass(id); res.json({ ok }); }
    catch { res.status(500).json({ message: 'Failed to delete aggressiveness class' }); }
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
  app.get('/api/criteria', isAuthenticated, async (_req, res) => {
    try { res.json(await storage.listCriteria()); } catch { res.status(500).json({ message: 'Failed to fetch criteria' }); }
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
    try { const id = Number(req.params.id); if (!Number.isFinite(id)) return res.status(400).json({ message: 'ID inválido' }); const ok = await storage.deleteCriterion(id); res.json({ ok }); }
    catch { res.status(500).json({ message: 'Failed to delete criterion' }); }
  });

  // Analyses endpoints
  app.get('/api/analyses', isAuthenticated, async (req, res) => {
    try {
      const criterionId = req.query.criterionId ? Number(req.query.criterionId) : undefined;
      const rows = await storage.listAnalyses(criterionId);
      res.json(rows);
    } catch {
      res.status(500).json({ message: 'Failed to fetch analyses' });
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
    try { const id = Number(req.params.id); if (!Number.isFinite(id)) return res.status(400).json({ message: 'ID inválido' }); const ok = await storage.deleteAnalysis(id); res.json({ ok }); }
    catch { res.status(500).json({ message: 'Failed to delete analysis' }); }
  });

  // Parameters endpoints
  app.get('/api/parameters', isAuthenticated, async (req, res) => {
    try {
      const analysisId = req.query.analysisId ? Number(req.query.analysisId) : undefined;
      const criterionId = req.query.criterionId ? Number(req.query.criterionId) : undefined;
      const rows = await storage.listParameters(analysisId, criterionId);
      res.json(rows);
    } catch {
  console.error('Erro ao buscar parâmetros', { q: req.query });
  res.status(500).json({ message: 'Failed to fetch parameters' });
    }
  });
  app.post('/api/parameters', isAuthenticated, express.json(), async (req, res) => {
    try {
      const data = insertParameterSchema.parse(req.body);
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

  const httpServer = createServer(app);
  return httpServer;
}

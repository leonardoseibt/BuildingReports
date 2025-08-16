import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./auth";
import { insertBuildingSchema, insertStructuralSystemSchema, insertSealingSystemSchema, insertRoofingSystemSchema, insertPerformanceEvaluationSchema, insertReportSchema, insertTechnicianSchema, insertUserSchema, updateUserSchema } from "@shared/schema";
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
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

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

  // Building systems routes
  app.post('/api/buildings/:id/structural-system', isAuthenticated, async (req: any, res) => {
    try {
      const buildingId = Number(req.params.id);
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
      
      // Determine bioclimatic zone based on location
      // This is a simplified mapping - in production, use proper geographical mapping
      const bioclimaticZoneMap: Record<string, string> = {
        'AC': 'ZB8', 'AL': 'ZB8', 'AP': 'ZB8', 'AM': 'ZB8', 'BA': 'ZB8',
        'CE': 'ZB8', 'DF': 'ZB4', 'ES': 'ZB8', 'GO': 'ZB6', 'MA': 'ZB8',
        'MT': 'ZB7', 'MS': 'ZB6', 'MG': 'ZB3', 'PA': 'ZB8', 'PB': 'ZB8',
        'PR': 'ZB2', 'PE': 'ZB8', 'PI': 'ZB7', 'RJ': 'ZB8', 'RN': 'ZB8',
        'RS': 'ZB2', 'RO': 'ZB8', 'RR': 'ZB8', 'SC': 'ZB2', 'SP': 'ZB3',
        'SE': 'ZB8', 'TO': 'ZB7'
      };
      
      const bioclimaticZone = bioclimaticZoneMap[data.uf] || 'ZB3';
      
      res.json({
        address: `${data.logradouro}, ${data.bairro}, ${data.localidade}, ${data.uf}`,
        city: data.localidade,
        state: data.uf,
        bioclimaticZone,
      });
    } catch (error) {
      console.error("Error looking up CEP:", error);
      res.status(500).json({ message: "Failed to lookup CEP" });
    }
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

  const httpServer = createServer(app);
  return httpServer;
}

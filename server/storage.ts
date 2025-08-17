import {
  users,
  buildings,
  structuralSystems,
  sealingSystems,
  roofingSystems,
  performanceEvaluations,
  reports,
  type User,
  type PublicUser,
  type UpsertUser,
  type Building,
  type InsertBuilding,
  type StructuralSystem,
  type InsertStructuralSystem,
  type SealingSystem,
  type InsertSealingSystem,
  type RoofingSystem,
  type InsertRoofingSystem,
  type PerformanceEvaluation,
  type InsertPerformanceEvaluation,
  type Report,
  type InsertReport,
  type Technician,
  type InsertTechnician,
  technicians,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<PublicUser | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  ensureUserByEmail(email: string, fullName?: string, phone?: string): Promise<User>;
  listUsers(): Promise<PublicUser[]>;
  deleteUser(id: number): Promise<boolean>;
  updateUser(id: number, data: Partial<UpsertUser>): Promise<User>;
  
  // Building operations
  createBuilding(building: InsertBuilding): Promise<Building>;
  getBuildingsByUser(userId: number): Promise<Building[]>;
  getBuilding(id: number): Promise<Building | undefined>;
  updateBuilding(id: number, building: Partial<InsertBuilding>): Promise<Building>;
  
  // Building systems operations
  createStructuralSystem(system: InsertStructuralSystem): Promise<StructuralSystem>;
  createSealingSystem(system: InsertSealingSystem): Promise<SealingSystem>;
  createRoofingSystem(system: InsertRoofingSystem): Promise<RoofingSystem>;
  
  getStructuralSystem(buildingId: number): Promise<StructuralSystem | undefined>;
  getSealingSystem(buildingId: number): Promise<SealingSystem | undefined>;
  getRoofingSystem(buildingId: number): Promise<RoofingSystem | undefined>;
  
  // Performance evaluation operations
  createPerformanceEvaluation(evaluation: InsertPerformanceEvaluation): Promise<PerformanceEvaluation>;
  getPerformanceEvaluation(buildingId: number): Promise<PerformanceEvaluation | undefined>;
  updatePerformanceEvaluation(id: number, evaluation: Partial<InsertPerformanceEvaluation>): Promise<PerformanceEvaluation>;
  
  // Report operations
  createReport(report: InsertReport): Promise<Report>;
  getReportsByBuilding(buildingId: number): Promise<Report[]>;
  getReportsByUser(userId: number): Promise<Report[]>;
  getReport(id: number): Promise<Report | undefined>;
  
  // Dashboard statistics
  getUserStats(userId: number): Promise<{
    totalBuildings: number;
    totalReports: number;
    pendingEvaluations: number;
    recentBuildings: Building[];
  }>;

  // Technicians
  createTechnician(tech: InsertTechnician): Promise<Technician>;
  listTechnicians(userId: number): Promise<Technician[]>;
  getTechnician(id: number): Promise<Technician | undefined>;
  updateTechnician(id: number, tech: Partial<InsertTechnician>): Promise<Technician>;
  deleteTechnician(id: number): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: number): Promise<PublicUser | undefined> {
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        phone: users.phone,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async ensureUserByEmail(
    email: string,
    fullName = "Dev User",
    phone = "",
  ): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({ email, fullName, phone })
      .onConflictDoUpdate({
        target: users.email!,
        set: { fullName, phone, updatedAt: new Date() },
      })
      .returning();
    return user;
  }

  async listUsers(): Promise<PublicUser[]> {
    return await db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        phone: users.phone,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt));
  }

  async deleteUser(id: number): Promise<boolean> {
    try {
      const deleted = await db
        .delete(users)
        .where(eq(users.id, id))
        .returning({ id: users.id });
      return deleted.length > 0;
    } catch (err: any) {
      // Postgres FK violation code
      if (err?.code === '23503') {
        const e = new Error('Não é possível excluir: existem registros relacionados.');
        (e as any).status = 409;
        throw e;
      }
      throw err;
    }
  }

  async updateUser(id: number, data: Partial<UpsertUser>): Promise<User> {
    const [row] = await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return row;
  }

  // Building operations
  async createBuilding(building: InsertBuilding): Promise<Building> {
    const [newBuilding] = await db.insert(buildings).values({
      name: building.name,
      userId: building.userId,
      technicalResponsible: building.technicalResponsible,
      creaCau: building.creaCau,
      typology: building.typology,
      cep: building.cep,
      address: building.address,
      bioclimaticZone: building.bioclimaticZone,
      totalArea: building.totalArea,
      floors: building.floors,
      units: building.units,
      noiseClass: building.noiseClass,
      aggressivenessClass: building.aggressivenessClass,
    }).returning();
    return newBuilding;
  }

  async getBuildingsByUser(userId: number): Promise<Building[]> {
    return await db
      .select()
      .from(buildings)
      .where(eq(buildings.userId, userId))
      .orderBy(desc(buildings.createdAt));
  }

  async getBuilding(id: number): Promise<Building | undefined> {
    const [building] = await db
      .select()
      .from(buildings)
      .where(eq(buildings.id, id));
    return building;
  }

  async updateBuilding(id: number, building: Partial<InsertBuilding>): Promise<Building> {
    const [updatedBuilding] = await db
      .update(buildings)
      .set({ ...building, updatedAt: new Date() })
      .where(eq(buildings.id, id))
      .returning();
    return updatedBuilding;
  }

  // Building systems operations
  async createStructuralSystem(system: InsertStructuralSystem): Promise<StructuralSystem> {
    const [newSystem] = await db.insert(structuralSystems).values({
      buildingId: system.buildingId,
      systemType: system.systemType,
      materialResistance: system.materialResistance,
      designLife: system.designLife,
      designLoads: system.designLoads,
    }).returning();
    return newSystem;
  }

  async createSealingSystem(system: InsertSealingSystem): Promise<SealingSystem> {
    const [newSystem] = await db.insert(sealingSystems).values({
      buildingId: system.buildingId,
      externalWalls: system.externalWalls,
      internalWalls: system.internalWalls,
      acousticProperties: system.acousticProperties,
      thermalProperties: system.thermalProperties,
    }).returning();
    return newSystem;
  }

  async createRoofingSystem(system: InsertRoofingSystem): Promise<RoofingSystem> {
    const [newSystem] = await db.insert(roofingSystems).values({
      buildingId: system.buildingId,
      roofingType: system.roofingType,
      thermalProperties: system.thermalProperties,
      waterproofing: system.waterproofing,
      slope: system.slope,
      thermalInsulation: system.thermalInsulation,
    }).returning();
    return newSystem;
  }

  async getStructuralSystem(buildingId: number): Promise<StructuralSystem | undefined> {
    const [system] = await db
      .select()
      .from(structuralSystems)
      .where(eq(structuralSystems.buildingId, buildingId));
    return system;
  }

  async getSealingSystem(buildingId: number): Promise<SealingSystem | undefined> {
    const [system] = await db
      .select()
      .from(sealingSystems)
      .where(eq(sealingSystems.buildingId, buildingId));
    return system;
  }

  async getRoofingSystem(buildingId: number): Promise<RoofingSystem | undefined> {
    const [system] = await db
      .select()
      .from(roofingSystems)
      .where(eq(roofingSystems.buildingId, buildingId));
    return system;
  }

  // Performance evaluation operations
  async createPerformanceEvaluation(evaluation: InsertPerformanceEvaluation): Promise<PerformanceEvaluation> {
    const [newEvaluation] = await db.insert(performanceEvaluations).values({
      buildingId: evaluation.buildingId,
      structuralSafety: evaluation.structuralSafety,
      thermalPerformance: evaluation.thermalPerformance,
      acousticPerformance: evaluation.acousticPerformance,
      waterTightness: evaluation.waterTightness,
      fireSafety: evaluation.fireSafety,
      evaluationData: evaluation.evaluationData,
      status: evaluation.status,
    }).returning();
    return newEvaluation;
  }

  async getPerformanceEvaluation(buildingId: number): Promise<PerformanceEvaluation | undefined> {
    const [evaluation] = await db
      .select()
      .from(performanceEvaluations)
      .where(eq(performanceEvaluations.buildingId, buildingId))
      .orderBy(desc(performanceEvaluations.createdAt));
    return evaluation;
  }

  async updatePerformanceEvaluation(id: number, evaluation: Partial<InsertPerformanceEvaluation>): Promise<PerformanceEvaluation> {
    const [updatedEvaluation] = await db
      .update(performanceEvaluations)
      .set({ ...evaluation, updatedAt: new Date() })
      .where(eq(performanceEvaluations.id, id))
      .returning();
    return updatedEvaluation;
  }

  // Report operations
  async createReport(report: InsertReport): Promise<Report> {
    const [newReport] = await db.insert(reports).values({
      buildingId: report.buildingId,
      evaluationId: report.evaluationId,
      reportData: report.reportData,
      version: report.version,
      isActive: report.isActive,
    }).returning();
    return newReport;
  }

  async getReportsByBuilding(buildingId: number): Promise<Report[]> {
    return await db
      .select()
      .from(reports)
      .where(and(eq(reports.buildingId, buildingId), eq(reports.isActive, true)))
      .orderBy(desc(reports.generatedAt));
  }

  async getReportsByUser(userId: number): Promise<Report[]> {
    return await db
      .select({
        id: reports.id,
        buildingId: reports.buildingId,
        evaluationId: reports.evaluationId,
        reportData: reports.reportData,
        version: reports.version,
        isActive: reports.isActive,
        generatedAt: reports.generatedAt,
        buildingName: buildings.name,
      })
      .from(reports)
      .leftJoin(buildings, eq(reports.buildingId, buildings.id))
      .where(and(
        eq(buildings.userId, userId),
        eq(reports.isActive, true)
      ))
      .orderBy(desc(reports.generatedAt));
  }

  async getReport(id: number): Promise<Report | undefined> {
    const [report] = await db
      .select()
      .from(reports)
      .where(eq(reports.id, id));
    return report;
  }

  // Dashboard statistics
  async getUserStats(userId: number): Promise<{
    totalBuildings: number;
    totalReports: number;
    pendingEvaluations: number;
    recentBuildings: Building[];
  }> {
    const userBuildings = await this.getBuildingsByUser(userId);
    const userReports = await this.getReportsByUser(userId);
    
    // Get pending evaluations count
  const buildingIds = userBuildings.map(b => b.id);
    let pendingEvaluations = 0;
    
    for (const buildingId of buildingIds) {
      const evaluation = await this.getPerformanceEvaluation(buildingId);
      if (!evaluation || evaluation.status === 'pending') {
        pendingEvaluations++;
      }
    }

    const recentBuildings = userBuildings.slice(0, 5);

    return {
      totalBuildings: userBuildings.length,
      totalReports: userReports.length,
      pendingEvaluations,
      recentBuildings,
    };
  }

  // Technicians
  async createTechnician(tech: InsertTechnician): Promise<Technician> {
    const [row] = await db.insert(technicians).values({
      userId: tech.userId,
      fullName: tech.fullName,
      creaCau: tech.creaCau,
      registrationType: tech.registrationType,
      licenseState: tech.licenseState,
      cpfCnpj: tech.cpfCnpj,
      email: tech.email,
      phone: tech.phone,
      company: tech.company,
      address: tech.address,
      city: tech.city,
      state: tech.state,
      cep: tech.cep,
      notes: tech.notes,
    }).returning();
    return row;
  }

  async listTechnicians(userId: number): Promise<Technician[]> {
    return await db.select().from(technicians).where(eq(technicians.userId, userId)).orderBy(desc(technicians.createdAt));
  }

  async getTechnician(id: number): Promise<Technician | undefined> {
    const [row] = await db.select().from(technicians).where(eq(technicians.id, id));
    return row;
  }

  async updateTechnician(id: number, tech: Partial<InsertTechnician>): Promise<Technician> {
    const [row] = await db
      .update(technicians)
      .set({ ...tech, updatedAt: new Date() })
      .where(eq(technicians.id, id))
      .returning();
    return row as Technician;
  }

  async deleteTechnician(id: number): Promise<boolean> {
    const deleted = await db.delete(technicians).where(eq(technicians.id, id)).returning({ id: technicians.id });
    return deleted.length > 0;
  }
}

export const storage = new DatabaseStorage();

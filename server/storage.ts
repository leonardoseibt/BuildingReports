import {
  users,
  buildings,
  structuralSystems,
  sealingSystems,
  roofingSystems,
  performanceEvaluations,
  reports,
  type User,
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
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";

export interface IStorage {
  // User operations (mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Building operations
  createBuilding(building: InsertBuilding): Promise<Building>;
  getBuildingsByUser(userId: string): Promise<Building[]>;
  getBuilding(id: string): Promise<Building | undefined>;
  updateBuilding(id: string, building: Partial<InsertBuilding>): Promise<Building>;
  
  // Building systems operations
  createStructuralSystem(system: InsertStructuralSystem): Promise<StructuralSystem>;
  createSealingSystem(system: InsertSealingSystem): Promise<SealingSystem>;
  createRoofingSystem(system: InsertRoofingSystem): Promise<RoofingSystem>;
  
  getStructuralSystem(buildingId: string): Promise<StructuralSystem | undefined>;
  getSealingSystem(buildingId: string): Promise<SealingSystem | undefined>;
  getRoofingSystem(buildingId: string): Promise<RoofingSystem | undefined>;
  
  // Performance evaluation operations
  createPerformanceEvaluation(evaluation: InsertPerformanceEvaluation): Promise<PerformanceEvaluation>;
  getPerformanceEvaluation(buildingId: string): Promise<PerformanceEvaluation | undefined>;
  updatePerformanceEvaluation(id: string, evaluation: Partial<InsertPerformanceEvaluation>): Promise<PerformanceEvaluation>;
  
  // Report operations
  createReport(report: InsertReport): Promise<Report>;
  getReportsByBuilding(buildingId: string): Promise<Report[]>;
  getReportsByUser(userId: string): Promise<Report[]>;
  getReport(id: string): Promise<Report | undefined>;
  
  // Dashboard statistics
  getUserStats(userId: string): Promise<{
    totalBuildings: number;
    totalReports: number;
    pendingEvaluations: number;
    recentBuildings: Building[];
  }>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
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

  // Building operations
  async createBuilding(building: InsertBuilding): Promise<Building> {
    const [newBuilding] = await db
      .insert(buildings)
      .values(building)
      .returning();
    return newBuilding;
  }

  async getBuildingsByUser(userId: string): Promise<Building[]> {
    return await db
      .select()
      .from(buildings)
      .where(eq(buildings.userId, userId))
      .orderBy(desc(buildings.createdAt));
  }

  async getBuilding(id: string): Promise<Building | undefined> {
    const [building] = await db
      .select()
      .from(buildings)
      .where(eq(buildings.id, id));
    return building;
  }

  async updateBuilding(id: string, building: Partial<InsertBuilding>): Promise<Building> {
    const [updatedBuilding] = await db
      .update(buildings)
      .set({ ...building, updatedAt: new Date() })
      .where(eq(buildings.id, id))
      .returning();
    return updatedBuilding;
  }

  // Building systems operations
  async createStructuralSystem(system: InsertStructuralSystem): Promise<StructuralSystem> {
    const [newSystem] = await db
      .insert(structuralSystems)
      .values(system)
      .returning();
    return newSystem;
  }

  async createSealingSystem(system: InsertSealingSystem): Promise<SealingSystem> {
    const [newSystem] = await db
      .insert(sealingSystems)
      .values(system)
      .returning();
    return newSystem;
  }

  async createRoofingSystem(system: InsertRoofingSystem): Promise<RoofingSystem> {
    const [newSystem] = await db
      .insert(roofingSystems)
      .values(system)
      .returning();
    return newSystem;
  }

  async getStructuralSystem(buildingId: string): Promise<StructuralSystem | undefined> {
    const [system] = await db
      .select()
      .from(structuralSystems)
      .where(eq(structuralSystems.buildingId, buildingId));
    return system;
  }

  async getSealingSystem(buildingId: string): Promise<SealingSystem | undefined> {
    const [system] = await db
      .select()
      .from(sealingSystems)
      .where(eq(sealingSystems.buildingId, buildingId));
    return system;
  }

  async getRoofingSystem(buildingId: string): Promise<RoofingSystem | undefined> {
    const [system] = await db
      .select()
      .from(roofingSystems)
      .where(eq(roofingSystems.buildingId, buildingId));
    return system;
  }

  // Performance evaluation operations
  async createPerformanceEvaluation(evaluation: InsertPerformanceEvaluation): Promise<PerformanceEvaluation> {
    const [newEvaluation] = await db
      .insert(performanceEvaluations)
      .values(evaluation)
      .returning();
    return newEvaluation;
  }

  async getPerformanceEvaluation(buildingId: string): Promise<PerformanceEvaluation | undefined> {
    const [evaluation] = await db
      .select()
      .from(performanceEvaluations)
      .where(eq(performanceEvaluations.buildingId, buildingId))
      .orderBy(desc(performanceEvaluations.createdAt));
    return evaluation;
  }

  async updatePerformanceEvaluation(id: string, evaluation: Partial<InsertPerformanceEvaluation>): Promise<PerformanceEvaluation> {
    const [updatedEvaluation] = await db
      .update(performanceEvaluations)
      .set({ ...evaluation, updatedAt: new Date() })
      .where(eq(performanceEvaluations.id, id))
      .returning();
    return updatedEvaluation;
  }

  // Report operations
  async createReport(report: InsertReport): Promise<Report> {
    const [newReport] = await db
      .insert(reports)
      .values(report)
      .returning();
    return newReport;
  }

  async getReportsByBuilding(buildingId: string): Promise<Report[]> {
    return await db
      .select()
      .from(reports)
      .where(and(eq(reports.buildingId, buildingId), eq(reports.isActive, true)))
      .orderBy(desc(reports.generatedAt));
  }

  async getReportsByUser(userId: string): Promise<Report[]> {
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

  async getReport(id: string): Promise<Report | undefined> {
    const [report] = await db
      .select()
      .from(reports)
      .where(eq(reports.id, id));
    return report;
  }

  // Dashboard statistics
  async getUserStats(userId: string): Promise<{
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
}

export const storage = new DatabaseStorage();

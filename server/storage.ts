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
  type Typology,
  type InsertTypology,
  type NoiseClass,
  type InsertNoiseClass,
  type AggressivenessClass,
  type InsertAggressivenessClass,
  technicians,
  typologies,
  noiseClasses,
  aggressivenessClasses,
  bioclimaticZones,
  bioclimaticZoneCoverages,
  states,
  cities,
  type BioclimaticZone,
  type InsertBioclimaticZone,
  type BioclimaticZoneCoverage,
  type InsertBioclimaticZoneCoverage,
  type State,
  type InsertState,
  type City,
  type InsertCity,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, asc, isNull, ilike } from "drizzle-orm";

// Use a single Portuguese (Brazil) collator for accent-aware, numeric-friendly sorting
const ptCollator = new Intl.Collator('pt-BR', { usage: 'sort', sensitivity: 'accent', numeric: true, ignorePunctuation: true });

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
  deleteBuilding(id: number): Promise<boolean>;
  
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

  // Master tables
  listTypologies(): Promise<Typology[]>;
  createTypology(item: InsertTypology): Promise<Typology>;
  updateTypology(id: number, item: Partial<InsertTypology>): Promise<Typology>;
  deleteTypology(id: number): Promise<boolean>;

  listNoiseClasses(): Promise<NoiseClass[]>;
  createNoiseClass(item: InsertNoiseClass): Promise<NoiseClass>;
  updateNoiseClass(id: number, item: Partial<InsertNoiseClass>): Promise<NoiseClass>;
  deleteNoiseClass(id: number): Promise<boolean>;

  listAggressivenessClasses(): Promise<AggressivenessClass[]>;
  createAggressivenessClass(item: InsertAggressivenessClass): Promise<AggressivenessClass>;
  updateAggressivenessClass(id: number, item: Partial<InsertAggressivenessClass>): Promise<AggressivenessClass>;
  deleteAggressivenessClass(id: number): Promise<boolean>;

  // Bioclimatic zones
  listBioclimaticZones(): Promise<BioclimaticZone[]>;
  createBioclimaticZone(item: InsertBioclimaticZone): Promise<BioclimaticZone>;
  updateBioclimaticZone(id: number, item: Partial<InsertBioclimaticZone>): Promise<BioclimaticZone>;
  deleteBioclimaticZone(id: number): Promise<boolean>;
  listBioclimaticZoneCoverages(zoneId: number): Promise<BioclimaticZoneCoverage[]>;
  createBioclimaticZoneCoverage(zoneId: number, item: Omit<InsertBioclimaticZoneCoverage, 'zoneId'>): Promise<BioclimaticZoneCoverage>;
  updateBioclimaticZoneCoverage(id: number, item: Partial<InsertBioclimaticZoneCoverage>): Promise<BioclimaticZoneCoverage>;
  deleteBioclimaticZoneCoverage(id: number): Promise<boolean>;
  findBioclimaticZoneForLocation(state: string, city?: string | null): Promise<string | null>;
  findZonesByCityName(q: string): Promise<Array<{ id: number; code: string; label: string }>>;

  // States & Cities
  listStates(): Promise<State[]>;
  createState(item: InsertState): Promise<State>;
  updateState(id: number, item: Partial<InsertState>): Promise<State>;
  deleteState(id: number): Promise<boolean>;
  listCitiesByState(stateId: number): Promise<City[]>;
  listCities(): Promise<City[]>;
  createCity(item: InsertCity): Promise<City>;
  updateCity(id: number, item: Partial<InsertCity>): Promise<City>;
  deleteCity(id: number): Promise<boolean>;
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
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      throw new Error("Email is required");
    }
    const [user] = await db
      .insert(users)
      .values({ email: normalizedEmail, fullName, phone })
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
    // Normalize: assign provided values and ensure FK ids exist
    const values: any = {
      name: building.name,
      userId: building.userId,
      technicianId: (building as any).technicianId,
      cep: building.cep,
      address: building.address,
  addressNumber: (building as any).addressNumber,
      bioclimaticZone: building.bioclimaticZone,
      totalArea: building.totalArea,
  buildingHeight: (building as any).buildingHeight,
      floors: building.floors,
      units: building.units,
    };
    if ((building as any).typologyId) {
      const [t] = await db.select().from(typologies).where(eq(typologies.id, (building as any).typologyId));
      if (t) { values.typologyId = t.id; }
    }
    if ((building as any).noiseClassId) {
      const [n] = await db.select().from(noiseClasses).where(eq(noiseClasses.id, (building as any).noiseClassId));
      if (n) { values.noiseClassId = n.id; }
    }
    if ((building as any).aggressivenessClassId) {
      const [a] = await db.select().from(aggressivenessClasses).where(eq(aggressivenessClasses.id, (building as any).aggressivenessClassId));
      if (a) { values.aggressivenessClassId = a.id; }
    }
    const [newBuilding] = await db.insert(buildings).values(values).returning();
    return newBuilding;
  }

  async getBuildingsByUser(userId: number): Promise<Building[]> {
    return await db
      .select({
        id: buildings.id,
        userId: buildings.userId,
        technicianId: buildings.technicianId,
        name: buildings.name,
        typologyId: buildings.typologyId,
        noiseClassId: buildings.noiseClassId,
        aggressivenessClassId: buildings.aggressivenessClassId,
        cep: buildings.cep,
        address: buildings.address,
  addressNumber: buildings.addressNumber,
        bioclimaticZone: buildings.bioclimaticZone,
        totalArea: buildings.totalArea,
  buildingHeight: buildings.buildingHeight,
        floors: buildings.floors,
        units: buildings.units,
        createdAt: buildings.createdAt,
        updatedAt: buildings.updatedAt,
        typologyCode: typologies.code,
        typologyLabel: typologies.label,
        noiseClassCode: noiseClasses.code,
        noiseClassLabel: noiseClasses.label,
        aggressivenessClassCode: aggressivenessClasses.code,
        aggressivenessClassLabel: aggressivenessClasses.label,
      })
      .from(buildings)
      .leftJoin(typologies, eq(buildings.typologyId, typologies.id))
      .leftJoin(noiseClasses, eq(buildings.noiseClassId, noiseClasses.id))
      .leftJoin(aggressivenessClasses, eq(buildings.aggressivenessClassId, aggressivenessClasses.id))
      .where(eq(buildings.userId, userId))
      .orderBy(desc(buildings.createdAt)) as any;
  }

  async getBuilding(id: number): Promise<Building | undefined> {
    const [row] = await db
      .select({
        id: buildings.id,
        userId: buildings.userId,
        technicianId: buildings.technicianId,
        name: buildings.name,
        typologyId: buildings.typologyId,
        noiseClassId: buildings.noiseClassId,
        aggressivenessClassId: buildings.aggressivenessClassId,
        cep: buildings.cep,
        address: buildings.address,
  addressNumber: buildings.addressNumber,
        bioclimaticZone: buildings.bioclimaticZone,
        totalArea: buildings.totalArea,
  buildingHeight: buildings.buildingHeight,
        floors: buildings.floors,
        units: buildings.units,
        createdAt: buildings.createdAt,
        updatedAt: buildings.updatedAt,
        typologyCode: typologies.code,
        typologyLabel: typologies.label,
        noiseClassCode: noiseClasses.code,
        noiseClassLabel: noiseClasses.label,
        aggressivenessClassCode: aggressivenessClasses.code,
        aggressivenessClassLabel: aggressivenessClasses.label,
      })
      .from(buildings)
      .leftJoin(typologies, eq(buildings.typologyId, typologies.id))
      .leftJoin(noiseClasses, eq(buildings.noiseClassId, noiseClasses.id))
      .leftJoin(aggressivenessClasses, eq(buildings.aggressivenessClassId, aggressivenessClasses.id))
      .where(eq(buildings.id, id));
    return row as any;
  }

  async updateBuilding(id: number, building: Partial<InsertBuilding>): Promise<Building> {
    const { userId: _ignoreUserId, ...rest } = building as any;
    const updates: any = { updatedAt: new Date() };
    if (rest.name != null) updates.name = rest.name;
    if (rest.technicianId !== undefined) updates.technicianId = rest.technicianId;
    if (rest.cep != null) updates.cep = rest.cep;
    if (rest.address != null) updates.address = rest.address;
  if (rest.addressNumber !== undefined) updates.addressNumber = rest.addressNumber as any;
    if (rest.bioclimaticZone != null) updates.bioclimaticZone = rest.bioclimaticZone;
    if (rest.totalArea != null) updates.totalArea = rest.totalArea;
  if (rest.buildingHeight !== undefined) updates.buildingHeight = rest.buildingHeight as any;
    if (rest.floors != null) updates.floors = rest.floors;
    if (rest.units != null) updates.units = rest.units;
    if (rest.typologyId != null) {
      const [t] = await db.select().from(typologies).where(eq(typologies.id, rest.typologyId));
      if (t) { updates.typologyId = t.id; }
    }
    if (rest.noiseClassId != null) {
      const [n] = await db.select().from(noiseClasses).where(eq(noiseClasses.id, rest.noiseClassId));
      if (n) { updates.noiseClassId = n.id; }
    }
    if (rest.aggressivenessClassId != null) {
      const [a] = await db.select().from(aggressivenessClasses).where(eq(aggressivenessClasses.id, rest.aggressivenessClassId));
      if (a) { updates.aggressivenessClassId = a.id; }
    }

    const [updatedBuilding] = await db.update(buildings).set(updates).where(eq(buildings.id, id)).returning();
    return updatedBuilding;
  }

  async deleteBuilding(id: number): Promise<boolean> {
    try {
      const deleted = await db
        .delete(buildings)
        .where(eq(buildings.id, id))
        .returning({ id: buildings.id });
      return deleted.length > 0;
    } catch (err: any) {
      if (err?.code === '23503') {
        const e = new Error('Não é possível excluir: existem registros relacionados.');
        (e as any).status = 409;
        throw e;
      }
      throw err;
    }
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
      licenseState: tech.licenseState,
      cpfCnpj: tech.cpfCnpj,
      email: tech.email,
      phone: tech.phone,
      company: tech.company,
      address: tech.address,
  addressNumber: (tech as any).addressNumber,
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

  // Master tables
  async listTypologies(): Promise<Typology[]> {
  const rows = await db.select().from(typologies);
  rows.sort((a: any, b: any) => ptCollator.compare(String(a.code ?? ''), String(b.code ?? '')));
  return rows as any;
  }
  async createTypology(item: InsertTypology): Promise<Typology> {
    const [row] = await db.insert(typologies).values({ code: (item as any).code, label: (item as any).label, isActive: (item as any).isActive ?? true }).returning();
    return row as Typology;
  }
  async updateTypology(id: number, item: Partial<InsertTypology>): Promise<Typology> {
    const [row] = await db.update(typologies).set({ ...(item as any), updatedAt: new Date() }).where(eq(typologies.id, id)).returning();
    return row as Typology;
  }
  async deleteTypology(id: number): Promise<boolean> {
    const deleted = await db.delete(typologies).where(eq(typologies.id, id)).returning({ id: typologies.id });
    return deleted.length > 0;
  }

  async listNoiseClasses(): Promise<NoiseClass[]> {
  const rows = await db.select().from(noiseClasses);
  rows.sort((a: any, b: any) => ptCollator.compare(String(a.code ?? ''), String(b.code ?? '')));
  return rows as any;
  }
  async createNoiseClass(item: InsertNoiseClass): Promise<NoiseClass> {
    const [row] = await db.insert(noiseClasses).values({ code: (item as any).code, label: (item as any).label, isActive: (item as any).isActive ?? true }).returning();
    return row as NoiseClass;
  }
  async updateNoiseClass(id: number, item: Partial<InsertNoiseClass>): Promise<NoiseClass> {
    const [row] = await db.update(noiseClasses).set({ ...(item as any), updatedAt: new Date() }).where(eq(noiseClasses.id, id)).returning();
    return row as NoiseClass;
  }
  async deleteNoiseClass(id: number): Promise<boolean> {
    const deleted = await db.delete(noiseClasses).where(eq(noiseClasses.id, id)).returning({ id: noiseClasses.id });
    return deleted.length > 0;
  }

  async listAggressivenessClasses(): Promise<AggressivenessClass[]> {
  const rows = await db.select().from(aggressivenessClasses);
  rows.sort((a: any, b: any) => ptCollator.compare(String(a.code ?? ''), String(b.code ?? '')));
  return rows as any;
  }
  async createAggressivenessClass(item: InsertAggressivenessClass): Promise<AggressivenessClass> {
    const [row] = await db.insert(aggressivenessClasses).values({ code: (item as any).code, label: (item as any).label, isActive: (item as any).isActive ?? true }).returning();
    return row as AggressivenessClass;
  }
  async updateAggressivenessClass(id: number, item: Partial<InsertAggressivenessClass>): Promise<AggressivenessClass> {
    const [row] = await db.update(aggressivenessClasses).set({ ...(item as any), updatedAt: new Date() }).where(eq(aggressivenessClasses.id, id)).returning();
    return row as AggressivenessClass;
  }
  async deleteAggressivenessClass(id: number): Promise<boolean> {
    const deleted = await db.delete(aggressivenessClasses).where(eq(aggressivenessClasses.id, id)).returning({ id: aggressivenessClasses.id });
    return deleted.length > 0;
  }

  // Bioclimatic zones
  async listBioclimaticZones(): Promise<BioclimaticZone[]> {
  const rows = await db.select().from(bioclimaticZones);
  rows.sort((a: any, b: any) => ptCollator.compare(String(a.code ?? ''), String(b.code ?? '')));
  return rows as any;
  }

  async createBioclimaticZone(item: InsertBioclimaticZone): Promise<BioclimaticZone> {
    const [row] = await db.insert(bioclimaticZones).values({
      code: (item as any).code,
      label: (item as any).label,
      isActive: (item as any).isActive ?? true,
    }).returning();
    return row as BioclimaticZone;
  }

  async updateBioclimaticZone(id: number, item: Partial<InsertBioclimaticZone>): Promise<BioclimaticZone> {
    const [row] = await db.update(bioclimaticZones)
      .set({ ...(item as any), updatedAt: new Date() })
      .where(eq(bioclimaticZones.id, id))
      .returning();
    return row as BioclimaticZone;
  }

  async deleteBioclimaticZone(id: number): Promise<boolean> {
    try {
      const deleted = await db.delete(bioclimaticZones)
        .where(eq(bioclimaticZones.id, id))
        .returning({ id: bioclimaticZones.id });
      return deleted.length > 0;
    } catch (err: any) {
      if (err?.code === '23503') {
        const e = new Error('Não é possível excluir: existem abrangências vinculadas.');
        (e as any).status = 409;
        throw e;
      }
      throw err;
    }
  }

  async listBioclimaticZoneCoverages(zoneId: number): Promise<BioclimaticZoneCoverage[]> {
    // Return enriched rows joined with cities and states for UI convenience
    const rows = await db
      .select({
        id: bioclimaticZoneCoverages.id,
        zoneId: bioclimaticZoneCoverages.zoneId,
        cityId: cities.id,
        city: cities.name,
        stateId: states.id,
        state: states.code,
      })
      .from(bioclimaticZoneCoverages)
      .leftJoin(cities, eq(bioclimaticZoneCoverages.cityId, cities.id))
      .leftJoin(states, eq(cities.stateId, states.id))
      .where(eq(bioclimaticZoneCoverages.zoneId, zoneId));
    (rows as any).sort((a: any, b: any) => ptCollator.compare(String(a.city ?? ''), String(b.city ?? '')));
    return rows as any;
  }

  async findZonesByCityName(q: string): Promise<Array<{ id: number; code: string; label: string }>> {
    const query = `%${q}%`;
    // Join coverages -> zones -> cities to find matching city names
    const rows = await db
      .select({ id: bioclimaticZones.id, code: bioclimaticZones.code, label: bioclimaticZones.label })
      .from(bioclimaticZoneCoverages)
      .leftJoin(cities, eq(bioclimaticZoneCoverages.cityId, cities.id))
      .leftJoin(bioclimaticZones, eq(bioclimaticZoneCoverages.zoneId, bioclimaticZones.id))
      .where(ilike(cities.name, query));
    // Deduplicate zones
    const map = new Map<number, { id: number; code: string; label: string }>();
    for (const r of rows as any[]) {
      if (r?.id && !map.has(r.id)) {
        map.set(r.id, { id: r.id, code: (r as any).code, label: (r as any).label });
      }
    }
    const out = Array.from(map.values());
    out.sort((a, b) => ptCollator.compare(String(a.code ?? ''), String(b.code ?? '')));
    return out;
  }

  async createBioclimaticZoneCoverage(zoneId: number, item: Omit<InsertBioclimaticZoneCoverage, 'zoneId'>): Promise<BioclimaticZoneCoverage> {
    const [row] = await db.insert(bioclimaticZoneCoverages).values({
      zoneId,
      cityId: (item as any).cityId,
    }).returning();
    return row as BioclimaticZoneCoverage;
  }

  async updateBioclimaticZoneCoverage(id: number, item: Partial<InsertBioclimaticZoneCoverage>): Promise<BioclimaticZoneCoverage> {
    const update: any = { };
  if ((item as any).cityId !== undefined) update.cityId = (item as any).cityId;

    const [row] = await db.update(bioclimaticZoneCoverages)
      .set(update)
      .where(eq(bioclimaticZoneCoverages.id, id))
      .returning();
    return row as BioclimaticZoneCoverage;
  }

  async deleteBioclimaticZoneCoverage(id: number): Promise<boolean> {
    const deleted = await db.delete(bioclimaticZoneCoverages).where(eq(bioclimaticZoneCoverages.id, id)).returning({ id: bioclimaticZoneCoverages.id });
    return deleted.length > 0;
  }

  async findBioclimaticZoneForLocation(state: string, city?: string | null): Promise<string | null> {
    const uf = (state || '').toUpperCase();
    const cityName = (city || '').trim();
    if (!uf || !cityName) return null;
    const [st] = await db.select().from(states).where(eq(states.code, uf)).limit(1);
    if (!st) return null;
    const [ci] = await db.select().from(cities).where(and(eq(cities.stateId, (st as any).id), ilike(cities.name, cityName))).limit(1);
    if (!ci) return null;
    const [cov] = await db.select({ zoneId: bioclimaticZoneCoverages.zoneId })
      .from(bioclimaticZoneCoverages)
      .where(eq(bioclimaticZoneCoverages.cityId, (ci as any).id))
      .limit(1);
    if (!cov) return null;
    const [zone] = await db.select({ code: bioclimaticZones.code }).from(bioclimaticZones).where(eq(bioclimaticZones.id, cov.zoneId)).limit(1);
    return zone?.code ?? null;
  }

  // States & Cities
  async listStates(): Promise<State[]> {
  const rows = await db.select().from(states);
  rows.sort((a: any, b: any) => ptCollator.compare(String(a.code ?? ''), String(b.code ?? '')));
  return rows as any;
  }
  async createState(item: InsertState): Promise<State> {
    const [row] = await db.insert(states).values(item as any).onConflictDoNothing().returning();
    return row as any;
  }
  async updateState(id: number, item: Partial<InsertState>): Promise<State> {
    const [row] = await db.update(states).set(item as any).where(eq(states.id, id)).returning();
    return row as any;
  }
  async deleteState(id: number): Promise<boolean> {
    const deleted = await db.delete(states).where(eq(states.id, id)).returning({ id: states.id });
    return deleted.length > 0;
  }
  async listCitiesByState(stateId: number): Promise<City[]> {
  const rows = await db.select().from(cities).where(eq(cities.stateId, stateId));
  rows.sort((a: any, b: any) => ptCollator.compare(String(a.name ?? ''), String(b.name ?? '')));
  return rows as any;
  }
  async listCities(): Promise<City[]> {
  const rows = await db.select().from(cities);
  rows.sort((a: any, b: any) => ptCollator.compare(String(a.name ?? ''), String(b.name ?? '')));
  return rows as any;
  }
  async createCity(item: InsertCity): Promise<City> {
    const [row] = await db.insert(cities).values(item as any).onConflictDoNothing().returning();
    return row as any;
  }
  async updateCity(id: number, item: Partial<InsertCity>): Promise<City> {
    const [row] = await db.update(cities).set(item as any).where(eq(cities.id, id)).returning();
    return row as any;
  }
  async deleteCity(id: number): Promise<boolean> {
    const deleted = await db.delete(cities).where(eq(cities.id, id)).returning({ id: cities.id });
    return deleted.length > 0;
  }
}

export const storage = new DatabaseStorage();

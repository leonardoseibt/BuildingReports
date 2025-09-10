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
  type ConstructiveSystem,
  type InsertConstructiveSystem,
  type Requirement,
  type InsertRequirement,
  criteria,
  type Criterion,
  type InsertCriterion,
  analyses,
  type Analysis,
  type InsertAnalysis,
  parameters,
  type Parameter,
  type InsertParameter,
  technicians,
  typologies,
  noiseClasses,
  aggressivenessClasses,
  constructiveSystems,
  requirements,
  requirementsCriteria,
  bioclimaticZones,
  bioclimaticZoneCoverages,
  isopleths,
  isoplethCoverages,
  states,
  cities,
  type BioclimaticZone,
  type InsertBioclimaticZone,
  type BioclimaticZoneCoverage,
  type InsertBioclimaticZoneCoverage,
  type Isopleth,
  type InsertIsopleth,
  type InsertIsoplethCoverage,
  type State,
  type InsertState,
  type City,
  type InsertCity,
  attributeDefinitions,
  type AttributeDefinition,
  type InsertAttributeDefinition,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, asc, isNull, sql, count } from "drizzle-orm";

// Use a single Portuguese (Brazil) collator for accent-aware, numeric-friendly sorting
const ptCollator = new Intl.Collator('pt-BR', { usage: 'sort', sensitivity: 'accent', numeric: true, ignorePunctuation: true });

export interface IStorage {
  // User operations
  getUser(id: number): Promise<PublicUser | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  ensureUserByEmail(email: string, fullName?: string, phone?: string): Promise<User>;
  createUser(user: UpsertUser): Promise<User>;
  getUserByEmail(email: string): Promise<User | undefined>;
  verifyUserByToken(token: string): Promise<User | undefined>;
  listUsers(limit?: number, offset?: number): Promise<{ items: PublicUser[]; total: number }>;
  deleteUser(id: number): Promise<boolean>;
  updateUser(id: number, data: Partial<UpsertUser>): Promise<User>;
  
  // Building operations
  createBuilding(building: InsertBuilding): Promise<Building>;
  getBuildingsByUser(userId: number, limit?: number, offset?: number): Promise<{ items: Building[]; total: number }>;
  listAllBuildings(limit?: number, offset?: number): Promise<{ items: Building[]; total: number }>;
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
  getReportsByUser(userId: number, limit?: number, offset?: number): Promise<{ items: Report[]; total: number }>;
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
  listTechnicians(userId: number, limit?: number, offset?: number): Promise<{ items: Technician[]; total: number }>;
  listAllTechnicians(limit?: number, offset?: number): Promise<{ items: Technician[]; total: number }>;
  getTechnician(id: number): Promise<Technician | undefined>;
  updateTechnician(id: number, tech: Partial<InsertTechnician>): Promise<Technician>;
  deleteTechnician(id: number): Promise<boolean>;

  // Master tables
  getTypology(id: number): Promise<Typology | undefined>;
  listTypologies(): Promise<Typology[]>;
  createTypology(item: InsertTypology): Promise<Typology>;
  updateTypology(id: number, item: Partial<InsertTypology>): Promise<Typology>;
  deleteTypology(id: number): Promise<boolean>;

  getNoiseClass(id: number): Promise<NoiseClass | undefined>;
  listNoiseClasses(): Promise<NoiseClass[]>;
  createNoiseClass(item: InsertNoiseClass): Promise<NoiseClass>;
  updateNoiseClass(id: number, item: Partial<InsertNoiseClass>): Promise<NoiseClass>;
  deleteNoiseClass(id: number): Promise<boolean>;

  getAggressivenessClass(id: number): Promise<AggressivenessClass | undefined>;
  listAggressivenessClasses(): Promise<AggressivenessClass[]>;
  createAggressivenessClass(item: InsertAggressivenessClass): Promise<AggressivenessClass>;
  updateAggressivenessClass(id: number, item: Partial<InsertAggressivenessClass>): Promise<AggressivenessClass>;
  deleteAggressivenessClass(id: number): Promise<boolean>;

  // Constructive systems
  listConstructiveSystems(): Promise<ConstructiveSystem[]>;
  createConstructiveSystem(item: InsertConstructiveSystem): Promise<ConstructiveSystem>;
  updateConstructiveSystem(id: number, item: Partial<InsertConstructiveSystem>): Promise<ConstructiveSystem>;
  deleteConstructiveSystem(id: number): Promise<boolean>;

  // Requirements
  listRequirements(): Promise<Requirement[]>;
  createRequirement(item: InsertRequirement): Promise<Requirement>;
  updateRequirement(id: number, item: Partial<InsertRequirement>): Promise<Requirement>;
  deleteRequirement(id: number): Promise<boolean>;

  // Criteria
  listCriteria(requirementId?: number): Promise<Criterion[]>;
  createCriterion(item: InsertCriterion): Promise<Criterion>;
  updateCriterion(id: number, item: Partial<InsertCriterion>): Promise<Criterion>;
  deleteCriterion(id: number): Promise<boolean>;
  linkCriterionToRequirement(requirementId: number, criterionId: number): Promise<boolean>;
  unlinkCriterionFromRequirement(requirementId: number, criterionId: number): Promise<boolean>;
  // Analyses
  listAnalyses(criterionId?: number, requirementId?: number): Promise<Analysis[]>;
  listAnalysesPaginated(params: { criterionId?: number; requirementId?: number; page: number; limit: number }): Promise<{ items: Analysis[]; total: number }>;
  getNextAnalysisCode(requirementId: number, criterionId: number): Promise<string>;
  createAnalysis(item: InsertAnalysis): Promise<Analysis>;
  updateAnalysis(id: number, item: Partial<InsertAnalysis>): Promise<Analysis>;
  deleteAnalysis(id: number): Promise<boolean>;
  // Parameters
  listParameters(analysisId?: number, criterionId?: number, requirementId?: number): Promise<Parameter[]>;
  listParametersPaginated(params: { analysisId?: number; criterionId?: number; requirementId?: number; page: number; limit: number; search?: string }): Promise<{ items: Parameter[]; total: number }>;
  createParameter(item: InsertParameter): Promise<Parameter>;
  updateParameter(id: number, item: Partial<InsertParameter>): Promise<Parameter>;
  deleteParameter(id: number): Promise<boolean>;

  // Attribute Definitions
  listAttributeDefinitions(options?: { dataKind?: string; valueSource?: string; activeOnly?: boolean }): Promise<AttributeDefinition[]>;
  createAttributeDefinition(item: InsertAttributeDefinition): Promise<AttributeDefinition>;
  updateAttributeDefinition(id: number, item: Partial<InsertAttributeDefinition>): Promise<AttributeDefinition>;
  deleteAttributeDefinition(id: number): Promise<boolean>; // soft delete -> isActive = false


  // Bioclimatic zones
  listBioclimaticZones(): Promise<BioclimaticZone[]>;
  createBioclimaticZone(item: InsertBioclimaticZone): Promise<BioclimaticZone>;
  updateBioclimaticZone(id: number, item: Partial<InsertBioclimaticZone>): Promise<BioclimaticZone>;
  deleteBioclimaticZone(id: number): Promise<boolean>;
  // Isopleths
  listIsopleths(): Promise<Isopleth[]>;
  createIsopleth(item: InsertIsopleth): Promise<Isopleth>;
  updateIsopleth(id: number, item: Partial<InsertIsopleth>): Promise<Isopleth>;
  deleteIsopleth(id: number): Promise<boolean>;
  // Isopleth coverages
  listIsoplethCoverages(isoplethId: number): Promise<any[]>;
  listIsoplethsCoveragesIndex(): Promise<{ isoplethId: number; city: string; state: string }[]>;
  createIsoplethCoverage(isoplethId: number, item: Omit<InsertIsoplethCoverage, 'isoplethId'>): Promise<any>;
  deleteIsoplethCoverage(id: number): Promise<boolean>;
  listBioclimaticZoneCoverages(zoneId: number): Promise<BioclimaticZoneCoverage[]>;
  createBioclimaticZoneCoverage(zoneId: number, item: Omit<InsertBioclimaticZoneCoverage, 'zoneId'>): Promise<BioclimaticZoneCoverage>;
  updateBioclimaticZoneCoverage(id: number, item: Partial<InsertBioclimaticZoneCoverage>): Promise<BioclimaticZoneCoverage>;
  deleteBioclimaticZoneCoverage(id: number): Promise<boolean>;
  findBioclimaticZoneForLocation(state: string, city?: string | null): Promise<string | null>;
  findIsoplethForLocation(state: string, city?: string | null): Promise<string | null>;
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
        isAdmin: users.isAdmin,
        allowedModules: users.allowedModules,
        emailVerified: users.emailVerified,
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
      .values({ email: normalizedEmail, fullName, phone, isAdmin: false, allowedModules: [] as any })
      .onConflictDoUpdate({
        target: users.email!,
        set: { fullName, phone, updatedAt: new Date() },
      })
      .returning();
    return user;
  }

  async createUser(userData: UpsertUser): Promise<User> {
    const [user] = await db.insert(users).values(userData).returning();
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email!, email));
    return user;
  }

  async verifyUserByToken(token: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ emailVerified: true, verificationToken: null, updatedAt: new Date() })
      .where(eq(users.verificationToken!, token))
      .returning();
    return user;
  }

  async listUsers(limit?: number, offset?: number): Promise<{ items: PublicUser[]; total: number }> {
    const totalRes = await db.select({ value: count() }).from(users);
    const total = Number(totalRes[0]?.value ?? 0);
    let query = db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        phone: users.phone,
        allowedModules: users.allowedModules,
        isAdmin: users.isAdmin,
        emailVerified: users.emailVerified,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt));
    if (limit !== undefined) query = (query as any).limit(limit);
    if (offset !== undefined) query = (query as any).offset(offset);
    const items = await query;
    return { items, total };
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
    // Fetch optional foreign keys in parallel. These lookups can be avoided if
    // relying solely on database FK constraints.
    const [[t], [n], [a]] = await Promise.all([
      (building as any).typologyId
        ? db
            .select()
            .from(typologies)
            .where(eq(typologies.id, (building as any).typologyId))
        : Promise.resolve<[undefined]>([undefined]),
      (building as any).noiseClassId
        ? db
            .select()
            .from(noiseClasses)
            .where(eq(noiseClasses.id, (building as any).noiseClassId))
        : Promise.resolve<[undefined]>([undefined]),
      (building as any).aggressivenessClassId
        ? db
            .select()
            .from(aggressivenessClasses)
            .where(eq(aggressivenessClasses.id, (building as any).aggressivenessClassId))
        : Promise.resolve<[undefined]>([undefined]),
    ]);

    // Build insert values after resolving lookups
    const values: any = {
      name: building.name,
      userId: building.userId,
      technicianId: (building as any).technicianId,
      cep: building.cep,
      street: (building as any).street,
      addressNumber: (building as any).addressNumber,
      neighborhood: (building as any).neighborhood,
      city: (building as any).city,
      state: (building as any).state,
      bioclimaticZone: building.bioclimaticZone,
      totalArea: building.totalArea,
      buildingHeight: (building as any).buildingHeight,
      floors: building.floors,
      units: building.units,
    };
    if (t) values.typologyId = t.id;
    if (n) values.noiseClassId = n.id;
    if (a) values.aggressivenessClassId = a.id;

    const [newBuilding] = await db.insert(buildings).values(values).returning();
    return newBuilding;
  }

  async getBuildingsByUser(userId: number, limit?: number, offset?: number): Promise<{ items: Building[]; total: number }> {
    const totalRes = await db.select({ value: count() }).from(buildings).where(eq(buildings.userId, userId));
    const total = Number(totalRes[0]?.value ?? 0);
    let query = db
      .select({
        id: buildings.id,
        userId: buildings.userId,
        technicianId: buildings.technicianId,
        name: buildings.name,
        typologyId: buildings.typologyId,
        noiseClassId: buildings.noiseClassId,
        aggressivenessClassId: buildings.aggressivenessClassId,
        cep: buildings.cep,
  street: buildings.street,
  addressNumber: buildings.addressNumber,
  neighborhood: buildings.neighborhood,
  city: buildings.city,
  state: buildings.state,
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
      .orderBy(desc(buildings.createdAt));
    if (limit !== undefined) query = (query as any).limit(limit);
    if (offset !== undefined) query = (query as any).offset(offset);
    const items = await query as any;
    return { items, total };
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
  street: buildings.street,
  addressNumber: buildings.addressNumber,
  neighborhood: buildings.neighborhood,
  city: buildings.city,
  state: buildings.state,
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
  if (rest.street != null) updates.street = rest.street;
  // Support legacy payloads carrying "address" but not street
  if (rest.addressNumber !== undefined) updates.addressNumber = rest.addressNumber as any;
  if (rest.neighborhood !== undefined) updates.neighborhood = rest.neighborhood as any;
  if (rest.city !== undefined) updates.city = rest.city as any;
  if (rest.state !== undefined) updates.state = rest.state as any;
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
    // Guard: block deletion if dependent records exist (systems, evaluations, reports)
    try {
      return await db.transaction(async (tx) => {
        // Only check dependent entities that are actually implemented / have tables.
        const depCounts = await Promise.all([
          tx.select({ value: count() }).from(performanceEvaluations).where(eq(performanceEvaluations.buildingId, id)),
          tx.select({ value: count() }).from(reports).where(eq(reports.buildingId, id)),
        ]);
        const [evalC, reportsC] = depCounts.map(r => Number(r[0]?.value ?? 0));
        const total = evalC + reportsC;
        if (total > 0) {
          const parts: string[] = [];
          if (evalC) parts.push(`${evalC} avaliação(ões)`);
          if (reportsC) parts.push(`${reportsC} relatório(s)`);
          const e: any = new Error(`Não é possível excluir: existem ${parts.join(', ')} vinculados à edificação.`);
          e.status = 409;
          throw e;
        }
        const deleted = await tx.delete(buildings).where(eq(buildings.id, id)).returning({ id: buildings.id });
        return deleted.length > 0;
      });
    } catch (err: any) {
      if (err?.status === 409) throw err;
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

  async getReportsByUser(userId: number, limit?: number, offset?: number): Promise<{ items: Report[]; total: number }> {
    const totalRes = await db
      .select({ value: count() })
      .from(reports)
      .leftJoin(buildings, eq(reports.buildingId, buildings.id))
      .where(and(eq(buildings.userId, userId), eq(reports.isActive, true)));
    const total = Number(totalRes[0]?.value ?? 0);
    let query = db
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
    if (limit !== undefined) query = (query as any).limit(limit);
    if (offset !== undefined) query = (query as any).offset(offset);
    const items = await query;
    return { items, total };
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
    const { items: userBuildings } = await this.getBuildingsByUser(userId);
    const { items: userReports } = await this.getReportsByUser(userId);

    // Pending evaluations: buildings with no evaluation or last evaluation status = 'pending'
    const pendingRow = await db.execute(sql`WITH last_eval AS (
      SELECT DISTINCT ON (pe.building_id)
             pe.building_id,
             pe.status,
             pe.created_at
      FROM performance_evaluations pe
      ORDER BY pe.building_id, pe.created_at DESC
    )
    SELECT COUNT(b.*)::int AS cnt
    FROM buildings b
    LEFT JOIN last_eval le ON le.building_id = b.id
    WHERE b.user_id = ${userId} AND (le.status IS NULL OR le.status = 'pending')`);
    const pendingEvaluations = Number(((pendingRow as any).rows ?? [])[0]?.cnt ?? 0);

    const recentBuildings = userBuildings.slice(0, 5);

    return {
      totalBuildings: userBuildings.length,
      totalReports: userReports.length,
      pendingEvaluations,
      recentBuildings,
    };
  }

  async listAllBuildings(limit?: number, offset?: number): Promise<{ items: Building[]; total: number }> {
    const totalRes = await db.select({ value: count() }).from(buildings);
    const total = Number(totalRes[0]?.value ?? 0);
    let query = db
      .select({
        id: buildings.id,
        userId: buildings.userId,
        technicianId: buildings.technicianId,
        name: buildings.name,
        typologyId: buildings.typologyId,
        noiseClassId: buildings.noiseClassId,
        aggressivenessClassId: buildings.aggressivenessClassId,
        cep: buildings.cep,
        street: buildings.street,
        addressNumber: buildings.addressNumber,
        neighborhood: buildings.neighborhood,
        city: buildings.city,
        state: buildings.state,
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
      .orderBy(desc(buildings.createdAt));
    if (limit !== undefined) query = (query as any).limit(limit);
    if (offset !== undefined) query = (query as any).offset(offset);
    const items = await query as any;
    return { items, total };
  }

  // Extended dashboard statistics (aggregations & distributions)
  async getUserExtendedStats(userId: number): Promise<any> {
    // Basic counts reuse existing helper to avoid duplication
    const base = await this.getUserStats(userId);

    // Buildings created & reports generated last 30 days
    const [{ value: buildingsLast30 } = { value: 0 }] = await db
      .select({ value: count() })
      .from(buildings)
      .where(and(eq(buildings.userId, userId), sql`created_at >= now() - interval '30 days'`));
    const [{ value: reportsLast30 } = { value: 0 }] = await db
      .select({ value: count() })
      .from(reports)
      .leftJoin(buildings, eq(reports.buildingId, buildings.id))
      .where(and(eq(buildings.userId, userId), sql`reports.generated_at >= now() - interval '30 days'`));

    // Distribution by typology
    const typologyRows = await db.execute(sql`SELECT b.typology_id as "typologyId", t.code, t.label, COUNT(*)::int as count
      FROM buildings b
      LEFT JOIN typologies t ON t.id = b.typology_id
      WHERE b.user_id = ${userId}
      GROUP BY b.typology_id, t.code, t.label
      ORDER BY count DESC NULLS LAST`);

    // Distribution by noise & aggressiveness classes
    const noiseRows = await db.execute(sql`SELECT b.noise_class_id as "noiseClassId", n.code, n.label, COUNT(*)::int as count
      FROM buildings b
      LEFT JOIN noise_classes n ON n.id = b.noise_class_id
      WHERE b.user_id = ${userId}
      GROUP BY b.noise_class_id, n.code, n.label
      ORDER BY count DESC NULLS LAST`);
    const aggressRows = await db.execute(sql`SELECT b.aggressiveness_class_id as "aggressivenessClassId", a.code, a.label, COUNT(*)::int as count
      FROM buildings b
      LEFT JOIN aggressiveness_classes a ON a.id = b.aggressiveness_class_id
      WHERE b.user_id = ${userId}
      GROUP BY b.aggressiveness_class_id, a.code, a.label
      ORDER BY count DESC NULLS LAST`);

    // Weekly activity (last 8 weeks including current)
    const weekly = await db.execute(sql`WITH weeks AS (
        SELECT generate_series(date_trunc('week', now()) - interval '7 weeks', date_trunc('week', now()), interval '1 week') AS week_start
      ),
      b AS (
        SELECT date_trunc('week', created_at) wk, count(*) cnt
        FROM buildings
        WHERE user_id = ${userId}
        GROUP BY 1
      ),
      r AS (
        SELECT date_trunc('week', reports.generated_at) wk, count(*) cnt
        FROM reports
        JOIN buildings b2 ON b2.id = reports.building_id
        WHERE b2.user_id = ${userId} AND reports.is_active = true
        GROUP BY 1
      )
      SELECT to_char(w.week_start, 'IYYY-IW') as label,
             COALESCE(b.cnt,0)::int AS buildings,
             COALESCE(r.cnt,0)::int AS reports
      FROM weeks w
      LEFT JOIN b ON b.wk = w.week_start
      LEFT JOIN r ON r.wk = w.week_start
      ORDER BY w.week_start;`);

    // Data quality / alerts
    const [{ value: incompleteBuildings } = { value: 0 }] = await db
      .select({ value: count() })
      .from(buildings)
      .where(and(eq(buildings.userId, userId), sql`(technician_id IS NULL OR total_area <= 0 OR bioclimatic_zone IS NULL)`));
    const [{ value: buildingsWithoutEvaluation } = { value: 0 }] = await db
      .select({ value: count() })
      .from(buildings)
      .leftJoin(performanceEvaluations, eq(performanceEvaluations.buildingId, buildings.id))
      .where(and(eq(buildings.userId, userId), isNull(performanceEvaluations.id)));

    const typologyArr = (typologyRows as any).rows ?? (typologyRows as any);
    const noiseArr = (noiseRows as any).rows ?? (noiseRows as any);
    const aggressArr = (aggressRows as any).rows ?? (aggressRows as any);
    const weeklyArr = (weekly as any).rows ?? (weekly as any);

    // Technician ranking (top 5 by number of buildings)
    const techRankRows = await db.execute(sql`SELECT b.technician_id as "technicianId", t.full_name as name, COUNT(*)::int as count
      FROM buildings b
      LEFT JOIN technicians t ON t.id = b.technician_id
      WHERE b.user_id = ${userId} AND b.technician_id IS NOT NULL
      GROUP BY b.technician_id, t.full_name
      ORDER BY count DESC
      LIMIT 5`);
    const techRankArr = (techRankRows as any).rows ?? (techRankRows as any);

    // Forecast for current month (reports)
  const forecastRow = await db.execute(sql`WITH today AS (
    SELECT date_trunc('month', now()) AS month_start,
         (EXTRACT(EPOCH FROM (date_trunc('day', now()) - date_trunc('month', now()))) / 86400)::int + 1 AS days_so_far,
         date_trunc('month', now()) + interval '1 month' - interval '1 day' AS month_end
      ), counts AS (
        SELECT COUNT(r.*)::int AS total_so_far
        FROM reports r
        JOIN buildings b ON b.id = r.building_id
        WHERE b.user_id = ${userId} AND r.generated_at >= (SELECT month_start FROM today)
          AND r.generated_at < date_trunc('month', now()) + interval '1 month'
      )
      SELECT total_so_far, days_so_far, extract(day from month_end)::int AS days_in_month
      FROM today CROSS JOIN counts;`);
    const fRow = ((forecastRow as any).rows ?? [])[0];
    let forecast: any = null;
    if (fRow) {
      const totalSoFar = Number(fRow.total_so_far || 0);
      const daysSoFar = Number(fRow.days_so_far || 1);
      const daysInMonth = Number(fRow.days_in_month || daysSoFar);
      const avgPerDay = totalSoFar / daysSoFar;
      const projected = Math.round(avgPerDay * daysInMonth);
      forecast = {
        reportsCurrentMonth: totalSoFar,
        daysSoFar,
        daysInMonth,
        averagePerDay: Number(avgPerDay.toFixed(2)),
        projectedTotal: projected,
        progressPercent: daysInMonth ? Math.min(100, Math.round((totalSoFar / projected) * 100)) : 0,
      };
    }

    // Average report lead time (building creation -> report generated)
    const leadTimeRows = await db.execute(sql`SELECT AVG(EXTRACT(EPOCH FROM (r.generated_at - b.created_at))/3600)::numeric(10,2) AS hours
      FROM reports r JOIN buildings b ON b.id = r.building_id
      WHERE b.user_id = ${userId}`);
    const avgLeadTimeHours = Number(((leadTimeRows as any).rows ?? [])[0]?.hours ?? 0);

    // Distribution by state (UF)
    const stateRows = await db.execute(sql`SELECT b.state, COUNT(*)::int as count
      FROM buildings b
      WHERE b.user_id = ${userId} AND b.state IS NOT NULL
      GROUP BY b.state
      ORDER BY count DESC`);
    const stateArr = (stateRows as any).rows ?? (stateRows as any);
    const totalStateCount = stateArr.reduce((acc: number, r: any) => acc + Number(r.count || 0), 0) || 1;

    return {
      ...base,
      buildingsLast30: Number(buildingsLast30 || 0),
      reportsLast30: Number(reportsLast30 || 0),
      distributions: {
        typologies: typologyArr.map((r: any) => ({ ...r })),
        noiseClasses: noiseArr.map((r: any) => ({ ...r })),
        aggressivenessClasses: aggressArr.map((r: any) => ({ ...r })),
        states: stateArr.map((r: any) => ({ ...r, percent: Number(((r.count || 0) / totalStateCount * 100).toFixed(1)) })),
      },
      weeklyActivity: weeklyArr.map((r: any) => ({ ...r })),
      alerts: {
        incompleteBuildings: Number(incompleteBuildings || 0),
        buildingsWithoutEvaluation: Number(buildingsWithoutEvaluation || 0),
        pendingEvaluations: base.pendingEvaluations,
      },
      technicians: techRankArr.map((r: any) => ({ ...r })),
      forecast,
      avgReportLeadTimeHours: avgLeadTimeHours,
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
      street: (tech as any).street,
      addressNumber: (tech as any).addressNumber,
      neighborhood: (tech as any).neighborhood,
      city: tech.city,
      state: tech.state,
      cep: tech.cep,
      notes: tech.notes,
    }).returning();
    return row;
  }

  async listTechnicians(userId: number, limit?: number, offset?: number): Promise<{ items: Technician[]; total: number }> {
    const totalRes = await db
      .select({ value: count() })
      .from(technicians)
      .where(eq(technicians.userId, userId));
    const total = Number(totalRes[0]?.value ?? 0);
    let query = db
      .select()
      .from(technicians)
      .where(eq(technicians.userId, userId))
      .orderBy(desc(technicians.createdAt));
    if (limit !== undefined) query = (query as any).limit(limit);
    if (offset !== undefined) query = (query as any).offset(offset);
    const items = await query;
    return { items, total };
  }

  async getTechnician(id: number): Promise<Technician | undefined> {
    const [row] = await db.select().from(technicians).where(eq(technicians.id, id));
    return row;
  }

  async updateTechnician(id: number, tech: Partial<InsertTechnician>): Promise<Technician> {
    const updateData: any = { updatedAt: new Date() };
    const allowed = ['fullName','creaCau','licenseState','cpfCnpj','email','phone','company','street','addressNumber','neighborhood','city','state','cep','notes'];
    for (const k of allowed) {
      if ((tech as any)[k] !== undefined) updateData[k] = (tech as any)[k];
    }
    const [row] = await db
      .update(technicians)
      .set(updateData)
      .where(eq(technicians.id, id))
      .returning();
    return row as Technician;
  }

  async deleteTechnician(id: number): Promise<boolean> {
    try {
      return await db.transaction(async (tx) => {
        const countRes = await tx.select({ value: count() }).from(buildings).where(eq(buildings.technicianId, id));
        const c = Number(countRes[0]?.value ?? 0);
        if (c > 0) {
          const e: any = new Error(`Não é possível excluir: existem ${c} edificação(ões) vinculadas a este responsável técnico.`);
            e.status = 409;
          throw e;
        }
        const deleted = await tx.delete(technicians).where(eq(technicians.id, id)).returning({ id: technicians.id });
        return deleted.length > 0;
      });
    } catch (err: any) {
      if (err?.status === 409) throw err;
      if (err?.code === '23503') { const e: any = new Error('Não é possível excluir: existem registros relacionados.'); e.status = 409; throw e; }
      throw err;
    }
  }

  // Master tables
  async getTypology(id: number): Promise<Typology | undefined> {
    const [row] = await db.select().from(typologies).where(eq(typologies.id, id)).limit(1);
    return row as any;
  }
  async listTypologies(): Promise<Typology[]> {
    const rows = await db
      .select()
      .from(typologies)
      .orderBy(
        sql`length(${typologies.code})`,
        sql`${typologies.code} collate "pt-BR-x-icu"`
      );
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
    // Guard: prevent deletion if buildings reference this typology
    try {
      return await db.transaction(async (tx) => {
        const countRes = await tx.select({ value: count() }).from(buildings).where(eq(buildings.typologyId, id));
        const c = Number(countRes[0]?.value ?? 0);
        if (c > 0) {
          const e: any = new Error(`Não é possível excluir: existem ${c} edificação(ões) vinculadas a este tipo de uso.`);
          e.status = 409;
          throw e;
        }
        const deleted = await tx.delete(typologies).where(eq(typologies.id, id)).returning({ id: typologies.id });
        return deleted.length > 0;
      });
    } catch (err: any) {
      if (err?.status === 409) throw err;
      if (err?.code === '23503') { const e: any = new Error('Não é possível excluir: existem registros relacionados.'); e.status = 409; throw e; }
      throw err;
    }
  }

  async getNoiseClass(id: number): Promise<NoiseClass | undefined> {
    const [row] = await db.select().from(noiseClasses).where(eq(noiseClasses.id, id)).limit(1);
    return row as any;
  }
  async listNoiseClasses(): Promise<NoiseClass[]> {
    const rows = await db
      .select()
      .from(noiseClasses)
      .orderBy(
        sql`length(${noiseClasses.code})`,
        sql`${noiseClasses.code} collate "pt-BR-x-icu"`
      );
    return rows as any;
  }
  async createNoiseClass(item: InsertNoiseClass): Promise<NoiseClass> {
    const [row] = await db
      .insert(noiseClasses)
      .values({
        code: (item as any).code,
        label: (item as any).label,
        minDb: (item as any).minDb ?? 0,
        maxDb: (item as any).maxDb ?? null,
        isActive: (item as any).isActive ?? true,
      })
      .returning();
    return row as NoiseClass;
  }
  async updateNoiseClass(id: number, item: Partial<InsertNoiseClass>): Promise<NoiseClass> {
    const [row] = await db.update(noiseClasses).set({ ...(item as any), updatedAt: new Date() }).where(eq(noiseClasses.id, id)).returning();
    return row as NoiseClass;
  }
  async deleteNoiseClass(id: number): Promise<boolean> {
    try {
      return await db.transaction(async (tx) => {
        const countRes = await tx.select({ value: count() }).from(buildings).where(eq(buildings.noiseClassId, id));
        const c = Number(countRes[0]?.value ?? 0);
        if (c > 0) {
          const e: any = new Error(`Não é possível excluir: existem ${c} edificação(ões) vinculadas a esta classe de ruído.`);
          e.status = 409;
          throw e;
        }
        const deleted = await tx.delete(noiseClasses).where(eq(noiseClasses.id, id)).returning({ id: noiseClasses.id });
        return deleted.length > 0;
      });
    } catch (err: any) {
      if (err?.status === 409) throw err;
      if (err?.code === '23503') { const e: any = new Error('Não é possível excluir: existem registros relacionados.'); e.status = 409; throw e; }
      throw err;
    }
  }

  async getAggressivenessClass(id: number): Promise<AggressivenessClass | undefined> {
    const [row] = await db.select().from(aggressivenessClasses).where(eq(aggressivenessClasses.id, id)).limit(1);
    return row as any;
  }
  async listAggressivenessClasses(): Promise<AggressivenessClass[]> {
    const rows = await db
      .select()
      .from(aggressivenessClasses)
      .orderBy(
        sql`length(${aggressivenessClasses.code})`,
        sql`${aggressivenessClasses.code} collate "pt-BR-x-icu"`
      );
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
    try {
      return await db.transaction(async (tx) => {
        const countRes = await tx.select({ value: count() }).from(buildings).where(eq(buildings.aggressivenessClassId, id));
        const c = Number(countRes[0]?.value ?? 0);
        if (c > 0) {
          const e: any = new Error(`Não é possível excluir: existem ${c} edificação(ões) vinculadas a esta classe de agressividade.`);
          e.status = 409;
          throw e;
        }
        const deleted = await tx.delete(aggressivenessClasses).where(eq(aggressivenessClasses.id, id)).returning({ id: aggressivenessClasses.id });
        return deleted.length > 0;
      });
    } catch (err: any) {
      if (err?.status === 409) throw err;
      if (err?.code === '23503') { const e: any = new Error('Não é possível excluir: existem registros relacionados.'); e.status = 409; throw e; }
      throw err;
    }
  }

  // Constructive systems
  async listConstructiveSystems(): Promise<ConstructiveSystem[]> {
    const rows = await db
      .select()
      .from(constructiveSystems)
      .orderBy(
        sql`length(${constructiveSystems.code})`,
        sql`${constructiveSystems.code} collate "pt-BR-x-icu"`
      );
    return rows as any;
  }
  async createConstructiveSystem(item: InsertConstructiveSystem): Promise<ConstructiveSystem> {
    const [row] = await db.insert(constructiveSystems).values({ code: (item as any).code, label: (item as any).label, isActive: (item as any).isActive ?? true }).returning();
    return row as ConstructiveSystem;
  }
  async updateConstructiveSystem(id: number, item: Partial<InsertConstructiveSystem>): Promise<ConstructiveSystem> {
    const [row] = await db.update(constructiveSystems).set({ ...(item as any), updatedAt: new Date() }).where(eq(constructiveSystems.id, id)).returning();
    return row as ConstructiveSystem;
  }
  async deleteConstructiveSystem(id: number): Promise<boolean> {
    const deleted = await db.delete(constructiveSystems).where(eq(constructiveSystems.id, id)).returning({ id: constructiveSystems.id });
    return deleted.length > 0;
  }

  // Requirements
  async listRequirements(): Promise<Requirement[]> {
    const rows = await db
      .select()
      .from(requirements)
      .orderBy(
        sql`length(${requirements.code})`,
        sql`${requirements.code} collate "pt-BR-x-icu"`
      );
    return rows as any;
  }
  async createRequirement(item: InsertRequirement): Promise<Requirement> {
    const [row] = await db.insert(requirements).values({ code: (item as any).code, label: (item as any).label, isActive: (item as any).isActive ?? true }).returning();
    return row as Requirement;
  }
  async updateRequirement(id: number, item: Partial<InsertRequirement>): Promise<Requirement> {
    const [row] = await db.update(requirements).set({ ...(item as any), updatedAt: new Date() }).where(eq(requirements.id, id)).returning();
    return row as Requirement;
  }
  async deleteRequirement(id: number): Promise<boolean> {
    const deleted = await db.delete(requirements).where(eq(requirements.id, id)).returning({ id: requirements.id });
    return deleted.length > 0;
  }

  // Criteria
  async listCriteria(requirementId?: number): Promise<Criterion[]> {
    if (requirementId) {
      const rows = await db
        .select({
          id: criteria.id,
          code: criteria.code,
          label: criteria.label,
          isActive: criteria.isActive,
          createdAt: criteria.createdAt,
          updatedAt: criteria.updatedAt,
        })
        .from(criteria)
        .innerJoin(requirementsCriteria, eq(criteria.id, requirementsCriteria.criterionId))
        .where(eq(requirementsCriteria.requirementId, requirementId))
        .orderBy(sql`length(${criteria.code})`, sql`${criteria.code} collate "pt-BR-x-icu"`);
      return rows as any;
    }
    const rows = await db
      .select()
      .from(criteria)
      .orderBy(sql`length(${criteria.code})`, sql`${criteria.code} collate "pt-BR-x-icu"`);
    return rows as any;
  }
  async createCriterion(item: InsertCriterion): Promise<Criterion> {
    const [row] = await db.insert(criteria).values({ code: (item as any).code, label: (item as any).label, isActive: (item as any).isActive ?? true }).returning();
    return row as Criterion;
  }
  async updateCriterion(id: number, item: Partial<InsertCriterion>): Promise<Criterion> {
    const [row] = await db.update(criteria).set({ ...(item as any), updatedAt: new Date() }).where(eq(criteria.id, id)).returning();
    return row as Criterion;
  }
  async linkCriterionToRequirement(requirementId: number, criterionId: number): Promise<boolean> {
    await db.insert(requirementsCriteria).values({ requirementId, criterionId }).onConflictDoNothing();
    return true;
  }
  async unlinkCriterionFromRequirement(requirementId: number, criterionId: number): Promise<boolean> {
    const deleted = await db.delete(requirementsCriteria).where(and(eq(requirementsCriteria.requirementId, requirementId), eq(requirementsCriteria.criterionId, criterionId))).returning({ requirementId: requirementsCriteria.requirementId });
    return deleted.length > 0;
  }
  async deleteCriterion(id: number): Promise<boolean> {
    // App-level guard to avoid deleting a Criterion still referenced by Analyses / Parameters
    try {
      return await db.transaction(async (tx) => {
        const analysisCountRes = await tx
          .select({ value: count() })
          .from(analyses)
          .where(eq(analyses.criterionId, id));
        const analysisCount = Number(analysisCountRes[0]?.value ?? 0);

        let paramCount = 0;
        if (analysisCount > 0) {
          const paramCountRes = await tx
            .select({ value: count() })
            .from(parameters)
            .innerJoin(analyses, eq(parameters.analysisId, analyses.id))
            .where(eq(analyses.criterionId, id));
          paramCount = Number(paramCountRes[0]?.value ?? 0);
        }

        if (analysisCount > 0 || paramCount > 0) {
          const e: any = new Error(
            `Não é possível excluir: existem ${analysisCount} análise(s) e ${paramCount} parâmetro(s) vinculados ao critério.`
          );
            e.status = 409;
          throw e;
        }

        const deleted = await tx
          .delete(criteria)
          .where(eq(criteria.id, id))
          .returning({ id: criteria.id });
        return deleted.length > 0;
      });
    } catch (err: any) {
      if (err?.status === 409) throw err;
      if (err?.code === '23503') {
        const e: any = new Error('Não é possível excluir: existem registros relacionados.');
        e.status = 409;
        throw e;
      }
      throw err;
    }
  }

  // Analyses
  async listAnalyses(criterionId?: number, requirementId?: number): Promise<Analysis[]> {
  let q: any = db.select().from(analyses);
  const conditions: any[] = [];
  if (criterionId) conditions.push(eq(analyses.criterionId, criterionId));
  if (requirementId) conditions.push(eq(analyses.requirementId, requirementId));
  if (conditions.length === 1) q = q.where(conditions[0]);
  else if (conditions.length > 1) q = q.where(and(...conditions));
    const rows = await q.orderBy(sql`length(${analyses.code})`, sql`${analyses.code} collate "pt-BR-x-icu"`);
    return rows as any;
  }
  async listAnalysesPaginated(params: { criterionId?: number; requirementId?: number; page: number; limit: number }): Promise<{ items: Analysis[]; total: number }> {
    const { criterionId, requirementId, page, limit } = params;
    const conditions: any[] = [];
    if (criterionId) conditions.push(eq(analyses.criterionId, criterionId));
    if (requirementId) conditions.push(eq(analyses.requirementId, requirementId));
    let base: any = db.select().from(analyses);
    if (conditions.length === 1) base = base.where(conditions[0]);
    else if (conditions.length > 1) base = base.where(and(...conditions));
    const totalRes = await base.clone().clearOrder().select({ value: count() });
    const total = Number(totalRes[0]?.value ?? 0);
    const offset = (page - 1) * limit;
    const items = await base
      .orderBy(sql`length(${analyses.code})`, sql`${analyses.code} collate "pt-BR-x-icu"`)
      .limit(limit)
      .offset(offset);
    return { items: items as any, total };
  }
  async getNextAnalysisCode(requirementId: number, criterionId: number): Promise<string> {
    const [req] = await db
      .select({ code: requirements.code })
      .from(requirements)
      .where(eq(requirements.id, requirementId));
    const [crit] = await db
      .select({ code: criteria.code })
      .from(criteria)
      .where(eq(criteria.id, criterionId));
    if (!req || !crit) throw new Error('Invalid requirement or criterion');

    const prefix = `${req.code}.${crit.code}`;
    const [last] = await db
      .select({ code: analyses.code })
      .from(analyses)
      .where(and(eq(analyses.requirementId, requirementId), eq(analyses.criterionId, criterionId)))
      .orderBy(desc(analyses.code))
      .limit(1);
    let seq = 1;
    if (last?.code) {
      const parts = String(last.code).split('.');
      const n = Number(parts[2]);
      if (Number.isFinite(n)) seq = n + 1;
    }
    return `${prefix}.${String(seq).padStart(3, '0')}`;
  }
  async createAnalysis(item: InsertAnalysis): Promise<Analysis> {
    return db.transaction(async (tx) => {
      const [req] = await tx
        .select({ code: requirements.code })
        .from(requirements)
        .where(eq(requirements.id, (item as any).requirementId));
      const [crit] = await tx
        .select({ code: criteria.code })
        .from(criteria)
        .where(eq(criteria.id, (item as any).criterionId));
      if (!req || !crit) throw new Error('Invalid requirement or criterion');

      const prefix = `${req.code}.${crit.code}`;
      const [last] = await tx
        .select({ code: analyses.code })
        .from(analyses)
        .where(and(eq(analyses.requirementId, (item as any).requirementId), eq(analyses.criterionId, (item as any).criterionId)))
        .orderBy(desc(analyses.code))
        .limit(1);
      let seq = 1;
      if (last?.code) {
        const parts = String(last.code).split('.');
        const n = Number(parts[2]);
        if (Number.isFinite(n)) seq = n + 1;
      }
      const code = `${prefix}.${String(seq).padStart(3, '0')}`;

      const [row] = await tx
        .insert(analyses)
        .values({
          requirementId: (item as any).requirementId,
          criterionId: (item as any).criterionId,
          code,
          label: (item as any).label,
          isActive: (item as any).isActive ?? true,
        })
        .returning();
      return row as Analysis;
    });
  }
  async updateAnalysis(id: number, item: Partial<InsertAnalysis>): Promise<Analysis> {
    return db.transaction(async (tx) => {
      const [existing] = await tx.select().from(analyses).where(eq(analyses.id, id));
      if (!existing) throw new Error('Analysis not found');

      const requirementId = (item as any).requirementId ?? existing.requirementId;
      const criterionId = (item as any).criterionId ?? existing.criterionId;
      let code = existing.code;
      if (
        (item as any).requirementId && (item as any).requirementId !== existing.requirementId ||
        (item as any).criterionId && (item as any).criterionId !== existing.criterionId
      ) {
        code = await this.getNextAnalysisCode(requirementId, criterionId);
      }
      const [row] = await tx
        .update(analyses)
        .set({ ...(item as any), requirementId, criterionId, code, updatedAt: new Date() })
        .where(eq(analyses.id, id))
        .returning();
      return row as Analysis;
    });
  }
  async deleteAnalysis(id: number): Promise<boolean> {
    // Guard: block deletion if parameters exist for this analysis
    try {
      return await db.transaction(async (tx) => {
        const paramCountRes = await tx.select({ value: count() }).from(parameters).where(eq(parameters.analysisId, id));
        const paramCount = Number(paramCountRes[0]?.value ?? 0);
        if (paramCount > 0) {
          const e: any = new Error(`Não é possível excluir: existem ${paramCount} parâmetro(s) vinculados a esta análise.`);
          e.status = 409;
          throw e;
        }
        const deleted = await tx.delete(analyses).where(eq(analyses.id, id)).returning({ id: analyses.id });
        return deleted.length > 0;
      });
    } catch (err: any) {
      if (err?.status === 409) throw err;
      if (err?.code === '23503') { const e: any = new Error('Não é possível excluir: existem registros relacionados.'); e.status = 409; throw e; }
      throw err;
    }
  }

  // Parameters
  async listParameters(analysisId?: number, criterionId?: number, requirementId?: number): Promise<Parameter[]> {
    // Join sempre para permitir múltiplos filtros (analysisId / criterionId / requirementId)
    const conditions: any[] = [];
    if (analysisId) conditions.push(eq(parameters.analysisId, analysisId));
    if (criterionId) conditions.push(eq(analyses.criterionId, criterionId));
    if (requirementId) conditions.push(eq(analyses.requirementId, requirementId));

    const selectShape = {
      id: parameters.id,
      analysisId: parameters.analysisId,
      label: parameters.label,
      minimumValue: parameters.minimumValue,
      intermediateValue: parameters.intermediateValue,
      superiorValue: parameters.superiorValue,
      minLimit: parameters.minLimit,
      maxLimit: parameters.maxLimit,
      unit: parameters.unit,
      notes: parameters.notes,
      attributeId: parameters.attributeId,
      attributeValueId: parameters.attributeValueId,
      isActive: parameters.isActive,
      createdAt: parameters.createdAt,
      updatedAt: parameters.updatedAt,
      _analysisRequirementId: analyses.requirementId,
      _analysisCriterionId: analyses.criterionId,
    } as const;

    let q: any = db.select(selectShape).from(parameters).innerJoin(analyses, eq(parameters.analysisId, analyses.id));
    if (conditions.length === 1) q = q.where(conditions[0]);
    else if (conditions.length > 1) q = q.where(and(...conditions));
    const rows = await q.orderBy(sql`${parameters.label} collate "pt-BR-x-icu"`);
    return rows as any;
  }
  async listParametersPaginated(params: { analysisId?: number; criterionId?: number; requirementId?: number; page: number; limit: number; search?: string }): Promise<{ items: Parameter[]; total: number }> {
    const { analysisId, criterionId, requirementId, page, limit, search } = params;
    const selectShape = {
      id: parameters.id,
      analysisId: parameters.analysisId,
      label: parameters.label,
      minimumValue: parameters.minimumValue,
      intermediateValue: parameters.intermediateValue,
      superiorValue: parameters.superiorValue,
      minLimit: parameters.minLimit,
      maxLimit: parameters.maxLimit,
      unit: parameters.unit,
      notes: parameters.notes,
      attributeId: parameters.attributeId,
      attributeValueId: parameters.attributeValueId,
      isActive: parameters.isActive,
      createdAt: parameters.createdAt,
      updatedAt: parameters.updatedAt,
      _analysisRequirementId: analyses.requirementId,
      _analysisCriterionId: analyses.criterionId,
    } as const;
    const conditions: any[] = [];
    if (analysisId) conditions.push(eq(parameters.analysisId, analysisId));
    if (criterionId) conditions.push(eq(analyses.criterionId, criterionId));
    if (requirementId) conditions.push(eq(analyses.requirementId, requirementId));
    if (search) {
      conditions.push(sql`${parameters.label} ILIKE ${'%' + search + '%'}`);
    }
    let base: any = db
      .select(selectShape)
      .from(parameters)
      .innerJoin(analyses, eq(parameters.analysisId, analyses.id));
    if (conditions.length === 1) base = base.where(conditions[0]);
    else if (conditions.length > 1) base = base.where(and(...conditions));
    const totalRes = await base.clone().clearOrder().select({ value: count() });
    const total = Number(totalRes[0]?.value ?? 0);
    const offset = (page - 1) * limit;
    const items = await base
      .orderBy(sql`${parameters.label} collate "pt-BR-x-icu"`)
      .limit(limit)
      .offset(offset);
    return { items: items as any, total };
  }

  async listAllTechnicians(limit?: number, offset?: number): Promise<{ items: Technician[]; total: number }> {
    const totalRes = await db
      .select({ value: count() })
      .from(technicians);
    const total = Number(totalRes[0]?.value ?? 0);
    let query = db
      .select()
      .from(technicians)
      .orderBy(desc(technicians.createdAt));
    if (limit !== undefined) query = (query as any).limit(limit);
    if (offset !== undefined) query = (query as any).offset(offset);
    const items = await query;
    return { items, total };
  }
  async createParameter(item: InsertParameter): Promise<Parameter> {
    const [row] = await db.insert(parameters).values({
      analysisId: (item as any).analysisId,
      label: (item as any).label,
      minimumValue: (item as any).minimumValue ?? null,
      intermediateValue: (item as any).intermediateValue ?? null,
      superiorValue: (item as any).superiorValue ?? null,
      minLimit: (item as any).minLimit ?? null,
      maxLimit: (item as any).maxLimit ?? null,
      unit: (item as any).unit ?? null,
      notes: (item as any).notes ?? null,
      attributeId: (item as any).attributeId ?? null,
      attributeValueId: (item as any).attributeValueId ?? null,
      isActive: (item as any).isActive ?? true,
    }).returning();
    return row as Parameter;
  }
  async updateParameter(id: number, item: Partial<InsertParameter>): Promise<Parameter> {
    const updateData: any = { updatedAt: new Date() };
    // Apenas inclui campos presentes; permite enviar null para limpar
    const keys: (keyof InsertParameter | 'isActive')[] = [
      'analysisId','label','minimumValue','intermediateValue','superiorValue',
      'minLimit','maxLimit','unit','notes','attributeId','attributeValueId','isActive'
    ] as any;
    for (const k of keys) {
      if (k in item) {
        (updateData as any)[k] = (item as any)[k];
      }
    }
    // Evita setar analysisId como undefined (NOT NULL)
    if (updateData.analysisId === undefined) delete updateData.analysisId;
    try {
      const [row] = await db.update(parameters).set(updateData).where(eq(parameters.id, id)).returning();
      return row as Parameter;
    } catch (err) {
      console.error('Erro ao atualizar parâmetro', { id, updateData, err });
      throw err;
    }
  }
  async deleteParameter(id: number): Promise<boolean> {
    try {
      const deleted = await db.delete(parameters).where(eq(parameters.id, id)).returning({ id: parameters.id });
      return deleted.length > 0;
    } catch (err: any) {
      if (err?.code === '23503') { const e = new Error('Não é possível excluir: existem registros relacionados.'); (e as any).status = 409; throw e; }
      throw err;
    }
  }

  // Attribute Definitions
  async listAttributeDefinitions(options?: { dataKind?: string; valueSource?: string; activeOnly?: boolean }): Promise<AttributeDefinition[]> {
    let q: any = db.select().from(attributeDefinitions);
    const conditions: any[] = [];
    if (options?.dataKind) conditions.push(eq(attributeDefinitions.dataKind as any, options.dataKind));
    if (options?.valueSource) conditions.push(eq(attributeDefinitions.valueSource as any, options.valueSource));
    if (options?.activeOnly) conditions.push(eq(attributeDefinitions.isActive, true));
    if (conditions.length === 1) q = q.where(conditions[0]);
    else if (conditions.length > 1) q = q.where(and(...conditions));
    const rows = await q.orderBy(sql`${attributeDefinitions.friendlyName} collate "pt-BR-x-icu"`);
    return rows as any;
  }
  async createAttributeDefinition(item: InsertAttributeDefinition): Promise<AttributeDefinition> {
    const [row] = await db.insert(attributeDefinitions).values(item as any).returning();
    return row as any;
  }
  async updateAttributeDefinition(id: number, item: Partial<InsertAttributeDefinition>): Promise<AttributeDefinition> {
    const data = { ...item, updatedAt: new Date() } as any;
    const [row] = await db.update(attributeDefinitions).set(data).where(eq(attributeDefinitions.id, id)).returning();
    return row as any;
  }
  async deleteAttributeDefinition(id: number): Promise<boolean> {
    try {
      const deleted = await db.delete(attributeDefinitions).where(eq(attributeDefinitions.id, id)).returning({ id: attributeDefinitions.id });
      return deleted.length > 0;
    } catch (err: any) {
      if (err?.code === '23503') { // foreign key violation
        const e = new Error('Não é possível excluir: existem registros relacionados.');
        (e as any).status = 409;
        throw e;
      }
      throw err;
    }
  }

  // Bioclimatic zones
  async listBioclimaticZones(): Promise<BioclimaticZone[]> {
  const rows = await db
    .select()
    .from(bioclimaticZones)
    .orderBy(
      sql`length(${bioclimaticZones.code})`,
      sql`${bioclimaticZones.code} collate "pt-BR-x-icu"`
    );
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

  // Isopleths
  async listIsopleths(): Promise<Isopleth[]> {
    const rows = await db
      .select()
      .from(isopleths)
      .orderBy(sql`length(${isopleths.code})`, sql`${isopleths.code} collate "pt-BR-x-icu"`);
    return rows as any;
  }
  async createIsopleth(item: InsertIsopleth): Promise<Isopleth> {
    const [row] = await db.insert(isopleths).values({
      code: (item as any).code,
      label: (item as any).label,
      windMinMS: (item as any).windMinMS,
      windMaxMS: (item as any).windMaxMS,
      isActive: (item as any).isActive ?? true,
    }).returning();
    return row as Isopleth;
  }
  async updateIsopleth(id: number, item: Partial<InsertIsopleth>): Promise<Isopleth> {
    const [row] = await db.update(isopleths)
      .set({ ...(item as any), updatedAt: new Date() })
      .where(eq(isopleths.id, id))
      .returning();
    return row as Isopleth;
  }
  async deleteIsopleth(id: number): Promise<boolean> {
    const deleted = await db.delete(isopleths)
      .where(eq(isopleths.id, id))
      .returning({ id: isopleths.id });
    return deleted.length > 0;
  }

  async listIsoplethCoverages(isoplethId: number): Promise<any[]> {
    const rows = await db.select({
      id: isoplethCoverages.id,
      isoplethId: isoplethCoverages.isoplethId,
      cityId: cities.id,
      city: cities.name,
      stateId: states.id,
      state: states.code,
    })
      .from(isoplethCoverages)
      .leftJoin(cities, eq(isoplethCoverages.cityId, cities.id))
      .leftJoin(states, eq(cities.stateId, states.id))
      .where(eq(isoplethCoverages.isoplethId, isoplethId))
      .orderBy(sql`${cities.name} collate "pt-BR-x-icu"`);
    return rows as any;
  }
  async listIsoplethsCoveragesIndex(): Promise<{ isoplethId: number; city: string; state: string }[]> {
    const rows = await db
      .select({
        isoplethId: isoplethCoverages.isoplethId,
        city: cities.name,
        state: states.code,
      })
      .from(isoplethCoverages)
      .leftJoin(cities, eq(isoplethCoverages.cityId, cities.id))
      .leftJoin(states, eq(cities.stateId, states.id));
    return rows as any;
  }
  async createIsoplethCoverage(isoplethId: number, item: Omit<InsertIsoplethCoverage, 'isoplethId'>): Promise<any> {
    const [row] = await db.insert(isoplethCoverages).values({
      isoplethId,
      cityId: (item as any).cityId,
    }).returning();
    return row as any;
  }
  async deleteIsoplethCoverage(id: number): Promise<boolean> {
    const deleted = await db.delete(isoplethCoverages).where(eq(isoplethCoverages.id, id)).returning({ id: isoplethCoverages.id });
    return deleted.length > 0;
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
      .where(eq(bioclimaticZoneCoverages.zoneId, zoneId))
      .orderBy(sql`${cities.name} collate "pt-BR-x-icu"`);
    return rows as any;
  }

  async findZonesByCityName(q: string): Promise<Array<{ id: number; code: string; label: string }>> {
    // Accent-insensitive, case-insensitive search without requiring unaccent extension
    const src = 'áàâãäéèêëíìîïóòôõöúùûüçñ';
    const dst = 'aaaaaeeeeiiiiooooouuuucn';
    const qLower = q.toLowerCase();
    const rows = await db
      .select({ id: bioclimaticZones.id, code: bioclimaticZones.code, label: bioclimaticZones.label })
      .from(bioclimaticZoneCoverages)
      .innerJoin(cities, eq(bioclimaticZoneCoverages.cityId, cities.id))
      .innerJoin(bioclimaticZones, eq(bioclimaticZoneCoverages.zoneId, bioclimaticZones.id))
      .where(sql`translate(lower(${cities.name}), ${src}, ${dst}) like '%' || translate(lower(${qLower}), ${src}, ${dst}) || '%'`);
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
    const src = 'áàâãäéèêëíìîïóòôõöúùûüçñ';
    const dst = 'aaaaaeeeeiiiiooooouuuucn';
    const cityLower = cityName.toLowerCase();
    const [ci] = await db
      .select()
      .from(cities)
      .where(and(
        eq(cities.stateId, (st as any).id),
        sql`translate(lower(${cities.name}), ${src}, ${dst}) = translate(lower(${cityLower}), ${src}, ${dst})`
      ))
      .limit(1);
    if (!ci) return null;
    const [cov] = await db.select({ zoneId: bioclimaticZoneCoverages.zoneId })
      .from(bioclimaticZoneCoverages)
      .where(eq(bioclimaticZoneCoverages.cityId, (ci as any).id))
      .limit(1);
    if (!cov) return null;
    const [zone] = await db.select({ code: bioclimaticZones.code }).from(bioclimaticZones).where(eq(bioclimaticZones.id, cov.zoneId)).limit(1);
    return zone?.code ?? null;
  }

  async findIsoplethForLocation(state: string, city?: string | null): Promise<string | null> {
    const uf = (state || '').toUpperCase();
    const cityName = (city || '').trim();
    if (!uf || !cityName) return null;
    const [st] = await db.select().from(states).where(eq(states.code, uf)).limit(1);
    if (!st) return null;
    const src = 'áàâãäéèêëíìîïóòôõöúùûüçñ';
    const dst = 'aaaaaeeeeiiiiooooouuuucn';
    const cityLower = cityName.toLowerCase();
    const [ci] = await db
      .select()
      .from(cities)
      .where(and(
        eq(cities.stateId, (st as any).id),
        sql`translate(lower(${cities.name}), ${src}, ${dst}) = translate(lower(${cityLower}), ${src}, ${dst})`
      ))
      .limit(1);
    if (!ci) return null;
    // find isopleth coverage for city
    const coverage = await db.select({ isoplethId: isoplethCoverages.isoplethId })
      .from(isoplethCoverages)
      .where(eq(isoplethCoverages.cityId, (ci as any).id))
      .limit(1);
    if (!coverage.length) return null;
    const [iso] = await db.select({ code: isopleths.code }).from(isopleths).where(eq(isopleths.id, coverage[0].isoplethId)).limit(1);
    return iso?.code || null;
  }

  // States & Cities
  async listStates(): Promise<State[]> {
  const rows = await db
    .select()
    .from(states)
    .orderBy(
      sql`length(${states.code})`,
      sql`${states.code} collate "pt-BR-x-icu"`
    );
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
  const rows = await db
    .select()
    .from(cities)
    .where(eq(cities.stateId, stateId))
    .orderBy(sql`${cities.name} collate "pt-BR-x-icu"`);
  return rows as any;
  }
  async listCities(): Promise<City[]> {
  const rows = await db
    .select()
    .from(cities)
    .orderBy(sql`${cities.name} collate "pt-BR-x-icu"`);
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

// One-time criteria seed helper (call manually if needed)
export const storage = new DatabaseStorage();

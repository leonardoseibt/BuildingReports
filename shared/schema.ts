import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  text,
  varchar,
  integer,
  decimal,
  timestamp,
  boolean,
  pgEnum,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Helpers to accept number or string for decimal DB fields and coerce integers
const decimalInput = z.union([z.string(), z.number()]).transform((v) =>
  typeof v === "number" ? String(v) : v
);
const intInput = z.coerce.number().int();
export const insertIsoplethCoverageSchema = z.object({
  isoplethId: z.coerce.number().int().positive().optional(), // Provided via route param usually
  cityId: z.coerce.number().int().positive(),
});

export type InsertIsoplethCoverage = z.infer<typeof insertIsoplethCoverageSchema>;
// Session storage table for express-session (connect-pg-simple)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table for application users
export const users = pgTable("users", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  email: varchar("email").notNull().unique(),
  fullName: text("full_name").notNull(),
  passwordHash: varchar("password_hash"),
  emailVerified: boolean("email_verified").default(false),
  verificationToken: varchar("verification_token"),
  phone: varchar("phone", { length: 32 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Enums
export const bioclimaticZoneEnum = pgEnum('bioclimatic_zone', [
  'ZB1', 'ZB2', 'ZB3', 'ZB4', 'ZB5', 'ZB6', 'ZB7', 'ZB8'
]);

export const structuralSystemEnum = pgEnum('structural_system', [
  'concrete', 'steel', 'masonry', 'wood'
]);

export const performanceLevelEnum = pgEnum('performance_level', [
  'minimum', 'intermediate', 'superior'
]);

export const evaluationStatusEnum = pgEnum('evaluation_status', [
  'pending', 'in_progress', 'completed', 'approved'
]);

// Aggressiveness risk enum
export const aggressivenessRiskEnum = pgEnum('aggressiveness_risk', [
  'Insignificante',
  'Pequeno',
  'Grande',
  'Elevado'
]);

// Bioclimatic Zones master tables
export const bioclimaticZones = pgTable("bioclimatic_zones", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  code: varchar("code", { length: 8 }).notNull().unique(), // e.g., ZB1..ZB8
  label: varchar("label", { length: 255 }).notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Isopletas (faixas de velocidade básica do vento)
export const isopleths = pgTable("isopleths", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  code: varchar("code", { length: 16 }).notNull().unique(),
  label: varchar("label", { length: 255 }).notNull(),
  windMinMS: decimal("wind_min_m_s", { precision: 6, scale: 2 }),
  windMaxMS: decimal("wind_max_m_s", { precision: 6, scale: 2 }),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// New normalized location tables
export const states = pgTable("states", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  code: varchar("code", { length: 2 }).notNull().unique(), // UF, e.g., RS
  name: varchar("name", { length: 128 }).notNull(), // e.g., Rio Grande do Sul
  region: varchar("region", { length: 64 }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const cities = pgTable("cities", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  stateId: integer("state_id").references(() => states.id).notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  // City-level attributes that used to live in coverages
  latitude: decimal("latitude", { precision: 10, scale: 6 }),
  longitude: decimal("longitude", { precision: 10, scale: 6 }),
  altitudeM: decimal("altitude_m", { precision: 10, scale: 2 }),
  tbsC: decimal("tbs_c", { precision: 10, scale: 2 }),
  urPercent: decimal("ur_percent", { precision: 5, scale: 2 }),
  radiacaoWm2: decimal("radiacao_wm2", { precision: 10, scale: 2 }),
  ventoMS: decimal("vento_m_s", { precision: 10, scale: 2 }),
  amplitudeC: decimal("amplitude_c", { precision: 10, scale: 2 }),
  // Basic wind speed (isopletas) in m/s
  ventoBasicoMS: decimal("vento_basico_m_s", { precision: 5, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Coverages now only associate city -> zone
export const bioclimaticZoneCoverages = pgTable("bioclimatic_zone_coverages", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  zoneId: integer("zone_id").references(() => bioclimaticZones.id).notNull(),
  cityId: integer("city_id").references(() => cities.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Isopleth coverages (city linked to isopleth)
export const isoplethCoverages = pgTable("isopleth_coverages", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  isoplethId: integer("isopleth_id").references(() => isopleths.id).notNull(),
  cityId: integer("city_id").references(() => cities.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Buildings table
export const buildings = pgTable("buildings", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  technicianId: integer("technician_id").references(() => technicians.id),
  name: text("name").notNull(),
  // New FKs to master tables
  typologyId: integer("typology_id").references(() => typologies.id),
  cep: varchar("cep", { length: 9 }).notNull(),
  street: varchar("street", { length: 255 }).notNull(),
  addressNumber: varchar("address_number", { length: 20 }),
  neighborhood: varchar("neighborhood", { length: 128 }),
  city: varchar("city", { length: 128 }),
  state: varchar("state", { length: 2 }),
  bioclimaticZone: varchar("bioclimatic_zone", { length: 16 }).notNull(),
  totalArea: decimal("total_area", { precision: 10, scale: 2 }).notNull(),
  buildingHeight: decimal("building_height", { precision: 10, scale: 2 }),
  floors: integer("floors").notNull(),
  units: integer("units").default(1),
  noiseClassId: integer("noise_class_id").references(() => noiseClasses.id),
  aggressivenessClassId: integer("aggressiveness_class_id").references(() => aggressivenessClasses.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Master tables for configurable vocabularies
export const typologies = pgTable("typologies", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  code: varchar("code", { length: 64 }).notNull().unique(),
  label: varchar("label", { length: 255 }).notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const noiseClasses = pgTable("noise_classes", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  code: varchar("code", { length: 64 }).notNull().unique(),
  label: varchar("label", { length: 255 }).notNull(),
  dayMinDb: integer('day_min_db').notNull().default(0),
  dayMaxDb: integer('day_max_db'),
  nightMinDb: integer('night_min_db').notNull().default(0),
  nightMaxDb: integer('night_max_db'),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const aggressivenessClasses = pgTable("aggressiveness_classes", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  code: varchar("code", { length: 64 }).notNull().unique(),
  label: varchar("label", { length: 255 }).notNull(),
  risk: aggressivenessRiskEnum('risk').notNull().default('Insignificante'),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Constructive Systems (Sistemas Construtivos)
export const constructiveSystems = pgTable("constructive_systems", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  code: varchar("code", { length: 64 }).notNull().unique(),
  label: varchar("label", { length: 255 }).notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Requirements Categories (Requisitos)
export const requirements = pgTable("requirements", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  code: varchar("code", { length: 16 }).notNull().unique(),
  label: varchar("label", { length: 255 }).notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Criteria (Critérios) - agora desacoplados; relação M:N via requirementsCriteria
export const criteria = pgTable("criteria", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  code: varchar("code", { length: 16 }).notNull().unique(),
  label: varchar("label", { length: 255 }).notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Pivot Requisitos <-> Critérios (M:N)
export const requirementsCriteria = pgTable("requirements_criteria", {
  requirementId: integer("requirement_id").references(() => requirements.id, { onDelete: 'cascade' }).notNull(),
  criterionId: integer("criterion_id").references(() => criteria.id, { onDelete: 'cascade' }).notNull(),
}, (table) => [
  primaryKey({ columns: [table.requirementId, table.criterionId] }),
  index("idx_reqcrit_requirement").on(table.requirementId),
  index("idx_reqcrit_criterion").on(table.criterionId)
]);

// Analyses (Análises) - dependem de Critérios (1:N)
export const analyses = pgTable("analyses", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  requirementId: integer("requirement_id").references(() => requirements.id).notNull(),
  criterionId: integer("criterion_id").references(() => criteria.id).notNull(),
  code: varchar("code", { length: 32 }).notNull(), // único dentro do par (requisito, critério)
  label: varchar("label", { length: 255 }).notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_analyses_requirement").on(table.requirementId),
  index("idx_analyses_criterion").on(table.criterionId),
  uniqueIndex("uq_analyses_req_crit_code").on(table.requirementId, table.criterionId, table.code),
]);

// Parameters (Parâmetros) belonging to an Analysis
export const parameters = pgTable("parameters", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  analysisId: integer("analysis_id").references(() => analyses.id).notNull(),
  label: varchar("label", { length: 255 }).notNull(), // descrição
  minimumValue: text("minimum_value"),
  intermediateValue: text("intermediate_value"),
  superiorValue: text("superior_value"),
  // Alterado para texto para permitir expressões variáveis
  minLimit: text("min_limit"),
  maxLimit: text("max_limit"),
  unit: varchar("unit", { length: 32 }),
  notes: text("notes"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_parameters_analysis").on(table.analysisId),
]);

// Structural Systems
export const structuralSystems = pgTable("structural_systems", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  buildingId: integer("building_id").references(() => buildings.id).notNull(),
  systemType: structuralSystemEnum("system_type").notNull(),
  materialResistance: decimal("material_resistance", { precision: 8, scale: 2 }),
  designLife: integer("design_life").notNull(), // VUP in years
  designLoads: decimal("design_loads", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Sealing Systems (Vedações)
export const sealingSystems = pgTable("sealing_systems", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  buildingId: integer("building_id").references(() => buildings.id).notNull(),
  externalWalls: jsonb("external_walls"), // {materials: [], thickness: number, thermalTransmittance: number}
  internalWalls: jsonb("internal_walls"),
  acousticProperties: jsonb("acoustic_properties"), // {isolation: number, materials: []}
  thermalProperties: jsonb("thermal_properties"), // {transmittance: number, capacity: number}
  createdAt: timestamp("created_at").defaultNow(),
});

// Roofing Systems
export const roofingSystems = pgTable("roofing_systems", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  buildingId: integer("building_id").references(() => buildings.id).notNull(),
  roofingType: text("roofing_type").notNull(),
  thermalProperties: jsonb("thermal_properties"),
  waterproofing: boolean("waterproofing").default(false),
  slope: decimal("slope", { precision: 4, scale: 2 }),
  thermalInsulation: jsonb("thermal_insulation"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Performance Evaluations
export const performanceEvaluations = pgTable("performance_evaluations", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  buildingId: integer("building_id").references(() => buildings.id).notNull(),
  structuralSafety: performanceLevelEnum("structural_safety"),
  thermalPerformance: performanceLevelEnum("thermal_performance"),
  acousticPerformance: performanceLevelEnum("acoustic_performance"),
  waterTightness: performanceLevelEnum("water_tightness"),
  fireSafety: performanceLevelEnum("fire_safety"),
  evaluationData: jsonb("evaluation_data"), // detailed calculation results
  status: evaluationStatusEnum("status").default('pending'),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Reports
export const reports = pgTable("reports", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  buildingId: integer("building_id").references(() => buildings.id).notNull(),
  evaluationId: integer("evaluation_id").references(() => performanceEvaluations.id).notNull(),
  reportData: jsonb("report_data").notNull(), // complete report structure
  version: integer("version").default(1),
  isActive: boolean("is_active").default(true),
  generatedAt: timestamp("generated_at").defaultNow(),
});

// Technicians (Responsáveis Técnicos)
export const technicians = pgTable("technicians", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(), // owner
  fullName: text("full_name").notNull(),
  creaCau: varchar("crea_cau", { length: 50 }).notNull(),
  licenseState: varchar("license_state", { length: 2 }), // UF
  cpfCnpj: varchar("cpf_cnpj", { length: 18 }),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 32 }),
  company: varchar("company", { length: 255 }),
  street: varchar("street", { length: 255 }).notNull(),
  addressNumber: varchar("address_number", { length: 20 }),
  neighborhood: varchar("neighborhood", { length: 128 }),
  city: varchar("city", { length: 128 }),
  state: varchar("state", { length: 2 }),
  cep: varchar("cep", { length: 9 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  buildings: many(buildings),
  technicians: many(technicians),
}));

export const buildingsRelations = relations(buildings, ({ one, many }) => ({
  user: one(users, {
    fields: [buildings.userId],
    references: [users.id],
  }),
  technician: one(technicians, {
  fields: [buildings.technicianId],
    references: [technicians.id],
  }),
  structuralSystem: one(structuralSystems),
  sealingSystem: one(sealingSystems),
  roofingSystem: one(roofingSystems),
  evaluations: many(performanceEvaluations),
  reports: many(reports),
}));

export const bioclimaticZonesRelations = relations(bioclimaticZones, ({ many }) => ({
  coverages: many(bioclimaticZoneCoverages),
}));

export const bioclimaticZoneCoveragesRelations = relations(bioclimaticZoneCoverages, ({ one }) => ({
  zone: one(bioclimaticZones, {
    fields: [bioclimaticZoneCoverages.zoneId],
    references: [bioclimaticZones.id],
  }),
}));

export const statesRelations = relations(states, ({ many }) => ({
  cities: many(cities),
}));

export const citiesRelations = relations(cities, ({ one }) => ({
  state: one(states, {
    fields: [cities.stateId],
    references: [states.id],
  }),
}));

export const structuralSystemsRelations = relations(structuralSystems, ({ one }) => ({
  building: one(buildings, {
    fields: [structuralSystems.buildingId],
    references: [buildings.id],
  }),
}));

export const sealingSystemsRelations = relations(sealingSystems, ({ one }) => ({
  building: one(buildings, {
    fields: [sealingSystems.buildingId],
    references: [buildings.id],
  }),
}));

export const roofingSystemsRelations = relations(roofingSystems, ({ one }) => ({
  building: one(buildings, {
    fields: [roofingSystems.buildingId],
    references: [buildings.id],
  }),
}));

export const performanceEvaluationsRelations = relations(performanceEvaluations, ({ one, many }) => ({
  building: one(buildings, {
    fields: [performanceEvaluations.buildingId],
    references: [buildings.id],
  }),
  reports: many(reports),
}));

export const reportsRelations = relations(reports, ({ one }) => ({
  building: one(buildings, {
    fields: [reports.buildingId],
    references: [buildings.id],
  }),
  evaluation: one(performanceEvaluations, {
    fields: [reports.evaluationId],
    references: [performanceEvaluations.id],
  }),
}));

export const techniciansRelations = relations(technicians, ({ one }) => ({
  user: one(users, {
    fields: [technicians.userId],
    references: [users.id],
  }),
}));

export const analysesRelations = relations(analyses, ({ many, one }) => ({
  requirement: one(requirements, {
    fields: [analyses.requirementId],
    references: [requirements.id],
  }),
  criterion: one(criteria, {
    fields: [analyses.criterionId],
    references: [criteria.id],
  }),
  parameters: many(parameters),
}));

export const parametersRelations = relations(parameters, ({ one }) => ({
  analysis: one(analyses, {
    fields: [parameters.analysisId],
    references: [analyses.id],
  }),
}));

export const criteriaRelations = relations(criteria, ({ many }) => ({
  analyses: many(analyses),
  requirementLinks: many(requirementsCriteria),
}));

export const requirementsCriteriaRelations = relations(requirementsCriteria, ({ one }) => ({
  requirement: one(requirements, {
    fields: [requirementsCriteria.requirementId],
    references: [requirements.id],
  }),
  criterion: one(criteria, {
    fields: [requirementsCriteria.criterionId],
    references: [criteria.id],
  }),
}));

// Insert Schemas
// Padrão de validação: Mensagens em PT-BR para todos os cadastros.
// Ao criar novos schemas, utilize min/length/refine/superRefine com mensagens legíveis em português.
export const insertUserSchema = z.object({
  fullName: z.string().min(1, 'Nome é obrigatório'),
  email: z.string().min(1, 'Email é obrigatório').email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
  phone: z.string().optional(),
});

export const updateUserSchema = z.object({
  fullName: z.string().min(1, 'Nome é obrigatório'),
  email: z.string().min(1, 'Email é obrigatório').email('Email inválido'),
  password: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() === '' ? undefined : val),
    z.string().min(6, 'Senha deve ter pelo menos 6 caracteres').optional(),
  ),
  phone: z.string().optional(),
});

export const insertBuildingSchema = createInsertSchema(buildings)
  .extend({
    totalArea: decimalInput,
  buildingHeight: decimalInput.optional(),
    floors: intInput,
    units: intInput.optional(),
  neighborhood: z.string().optional().nullable().transform(v => v ? v : undefined),
  street: z.string().min(1, 'Logradouro é obrigatório'),
  city: z.string().optional().nullable().transform(v => v ? v : undefined),
  state: z.string().optional().nullable().transform(v => v ? v : undefined),
  });

// Allow partial updates on buildings (no userId changes through API)
export const updateBuildingSchema = insertBuildingSchema.partial().omit({ userId: true });

export const insertStructuralSystemSchema = createInsertSchema(structuralSystems)
  .extend({
    materialResistance: decimalInput.optional(),
    designLife: intInput,
    designLoads: decimalInput.optional(),
  });

export const insertSealingSystemSchema = createInsertSchema(sealingSystems);

export const insertRoofingSystemSchema = createInsertSchema(roofingSystems)
  .extend({
    slope: decimalInput.optional(),
  });

export const insertPerformanceEvaluationSchema = createInsertSchema(performanceEvaluations)
  .partial({
    structuralSafety: true,
    thermalPerformance: true,
    acousticPerformance: true,
    waterTightness: true,
    fireSafety: true,
    evaluationData: true,
  });

export const insertReportSchema = createInsertSchema(reports);

export const insertTechnicianSchema = createInsertSchema(technicians)
  .extend({
    cpfCnpj: z.string().min(1, 'CPF/CNPJ é obrigatório'),
    email: z.string().min(1, 'Email é obrigatório').email('Email inválido'),
    phone: z.string().min(1, 'Telefone é obrigatório'),
    company: z.string().optional().nullable().transform(v => v || undefined),
    street: z.string().min(1, 'Logradouro é obrigatório'),
    addressNumber: z.string().optional().nullable().transform(v => v || undefined),
    neighborhood: z.string().optional().nullable().transform(v => v || undefined),
    city: z.string().optional().nullable().transform(v => v || undefined),
    state: z.string().optional().nullable().transform(v => v || undefined),
    cep: z.string().optional().nullable().transform(v => v || undefined),
    notes: z.string().optional().nullable().transform(v => v || undefined),
    licenseState: z.string().min(1, 'UF do Registro é obrigatória').length(2, 'UF do Registro é obrigatória'),
  });

// Insert schemas for master tables
export const insertTypologySchema = createInsertSchema(typologies);
export const insertNoiseClassSchema = createInsertSchema(noiseClasses);
export const insertAggressivenessClassSchema = createInsertSchema(aggressivenessClasses);
export const insertConstructiveSystemSchema = createInsertSchema(constructiveSystems);
export const insertRequirementSchema = createInsertSchema(requirements);
export const insertCriterionSchema = createInsertSchema(criteria);
export const insertAnalysisSchema = createInsertSchema(analyses)
  .extend({
    requirementId: z.coerce.number().min(1, 'Requisito é obrigatório'),
    criterionId: z.coerce.number().min(1, 'Critério é obrigatório'),
  });
export const insertIsoplethSchema = createInsertSchema(isopleths)
  .extend({
    windMinMS: decimalInput.optional(),
    windMaxMS: decimalInput.optional(),
  });
export type Isopleth = typeof isopleths.$inferSelect;
export type InsertIsopleth = z.infer<typeof insertIsoplethSchema>;
export const insertParameterSchema = createInsertSchema(parameters)
  .extend({
    // Permitir envio de null para limpar valores durante updates
    minimumValue: decimalInput.optional().nullable(),
    intermediateValue: decimalInput.optional().nullable(),
    superiorValue: decimalInput.optional().nullable(),
  // Agora texto livre
  minLimit: z.string().optional().nullable(),
  maxLimit: z.string().optional().nullable(),
    unit: z.string().max(32).optional().nullable(),
    notes: z.string().optional().nullable(),
  });

export const insertBioclimaticZoneSchema = createInsertSchema(bioclimaticZones);
export const insertStateSchema = createInsertSchema(states);
export const insertCitySchema = createInsertSchema(cities)
  .extend({
    latitude: decimalInput.optional(),
    longitude: decimalInput.optional(),
    altitudeM: decimalInput.optional(),
    tbsC: decimalInput.optional(),
    urPercent: decimalInput.optional(),
    radiacaoWm2: decimalInput.optional(),
    ventoMS: decimalInput.optional(),
    amplitudeC: decimalInput.optional(),
  ventoBasicoMS: decimalInput.optional(), // permitir número ou string
  });

export const insertBioclimaticZoneCoverageSchema = createInsertSchema(bioclimaticZoneCoverages);

// Allow partial updates on technicians (no userId changes through API)
export const updateTechnicianSchema = insertTechnicianSchema.partial().omit({ userId: true });

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type PublicUser = Omit<User, 'passwordHash' | 'verificationToken'>;
export type UpdateUser = z.infer<typeof updateUserSchema>;
export type InsertBuilding = z.infer<typeof insertBuildingSchema>;
export type Building = typeof buildings.$inferSelect;
export type UpdateBuilding = z.infer<typeof updateBuildingSchema>;
export type InsertStructuralSystem = z.infer<typeof insertStructuralSystemSchema>;
export type StructuralSystem = typeof structuralSystems.$inferSelect;
export type InsertSealingSystem = z.infer<typeof insertSealingSystemSchema>;
export type SealingSystem = typeof sealingSystems.$inferSelect;
export type InsertRoofingSystem = z.infer<typeof insertRoofingSystemSchema>;
export type RoofingSystem = typeof roofingSystems.$inferSelect;
export type InsertPerformanceEvaluation = z.infer<typeof insertPerformanceEvaluationSchema>;
export type PerformanceEvaluation = typeof performanceEvaluations.$inferSelect;
export type InsertReport = z.infer<typeof insertReportSchema>;
export type Report = typeof reports.$inferSelect;
export type InsertTechnician = z.infer<typeof insertTechnicianSchema>;
export type Technician = typeof technicians.$inferSelect;
export type UpdateTechnician = z.infer<typeof updateTechnicianSchema>;
export type Typology = typeof typologies.$inferSelect;
export type InsertTypology = z.infer<typeof insertTypologySchema>;
export type NoiseClass = typeof noiseClasses.$inferSelect;
export type InsertNoiseClass = z.infer<typeof insertNoiseClassSchema>;
export type AggressivenessClass = typeof aggressivenessClasses.$inferSelect;
export type InsertAggressivenessClass = z.infer<typeof insertAggressivenessClassSchema>;
export type ConstructiveSystem = typeof constructiveSystems.$inferSelect;
export type InsertConstructiveSystem = z.infer<typeof insertConstructiveSystemSchema>;
export type Requirement = typeof requirements.$inferSelect;
export type InsertRequirement = z.infer<typeof insertRequirementSchema>;
export type Criterion = typeof criteria.$inferSelect;
export type InsertCriterion = z.infer<typeof insertCriterionSchema>;
export type Analysis = typeof analyses.$inferSelect;
export type InsertAnalysis = z.infer<typeof insertAnalysisSchema>;
export type Parameter = typeof parameters.$inferSelect;
export type InsertParameter = z.infer<typeof insertParameterSchema>;
export type BioclimaticZone = typeof bioclimaticZones.$inferSelect;
export type InsertBioclimaticZone = z.infer<typeof insertBioclimaticZoneSchema>;
export type BioclimaticZoneCoverage = typeof bioclimaticZoneCoverages.$inferSelect;
export type InsertBioclimaticZoneCoverage = z.infer<typeof insertBioclimaticZoneCoverageSchema>;
export type State = typeof states.$inferSelect;
export type InsertState = z.infer<typeof insertStateSchema>;
export type City = typeof cities.$inferSelect;
export type InsertCity = z.infer<typeof insertCitySchema>;

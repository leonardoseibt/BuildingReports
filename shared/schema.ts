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
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Helpers to accept number or string for decimal DB fields and coerce integers
const decimalInput = z.union([z.string(), z.number()]).transform((v) =>
  typeof v === "number" ? String(v) : v
);
const intInput = z.coerce.number().int();

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
  email: varchar("email").unique(),
  fullName: text("full_name").notNull(),
  passwordHash: varchar("password_hash"),
  phone: varchar("phone", { length: 32 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Enums
export const buildingTypologyEnum = pgEnum('building_typology', [
  'unifamiliar', 'multifamiliar', 'comercial', 'institucional'
]);

export const bioclimaticZoneEnum = pgEnum('bioclimatic_zone', [
  'ZB1', 'ZB2', 'ZB3', 'ZB4', 'ZB5', 'ZB6', 'ZB7', 'ZB8'
]);

export const noiseClassEnum = pgEnum('noise_class', [
  'classe1', 'classe2', 'classe3', 'classe4'
]);

export const aggressivenessClassEnum = pgEnum('aggressiveness_class', [
  'caa1', 'caa2', 'caa3', 'caa4'
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

// Buildings table
export const buildings = pgTable("buildings", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  technicalResponsible: text("technical_responsible").notNull(),
  creaCau: text("crea_cau").notNull(),
  typology: buildingTypologyEnum("typology").notNull(),
  cep: varchar("cep", { length: 9 }).notNull(),
  address: text("address").notNull(),
  bioclimaticZone: bioclimaticZoneEnum("bioclimatic_zone").notNull(),
  totalArea: decimal("total_area", { precision: 10, scale: 2 }).notNull(),
  floors: integer("floors").notNull(),
  units: integer("units").default(1),
  noiseClass: noiseClassEnum("noise_class").notNull(),
  aggressivenessClass: aggressivenessClassEnum("aggressiveness_class").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

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
  registrationType: varchar("registration_type", { length: 10 }), // CREA or CAU
  licenseState: varchar("license_state", { length: 2 }), // UF
  cpfCnpj: varchar("cpf_cnpj", { length: 18 }),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 32 }),
  company: varchar("company", { length: 255 }),
  address: text("address"),
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
  structuralSystem: one(structuralSystems),
  sealingSystem: one(sealingSystems),
  roofingSystem: one(roofingSystems),
  evaluations: many(performanceEvaluations),
  reports: many(reports),
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

// Insert Schemas
export const insertUserSchema = z.object({
  fullName: z.string().min(1, 'Nome é obrigatório'),
  email: z.string().email(),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
  phone: z.string().optional(),
});

export const updateUserSchema = z.object({
  fullName: z.string().min(1, 'Nome é obrigatório'),
  email: z.string().email(),
  password: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() === '' ? undefined : val),
    z.string().min(6, 'Senha deve ter pelo menos 6 caracteres').optional(),
  ),
  phone: z.string().optional(),
});

export const insertBuildingSchema = createInsertSchema(buildings)
  .extend({
    totalArea: decimalInput,
    floors: intInput,
    units: intInput.optional(),
  });

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
    // normalize optional strings
    cpfCnpj: z.string().optional().nullable().transform((v) => (v ? v : undefined)),
    email: z.string().email().optional().nullable().transform((v) => (v ? v : undefined)),
    phone: z.string().optional().nullable().transform((v) => (v ? v : undefined)),
    company: z.string().optional().nullable().transform((v) => (v ? v : undefined)),
    address: z.string().optional().nullable().transform((v) => (v ? v : undefined)),
    city: z.string().optional().nullable().transform((v) => (v ? v : undefined)),
    state: z.string().optional().nullable().transform((v) => (v ? v : undefined)),
    cep: z.string().optional().nullable().transform((v) => (v ? v : undefined)),
    notes: z.string().optional().nullable().transform((v) => (v ? v : undefined)),
    registrationType: z.string().optional().nullable().transform((v) => (v ? v : undefined)),
    licenseState: z.string().optional().nullable().transform((v) => (v ? v : undefined)),
  });

// Allow partial updates on technicians (no userId changes through API)
export const updateTechnicianSchema = insertTechnicianSchema.partial().omit({ userId: true });

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type PublicUser = Omit<User, 'passwordHash'>;
export type UpdateUser = z.infer<typeof updateUserSchema>;
export type InsertBuilding = z.infer<typeof insertBuildingSchema>;
export type Building = typeof buildings.$inferSelect;
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
